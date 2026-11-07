import { i18n } from './i18n';

// API failures carry an RFC 9457 problem with a stable `code` (ADR-0023); the web app turns the
// code into a message in the user's language (#43).

export interface Problem {
  code?: string;
  requestId?: string;
}

export class ApiError extends Error {
  readonly code: string | undefined;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    readonly status: number,
    problem: Problem = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = problem.code;
    this.requestId = problem.requestId;
  }
}

// The code and request id of a problem body; nothing when the body is not one (HTML, empty…).
export async function readProblem(response: Response): Promise<Problem> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {};
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const { code, requestId } = body as Record<string, unknown>;
  return {
    ...(typeof code === 'string' ? { code } : {}),
    ...(typeof requestId === 'string' ? { requestId } : {}),
  };
}

// An ApiError for a failed response, with its problem's code.
export async function apiError(response: Response, message: string): Promise<ApiError> {
  return new ApiError(message, response.status, await readProblem(response));
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

// Codes are dotted lowercase words (profile.unavailable); anything else is not looked up.
const CODE = /^[a-z_]+(\.[a-z_]+)*$/;

// The message of a known code in the current language; undefined for unknown codes, so a screen
// can keep its own message.
export function errorMessage(code: string | undefined): string | undefined {
  if (!code || !CODE.test(code)) return undefined;
  const key = `errors.${code}`;
  if (!i18n.exists(key)) return undefined;
  // A section such as "errors.profile" is an object, not a message.
  const message: unknown = i18n.t(key as never, { returnObjects: true } as never);
  return typeof message === 'string' ? message : undefined;
}

// The message for a failed response: its code's, or the generic one.
export async function problemMessage(response: Response): Promise<string> {
  const { code } = await readProblem(response);
  return errorMessage(code) ?? i18n.t('errors.generic');
}
