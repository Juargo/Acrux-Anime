// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsProvider } from '../analytics/AnalyticsContext';
import { createAnalytics } from '../analytics/analytics';
import { fakeCatalogClient } from '../catalog-source/test-support';
import { setLocale } from '../i18n';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';
import { createAds } from './ads';

// Where ads go (RF-58, ADR-0038): Inicio, Mi lista, the franchise detail and the card screen,
// outside the card; nowhere else, and never for Plus (RF-59).
afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  delete window.adsbygoogle;
  await setLocale('es');
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const free: Profile = {
  displayName: 'Camila',
  avatarUrl: null,
  avatarPreset: 'lavanda',
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
  handle: 'camila',
  shownTotal: 0,
  shownMode: 'franchise',
  cardShared: true,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
  plan: 'free',
  plusAvailable: true,
  badges: [],
};

function renderAt(path: string, profile: Profile = free) {
  const inject = vi.fn();
  const ads = createAds({ client: 'ca-pub-123', slot: '456', storage: undefined, inject });
  const analytics = createAnalytics({
    key: undefined,
    storage: undefined,
    load: async () => {
      throw new Error('not used');
    },
    clearCookies: () => {},
  });
  // An empty catalog: no page, and no franchise holds any id.
  const client = fakeCatalogClient({
    browse: async () => ({ items: [], related: [], nextPage: null }),
    franchises: async (seeds) => ({ items: [], related: [], missing: [...seeds], pending: [] }),
  });
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: [], nextCursor: null });
    if (url === '/api/v1/me') return json(init?.method === 'PATCH' ? profile : profile);
    throw new Error(`Unexpected request ${url}`);
  });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Home
            profile={profile}
            onSignOut={vi.fn()}
            signingOut={false}
            signOutFailed={false}
            getToken={async () => 'jwt'}
            client={client}
            fetchFn={fetchFn as unknown as typeof fetch}
          />
        ),
        children: signedInRoutes,
      },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AnalyticsProvider analytics={analytics} ads={ads}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AnalyticsProvider>,
  );
  return { inject };
}

const adSlot = () => screen.findByRole('complementary', { name: 'Publicidad' });
const noAdSlot = () =>
  expect(screen.queryByRole('complementary', { name: 'Publicidad' })).toBeNull();

describe('ad placement (RF-58, RF-59)', () => {
  it('@CA-RF58-01 shows one ad on Inicio, after the filters', async () => {
    renderAt('/');
    await adSlot();
    expect(screen.getAllByRole('complementary', { name: 'Publicidad' })).toHaveLength(1);
  });

  it('shows one ad on Mi lista', async () => {
    renderAt('/mi-lista');
    await adSlot();
  });

  it('@CA-RF58-03 shows the ad on the card screen outside the card', async () => {
    renderAt('/tarjeta');
    const card = await screen.findByRole('figure', { name: 'Vista previa de tu tarjeta' });
    const slot = await adSlot();
    expect(card.contains(slot)).toBe(false);
    expect(within(card).queryByText('Publicidad')).toBeNull();
  });

  it('shows no ad on a franchise the catalog does not have', async () => {
    renderAt('/franquicia/1');
    await screen.findByText('No encontramos esta franquicia en el catálogo.');
    noAdSlot();
  });

  it.each(['/perfil', '/perfil/borrar-cuenta', '/perfil/plus', '/perfil/insignias', '/privacidad'])(
    '@CA-RF58-03 shows no ad on %s',
    async (path) => {
      renderAt(path);
      await screen.findAllByRole('heading');
      noAdSlot();
    },
  );

  it('@CA-RF59-01 shows no ad to a Plus user and never loads AdSense', async () => {
    const plus = { ...free, plan: 'plus' as const };
    for (const path of ['/', '/mi-lista', '/tarjeta']) {
      const { inject } = renderAt(path, plus);
      await screen.findAllByRole('heading');
      noAdSlot();
      expect(inject).not.toHaveBeenCalled();
      cleanup();
    }
  });
});
