// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_PAGE, type CatalogMedia, GENRES } from '../anilist/catalog';
import { type AniListClient, AniListError } from '../anilist/client';
import { CatalogScreen } from './CatalogScreen';

afterEach(cleanup);

const cover = (id: number) => `https://img.anili.st/media/${id}.jpg`;

function media(id: number, title: string, year: number, prequel?: CatalogMedia): CatalogMedia {
  return {
    id,
    type: 'ANIME',
    format: 'TV',
    isAdult: false,
    title: { romaji: title, english: null, native: null },
    coverImage: { large: cover(id) },
    startDate: { year, month: 1, day: 1 },
    relations: {
      edges: prequel
        ? [{ relationType: 'PREQUEL', node: { ...prequel, relations: undefined } as never }]
        : [],
    },
  };
}

const frieren = media(154587, 'Sousou no Frieren', 2023);
const frieren2 = media(182255, 'Sousou no Frieren 2nd Season', 2026, frieren);

type Answer = { media: CatalogMedia[]; hasNextPage?: boolean } | Error;

function fakeClient(answer: (variables: Record<string, unknown>) => Answer | Promise<Answer>) {
  const calls: Record<string, unknown>[] = [];
  const request = vi.fn(async (query: string, variables: Record<string, unknown>, schema) => {
    if (query === GENRES) {
      return schema.parse({ GenreCollection: ['Action', 'Fantasy', 'Hentai'] });
    }
    expect(query).toBe(CATALOG_PAGE);
    calls.push(variables);
    const result = await answer(variables);
    if (result instanceof Error) throw result;
    return schema.parse({
      Page: { pageInfo: { hasNextPage: result.hasNextPage ?? false }, media: result.media },
    });
  });
  return { client: { request } as unknown as AniListClient, calls };
}

function renderScreen(client: AniListClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CatalogScreen client={client} />
    </QueryClientProvider>,
  );
}

const currentYear = new Date().getFullYear();

describe('CatalogScreen', () => {
  it('browses the releases of the current year by default, most popular first', async () => {
    const { client, calls } = fakeClient(() => ({ media: [frieren] }));
    renderScreen(client);

    expect(await screen.findByText('Sousou no Frieren')).toBeTruthy();
    expect(calls[0]).toMatchObject({ page: 1, search: null, seasonYear: currentYear });
    expect(screen.getByRole('button', { name: String(currentYear) })).toBeTruthy();
  });

  it('@CA-RF12-01 search by name shows one item per franchise with cover and title', async () => {
    const { client, calls } = fakeClient((variables) =>
      variables.search === 'frieren' ? { media: [frieren, frieren2] } : { media: [] },
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
    expect(calls.filter((call) => call.search !== null)).toEqual([
      expect.objectContaining({ search: 'frieren', seasonYear: null }),
    ]);
  });

  it('@CA-RF13-01 filters the releases of a year by genre and type on AniList', async () => {
    const { client, calls } = fakeClient((variables) =>
      variables.seasonYear === 2023 ? { media: [frieren] } : { media: [] },
    );
    renderScreen(client);
    await screen.findByText(/No encontramos animes/);

    await userEvent.click(screen.getByRole('button', { name: String(currentYear) }));
    const sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    await userEvent.selectOptions(within(sheet).getByLabelText('Año de estreno'), '2023');
    await userEvent.click(await within(sheet).findByRole('button', { name: 'Fantasía' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Serie de TV' }));
    expect(calls).toHaveLength(1);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ver resultados' }));

    expect(await screen.findByText('Sousou no Frieren')).toBeTruthy();
    expect(calls.at(-1)).toMatchObject({
      seasonYear: 2023,
      genres: ['Fantasy'],
      formats: ['TV', 'TV_SHORT'],
    });
    expect(screen.getByRole('button', { name: 'Género · 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tipo · 1' })).toBeTruthy();
  });

  it('offers every year from the current one back to 1917, and hides the adult genre', async () => {
    const { client } = fakeClient(() => ({ media: [] }));
    renderScreen(client);

    await userEvent.click(screen.getByRole('button', { name: String(currentYear) }));
    const sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    const years = within(within(sheet).getByLabelText('Año de estreno')).getAllByRole('option');
    expect(years[0]?.textContent).toBe(String(currentYear));
    expect(years.at(-1)?.textContent).toBe('1917');
    expect(years).toHaveLength(currentYear - 1917 + 1);
    expect(await within(sheet).findByRole('button', { name: 'Acción' })).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Hentai' })).toBeNull();
  });

  it('clears the filters back to the current year', async () => {
    const { client, calls } = fakeClient(() => ({ media: [] }));
    renderScreen(client);
    await userEvent.click(screen.getByRole('button', { name: String(currentYear) }));
    let sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    await userEvent.selectOptions(within(sheet).getByLabelText('Año de estreno'), '2001');
    await userEvent.click(within(sheet).getByRole('button', { name: 'OVA' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ver resultados' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ seasonYear: 2001 }));

    await userEvent.click(screen.getByRole('button', { name: 'Tipo · 1' }));
    sheet = screen.getByRole('dialog', { name: 'Filtrar' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Limpiar' }));

    await waitFor(() =>
      expect(calls.at(-1)).toMatchObject({ seasonYear: currentYear, genres: null }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a loading state, then an empty state for a search with no results', async () => {
    let release: (answer: Answer) => void = () => {};
    const { client } = fakeClient((variables) =>
      variables.search === null
        ? new Promise<Answer>((resolve) => {
            release = resolve;
          })
        : { media: [] },
    );
    renderScreen(client);

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Cargando el catálogo…',
    );
    act(() => release({ media: [] }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar anime' }), 'zzz');

    expect(await screen.findByText('No encontramos animes para «zzz».')).toBeTruthy();
  });

  it('explains an AniList failure, keeps marks safe and lets the user retry (RNF-21)', async () => {
    let fail = true;
    const { client } = fakeClient(() =>
      fail ? new AniListError('rate-limited', 'limited') : { media: [frieren] },
    );
    renderScreen(client);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('lo que marcaste sigue guardado');
    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Sousou no Frieren')).toBeTruthy();
  });

  it('tells the user when the device is offline', async () => {
    const { client } = fakeClient(() => ({ media: [] }));
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
      if (variables.page === 1) return { media: [frieren], hasNextPage: true };
      if (failNext) return new AniListError('unavailable', 'offline');
      return { media: [media(5, 'Second page', 2024)] };
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
        ? { media: [frieren], hasNextPage: true }
        : { media: [media(5, 'Second page', 2024)] },
    );
    renderScreen(client);

    await waitFor(() => expect(calls.map((call) => call.page)).toEqual([1, 2]));
    expect(await screen.findByText('Second page')).toBeTruthy();
    expect(calls.map((call) => call.page)).toEqual([1, 2]);
  });
});
