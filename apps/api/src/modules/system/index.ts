import type { Module } from '../../http/routes.js';

export const systemModule: Module = {
  name: 'system',
  routes: [
    {
      method: 'get',
      path: '/api/health',
      public: true,
      handler: (_request, response) => {
        response.json({ status: 'ok' });
      },
    },
  ],
};
