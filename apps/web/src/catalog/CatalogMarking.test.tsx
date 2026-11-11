// @vitest-environment jsdom

import type { RelationType } from '@acrux/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogAnime } from '../catalog-source/client';
import { anime, fakeCatalogClient, serveFranchises } from '../catalog-source/test-support';
import { CatalogScreen } from './CatalogScreen';

afterEach(cleanup);

// Shingeki no Kyojin: three seasons in a chain; the catalog page only holds the first one.
const years: Record<number, number> = {
  16498: 2013,
  20958: 2017,
  99147: 2018,
  18397: 2013,
  5114: 2009,
};
const relations: Record<number, [RelationType, number][]> = {
  16498: [
    ['SEQUEL', 20958],
    ['SIDE_STORY', 18397],
  ],
  20958: [
    ['PREQUEL', 16498],
    ['SEQUEL', 99147],
  ],
  99147: [['PREQUEL', 20958]],
  18397: [['PARENT', 16498]],
};
const row = (id: number): CatalogAnime | undefined =>
  id in years
    ? anime(id, {
        title: id === 16498 ? 'Shingeki no Kyojin' : `Season ${id}`,
        coverUrl: null,
        startDate: `${years[id]}-04-01`,
        year: years[id] ?? null,
        relations: (relations[id] ?? []).map(([type, target]) => ({ type, id: target })),
      })
    : undefined;

// A catalog page with these hits, and the neighbours they point at.
function page(...ids: number[]) {
  const items = ids.map((id) => row(id) as CatalogAnime);
  const related = items
    .flatMap((item) => item.relations.map((relation) => relation.id))
    .filter((id) => !ids.includes(id))
    .map((id) => row(id) as CatalogAnime);
  return { items, related, nextPage: null };
}

const catalogOf = (...ids: number[]) =>
  fakeCatalogClient({
    browse: async () => page(...ids),
    franchises: async (seeds) => serveFranchises(row, seeds),
  });
const catalog = catalogOf(16498);

const seen = (animeId: number) => ({
  animeId,
  status: 'seen',
  markedAt: '2026-01-01T00:00:00.000Z',
});

type Api = (path: string, init?: RequestInit) => Response | Promise<Response>;

function renderScreen(api: Api, onFranchiseMarked = vi.fn()) {
  const fetchFn = vi.fn(async (path: string, init?: RequestInit) => api(path, init));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CatalogScreen
          client={catalog}
          getToken={async () => 'jwt'}
          fetchFn={fetchFn as unknown as typeof fetch}
          onFranchiseMarked={onFranchiseMarked}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { fetchFn, onFranchiseMarked };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const batchBodies = (fetchFn: ReturnType<typeof vi.fn>) =>
  fetchFn.mock.calls
    .filter(([path]) => path === '/api/v1/me/marks:batch')
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));

// The ✓ button over the cover: «Marcar … como vista», then «Quitar … de vistas».
const card = () => screen.findByRole('button', { name: /«Shingeki no Kyojin»/ });

describe('marking from the catalog', () => {
  it('@CA-RF20-01 one tap marks the whole core as seen and dims the franchise', async () => {
    let save: (response: Response) => void = () => {};
    const { fetchFn, onFranchiseMarked } = renderScreen((_path, init) => {
      if (init?.method === 'POST') {
        return new Promise<Response>((resolve) => {
          save = resolve;
        });
      }
      return json({ items: [], nextCursor: null });
    });

    await userEvent.click(await card());

    // Optimistic: dimmed before the API answers (RNF-11).
    expect((await card()).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(batchBodies(fetchFn)).toHaveLength(1));
    expect(batchBodies(fetchFn)[0]).toEqual({
      status: 'seen',
      entries: [{ animeId: 16498 }, { animeId: 20958 }, { animeId: 99147 }],
    });
    save(json({ items: [seen(16498), seen(20958), seen(99147)] }));

    await waitFor(() =>
      expect(onFranchiseMarked).toHaveBeenCalledWith({ status: 'seen', coreSize: 3 }),
    );
    expect((await card()).getAttribute('aria-pressed')).toBe('true');
    expect((await card()).closest('li')?.className).toContain('catalog-card--seen');
  });

  it('@CA-RF20-02 says it could not save and rolls back when the API does not answer', async () => {
    const { onFranchiseMarked } = renderScreen((_path, init) => {
      if (init?.method === 'POST') throw new TypeError('Failed to fetch');
      return json({ items: [], nextCursor: null });
    });

    await userEvent.click(await card());

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos guardar');
    expect((await card()).getAttribute('aria-pressed')).toBe('false');
    expect(onFranchiseMarked).not.toHaveBeenCalled();
  });

  it('a second tap unmarks the core and the extras of a seen franchise', async () => {
    const { fetchFn, onFranchiseMarked } = renderScreen((_path, init) =>
      init?.method === 'POST'
        ? json({ items: [] })
        : json({ items: [seen(16498), seen(20958), seen(99147)], nextCursor: null }),
    );
    await waitFor(async () => expect((await card()).getAttribute('aria-pressed')).toBe('true'));

    await userEvent.click(await card());

    expect((await screen.findByRole('status')).textContent).toBe(
      'Quitaste «Shingeki no Kyojin» de tus vistas.',
    );
    expect(batchBodies(fetchFn)[0]).toEqual({
      status: null,
      entries: [{ animeId: 16498 }, { animeId: 20958 }, { animeId: 99147 }, { animeId: 18397 }],
    });
    expect((await card()).getAttribute('aria-pressed')).toBe('false');
    expect(onFranchiseMarked).toHaveBeenCalledWith({ status: null, coreSize: 3 });
  });

  it('a failed tap rolls back only its own franchise, not another one saved meanwhile', async () => {
    const twoSagas = catalogOf(16498, 5114);
    let failFirst: (error: Error) => void = () => {};
    const fetchFn = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return json({ items: [], nextCursor: null });
      const body = JSON.parse(init.body as string) as { entries: { animeId: number }[] };
      if (body.entries[0]?.animeId === 16498) {
        return new Promise<Response>((_resolve, reject) => {
          failFirst = reject;
        });
      }
      return json({ items: [seen(5114)] });
    });
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <CatalogScreen
            client={twoSagas}
            getToken={async () => 'jwt'}
            fetchFn={fetchFn as unknown as typeof fetch}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.click(await card());
    await waitFor(() =>
      expect(fetchFn.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    );
    const other = await screen.findByRole('button', { name: /«Season 5114»/ });
    await userEvent.click(other);
    await waitFor(() => expect(other.getAttribute('aria-pressed')).toBe('true'));
    failFirst(new TypeError('Failed to fetch'));

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos guardar');
    expect((await card()).getAttribute('aria-pressed')).toBe('false');
    expect(
      (await screen.findByRole('button', { name: /«Season 5114»/ })).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('shows the catalog without marking when there is no session', async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CatalogScreen client={catalog} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('link', { name: 'Shingeki no Kyojin' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Shingeki no Kyojin/ })).toBeNull();
  });
});
