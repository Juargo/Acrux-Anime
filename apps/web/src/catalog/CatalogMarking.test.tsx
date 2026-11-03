// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_PAGE, type CatalogMedia, type RelatedMedia } from '../anilist/catalog';
import type { AniListClient } from '../anilist/client';
import { FRANCHISE_MEDIA } from '../anilist/franchise';
import { CatalogScreen } from './CatalogScreen';

afterEach(cleanup);

function node(id: number, year: number): RelatedMedia {
  return {
    id,
    idMal: id,
    type: 'ANIME',
    format: 'TV',
    isAdult: false,
    title: {
      romaji: id === 16498 ? 'Shingeki no Kyojin' : `Season ${id}`,
      english: null,
      native: null,
    },
    coverImage: { large: null },
    startDate: { year, month: 4, day: 1 },
  };
}

// Shingeki no Kyojin: three seasons in a chain; the catalog only sees the first two.
const years: Record<number, number> = { 16498: 2013, 20958: 2017, 99147: 2018, 18397: 2013 };
const relations: Record<number, [string, number][]> = {
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
const media = (id: number): CatalogMedia => ({
  ...node(id, years[id] ?? 2000),
  relations: {
    edges: (relations[id] ?? []).map(([relationType, target]) => ({
      relationType,
      node: node(target, years[target] ?? 2000),
    })),
  },
});

const anilist = {
  request: vi.fn(async (query: string, variables: Record<string, unknown>, schema) => {
    if (query === CATALOG_PAGE) {
      return schema.parse({ Page: { pageInfo: { hasNextPage: false }, media: [media(16498)] } });
    }
    expect(query).toBe(FRANCHISE_MEDIA);
    return schema.parse({ Page: { media: (variables.ids as number[]).map(media) } });
  }),
} as unknown as AniListClient;

const seen = (anilistId: number) => ({
  anilistId,
  malId: anilistId,
  status: 'seen',
  markedAt: '2026-01-01T00:00:00.000Z',
});

type Api = (path: string, init?: RequestInit) => Response | Promise<Response>;

function renderScreen(api: Api, onFranchiseMarked = vi.fn()) {
  const fetchFn = vi.fn(async (path: string, init?: RequestInit) => api(path, init));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CatalogScreen
        client={anilist}
        getToken={async () => 'jwt'}
        fetchFn={fetchFn as unknown as typeof fetch}
        onFranchiseMarked={onFranchiseMarked}
      />
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

const card = () => screen.findByRole('button', { name: 'Shingeki no Kyojin' });

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
      entries: [
        { anilistId: 16498, malId: 16498 },
        { anilistId: 20958, malId: 20958 },
        { anilistId: 99147, malId: 99147 },
      ],
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
      entries: [
        { anilistId: 16498, malId: 16498 },
        { anilistId: 20958, malId: 20958 },
        { anilistId: 99147, malId: 99147 },
        { anilistId: 18397, malId: 18397 },
      ],
    });
    expect((await card()).getAttribute('aria-pressed')).toBe('false');
    expect(onFranchiseMarked).toHaveBeenCalledWith({ status: null, coreSize: 3 });
  });

  it('shows the catalog without marking when there is no session', async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <CatalogScreen client={anilist} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Shingeki no Kyojin')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Shingeki no Kyojin' })).toBeNull();
  });
});
