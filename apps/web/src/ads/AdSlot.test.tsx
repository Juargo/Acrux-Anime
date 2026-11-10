// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsProvider } from '../analytics/AnalyticsContext';
import { type Analytics, createAnalytics } from '../analytics/analytics';
import { AdSlotView } from './AdSlot';
import { ADS_CONSENT_KEY, ADSENSE_SCRIPT, createAds } from './ads';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete window.adsbygoogle;
});

const analytics: Analytics = createAnalytics({
  key: undefined,
  storage: undefined,
  load: async () => {
    throw new Error('not used');
  },
  clearCookies: () => {},
});

function renderSlot(options: {
  plan?: 'free' | 'plus' | undefined;
  enabled?: boolean;
  consent?: string;
}) {
  if (options.consent) window.localStorage.setItem(ADS_CONSENT_KEY, options.consent);
  const inject = vi.fn();
  const ads = createAds({
    client: options.enabled === false ? undefined : 'ca-pub-123',
    slot: options.enabled === false ? undefined : '456',
    storage: window.localStorage,
    inject,
  });
  const view = render(
    <AnalyticsProvider analytics={analytics} ads={ads}>
      <AdSlotView plan={options.plan} />
      <AdSlotView plan={options.plan} />
    </AnalyticsProvider>,
  );
  return { inject, view };
}

describe('AdSlot (RF-58, RF-59)', () => {
  it('@CA-RF58-01 shows a labelled ad to a free user, loading AdSense once', () => {
    const { inject, view } = renderSlot({ plan: 'free' });
    const slots = screen.getAllByRole('complementary', { name: 'Publicidad' });
    expect(slots).toHaveLength(2);
    expect(slots[0]?.textContent).toContain('Publicidad');
    const unit = view.container.querySelector('ins.adsbygoogle');
    expect(unit?.getAttribute('data-ad-client')).toBe('ca-pub-123');
    expect(unit?.getAttribute('data-ad-slot')).toBe('456');
    expect(inject).toHaveBeenCalledTimes(1);
    expect(inject).toHaveBeenCalledWith(`${ADSENSE_SCRIPT}?client=ca-pub-123`);
    expect(window.adsbygoogle).toHaveLength(2);
  });

  it('asks for non-personalized ads without consent', () => {
    renderSlot({ plan: 'free', consent: 'denied' });
    expect(window.adsbygoogle?.requestNonPersonalizedAds).toBe(1);
  });

  it('asks for personalized ads once they are accepted', () => {
    renderSlot({ plan: 'free', consent: 'granted' });
    expect(window.adsbygoogle?.requestNonPersonalizedAds).toBe(0);
  });

  it('@CA-RF59-01 shows nothing to a Plus user and never loads AdSense', () => {
    const { inject } = renderSlot({ plan: 'plus' });
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).toBeNull();
    expect(inject).not.toHaveBeenCalled();
    expect(window.adsbygoogle).toBeUndefined();
  });

  it('waits for the plan before showing anything', () => {
    const { inject } = renderSlot({ plan: undefined });
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(inject).not.toHaveBeenCalled();
  });

  it('shows nothing while AdSense is not configured', () => {
    const { inject } = renderSlot({ plan: 'free', enabled: false });
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(inject).not.toHaveBeenCalled();
  });
});
