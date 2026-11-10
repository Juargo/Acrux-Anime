// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADS_CONSENT_KEY, createAds } from '../ads/ads';
import { setLocale } from '../i18n';
import { AdsRow, AnalyticsProvider, AnalyticsRow } from './AnalyticsContext';
import { type Analytics, CONSENT_KEY, createAnalytics, type PostHogLike } from './analytics';
import { ConsentBanner } from './ConsentBanner';
import { eventCallbacks } from './events';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function setup(
  options: { consent?: string; key?: string; ads?: boolean; adsConsent?: string } = {},
) {
  if (options.consent) window.localStorage.setItem(CONSENT_KEY, options.consent);
  if (options.adsConsent) window.localStorage.setItem(ADS_CONSENT_KEY, options.adsConsent);
  const client = {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  };
  const analytics = createAnalytics({
    key: options.key ?? 'phc_test',
    storage: window.localStorage,
    load: async () => client as unknown as PostHogLike,
    clearCookies: () => {},
  });
  const ads = createAds({
    client: options.ads ? 'ca-pub-123' : undefined,
    slot: options.ads ? '456' : undefined,
    storage: window.localStorage,
    inject: vi.fn(),
  });
  render(
    <AnalyticsProvider analytics={analytics} ads={ads}>
      <AnalyticsRow />
      <AdsRow />
      <ConsentBanner />
    </AnalyticsProvider>,
  );
  return { analytics, ads, client };
}

const banner = () => screen.queryByRole('region', { name: '¿Nos ayudas a medir?' });

describe('ConsentBanner', () => {
  it('asks once, with the landing copy and both choices equal (S1)', () => {
    setup();
    expect(banner()).not.toBeNull();
    screen.getByText(
      'Usamos analítica para saber si Acrux le sirve a más gente. Sin cookies hasta que aceptes, y puedes cambiarlo cuando quieras desde tu perfil.',
    );
    expect(screen.getByRole('link', { name: 'Más información' }).getAttribute('href')).toBe(
      'https://acruxanime.com/privacidad',
    );
    screen.getByRole('button', { name: 'Rechazar' });
    screen.getByRole('button', { name: 'Aceptar' });
  });

  it('starts analytics on "Aceptar" and hides', async () => {
    const user = userEvent.setup();
    const { client } = setup();
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(banner()).toBeNull();
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('granted');
    await vi.waitFor(() => expect(client.init).toHaveBeenCalledOnce());
  });

  it('loads nothing on "Rechazar" and hides', async () => {
    const user = userEvent.setup();
    const { client } = setup();
    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(banner()).toBeNull();
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('denied');
    expect(client.init).not.toHaveBeenCalled();
  });

  it('does not ask again once decided, and the Perfil row reopens it', async () => {
    const user = userEvent.setup();
    setup({ consent: 'denied' });
    expect(banner()).toBeNull();
    const row = screen.getByRole('button', { name: /Analítica/ });
    expect(row.textContent).toContain('Rechazada');

    await user.click(row);
    expect(banner()).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(screen.getByRole('button', { name: /Analítica/ }).textContent).toContain('Aceptada');
  });

  it('shows neither the banner nor the row without a project key', () => {
    setup({ key: '' });
    expect(banner()).toBeNull();
    expect(screen.queryByRole('button', { name: /Analítica/ })).toBeNull();
  });
});

describe('eventCallbacks', () => {
  it('sends each callback of the app as its ADR-0030 event', () => {
    const capture = vi.fn();
    const callbacks = eventCallbacks({ capture } as unknown as Analytics);
    callbacks.onCounterModeChanged({ mode: 'entry' });
    callbacks.onCardGenerated({ mode: 'franchise', covers: 2 });
    callbacks.onCardShared({ method: 'share' });
    callbacks.onListMadePublic({ source: 'first_share' });
    callbacks.onFranchiseMarked({ status: 'seen', coreSize: 4 });
    callbacks.onViewed({ listVisibility: 'public' });
    callbacks.onRateLimited({ attempt: 1 });
    expect(capture.mock.calls).toEqual([
      ['counter_mode_changed', { mode: 'entry' }],
      ['card_generated', { mode: 'franchise', covers: 2 }],
      ['card_shared', { method: 'share' }],
      ['list_made_public', { source: 'first_share' }],
      ['franchise_marked', { status: 'seen', coreSize: 4 }],
      ['public_profile_viewed', { listVisibility: 'public' }],
      ['anilist_rate_limited', { attempt: 1 }],
    ]);
  });
});

describe('ConsentBanner in English (#43)', () => {
  afterEach(() => setLocale('es'));

  it('asks in English, and the Perfil row too', async () => {
    await setLocale('en');
    setup();
    expect(screen.queryByRole('region', { name: 'Will you help us measure?' })).not.toBeNull();
    screen.getByRole('link', { name: 'Learn more' });
    screen.getByRole('button', { name: 'Decline' });
    screen.getByRole('button', { name: 'Accept' });
    expect(screen.getByRole('button', { name: /Analytics/ }).textContent).toContain('Undecided');
    expect(screen.queryByRole('button', { name: 'Rechazar' })).toBeNull();
  });
});

// RF-58 and S3 of odd/tasks/anuncios.md: with AdSense configured, analytics and personalized ads
// are asked separately, and each one is changed on its own from Perfil.
describe('ConsentBanner with ads (RF-58)', () => {
  const privacy = () => screen.queryByRole('region', { name: 'Tu privacidad en Acrux' });
  const choice = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;

  it('@CA-RF58-02 asks analytics and personalized ads separately, unchecked', () => {
    setup({ ads: true });
    expect(privacy()).not.toBeNull();
    expect(banner()).toBeNull();
    expect(choice('Analítica').checked).toBe(false);
    expect(choice('Anuncios personalizados').checked).toBe(false);
    screen.getByRole('button', { name: 'Rechazar todo' });
    screen.getByRole('button', { name: 'Guardar elección' });
    screen.getByRole('button', { name: 'Aceptar todo' });
  });

  it('accepts both with "Aceptar todo"', async () => {
    const user = userEvent.setup();
    const { analytics, ads, client } = setup({ ads: true });
    await user.click(screen.getByRole('button', { name: 'Aceptar todo' }));
    expect(analytics.consent()).toBe('granted');
    expect(ads.consent()).toBe('granted');
    await vi.waitFor(() => expect(client.init).toHaveBeenCalled());
    expect(privacy()).toBeNull();
  });

  it('declines both with "Rechazar todo"', async () => {
    const user = userEvent.setup();
    const { analytics, ads, client } = setup({ ads: true });
    await user.click(screen.getByRole('button', { name: 'Rechazar todo' }));
    expect(analytics.consent()).toBe('denied');
    expect(ads.consent()).toBe('denied');
    expect(client.init).not.toHaveBeenCalled();
    expect(privacy()).toBeNull();
  });

  it('saves each choice on its own', async () => {
    const user = userEvent.setup();
    const { analytics, ads } = setup({ ads: true });
    await user.click(choice('Anuncios personalizados'));
    await user.click(screen.getByRole('button', { name: 'Guardar elección' }));
    expect(analytics.consent()).toBe('denied');
    expect(ads.consent()).toBe('granted');
    expect(window.localStorage.getItem(ADS_CONSENT_KEY)).toBe('granted');
  });

  it('asks again when only the ads choice is missing', () => {
    setup({ ads: true, consent: 'granted' });
    expect(privacy()).not.toBeNull();
    expect(choice('Analítica').checked).toBe(true);
  });

  it('changes personalized ads from its Perfil row, keeping analytics', async () => {
    const user = userEvent.setup();
    const { analytics, ads } = setup({ ads: true, consent: 'granted', adsConsent: 'granted' });
    expect(privacy()).toBeNull();
    await user.click(screen.getByRole('button', { name: /Anuncios personalizados/ }));
    await user.click(choice('Anuncios personalizados'));
    await user.click(screen.getByRole('button', { name: 'Guardar elección' }));
    expect(ads.consent()).toBe('denied');
    expect(analytics.consent()).toBe('granted');
    screen.getByRole('button', { name: /Anuncios personalizados.*Rechazados/ });
  });

  it('shows no ads row and keeps the analytics banner without AdSense', () => {
    setup();
    expect(banner()).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Anuncios personalizados/ })).toBeNull();
  });
});
