// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogMedia, RelatedMedia } from '../anilist/catalog';
import type { AniListClient } from '../anilist/client';
import { FRANCHISE_MEDIA } from '../anilist/franchise';
import type { MarkDto } from '../marks-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';

afterEach(cleanup);

// Saga A: seasons 1 → 2 → 3 → 4. Saga B: the movie 20.
const years: Record<number, number> = { 1: 2013, 2: 2017, 3: 2019, 4: 2020, 20: 2016 };
const titles: Record<number, string> = { 1: 'Saga A', 20: 'Saga B' };
const edges: Record<number, [string, number][]> = {
  1: [['SEQUEL', 2]],
  2: [
    ['PREQUEL', 1],
    ['SEQUEL', 3],
  ],
  3: [
    ['PREQUEL', 2],
    ['SEQUEL', 4],
  ],
  4: [['PREQUEL', 3]],
};
const cover = (id: number) => `https://img.anili.st/media/${id}.jpg`;

function node(id: number): RelatedMedia {
  return {
    id,
    idMal: null,
    type: 'ANIME',
    format: id === 20 ? 'MOVIE' : 'TV',
    isAdult: false,
    title: { romaji: titles[id] ?? `Season ${id}`, english: null, native: null },
    coverImage: { large: cover(id) },
    startDate: { year: years[id] ?? 2000, month: 1, day: 1 },
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

function fakeAniList() {
  const request = vi.fn(async (query: string, variables: Record<string, unknown>, schema) => {
    expect(query).toBe(FRANCHISE_MEDIA);
    const ids = (variables.ids as number[]).filter((id) => id in years);
    return schema.parse({ Page: { media: ids.map(media) } });
  });
  return { client: { request } as unknown as AniListClient, request };
}

const mark = (anilistId: number, status: MarkDto['status'], day = 10): MarkDto => ({
  anilistId,
  malId: null,
  status,
  markedAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function renderList(marks: MarkDto[] | 'fail') {
  const { client, request } = fakeAniList();
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/v1/me/marks?')) {
      return marks === 'fail'
        ? json({ status: 503, code: 'marks.unavailable' }, 503)
        : json({ items: marks, nextCursor: null });
    }
    if (url === '/api/v1/me' && init?.method === 'PATCH') {
      return json({ ...profile, counterMode: JSON.parse(init.body as string).counterMode });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const profile = {
    displayName: 'Camila',
    avatarUrl: null,
    avatarPreset: null,
    locale: 'es',
    listVisibility: 'private' as const,
    counterMode: 'franchise' as const,
    handle: 'camila',
    shownTotal: null,
    shownMode: null,
    cardShared: false,
  };
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
            client={client}
            fetchFn={fetchFn as unknown as typeof fetch}
          />
        ),
        children: signedInRoutes,
      },
    ],
    { initialEntries: ['/mi-lista'] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { request };
}

const list = () => screen.getByRole('region', { name: 'Mi lista' });
const rowTitles = (panel: HTMLElement) =>
  within(panel)
    .queryAllByRole('link')
    .map((link) => link.querySelector('.list-row__title')?.textContent)
    .filter(Boolean);

describe('MyListScreen', () => {
  it('@CA-RF27-01 shows the 2 franchises marked as watching, with their covers', async () => {
    const user = userEvent.setup();
    renderList([mark(1, 'seen', 2), mark(2, 'watching', 5), mark(20, 'watching', 7)]);

    await user.click(await within(list()).findByRole('tab', { name: 'Viendo (2)' }));

    const panel = within(list()).getByRole('tabpanel');
    expect(rowTitles(panel)).toEqual(['Saga B', 'Saga A']);
    const covers = [...panel.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(covers).toEqual([cover(20), cover(1)]);
    expect(within(panel).getByText('0 de 1 · marcada el 7 de oct.')).toBeTruthy();
    expect(
      within(panel)
        .getByRole('link', { name: /Saga A/ })
        .getAttribute('href'),
    ).toBe('/franquicia/1');
  });

  it('lists in Vistas what the counter counts, in either mode, from one crawl (RNF-42)', async () => {
    const user = userEvent.setup();
    const { request } = renderList([
      ...[1, 2, 3, 4].map((id) => mark(id, 'seen', 2)),
      mark(20, 'seen', 12),
    ]);
    const counter = screen.getByRole('region', { name: 'Contador total' });

    expect(await within(list()).findByRole('tab', { name: 'Vistas (2)' })).toBeTruthy();
    expect(within(counter).getByText('2 animes')).toBeTruthy();
    expect(rowTitles(within(list()).getByRole('tabpanel'))).toEqual(['Saga B', 'Saga A']);
    const figures = [...list().querySelectorAll('.my-list__stats div')].map((figure) => [
      figure.querySelector('dt')?.textContent,
      figure.querySelector('dd')?.textContent,
    ]);
    expect(figures).toEqual([
      ['animes completos', '2'],
      ['entradas vistas', '5'],
      ['viendo ahora', '0'],
    ]);

    await user.click(within(counter).getByRole('button', { name: 'Entradas' }));

    expect(await within(list()).findByRole('tab', { name: 'Vistas (5)' })).toBeTruthy();
    expect(within(counter).getByText('5 animes')).toBeTruthy();
    const asked = request.mock.calls.flatMap(([, variables]) => variables.ids as number[]);
    expect(asked.length).toBe(new Set(asked).size);
  });

  it('shows the empty states of Figma M13 with a way back to the catalog', async () => {
    const user = userEvent.setup();
    renderList([]);

    const seenTab = await within(list()).findByRole('tab', { name: 'Vistas (0)' });
    expect(seenTab.getAttribute('aria-selected')).toBe('true');
    expect(within(list()).getByText('Aún no marcaste nada como visto.')).toBeTruthy();

    await user.click(within(list()).getByRole('tab', { name: 'Viendo (0)' }));

    expect(within(list()).getByText('Aún no estás viendo nada')).toBeTruthy();
    expect(
      within(list()).getByText('Marca una saga como "Viendo" y aparecerá en tu tarjeta.'),
    ).toBeTruthy();
    expect(
      within(list()).getByRole('link', { name: 'Explorar el catálogo' }).getAttribute('href'),
    ).toBe('/');
  });

  it('says so when the marks cannot load', async () => {
    renderList('fail');
    const alert = await within(list()).findByRole('alert');
    expect(alert.textContent).toContain('No pudimos cargar tu lista. Vuelve a intentarlo.');
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('reaches the list from the bar with Explorar, Mi lista, Tarjeta and Perfil (S5, #36, #39)', async () => {
    renderList([]);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Explorar', '/'],
      ['Mi lista', '/mi-lista'],
      ['Tarjeta', '/tarjeta'],
      ['Perfil', '/perfil'],
    ]);
    expect(within(nav).getByRole('link', { name: 'Mi lista' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });
});
