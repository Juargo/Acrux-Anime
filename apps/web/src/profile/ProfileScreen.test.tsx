// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AniListClient } from '../anilist/client';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';

afterEach(cleanup);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const base: Profile = {
  displayName: 'Camila',
  avatarUrl: null,
  avatarPreset: 'lavanda',
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
  handle: 'camila',
  shownTotal: 48,
  shownMode: 'franchise',
  cardShared: true,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
};

function renderProfile(options: { failPatch?: boolean } = {}) {
  const patches: unknown[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: [], nextCursor: null });
    if (url === '/api/v1/me' && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string);
      if ('shown' in body) return json(base);
      patches.push(body);
      if (options.failPatch) return json({ status: 503 }, 503);
      return json({ ...base, ...body });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const onSignOut = vi.fn();
  const onCounterModeChanged = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Home
            profile={base}
            onSignOut={onSignOut}
            onCounterModeChanged={onCounterModeChanged}
            signingOut={false}
            signOutFailed={false}
            getToken={async () => 'jwt'}
            client={{ request: vi.fn() } as unknown as AniListClient}
            fetchFn={fetchFn as unknown as typeof fetch}
          />
        ),
        children: signedInRoutes,
      },
    ],
    { initialEntries: ['/perfil'] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { patches, onSignOut, onCounterModeChanged, router };
}

const page = () => screen.getByRole('region', { name: 'Perfil' });
const row = (name: RegExp) => within(page()).getByRole('link', { name });

describe('ProfileScreen', () => {
  it('shows who I am, my link and "Editar" (Figma M16)', async () => {
    renderProfile();
    await screen.findByRole('region', { name: 'Perfil' });
    within(page()).getByRole('heading', { name: 'Camila' });
    within(page()).getByText(`@camila · ${window.location.host}/@camila`);
    expect(page().querySelector('.avatar--lavanda')).not.toBeNull();
    expect(within(page()).getByRole('link', { name: 'Editar' }).getAttribute('href')).toBe(
      '/perfil/editar',
    );
  });

  it('links "Tu lista" to who sees it, with its current value', async () => {
    renderProfile();
    await screen.findByRole('region', { name: 'Perfil' });
    const link = row(/Tu lista/);
    expect(link.getAttribute('href')).toBe('/privacidad');
    expect(link.textContent).toContain('Privada');
  });

  it('switches how the counter counts, as the header does', async () => {
    const user = userEvent.setup();
    const { patches, onCounterModeChanged } = renderProfile();
    const button = await within(await screen.findByRole('region', { name: 'Perfil' })).findByRole(
      'button',
      { name: /Contar por/ },
    );
    expect(button.textContent).toContain('Franquicias');

    await user.click(button);

    expect(button.textContent).toContain('Entradas');
    await vi.waitFor(() => expect(patches).toEqual([{ counterMode: 'entry' }]));
    // counter_mode_changed, as from the header counter (#46).
    expect(onCounterModeChanged).toHaveBeenCalledWith({ mode: 'entry' });
    const header = screen.getByRole('region', { name: 'Contador total' });
    expect(
      within(header).getByRole('button', { name: 'Entradas' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('goes back and says so when saving the counter mode fails', async () => {
    const user = userEvent.setup();
    renderProfile({ failPatch: true });
    const button = await within(await screen.findByRole('region', { name: 'Perfil' })).findByRole(
      'button',
      { name: /Contar por/ },
    );

    await user.click(button);

    await vi.waitFor(() => expect(button.textContent).toContain('Franquicias'));
    within(page()).getByRole('alert');
  });

  it('signs out', async () => {
    const user = userEvent.setup();
    const { onSignOut } = renderProfile();
    await user.click(
      await within(await screen.findByRole('region', { name: 'Perfil' })).findByRole('button', {
        name: 'Cerrar sesión',
      }),
    );
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('is the "Perfil" tab of the bar, and the privacy screen goes back to it', async () => {
    const user = userEvent.setup();
    const { router } = renderProfile();
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    const tab = within(nav).getByRole('link', { name: 'Perfil' });
    expect(tab.getAttribute('href')).toBe('/perfil');
    expect(tab.getAttribute('aria-current')).toBe('page');

    await user.click(row(/Tu lista/));
    await user.click(await screen.findByRole('link', { name: '‹ Perfil' }));
    expect(router.state.location.pathname).toBe('/perfil');
  });
});
