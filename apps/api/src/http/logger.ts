import pino, { type Logger } from 'pino';

// Defense in depth: request logs never receive headers or bodies, and these paths are
// also redacted if an object with them reaches the logger by mistake (ADR-0030).
const REDACTED_PATHS = [
  'authorization',
  '*.authorization',
  'headers',
  '*.headers',
  'body',
  '*.body',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'email',
  '*.email',
];

export function createLogger(level = 'info'): Logger {
  return pino({ level, redact: { paths: REDACTED_PATHS, remove: true } });
}
