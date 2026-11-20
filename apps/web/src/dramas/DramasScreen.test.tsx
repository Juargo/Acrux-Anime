// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
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

function renderScreen(client: DramaClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DramasScreen client={client} />
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

  it('has no era, year, format or marking controls (S3, S4)', async () => {
    const { client } = fakeClient(() => ({ items: [drama(1)] }));
    renderScreen(client);
    await cardOf('Show 1');

    expect(screen.queryByText('Época')).toBeNull();
    expect(screen.queryByRole('button', { name: /Tipo|Streaming|\b20\d\d\b/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Marcar|vista/ })).toBeNull();
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
