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

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar anime' }), 'frieren');

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
    // The years apply at once, with no sheet.
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ years: [2023] }));

    await userEvent.click(screen.getByRole('button', { name: 'Género' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    await userEvent.click(await within(sheet).findByRole('button', { name: 'Fantasía' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Serie de TV' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ver resultados' }));

    expect(await screen.findByText('Sousou no Frieren')).toBeTruthy();
    expect(calls.at(-1)).toMatchObject({ years: [2023], genres: ['Fantasy'], formats: ['TV'] });
    expect(screen.getByRole('button', { name: 'Género · 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tipo · 1' })).toBeTruthy();
  });

  it('filters by genre and format through the sheet as before, without any year', async () => {
    const { client, calls } = fakeClient(() => ({ items: [] }));
    renderScreen(client);
    await screen.findByText(/No encontramos animes/);

    await userEvent.click(screen.getByRole('button', { name: 'Tipo' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    expect(within(sheet).queryByLabelText('Año de estreno')).toBeNull();
    await userEvent.click(await within(sheet).findByRole('button', { name: 'Fantasía' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'OVA' }));
    expect(calls).toHaveLength(1);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ver resultados' }));

    await waitFor(() =>
      expect(calls.at(-1)).toMatchObject({ years: [], genres: ['Fantasy'], formats: ['OVA'] }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides the adult genre in the filter sheet', async () => {
    const { client } = fakeClient(() => ({ items: [] }));
    renderScreen(client);

    await userEvent.click(screen.getByRole('button', { name: 'Género' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    expect(await within(sheet).findByRole('button', { name: 'Acción' })).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Hentai' })).toBeNull();
  });

  it('shows the real count of franchises on each year, from the API', async () => {
    const { client } = fakeClient(() => ({ items: [] }));
    renderScreen(client);

    await userEvent.click(screen.getByRole('button', { name: /^Streaming/ }));

    expect(await screen.findByRole('button', { name: '2016, 123 franquicias' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2023, 1234 franquicias' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2017' }).textContent).toBe('2017');
  });

  it('keeps the era filter usable without numbers when the counts fail', async () => {
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

  it('moves focus into the filter sheet and back to the chip that opened it', async () => {
    const { client } = fakeClient(() => ({ items: [] }));
    renderScreen(client);
    const chip = screen.getByRole('button', { name: 'Tipo' });

    await userEvent.click(chip);
    const sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    expect(sheet.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it('sends no years while searching, disables the year chips and says why (S5)', async () => {
    const { client, calls } = fakeClient(() => ({ items: [] }));
    renderScreen(client);
    await userEvent.click(screen.getByRole('button', { name: /^Streaming/ }));
    await userEvent.click(screen.getByRole('button', { name: /^2016/ }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ years: [2016] }));
    expect(screen.queryByText('La búsqueda cubre todos los años.')).toBeNull();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar anime' }), ' frieren ');

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

  it('clears genres and formats in the sheet, and leaves the selected years alone', async () => {
    const { client, calls } = fakeClient(() => ({ items: [] }));
    renderScreen(client);
    await userEvent.click(screen.getByRole('button', { name: /^Edad de oro/ }));
    await userEvent.click(screen.getByRole('button', { name: '2001' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tipo' }));
    let sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'OVA' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ver resultados' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ years: [2001], formats: ['OVA'] }));

    await userEvent.click(screen.getByRole('button', { name: 'Tipo · 1' }));
    sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Limpiar' }));

    await waitFor(() =>
      expect(calls.at(-1)).toMatchObject({ years: [2001], genres: [], formats: [] }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
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
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar anime' }), 'zzz');

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
    expect(screen.getByRole('searchbox', { name: 'Search anime' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Catalog' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Genre' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Género' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Era' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Tezuka era/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Era Tezuka/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Type' }));
    const sheet = screen.getByRole('dialog', { name: 'Filter' });
    expect(within(sheet).queryByLabelText('Release year')).toBeNull();
    expect(await within(sheet).findByRole('button', { name: 'Fantasy' })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'TV series' })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Show results' })).toBeTruthy();
    expect(within(sheet).queryByText('Ver resultados')).toBeNull();
  });

  it('says it found nothing in English', async () => {
    await setLocale('en');
    const { client } = fakeClient(() => ({ items: [] }));
    renderScreen(client);

    expect(await screen.findByText('No anime matches these filters.')).toBeTruthy();
    expect(screen.queryByText(/No encontramos animes/)).toBeNull();
  });
});
