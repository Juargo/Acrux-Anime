import { z } from 'zod';
import {
  createDocument,
  type ZodOpenApiObject,
  type ZodOpenApiOperationObject,
  type ZodOpenApiResponseObject,
} from 'zod-openapi';
import type { Module, RouteDefinition } from '../http/routes.js';

// OpenAPI 3.1 contract generated from the route definitions (ADR-0023). The committed
// apps/api/openapi.json is checked in CI with `openapi:check`.

const problem = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    code: z.string().meta({ description: 'Stable code the web app maps to a message' }),
    requestId: z.uuid(),
  })
  .meta({ id: 'Problem' });

function toOpenApiPath(path: string): string {
  return path.replace(/:(\w+)/g, '{$1}');
}

function pathParams(path: string) {
  const names = [...path.matchAll(/:(\w+)/g)].map((match) => match[1] as string);
  return names.length > 0
    ? z.object(Object.fromEntries(names.map((name) => [name, z.string()])))
    : undefined;
}

function operation(route: RouteDefinition): ZodOpenApiOperationObject {
  const docs = route.docs ?? {
    summary: `${route.method.toUpperCase()} ${route.path}`,
    responses: {},
  };
  const responses: Record<string, ZodOpenApiResponseObject> = {};
  for (const [status, response] of Object.entries(docs.responses)) {
    responses[status] = {
      description: response.description,
      ...(response.schema ? { content: { 'application/json': { schema: response.schema } } } : {}),
    };
  }
  if (!route.public) {
    responses['401'] = {
      description: 'Missing, invalid or expired session',
      content: { 'application/problem+json': { schema: problem } },
    };
  }
  const params = pathParams(route.path);
  return {
    summary: docs.summary,
    security: route.public ? [] : [{ session: [] }],
    ...(params ? { requestParams: { path: params } } : {}),
    responses: responses as ZodOpenApiOperationObject['responses'],
  };
}

export function buildOpenApiDocument(modules: Module[]) {
  const paths: NonNullable<ZodOpenApiObject['paths']> = {};
  for (const module of modules) {
    for (const route of module.routes) {
      const path = toOpenApiPath(route.path);
      paths[path] = {
        ...paths[path],
        [route.method]: { ...operation(route), tags: [module.name] },
      };
    }
  }
  return createDocument({
    openapi: '3.1.0',
    info: { title: 'Acrux API', version: '1.0.0' },
    servers: [{ url: 'https://app.acruxanime.com' }],
    components: {
      securitySchemes: { session: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    paths,
  });
}

export function renderOpenApiJson(modules: Module[]): string {
  return `${JSON.stringify(buildOpenApiDocument(modules), null, 2)}\n`;
}

export function openApiJsonDiverges(committed: string, modules: Module[]): boolean {
  return committed !== renderOpenApiJson(modules);
}
