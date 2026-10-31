import express, { type Express } from 'express';

// Express API published as a Vercel function under /api (ADR-0018, ADR-0020).
// Routes keep the /api prefix so the same paths work locally and on Vercel.
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  // RFC 9457 error bodies arrive with the API skeleton (#23).
  app.use((_request, response) => {
    response.status(404).json({ status: 404, title: 'Not Found' });
  });

  return app;
}

export default createApp();
