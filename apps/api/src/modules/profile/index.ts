import type { Response } from 'express';
import { z } from 'zod';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import type { Session } from '../../http/session.js';
import { displayNameProblem } from './domain/display-name.js';
import type { ProfileService } from './services/profile.service.js';

const counterMode = z.enum(['franchise', 'entry']);
export const avatarPreset = z.enum(['violeta', 'verde', 'amarillo', 'coral', 'noche', 'lavanda']);

// RF-07 and Figma M06 ("5/30"): trimmed, then the rules the editor checks too (@acrux/domain).
const displayName = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => displayNameProblem(value) === null, 'Invalid display name');

const profileSchema = z.object({
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  avatarPreset: avatarPreset.nullable().describe("A preset Acrux avatar; null shows Google's"),
  locale: z.string(),
  listVisibility: z.enum(['private', 'public']),
  counterMode,
  handle: z.string().describe('The @handle of the public link, assigned once (#37)'),
  shownTotal: z.number().int().nullable().describe('The last counter the owner saw'),
  shownMode: counterMode.nullable(),
  cardShared: z.boolean().describe('Whether a card was ever shared (#36)'),
});

// The name and avatar (RF-07, #39), the counter mode (RF-25), the visibility of the list
// (RF-42), the counter the owner sees, shown to visitors (#37), and the first card shared (#36).
const patchBody = z
  .strictObject({
    displayName,
    avatarPreset: avatarPreset.nullable(),
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
