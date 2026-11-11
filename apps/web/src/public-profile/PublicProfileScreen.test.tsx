// @vitest-environment jsdom

import type { RelationType } from '@acrux/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsProvider } from '../analytics/AnalyticsContext';
import { type Analytics, createAnalytics, type PostHogLike } from '../analytics/analytics';
import type { CatalogAnime } from '../catalog-source/client';
import { anime, fakeCatalogClient, serveFranchises } from '../catalog-source/test-support';
import { setLocale } from '../i18n';
import type { MarkDto } from '../marks-api';
import type { PublicProfile } from './api';
import { publicProfileRoute } from './routes';

afterEach(cleanup);

// Saga A: seasons 1 → 2. Sagas B to D: one movie each.
const titles: Record<number, string> = {
  1: 'Saga A',
  2: 'Saga A 2',
  20: 'Saga B',
  30: 'Saga C',
  40: 'Saga D',
};
const edges: Record<number, [RelationType, number][]> = { 1: [['SEQUEL', 2]], 2: [['PREQUEL', 1]] };

const row = (id: number): CatalogAnime | undefined =>
  id in titles
    ? anime(id, {
        title: titles[id] ?? `Media ${id}`,
        format: id < 20 ? 'TV' : 'MOVIE',
        coverUrl: `https://cdn.example.test/anime/${id}.jpg`,
        startDate: `${2000 + id}-01-01`,
        year: 2000 + id,
        relations: (edges[id] ?? []).map(([type, target]) => ({ type, id: target })),
      })
    : undefined;

const client = fakeCatalogClient({ franchises: async (seeds) => serveFranchises(row, seeds) });

const mark = (animeId: number, status: MarkDto['status'], day = 10): MarkDto => ({
  animeId,
  status,
  markedAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const camila: PublicProfile = {
  handle: 'camila',
  displayName: 'Camila',
  avatarUrl: 'https://lh3.googleusercontent.com/a/camila',
  avatarPreset: null,
  listVisibility: 'public',
  shownTotal: 48,
  shownMode: 'franchise',
};

function renderProfile(
  path: string,
  profile: PublicProfile | 'missing' | 'fail',
  marks: MarkDto[] = [],
  analytics?: Analytics,
) {
  const fetchFn = vi.fn(async (url: string) => {
    if (profile === 'fail') return json({ status: 503 }, 503);
    if (profile === 'missing') return json({ status: 404, code: 'profiles.not_found' }, 404);
    if (url === `/api/v1/profiles/${profile.handle}`) return json(profile);
    if (url.startsWith(`/api/v1/profiles/${profile.handle}/marks?`)) {
      return profile.listVisibility === 'public'
        ? json({ items: marks, nextCursor: null })
        : json({ status: 404, code: 'profiles.not_found' }, 404);
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const onViewed = vi.fn();
  const router = createMemoryRouter(
    [publicProfileRoute({ client, fetchFn: fetchFn as unknown as typeof fetch, onViewed })],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  render(analytics ? <AnalyticsProvider analytics={analytics}>{tree}</AnalyticsProvider> : tree);
  return { fetchFn, onViewed };
}

const section = (name: string) => screen.getByRole('region', { name });
const coverTitles = (name: string) =>
  [...section(name).querySelectorAll('img')].map((img) => img.getAttribute('alt'));

describe('PublicProfileScreen', () => {
  it('credits MyAnimeList with a link (ADR-0043)', async () => {
    renderProfile('/@camila', camila);
    expect((await screen.findByRole('link', { name: 'MyAnimeList' })).getAttribute('href')).toBe(
      'https://myanimelist.net',
    );
  });

  it('@CA-RF55-02 shows the badges the API returns for a Plus owner', async () => {
    renderProfile('/@camila', { ...camila, badges: ['titles_10', 'hours_50'] });
    const badges = await screen.findByRole('list', { name: 'Insignias' });
    expect(
      within(badges)
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual(['10 títulos vistos', '50 horas vistas']);
  });

  it('shows no badges when the API returns none', async () => {
    renderProfile('/@camila', { ...camila, badges: [] });
    await screen.findByRole('heading', { name: 'Camila' });
    expect(screen.queryByRole('list', { name: 'Insignias' })).toBeNull();
  });

  it('@CA-RF40-01 shows the counter, what is being watched and the recent sagas of a public list', async () => {
    const { onViewed } = renderProfile('/@camila', camila, [
      mark(1, 'seen', 3),
      mark(2, 'seen', 4),
      mark(20, 'watching', 6),
      mark(30, 'seen', 8),
      mark(40, 'watching', 9),
    ]);

    expect(await screen.findByRole('heading', { name: 'Camila' })).toBeTruthy();
    screen.getByText('@camila');
    screen.getByText('48');
    screen.getByText('ANIMES COMPLETOS');
    expect(screen.getByRole('img', { name: 'Camila' }).getAttribute('src')).toBe(
      'https://lh3.googleusercontent.com/a/camila',
    );
    await screen.findByRole('region', { name: 'VIENDO AHORA' });
    expect(coverTitles('VIENDO AHORA')).toEqual(['Saga D', 'Saga B']);
    expect(coverTitles('SAGAS MÁS RECIENTES')).toEqual(['Saga C', 'Saga A']);
    expect(screen.getByRole('link', { name: 'Crea tu tarjeta gratis' }).getAttribute('href')).toBe(
      '/',
    );
    expect(screen.getByRole('link', { name: 'Crear mi tarjeta' }).getAttribute('href')).toBe('/');
    expect(onViewed).toHaveBeenCalledWith({ listVisibility: 'public' });
    expect(document.title).toBe('Camila (@camila) · Acrux');
  });

  it('@CA-RF42-01 shows only the summary of a private list and never asks for it', async () => {
    const { fetchFn, onViewed } = renderProfile('/@nami', {
      handle: 'nami',
      displayName: 'Nami',
      avatarUrl: null,
      avatarPreset: null,
      listVisibility: 'private',
      shownTotal: 7,
      shownMode: 'entry',
    });

    expect(await screen.findByRole('heading', { name: 'Nami' })).toBeTruthy();
    screen.getByText('7');
    screen.getByText('ENTRADAS VISTAS');
    screen.getByText('Nami mantiene su lista privada');
    screen.getByText('Solo se muestra su total.');
    expect(screen.queryByRole('region', { name: 'VIENDO AHORA' })).toBeNull();
    expect(fetchFn.mock.calls.map((call) => call[0])).toEqual(['/api/v1/profiles/nami']);
    expect(onViewed).toHaveBeenCalledWith({ listVisibility: 'private' });
  });

  it.each([
    ['an unknown handle', '/@nadie_aqui'],
    ['a path without @', '/camila'],
    ['an invalid handle', '/@Camila'],
  ])('shows "Perfil no disponible" for %s', async (_case, path) => {
    const { onViewed } = renderProfile(path, 'missing');
    expect(await screen.findByRole('heading', { name: 'Perfil no disponible' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Crea tu tarjeta gratis' })).toBeTruthy();
    expect(onViewed).not.toHaveBeenCalled();
  });

  it('hides the counter until the owner has one', async () => {
    renderProfile('/@camila', { ...camila, shownTotal: null, shownMode: null });
    await screen.findByRole('heading', { name: 'Camila' });
    expect(screen.queryByText('ANIMES COMPLETOS')).toBeNull();
  });

  it('says when nothing is being watched or seen yet', async () => {
    renderProfile('/@camila', camila, []);
    expect(
      within(await screen.findByRole('region', { name: 'VIENDO AHORA' })).getByText(
        'Camila no está viendo nada ahora.',
      ),
    ).toBeTruthy();
    within(section('SAGAS MÁS RECIENTES')).getByText('Aún no completó ninguna saga.');
  });

  it('offers a retry when the profile cannot be loaded', async () => {
    const user = userEvent.setup();
    const { fetchFn } = renderProfile('/@camila', 'fail');
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No pudimos cargar este perfil. Vuelve a intentarlo.',
    );
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('counts the visit once the visitor accepts analytics on this page (#46)', async () => {
    window.localStorage.clear();
    const analytics = createAnalytics({
      key: 'phc_test',
      storage: window.localStorage,
      load: async () =>
        ({
          init() {},
          capture() {},
          identify() {},
          reset() {},
          opt_in_capturing() {},
          opt_out_capturing() {},
        }) as unknown as PostHogLike,
      clearCookies: () => {},
    });
    const { onViewed } = renderProfile('/@camila', camila, [], analytics);
    await screen.findByRole('heading', { name: 'Camila' });
    expect(onViewed).not.toHaveBeenCalled();

    act(() => analytics.grant());
    await vi.waitFor(() => expect(onViewed).toHaveBeenCalledWith({ listVisibility: 'public' }));
    act(() => analytics.deny());
    act(() => analytics.grant());
    expect(onViewed).toHaveBeenCalledOnce();
    window.localStorage.clear();
  });
});

describe('PublicProfileScreen in English (#43)', () => {
  afterEach(() => setLocale('es'));

  it('shows a private profile, its title and the call to action in English', async () => {
    await setLocale('en');
    renderProfile('/@nami', {
      handle: 'nami',
      displayName: ' ',
      avatarUrl: null,
      avatarPreset: null,
      listVisibility: 'private',
      shownTotal: 7,
      shownMode: 'entry',
    });
    await screen.findByRole('heading', { name: 'No name' });
    screen.getByText('ENTRIES WATCHED');
    screen.getByText('This user keeps their list private');
    screen.getByText('Only their total is shown.');
    screen.getByRole('link', { name: 'Create your card for free' });
    screen.getByRole('link', { name: 'Create my card' });
    expect(document.title).toBe('No name (@nami) · Acrux');
    expect(screen.queryByText('Solo se muestra su total.')).toBeNull();
  });

  it('says the profile is not available in English', async () => {
    await setLocale('en');
    renderProfile('/@nadie_aqui', 'missing');
    await screen.findByRole('heading', { name: 'Profile not available' });
    screen.getByText('This link does not exist or is no longer available.');
  });
});
