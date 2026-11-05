import { describe, expect, it, vi } from 'vitest';
import { CONSENT_KEY, createAnalytics, type PostHogLike } from './analytics';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
  } as Storage;
  return { storage, data };
}

function fakePostHog() {
  const client = {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  };
  return { client, load: vi.fn(async () => client as unknown as PostHogLike) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(consent?: string, key: string | undefined = 'phc_test') {
  const { storage, data } = fakeStorage(consent ? { [CONSENT_KEY]: consent } : {});
  const { client, load } = fakePostHog();
  const cookies: string[] = [];
  const analytics = createAnalytics({
    key,
    storage,
    load,
    clearCookies: (prefix) => cookies.push(prefix),
  });
  return { analytics, client, load, data, cookies };
}

describe('analytics', () => {
  it('loads nothing and stores nothing until the user accepts (ADR-0028)', async () => {
    const { analytics, load, data } = setup();
    expect(analytics.consent()).toBe('undecided');
    analytics.capture('card_shared', { method: 'share' });
    analytics.identify({ analyticsId: 'abc', createdAt: '2026-11-01T12:00:00.000Z' });
    await settle();
    expect(load).not.toHaveBeenCalled();
    expect([...data.keys()]).toEqual([]);
  });

  it('starts PostHog EU on consent, without autocapture or recordings, with web vitals', async () => {
    const { analytics, client, data } = setup();
    analytics.grant();
    await settle();
    expect(data.get(CONSENT_KEY)).toBe('granted');
    expect(client.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://eu.i.posthog.com',
        person_profiles: 'identified_only',
        autocapture: false,
        disable_session_recording: true,
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
        capture_performance: { web_vitals: true, network_timing: false },
        capture_pageview: 'history_change',
      }),
    );
  });

  it('starts at once when the user accepted before', async () => {
    const { client } = setup('granted');
    await settle();
    expect(client.init).toHaveBeenCalledOnce();
  });

  it('captures events with their properties only while consent holds', async () => {
    const { analytics, client } = setup('granted');
    await settle();
    analytics.capture('card_shared', { method: 'share' });
    expect(client.capture).toHaveBeenCalledWith('card_shared', { method: 'share' });

    analytics.deny();
    analytics.capture('card_shared', { method: 'download' });
    expect(client.capture).toHaveBeenCalledOnce();
  });

  it('identifies with the salted id and sends signup_completed once, at the sign-up time', async () => {
    const { analytics, client, data } = setup('granted');
    await settle();
    const identity = { analyticsId: 'a1b2', createdAt: '2026-11-01T12:00:00.000Z' };
    analytics.identify(identity);
    analytics.identify(identity);

    expect(client.identify).toHaveBeenCalledWith('a1b2');
    expect(client.capture).toHaveBeenCalledOnce();
    expect(client.capture).toHaveBeenCalledWith(
      'signup_completed',
      {},
      { timestamp: new Date('2026-11-01T12:00:00.000Z') },
    );
    expect(data.get('acrux:signup-sent:a1b2')).toBe('1');
  });

  it('applies an identity given before consent once the user accepts', async () => {
    const { analytics, client } = setup();
    analytics.identify({ analyticsId: 'a1b2', createdAt: '2026-11-01T12:00:00.000Z' });
    analytics.grant();
    await settle();
    expect(client.identify).toHaveBeenCalledWith('a1b2');
    expect(client.capture).toHaveBeenCalledWith('signup_completed', {}, expect.anything());
  });

  it('captures anonymously without an analytics id', async () => {
    const { analytics, client } = setup('granted');
    await settle();
    analytics.identify({ analyticsId: null, createdAt: '2026-11-01T12:00:00.000Z' });
    expect(client.identify).not.toHaveBeenCalled();
    expect(client.capture).not.toHaveBeenCalled();
  });

  it('on revoking, opts out, forgets the person and removes what PostHog stored', async () => {
    const { analytics, client, data, cookies } = setup('granted');
    await settle();
    data.set('ph_phc_test_posthog', '{}');
    data.set('other', 'kept');

    analytics.deny();

    expect(data.get(CONSENT_KEY)).toBe('denied');
    expect(client.opt_out_capturing).toHaveBeenCalledOnce();
    expect(client.reset).toHaveBeenCalledOnce();
    expect(data.has('ph_phc_test_posthog')).toBe(false);
    expect(data.get('other')).toBe('kept');
    expect(cookies).toEqual(['ph_']);
  });

  it('opts in again when the user accepts after revoking', async () => {
    const { analytics, client } = setup('granted');
    await settle();
    analytics.deny();
    analytics.grant();
    await settle();
    expect(client.init).toHaveBeenCalledOnce();
    expect(client.opt_in_capturing).toHaveBeenCalledOnce();
  });

  it('stays off without a project key', async () => {
    const { analytics, load } = setup('granted', '');
    analytics.grant();
    await settle();
    expect(analytics.enabled).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('tells subscribers when the choice changes', () => {
    const { analytics } = setup();
    const listener = vi.fn();
    const unsubscribe = analytics.subscribe(listener);
    analytics.grant();
    unsubscribe();
    analytics.deny();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('keeps the choice for the page view when storage is blocked', async () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
      key: () => null,
      length: 0,
      clear: () => {},
    } as unknown as Storage;
    const { client, load } = fakePostHog();
    const analytics = createAnalytics({
      key: 'phc_test',
      storage: throwing,
      load,
      clearCookies: () => {},
    });
    analytics.grant();
    await settle();
    expect(analytics.consent()).toBe('granted');
    expect(client.init).toHaveBeenCalledOnce();
    analytics.deny();
    expect(analytics.consent()).toBe('denied');
  });

  it('forgets the person on sign-out, keeping the consent', async () => {
    const { analytics, client, data } = setup('granted');
    await settle();
    analytics.forget();
    expect(client.reset).toHaveBeenCalledOnce();
    expect(data.get(CONSENT_KEY)).toBe('granted');
  });
});
