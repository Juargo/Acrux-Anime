import { z } from 'zod';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import type { ProfileService } from './services/profile.service.js';

const profileSchema = z.object({
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  locale: z.string(),
  listVisibility: z.enum(['private', 'public']),
  counterMode: z.enum(['franchise', 'entry']),
});

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
          const session = response.locals.session;
          if (!profiles || !session) {
            throw new ProblemError(503, 'profile.unavailable', 'Profiles are not available');
          }
          response.json(await profiles.me(session));
        },
      },
    ],
  };
}
