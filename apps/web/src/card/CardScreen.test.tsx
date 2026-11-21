// @vitest-environment jsdom

import type { RelationType } from '@acrux/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogAnime } from '../catalog-source/client';
import { anime, fakeCatalogClient, serveFranchises } from '../catalog-source/test-support';
import type { DramaMarkDto } from '../drama-marks-api';
import type { Drama } from '../drama-source/client';
import { drama } from '../drama-source/test-support';
import { setLocale } from '../i18n';
import type { MarkDto } from '../marks-api';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';
import { cardImage } from './image';
import { shareOrDownload } from './share';

vi.mock('./image', () => ({ cardImage: vi.fn() }));
vi.mock('./share', () => ({ shareOrDownload: vi.fn() }));
// The routes hand the card no drama client, so the default one answers from DRAMAS.
vi.mock('../drama-source/hooks', async (original) => ({
  ...(await original<typeof import('../drama-source/hooks')>()),
  defaultDramaClient: {
    browse: async () => {
      throw new Error('Unexpected drama call: browse');
    },
    genres: async () => {
      throw new Error('Unexpected drama call: genres');
    },
    byIds: async (ids: readonly number[]) => {
      if (dramaCatalogFails) throw new Error('unavailable');
      return DRAMAS.filter((item) => ids.includes(item.id));
    },
  },
}));

const png = new Blob(['png'], { type: 'image/png' });
let dramaCatalogFails = false;

beforeEach(() => {
  vi.mocked(cardImage).mockResolvedValue(png);
  vi.mocked(shareOrDownload).mockResolvedValue('shared');
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  dramaCatalogFails = false;
});

// Saga A: seasons 1 → 2. Sagas B to E: one movie each.
const titles: Record<number, string> = {
  1: 'Saga A',
  2: 'Saga A 2',
  20: 'Saga B',
  30: 'Saga C',
  40: 'Saga D',
  50: 'Saga E',
};
const edges: Record<number, [RelationType, number][]> = { 1: [['SEQUEL', 2]], 2: [['PREQUEL', 1]] };
const cover = (id: number) => `https://cdn.example.test/anime/${id}.jpg`;

const row = (id: number): CatalogAnime | undefined =>
  id in titles
    ? anime(id, {
        title: titles[id] ?? `Media ${id}`,
        format: id < 20 ? 'TV' : 'MOVIE',
        coverUrl: cover(id),
        startDate: `${2000 + id}-01-01`,
        year: 2000 + id,
        relations: (edges[id] ?? []).map(([type, target]) => ({ type, id: target })),
      })
    : undefined;

const client = fakeCatalogClient({ franchises: async (seeds) => serveFranchises(row, seeds) });

const DRAMAS: Drama[] = [
  drama(1, { title: 'Crash Landing on You', year: 2019 }),
  drama(2, { title: 'Alice in Borderland', origin: 'JP', year: 2020 }),
  drama(3, { title: 'The Untold Palace', origin: 'CN', year: 2023 }),
];

const mark = (animeId: number, status: MarkDto['status'], day = 10): MarkDto => ({
  animeId,
  status,
  markedAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
});

const dramaMark = (dramaId: number, status: DramaMarkDto['status'], day = 10): DramaMarkDto => ({
  dramaId,
  status,
  markedAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const BASE: Profile = {
  displayName: 'Camila',
  avatarUrl: null,
  avatarPreset: null,
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
  handle: 'camila',
  shownTotal: null,
  shownMode: null,
  // Most tests share again; the first card asks for the name and avatar first (#39).
  cardShared: true,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
};

function renderCard(
  marks: MarkDto[],
  profile: Partial<Profile> = {},
  options: { failPatch?: boolean; dramas?: DramaMarkDto[] | 'fail' } = {},
) {
  const patches: Record<string, unknown>[] = [];
  let saved: Record<string, unknown> = {};
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: marks, nextCursor: null });
    if (url.startsWith('/api/v1/me/drama-marks?')) {
      return options.dramas === 'fail'
        ? json({ status: 503, code: 'drama_marks.unavailable' }, 503)
        : json({ items: options.dramas ?? [], nextCursor: null });
    }
    if (url === '/api/v1/me' && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string);
      // The header counter saves the shown total on its own (#37).
      if ('shown' in body) return json({ status: 503 }, 503);
      patches.push(body);
      if (options.failPatch) return json({ status: 503 }, 503);
      saved = { ...saved, ...body };
      return json({ ...BASE, ...profile, ...saved });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const onCardGenerated = vi.fn();
  const onCardShared = vi.fn();
  const onListMadePublic = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Home
            profile={{ ...BASE, ...profile }}
            onSignOut={() => {}}
            signingOut={false}
            signOutFailed={false}
            getToken={async () => 'jwt'}
            client={client}
            fetchFn={fetchFn as unknown as typeof fetch}
            onCardGenerated={onCardGenerated}
            onCardShared={onCardShared}
            onListMadePublic={onListMadePublic}
          />
        ),
        children: signedInRoutes,
      },
    ],
    { initialEntries: ['/tarjeta'] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { onCardGenerated, onCardShared, onListMadePublic, patches };
}

const card = () => screen.getByRole('figure', { name: 'Vista previa de tu tarjeta' });
// The covers of the card, by the heading they sit under.
const coversUnder = (heading: string) =>
  [
    ...(within(card())
      .queryByText(heading)
      ?.parentElement?.querySelectorAll('.share-card__cover') ?? []),
  ].map((img) => img.getAttribute('alt'));
const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;

describe('CardScreen', () => {
  it('credits MyAnimeList with a link (ADR-0043)', async () => {
    renderCard([mark(1, 'seen')]);
    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    expect((await screen.findByRole('link', { name: 'MyAnimeList' })).getAttribute('href')).toBe(
      'https://myanimelist.net',
    );
  });

  it('@CA-RF30-01 opens on the card with my total, name, avatar and what I am watching, and shares it', async () => {
    const user = userEvent.setup();
    const { onCardGenerated, onCardShared } = renderCard(
      [
        mark(1, 'seen'),
        mark(2, 'seen'),
        mark(20, 'watching', 12),
        mark(30, 'watching', 11),
        mark(40, 'watching', 10),
      ],
      { avatarUrl: 'https://lh3.googleusercontent.com/a/camila' },
    );

    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    const preview = within(card());
    preview.getByText('1');
    preview.getByText('ANIMES COMPLETOS');
    preview.getByText('Camila');
    expect(card().querySelector('.share-card__avatar')?.getAttribute('src')).toBe(
      'https://lh3.googleusercontent.com/a/camila',
    );
    // Without choosing: the first two in Viendo.
    expect(coversUnder('ANIME')).toEqual(['Saga B', 'Saga C']);
    preview.getByAltText('Acrux');

    const share = await screen.findByRole('button', { name: 'Compartir' });
    await vi.waitFor(() => expect((share as HTMLButtonElement).disabled).toBe(false));
    expect(cardImage).toHaveBeenCalledOnce();
    expect(onCardGenerated).toHaveBeenCalledWith({ mode: 'franchise', covers: 2 });

    await user.click(share);
    expect(shareOrDownload).toHaveBeenCalledWith(png, { download: false });
    expect(onCardShared).toHaveBeenCalledWith({ method: 'share' });
  });

  it('downloads the image with "Descargar imagen"', async () => {
    const user = userEvent.setup();
    vi.mocked(shareOrDownload).mockResolvedValue('downloaded');
    const { onCardShared } = renderCard([mark(20, 'seen')]);

    const download = await screen.findByRole('button', { name: 'Descargar imagen' });
    await vi.waitFor(() => expect((download as HTMLButtonElement).disabled).toBe(false));
    await user.click(download);

    expect(shareOrDownload).toHaveBeenCalledWith(png, { download: true });
    expect(onCardShared).toHaveBeenCalledWith({ method: 'download' });
  });

  it('reports the download when the browser could not share', async () => {
    const user = userEvent.setup();
    vi.mocked(shareOrDownload).mockResolvedValue('downloaded');
    const { onCardShared } = renderCard([mark(20, 'seen')]);

    const share = await screen.findByRole('button', { name: 'Compartir' });
    await vi.waitFor(() => expect((share as HTMLButtonElement).disabled).toBe(false));
    await user.click(share);

    expect(onCardShared).toHaveBeenCalledWith({ method: 'download' });
  });

  it('sends no card_shared when the share sheet is closed', async () => {
    const user = userEvent.setup();
    vi.mocked(shareOrDownload).mockResolvedValue('cancelled');
    const { onCardShared } = renderCard([mark(20, 'seen')]);

    const share = await screen.findByRole('button', { name: 'Compartir' });
    await vi.waitFor(() => expect((share as HTMLButtonElement).disabled).toBe(false));
    await user.click(share);

    expect(shareOrDownload).toHaveBeenCalledOnce();
    expect(onCardShared).not.toHaveBeenCalled();
  });

  it('@CA-RF30-03 lets me put on the card anything in my list, watching or seen', async () => {
    const user = userEvent.setup();
    renderCard([mark(1, 'seen'), mark(2, 'seen'), mark(20, 'watching', 12)]);

    await screen.findByRole('heading', { name: 'Elige qué mostrar' });
    screen.getByRole('group', { name: 'Anime · 1 de 2' });
    expect(box('Saga B').checked).toBe(true);
    expect(box('Saga A').checked).toBe(false);

    await user.click(box('Saga A'));

    screen.getByRole('group', { name: 'Anime · 2 de 2' });
    expect(coversUnder('ANIME')).toEqual(['Saga B', 'Saga A']);
    // A new image for what the card shows now.
    await vi.waitFor(() => expect(cardImage).toHaveBeenCalledTimes(2));
  });

  it('@CA-RF30-04 lets me choose at most two anime', async () => {
    const user = userEvent.setup();
    renderCard([mark(20, 'watching', 14), mark(30, 'watching', 13), mark(40, 'watching', 12)]);

    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    expect(box('Saga D').checked).toBe(false);
    expect(box('Saga D').disabled).toBe(true);

    await user.click(box('Saga C'));
    expect(box('Saga D').disabled).toBe(false);
    await user.click(box('Saga D'));

    expect(coversUnder('ANIME')).toEqual(['Saga B', 'Saga D']);
  });

  it('@CA-RF30-04 shows my dramas apart from my anime, at most two of them', async () => {
    const user = userEvent.setup();
    const { onCardGenerated } = renderCard(
      [mark(20, 'watching')],
      {},
      {
        dramas: [dramaMark(1, 'watching', 12), dramaMark(2, 'seen', 11), dramaMark(3, 'seen', 10)],
      },
    );

    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    expect(coversUnder('ANIME')).toEqual(['Saga B']);
    expect(coversUnder('DRAMAS')).toEqual(['Crash Landing on You']);
    screen.getByRole('group', { name: 'Dramas · 1 de 2' });
    await vi.waitFor(() =>
      expect(onCardGenerated).toHaveBeenCalledWith({ mode: 'franchise', covers: 2 }),
    );

    await user.click(box('Alice in Borderland'));

    expect(coversUnder('DRAMAS')).toEqual(['Crash Landing on You', 'Alice in Borderland']);
    expect(box('The Untold Palace').disabled).toBe(true);
    // The anime limit is its own.
    expect(box('Saga B').disabled).toBe(false);
  });

  it('@CA-RF30-05 sums up how many anime and dramas I have seen', async () => {
    renderCard(
      [mark(1, 'seen'), mark(2, 'seen'), mark(20, 'seen')],
      {},
      {
        dramas: [dramaMark(1, 'watching'), dramaMark(2, 'seen'), dramaMark(3, 'seen')],
      },
    );

    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    const figures = [...card().querySelectorAll('.share-card__total')].map(
      (total) => total.textContent,
    );
    expect(figures).toEqual(['2ANIMES COMPLETOS', '2DRAMAS VISTOS']);
  });

  it('leaves the dramas out of the card of someone who marked none', async () => {
    renderCard([mark(20, 'watching')]);

    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    expect(within(card()).queryByText('DRAMAS VISTOS')).toBeNull();
    expect(within(card()).queryByText('DRAMAS')).toBeNull();
    screen.getByText('Aún no marcas dramas.');
    expect(screen.getByRole('link', { name: 'Explorar dramas' }).getAttribute('href')).toBe(
      '/dramas',
    );
  });

  it('still makes the card when the dramas cannot be loaded', async () => {
    renderCard([mark(20, 'watching')], {}, { dramas: 'fail' });

    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    expect(coversUnder('ANIME')).toEqual(['Saga B']);
    expect(within(card()).queryByText('DRAMAS VISTOS')).toBeNull();
    screen.getByText('No pudimos cargar tus dramas. Tu tarjeta va sin ellos por ahora.');
  });

  it('keeps the drama total when only their covers cannot be loaded', async () => {
    dramaCatalogFails = true;
    renderCard([mark(20, 'watching')], {}, { dramas: [dramaMark(1, 'seen')] });

    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    within(card()).getByText('DRAMAS VISTOS');
    screen.getByText('No pudimos cargar tus dramas. Tu tarjeta va sin ellos por ahora.');
  });

  it('filters my anime and my dramas with the search', async () => {
    const user = userEvent.setup();
    renderCard(
      [mark(20, 'watching'), mark(30, 'watching')],
      {},
      {
        dramas: [dramaMark(1, 'seen'), dramaMark(2, 'seen')],
      },
    );

    await user.type(await screen.findByRole('searchbox', { name: 'Buscar en tu lista' }), 'saga c');
    expect(screen.getAllByRole('checkbox').map((item) => item.getAttribute('aria-label'))).toEqual([
      'Saga C',
    ]);

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar en tu lista' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar en tu lista' }), 'alice');
    expect(screen.getAllByRole('checkbox').map((item) => item.getAttribute('aria-label'))).toEqual([
      'Alice in Borderland',
    ]);
    // What was chosen stays on the card while it is filtered out of sight.
    expect(coversUnder('ANIME')).toEqual(['Saga B', 'Saga C']);
  });

  it('leaves out the "ANIME" heading when nothing is chosen', async () => {
    const user = userEvent.setup();
    renderCard([mark(20, 'watching')]);

    await user.click(await screen.findByRole('checkbox', { name: 'Saga B' }));

    expect(within(card()).queryByText('ANIME')).toBeNull();
    expect(card().querySelectorAll('.share-card__cover')).toHaveLength(0);
  });

  it('counts by entries and names a profile without a name', async () => {
    renderCard([mark(20, 'seen')], { displayName: '', counterMode: 'entry' });

    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    const preview = within(card());
    preview.getByText('ENTRADAS VISTAS');
    preview.getByText('Sin nombre');
    preview.getByText('?');
    // Nothing in Viendo: nothing chosen until I pick it.
    expect(preview.queryByText('ANIME')).toBeNull();
    expect(box('Saga B').checked).toBe(false);
  });

  it('offers a retry when the image cannot be made', async () => {
    const user = userEvent.setup();
    vi.mocked(cardImage).mockRejectedValueOnce(new Error('tainted'));
    const { onCardGenerated } = renderCard([mark(20, 'seen')]);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No pudimos crear la imagen de tu tarjeta. Vuelve a intentarlo.',
    );
    expect((screen.getByRole('button', { name: 'Compartir' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(onCardGenerated).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await vi.waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Compartir' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(vi.mocked(cardImage).mock.calls.map((call) => call[1])).toEqual([
      { retry: false },
      { retry: true },
    ]);
  });

  it('is in the navigation bar', async () => {
    renderCard([]);
    const link = await screen.findByRole('link', { name: 'Tarjeta' });
    expect(link.getAttribute('href')).toBe('/tarjeta');
    expect(link.getAttribute('aria-current')).toBe('page');
  });

  describe('the link to the public profile (#37)', () => {
    async function shareOnce(user: ReturnType<typeof userEvent.setup>) {
      const step = await screen.findByRole('heading', { name: /Así aparecerás|Tu tarjeta/ });
      if (step.textContent === 'Así aparecerás en tu tarjeta') {
        await user.click(screen.getByRole('button', { name: 'Continuar' }));
      }
      const share = await screen.findByRole('button', { name: 'Compartir' });
      await vi.waitFor(() => expect((share as HTMLButtonElement).disabled).toBe(false));
      await user.click(share);
    }

    it('carries the link to my profile and its QR (RF-32)', async () => {
      renderCard([mark(20, 'seen')]);
      await screen.findByRole('heading', { name: 'Tu tarjeta' });
      within(card()).getByText(`${window.location.host}/@camila`);
      const qr = card().querySelector('.share-card__qr svg');
      expect(qr?.getAttribute('aria-hidden')).toBe('true');
      expect(qr?.querySelector('path')?.getAttribute('d')).toMatch(/^M/);
    });

    it('links to who sees my list', async () => {
      renderCard([mark(20, 'seen')]);
      const link = await screen.findByRole('link', { name: /¿Quién ve tu lista\?/ });
      expect(link.getAttribute('href')).toBe('/privacidad');
      expect(link.textContent).toContain('Privada');
    });

    it('@CA-RF30-02 offers to make my private list public when I share my first card', async () => {
      const user = userEvent.setup();
      const { patches, onListMadePublic } = renderCard([mark(20, 'seen')], { cardShared: false });

      await shareOnce(user);

      await screen.findByRole('heading', { name: '¿Hacemos pública tu lista?' });
      screen.getByText(
        'Así, quien escanee tu QR verá lo que estás viendo y tus sagas más recientes.',
      );
      await vi.waitFor(() => expect(patches).toEqual([{ cardShared: true }]));

      await user.click(screen.getByRole('button', { name: 'Hacer pública' }));

      await screen.findByText('Listo, tu lista es pública.');
      expect(patches).toEqual([{ cardShared: true }, { listVisibility: 'public' }]);
      expect(onListMadePublic).toHaveBeenCalledWith({ source: 'first_share' });
      expect(screen.getByRole('link', { name: /¿Quién ve tu lista\?/ }).textContent).toContain(
        'Pública',
      );
    });

    it('closes the offer with "Ahora no", keeping the list private', async () => {
      const user = userEvent.setup();
      const { patches } = renderCard([mark(20, 'seen')], { cardShared: false });

      await shareOnce(user);
      await user.click(await screen.findByRole('button', { name: 'Ahora no' }));

      expect(screen.queryByRole('heading', { name: '¿Hacemos pública tu lista?' })).toBeNull();
      expect(patches).toEqual([{ cardShared: true }]);
    });

    it('does not offer it again after the first card', async () => {
      const user = userEvent.setup();
      const { patches } = renderCard([mark(20, 'seen')], { cardShared: true });

      await shareOnce(user);

      await vi.waitFor(() => expect(shareOrDownload).toHaveBeenCalledOnce());
      expect(screen.queryByRole('heading', { name: '¿Hacemos pública tu lista?' })).toBeNull();
      expect(patches).toEqual([]);
    });

    it('does not offer it for a public list, but remembers the first card', async () => {
      const user = userEvent.setup();
      const { patches } = renderCard([mark(20, 'seen')], {
        listVisibility: 'public',
        cardShared: false,
      });

      await shareOnce(user);

      await vi.waitFor(() => expect(patches).toEqual([{ cardShared: true }]));
      expect(screen.queryByRole('heading', { name: '¿Hacemos pública tu lista?' })).toBeNull();
    });

    it('does not count a closed share sheet as the first card', async () => {
      const user = userEvent.setup();
      vi.mocked(shareOrDownload).mockResolvedValue('cancelled');
      const { patches } = renderCard([mark(20, 'seen')], { cardShared: false });

      await shareOnce(user);

      expect(screen.queryByRole('heading', { name: '¿Hacemos pública tu lista?' })).toBeNull();
      expect(patches).toEqual([]);
    });

    it('says so when making the list public fails', async () => {
      const user = userEvent.setup();
      renderCard([mark(20, 'seen')], { cardShared: false }, { failPatch: true });

      await shareOnce(user);
      await user.click(await screen.findByRole('button', { name: 'Hacer pública' }));

      expect((await screen.findByRole('alert')).textContent).toContain(
        'No pudimos guardar. Vuelve a intentarlo.',
      );
    });
  });

  describe('the name and avatar before the first card (#39, Figma M06)', () => {
    it('asks for them before the first card', async () => {
      const user = userEvent.setup();
      const { patches } = renderCard([mark(20, 'watching')], { cardShared: false });

      await screen.findByRole('heading', { name: 'Así aparecerás en tu tarjeta' });
      await user.click(screen.getByRole('radio', { name: 'Avatar coral' }));
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      await screen.findByRole('heading', { name: 'Tu tarjeta' });
      expect(card().querySelector('.avatar--coral')).not.toBeNull();
      expect(patches).toEqual([{ avatarPreset: 'coral' }]);
    });

    it('does not ask after the first card', async () => {
      renderCard([mark(20, 'seen')]);
      await screen.findByRole('heading', { name: 'Tu tarjeta' });
      expect(screen.queryByRole('heading', { name: 'Así aparecerás en tu tarjeta' })).toBeNull();
    });
  });
});

describe('CardScreen in English (RF-70)', () => {
  afterEach(async () => {
    await setLocale('es');
  });

  it('builds the card and its choices in English', async () => {
    await setLocale('en');
    renderCard(
      [mark(1, 'seen'), mark(2, 'seen'), mark(20, 'watching', 12)],
      {},
      {
        dramas: [dramaMark(1, 'watching')],
      },
    );

    await screen.findByRole('heading', { name: 'Your card' });
    const preview = within(screen.getByRole('figure', { name: 'Preview of your card' }));
    preview.getByText('ANIME COMPLETED');
    preview.getByText('DRAMAS WATCHED');
    preview.getByText('ANIME');
    preview.getByText('DRAMAS');
    expect(preview.queryByText('ANIMES COMPLETOS')).toBeNull();
    screen.getByRole('heading', { name: 'Choose what to show' });
    screen.getByRole('group', { name: 'Anime · 1 of 2' });
    screen.getByRole('group', { name: 'Dramas · 1 of 2' });
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Descargar imagen' })).toBeNull();
  });

  it('names the card of a profile without a name in English', async () => {
    await setLocale('en');
    renderCard([mark(20, 'seen')], { displayName: '', counterMode: 'entry' });

    await screen.findByRole('heading', { name: 'Your card' });
    const preview = within(screen.getByRole('figure', { name: 'Preview of your card' }));
    preview.getByText('ENTRIES WATCHED');
    preview.getByText('No name');
  });
});
