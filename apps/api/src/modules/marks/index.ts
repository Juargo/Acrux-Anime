import type { Response } from 'express';
import { z } from 'zod';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import type { Session } from '../../http/session.js';
import type { MarksService, MarkView } from './services/marks.service.js';

// Contract of the marks API (issue #33, S8 of odd/tasks/marcar-franquicia.md).
const INT4_MAX = 2_147_483_647;
const MAX_BATCH = 200;
const DEFAULT_PAGE = 500;
const MAX_PAGE = 1000;

const id = z.number().int().min(1).max(INT4_MAX);
const status = z.enum(['seen', 'watching']);

const putBody = z.strictObject({ status, malId: id.nullable().optional() });
const batchBody = z
  .strictObject({
    status: status.nullable(),
    entries: z
      .array(z.strictObject({ anilistId: id, malId: id.nullable().optional() }))
      .min(1)
      .max(MAX_BATCH),
  })
  .refine(
    (body) => new Set(body.entries.map((entry) => entry.anilistId)).size === body.entries.length,
    { message: 'entries must be distinct' },
  );

const markSchema = z
  .object({ anilistId: id, malId: id.nullable(), status, markedAt: z.iso.datetime() })
  .meta({ id: 'Mark' });
const anilistIdParam = z.int().min(1).max(INT4_MAX);

const invalidId = { description: 'The anilistId is not a positive integer' };
const unavailable = { description: 'The database is not configured' };

// Decimal digits only: Number() would also accept '1e3', ' 7' or '0x10'.
function parseAnilistId(value: unknown): number {
  const parsed = typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : 0;
  if (parsed < 1 || parsed > INT4_MAX) {
    throw new ProblemError(400, 'marks.invalid_anilist_id', 'Invalid anilistId');
  }
  return parsed;
}

// Decimal digits only, once each: ?cursor=1&cursor=2 arrives as an array.
function parseQueryInt(value: unknown, max: number): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : 0;
  if (parsed < 1 || parsed > max) {
    throw new ProblemError(400, 'marks.invalid_query', 'Invalid cursor or limit');
  }
  return parsed;
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ProblemError(400, 'marks.invalid_body', 'Invalid marks body');
  return result.data;
}

// User data is never cached, not even on errors (ADR-0023).
function start(marks: MarksService | undefined, response: Response) {
  response.setHeader('Cache-Control', 'private, no-store');
  const session: Session | undefined = response.locals.session;
  if (!marks || !session) {
    throw new ProblemError(503, 'marks.unavailable', 'Marks are not available');
  }
  return { marks, session };
}

function toJson(mark: MarkView) {
  return { ...mark, markedAt: mark.markedAt.toISOString() };
}

// Without a database the routes stay mounted and answer 503, as the profile does.
export function createMarksModule(service: MarksService | undefined): Module {
  return {
    name: 'marks',
    routes: [
      {
        method: 'get',
        path: '/api/v1/me/marks',
        docs: {
          summary: 'Marks of the signed-in user, ordered by anilistId, one page at a time',
          query: {
            cursor: z
              .string()
              .regex(/^[1-9]\d*$/)
              .optional()
              .meta({
                description: 'The nextCursor of the previous page; leave it out for the first',
              }),
            limit: z
              .string()
              .regex(/^[1-9]\d*$/)
              .optional()
              .meta({
                description: `Marks per page, 1 to ${MAX_PAGE}; ${DEFAULT_PAGE} by default`,
              }),
          },
          responses: {
            200: {
              description: 'One page of marks; nextCursor is null on the last page',
              schema: z.object({ items: z.array(markSchema), nextCursor: z.string().nullable() }),
            },
            400: { description: 'The cursor or the limit is not a valid positive integer' },
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const { marks, session } = start(service, response);
          const after = parseQueryInt(request.query.cursor, INT4_MAX);
          const limit = parseQueryInt(request.query.limit, MAX_PAGE) ?? DEFAULT_PAGE;
          const page = await marks.list(
            session,
            after === undefined ? { limit } : { after, limit },
          );
          response.json({
            items: page.items.map(toJson),
            nextCursor: page.nextCursor === null ? null : String(page.nextCursor),
          });
        },
      },
      {
        method: 'put',
        path: '/api/v1/me/marks/:anilistId',
        rateLimit: 'write',
        docs: {
          summary: 'Mark one entry; the same status again keeps markedAt',
          params: { anilistId: anilistIdParam },
          requestBody: putBody,
          responses: {
            200: { description: 'The stored mark', schema: markSchema },
            400: { description: 'Invalid anilistId, unknown fields or an invalid body' },
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const { marks, session } = start(service, response);
          const anilistId = parseAnilistId(request.params.anilistId);
          const body = parseBody(putBody, request.body);
          response.json(toJson(await marks.put(session, anilistId, body)));
        },
      },
      {
        method: 'delete',
        path: '/api/v1/me/marks/:anilistId',
        rateLimit: 'write',
        docs: {
          summary: 'Unmark one entry; also 204 when it was not marked',
          params: { anilistId: anilistIdParam },
          responses: {
            204: { description: 'Not marked anymore' },
            400: invalidId,
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const { marks, session } = start(service, response);
          await marks.remove(session, parseAnilistId(request.params.anilistId));
          response.status(204).end();
        },
      },
      {
        method: 'post',
        path: '/api/v1/me/marks\\:batch',
        rateLimit: 'write',
        docs: {
          summary: 'Mark or unmark 1 to 200 distinct entries in one transaction',
          requestBody: batchBody,
          responses: {
            200: {
              description: 'The marks written; empty when the status is null',
              schema: z.object({ items: z.array(markSchema) }),
            },
            400: { description: 'Unknown fields, repeated entries or an invalid body' },
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const { marks, session } = start(service, response);
          const body = parseBody(batchBody, request.body);
          const items = await marks.batch(session, body);
          response.json({ items: items.map(toJson) });
        },
      },
    ],
  };
}
