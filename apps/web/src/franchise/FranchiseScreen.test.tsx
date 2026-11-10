// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_PAGE, type CatalogMedia, type RelatedMedia } from '../anilist/catalog';
import { type AniListClient, AniListError } from '../anilist/client';
import { FRANCHISE_MEDIA } from '../anilist/franchise';
import { setLocale } from '../i18n';
import type { SignedInContext } from '../routes/signed-in-context';
import { signedInRoutes } from '../routes/signed-in-routes';

afterEach(cleanup);

// A saga of five seasons 101 → 105, a side story 109 and a spin-off 107.
const titles: Record<number, string> = {
  101: 'Temporada 1',
  102: 'Temporada 2',
  103: 'Temporada 3',
  104: 'Temporada 4',
  105: 'Temporada 5',
  107: 'Spin-off',
  109: 'Historia paralela',
};
const years: Record<number, number> = {
  101: 2020,
  102: 2021,
  103: 2022,
  104: 2023,
  105: 2024,
  107: 2021,
  109: 2020,
};
const relations: Record<number, [string, number][]> = {
  101: [
    ['SEQUEL', 102],
    ['SIDE_STORY', 109],
    ['SPIN_OFF', 107],
  ],
  102: [
    ['PREQUEL', 101],
    ['SEQUEL', 103],
  ],
  103: [
    ['PREQUEL', 102],
    ['SEQUEL', 104],
  ],
  104: [
    ['PREQUEL', 103],
    ['SEQUEL', 105],
  ],
  105: [['PREQUEL', 104]],
  107: [['SOURCE', 101]],
  109: [['PARENT', 101]],
};

const cover = (id: number) => `https://img.anili.st/media/${id}.jpg`;

function node(id: number): RelatedMedia {
  return {
    id,
    idMal: id + 1000,
    type: 'ANIME',
    format: id === 109 ? 'OVA' : 'TV',
    isAdult: false,
    title: { romaji: titles[id] ?? `Entry ${id}`, english: null, native: null },
    coverImage: { large: cover(id) },
    startDate: { year: years[id] ?? 2000, month: 1, day: 1 },
  };
}

const media = (id: number): CatalogMedia & { episodes: number; genres: string[] } => ({
  ...node(id),
  episodes: 24,
  genres: ['Action', 'Supernatural'],
  relations: {
    edges: (relations[id] ?? []).map(([relationType, target]) => ({
      relationType,
      node: node(target),
    })),
  },
});

function fakeAniList(fail = 0) {
  let failures = fail;
  const request = vi.fn(async (query: string, variables: Record<string, unknown>, schema) => {
    if (query === CATALOG_PAGE) {
      return schema.parse({ Page: { pageInfo: { hasNextPage: false }, media: [media(101)] } });
    }
    expect(query).toBe(FRANCHISE_MEDIA);
    if (failures > 0) {
      failures -= 1;
      throw new AniListError('unavailable', 'AniList is down');
    }
    const ids = (variables.ids as number[]).filter((id) => id in titles);
    return schema.parse({ Page: { media: ids.map(media) } });
  });
  return { request } as unknown as AniListClient;
}

const mark = (animeId: number, status = 'seen', markedAt = '2025-01-01T00:00:00.000Z') => ({
  animeId,
  malId: animeId + 1000,
  status,
  markedAt,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Api = (path: string, init?: RequestInit) => Response | Promise<Response>;

// The marks API: GET answers `marks`; other requests go to `write`, by default an echo.
function renderAt(
  path: string,
  options: {
    marks?: unknown[];
    write?: Api;
    client?: AniListClient;
    onEntryMarkedSeen?: () => void;
  } = {},
) {
  const { marks = [], client = fakeAniList() } = options;
  const write: Api =
    options.write ??
    ((url, init) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      const body = JSON.parse(init?.body as string);
      if (url === '/api/v1/me/marks:batch') {
        return json({
          items: body.status
            ? body.entries.map((entry: { animeId: number }) => mark(entry.animeId, body.status))
            : [],
        });
      }
      return json(mark(Number(url.split('/').at(-1)), body.status));
    });
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method ? write(url, init) : json({ items: marks, nextCursor: null }),
  );
  const context: SignedInContext = {
    getToken: async () => 'jwt',
    client,
    fetchFn: fetchFn as unknown as typeof fetch,
    counterMode: 'franchise',
    onEntryMarkedSeen: options.onEntryMarkedSeen,
    onSignOut: () => {},
    signingOut: false,
    profile: {
      displayName: 'Camila',
      avatarUrl: null,
      avatarPreset: null,
      locale: 'es',
      listVisibility: 'private',
      counterMode: 'franchise',
      handle: 'camila',
      shownTotal: null,
      shownMode: null,
      cardShared: false,
      createdAt: '2026-11-01T12:00:00.000Z',
      analyticsId: null,
    },
  };
  const router = createMemoryRouter(
    [{ path: '/', element: <Outlet context={context} />, children: signedInRoutes }],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { fetchFn, router };
}

const writes = (fetchFn: ReturnType<typeof vi.fn>) =>
  fetchFn.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method)
    .map(([url, init]) => ({
      url,
      method: (init as RequestInit).method,
      body: (init as RequestInit).body ? JSON.parse((init as RequestInit).body as string) : null,
    }));

const entry = (title: string) => screen.getByRole('group', { name: title });
const option = (title: string, label: 'Viendo' | 'Vista') =>
  within(entry(title)).getByRole('button', { name: label });
const pressed = (title: string, label: 'Viendo' | 'Vista') =>
  option(title, label).getAttribute('aria-pressed');

describe('franchise detail', () => {
  it('@CA-RF16-01 shows 3 of 5 core entries seen and which ones are missing', async () => {
    renderAt('/franquicia/101', { marks: [mark(101), mark(102), mark(103)] });

    expect(await screen.findByRole('heading', { level: 1, name: 'Temporada 1' })).toBeTruthy();
    expect(await screen.findByText('3 de 5 vistas')).toBeTruthy();
    expect(screen.getByText('Parcial')).toBeTruthy();
    expect(screen.getByText('5 entradas · 2020–2024 · Acción · Sobrenatural')).toBeTruthy();
    const core = screen.getByRole('region', { name: 'Núcleo · cuenta para completar' });
    expect(
      within(core)
        .getAllByRole('group')
        .map((group) => group.getAttribute('aria-label')),
    ).toEqual(['Temporada 1', 'Temporada 2', 'Temporada 3', 'Temporada 4', 'Temporada 5']);
    expect(within(core).getAllByText('TV · 24 ep. · 2020')).toHaveLength(1);
    for (const title of ['Temporada 1', 'Temporada 2', 'Temporada 3']) {
      expect(pressed(title, 'Vista')).toBe('true');
    }
    for (const title of ['Temporada 4', 'Temporada 5']) {
      expect(pressed(title, 'Vista')).toBe('false');
      expect(pressed(title, 'Viendo')).toBe('false');
    }
  });

  it('marks one entry as seen at once, then saves it with its MAL id', async () => {
    let save: (response: Response) => void = () => {};
    const { fetchFn } = renderAt('/franquicia/101', {
      marks: [mark(101), mark(102), mark(103)],
      write: () =>
        new Promise<Response>((resolve) => {
          save = resolve;
        }),
    });
    await screen.findByText('3 de 5 vistas');

    await userEvent.click(option('Temporada 4', 'Vista'));

    // Optimistic (RNF-11): before the API answers.
    expect(pressed('Temporada 4', 'Vista')).toBe('true');
    expect(screen.getByText('4 de 5 vistas')).toBeTruthy();
    expect(writes(fetchFn)).toEqual([
      { url: '/api/v1/me/marks/104', method: 'PUT', body: { status: 'seen', malId: 1104 } },
    ]);
    save(json(mark(104)));
    await waitFor(() => expect(pressed('Temporada 4', 'Vista')).toBe('true'));
  });

  it('says an entry was marked as seen once it is saved, for the install suggestion (#44)', async () => {
    const onEntryMarkedSeen = vi.fn();
    renderAt('/franquicia/101', { marks: [mark(101)], onEntryMarkedSeen });
    await screen.findByText('1 de 5 vistas');

    await userEvent.click(option('Temporada 2', 'Viendo'));
    await waitFor(() => expect(pressed('Temporada 2', 'Viendo')).toBe('true'));
    expect(onEntryMarkedSeen).not.toHaveBeenCalled();

    await userEvent.click(option('Temporada 3', 'Vista'));
    await waitFor(() => expect(onEntryMarkedSeen).toHaveBeenCalledOnce());
  });

  it('marks an entry as watching, and the franchise shows as watching', async () => {
    const { fetchFn } = renderAt('/franquicia/101', { marks: [mark(101)] });
    await screen.findByText('1 de 5 vistas');

    await userEvent.click(option('Temporada 2', 'Viendo'));

    expect(pressed('Temporada 2', 'Viendo')).toBe('true');
    expect(screen.getByText('Viendo', { selector: '.status-chip' })).toBeTruthy();
    await waitFor(() =>
      expect(writes(fetchFn)).toEqual([
        { url: '/api/v1/me/marks/102', method: 'PUT', body: { status: 'watching', malId: 1102 } },
      ]),
    );
  });

  it('tapping the active option removes the mark of that entry', async () => {
    const { fetchFn } = renderAt('/franquicia/101', { marks: [mark(101), mark(102)] });
    await screen.findByText('2 de 5 vistas');

    await userEvent.click(option('Temporada 2', 'Vista'));

    expect(pressed('Temporada 2', 'Vista')).toBe('false');
    expect(screen.getByText('1 de 5 vistas')).toBeTruthy();
    await waitFor(() =>
      expect(writes(fetchFn)).toEqual([
        { url: '/api/v1/me/marks/102', method: 'DELETE', body: null },
      ]),
    );
  });

  it('a failed entry rolls back only that entry and says so', async () => {
    let failFirst: (error: Error) => void = () => {};
    renderAt('/franquicia/101', {
      marks: [mark(101)],
      write: (url) =>
        url.endsWith('/104')
          ? new Promise<Response>((_resolve, reject) => {
              failFirst = reject;
            })
          : json(mark(105)),
    });
    await screen.findByText('1 de 5 vistas');

    await userEvent.click(option('Temporada 4', 'Vista'));
    await userEvent.click(option('Temporada 5', 'Vista'));
    await waitFor(() => expect(pressed('Temporada 5', 'Vista')).toBe('true'));
    failFirst(new TypeError('Failed to fetch'));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'No pudimos guardar tu marca. Vuelve a intentarlo; lo que ya marcaste sigue guardado.',
    );
    expect(pressed('Temporada 4', 'Vista')).toBe('false');
    expect(pressed('Temporada 5', 'Vista')).toBe('true');
    expect(pressed('Temporada 1', 'Vista')).toBe('true');
  });

  it('"Marcar saga como vista" marks the whole core in one batch', async () => {
    const { fetchFn } = renderAt('/franquicia/101', { marks: [mark(101)] });
    await screen.findByText('1 de 5 vistas');

    await userEvent.click(screen.getByRole('button', { name: 'Marcar saga como vista' }));

    expect(await screen.findByText('5 de 5 vistas')).toBeTruthy();
    await waitFor(() => expect(writes(fetchFn)).toHaveLength(1));
    expect(writes(fetchFn)[0]).toEqual({
      url: '/api/v1/me/marks:batch',
      method: 'POST',
      body: {
        status: 'seen',
        entries: [101, 102, 103, 104, 105].map((id) => ({ animeId: id, malId: id + 1000 })),
      },
    });
    expect(await screen.findByRole('button', { name: 'Quitar saga de vistas' })).toBeTruthy();
  });

  it('"Quitar saga de vistas" unmarks the core and the extras when the core is seen', async () => {
    const { fetchFn } = renderAt('/franquicia/101', {
      marks: [mark(101), mark(102), mark(103), mark(104), mark(105), mark(109)],
    });
    expect(await screen.findByText('Vista', { selector: '.status-chip' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar saga de vistas' }));

    expect(await screen.findByText('0 de 5 vistas')).toBeTruthy();
    await waitFor(() => expect(writes(fetchFn)).toHaveLength(1));
    expect(writes(fetchFn)[0]?.body).toEqual({
      status: null,
      entries: [101, 102, 103, 104, 105, 109].map((id) => ({ animeId: id, malId: id + 1000 })),
    });
  });

  it('shows "Nueva temporada" when a season came out after the franchise was completed', async () => {
    const before = '2023-06-01T00:00:00.000Z';
    renderAt('/franquicia/101', {
      marks: [101, 102, 103, 104].map((id) => mark(id, 'seen', before)),
    });

    expect(await screen.findByText('Nueva temporada')).toBeTruthy();
    expect(
      screen.getByText('Salió una entrada nueva. Tu total no cambia: esta saga sigue sumando.'),
    ).toBeTruthy();
    expect(screen.getByText('4 de 5 vistas')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Marcar saga como vista' })).toBeTruthy();
  });

  it('shows the extras and links each related franchise to its own detail', async () => {
    const { router } = renderAt('/franquicia/101', { marks: [mark(109)] });

    const extras = await screen.findByRole('region', {
      name: 'Extras · no cuentan para completar',
    });
    expect(within(extras).getByText('OVA · 2020')).toBeTruthy();
    expect(pressed('Historia paralela', 'Vista')).toBe('true');
    // Extras never count (RF-15).
    expect(screen.getByText('0 de 5 vistas')).toBeTruthy();

    const related = screen.getByRole('region', { name: 'Franquicias relacionadas' });
    await userEvent.click(within(related).getByRole('link', { name: 'Spin-off' }));

    expect(router.state.location.pathname).toBe('/franquicia/107');
    expect(await screen.findByRole('heading', { level: 1, name: 'Spin-off' })).toBeTruthy();
  });

  it('a deep link loads the whole franchise from any of its entries', async () => {
    renderAt('/franquicia/104');

    expect(await screen.findByRole('heading', { level: 1, name: 'Temporada 1' })).toBeTruthy();
    expect(screen.getByText('0 de 5 vistas')).toBeTruthy();
    expect(screen.getByText('Sin marcar')).toBeTruthy();
  });

  it('says it could not reach AniList and retries', async () => {
    renderAt('/franquicia/101', { client: fakeAniList(1) });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No pudimos conectar con AniList');
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Temporada 1' })).toBeTruthy();
  });

  it('says so when AniList does not know the franchise', async () => {
    renderAt('/franquicia/999');

    expect(await screen.findByText('No encontramos esta franquicia en AniList.')).toBeTruthy();
  });
});

describe('catalog card', () => {
  it('opens the franchise detail and keeps the ✓ button that marks in one tap', async () => {
    const { router } = renderAt('/');

    expect(
      await screen.findByRole('button', { name: 'Marcar «Temporada 1» como vista' }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: 'Temporada 1' }));

    expect(router.state.location.pathname).toBe('/franquicia/101');
    expect(await screen.findByRole('heading', { level: 1, name: 'Temporada 1' })).toBeTruthy();
    expect(await screen.findByText('0 de 5 vistas')).toBeTruthy();
  });
});

describe('franchise detail in English (RF-70)', () => {
  afterEach(async () => {
    await setLocale('es');
  });

  it('shows the progress, the sections and the options in English', async () => {
    await setLocale('en');
    renderAt('/franquicia/101', { marks: [mark(101), mark(102), mark(103)] });

    expect(await screen.findByRole('heading', { level: 1, name: 'Temporada 1' })).toBeTruthy();
    expect(await screen.findByText('3 of 5 watched')).toBeTruthy();
    expect(screen.getByText('Partial')).toBeTruthy();
    expect(screen.getByText('5 entries · 2020–2024 · Action · Supernatural')).toBeTruthy();
    const core = screen.getByRole('region', { name: 'Core · counts toward completion' });
    expect(within(core).getAllByText('TV · 24 ep. · 2020')).toHaveLength(1);
    expect(
      within(within(core).getByRole('group', { name: 'Temporada 1' })).getByRole('button', {
        name: 'Watched',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark saga as watched' })).toBeTruthy();
    expect(screen.queryByText('Parcial')).toBeNull();
    expect(screen.queryByText('3 de 5 vistas')).toBeNull();
  });
});
