// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsProvider, AnalyticsRow } from './AnalyticsContext';
import { type Analytics, CONSENT_KEY, createAnalytics, type PostHogLike } from './analytics';
import { ConsentBanner } from './ConsentBanner';
import { eventCallbacks } from './events';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function setup(options: { consent?: string; key?: string } = {}) {
  if (options.consent) window.localStorage.setItem(CONSENT_KEY, options.consent);
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
  render(
    <AnalyticsProvider analytics={analytics}>
      <AnalyticsRow />
      <ConsentBanner />
    </AnalyticsProvider>,
  );
  return { analytics, client };
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
