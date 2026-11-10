import type { Consent } from '../analytics/analytics';

// Google AdSense for free users (RF-58, ADR-0038), behind a switch like billing: without a
// client and a slot id nothing loads, no slot renders and the banner asks only for analytics.

// Per device, like analytics consent (ADR-0028); never sent to the API.
export const ADS_CONSENT_KEY = 'acrux:ads-consent';
export const ADSENSE_SCRIPT = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

// The queue adsbygoogle.js reads; a flag on it asks for non-personalized ads.
interface AdQueue extends Array<Record<string, never>> {
  requestNonPersonalizedAds?: 0 | 1;
}

declare global {
  interface Window {
    adsbygoogle?: AdQueue;
  }
}

export interface Ads {
  // False without VITE_ADSENSE_CLIENT and VITE_ADSENSE_SLOT.
  readonly enabled: boolean;
  readonly client: string | undefined;
  readonly slot: string | undefined;
  consent(): Consent;
  grant(): void;
  deny(): void;
  subscribe(listener: () => void): () => void;
  // Loads the script once, then asks for one ad: non-personalized without consent (ADR-0038).
  request(): void;
}

function read(storage: Storage | undefined) {
  try {
    return storage?.getItem(ADS_CONSENT_KEY) ?? null;
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, value: string) {
  try {
    storage?.setItem(ADS_CONSENT_KEY, value);
  } catch {
    // Blocked storage: the choice lasts only for this page view.
  }
}

// The script tag AdSense asks for, added to <head> once.
export function injectScript(src: string) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  script.crossOrigin = 'anonymous';
  document.head.append(script);
}

export function createAds(options: {
  client: string | undefined;
  slot: string | undefined;
  storage: Storage | undefined;
  inject?: (src: string) => void;
}): Ads {
  const { client, slot, storage, inject = injectScript } = options;
  const enabled = Boolean(client && slot);
  let memory: Consent = 'undecided';
  let injected = false;
  const listeners = new Set<() => void>();

  const consent = (): Consent => {
    const value = read(storage);
    return value === 'granted' || value === 'denied' ? value : memory;
  };
  const choose = (value: Exclude<Consent, 'undecided'>) => {
    memory = value;
    write(storage, value);
    for (const listener of listeners) listener();
  };

  return {
    enabled,
    client,
    slot,
    consent,
    grant: () => choose('granted'),
    deny: () => choose('denied'),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    request: () => {
      if (!enabled || !client) return;
      if (!injected) {
        injected = true;
        inject(`${ADSENSE_SCRIPT}?client=${encodeURIComponent(client)}`);
      }
      window.adsbygoogle ??= [];
      window.adsbygoogle.requestNonPersonalizedAds = consent() === 'granted' ? 0 : 1;
      window.adsbygoogle.push({});
    },
  };
}
