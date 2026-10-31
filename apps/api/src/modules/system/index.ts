import { z } from 'zod';
import type { Module } from '../../http/routes.js';

export const systemModule: Module = {
  name: 'system',
  routes: [
    {
      method: 'get',
      path: '/api/health',
      public: true,
      docs: {
        summary: 'Availability check',
        responses: {
          200: { description: 'The API is up', schema: z.object({ status: z.literal('ok') }) },
        },
      },
      handler: (_request, response) => {
        response.json({ status: 'ok' });
      },
    },
  ],
};
