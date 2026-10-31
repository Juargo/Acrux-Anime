import express, { type Express } from 'express';
import { type Container, createContainer } from './container.js';
import { errorHandler, notFound } from './http/problem.js';
import { requestId, requestLog } from './http/request-context.js';

// Express API published as a Vercel function under /api (ADR-0018, ADR-0020).
// Routes keep the /api prefix so the same paths work locally and on Vercel.
export function createApp(container: Container): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(requestLog(container.logger));
  app.use(express.json({ limit: '100kb' }));

  for (const module of container.modules) {
    for (const route of module.routes) {
      app[route.method](route.path, route.handler);
    }
  }

  app.use(notFound);
  app.use(errorHandler(container.logger));
  return app;
}

export default createApp(createContainer(process.env));
