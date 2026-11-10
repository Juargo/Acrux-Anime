// @vitest-environment jsdom

import type { RelationType } from '@acrux/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogAnime } from '../catalog-source/client';
import { anime, fakeCatalogClient, serveFranchises } from '../catalog-source/test-support';
import { setLocale } from '../i18n';
import type { MarkDto } from '../marks-api';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';
import { cardImage } from './image';
import { shareOrDownload } from './share';

vi.mock('./image', () => ({ cardImage: vi.fn() }));
vi.mock('./share', () => ({ shareOrDownload: vi.fn() }));

const png = new Blob(['png'], { type: 'image/png' });

beforeEach(() => {
  vi.mocked(cardImage).mockResolvedValue(png);
  vi.mocked(shareOrDownload).mockResolvedValue('shared');
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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

const mark = (animeId: number, status: MarkDto['status'], day = 10): MarkDto => ({
  animeId,
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
  options: { failPatch?: boolean } = {},
) {
  const patches: Record<string, unknown>[] = [];
  let saved: Record<string, unknown> = {};
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: marks, nextCursor: null });
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
const coverTitles = () =>
  [...card().querySelectorAll('.share-card__cover')].map((img) => img.getAttribute('alt'));
const choices = () => screen.getAllByRole('checkbox');

describe('CardScreen', () => {
  it('@CA-RF30-01 builds the card with my total, name, avatar and what I am watching, and shares it', async () => {
    const user = userEvent.setup();
    const { onCardGenerated, onCardShared } = renderCard(
      [mark(1, 'seen'), mark(2, 'seen'), mark(20, 'watching', 12), mark(30, 'watching', 11)],
      { avatarUrl: 'https://lh3.googleusercontent.com/a/camila' },
    );

    await screen.findByRole('heading', { name: '¿Qué estás viendo ahora?' });
    screen.getByText('Aparecerá en tu tarjeta. Es opcional.');
    expect(choices().map((box) => (box as HTMLInputElement).checked)).toEqual([true, true]);
    await user.click(screen.getByRole('button', { name: 'Continuar (2)' }));

    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    const preview = within(card());
    preview.getByText('1');
    preview.getByText('ANIMES COMPLETOS');
    preview.getByText('Camila');
    expect(card().querySelector('.share-card__avatar')?.getAttribute('src')).toBe(
      'https://lh3.googleusercontent.com/a/camila',
    );
    preview.getByText('VIENDO AHORA');
    expect(coverTitles()).toEqual(['Saga B', 'Saga C']);
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

  it('"Saltar" keeps the first three franchises in Viendo', async () => {
    const user = userEvent.setup();
    renderCard([
      mark(20, 'watching', 14),
      mark(30, 'watching', 13),
      mark(40, 'watching', 12),
      mark(50, 'watching', 11),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Saltar' }));

    expect(coverTitles()).toEqual(['Saga B', 'Saga C', 'Saga D']);
  });

  it('lets me choose at most three franchises', async () => {
    const user = userEvent.setup();
    renderCard([
      mark(20, 'watching', 14),
      mark(30, 'watching', 13),
      mark(40, 'watching', 12),
      mark(50, 'watching', 11),
    ]);

    const sagaE = await screen.findByRole('checkbox', { name: 'Saga E' });
    expect((sagaE as HTMLInputElement).checked).toBe(false);
    expect((sagaE as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: 'Saga C' }));
    expect((sagaE as HTMLButtonElement).disabled).toBe(false);
    await user.click(sagaE);
    await user.click(screen.getByRole('button', { name: 'Continuar (3)' }));

    expect(coverTitles()).toEqual(['Saga B', 'Saga D', 'Saga E']);
  });

  it('filters the franchises with the search', async () => {
    const user = userEvent.setup();
    renderCard([mark(20, 'watching'), mark(30, 'watching')]);

    await user.type(await screen.findByRole('searchbox', { name: 'Buscar anime' }), 'saga c');

    expect(choices().map((box) => box.getAttribute('aria-label'))).toEqual(['Saga C']);
  });

  it('leaves out "VIENDO AHORA" when nothing is chosen', async () => {
    const user = userEvent.setup();
    renderCard([mark(20, 'watching')]);

    await user.click(await screen.findByRole('checkbox', { name: 'Saga B' }));
    await user.click(screen.getByRole('button', { name: 'Continuar (0)' }));

    expect(within(card()).queryByText('VIENDO AHORA')).toBeNull();
  });

  it('skips the question when nothing is in Viendo', async () => {
    renderCard([mark(20, 'seen')], { displayName: '', counterMode: 'entry' });

    await screen.findByRole('heading', { name: 'Tu tarjeta' });
    expect(screen.queryByRole('button', { name: '‹ Volver' })).toBeNull();
    const preview = within(card());
    preview.getByText('ENTRADAS VISTAS');
    preview.getByText('Sin nombre');
    preview.getByText('?');
    expect(preview.queryByText('VIENDO AHORA')).toBeNull();
  });

  it('goes back to the question from the preview', async () => {
    const user = userEvent.setup();
    renderCard([mark(20, 'watching')]);

    await user.click(await screen.findByRole('button', { name: 'Continuar (1)' }));
    await user.click(screen.getByRole('button', { name: '‹ Volver' }));

    screen.getByRole('heading', { name: '¿Qué estás viendo ahora?' });
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
    it('asks for them between "¿Qué estás viendo ahora?" and the preview', async () => {
      const user = userEvent.setup();
      const { patches } = renderCard([mark(20, 'watching')], { cardShared: false });

      await user.click(await screen.findByRole('button', { name: 'Continuar (1)' }));
      await screen.findByRole('heading', { name: 'Así aparecerás en tu tarjeta' });
      await user.click(screen.getByRole('radio', { name: 'Avatar coral' }));
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      await screen.findByRole('heading', { name: 'Tu tarjeta' });
      expect(card().querySelector('.avatar--coral')).not.toBeNull();
      expect(patches).toEqual([{ avatarPreset: 'coral' }]);
    });

    it('asks for them even with nothing in Viendo, and goes back to the question from them', async () => {
      const user = userEvent.setup();
      renderCard([mark(20, 'watching')], { cardShared: false });

      await user.click(await screen.findByRole('button', { name: 'Continuar (1)' }));
      await user.click(await screen.findByRole('button', { name: '‹ Volver' }));
      await screen.findByRole('heading', { name: '¿Qué estás viendo ahora?' });

      cleanup();
      renderCard([mark(20, 'seen')], { cardShared: false });
      await screen.findByRole('heading', { name: 'Así aparecerás en tu tarjeta' });
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

  it('asks what I am watching and builds the card in English', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    renderCard([mark(1, 'seen'), mark(2, 'seen'), mark(20, 'watching', 12)]);

    await screen.findByRole('heading', { name: 'What are you watching now?' });
    await user.click(screen.getByRole('button', { name: 'Continue (1)' }));

    await screen.findByRole('heading', { name: 'Your card' });
    const preview = within(screen.getByRole('figure', { name: 'Preview of your card' }));
    preview.getByText('ANIME COMPLETED');
    preview.getByText('WATCHING NOW');
    expect(preview.queryByText('ANIMES COMPLETOS')).toBeNull();
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
