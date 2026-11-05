// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogMedia, RelatedMedia } from '../anilist/catalog';
import type { AniListClient } from '../anilist/client';
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
const edges: Record<number, [string, number][]> = { 1: [['SEQUEL', 2]], 2: [['PREQUEL', 1]] };

function node(id: number): RelatedMedia {
  return {
    id,
    idMal: null,
    type: 'ANIME',
    format: id < 20 ? 'TV' : 'MOVIE',
    isAdult: false,
    title: { romaji: titles[id] ?? `Media ${id}`, english: null, native: null },
    coverImage: { large: `https://s4.anilist.co/media/${id}.jpg` },
    startDate: { year: 2000 + id, month: 1, day: 1 },
  };
}

const media = (id: number): CatalogMedia => ({
  ...node(id),
  relations: {
    edges: (edges[id] ?? []).map(([relationType, target]) => ({
      relationType,
      node: node(target),
    })),
  },
});

const client = {
  request: vi.fn(async (_query: string, variables: Record<string, unknown>, schema) =>
    schema.parse({
      Page: { media: (variables.ids as number[]).filter((id) => id in titles).map(media) },
    }),
  ),
} as unknown as AniListClient;

const mark = (anilistId: number, status: MarkDto['status'], day = 10): MarkDto => ({
  anilistId,
  malId: null,
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
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { fetchFn, onViewed };
}

const section = (name: string) => screen.getByRole('region', { name });
const coverTitles = (name: string) =>
  [...section(name).querySelectorAll('img')].map((img) => img.getAttribute('alt'));

describe('PublicProfileScreen', () => {
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
});
