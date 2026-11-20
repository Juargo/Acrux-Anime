import type { Response } from 'express';
import { z } from 'zod';
import { ProblemError } from '../../http/problem.js';
import type { RouteDefinition } from '../../http/routes.js';
import type { Session } from '../../http/session.js';
import type { MarkPageQuery } from './repositories/marks.repository.js';
import type {
  DramaMarkPage,
  DramaMarksService,
  DramaMarkView,
} from './services/drama-marks.service.js';

// Contract of the drama marks (issue #154, odd/tasks/marcar-dramas.md): one mark per show,
// with the states of an anime mark. Apart from /api/v1/me/marks, whose ids are MyAnimeList's.
const INT4_MAX = 2_147_483_647;
const DEFAULT_PAGE = 500;
const MAX_PAGE = 1000;

const id = z.number().int().min(1).max(INT4_MAX);
const status = z.enum(['seen', 'watching']);
const putBody = z.strictObject({ status });
const dramaMarkSchema = z
  .object({ dramaId: id, status, markedAt: z.iso.datetime() })
  .meta({ id: 'DramaMark' });
const dramaMarkPageSchema = z.object({
  items: z.array(dramaMarkSchema),
  nextCursor: z.string().nullable(),
});
const dramaIdParam = z.int().min(1).max(INT4_MAX);

const pageQueryDocs = {
  cursor: z
    .string()
    .regex(/^[1-9]\d*$/)
    .optional()
    .meta({ description: 'The nextCursor of the previous page; leave it out for the first' }),
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .optional()
    .meta({ description: `Marks per page, 1 to ${MAX_PAGE}; ${DEFAULT_PAGE} by default` }),
};

const invalidId = { description: 'The dramaId is not a positive integer' };
const unavailable = { description: 'The database is not configured' };

// Decimal digits only: Number() would also accept '1e3', ' 7' or '0x10'.
function parsePositiveInt(value: unknown, max: number): number | undefined {
  const parsed = typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : 0;
  return parsed >= 1 && parsed <= max ? parsed : undefined;
}

function parseDramaId(value: unknown): number {
  const parsed = parsePositiveInt(value, INT4_MAX);
  if (parsed === undefined) {
    throw new ProblemError(400, 'drama_marks.invalid_drama_id', 'Invalid dramaId');
  }
  return parsed;
}

// Once each: ?cursor=1&cursor=2 arrives as an array and is rejected.
function parseQueryInt(value: unknown, max: number): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parsePositiveInt(value, max);
  if (parsed === undefined) {
    throw new ProblemError(400, 'drama_marks.invalid_query', 'Invalid cursor or limit');
  }
  return parsed;
}

function parsePage(query: Record<string, unknown>): MarkPageQuery {
  const after = parseQueryInt(query.cursor, INT4_MAX);
  const limit = parseQueryInt(query.limit, MAX_PAGE) ?? DEFAULT_PAGE;
  return after === undefined ? { limit } : { after, limit };
}

function toJson(mark: DramaMarkView) {
  return { ...mark, markedAt: mark.markedAt.toISOString() };
}

function pageToJson(page: DramaMarkPage) {
  return {
    items: page.items.map(toJson),
    nextCursor: page.nextCursor === null ? null : String(page.nextCursor),
  };
}

// User data is never cached, not even on errors (ADR-0023).
function start(marks: DramaMarksService | undefined, response: Response) {
  response.setHeader('Cache-Control', 'private, no-store');
  const session: Session | undefined = response.locals.session;
  if (!marks || !session) {
    throw new ProblemError(503, 'drama_marks.unavailable', 'Drama marks are not available');
  }
  return { marks, session };
}

// Without a database the routes stay mounted and answer 503, as the anime marks do.
export function dramaMarkRoutes(service: DramaMarksService | undefined): RouteDefinition[] {
  return [
    {
      method: 'get',
      path: '/api/v1/me/drama-marks',
      docs: {
        summary: 'Drama marks of the signed-in user, ordered by dramaId, one page at a time',
        query: pageQueryDocs,
        responses: {
          200: {
            description: 'One page of drama marks; nextCursor is null on the last page',
            schema: dramaMarkPageSchema,
          },
          400: { description: 'The cursor or the limit is not a valid positive integer' },
          503: unavailable,
        },
      },
      handler: async (request, response) => {
        const { marks, session } = start(service, response);
        response.json(pageToJson(await marks.list(session, parsePage(request.query))));
      },
    },
    {
      method: 'put',
      path: '/api/v1/me/drama-marks/:dramaId',
      rateLimit: 'write',
      docs: {
        summary: 'Mark one drama, the whole show; the same status again keeps markedAt',
        params: { dramaId: dramaIdParam },
        requestBody: putBody,
        responses: {
          200: { description: 'The stored mark', schema: dramaMarkSchema },
          400: { description: 'Invalid dramaId, unknown fields or an invalid body' },
          404: { description: 'No drama of the catalog has that id' },
          503: unavailable,
        },
      },
      handler: async (request, response) => {
        const { marks, session } = start(service, response);
        const dramaId = parseDramaId(request.params.dramaId);
        const body = putBody.safeParse(request.body);
        if (!body.success) {
          throw new ProblemError(400, 'drama_marks.invalid_body', 'Invalid drama mark body');
        }
        const mark = await marks.put(session, dramaId, body.data);
        if (!mark) throw new ProblemError(404, 'drama_marks.unknown_drama', 'Drama not found');
        response.json(toJson(mark));
      },
    },
    {
      method: 'delete',
      path: '/api/v1/me/drama-marks/:dramaId',
      rateLimit: 'write',
      docs: {
        summary: 'Unmark one drama; also 204 when it was not marked',
        params: { dramaId: dramaIdParam },
        responses: {
          204: { description: 'Not marked anymore' },
          400: invalidId,
          503: unavailable,
        },
      },
      handler: async (request, response) => {
        const { marks, session } = start(service, response);
        await marks.remove(session, parseDramaId(request.params.dramaId));
        response.status(204).end();
      },
    },
  ];
}
