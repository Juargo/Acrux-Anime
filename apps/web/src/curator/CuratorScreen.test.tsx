// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anime, fakeCatalogClient } from '../catalog-source/test-support';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';

// The curator screen (#42, RF-60): only the curator sees it; the API checks every save.
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
  shownTotal: 0,
  shownMode: 'franchise',
  cardShared: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
};

const existing = {
  animeId: 20811,
  franchiseRootId: 16498,
  role: 'extra',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const titles: Record<number, string> = {
  16498: 'Shingeki no Kyojin',
  20811: 'Shingeki no Kyojin: Kuinaki Sentaku',
  99147: 'Shingeki no Kyojin 3',
};

function fakeCatalog() {
  return fakeCatalogClient({
    byIds: async (ids) =>
      ids
        .filter((id) => id in titles)
        .map((id) => anime(id, { title: titles[id] ?? '', year: 2013, episodes: 25 })),
  });
}

function renderCurator(options: { curator: boolean; saveStatus?: number; path?: string }) {
  const saves: { url: string; body: unknown }[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/v1/franchise-overrides') return json({ items: [existing] });
    if (url.startsWith('/api/v1/franchise-overrides/') && init?.method === 'PUT') {
      const body = JSON.parse(init.body as string);
      saves.push({ url, body });
      if (options.saveStatus) return json({ status: options.saveStatus }, options.saveStatus);
      const animeId = Number(url.split('/').at(-1));
      return json({ animeId, ...body, updatedAt: '2026-11-07T12:00:00.000Z' });
    }
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: [], nextCursor: null });
    if (url === '/api/v1/me') return json({ ...base, curator: options.curator });
    throw new Error(`Unexpected request ${url}`);
  });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Home
            profile={{ ...base, curator: options.curator }}
            onSignOut={() => {}}
            signingOut={false}
            signOutFailed={false}
            getToken={async () => 'jwt'}
            client={fakeCatalog()}
            fetchFn={fetchFn as unknown as typeof fetch}
          />
        ),
        children: signedInRoutes,
      },
    ],
    { initialEntries: [options.path ?? '/curador'] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { saves, router };
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

describe('CuratorScreen', () => {
  it('tells a user without the role that the screen is for curators, with no form', async () => {
    renderCurator({ curator: false });
    await screen.findByText('Esta pantalla es solo para curadores.');
    expect(screen.queryByRole('button', { name: 'Guardar corrección' })).toBeNull();
  });

  it('lists the corrections with their catalog titles', async () => {
    renderCurator({ curator: true });
    const list = await screen.findByRole('list', { name: 'Correcciones' });
    await within(list).findByText('Shingeki no Kyojin: Kuinaki Sentaku');
    within(list).getByText(/Extra de Shingeki no Kyojin/);
  });

  it('saves a correction and links to the franchise to check it (RF-60)', async () => {
    const user = userEvent.setup();
    const { saves } = renderCurator({ curator: true });
    await screen.findByRole('list', { name: 'Correcciones' });

    await user.type(field('ID de MyAnimeList de la entrada'), '99147');
    await user.type(field('ID de MyAnimeList de la franquicia'), '16498');
    await user.click(screen.getByRole('radio', { name: /^Núcleo/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    await screen.findByText('Corrección guardada.');
    expect(saves).toEqual([
      {
        url: '/api/v1/franchise-overrides/99147',
        body: { franchiseRootId: 16498, role: 'core' },
      },
    ]);
    const link = screen.getByRole('link', { name: 'Ver la franquicia' });
    expect(link.getAttribute('href')).toBe('/franquicia/16498');
    const list = screen.getByRole('list', { name: 'Correcciones' });
    await within(list).findByText('Shingeki no Kyojin 3');
  });

  it('loads a correction into the form to change it', async () => {
    const user = userEvent.setup();
    renderCurator({ curator: true });
    const list = await screen.findByRole('list', { name: 'Correcciones' });
    await user.click(within(list).getByRole('button', { name: /Cambiar/ }));

    expect(field('ID de MyAnimeList de la entrada').value).toBe('20811');
    expect(field('ID de MyAnimeList de la franquicia').value).toBe('16498');
    expect((screen.getByRole('radio', { name: /^Extra/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('says so when the API refuses the role, and does not list the correction', async () => {
    const user = userEvent.setup();
    renderCurator({ curator: true, saveStatus: 403 });
    await screen.findByRole('list', { name: 'Correcciones' });

    await user.type(field('ID de MyAnimeList de la entrada'), '99147');
    await user.type(field('ID de MyAnimeList de la franquicia'), '16498');
    await user.click(screen.getByRole('radio', { name: /^Separada/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    await screen.findByText('Tu cuenta no tiene el rol de curador.');
    expect(screen.queryByText('Shingeki no Kyojin 3')).toBeNull();
  });

  it('shows the Curaduría row in Perfil only to curators', async () => {
    renderCurator({ curator: true, path: '/perfil' });
    expect((await screen.findByRole('link', { name: /Curaduría/ })).getAttribute('href')).toBe(
      '/curador',
    );
    cleanup();
    renderCurator({ curator: false, path: '/perfil' });
    await screen.findByRole('heading', { name: 'Perfil' });
    expect(screen.queryByRole('link', { name: /Curaduría/ })).toBeNull();
  });
});
