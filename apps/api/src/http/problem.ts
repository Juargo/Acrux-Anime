import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { Logger } from 'pino';
import type { ErrorReporter } from './error-reporter.js';

// RFC 9457 errors with a stable `code` the web app maps to i18n messages (ADR-0023).
export class ProblemError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
  ) {
    super(title);
    this.name = 'ProblemError';
  }
}

export function sendProblem(response: Response, problem: ProblemError): void {
  response
    .status(problem.status)
    .type('application/problem+json')
    .send(
      JSON.stringify({
        type: 'about:blank',
        title: problem.title,
        status: problem.status,
        code: problem.code,
        requestId: response.locals.requestId,
      }),
    );
}

export const notFound: RequestHandler = (_request, response) => {
  sendProblem(response, new ProblemError(404, 'not_found', 'Not Found'));
};

function isJsonSyntaxError(error: unknown): boolean {
  return (
    error instanceof SyntaxError && (error as { type?: string }).type === 'entity.parse.failed'
  );
}

// Body parser failures carry a 4xx status; reporting them would let anyone spend the quota.
function isClientError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

// Unknown errors become a 500 without their message; only the log keeps the detail.
export function errorHandler(logger: Logger, reporter: ErrorReporter): ErrorRequestHandler {
  return async (error, _request, response, _next) => {
    if (error instanceof ProblemError) {
      sendProblem(response, error);
      return;
    }
    if (isJsonSyntaxError(error)) {
      sendProblem(response, new ProblemError(400, 'invalid_json', 'Invalid JSON body'));
      return;
    }
    logger.error(
      { requestId: response.locals.requestId, err: { name: error?.name, stack: error?.stack } },
      'unhandled error',
    );
    if (!isClientError(error)) {
      try {
        await reporter.report(error, { requestId: response.locals.requestId });
      } catch (reportError) {
        logger.warn(
          { requestId: response.locals.requestId, reason: (reportError as Error)?.name },
          'error report failed',
        );
      }
    }
    sendProblem(response, new ProblemError(500, 'internal_error', 'Internal Server Error'));
  };
}
