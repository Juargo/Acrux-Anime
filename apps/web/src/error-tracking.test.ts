import { captureException, flush, getClient } from '@sentry/react';
import { describe, expect, it } from 'vitest';
import { initErrorTracking } from './error-tracking';

const DSN = 'https://public@o1.ingest.de.sentry.io/1';

function trackWithFakeTransport() {
  const sent: unknown[] = [];
  initErrorTracking({
    dsn: DSN,
    environment: 'preview',
    transport: () => ({
      send: async (envelope) => {
        sent.push(envelope);
        return {};
      },
      flush: async () => true,
    }),
  });
  return sent;
}

describe('initErrorTracking', () => {
  it('stays off without a DSN', () => {
    expect(getClient()).toBeUndefined();
    initErrorTracking({ dsn: undefined });
    expect(getClient()).toBeUndefined();
  });

  it('turns off every data collection default and session tracking', () => {
    trackWithFakeTransport();
    expect(getClient()?.getOptions().dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
    expect(getClient()?.getIntegrationByName('BrowserSession')).toBeUndefined();
  });

  it('sends nothing from a thrown object that is not an Error', async () => {
    const sent = trackWithFakeTransport();
    const email = ['ana', 'example.com'].join('@');
    const secret = ['hun', 'ter2'].join('');
    captureException({ email, password: secret });
    await flush(1000);
    const body = JSON.stringify(sent);
    expect(body).not.toContain(email);
    expect(body).not.toContain(secret);
  });

  it('removes personal data and secrets from the event', async () => {
    const sent = trackWithFakeTransport();
    // Assembled at runtime: event stack frames may quote this source file.
    const email = ['ana', 'example.com'].join('@');
    const bearerValue = ['abc', 'def'].join('.');
    const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxIn0', 'c2lnbmF0dXJl'].join('.');
    captureException(new Error(`user ${email} failed: Bearer ${bearerValue} ${jwt}`));
    await flush(1000);
    const body = JSON.stringify(sent);
    expect(body).toContain('[redacted]');
    expect(body).not.toContain(email);
    expect(body).not.toContain(bearerValue);
    expect(body).not.toContain(jwt);
    const [, items] = sent[0] as [unknown, [unknown, Record<string, unknown>][]];
    expect(items[0]?.[1].request).toBeUndefined();
    expect(items[0]?.[1].user).toBeUndefined();
  });
});
