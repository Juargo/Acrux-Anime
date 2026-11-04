import type { Response } from 'express';
import { z } from 'zod';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import { markPageSchema, pageQueryDocs, pageToJson, parsePage } from '../marks/index.js';
import { notFoundPage, profileImage, sharePage } from './og.js';
import type { PublicProfileService } from './services/public-profile.service.js';

const counterMode = z.enum(['franchise', 'entry']);
const summarySchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    listVisibility: z.enum(['private', 'public']),
    shownTotal: z.number().int().nullable().describe("The owner's last counter"),
    shownMode: counterMode.nullable(),
  })
  .meta({ id: 'PublicProfile' });
const handleParam = z.string().regex(/^[a-z0-9_]{3,20}$/);

const notFound = () => new ProblemError(404, 'profiles.not_found', 'Profile not found');

// No CDN cache, not even on errors: making the list private hides it at once (RF-42, L2 of
// odd/tasks/perfil-publico.md). Unknown, invalid and private lists all answer the same 404.
function start(service: PublicProfileService | undefined, response: Response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!service) throw new ProblemError(503, 'profiles.unavailable', 'Profiles are not available');
  return service;
}

// Behind Vercel the Host is the public domain; the page and the image are always https.
// Anything that is not a plain host name falls back to production, never into the HTML.
const originOf = (host: string | undefined) =>
  `https://${host && /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host) ? host : 'app.acruxanime.com'}`;

const handleOf = (params: Record<string, unknown>) =>
  typeof params.handle === 'string' ? params.handle : '';

// The public profile by link (RF-40 to RF-43): public routes, 60 requests per minute per IP,
// and no route that searches or lists profiles.
export function createPublicProfileModule(service: PublicProfileService | undefined): Module {
  return {
    name: 'public-profile',
    routes: [
      {
        method: 'get',
        path: '/api/v1/profiles/:handle',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'Public summary of a profile: name, avatar, handle and total, even if private',
          params: { handle: handleParam },
          responses: {
            200: {
              description: 'The summary; the list is behind listVisibility',
              schema: summarySchema,
            },
            404: { description: 'No profile has this handle' },
            503: { description: 'The database is not configured' },
          },
        },
        handler: async (request, response) => {
          const summary = await start(service, response).summary(handleOf(request.params));
          if (!summary) throw notFound();
          response.json(summary);
        },
      },
      {
        method: 'get',
        path: '/api/v1/profiles/:handle/marks',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'Marks of a public list, ordered by anilistId, one page at a time',
          params: { handle: handleParam },
          query: pageQueryDocs,
          responses: {
            200: {
              description: 'One page of marks; nextCursor is null on the last page',
              schema: markPageSchema,
            },
            400: { description: 'The cursor or the limit is not a valid positive integer' },
            404: { description: 'No profile has this handle, or its list is private' },
            503: { description: 'The database is not configured' },
          },
        },
        handler: async (request, response) => {
          const publicProfiles = start(service, response);
          const page = await publicProfiles.marks(
            handleOf(request.params),
            parsePage(request.query),
          );
          if (!page) throw notFound();
          response.json(pageToJson(page));
        },
      },
      {
        method: 'get',
        path: '/api/v1/profiles/:handle/og.png',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'Preview image of a profile for social networks: name, avatar and total',
          params: { handle: handleParam },
          responses: {
            200: { description: 'A 1200 × 630 PNG, cached at the CDN for 5 minutes' },
            404: { description: 'No profile has this handle' },
            503: { description: 'The database is not configured' },
          },
        },
        handler: async (request, response) => {
          const summary = await start(service, response).summary(handleOf(request.params));
          if (!summary) throw notFound();
          const png = await profileImage(summary);
          // Only name, avatar and total, the same for private and public lists (L2).
          response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
          response.type('png').send(png);
        },
      },
      {
        // apps/web/vercel.json sends crawlers of /@handle here; people get the SPA.
        method: 'get',
        path: '/@:handle',
        public: true,
        rateLimit: 'public',
        docs: {
          summary: 'Open Graph page of a profile for link previews (crawlers only)',
          params: { handle: handleParam },
          responses: {
            200: { description: 'An HTML page with the Open Graph tags of the profile' },
            404: { description: 'No profile has this handle' },
            503: { description: 'The database is not configured' },
          },
        },
        handler: async (request, response) => {
          const summary = await start(service, response).summary(handleOf(request.params));
          if (!summary) {
            response.status(404).type('html').send(notFoundPage);
            return;
          }
          response.type('html').send(sharePage(summary, originOf(request.get('host'))));
        },
      },
    ],
  };
}
