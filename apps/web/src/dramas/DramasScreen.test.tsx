// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '../catalog-source/client';
import type { Drama, DramaBrowseParams, DramaClient } from '../drama-source/client';
import { drama, fakeDramaClient } from '../drama-source/test-support';
import { setLocale } from '../i18n';
import { DramasScreen } from './DramasScreen';

afterEach(async () => {
  cleanup();
  await setLocale('es');
});

type Call = DramaBrowseParams & { page: number };
type Answer = { items: Drama[]; hasNextPage?: boolean } | Error;

function fakeClient(answer: (call: Call) => Answer = () => ({ items: [] })) {
  const calls: Call[] = [];
  const client = fakeDramaClient({
    genres: async () => ['Drama', 'Romance', 'Thriller'],
    browse: async (params, page) => {
      const call = { ...params, page };
      calls.push(call);
      const result = answer(call);
      if (result instanceof Error) throw result;
      return { items: result.items, nextPage: result.hasNextPage ? page + 1 : null };
    },
  });
  return { client: client as DramaClient, calls };
}

interface StoredMark {
  dramaId: number;
  status: 'seen' | 'watching';
  markedAt: string;
}

// The drama marks of the API (#154), kept in memory; `failing` makes every write answer 500.
function fakeMarksApi(initial: StoredMark[] = [], options: { failing?: boolean } = {}) {
  const stored = new Map(initial.map((mark) => [mark.dramaId, mark]));
  const writes: string[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { pathname } = new URL(String(input), 'http://localhost');
    const method = init.method ?? 'GET';
    if (method === 'GET') {
      return Response.json({ items: [...stored.values()], nextCursor: null });
    }
    const dramaId = Number(pathname.split('/').at(-1));
    writes.push(`${method} ${dramaId}${init.body ? ` ${init.body}` : ''}`);
    if (options.failing) return Response.json({ requestId: 'r1' }, { status: 500 });
    if (method === 'DELETE') {
      stored.delete(dramaId);
      return new Response(null, { status: 204 });
    }
    const { status } = JSON.parse(String(init.body)) as { status: 'seen' | 'watching' };
    const mark = { dramaId, status, markedAt: '2026-11-20T12:00:00.000Z' };
    stored.set(dramaId, mark);
    return Response.json(mark);
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, writes };
}

const storedMark = (dramaId: number, status: 'seen' | 'watching'): StoredMark => ({
  dramaId,
  status,
  markedAt: '2026-11-19T12:00:00.000Z',
});

function renderScreen(client: DramaClient, fetchFn: typeof fetch = fakeMarksApi().fetchFn) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DramasScreen client={client} getToken={async () => 'jwt'} fetchFn={fetchFn} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cardOf = async (title: string) => {
  const grid = await screen.findByRole('list', { name: 'Dramas' });
  return within(grid).getByText(title).closest('li') as HTMLElement;
};

describe('DramasScreen', () => {
  it('shows the international title, cover, country, year, seasons and episodes (S5)', async () => {
    const { client } = fakeClient(() => ({
      items: [
        drama(1, {
          title: 'Crash Landing on You',
          origin: 'KR',
          year: 2019,
          seasons: 2,
          episodes: 32,
        }),
      ],
    }));
    renderScreen(client);

    const card = await cardOf('Crash Landing on You');
    expect(card.querySelector('img')?.getAttribute('src')).toBe('https://static.tvmaze.test/1.jpg');
    expect(card.textContent).toContain('Corea · 2019 · 2 temporadas · 32 episodios');
  });

  it('uses the singular for one season and one episode', async () => {
    const { client } = fakeClient(() => ({ items: [drama(1, { seasons: 1, episodes: 1 })] }));
    renderScreen(client);

    expect((await cardOf('Show 1')).textContent).toContain('1 temporada · 1 episodio');
  });

  it('shows no count, and no zero, for a drama without detail yet (S6)', async () => {
    const { client } = fakeClient(() => ({
      items: [drama(1, { title: 'Sin detalle', seasons: null, episodes: null })],
    }));
    renderScreen(client);

    const text = (await cardOf('Sin detalle')).textContent ?? '';
    expect(text).toContain('Corea · 2020');
    expect(text).not.toMatch(/temporada|episodio|\b0\b/);
  });

  it('shows no country for a drama without origin, and a placeholder without cover', async () => {
    const { client } = fakeClient(() => ({
      items: [drama(1, { title: 'Sin origen', origin: null, year: null, coverUrl: null })],
    }));
    renderScreen(client);

    const card = await cardOf('Sin origen');
    expect(card.textContent).not.toMatch(/Corea|Japón|China/);
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('.catalog-card__cover--empty')).not.toBeNull();
  });

  it('filters by one country and by genres through the sheet (S3)', async () => {
    const { client, calls } = fakeClient();
    renderScreen(client);
    await screen.findByText('No encontramos dramas con estos filtros.');
    expect(calls[0]).toMatchObject({ page: 1, genres: [] });
    expect(calls[0]?.origin).toBeUndefined();

    await userEvent.click(screen.getByRole('button', { name: 'País' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Corea' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Japón' }));
    expect(within(sheet).getByRole('button', { name: 'Corea' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    await userEvent.click(await within(sheet).findByRole('button', { name: 'Romance' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Thriller' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ver resultados' }));

    await waitFor(() =>
      expect(calls.at(-1)).toMatchObject({
        origin: 'JP',
        genres: ['Romance', 'Thriller'],
        page: 1,
      }),
    );
    expect(screen.getByRole('button', { name: 'País · 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Género · 2' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'País · 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver resultados' }));
    await waitFor(() => expect(calls.at(-1)?.origin).toBeUndefined());
  });

  // Marking arrived with #154; the card still opens no detail screen.
  it('has no era, year or format controls and no detail link (S3)', async () => {
    const { client } = fakeClient(() => ({ items: [drama(1)] }));
    renderScreen(client);
    await cardOf('Show 1');

    expect(screen.queryByText('Época')).toBeNull();
    expect(screen.queryByRole('button', { name: /Tipo|Streaming|\b20\d\d\b/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Show 1/ })).toBeNull();
  });

  it('searches once per word, debounced (S7)', async () => {
    const { client, calls } = fakeClient((call) =>
      call.search === 'crash'
        ? { items: [drama(1, { title: 'Crash Landing on You' })] }
        : { items: [] },
    );
    renderScreen(client);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar dramas' }), 'crash');

    await cardOf('Crash Landing on You');
    const searches = calls.filter((call) => call.search);
    expect(searches).toHaveLength(1);
    expect(searches[0]).toMatchObject({ search: 'crash', page: 1 });
  });

  it('@S7 searching «El indomable» finds nothing and says titles are international', async () => {
    const { client } = fakeClient();
    renderScreen(client);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar dramas' }), 'El indomable');

    expect(await screen.findByText('No encontramos dramas para «El indomable».')).toBeTruthy();
    expect(screen.getByText(/versión internacional/)).toBeTruthy();
  });

  it('says it in English too', async () => {
    await setLocale('en');
    const { client } = fakeClient();
    renderScreen(client);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search dramas' }), 'El indomable');

    expect(await screen.findByText('We found no dramas for "El indomable".')).toBeTruthy();
    expect(screen.getByText(/international version/)).toBeTruthy();
    expect(screen.getByText('Data from')).toBeTruthy();
  });

  it('does not mention international titles when no search was made', async () => {
    const { client } = fakeClient();
    renderScreen(client);

    await screen.findByText('No encontramos dramas con estos filtros.');
    expect(screen.queryByText(/versión internacional/)).toBeNull();
  });

  it('credits TVmaze with a link and never MyAnimeList (S6, S8)', async () => {
    const { client } = fakeClient(() => ({ items: [drama(1)] }));
    renderScreen(client);
    await cardOf('Show 1');

    expect(screen.getByRole('link', { name: 'TVmaze' }).getAttribute('href')).toBe(
      'https://www.tvmaze.com',
    );
    expect(screen.getByText('Datos de', { exact: false }).textContent).toContain('Datos de TVmaze');
    expect(screen.queryByRole('link', { name: 'MyAnimeList' })).toBeNull();
  });

  it('asks for the next page on request', async () => {
    const { client, calls } = fakeClient((call) => ({
      items: [drama(call.page)],
      hasNextPage: call.page === 1,
    }));
    renderScreen(client);
    await cardOf('Show 1');

    await userEvent.click(screen.getByRole('button', { name: 'Ver más' }));

    await cardOf('Show 2');
    expect(calls.map((call) => call.page)).toEqual([1, 2]);
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('says what failed and retries', async () => {
    let fail = true;
    const { client, calls } = fakeClient(() =>
      fail ? new CatalogError('unavailable', 'down') : { items: [drama(1)] },
    );
    renderScreen(client);

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos conectar');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await cardOf('Show 1');
    expect(calls).toHaveLength(2);
  });
});

describe('DramasScreen marking (#154)', () => {
  const two = () =>
    fakeClient(() => ({
      items: [drama(1, { title: 'Signal' }), drama(2, { title: 'Move to Heaven' })],
    }));
  const seenOf = (card: HTMLElement, title: string, pressed: boolean) =>
    within(card).getByRole('button', {
      name: pressed ? `Quitar «${title}» de vistos` : `Marcar «${title}» como visto`,
    });
  const watchingOf = (card: HTMLElement, title: string, pressed: boolean) =>
    within(card).getByRole('button', {
      name: pressed ? `Quitar «${title}» de viendo` : `Marcar «${title}» como viendo`,
    });

  it('shows on each card the mark the account already has', async () => {
    const { fetchFn } = fakeMarksApi([storedMark(1, 'seen'), storedMark(2, 'watching')]);
    renderScreen(two().client, fetchFn);

    const signal = await cardOf('Signal');
    await waitFor(() =>
      expect(seenOf(signal, 'Signal', true).getAttribute('aria-pressed')).toBe('true'),
    );
    expect(watchingOf(signal, 'Signal', false).getAttribute('aria-pressed')).toBe('false');
    const move = await cardOf('Move to Heaven');
    expect(watchingOf(move, 'Move to Heaven', true).getAttribute('aria-pressed')).toBe('true');
    expect(seenOf(move, 'Move to Heaven', false).getAttribute('aria-pressed')).toBe('false');
  });

  it('marks a drama as seen from its card and unmarks it with the same button', async () => {
    const user = userEvent.setup();
    const { fetchFn, writes } = fakeMarksApi();
    renderScreen(two().client, fetchFn);
    const signal = await cardOf('Signal');

    await user.click(seenOf(signal, 'Signal', false));
    await waitFor(() => expect(writes).toEqual(['PUT 1 {"status":"seen"}']));
    expect(seenOf(signal, 'Signal', true).getAttribute('aria-pressed')).toBe('true');
    // Only that card changes.
    const move = await cardOf('Move to Heaven');
    expect(seenOf(move, 'Move to Heaven', false).getAttribute('aria-pressed')).toBe('false');

    await user.click(seenOf(signal, 'Signal', true));
    await waitFor(() => expect(writes).toEqual(['PUT 1 {"status":"seen"}', 'DELETE 1']));
    expect(seenOf(signal, 'Signal', false).getAttribute('aria-pressed')).toBe('false');
  });

  it('marks a drama as watching, and seen replaces watching (S2)', async () => {
    const user = userEvent.setup();
    const { fetchFn, writes } = fakeMarksApi();
    renderScreen(two().client, fetchFn);
    const signal = await cardOf('Signal');

    await user.click(watchingOf(signal, 'Signal', false));
    await waitFor(() => expect(writes).toEqual(['PUT 1 {"status":"watching"}']));
    expect(watchingOf(signal, 'Signal', true).getAttribute('aria-pressed')).toBe('true');

    await user.click(seenOf(signal, 'Signal', false));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toBe('PUT 1 {"status":"seen"}');
    expect(seenOf(signal, 'Signal', true).getAttribute('aria-pressed')).toBe('true');
    expect(watchingOf(signal, 'Signal', false).getAttribute('aria-pressed')).toBe('false');
  });

  it('puts the card back and says so when saving fails', async () => {
    const user = userEvent.setup();
    const { fetchFn } = fakeMarksApi([storedMark(1, 'watching')], { failing: true });
    renderScreen(two().client, fetchFn);
    const signal = await cardOf('Signal');
    await waitFor(() =>
      expect(watchingOf(signal, 'Signal', true).getAttribute('aria-pressed')).toBe('true'),
    );

    await user.click(seenOf(signal, 'Signal', false));
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos guardar');
    expect(watchingOf(signal, 'Signal', true).getAttribute('aria-pressed')).toBe('true');
    expect(seenOf(signal, 'Signal', false).getAttribute('aria-pressed')).toBe('false');
  });

  it('names the buttons in English', async () => {
    await setLocale('en');
    renderScreen(two().client);
    const signal = await cardOf('Signal');
    within(signal).getByRole('button', { name: 'Mark “Signal” as watched' });
    within(signal).getByRole('button', { name: 'Mark “Signal” as watching' });
  });
});
