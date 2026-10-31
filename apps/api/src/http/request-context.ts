import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';

// Every response carries a server-generated X-Request-Id; a client value is ignored so
// ids in the logs cannot be forged (ADR-0023, ADR-0030).
export const requestId: RequestHandler = (_request, response, next) => {
  const id = randomUUID();
  response.locals.requestId = id;
  response.setHeader('X-Request-Id', id);
  next();
};

// One log line per request with the ADR-0030 fields. Headers and bodies are never
// passed to the logger, so tokens, Authorization, emails and webhook bodies stay out.
export function requestLog(logger: Logger): RequestHandler {
  return (request, response, next) => {
    const started = performance.now();
    response.on('finish', () => {
      logger.info({
        requestId: response.locals.requestId,
        method: request.method,
        route: request.route?.path ?? request.path,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - started),
        ...(response.locals.userIdHash ? { userIdHash: response.locals.userIdHash } : {}),
      });
    });
    next();
  };
}
