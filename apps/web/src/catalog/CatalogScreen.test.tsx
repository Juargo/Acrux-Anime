// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type CatalogAnime,
  type CatalogClient,
  CatalogError,
  type FranchiseYearCount,
} from '../catalog-source/client';
import { anime, fakeCatalogClient } from '../catalog-source/test-support';
import { setLocale } from '../i18n';
import { CatalogScreen } from './CatalogScreen';

afterEach(cleanup);

const cover = (id: number) => `https://cdn.example.test/anime/${id}.jpg`;

function media(id: number, title: string, year: number, prequel?: CatalogAnime): CatalogAnime {
  return anime(id, {
    title,
    startDate: `${year}-01-01`,
    year,
    relations: prequel ? [{ type: 'PREQUEL', id: prequel.id }] : [],
  });
}

const frieren = media(154587, 'Sousou no Frieren', 2023);
const frieren2 = media(182255, 'Sousou no Frieren 2nd Season', 2026, frieren);

type Answer = { items: CatalogAnime[]; hasNextPage?: boolean } | Error;
// What the screen asked the API for: the filters and the page.
type Call = {
  page: number;
  search?: string | undefined;
  years: readonly number[];
  genres: readonly string[];
  formats: readonly string[];
};

const yearCounts: FranchiseYearCount[] = [
  { year: 2016, franchises: 123 },
  { year: 2023, franchises: 1234 },
];

function fakeClient(
  answer: (call: Call) => Answer | Promise<Answer>,
  franchiseYears: FranchiseYearCount[] | Error = yearCounts,
) {
  const calls: Call[] = [];
  const client = fakeCatalogClient({
    genres: async () => ['Action', 'Fantasy', 'Hentai'],
    franchiseYears: async () => {
      if (franchiseYears instanceof Error) throw franchiseYears;
      return franchiseYears;
    },
    browse: async (params, page) => {
      const call = { ...params, page };
      calls.push(call);
      const result = await answer(call);
      if (result instanceof Error) throw result;
      return {
        items: result.items,
        chain: [],
        related: [],
        nextPage: result.hasNextPage ? page + 1 : null,
      };
    },
  });
  return { client: client as CatalogClient, calls };
}

function renderScreen(client: CatalogClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CatalogScreen client={client} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The search waits behind its button in the header of the world.
async function openSearch(name = 'Buscar anime') {
  await userEvent.click(screen.getByRole('button', { name: /^(Buscar en|Search in) Anime$/ }));
  return screen.getByRole('searchbox', { name });
}

describe('CatalogScreen', () => {
  it('credits MyAnimeList with a link (ADR-0043)', async () => {
    renderScreen(fakeClient(() => ({ items: [frieren] })).client);
    expect((await screen.findByRole('link', { name: 'MyAnimeList' })).getAttribute('href')).toBe(
      'https://myanimelist.net',
    );
  });

  it('browses every year by default: no year is selected and none is sent (S1)', async () => {
    const { client, calls } = fakeClient(() => ({ items: [frieren] }));
    renderScreen(client);

    expect(await screen.findByText('Sousou no Frieren')).toBeTruthy();
    expect(calls[0]).toMatchObject({ page: 1, years: [] });
    expect(calls[0]?.search).toBeUndefined();
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    expect(screen.queryByRole('button', { name: String(new Date().getFullYear()) })).toBeNull();
  });

  it('@CA-RF12-01 search by name shows one item per franchise with cover and title', async () => {
    const { client, calls } = fakeClient((variables) =>
      variables.search === 'frieren' ? { items: [frieren, frieren2] } : { items: [] },
    );
    renderScreen(client);

    await userEvent.type(await openSearch(), 'frieren');

    const grid = await screen.findByRole('list', { name: 'Catálogo' });
    await waitFor(() => expect(within(grid).getAllByRole('listitem')).toHaveLength(1));
    const item = within(grid).getByRole('listitem');
    expect(within(item).getByText('Sousou no Frieren')).toBeTruthy();
    // The cover is decorative (alt=""): the title next to it names the item.
    expect(item.querySelector('img')?.getAttribute('src')).toBe(cover(154587));
    // Debounced: one request for the whole word, over every year.
    const searches = calls.filter((call) => call.search !== undefined);
    expect(searches).toHaveLength(1);
    expect(searches[0]).toMatchObject({ search: 'frieren', page: 1 });
    expect(searches[0]?.years).toEqual([]);
  });

  it('@CA-RF13-01 choosing the year 2023, a genre and a format sends all three', async () => {
    const { client, calls } = fakeClient((variables) =>
      variables.years.includes(2023) ? { items: [frieren] } : { items: [] },
    );
    renderScreen(client);
    await screen.findByText(/No encontramos animes/);

    await userEvent.click(screen.getByRole('button', { name: /^Streaming/ }));
    await userEvent.click(screen.getByRole('button', { name: /^2023/ }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ years: [2023] }));

    // Each pick applies at once, in view: there is no sheet and nothing to confirm.
    await userEvent.click(screen.getByRole('radio', { name: 'Género' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Fantasía' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ years: [2023], genres: ['Fantasy'] }));
    await userEvent.click(screen.getByRole('radio', { name: 'Formato' }));
    await userEvent.click(screen.getByRole('button', { name: 'Serie de TV' }));

    expect(await screen.findByText('Sousou no Frieren')).toBeTruthy();
    expect(calls.at(-1)).toMatchObject({ years: [2023], genres: ['Fantasy'], formats: ['TV'] });
    expect(screen.queryByRole('dialog')).toBeNull();
    // The levels off the axis stay in view as what they hold.
    expect(screen.getByRole('button', { name: 'Streaming' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Género · 1' })).toBeTruthy();
  });

  it('opens on the eras, and "Niveles por" swaps the levels in view (S7)', async () => {
    const { client } = fakeClient(() => ({ items: [] }));
    renderScreen(client);

    const axis = screen.getByRole('radiogroup', { name: 'Niveles por' });
    expect(
      ['Era', 'Género', 'Formato'].map(
        (name) => within(axis).getByRole<HTMLInputElement>('radio', { name }).checked,
      ),
    ).toEqual([true, false, false]);
    expect(screen.getByRole('button', { name: /^Streaming/ })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Formato' })).toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: 'Formato' }));

    expect(screen.queryByRole('button', { name: /^Streaming/ })).toBeNull();
    expect(
      within(screen.getByRole('group', { name: 'Formato' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Serie de TV', 'Película', 'OVA', 'ONA', 'Especial']);
    expect(
      screen.getByText('Una saga aparece si alguna de sus entradas cumple el filtro.'),
    ).toBeTruthy();
  });

  it('a level off the axis is one tap away: its chip brings its levels into view', async () => {
    const { client, calls } = fakeClient(() => ({ items: [] }));
    renderScreen(client);
    await screen.findByText(/No encontramos animes/);

    await userEvent.click(screen.getByRole('button', { name: 'Formato' }));
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Formato' }).checked).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Formato' }));
    await userEvent.click(screen.getByRole('button', { name: 'OVA' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ years: [], formats: ['OVA'] }));

    // Taking a pick off works the same way.
    await userEvent.click(screen.getByRole('button', { name: 'OVA' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ formats: [] }));

    await userEvent.click(screen.getByRole('button', { name: 'Era' }));
    expect(screen.getByRole('button', { name: /^Streaming/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Formato' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('hides the adult genre among the genre levels', async () => {
    const { client } = fakeClient(() => ({ items: [] }));
    renderScreen(client);

    await userEvent.click(screen.getByRole('radio', { name: 'Género' }));
    const levels = screen.getByRole('group', { name: 'Género' });
    expect(await within(levels).findByRole('button', { name: 'Acción' })).toBeTruthy();
    expect(within(levels).queryByRole('button', { name: 'Hentai' })).toBeNull();
  });

  it('shows the real count of franchises on each year, from the API', async () => {
    const { client } = fakeClient(() => ({ items: [] }));
    renderScreen(client);

    await userEvent.click(screen.getByRole('button', { name: /^Streaming/ }));

    expect(await screen.findByRole('button', { name: '2016, 123 franquicias' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2023, 1234 franquicias' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2017' }).textContent).toBe('2017');
  });

  it('keeps the era levels usable without numbers when the counts fail', async () => {
    const { client, calls } = fakeClient(
      () => ({ items: [] }),
      new CatalogError('unavailable', 'offline'),
    );
    renderScreen(client);
    await screen.findByText(/No encontramos animes/);

    await userEvent.click(screen.getByRole('button', { name: /^Streaming/ }));
    await userEvent.click(screen.getByRole('button', { name: '2016' }));

    expect(screen.getByRole('button', { name: '2016' }).textContent).toBe('2016');
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ years: [2016] }));
  });

  it('keeps the search one tap away in the header, and closing it clears it', async () => {
    const { client, calls } = fakeClient(() => ({ items: [] }));
    renderScreen(client);
    await screen.findByText(/No encontramos animes/);
    expect(screen.queryByRole('searchbox')).toBeNull();

    const toggle = screen.getByRole('button', { name: 'Buscar en Anime' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);
    const box = screen.getByRole('searchbox', { name: 'Buscar anime' });
    expect(document.activeElement).toBe(box);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await userEvent.type(box, 'frieren');
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ search: 'frieren' }));

    await userEvent.click(toggle);
    expect(screen.queryByRole('searchbox')).toBeNull();
    await waitFor(() => expect(calls.at(-1)?.search).toBeUndefined());
  });

  it('sends no years while searching, disables the year chips and says why (S5)', async () => {
    const { client, calls } = fakeClient(() => ({ items: [] }));
    renderScreen(client);
    await userEvent.click(screen.getByRole('button', { name: /^Streaming/ }));
    await userEvent.click(screen.getByRole('button', { name: /^2016/ }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ years: [2016] }));
    expect(screen.queryByText('La búsqueda cubre todos los años.')).toBeNull();

    await userEvent.type(await openSearch(), ' frieren ');

    await waitFor(() => expect(calls.at(-1)).toMatchObject({ search: 'frieren', years: [] }));
    expect(screen.getByText('La búsqueda cubre todos los años.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Streaming/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /^2016/ })).toHaveProperty('disabled', true);

    // Clearing the search brings the selection back.
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar anime' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ years: [2016] }));
    expect(calls.at(-1)?.search).toBeUndefined();
    expect(screen.getByRole('button', { name: /^2016/ })).toHaveProperty('disabled', false);
  });

  it('shows a loading state, then an empty state for a search with no results', async () => {
    let release: (answer: Answer) => void = () => {};
    const { client } = fakeClient((variables) =>
      variables.search === undefined
        ? new Promise<Answer>((resolve) => {
            release = resolve;
          })
        : { items: [] },
    );
    renderScreen(client);

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Cargando el catálogo…',
    );
    act(() => release({ items: [] }));
    await userEvent.type(await openSearch(), 'zzz');

    expect(await screen.findByText('No encontramos animes para «zzz».')).toBeTruthy();
  });

  it('explains a catalog failure, keeps marks safe and lets the user retry (RNF-21)', async () => {
    let fail = true;
    const { client } = fakeClient(() =>
      fail ? new CatalogError('rate-limited', 'limited') : { items: [frieren] },
    );
    renderScreen(client);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('lo que marcaste sigue guardado');
    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Sousou no Frieren')).toBeTruthy();
  });

  it('tells the user when the device is offline', async () => {
    const { client } = fakeClient(() => ({ items: [] }));
    renderScreen(client);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect((await screen.findByRole('alert')).textContent).toContain('Estás sin conexión');
    vi.restoreAllMocks();
    // TanStack Query also listens to these events: leave it online for the next tests.
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
  });

  it('keeps the loaded grid when a later page fails, and retries that page', async () => {
    let failNext = true;
    const { client, calls } = fakeClient((variables) => {
      if (variables.page === 1) return { items: [frieren], hasNextPage: true };
      if (failNext) return new CatalogError('unavailable', 'offline');
      return { items: [media(5, 'Second page', 2024)] };
    });
    renderScreen(client);

    const alert = await screen.findByRole('alert');
    expect(screen.getByText('Sousou no Frieren')).toBeTruthy();
    failNext = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Second page')).toBeTruthy();
    expect(calls.map((call) => call.page)).toEqual([1, 2, 2]);
  });

  it('loads the next page when the end of the grid is visible', async () => {
    const { client, calls } = fakeClient((variables) =>
      variables.page === 1
        ? { items: [frieren], hasNextPage: true }
        : { items: [media(5, 'Second page', 2024)] },
    );
    renderScreen(client);

    await waitFor(() => expect(calls.map((call) => call.page)).toEqual([1, 2]));
    expect(await screen.findByText('Second page')).toBeTruthy();
    expect(calls.map((call) => call.page)).toEqual([1, 2]);
  });
});

describe('CatalogScreen in English (RF-70)', () => {
  afterEach(async () => {
    await setLocale('es');
  });

  it('shows the catalog, its filters and the mark button in English', async () => {
    await setLocale('en');
    const { client } = fakeClient(() => ({ items: [frieren] }));
    renderScreen(client);

    expect(await screen.findByText('Sousou no Frieren')).toBeTruthy();
    expect(await openSearch('Search anime')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Catalog' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Levels by' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Genre' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Género' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Tezuka era/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Era Tezuka/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Format' }));
    const levels = screen.getByRole('group', { name: 'Format' });
    expect(within(levels).getByRole('button', { name: 'TV series' })).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'Genre' }));
    expect(await screen.findByRole('button', { name: 'Fantasy' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says it found nothing in English', async () => {
    await setLocale('en');
    const { client } = fakeClient(() => ({ items: [] }));
    renderScreen(client);

    expect(await screen.findByText('No anime matches these filters.')).toBeTruthy();
    expect(screen.queryByText(/No encontramos animes/)).toBeNull();
  });
});
