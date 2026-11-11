import type { Response } from 'express';
import { z } from 'zod';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import type {
  FranchiseOverrideRow,
  FranchiseOverridesRepository,
} from './repositories/franchise-overrides.repository.js';

// The curator table (#42, RF-60, ADR-0023): anyone reads it, so the browser groups
// franchises with it (ADR-0024), visitors of a public profile included; it holds only
// MyAnimeList ids (RDI-15). Only the curator writes it (ADR-0025).
const INT4_MAX = 2_147_483_647;
const id = z.int().min(1).max(INT4_MAX);
const role = z.enum(['core', 'extra', 'separate']);

const putBody = z.strictObject({ franchiseRootId: id, role });
const overrideSchema = z
  .object({ animeId: id, franchiseRootId: id, role, updatedAt: z.iso.datetime() })
  .meta({ id: 'FranchiseOverride' });

const unavailable = { description: 'The database is not configured' };

// Decimal digits only: Number() would also accept '1e3', ' 7' or '0x10'.
function parseAnimeId(value: unknown): number {
  const parsed = typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : 0;
  if (parsed < 1 || parsed > INT4_MAX) {
    throw new ProblemError(400, 'franchises.invalid_anime_id', 'Invalid animeId');
  }
  return parsed;
}

function start(
  repository: FranchiseOverridesRepository | undefined,
  response: Response,
  cacheControl = 'private, no-store',
) {
  response.setHeader('Cache-Control', cacheControl);
  if (!repository) {
    throw new ProblemError(503, 'franchises.unavailable', 'Corrections are not available');
  }
  return repository;
}

const toJson = (row: FranchiseOverrideRow) => ({ ...row, updatedAt: row.updatedAt.toISOString() });

// Without a database the routes stay mounted and answer 503, as the profile does.
export function createFranchisesModule(
  repository: FranchiseOverridesRepository | undefined,
): Module {
  return {
    name: 'franchises',
    routes: [
      {
        method: 'get',
        path: '/api/v1/franchise-overrides',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'The curator table, applied before automatic grouping (RF-60)',
          responses: {
            200: {
              description: 'Every correction, ordered by animeId',
              schema: z.object({ items: z.array(overrideSchema) }),
            },
            503: unavailable,
          },
        },
        handler: async (_request, response) => {
          // The CDN keeps it five minutes, so a correction reaches everyone within that time.
          const overrides = start(repository, response, 'public, max-age=0, s-maxage=300');
          const rows = await overrides.list();
          response.json({ items: rows.map(toJson) });
        },
      },
      {
        method: 'put',
        path: '/api/v1/franchise-overrides/:animeId',
        role: 'curator',
        rateLimit: 'write',
        docs: {
          summary:
            'Save the correction of one entry; there is no delete, set another role instead (RF-60)',
          params: { animeId: id },
          requestBody: putBody,
          responses: {
            200: { description: 'The stored correction', schema: overrideSchema },
            400: { description: 'Invalid animeId, unknown fields or an invalid body' },
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const overrides = start(repository, response);
          const animeId = parseAnimeId(request.params.animeId);
          const body = putBody.safeParse(request.body);
          if (!body.success) {
            throw new ProblemError(400, 'franchises.invalid_body', 'Invalid correction');
          }
          response.json(toJson(await overrides.upsert({ animeId, ...body.data })));
        },
      },
    ],
  };
}
