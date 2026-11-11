// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AniListClient } from '../anilist/client';
import type { StatsMedia } from '../anilist/queries';
import { setLocale } from '../i18n';
import type { MarkDto } from '../marks-api';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';

// Badges by milestones (RF-55, epic #50): everyone sees their progress and earns them; Plus
// shows them on the public profile and the card.
afterEach(async () => {
  cleanup();
  await setLocale('es');
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const free: Profile = {
  displayName: 'Camila',
  avatarUrl: null,
  avatarPreset: 'lavanda',
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
  handle: 'camila',
  shownTotal: 12,
  shownMode: 'franchise',
  cardShared: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
  plan: 'free',
  plusAvailable: true,
  badges: [],
};
const plus: Profile = { ...free, plan: 'plus' };

const mark = (animeId: number, status: MarkDto['status'] = 'seen'): MarkDto => ({
  animeId,
  malId: null,
  status,
  markedAt: '2026-10-10T12:00:00.000Z',
});

// Twelve seen titles of one 24-minute episode each, in four genres: titles_10 only.
const media = (id: number): StatsMedia => ({
  id,
  format: 'TV',
  seasonYear: 2020,
  episodes: 1,
  duration: 24,
  genres: [['Action', 'Drama', 'Comedy', 'Romance'][id % 4] as string],
});
const seen = Array.from({ length: 12 }, (_, index) => index + 1);

function renderBadges(options: { profile?: Profile; marks?: MarkDto[] } = {}) {
  const profile = options.profile ?? free;
  const marks = options.marks ?? [...seen.map((id) => mark(id)), mark(99, 'watching')];
  const patches: unknown[] = [];
  const client = {
    request: vi.fn(async (query: string, variables: Record<string, unknown>, schema) => {
      if (!query.includes('MediaStats')) return schema.parse({ Page: { media: [] } });
      const ids = variables.ids as number[];
      return schema.parse({ Page: { media: ids.map(media) } });
    }),
  } as unknown as AniListClient;
  let current = profile;
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: marks, nextCursor: null });
    if (url === '/api/v1/me' && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string);
      if ('shown' in body) return json(current);
      patches.push(body);
      current = { ...current, ...body };
      return json(current);
    }
    if (url === '/api/v1/me') return json(current);
    throw new Error(`Unexpected request ${url}`);
  });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Home
            profile={profile}
            onSignOut={vi.fn()}
            signingOut={false}
            signOutFailed={false}
            getToken={async () => 'jwt'}
            client={client}
            fetchFn={fetchFn as unknown as typeof fetch}
          />
        ),
        children: signedInRoutes,
      },
    ],
    { initialEntries: ['/perfil/insignias'] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { patches, router };
}

const badgesPage = () => screen.findByRole('region', { name: 'Insignias' });
const badgeList = async () =>
  within(await badgesPage()).findByRole('list', { name: 'Tus insignias' });

describe('BadgesScreen (RF-55)', () => {
  it('@CA-RF55-01 earns the badges of the seen titles, keeps them and shows the progress of the rest', async () => {
    const { patches } = renderBadges({ profile: plus });
    const list = await badgeList();

    const earned = within(list).getByRole('listitem', { name: '10 títulos vistos' });
    within(earned).getByText('Ganada');
    const next = within(list).getByRole('listitem', { name: '50 títulos vistos' });
    within(next).getByText('12 de 50');
    within(list).getByRole('listitem', { name: '5 géneros distintos' });
    within(await badgesPage()).getByText('1 de 9 ganadas');
    within(await badgesPage()).getByText('Se ven en tu perfil público y en tu tarjeta.');
    // Watching titles do not count; the earned ones are saved once.
    await vi.waitFor(() => expect(patches).toEqual([{ badges: ['titles_10'] }]));
  });

  it('@CA-RF55-02 lets a free user earn them and shows that Plus puts them on the profile', async () => {
    const { patches } = renderBadges();
    const page = await badgesPage();
    await within(page).findByText('1 de 9 ganadas');
    within(page).getByText('Con Plus, tus insignias se ven en tu perfil público y en tu tarjeta.');
    const cta = within(page).getByRole('link', { name: 'Ver Acrux Plus' });
    expect(cta.getAttribute('href')).toBe('/perfil/plus');
    // Stored for free users too, so they show as soon as Plus is bought.
    await vi.waitFor(() => expect(patches).toEqual([{ badges: ['titles_10'] }]));
  });

  it('saves nothing when the stored badges are already the earned ones', async () => {
    const { patches } = renderBadges({ profile: { ...plus, badges: ['titles_10'] } });
    await within(await badgesPage()).findByText('1 de 9 ganadas');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(patches).toEqual([]);
  });

  it('invites to mark titles when nothing is seen yet', async () => {
    renderBadges({ marks: [mark(99, 'watching')] });
    expect(
      await within(await badgesPage()).findByText('Marca animes como vistos para ganar insignias.'),
    ).toBeTruthy();
  });

  it('is reachable from Perfil', async () => {
    const { router } = renderBadges();
    await router.navigate('/perfil');
    const link = await screen.findByRole('link', { name: /Insignias/ });
    expect(link.getAttribute('href')).toBe('/perfil/insignias');
  });
});
