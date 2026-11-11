// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogClient } from '../catalog-source/client';
import { setLocale } from '../i18n';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';

afterEach(cleanup);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const base: Profile = {
  displayName: 'Camila',
  avatarUrl: null,
  avatarPreset: null,
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
  handle: 'camila',
  shownTotal: 48,
  shownMode: 'franchise',
  cardShared: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
};

function renderPrivacy(
  options: { profile?: Partial<Profile>; failPatch?: boolean; from?: string } = {},
) {
  let profile = { ...base, ...options.profile };
  const patches: unknown[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: [], nextCursor: null });
    if (url === '/api/v1/me' && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string);
      if ('shown' in body) return json(profile);
      patches.push(body);
      if (options.failPatch) return json({ status: 503 }, 503);
      profile = { ...profile, ...body };
      return json(profile);
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const onListMadePublic = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Home
            profile={profile}
            onSignOut={() => {}}
            signingOut={false}
            signOutFailed={false}
            getToken={async () => 'jwt'}
            client={{ request: vi.fn() } as unknown as CatalogClient}
            fetchFn={fetchFn as unknown as typeof fetch}
            onListMadePublic={onListMadePublic}
          />
        ),
        children: signedInRoutes,
      },
    ],
    {
      initialEntries: options.from
        ? [options.from, { pathname: '/privacidad', state: { from: options.from } }]
        : ['/privacidad'],
      initialIndex: options.from ? 1 : 0,
    },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { patches, onListMadePublic, router };
}

const choice = (name: RegExp) => screen.getByRole('radio', { name }) as HTMLInputElement;
const preview = () => screen.getByRole('region', { name: 'ASÍ TE VE UN VISITANTE' });

describe('PrivacyScreen', () => {
  it('shows who sees the list, private by default, and how a visitor sees it (RF-42)', async () => {
    renderPrivacy();
    await screen.findByRole('heading', { name: '¿Quién ve tu lista?' });
    screen.getByText('Tu total siempre se ve en tu tarjeta y tu enlace.');
    expect(choice(/^Privada/).checked).toBe(true);
    expect(choice(/^Pública/).checked).toBe(false);
    screen.getByText('Quien abra tu enlace solo verá tu total.');
    screen.getByText('Verán tu total, lo que estás viendo y tus sagas más recientes.');
    within(preview()).getByText('48');
    within(preview()).getByText('ANIMES COMPLETOS');
    within(preview()).getByText('Camila mantiene su lista privada');
  });

  it('makes the list public, saves it and says so', async () => {
    const user = userEvent.setup();
    const { patches, onListMadePublic } = renderPrivacy();

    await user.click(await screen.findByRole('radio', { name: /^Pública/ }));

    expect(await screen.findByText('Listo, guardado.')).toBeTruthy();
    expect(patches).toEqual([{ listVisibility: 'public' }]);
    expect(choice(/^Pública/).checked).toBe(true);
    expect(within(preview()).queryByText('Camila mantiene su lista privada')).toBeNull();
    within(preview()).getByText('Verán lo que estás viendo y tus sagas más recientes.');
    expect(onListMadePublic).toHaveBeenCalledWith({ source: 'privacy' });
    expect(screen.getByRole('link', { name: 'Ver mi perfil público' }).getAttribute('href')).toBe(
      '/@camila',
    );
  });

  it('makes a public list private again, without the public-list event', async () => {
    const user = userEvent.setup();
    const { patches, onListMadePublic } = renderPrivacy({ profile: { listVisibility: 'public' } });

    await user.click(await screen.findByRole('radio', { name: /^Privada/ }));

    await screen.findByText('Listo, guardado.');
    expect(patches).toEqual([{ listVisibility: 'private' }]);
    expect(onListMadePublic).not.toHaveBeenCalled();
  });

  it('goes back and says so when saving fails', async () => {
    const user = userEvent.setup();
    renderPrivacy({ failPatch: true });

    await user.click(await screen.findByRole('radio', { name: /^Pública/ }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No pudimos guardar. Vuelve a intentarlo.',
    );
    await waitFor(() => expect(choice(/^Privada/).checked).toBe(true));
    expect(screen.queryByText('Listo, guardado.')).toBeNull();
  });

  it('goes back to Perfil, or to the card when it was opened from the card', async () => {
    const user = userEvent.setup();
    renderPrivacy();
    expect((await screen.findByRole('link', { name: '‹ Perfil' })).getAttribute('href')).toBe(
      '/perfil',
    );

    cleanup();
    const { router } = renderPrivacy({ from: '/tarjeta' });
    await user.click(await screen.findByRole('link', { name: '‹ Tu tarjeta' }));
    expect(router.state.location.pathname).toBe('/tarjeta');
  });
});

describe('PrivacyScreen in English (#43)', () => {
  afterEach(() => setLocale('es'));

  it('asks who sees the list in English', async () => {
    await setLocale('en');
    renderPrivacy();
    await screen.findByRole('heading', { name: 'Who sees your list?' });
    expect(choice(/^Private/).checked).toBe(true);
    screen.getByText('Anyone who opens your link will only see your total.');
    const visitor = screen.getByRole('region', { name: 'HOW A VISITOR SEES YOU' });
    within(visitor).getByText('ANIME COMPLETED');
    within(visitor).getByText('Camila keeps their list private');
    within(visitor).getByRole('link', { name: 'See my public profile' });
    screen.getByRole('link', { name: '‹ Profile' });
    expect(screen.queryByText('¿Quién ve tu lista?')).toBeNull();
  });
});
