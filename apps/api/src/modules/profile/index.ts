import type { Response } from 'express';
import { z } from 'zod';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import type { Session } from '../../http/session.js';
import type { ProfileService } from './services/profile.service.js';

const counterMode = z.enum(['franchise', 'entry']);

const profileSchema = z.object({
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  locale: z.string(),
  listVisibility: z.enum(['private', 'public']),
  counterMode,
  handle: z.string().describe('The @handle of the public link, assigned once (#37)'),
  shownTotal: z.number().int().nullable().describe('The last counter the owner saw'),
  shownMode: counterMode.nullable(),
  cardShared: z.boolean().describe('Whether a card was ever shared (#36)'),
});

// The counter mode (RF-25), the visibility of the list (RF-42), the counter the owner sees,
// shown to visitors (#37), and the first card shared (#36). Name and avatar come with #39.
const patchBody = z
  .strictObject({
    counterMode,
    listVisibility: profileSchema.shape.listVisibility,
    shown: z.strictObject({ total: z.number().int().min(0).max(1_000_000), mode: counterMode }),
    cardShared: z.literal(true),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'At least one change');

function session(profiles: ProfileService | undefined, response: Response) {
  const current: Session | undefined = response.locals.session;
  if (!profiles || !current) {
    throw new ProblemError(503, 'profile.unavailable', 'Profiles are not available');
  }
  return { profiles, current };
}

// Without a database the routes stay mounted and answer 503, as sign-in does.
export function createProfileModule(profiles: ProfileService | undefined): Module {
  return {
    name: 'profile',
    routes: [
      {
        method: 'get',
        path: '/api/v1/me',
        docs: {
          summary: 'Profile of the signed-in user, created on the first request',
          responses: {
            200: { description: 'The profile; the email is never returned', schema: profileSchema },
            503: { description: 'The database is not configured' },
          },
        },
        handler: async (_request, response) => {
          const { profiles: service, current } = session(profiles, response);
          response.json(await service.me(current));
        },
      },
      {
        method: 'patch',
        path: '/api/v1/me',
        docs: {
          summary:
            'Change the counter mode, the list visibility, the shown counter or the first share',
          requestBody: patchBody,
          responses: {
            200: { description: 'The profile after the change', schema: profileSchema },
            400: { description: 'The body is not a known change' },
            503: { description: 'The database is not configured' },
          },
        },
        handler: async (request, response) => {
          // User data is never cached, not even on errors (ADR-0023).
          response.setHeader('Cache-Control', 'private, no-store');
          const { profiles: service, current } = session(profiles, response);
          const body = patchBody.safeParse(request.body);
          if (!body.success) {
            throw new ProblemError(400, 'profile.invalid_body', 'Invalid profile body');
          }
          response.json(await service.update(current, body.data));
        },
      },
    ],
  };
}
