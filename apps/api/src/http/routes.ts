import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import type { Plan } from './plan.js';
import type { RateLimitPolicy } from './rate-limit.js';
import type { Role } from './session.js';

// What the OpenAPI contract says about a route (ADR-0023). The 401 of private routes is
// added automatically.
export interface RouteDocs {
  summary: string;
  // Path parameters with a schema; the others are documented as strings.
  params?: Record<string, ZodType>;
  // Query parameters, all optional strings as they arrive.
  query?: Record<string, ZodType>;
  // JSON request body.
  requestBody?: ZodType;
  responses: Record<number, { description: string; schema?: ZodType }>;
}

// A route is private unless it says `public: true` (ADR-0025): the app mounts the
// session check in front of every other route.
export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  public?: boolean;
  // Only users with this role pass; the others get 403 (ADR-0025). Private routes only.
  role?: Role;
  // Only users with this plan pass; the others get 403 (ADR-0025). Private routes only.
  plan?: Plan;
  // Counted per user on private routes and per client IP on public ones (ADR-0028).
  rateLimit?: RateLimitPolicy;
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
      session?: import('./session.js').Session;
      userIdHash?: string;
    }
  }
}
