import type { Response } from 'express';
import { z } from 'zod';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import { ORIGINS } from './repositories/drama-catalog.repository.js';
import type { DramaFilters, DramaService } from './services/drama.service.js';

// The drama catalog (ADR-0046): live-action series copied from TVmaze into our database, so
// the browser never calls TVmaze. Anyone reads it and it holds nothing about a user, so the
// CDN keeps every answer. Dramas have no franchises and no relations.
const INT4_MAX = 2_147_483_647;
const MAX_IDS = 100;
const MAX_PAGE = 1000;
const MAX_GENRES = 10;
const MAX_TEXT = 100;
const CACHE_CONTROL = 'public, max-age=0, s-maxage=300';

const id = z.int().min(1).max(INT4_MAX);
const origin = z.enum(ORIGINS);
const dramaSchema = z
  .object({
    id,
    title: z.string().meta({ description: 'The international title, as TVmaze names the show' }),
    aliases: z.array(z.string()).meta({ description: 'Empty until the detail is read' }),
    summary: z.string().nullable(),
    coverUrl: z.string().nullable(),
    tvmazeUrl: z.string().meta({ description: 'The page of the show at TVmaze, for the credit' }),
    country: z.string().nullable(),
    language: z.string().nullable(),
    origin: origin
      .nullable()
      .meta({ description: 'The country, or the language when there is no country' }),
    year: z.int().nullable(),
    seasons: z.int().nullable().meta({ description: 'Null until the detail is read' }),
    episodes: z.int().nullable().meta({ description: 'Null until the detail is read' }),
    genres: z.array(z.string()),
  })
  .meta({ id: 'Drama' });

const unavailable = { description: 'The database is not configured' };
const invalidQuery = { description: 'A query parameter is missing, repeated or not valid' };
const text = (description: string) => z.string().optional().meta({ description });

function invalid(detail: string): never {
  throw new ProblemError(400, 'dramas.invalid_query', detail);
}

// ?page=1&page=2 arrives as an array: each parameter is accepted once.
function single(query: Record<string, unknown>, name: string): string | undefined {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') invalid(`Invalid ${name}`);
  return value;
}

// Decimal digits only: Number() would also accept '1e3', ' 7' or '0x10'.
function toInt(value: string, name: string, min: number, max: number): number {
  const parsed = /^[1-9]\d{0,9}$/.test(value) ? Number(value) : 0;
  if (parsed < min || parsed > max) invalid(`Invalid ${name}`);
  return parsed;
}

function parseIds(query: Record<string, unknown>): number[] {
  const value = single(query, 'ids');
  if (value === undefined || value === '') invalid('Missing ids');
  const ids = [...new Set(value.split(',').map((part) => toInt(part, 'ids', 1, INT4_MAX)))];
  if (ids.length > MAX_IDS) invalid('Too many ids');
  return ids;
}

function parseFilters(query: Record<string, unknown>): DramaFilters {
  const search = single(query, 'search')?.trim();
  if (search !== undefined && search.length > MAX_TEXT) invalid('Invalid search');
  const value = single(query, 'origin');
  const picked = ORIGINS.find((candidate) => candidate === value);
  if (value !== undefined && picked === undefined) invalid('Invalid origin');
  const genres = single(query, 'genres')?.split(',') ?? [];
  if (
    genres.length > MAX_GENRES ||
    genres.some((genre) => genre.trim() === '' || genre.length > MAX_TEXT)
  ) {
    invalid('Invalid genres');
  }
  return {
    ...(search === undefined || search === '' ? {} : { search }),
    ...(picked === undefined ? {} : { origin: picked }),
    genres: genres.map((genre) => genre.trim()),
  };
}

function start(service: DramaService | undefined, response: Response): DramaService {
  if (!service) {
    response.setHeader('Cache-Control', 'private, no-store');
    throw new ProblemError(503, 'dramas.unavailable', 'The drama catalog is not available');
  }
  response.setHeader('Cache-Control', CACHE_CONTROL);
  return service;
}

// Without a database the routes stay mounted and answer 503, as the catalog does.
export function createDramasModule(service: DramaService | undefined): Module {
  return {
    name: 'dramas',
    routes: [
      {
        method: 'get',
        path: '/api/v1/dramas',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'One page of the dramas, most popular first, 50 dramas a page',
          query: {
            search: text(
              `Part of the title or of an alias, up to ${MAX_TEXT} characters; case, accents and tone marks do not count`,
            ),
            origin: text(`Any of ${ORIGINS.join(', ')}; by country, or by language without one`),
            genres: text(`Up to ${MAX_GENRES} genres separated by commas; any of them matches`),
            page: text(`1 to ${MAX_PAGE}; 1 by default`),
          },
          responses: {
            200: {
              description: 'The page and the next page or null; adult dramas never come out',
              schema: z.object({ items: z.array(dramaSchema), nextPage: z.int().nullable() }),
            },
            400: invalidQuery,
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const dramas = start(service, response);
          const filters = parseFilters(request.query);
          const page = toInt(single(request.query, 'page') ?? '1', 'page', 1, MAX_PAGE);
          response.json(await dramas.browse(filters, page));
        },
      },
      {
        method: 'get',
        path: '/api/v1/dramas/by-ids',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'The dramas of the given ids, and the ids the catalog does not serve',
          query: {
            ids: z
              .string()
              .meta({ description: `ids: 1 to ${MAX_IDS} TVmaze ids, separated by commas` }),
          },
          responses: {
            200: {
              description:
                'The dramas found, in no particular order, and the ids not found: unknown ones and adult ones',
              schema: z.object({ items: z.array(dramaSchema), missing: z.array(id) }),
            },
            400: invalidQuery,
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const dramas = start(service, response);
          response.json(await dramas.byIds(parseIds(request.query)));
        },
      },
      {
        method: 'get',
        path: '/api/v1/dramas/genres',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'The genres of the dramas, for the filter sheet',
          responses: {
            200: {
              description: 'Genre names in English, in alphabetical order; Adult is never listed',
              schema: z.object({ items: z.array(z.string()) }),
            },
            503: unavailable,
          },
        },
        handler: async (_request, response) => {
          const dramas = start(service, response);
          response.json({ items: await dramas.genres() });
        },
      },
    ],
  };
}
