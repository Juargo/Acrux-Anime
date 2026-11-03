// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogMedia, RelatedMedia } from '../anilist/catalog';
import type { AniListClient } from '../anilist/client';
import { FRANCHISE_MEDIA } from '../anilist/franchise';
import { MARKS_KEY } from '../catalog/use-franchise-marks';
import type { MarkDto } from '../marks-api';
import { fetchMe, type Profile } from '../profile-api';
import { type CounterModeChangedEvent, TotalCounter } from './TotalCounter';

afterEach(cleanup);

// Saga A: four seasons 1 → 2 → 3 → 4 and an OVA side story 9. Saga B: one movie, 20.
const years: Record<number, number> = { 1: 2013, 2: 2017, 3: 2019, 4: 2020, 9: 2014, 20: 2016 };
const edges: Record<number, [string, number][]> = {
  1: [
    ['SEQUEL', 2],
    ['SIDE_STORY', 9],
  ],
  2: [
    ['PREQUEL', 1],
    ['SEQUEL', 3],
  ],
  3: [
    ['PREQUEL', 2],
    ['SEQUEL', 4],
  ],
  4: [['PREQUEL', 3]],
  9: [['PARENT', 1]],
};

function node(id: number): RelatedMedia {
  return {
    id,
    idMal: id + 1000,
    type: 'ANIME',
    format: id === 9 ? 'OVA' : id === 20 ? 'MOVIE' : 'TV',
    isAdult: false,
    title: { romaji: `Entry ${id}`, english: null, native: null },
    coverImage: { large: null },
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

const seen = (anilistId: number): MarkDto => ({
  anilistId,
  malId: anilistId + 1000,
  status: 'seen',
  markedAt: '2025-01-01T00:00:00.000Z',
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// The API: the marks, and a profile whose counter mode PATCH saves unless `failPatch`.
function fakeApi(marks: MarkDto[], options: { failPatch?: boolean } = {}) {
  let counterMode: Profile['counterMode'] = 'franchise';
  const profile = (): Profile => ({
    displayName: 'Camila',
    avatarUrl: null,
    locale: 'es',
    listVisibility: 'private',
    counterMode,
  });
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/v1/me/marks') return json({ items: marks, nextCursor: null });
    if (url === '/api/v1/me' && init?.method === 'PATCH') {
      if (options.failPatch) return json({ status: 503, code: 'profile.unavailable' }, 503);
      counterMode = JSON.parse(init.body as string).counterMode;
      return json(profile());
    }
    if (url === '/api/v1/me') return json(profile());
    throw new Error(`Unexpected request ${url}`);
  });
  return fetchFn as unknown as typeof fetch & typeof fetchFn;
}

function renderCounter(options: {
  marks: MarkDto[];
  fetchFn?: typeof fetch;
  initialMode?: Profile['counterMode'];
  onCounterModeChanged?: (event: CounterModeChangedEvent) => void;
}) {
  const { client, request } = fakeAniList();
  const fetchFn = options.fetchFn ?? fakeApi(options.marks);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <TotalCounter
        initialMode={options.initialMode ?? 'franchise'}
        getToken={async () => 'jwt'}
        client={client}
        fetchFn={fetchFn}
        onCounterModeChanged={options.onCounterModeChanged}
      />
    </QueryClientProvider>,
  );
  const counter = screen.getByRole('region', { name: 'Contador total' });
  return { counter, queryClient, request };
}

const option = (counter: HTMLElement, name: string) =>
  within(within(counter).getByRole('group', { name: 'Contar por' })).getByRole('button', { name });

describe('TotalCounter', () => {
  it('@CA-RF25-01 counts one complete franchise as 1 and its four entries as 4, and keeps the choice', async () => {
    const user = userEvent.setup();
    const fetchFn = fakeApi([seen(1), seen(2), seen(3), seen(4)]);
    const events: CounterModeChangedEvent[] = [];
    const { counter } = renderCounter({
      marks: [],
      fetchFn,
      onCounterModeChanged: (event) => events.push(event),
    });

    expect(await within(counter).findByText('1 anime')).toBeTruthy();
    expect(within(counter).getByText('sagas completas')).toBeTruthy();
    expect(option(counter, 'Franquicias').getAttribute('aria-pressed')).toBe('true');

    await user.click(option(counter, 'Entradas'));

    expect(within(counter).getByText('4 animes')).toBeTruthy();
    expect(within(counter).getByText('entradas vistas')).toBeTruthy();
    expect(option(counter, 'Entradas').getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(events).toEqual([{ mode: 'entry' }]));
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/me', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
      body: JSON.stringify({ counterMode: 'entry' }),
    });

    // Coming back: the profile brings the saved mode.
    cleanup();
    const me = await fetchMe(async () => 'jwt', fetchFn);
    if (me.status !== 'ok') throw new Error('profile not loaded');
    const again = renderCounter({ marks: [], fetchFn, initialMode: me.profile.counterMode });
    expect(await within(again.counter).findByText('4 animes')).toBeTruthy();
    expect(option(again.counter, 'Entradas').getAttribute('aria-pressed')).toBe('true');
  });

  it('counts by franchise only the franchises whose whole core is seen (RDI-32)', async () => {
    const { counter } = renderCounter({ marks: [seen(1), seen(2), seen(9), seen(20)] });
    // Saga A misses seasons 3 and 4; the movie 20 is a complete franchise of its own.
    expect(await within(counter).findByText('1 anime')).toBeTruthy();
  });

  it('counts by entries every seen entry of any format, extras included (RDI-32)', async () => {
    const { counter, request } = renderCounter({
      marks: [seen(1), seen(9), seen(20), { ...seen(2), status: 'watching' }],
      initialMode: 'entry',
    });
    expect(await within(counter).findByText('3 animes')).toBeTruthy();
    // Counting entries reads the marks alone.
    expect(request).not.toHaveBeenCalled();
  });

  it('updates when a franchise is marked, crawling only the entries it does not know (RF-24)', async () => {
    const { counter, queryClient, request } = renderCounter({ marks: [seen(20)] });
    expect(await within(counter).findByText('1 anime')).toBeTruthy();
    const before = request.mock.calls.length;

    act(() => {
      queryClient.setQueryData<MarkDto[]>(MARKS_KEY, (marks = []) => [
        ...marks,
        seen(1),
        seen(2),
        seen(3),
        seen(4),
      ]);
    });

    expect(await within(counter).findByText('2 animes')).toBeTruthy();
    const crawled = request.mock.calls.slice(before).flatMap(([, variables]) => variables.ids);
    expect(crawled).not.toContain(20);
  });

  it('goes back to the previous mode and says so when saving fails', async () => {
    const user = userEvent.setup();
    const events: CounterModeChangedEvent[] = [];
    const { counter } = renderCounter({
      marks: [],
      fetchFn: fakeApi([seen(1), seen(2), seen(3), seen(4)], { failPatch: true }),
      onCounterModeChanged: (event) => events.push(event),
    });
    expect(await within(counter).findByText('1 anime')).toBeTruthy();

    await user.click(option(counter, 'Entradas'));

    expect((await within(counter).findByRole('alert')).textContent).toBe(
      'No pudimos guardar cómo contar. Vuelve a intentarlo.',
    );
    expect(option(counter, 'Franquicias').getAttribute('aria-pressed')).toBe('true');
    expect(within(counter).getByText('1 anime')).toBeTruthy();
    expect(events).toEqual([]);
  });
});
