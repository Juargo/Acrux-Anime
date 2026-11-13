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
      path: '/api/v1/me/marks/:animeId',
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
    const operation = document.paths?.['/api/v1/me/marks/{animeId}']?.put;

    expect(operation?.security).toEqual([{ session: [] }]);
    expect(operation?.responses?.['401']).toBeDefined();
    expect(document.components?.securitySchemes?.session).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('documents 403 only on routes that require a role', () => {
    const document = buildOpenApiDocument(modules);
    const overrides = document.paths?.['/api/v1/franchise-overrides'];
    const edit = document.paths?.['/api/v1/franchise-overrides/{animeId}']?.put;

    expect(edit?.responses?.['403']).toBeDefined();
    expect(edit?.responses?.['401']).toBeDefined();
    expect(overrides?.get?.responses?.['403']).toBeUndefined();
    expect(document.paths?.['/api/v1/me']?.get?.responses?.['403']).toBeUndefined();
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

  it('documents a JSON body, typed path params and a literal colon in the path', () => {
    const batch: Module = {
      name: 'batch',
      routes: [
        {
          method: 'post',
          path: '/api/v1/test/items\\:batch',
          docs: {
            summary: 'Batch',
            requestBody: z.strictObject({ ids: z.array(z.int()) }),
            responses: { 200: { description: 'Done' } },
          },
          handler: () => {},
        },
        {
          method: 'put',
          path: '/api/v1/test/items/:id/:slug',
          docs: { summary: 'Item', params: { id: z.int() }, responses: {} },
          handler: () => {},
        },
      ],
    };
    const document = buildOpenApiDocument([...modules, batch]);
    const post = document.paths?.['/api/v1/test/items:batch']?.post;
    expect(post?.parameters).toBeUndefined();
    expect(JSON.stringify(post?.requestBody)).toContain('"additionalProperties":false');
    const put = document.paths?.['/api/v1/test/items/{id}/{slug}']?.put;
    expect(put?.parameters).toEqual([
      {
        in: 'path',
        name: 'id',
        schema: { type: 'integer', maximum: 9007199254740991, minimum: -9007199254740991 },
        required: true,
      },
      { in: 'path', name: 'slug', schema: { type: 'string' }, required: true },
    ]);
  });
  it('documents the optional cursor and limit of the marks list', () => {
    const document = buildOpenApiDocument(modules);
    const parameters = document.paths?.['/api/v1/me/marks']?.get?.parameters ?? [];
    expect(
      parameters.map((parameter) =>
        'in' in parameter ? [parameter.in, parameter.name, parameter.required ?? false] : [],
      ),
    ).toEqual([
      ['query', 'cursor', false],
      ['query', 'limit', false],
    ]);
  });
});
