import { getClient } from '@sentry/node';
import { describe, expect, it } from 'vitest';
import { createSentryReporter } from './sentry-reporter.js';

const DSN = 'https://public@o1.ingest.de.sentry.io/1';

function reporterWithFakeTransport() {
  const sent: unknown[] = [];
  const reporter = createSentryReporter({
    dsn: DSN,
    environment: 'preview',
    release: 'abc123',
    transport: () => ({
      send: async (envelope) => {
        sent.push(envelope);
        return {};
      },
      flush: async () => true,
    }),
  });
  return { reporter, sent };
}

describe('createSentryReporter', () => {
  it('turns off every data collection default of the SDK', () => {
    reporterWithFakeTransport();
    expect(getClient()?.getOptions().dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
  });

  it('sends the event tagged with the request id, before report resolves', async () => {
    const { reporter, sent } = reporterWithFakeTransport();
    await reporter.report(new Error('boom'), { requestId: 'req-1' });
    const body = JSON.stringify(sent);
    expect(body).toContain('"requestId":"req-1"');
    expect(body).toContain('"environment":"preview"');
    expect(body).toContain('"release":"abc123"');
  });

  it('removes personal data and secrets from the message', async () => {
    const { reporter, sent } = reporterWithFakeTransport();
    // Assembled at runtime: event stack frames quote this source file.
    const email = ['ana', 'example.com'].join('@');
    const secret = ['hun', 'ter2'].join('');
    const bearerValue = ['abc', 'def'].join('.');
    const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxIn0', 'c2lnbmF0dXJl'].join('.');
    await reporter.report(
      new Error(
        `user ${email} failed: Bearer ${bearerValue} ${jwt} postgresql://u:${secret}@host/db`,
      ),
      { requestId: 'req-2' },
    );
    const body = JSON.stringify(sent);
    expect(body).not.toContain(email);
    expect(body).not.toContain(bearerValue);
    expect(body).not.toContain(jwt);
    expect(body).not.toContain(secret);
    expect(body).toContain('[redacted]');
  });

  it('sends neither the request, the user nor the server name', async () => {
    const { reporter, sent } = reporterWithFakeTransport();
    await reporter.report(new Error('boom'), { requestId: 'req-3' });
    const [, items] = sent[0] as [unknown, [unknown, Record<string, unknown>][]];
    const event = items[0]?.[1] ?? {};
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(event.server_name).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
  });
});
