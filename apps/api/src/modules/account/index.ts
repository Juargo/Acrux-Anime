import type { Response } from 'express';
import { z } from 'zod';
import { type ErrorReporter, noErrorReporter } from '../../http/error-reporter.js';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import type { Session } from '../../http/session.js';
import { type AccountService, AuthDeletionError } from './services/account.service.js';

const counterMode = z.enum(['franchise', 'entry']);
const exportSchema = z
  .object({
    exportedAt: z.iso.datetime(),
    profile: z.object({
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      avatarPreset: z.string().nullable(),
      locale: z.string(),
      listVisibility: z.enum(['private', 'public']),
      counterMode,
      handle: z.string(),
      shownTotal: z.number().int().nullable(),
      shownMode: counterMode.nullable(),
      cardShared: z.boolean(),
      createdAt: z.iso.datetime(),
    }),
    marks: z.array(
      z.object({
        anilistId: z.number().int(),
        malId: z.number().int().nullable(),
        status: z.enum(['seen', 'watching']),
        markedAt: z.iso.datetime(),
      }),
    ),
  })
  .meta({ id: 'AccountExport' });

const unavailable = () =>
  new ProblemError(503, 'account.unavailable', 'Account deletion is not available');

function start(service: AccountService | undefined, response: Response) {
  // User data is never cached, not even on errors (ADR-0023).
  response.setHeader('Cache-Control', 'private, no-store');
  const current: Session | undefined = response.locals.session;
  if (!service || !current) throw unavailable();
  return { service, current };
}

// The holder's rights (ADR-0028, RF-06): download the data and delete the account.
export function createAccountModule(
  service: AccountService | undefined,
  errorReporter: ErrorReporter = noErrorReporter,
): Module {
  return {
    name: 'account',
    routes: [
      {
        method: 'get',
        path: '/api/v1/me/export',
        rateLimit: 'write',
        docs: {
          summary: 'Download everything Acrux keeps about the signed-in user as JSON',
          responses: {
            200: { description: 'The data, as an attachment', schema: exportSchema },
            503: { description: 'The database is not configured' },
          },
        },
        handler: async (_request, response) => {
          const { service: account, current } = start(service, response);
          const data = await account.exportData(current);
          response.setHeader('Content-Disposition', 'attachment; filename="acrux-datos.json"');
          response.json(data);
        },
      },
      {
        method: 'delete',
        path: '/api/v1/me',
        rateLimit: 'write',
        docs: {
          summary: 'Delete the account: the data, then the Neon Auth user, then the PostHog person',
          responses: {
            204: { description: 'Deleted; repeating it is harmless' },
            502: { description: 'The data is gone but Neon Auth failed; retry to finish' },
            503: { description: 'Deletion is not configured; nothing was deleted' },
          },
        },
        handler: async (_request, response) => {
          const { service: account, current } = start(service, response);
          if (!account.canDelete) throw unavailable();
          const requestId: string = response.locals.requestId;
          let result: Awaited<ReturnType<AccountService['deleteAccount']>>;
          try {
            result = await account.deleteAccount(current);
          } catch (error) {
            if (!(error instanceof AuthDeletionError)) throw error;
            await errorReporter.report(error, { requestId }).catch(() => {});
            throw new ProblemError(
              502,
              'account.auth_unavailable',
              'The account data was deleted, but sign-in could not be removed yet; retry',
            );
          }
          if (result.analyticsError !== undefined) {
            await errorReporter.report(result.analyticsError, { requestId }).catch(() => {});
          }
          response.status(204).end();
        },
      },
    ],
  };
}
