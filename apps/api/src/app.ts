import express, { type Express } from 'express';
import { type Container, createContainer } from './container.js';
import { errorHandler, notFound } from './http/problem.js';
import { rateLimit } from './http/rate-limit.js';
import { requestId, requestLog } from './http/request-context.js';
import { requireRole, requireSession } from './http/session.js';

// Express API published as a Vercel function under /api (ADR-0018, ADR-0020).
// Routes keep the /api prefix so the same paths work locally and on Vercel.
export function createApp(container: Container): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(requestLog(container.logger));
  app.use(express.json({ limit: '100kb' }));

  // Private by default: only routes marked public skip the session check (ADR-0025).
  const session = requireSession(container.sessionVerifier);
  for (const module of container.modules) {
    for (const route of module.routes) {
      const limit = route.rateLimit
        ? [rateLimit(route.rateLimit, container.rateLimiter, container.logger)]
        : [];
      const role = route.role ? [requireRole(route.role)] : [];
      if (route.public) app[route.method](route.path, ...limit, route.handler);
      else app[route.method](route.path, session, ...role, ...limit, route.handler);
    }
  }

  app.use(notFound);
  app.use(errorHandler(container.logger, container.errorReporter));
  return app;
}

export default createApp(createContainer(process.env));
