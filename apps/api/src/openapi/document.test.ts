import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createContainer } from '../container.js';
import type { Module } from '../http/routes.js';
import { buildOpenApiDocument, openApiJsonDiverges, renderOpenApiJson } from './document.js';

const modules = createContainer({}).modules;

const privateModule: Module = {
  name: 'test',
  routes: [
    {
      method: 'put',
      path: '/api/v1/me/marks/:anilistId',
      docs: {
        summary: 'Mark an anime',
        responses: { 200: { description: 'Marked', schema: z.object({ status: z.string() }) } },
      },
      handler: () => {},
    },
  ],
};

describe('OpenAPI document', () => {
  it('is OpenAPI 3.1 and documents the health check', () => {
    const document = buildOpenApiDocument(modules);

    expect(document.openapi).toMatch(/^3\.1\./);
    const health = document.paths?.['/api/health']?.get;
    expect(health?.summary).toBeTruthy();
    expect(health?.security).toEqual([]);
    expect(JSON.stringify(health?.responses?.['200'])).toContain('"ok"');
  });

  it('documents every route of every module', () => {
    for (const module of modules) {
      for (const route of module.routes) {
        expect(route.docs, `${module.name} ${route.method} ${route.path}`).toBeDefined();
      }
    }
  });

  it('marks private routes with the bearer session and their 401 problem', () => {
    const document = buildOpenApiDocument([...modules, privateModule]);
    const operation = document.paths?.['/api/v1/me/marks/{anilistId}']?.put;

    expect(operation?.security).toEqual([{ session: [] }]);
    expect(operation?.responses?.['401']).toBeDefined();
    expect(document.components?.securitySchemes?.session).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('renders the same JSON every time and detects a stale file', () => {
    const rendered = renderOpenApiJson(modules);

    expect(renderOpenApiJson(modules)).toBe(rendered);
    expect(openApiJsonDiverges(rendered, modules)).toBe(false);
    expect(openApiJsonDiverges(rendered.replace('Acrux', 'Other'), modules)).toBe(true);
  });

  it('documents 429 on rate limited routes only', () => {
    const limited: Module = {
      name: 'limited',
      routes: [
        {
          method: 'get',
          path: '/api/v1/u/:handle',
          public: true,
          rateLimit: 'public',
          handler: () => {},
        },
      ],
    };
    const document = buildOpenApiDocument([...modules, limited]);
    const responses = document.paths?.['/api/v1/u/{handle}']?.get?.responses;
    expect(JSON.stringify(responses?.['429'])).toContain('problem+json');
    expect(JSON.stringify(responses?.['429'])).toContain('Retry-After');
    expect(document.paths?.['/api/health']?.get?.responses?.['429']).toBeUndefined();
  });
});
