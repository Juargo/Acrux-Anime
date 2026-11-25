// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
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

// The API as the browser sees it: only what each screen should ask for answers.
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
  if (url.pathname === '/api/v1/me/drama-marks') {
    return Response.json({
      items: [
        { dramaId: 1, status: 'seen', markedAt: '2026-11-20T12:00:00.000Z' },
        { dramaId: 2, status: 'seen', markedAt: '2026-11-20T12:00:00.000Z' },
        { dramaId: 3, status: 'watching', markedAt: '2026-11-20T12:00:00.000Z' },
      ],
      nextCursor: null,
    });
  }
  return Response.json({ items: [] });
}

beforeEach(() => {
  requested.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => api(input)),
  );
});
afterEach(() => {
  cleanup();
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
}

describe('the drama route', () => {
  it('shows dramas on /dramas and never asks for the anime catalog (S6)', async () => {
    renderAt('/dramas');

    expect(await screen.findByText('Crash Landing on You')).toBeTruthy();
    expect(screen.queryByText('Sousou no Frieren')).toBeNull();
    expect(requested.some((path) => path.startsWith('/api/v1/dramas'))).toBe(true);
    expect(requested.filter((path) => path.startsWith('/api/v1/catalog/'))).toEqual([]);
    expect(screen.getByRole('link', { name: 'TVmaze' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'MyAnimeList' })).toBeNull();
  });

  it('shows anime on /anime and never asks for dramas, with only the MyAnimeList credit (S6, S8)', async () => {
    renderAt('/anime');

    expect(await screen.findByText('Sousou no Frieren')).toBeTruthy();
    expect(screen.queryByText('Crash Landing on You')).toBeNull();
    expect(requested.filter((path) => path.startsWith('/api/v1/dramas'))).toEqual([]);
    expect(screen.getByRole('link', { name: 'MyAnimeList' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'TVmaze' })).toBeNull();
  });

  // S3: two separate numbers. Watching does not count as seen.
  it('counts the dramas seen at the top of /dramas, instead of the anime counter', async () => {
    renderAt('/dramas');
    await screen.findByText('Crash Landing on You');

    const counter = await screen.findByRole('region', { name: 'Contador de dramas' });
    await within(counter).findByText('2 dramas');
    expect(within(counter).getByText('vistos')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Contador total' })).toBeNull();
    expect(screen.queryByText(/animes?$/)).toBeNull();
    expect(requested.filter((path) => path.startsWith('/api/v1/me/marks'))).toEqual([]);
  });

  it('keeps the anime counter on /anime, which never asks for the drama marks', async () => {
    renderAt('/anime');
    await screen.findByText('Sousou no Frieren');

    const counter = screen.getByRole('region', { name: 'Contador total' });
    await within(counter).findByText('0 animes');
    expect(screen.queryByRole('region', { name: 'Contador de dramas' })).toBeNull();
    expect(requested.filter((path) => path.startsWith('/api/v1/me/drama-marks'))).toEqual([]);
  });

  it('keeps Explorar current in the navigation on both worlds (S2)', async () => {
    renderAt('/dramas');
    await screen.findByText('Crash Landing on You');
    expect(screen.getByRole('link', { name: 'Explorar' }).getAttribute('aria-current')).toBe(
      'page',
    );
    cleanup();

    renderAt('/anime');
    await screen.findByText('Sousou no Frieren');
    expect(screen.getByRole('link', { name: 'Explorar' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });
});
