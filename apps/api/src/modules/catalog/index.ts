import type { Response } from 'express';
import { z } from 'zod';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import type { AnimeRow } from './repositories/catalog.repository.js';
import type { BrowseFilters, CatalogService } from './services/catalog.service.js';

// The catalog (ADR-0043): anime copied from MyAnimeList into our database, so the browser
// never calls MyAnimeList. Anyone reads it, visitors of a public profile included, and it
// holds nothing about a user, so the CDN keeps every answer.
const INT4_MAX = 2_147_483_647;
const MAX_IDS = 100;
const MAX_PAGE = 1000;
const MAX_GENRES = 10;
const MAX_TEXT = 100;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
// RF-11: TV, movies, OVAs, ONAs and specials; never music.
const FORMATS = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'];
const CACHE_CONTROL = 'public, max-age=0, s-maxage=300';

const id = z.int().min(1).max(INT4_MAX);
const animeSchema = z
  .object({
    id,
    title: z.string(),
    titleEnglish: z.string().nullable(),
    titleJapanese: z.string().nullable(),
    coverUrl: z.string().nullable(),
    format: z.string().nullable(),
    startDate: z.iso.date().nullable(),
    year: z.int().nullable(),
    episodes: z.int().nullable(),
    durationMinutes: z.int().nullable(),
    genres: z.array(z.string()),
    relations: z.array(z.object({ type: z.string(), id })),
  })
  .meta({ id: 'CatalogAnime' });

const unavailable = { description: 'The database is not configured' };
const invalidQuery = { description: 'A query parameter is missing, repeated or not valid' };
const text = (description: string) => z.string().optional().meta({ description });
const idList = (name: string) =>
  z.string().meta({ description: `${name}: 1 to ${MAX_IDS} anime ids, separated by commas` });

function invalid(detail: string): never {
  throw new ProblemError(400, 'catalog.invalid_query', detail);
}

// ?year=2009&year=2010 arrives as an array: each parameter is accepted once.
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

function parseIds(query: Record<string, unknown>, name: string): number[] {
  const value = single(query, name);
  if (value === undefined || value === '') invalid(`Missing ${name}`);
  const ids = [...new Set(value.split(',').map((part) => toInt(part, name, 1, INT4_MAX)))];
  if (ids.length > MAX_IDS) invalid(`Too many ${name}`);
  return ids;
}

function parseFilters(query: Record<string, unknown>): BrowseFilters {
  const search = single(query, 'search')?.trim();
  if (search !== undefined && search.length > MAX_TEXT) invalid('Invalid search');

  const year = single(query, 'year');
  const genres = single(query, 'genres')?.split(',') ?? [];
  if (
    genres.length > MAX_GENRES ||
    genres.some((genre) => genre.trim() === '' || genre.length > MAX_TEXT)
  ) {
    invalid('Invalid genres');
  }
  const formats = single(query, 'formats')?.split(',') ?? FORMATS;
  if (formats.some((format) => !FORMATS.includes(format))) invalid('Invalid formats');

  return {
    ...(search === undefined || search === '' ? {} : { search }),
    ...(year === undefined ? {} : { year: toInt(year, 'year', MIN_YEAR, MAX_YEAR) }),
    genres: genres.map((genre) => genre.trim()),
    formats,
  };
}

function start(service: CatalogService | undefined, response: Response): CatalogService {
  if (!service) {
    response.setHeader('Cache-Control', 'private, no-store');
    throw new ProblemError(503, 'catalog.unavailable', 'The catalog is not available');
  }
  response.setHeader('Cache-Control', CACHE_CONTROL);
  return service;
}

const toJson = (row: AnimeRow) => ({
  ...row,
  startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
});

// Without a database the routes stay mounted and answer 503, as the profile does.
export function createCatalogModule(service: CatalogService | undefined): Module {
  return {
    name: 'catalog',
    routes: [
      {
        method: 'get',
        path: '/api/v1/catalog/anime',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'One page of the catalog, most popular first, 50 anime a page',
          query: {
            search: text(`Part of any name of the anime, up to ${MAX_TEXT} characters`),
            year: text(`Year the anime started, ${MIN_YEAR} to ${MAX_YEAR}`),
            genres: text(`Up to ${MAX_GENRES} genres separated by commas; any of them matches`),
            formats: text(`Any of ${FORMATS.join(', ')}, separated by commas; all by default`),
            page: text(`1 to ${MAX_PAGE}; 1 by default`),
          },
          responses: {
            200: {
              description:
                'The page, the neighbours one hop away that it lacks, and the next page or null',
              schema: z.object({
                items: z.array(animeSchema),
                related: z.array(animeSchema),
                nextPage: z.int().nullable(),
              }),
            },
            400: invalidQuery,
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const catalog = start(service, response);
          const filters = parseFilters(request.query);
          const page = toInt(single(request.query, 'page') ?? '1', 'page', 1, MAX_PAGE);
          const result = await catalog.browse(filters, page);
          response.json({
            items: result.items.map(toJson),
            related: result.related.map(toJson),
            nextPage: result.nextPage,
          });
        },
      },
      {
        method: 'get',
        path: '/api/v1/catalog/anime/by-ids',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'The anime of the given ids; ids the catalog does not hold are left out',
          query: { ids: idList('ids') },
          responses: {
            200: {
              description: 'The anime found, in no particular order',
              schema: z.object({ items: z.array(animeSchema) }),
            },
            400: invalidQuery,
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const catalog = start(service, response);
          const rows = await catalog.byIds(parseIds(request.query, 'ids'));
          response.json({ items: rows.map(toJson) });
        },
      },
      {
        method: 'get',
        path: '/api/v1/catalog/franchises',
        public: true,
        rateLimit: 'public',
        docs: {
          summary:
            'Every anime reached from the seeds through sequels and prequels, to group franchises',
          query: { seeds: idList('seeds') },
          responses: {
            200: {
              description:
                'The entries reached, their other neighbours, the ids the catalog does not hold and the ids left for another request',
              schema: z.object({
                items: z.array(animeSchema),
                related: z.array(animeSchema),
                missing: z.array(id),
                pending: z.array(id),
              }),
            },
            400: invalidQuery,
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const catalog = start(service, response);
          const result = await catalog.franchises(parseIds(request.query, 'seeds'));
          response.json({
            items: result.items.map(toJson),
            related: result.related.map(toJson),
            missing: result.missing,
            pending: result.pending,
          });
        },
      },
      {
        method: 'get',
        path: '/api/v1/catalog/genres',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'The genres of the catalog, for the filter sheet',
          responses: {
            200: {
              description: 'Genre names in English, in alphabetical order',
              schema: z.object({ items: z.array(z.string()) }),
            },
            503: unavailable,
          },
        },
        handler: async (_request, response) => {
          const catalog = start(service, response);
          response.json({ items: await catalog.genres() });
        },
      },
    ],
  };
}
