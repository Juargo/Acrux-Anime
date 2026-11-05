// Product analytics of the web app (#46, ADR-0028, ADR-0030): PostHog EU, loaded only after
// consent, with nothing captured automatically and no personal data in any property.

export type Consent = 'granted' | 'denied' | 'undecided';

// The same key as the landing (apps/landing/src/lib/consent.ts); each origin keeps its own.
export const CONSENT_KEY = 'acrux:analytics-consent';
const SIGNUP_SENT = 'acrux:signup-sent:';

// The part of posthog-js the app uses, so tests can stand in for it.
export interface PostHogLike {
  init(key: string, options: Record<string, unknown>): unknown;
  capture(
    event: string,
    properties?: Record<string, unknown>,
    options?: { timestamp?: Date },
  ): unknown;
  identify(id: string): unknown;
  reset(): unknown;
  opt_in_capturing(): unknown;
  opt_out_capturing(): unknown;
}

export interface Identity {
  // The salted id from /api/v1/me (L2 of odd/tasks/posthog.md); null captures anonymously.
  analyticsId: string | null;
  // When the profile was created: signup_completed is timestamped with it.
  createdAt: string;
}

// What posthog-js hands to before_send; null drops the event.
export interface CaptureEvent {
  event: string;
  properties: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
}

// "/@camila" → "/@:handle" in any URL or path: a public profile's handle is the owner's.
const HANDLE_PATH = /\/@[a-z0-9_]{3,20}(?=[/?#]|$)/gi;

function scrub(values: Record<string, unknown> | undefined) {
  if (!values) return;
  // posthog-js adds document.title, which shows a profile's name (ADR-0030: never names).
  delete values.title;
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'string') values[name] = value.replace(HANDLE_PATH, '/@:handle');
  }
}

// Every event, the SDK's own included, leaves the device without names or handles.
export function scrubEvent(event: CaptureEvent): CaptureEvent {
  scrub(event.properties);
  scrub(event.$set);
  scrub(event.$set_once);
  return event;
}

export interface Analytics {
  // False without a project key: the banner never shows and nothing loads.
  readonly enabled: boolean;
  consent(): Consent;
  grant(): void;
  deny(): void;
  identify(identity: Identity): void;
  capture(event: string, properties?: Record<string, unknown>): void;
  // On sign-out: the next account on this device is another person; the consent stays.
  forget(): void;
  subscribe(listener: () => void): () => void;
}

// The landing's options (ADR-0028: no text fields, clicks, recordings, remote code or flags),
// plus Core Web Vitals (RNF-10) and pageviews on client-side navigation.
const OPTIONS = {
  api_host: 'https://eu.i.posthog.com',
  person_profiles: 'identified_only',
  capture_pageview: 'history_change',
  capture_performance: { web_vitals: true, network_timing: false },
  autocapture: false,
  capture_heatmaps: false,
  capture_dead_clicks: false,
  capture_exceptions: false,
  disable_session_recording: true,
  disable_surveys: true,
  disable_web_experiments: true,
  disable_external_dependency_loading: true,
  advanced_disable_flags: true,
};

function read(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Blocked storage: the choice lasts only for this page view.
  }
}

export function createAnalytics(options: {
  key: string | undefined;
  storage: Storage | undefined;
  load: () => Promise<PostHogLike>;
  clearCookies: (prefix: string) => void;
  // Tests look at what would be sent; null drops it.
  beforeSend?: (event: CaptureEvent) => CaptureEvent | null;
}): Analytics {
  const { key, storage, load, clearCookies, beforeSend } = options;
  // The choice of this page view when storage is blocked (it then lasts only for the page).
  let memory: Consent = 'undecided';
  const listeners = new Set<() => void>();
  let client: PostHogLike | undefined;
  let loading = false;
  let identity: Identity | undefined;

  const consent = (): Consent => {
    const value = read(storage, CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : memory;
  };
  const choose = (value: Exclude<Consent, 'undecided'>) => {
    memory = value;
    write(storage, CONSENT_KEY, value);
  };
  const active = () => client !== undefined && consent() === 'granted';
  const notify = () => {
    for (const listener of listeners) listener();
  };

  function applyIdentity() {
    if (!client || !identity?.analyticsId || consent() !== 'granted') return;
    const { analyticsId, createdAt } = identity;
    client.identify(analyticsId);
    // Once per device, at the sign-up time, so the RN-M1 funnel holds when consent comes later.
    if (read(storage, SIGNUP_SENT + analyticsId)) return;
    client.capture('signup_completed', {}, { timestamp: new Date(createdAt) });
    write(storage, SIGNUP_SENT + analyticsId, '1');
  }

  async function start() {
    if (!key || client || loading) return;
    loading = true;
    try {
      const loaded = await load();
      // The user may have revoked while the SDK was loading.
      if (consent() !== 'granted') return;
      loaded.init(key, {
        ...OPTIONS,
        before_send: (event: CaptureEvent | null) => {
          if (!event) return null;
          const clean = scrubEvent(event);
          return beforeSend ? beforeSend(clean) : clean;
        },
      });
      client = loaded;
      applyIdentity();
    } finally {
      loading = false;
    }
  }

  // Revoking forgets the person, then stops capture: reset() clears the opt-out, so it goes
  // first. What PostHog stored here is removed.
  function stop() {
    client?.reset();
    client?.opt_out_capturing();
    if (storage) {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const name = storage.key(index);
        if (name?.startsWith('ph_')) storage.removeItem(name);
      }
    }
    clearCookies('ph_');
  }

  if (key && consent() === 'granted') void start();

  return {
    enabled: Boolean(key),
    consent,
    grant: () => {
      if (!key) return;
      const wasOptedOut = client !== undefined && consent() === 'denied';
      choose('granted');
      notify();
      if (wasOptedOut) {
        client?.opt_in_capturing();
        applyIdentity();
      } else void start();
    },
    deny: () => {
      choose('denied');
      notify();
      stop();
    },
    identify: (next) => {
      identity = next;
      applyIdentity();
    },
    capture: (event, properties = {}) => {
      if (active()) client?.capture(event, properties);
    },
    forget: () => {
      identity = undefined;
      if (active()) client?.reset();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
