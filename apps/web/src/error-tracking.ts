import { type BrowserOptions, type ErrorEvent, init } from '@sentry/react';

const REDACTED = '[redacted]';

// Messages may quote values: emails, tokens, third-party responses.
const SENSITIVE_PATTERNS = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/g,
  /eyJ[\w-]+\.[\w-]+\.[\w-]+/g,
  /bearer\s+\S+/gi,
];

function redact(text: string): string {
  return SENSITIVE_PATTERNS.reduce((result, pattern) => result.replace(pattern, REDACTED), text);
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.request;
  delete event.user;
  if (event.message) event.message = redact(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redact(exception.value);
  }
  return event;
}

// Errors only, with no session tracking, cookies or identifiers (ADR-0030). Without a DSN
// the SDK stays off, as in local development.
export function initErrorTracking(
  options: Pick<BrowserOptions, 'dsn' | 'environment' | 'transport'>,
): void {
  if (!options.dsn) return;
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
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== 'BrowserSession'),
    beforeSend: scrubEvent,
  });
}
