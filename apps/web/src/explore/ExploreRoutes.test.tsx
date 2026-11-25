// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';

const profile: Profile = {
  displayName: 'Camila',
  avatarUrl: null,
  avatarPreset: 'lavanda',
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
  handle: 'camila',
  shownTotal: null,
  shownMode: null,
  cardShared: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
};

const requested: string[] = [];

function api(input: RequestInfo | URL): Response {
  const url = new URL(String(input), 'http://localhost');
  requested.push(`${url.pathname}${url.search}`);
  if (url.pathname === '/api/v1/dramas') {
    return Response.json({
      items: [
        {
          id: 1,
          title: 'Crash Landing on You',
          coverUrl: null,
          origin: 'KR',
          year: 2019,
          seasons: null,
          episodes: null,
          genres: [],
        },
      ],
      nextPage: null,
    });
  }
  if (url.pathname === '/api/v1/catalog/anime') {
    return Response.json({
      items: [
        {
          id: 154587,
          title: 'Sousou no Frieren',
          titleEnglish: null,
          titleJapanese: null,
          coverUrl: null,
          format: 'TV',
          startDate: '2023-09-29',
          year: 2023,
          episodes: 28,
          durationMinutes: 24,
          genres: [],
          relations: [],
        },
      ],
      chain: [],
      related: [],
      nextPage: null,
    });
  }
  if (url.pathname === '/api/v1/catalog/franchise-years') return Response.json({ years: [] });
  return Response.json({ items: [] });
}

beforeEach(() => {
  requested.length = 0;
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => api(input)),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
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
          />
        ),
        children: signedInRoutes,
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('the map of worlds', () => {
  it('is where Explorar opens while no world was visited yet (S2)', async () => {
    const router = renderAt('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Elige un mundo' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/mundos');
    // The map asks for no catalog.
    expect(requested.filter((path) => path.startsWith('/api/v1/catalog/anime'))).toEqual([]);
    expect(requested.filter((path) => path.startsWith('/api/v1/dramas'))).toEqual([]);
  });

  it('has a door to Anime and one to Dramas, and shows Series as locked (S1)', async () => {
    renderAt('/mundos');
    await screen.findByRole('heading', { level: 1, name: 'Elige un mundo' });

    expect(screen.getByRole('link', { name: 'Entrar a Anime' }).getAttribute('href')).toBe(
      '/anime',
    );
    expect(screen.getByRole('link', { name: 'Entrar a Dramas' }).getAttribute('href')).toBe(
      '/dramas',
    );
    const series = screen.getByRole('heading', { level: 2, name: 'Series' }).closest('section');
    expect(series).not.toBeNull();
    expect(within(series as HTMLElement).getByText('Mundo bloqueado')).toBeTruthy();
    expect(within(series as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('keeps Explorar current in the navigation (S1)', async () => {
    renderAt('/mundos');
    await screen.findByRole('heading', { level: 1, name: 'Elige un mundo' });

    expect(screen.getByRole('link', { name: 'Explorar' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });
});

describe('the last world', () => {
  it('reopens Dramas after a visit to Dramas (S2)', async () => {
    renderAt('/dramas');
    await screen.findByText('Crash Landing on You');
    cleanup();

    const router = renderAt('/');

    expect(await screen.findByText('Crash Landing on You')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/dramas');
  });

  it('reopens Anime after a visit to Anime (S2)', async () => {
    renderAt('/anime');
    await screen.findByText('Sousou no Frieren');
    cleanup();

    const router = renderAt('/');

    expect(await screen.findByText('Sousou no Frieren')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/anime');
  });

  it('is the last one visited, not the first (S2)', async () => {
    renderAt('/dramas');
    await screen.findByText('Crash Landing on You');
    cleanup();
    renderAt('/anime');
    await screen.findByText('Sousou no Frieren');
    cleanup();

    const router = renderAt('/');

    await waitFor(() => expect(router.state.location.pathname).toBe('/anime'));
  });

  it('is not changed by a visit to the map (S2)', async () => {
    renderAt('/dramas');
    await screen.findByText('Crash Landing on You');
    cleanup();
    renderAt('/mundos');
    await screen.findByRole('heading', { level: 1, name: 'Elige un mundo' });
    cleanup();

    const router = renderAt('/');

    await waitFor(() => expect(router.state.location.pathname).toBe('/dramas'));
  });

  it('falls back to the map when what the device kept is not a world (S4)', async () => {
    window.localStorage.setItem('acrux.lastWorld', 'manga');

    const router = renderAt('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Elige un mundo' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/mundos');
  });

  it('falls back to the map when the device gives no storage (S4)', async () => {
    renderAt('/dramas');
    await screen.findByText('Crash Landing on You');
    cleanup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'acrux.lastWorld') throw new Error('denied');
      return null;
    });

    const router = renderAt('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Elige un mundo' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/mundos');
  });
});

describe('a world', () => {
  it('names Anime in its header and has the way back to the map (S5)', async () => {
    renderAt('/anime');
    await screen.findByText('Sousou no Frieren');

    expect(screen.getByRole('heading', { level: 1, name: 'Anime' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a los mundos' }).getAttribute('href')).toBe(
      '/mundos',
    );
    expect(screen.queryByRole('group', { name: 'Qué explorar' })).toBeNull();
  });

  it('names Dramas in its header and has the way back to the map (S5)', async () => {
    renderAt('/dramas');
    await screen.findByText('Crash Landing on You');

    expect(screen.getByRole('heading', { level: 1, name: 'Dramas' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a los mundos' }).getAttribute('href')).toBe(
      '/mundos',
    );
    expect(screen.queryByRole('group', { name: 'Qué explorar' })).toBeNull();
  });
});
