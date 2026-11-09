import type { Response } from 'express';
import { z } from 'zod';
import type { PlanReader, UserPlan } from '../../http/plan.js';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import type { Session } from '../../http/session.js';
import { displayNameProblem } from './domain/display-name.js';
import type { ProfileService } from './services/profile.service.js';

const counterMode = z.enum(['franchise', 'entry']);
// The languages of the web app (@acrux/i18n locales, ADR-0010).
const locale = z.enum(['es', 'en']);
export const avatarPreset = z.enum(['violeta', 'verde', 'amarillo', 'coral', 'noche', 'lavanda']);
// RF-52: Clásica is free and Neón needs Plus.
const cardTheme = z.enum(['clasica', 'neon']);

// RF-07 and Figma M06 ("5/30"): trimmed, then the rules the editor checks too (@acrux/domain).
const displayName = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => displayNameProblem(value) === null, 'Invalid display name');

const profileSchema = z.object({
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  avatarPreset: avatarPreset.nullable().describe("A preset Acrux avatar; null shows Google's"),
  locale: locale.nullable().describe('The chosen language; null follows the browser (#43)'),
  listVisibility: z.enum(['private', 'public']),
  counterMode,
  handle: z.string().describe('The @handle of the public link, assigned once (#37)'),
  shownTotal: z.number().int().nullable().describe('The last counter the owner saw'),
  shownMode: counterMode.nullable(),
  cardShared: z.boolean().describe('Whether a card was ever shared (#36)'),
  cardTheme: cardTheme.describe(
    'The card theme (RF-52); always clasica without Plus, so a refund falls back (RF-56)',
  ),
  createdAt: z.iso.datetime().describe('When the profile was created'),
  analyticsId: z
    .string()
    .nullable()
    .describe('Salted id for analytics after consent (#46); null when analytics is off'),
  curator: z
    .boolean()
    .describe('Whether the session has the curator role (#42); the API still checks every edit'),
  plan: z
    .enum(['free', 'plus'])
    .describe('The plan read from the database (epic #50); the API still checks every Plus route'),
  plusAvailable: z
    .boolean()
    .describe('Whether Plus can be bought in this environment; false while billing is off'),
});

// The name and avatar (RF-07, #39), the counter mode (RF-25), the visibility of the list
// (RF-42), the counter the owner sees, shown to visitors (#37), the first card shared (#36),
// and the language (#43).
const patchBody = z
  .strictObject({
    displayName,
    avatarPreset: avatarPreset.nullable(),
    counterMode,
    listVisibility: profileSchema.shape.listVisibility,
    shown: z.strictObject({ total: z.number().int().min(0).max(1_000_000), mode: counterMode }),
    cardShared: z.literal(true),
    locale: locale.nullable(),
    cardTheme,
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

const isCurator = (current: Session) => current.roles?.includes('curator') ?? false;

export interface PlanInfo {
  planOf?: PlanReader | undefined;
  plusAvailable: boolean;
}

const planOf = async (current: Session, plans: PlanInfo | undefined) =>
  plans?.planOf ? plans.planOf(current.userId) : ('free' as const);

// What the web shows about Plus: the plan from the database and whether it can be bought.
// Plus themes show only while the plan is Plus; the stored choice is kept for a later purchase.
function withPlan<T extends { cardTheme: string }>(
  view: T,
  current: Session,
  plan: UserPlan,
  plans: PlanInfo | undefined,
) {
  return {
    ...view,
    cardTheme: plan === 'plus' ? view.cardTheme : 'clasica',
    curator: isCurator(current),
    plan,
    plusAvailable: plans?.plusAvailable ?? false,
  };
}

// Without a database the routes stay mounted and answer 503, as sign-in does.
export function createProfileModule(
  profiles: ProfileService | undefined,
  plans?: PlanInfo,
): Module {
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
          const view = await service.me(current);
          response.json(withPlan(view, current, await planOf(current, plans), plans));
        },
      },
      {
        method: 'patch',
        path: '/api/v1/me',
        docs: {
          summary:
            'Change the counter mode, the list visibility, the shown counter, the first share, the language or the card theme',
          requestBody: patchBody,
          responses: {
            200: { description: 'The profile after the change', schema: profileSchema },
            400: { description: 'The body is not a known change' },
            403: { description: 'A card theme other than clasica needs Plus (RF-52)' },
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
          // The plan comes from the database, never from the client (RF-52, ADR-0025).
          const plan = await planOf(current, plans);
          if (body.data.cardTheme && body.data.cardTheme !== 'clasica' && plan !== 'plus') {
            throw new ProblemError(403, 'plan.plus_required', 'This theme needs Plus');
          }
          const view = await service.update(current, body.data);
          response.json(withPlan(view, current, plan, plans));
        },
      },
    ],
  };
}
