// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type CatalogAnime, CatalogError } from '../catalog-source/client';
import { anime, fakeCatalogClient } from '../catalog-source/test-support';
import { setLocale } from '../i18n';
import type { MarkDto } from '../marks-api';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';

// Advanced stats (RF-53, epic #50): Plus sees everything; a free user sees hours and
// episodes, and the rest blurred behind "Ver Acrux Plus".
afterEach(async () => {
  cleanup();
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
  shownTotal: 3,
  shownMode: 'franchise',
  cardShared: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
  plan: 'free',
  plusAvailable: true,
};
const plus: Profile = { ...free, plan: 'plus' };

const mark = (animeId: number, status: MarkDto['status'] = 'seen'): MarkDto => ({
  animeId,
  status,
  markedAt: '2026-10-10T12:00:00.000Z',
});

const stat = (
  id: number,
  format: string,
  year: number,
  episodes: number | null,
  durationMinutes: number,
  genres: string[],
) => anime(id, { format, year, episodes, durationMinutes, genres });

const catalog: Record<number, CatalogAnime> = {
  1: stat(1, 'TV', 2014, 24, 24, ['Action', 'Drama']),
  2: stat(2, 'MOVIE', 2016, 1, 120, ['Drama']),
  3: stat(3, 'TV', 1998, null, 24, ['Comedy']),
  4: stat(4, 'TV', 2020, 12, 24, ['Romance']),
};

function renderStats(
  options: { profile?: Profile; marks?: MarkDto[]; catalogFails?: boolean } = {},
) {
  const profile = options.profile ?? free;
  const marks = options.marks ?? [mark(1), mark(2), mark(3), mark(4, 'watching')];
  const asked: number[][] = [];
  let fail = options.catalogFails ?? false;
  const client = fakeCatalogClient({
    byIds: async (ids) => {
      if (fail) {
        fail = false;
        throw new CatalogError('unavailable', 'down');
      }
      asked.push([...ids]);
      return ids.flatMap((id) => catalog[id] ?? []);
    },
  });
  const fetchFn = vi.fn(async (url: string) => {
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: marks, nextCursor: null });
    if (url === '/api/v1/me') return json(profile);
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
    { initialEntries: ['/perfil/estadisticas'] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { asked, router };
}

const statsPage = () => screen.findByRole('region', { name: 'Estadísticas' });

describe('StatsScreen (RF-53)', () => {
  it('@CA-RF53-01 shows a Plus user hours, episodes, genres, decades and formats of seen titles', async () => {
    const { asked } = renderStats({ profile: plus });
    const page = await statsPage();

    // 24×24 + 120 = 696 minutes, about 12 hours; 25 episodes in 3 seen titles.
    expect(await within(page).findByText('12')).toBeTruthy();
    expect(within(page).getByText('25')).toBeTruthy();
    expect(within(page).getByText('3')).toBeTruthy();
    expect(within(page).getByText('1 título sin duración conocida no suma tiempo.')).toBeTruthy();
    const genres = within(page).getByRole('list', { name: 'Géneros favoritos' });
    expect(
      within(genres)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Drama67 %', 'Acción33 %', 'Comedia33 %']);
    const decades = within(page).getByRole('list', { name: 'Por década de estreno' });
    expect(
      within(decades)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Años 19901', 'Años 20102']);
    const formats = within(page).getByRole('list', { name: 'Por formato' });
    expect(
      within(formats)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['TV2', 'Película1']);
    expect(within(page).queryByRole('link', { name: 'Ver Acrux Plus' })).toBeNull();
    // Watching titles are not asked for: only seen ones count.
    expect(asked).toEqual([[1, 2, 3]]);
  });

  it('@CA-RF53-02 shows a free user their hours and locks the rest behind Plus', async () => {
    renderStats();
    const page = await statsPage();

    expect(await within(page).findByText('12')).toBeTruthy();
    expect(within(page).getByText('25')).toBeTruthy();
    const locked = within(page).getByRole('region', {
      name: 'Géneros, décadas y formatos son de Plus',
    });
    expect(within(locked).queryByRole('list')).toBeNull();
    const cta = within(locked).getByRole('link', { name: 'Ver Acrux Plus' });
    expect(cta.getAttribute('href')).toBe('/perfil/plus');
  });

  it('says Plus arrives soon when billing is off', async () => {
    renderStats({ profile: { ...free, plusAvailable: false } });
    const page = await statsPage();

    expect(await within(page).findByText('Acrux Plus llega pronto.')).toBeTruthy();
    expect(within(page).queryByRole('link', { name: 'Ver Acrux Plus' })).toBeNull();
  });

  it('invites to mark titles when nothing is seen yet', async () => {
    const { asked } = renderStats({ profile: plus, marks: [mark(4, 'watching')] });
    const page = await statsPage();

    expect(
      await within(page).findByText('Marca animes como vistos para ver tus estadísticas.'),
    ).toBeTruthy();
    expect(asked).toEqual([]);
  });

  it('explains a catalog failure and retries on demand', async () => {
    renderStats({ profile: plus, catalogFails: true });
    const page = await statsPage();

    expect(await within(page).findByRole('alert')).toBeTruthy();
    await userEvent.click(within(page).getByRole('button', { name: 'Reintentar' }));
    expect(await within(page).findByText('12')).toBeTruthy();
  });

  it('is reachable from Perfil', async () => {
    const { router } = renderStats();
    await router.navigate('/perfil');
    const link = await screen.findByRole('link', { name: /Estadísticas/ });
    expect(link.getAttribute('href')).toBe('/perfil/estadisticas');
  });
});
