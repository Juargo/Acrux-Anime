import type { RequestHandler } from 'express';

// A route is private unless it says `public: true` (ADR-0025): the app mounts the
// session check in front of every other route.
export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  public?: boolean;
  handler: RequestHandler;
}

export interface Module {
  name: string;
  routes: RouteDefinition[];
}
