import type { Response } from 'express';
import { z } from 'zod';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import type { Session } from '../../http/session.js';
import type { ProfileService } from './services/profile.service.js';

const profileSchema = z.object({
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  locale: z.string(),
  listVisibility: z.enum(['private', 'public']),
  counterMode: z.enum(['franchise', 'entry']),
});

// Only the counter mode for now (RF-25); the other fields of ADR-0023 come with their issues.
const patchBody = z.strictObject({ counterMode: profileSchema.shape.counterMode });

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
          summary: 'Change the profile of the signed-in user; only the counter mode for now',
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
