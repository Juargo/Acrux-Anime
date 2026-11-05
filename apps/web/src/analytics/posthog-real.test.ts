// @vitest-environment jsdom
// The real posthog-js, not a fake: the SDK's own side effects (reset clearing the opt-out,
// pageviews on navigation, document.title in every event) are what these tests pin.
import posthog from 'posthog-js';
import { afterAll, describe, expect, it } from 'vitest';
import { createAnalytics, type PostHogLike } from './analytics';

type Sent = { event: string; properties: Record<string, unknown> };
const sent: Sent[] = [];

const analytics = createAnalytics({
  key: 'phc_test',
  storage: window.localStorage,
  load: async () => posthog as unknown as PostHogLike,
  clearCookies: () => {},
  // Records what would leave the device, and sends nothing.
  beforeSend: (event) => {
    sent.push({ event: event.event, properties: { ...event.properties } });
    return null;
  },
});

afterAll(() => window.localStorage.clear());

const eventually = async (check: () => void) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      check();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  check();
};

describe('analytics with the real posthog-js', () => {
  it('never sends the display name or the handle of a public profile (ADR-0030)', async () => {
    window.history.pushState({}, '', '/@camila_perez');
    document.title = 'Camila Pérez (@camila_perez) · Acrux';
    analytics.grant();
    await eventually(() => expect(sent.some((item) => item.event === '$pageview')).toBe(true));
    analytics.capture('public_profile_viewed', { listVisibility: 'public' });

    const text = JSON.stringify(sent);
    expect(text).not.toContain('Camila');
    expect(text).not.toContain('camila_perez');
    const pageview = sent.find((item) => item.event === '$pageview');
    expect(pageview?.properties.title).toBeUndefined();
    expect(pageview?.properties.$pathname).toBe('/@:handle');
    expect(String(pageview?.properties.$current_url)).toMatch(/\/@:handle$/);
  });

  it('sends nothing more after the user revokes, navigation included (ADR-0028)', async () => {
    analytics.capture('card_shared', { method: 'share' });
    expect(sent.at(-1)?.event).toBe('card_shared');

    analytics.deny();
    sent.length = 0;
    window.history.pushState({}, '', '/mi-lista');
    analytics.capture('card_shared', { method: 'download' });
    posthog.capture('$pageview');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(sent).toEqual([]);
    expect(Object.keys(window.localStorage).filter((key) => key.startsWith('ph_'))).toEqual([]);
  });

  it('captures again when the user accepts after revoking', async () => {
    analytics.grant();
    analytics.capture('card_shared', { method: 'share' });
    await eventually(() => expect(sent.some((item) => item.event === 'card_shared')).toBe(true));
  });
});
