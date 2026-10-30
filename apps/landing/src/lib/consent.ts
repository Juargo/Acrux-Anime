// Analytics consent for the landing (ADR-0028, RF-82). Only the choice itself is stored;
// PostHog is not loaded and stores nothing until the visitor accepts.

export type Consent = 'granted' | 'denied' | 'undecided';

export const CONSENT_KEY = 'acrux:analytics-consent';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

// Blocked or unavailable storage counts as undecided, so the banner shows again.
export function readConsent(storage: Storage): Consent {
  try {
    const value = storage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : 'undecided';
  } catch {
    return 'undecided';
  }
}

export function writeConsent(storage: Storage, consent: Exclude<Consent, 'undecided'>): void {
  try {
    storage.setItem(CONSENT_KEY, consent);
  } catch {
    // The choice then lasts only for this page view.
  }
}

// Source of a visit, to break conversion down by channel (ADR-0030).
export function utmProperties(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const properties: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) properties[key] = value;
  }
  return properties;
}
