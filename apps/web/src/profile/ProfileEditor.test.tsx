// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AniListClient } from '../anilist/client';
import { cardImage } from '../card/image';
import { setLocale } from '../i18n';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';

vi.mock('../card/image', () => ({ cardImage: vi.fn() }));

beforeEach(() => {
  vi.mocked(cardImage).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
});
afterEach(cleanup);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const base: Profile = {
  displayName: 'Camila',
  avatarUrl: 'https://lh3.googleusercontent.com/a/camila',
  avatarPreset: null,
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
  handle: 'camila',
  shownTotal: 48,
  shownMode: 'franchise',
  cardShared: true,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
};

function renderEditor(
  options: { profile?: Partial<Profile>; failPatch?: boolean; patchProblem?: unknown } = {},
) {
  let profile = { ...base, ...options.profile };
  const patches: unknown[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: [], nextCursor: null });
    if (url === '/api/v1/me' && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string);
      if ('shown' in body) return json(profile);
      patches.push(body);
      if (options.failPatch) return json(options.patchProblem ?? { status: 503 }, 503);
      profile = { ...profile, ...body };
      return json(profile);
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Home
            profile={profile}
            onSignOut={() => {}}
            signingOut={false}
            signOutFailed={false}
            getToken={async () => 'jwt'}
            client={{ request: vi.fn() } as unknown as AniListClient}
            fetchFn={fetchFn as unknown as typeof fetch}
          />
        ),
        children: signedInRoutes,
      },
    ],
    { initialEntries: ['/perfil/editar'] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { patches, router };
}

const nameInput = () => screen.getByRole('textbox', { name: 'Nombre visible' }) as HTMLInputElement;
const avatarChoice = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;

describe('ProfileEditor', () => {
  it('shows the name and the avatar choices of Figma M06', async () => {
    renderEditor();
    await screen.findByRole('heading', { name: 'Así aparecerás en tu tarjeta' });
    expect(nameInput().value).toBe('Camila');
    screen.getByText('Así te verán en tu tarjeta y tu perfil');
    screen.getByText('6/30');
    screen.getByText('O elige uno de Acrux');
    expect(avatarChoice('Tu foto de Google').checked).toBe(true);
    for (const preset of ['violeta', 'verde', 'amarillo', 'coral', 'noche', 'lavanda']) {
      expect(avatarChoice(`Avatar ${preset}`).checked).toBe(false);
    }
  });

  it('@CA-RF07-01 saves "Cami" and a preset, and the card then shows them', async () => {
    const user = userEvent.setup();
    const { patches, router } = renderEditor();

    await user.clear(await screen.findByRole('textbox', { name: 'Nombre visible' }));
    await user.type(nameInput(), '  Cami ');
    await user.click(avatarChoice('Avatar verde'));
    screen.getByText('4/30');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/perfil'));
    expect(patches).toEqual([{ displayName: 'Cami', avatarPreset: 'verde' }]);

    await router.navigate('/tarjeta');
    const card = await screen.findByRole('figure', { name: 'Vista previa de tu tarjeta' });
    within(card).getByText('Cami');
    expect(card.querySelector('.avatar--verde')).not.toBeNull();
    // The header of the app shows them too.
    expect(screen.getByRole('img', { name: 'Cami' })).toBeTruthy();
  });

  it('goes back to the Google photo with a null preset', async () => {
    const user = userEvent.setup();
    const { patches } = renderEditor({ profile: { avatarPreset: 'coral' } });

    await user.click(await screen.findByRole('radio', { name: 'Tu foto de Google' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await vi.waitFor(() => expect(patches).toEqual([{ avatarPreset: null }]));
  });

  describe('Plus avatars (RF-55)', () => {
    it('@CA-RF55-03 shows the Plus avatars locked to a free user, with the way to Plus', async () => {
      renderEditor({ profile: { plan: 'free', plusAvailable: true } });
      const group = await screen.findByRole('group', { name: 'Exclusivos de Plus' });
      for (const preset of ['sakura', 'aurora', 'eclipse']) {
        expect(
          within(group).getByRole<HTMLInputElement>('radio', { name: `Avatar ${preset}` }).disabled,
        ).toBe(true);
      }
      const cta = within(group).getByRole('link', { name: 'Ver Acrux Plus' });
      expect(cta.getAttribute('href')).toBe('/perfil/plus');
    });

    it('says Plus arrives soon while billing is off', async () => {
      renderEditor({ profile: { plan: 'free', plusAvailable: false } });
      const group = await screen.findByRole('group', { name: 'Exclusivos de Plus' });
      within(group).getByText('Acrux Plus llega pronto.');
      expect(within(group).queryByRole('link')).toBeNull();
    });

    it('lets a Plus user pick a Plus avatar', async () => {
      const user = userEvent.setup();
      const { patches } = renderEditor({ profile: { plan: 'plus', plusAvailable: true } });

      await user.click(await screen.findByRole('radio', { name: 'Avatar aurora' }));
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      await vi.waitFor(() => expect(patches).toEqual([{ avatarPreset: 'aurora' }]));
      expect(screen.queryByRole('link', { name: 'Ver Acrux Plus' })).toBeNull();
    });
  });

  it('offers no Google photo when there is none', async () => {
    renderEditor({ profile: { avatarUrl: null } });
    await screen.findByRole('heading', { name: 'Así aparecerás en tu tarjeta' });
    expect(screen.queryByRole('radio', { name: 'Tu foto de Google' })).toBeNull();
  });

  it('saves nothing when nothing changed', async () => {
    const user = userEvent.setup();
    const { patches, router } = renderEditor();

    await user.click(await screen.findByRole('button', { name: 'Continuar' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/perfil'));
    expect(patches).toEqual([]);
  });

  it('asks for a name and stops at 30 characters', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.clear(await screen.findByRole('textbox', { name: 'Nombre visible' }));
    screen.getByText('Escribe un nombre.');
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await user.type(nameInput(), 'a'.repeat(35));
    expect(nameInput().value).toBe('a'.repeat(30));
    screen.getByText('30/30');
  });

  it('refuses, before saving, what the API refuses: invisible or control characters', async () => {
    const user = userEvent.setup();
    const { patches } = renderEditor();

    await user.clear(await screen.findByRole('textbox', { name: 'Nombre visible' }));
    await user.click(nameInput());
    await user.paste('Cami\tla');

    screen.getByText('Usa letras, números o emojis visibles.');
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(patches).toEqual([]);
  });

  it('says so and stays when saving fails', async () => {
    const user = userEvent.setup();
    const { router } = renderEditor({ failPatch: true });

    await user.type(await screen.findByRole('textbox', { name: 'Nombre visible' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No pudimos guardar. Vuelve a intentarlo.',
    );
    expect(router.state.location.pathname).toBe('/perfil/editar');
  });
});

describe('ProfileEditor in English and API codes (#43)', () => {
  afterEach(() => setLocale('es'));

  it('shows the editor and its hints in English', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole('heading', { name: "This is how you'll appear on your card" });
    screen.getByText('Or pick one from Acrux');
    expect(avatarChoice('Your Google photo').checked).toBe(true);
    avatarChoice('Violet avatar');
    screen.getByText('This is how you’ll look on your card and profile');
    await user.clear(screen.getByRole('textbox', { name: 'Display name' }));
    screen.getByText('Write a name.');
    screen.getByRole('button', { name: 'Continue' });
    expect(screen.queryByText('Escribe un nombre.')).toBeNull();
  });

  it("shows the API code's message when saving fails with one (ADR-0023)", async () => {
    const user = userEvent.setup();
    renderEditor({ failPatch: true, patchProblem: { status: 429, code: 'rate_limited' } });
    await user.type(await screen.findByRole('textbox', { name: 'Nombre visible' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
    );
  });
});
