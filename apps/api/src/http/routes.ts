import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

// What the OpenAPI contract says about a route (ADR-0023). The 401 of private routes is
// added automatically.
export interface RouteDocs {
  summary: string;
  responses: Record<number, { description: string; schema?: ZodType }>;
}

// A route is private unless it says `public: true` (ADR-0025): the app mounts the
// session check in front of every other route.
export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  public?: boolean;
  docs?: RouteDocs;
  handler: RequestHandler;
}

export interface Module {
  name: string;
  routes: RouteDefinition[];
}

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
      // Set by the session middleware on private routes.
      session: import('./session.js').Session;
      userIdHash?: string;
    }
  }
}
