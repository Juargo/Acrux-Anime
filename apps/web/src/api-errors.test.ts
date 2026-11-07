import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, errorCode, errorMessage, problemMessage, readProblem } from './api-errors';
import { setLocale } from './i18n';

afterEach(() => setLocale('es'));

const problem = (body: unknown, status = 503) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

describe('readProblem', () => {
  it('reads the code and the request id of an RFC 9457 problem', async () => {
    await expect(
      readProblem(problem({ type: 'about:blank', status: 503, code: 'x', requestId: 'r1' })),
    ).resolves.toEqual({ code: 'x', requestId: 'r1' });
  });

  it('reads nothing from a body that is not a problem', async () => {
    await expect(readProblem(problem('<html>Bad gateway</html>', 502))).resolves.toEqual({});
    await expect(readProblem(problem([1, 2]))).resolves.toEqual({});
    await expect(readProblem(problem({ code: 42 }))).resolves.toEqual({});
    await expect(readProblem(new Response(null, { status: 503 }))).resolves.toEqual({});
  });
});

describe('problemMessage (ADR-0023)', () => {
  it('translates a known code', async () => {
    await expect(problemMessage(problem({ code: 'rate_limited' }, 429))).resolves.toBe(
      'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
    );
  });

  it('translates a nested code', async () => {
    await expect(problemMessage(problem({ code: 'profile.unavailable' }))).resolves.toBe(
      'No pudimos acceder a tu perfil. Vuelve a intentarlo.',
    );
  });

  it('falls back to the generic message for an unknown code, a section or no code', async () => {
    const generic = 'Algo salió mal. Vuelve a intentarlo.';
    await expect(problemMessage(problem({ code: 'card.melted' }))).resolves.toBe(generic);
    await expect(problemMessage(problem({ code: 'profile' }))).resolves.toBe(generic);
    await expect(problemMessage(problem({ code: '../generic' }))).resolves.toBe(generic);
    await expect(problemMessage(problem('not json', 502))).resolves.toBe(generic);
  });

  it('speaks English when the language is English', async () => {
    await setLocale('en');
    await expect(problemMessage(problem({ code: 'account.auth_unavailable' }))).resolves.toBe(
      "We couldn't reach the sign-in service. Please try again.",
    );
    await expect(problemMessage(problem('not json', 502))).resolves.toBe(
      'Something went wrong. Please try again.',
    );
  });
});

describe('errorMessage and errorCode', () => {
  it('gives the message of an ApiError code, and nothing for other errors', () => {
    const error = new ApiError('Saving failed', 503, { code: 'marks.unavailable' });
    expect(errorCode(error)).toBe('marks.unavailable');
    expect(errorMessage('marks.unavailable')).toBe(
      'No pudimos acceder a tu lista. Vuelve a intentarlo.',
    );
    expect(errorCode(new Error('offline'))).toBeUndefined();
    expect(errorMessage(undefined)).toBeUndefined();
    expect(errorMessage('nope')).toBeUndefined();
  });
});
