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

const catalogRequests = () =>
  requested
    .filter((path) => path.startsWith('/api/v1/catalog/anime'))
    .map((path) => decodeURIComponent(path));
const dramaRequests = () => requested.filter((path) => path.startsWith('/api/v1/dramas?'));

describe('the doors by level', () => {
  it('has one door per era on the map, in order, each into the Anime world (S6)', async () => {
    renderAt('/mundos');
    await screen.findByRole('heading', { level: 1, name: 'Elige un mundo' });

    const anime = screen.getByRole('heading', { level: 2, name: 'Anime' }).closest('section');
    const doors = within(anime as HTMLElement)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.includes('era='));
    expect(
      doors.map((door) => [door.getAttribute('aria-label'), door.getAttribute('href')]),
    ).toEqual([
      ['Pioneros, 1917–1959', '/anime?era=pioneers'],
      ['Era Tezuka, 1960–1979', '/anime?era=tezuka'],
      ['Boom OVA, 1980–1994', '/anime?era=ovaBoom'],
      ['Edad de oro, 1995–2005', '/anime?era=goldenAge'],
      ['Era digital, 2006–2014', '/anime?era=digital'],
      ['Streaming, 2015–hoy', '/anime?era=streaming'],
    ]);
  });

  it('has one door per country on the map, each into the Dramas world (S6)', async () => {
    renderAt('/mundos');
    await screen.findByRole('heading', { level: 1, name: 'Elige un mundo' });

    const dramas = screen.getByRole('heading', { level: 2, name: 'Dramas' }).closest('section');
    const doors = within(dramas as HTMLElement)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.includes('origin='));
    expect(doors.map((door) => [door.textContent, door.getAttribute('href')])).toEqual([
      ['CoreaK-drama', '/dramas?origin=KR'],
      ['ChinaC-drama', '/dramas?origin=CN'],
      ['JapónJ-drama', '/dramas?origin=JP'],
    ]);
  });

  it('opens the Anime world on the years of the era of its door (S6)', async () => {
    renderAt('/anime?era=goldenAge');
    await screen.findByText('Sousou no Frieren');

    expect(catalogRequests().at(-1)).toContain(
      'years=1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005',
    );
    // The stop of the era is taken, and its years are in view as the whole era.
    expect(
      screen.getByRole('button', { name: 'Edad de oro, 1995–2005' }).getAttribute('aria-pressed'),
    ).toBe('true');
    const years = within(screen.getByRole('region', { name: 'Edad de oro' }));
    expect(years.getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the Anime world on every year without a door, or with an unknown one', async () => {
    for (const path of ['/anime', '/anime?era=manga']) {
      requested.length = 0;
      renderAt(path);
      await screen.findByText('Sousou no Frieren');

      expect(catalogRequests().length).toBeGreaterThan(0);
      expect(catalogRequests().filter((request) => request.includes('years='))).toEqual([]);
      cleanup();
    }
  });

  it('opens the Dramas world on the country of its door (S6)', async () => {
    renderAt('/dramas?origin=KR');
    await screen.findByText('Crash Landing on You');

    expect(dramaRequests().at(-1)).toContain('origin=KR');
    expect(screen.getByRole('button', { name: 'País · 1' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('opens the Dramas world on every country without a door, or with an unknown one', async () => {
    for (const path of ['/dramas', '/dramas?origin=AR']) {
      requested.length = 0;
      renderAt(path);
      await screen.findByText('Crash Landing on You');

      expect(dramaRequests().length).toBeGreaterThan(0);
      expect(dramaRequests().filter((request) => request.includes('origin='))).toEqual([]);
      cleanup();
    }
  });
});
