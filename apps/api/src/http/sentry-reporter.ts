import { captureException, type ErrorEvent, flush, init, type NodeOptions } from '@sentry/node';
import type { ErrorReporter } from './error-reporter.js';

// Vercel freezes the function once it answers, so the event is sent before the response.
const FLUSH_TIMEOUT_MS = 2000;
const REDACTED = '[redacted]';

// Messages may quote values: Prisma errors, URLs, third-party responses.
const SENSITIVE_PATTERNS = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/g,
  /eyJ[\w-]+\.[\w-]+\.[\w-]+/g,
  /bearer\s+\S+/gi,
  /postgres(ql)?:\/\/\S+/gi,
];

function redact(text: string): string {
  return SENSITIVE_PATTERNS.reduce((result, pattern) => result.replace(pattern, REDACTED), text);
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.request;
  delete event.user;
  delete event.server_name;
  if (event.message) event.message = redact(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redact(exception.value);
  }
  return event;
}

export function createSentryReporter(
  options: Pick<NodeOptions, 'dsn' | 'environment' | 'release' | 'transport'>,
): ErrorReporter {
  init({
    ...options,
    // SDK 11 replaced sendDefaultPii with this option, and it collects everything by default.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    maxBreadcrumbs: 0,
    beforeSend: scrubEvent,
  });
  return {
    report: async (error, { requestId }) => {
      captureException(error, { tags: { requestId } });
      await flush(FLUSH_TIMEOUT_MS);
    },
  };
}
