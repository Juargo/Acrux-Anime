// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AniListClient } from '../anilist/client';
import { i18n, setLocale } from '../i18n';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';

afterEach(async () => {
  cleanup();
  await setLocale('es');
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const base: Profile = {
  displayName: 'Camila',
  avatarUrl: null,
  avatarPreset: 'lavanda',
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

function renderProfile(options: { failPatch?: boolean } = {}) {
  const patches: unknown[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: [], nextCursor: null });
    if (url === '/api/v1/me/export') return json({ profile: {}, marks: [] });
    if (url === '/api/v1/me' && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string);
      if ('shown' in body) return json(base);
      patches.push(body);
      if (options.failPatch) return json({ status: 503 }, 503);
      return json({ ...base, ...body });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const onSignOut = vi.fn();
  const onCounterModeChanged = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Home
            profile={base}
            onSignOut={onSignOut}
            onCounterModeChanged={onCounterModeChanged}
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
    { initialEntries: ['/perfil'] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { patches, onSignOut, onCounterModeChanged, router };
}

const page = () => screen.getByRole('region', { name: 'Perfil' });
const row = (name: RegExp) => within(page()).getByRole('link', { name });

describe('ProfileScreen', () => {
  it('downloads my data as a JSON file (#38)', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:acrux');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    // jsdom has no object URLs.
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    renderProfile();
    await user.click(
      await within(await screen.findByRole('region', { name: 'Perfil' })).findByRole('button', {
        name: /Descargar mis datos/,
      }),
    );
    await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('acrux-datos.json');
    click.mockRestore();
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });

  it('opens "Borrar tu cuenta" from "Borrar cuenta" (#38)', async () => {
    const user = userEvent.setup();
    const { router } = renderProfile();
    await screen.findByRole('region', { name: 'Perfil' });
    await user.click(row(/Borrar cuenta/));
    expect(router.state.location.pathname).toBe('/perfil/borrar-cuenta');
    await screen.findByRole('heading', { name: 'Borrar tu cuenta' });
  });

  it('opens "Acerca de Acrux" with the AniList attribution from "Acerca de" (#45)', async () => {
    const user = userEvent.setup();
    const { router } = renderProfile();
    await screen.findByRole('region', { name: 'Perfil' });
    await user.click(row(/Acerca de/));
    expect(router.state.location.pathname).toBe('/perfil/acerca-de');
    await screen.findByRole('heading', { name: 'Acerca de Acrux' });
    expect(screen.getByRole('link', { name: 'AniList' })).toBeTruthy();
  });

  it('shows who I am, my link and "Editar" (Figma M16)', async () => {
    renderProfile();
    await screen.findByRole('region', { name: 'Perfil' });
    within(page()).getByRole('heading', { name: 'Camila' });
    within(page()).getByText(`@camila · ${window.location.host}/@camila`);
    expect(page().querySelector('.avatar--lavanda')).not.toBeNull();
    expect(within(page()).getByRole('link', { name: 'Editar' }).getAttribute('href')).toBe(
      '/perfil/editar',
    );
  });

  it('links "Tu lista" to who sees it, with its current value', async () => {
    renderProfile();
    await screen.findByRole('region', { name: 'Perfil' });
    const link = row(/Tu lista/);
    expect(link.getAttribute('href')).toBe('/privacidad');
    expect(link.textContent).toContain('Privada');
  });

  it('switches how the counter counts, as the header does', async () => {
    const user = userEvent.setup();
    const { patches, onCounterModeChanged } = renderProfile();
    const button = await within(await screen.findByRole('region', { name: 'Perfil' })).findByRole(
      'button',
      { name: /Contar por/ },
    );
    expect(button.textContent).toContain('Franquicias');

    await user.click(button);

    expect(button.textContent).toContain('Entradas');
    await vi.waitFor(() => expect(patches).toEqual([{ counterMode: 'entry' }]));
    // counter_mode_changed, as from the header counter (#46).
    expect(onCounterModeChanged).toHaveBeenCalledWith({ mode: 'entry' });
    const header = screen.getByRole('region', { name: 'Contador total' });
    expect(
      within(header).getByRole('button', { name: 'Entradas' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('goes back and says so when saving the counter mode fails', async () => {
    const user = userEvent.setup();
    renderProfile({ failPatch: true });
    const button = await within(await screen.findByRole('region', { name: 'Perfil' })).findByRole(
      'button',
      { name: /Contar por/ },
    );

    await user.click(button);

    await vi.waitFor(() => expect(button.textContent).toContain('Franquicias'));
    within(page()).getByRole('alert');
  });

  it('switches the whole app to English, saves it in the account and keeps it (CA-RF71-01)', async () => {
    const user = userEvent.setup();
    const { patches } = renderProfile();
    const select = await within(await screen.findByRole('region', { name: 'Perfil' })).findByRole(
      'combobox',
      { name: 'Idioma' },
    );

    await user.selectOptions(select, 'en');

    await vi.waitFor(() => expect(patches).toEqual([{ locale: 'en' }]));
    expect(i18n.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveProperty('value', 'en');
  });

  it('goes back to the device language with "Idioma del dispositivo" (null)', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    const { patches } = renderProfile();
    const select = await screen.findByRole('combobox', { name: 'Idioma' });

    await user.selectOptions(select, 'device');

    await vi.waitFor(() => expect(patches).toEqual([{ locale: null }]));
    expect(i18n.language).toBe('en');
    vi.restoreAllMocks();
  });

  it('goes back and says so when saving the language fails', async () => {
    const user = userEvent.setup();
    renderProfile({ failPatch: true });
    const select = await screen.findByRole('combobox', { name: 'Idioma' });

    await user.selectOptions(select, 'en');

    await vi.waitFor(() => expect(i18n.language).toBe('es'));
    expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveProperty('value', 'es');
    within(page()).getByRole('alert');
  });

  it('signs out', async () => {
    const user = userEvent.setup();
    const { onSignOut } = renderProfile();
    await user.click(
      await within(await screen.findByRole('region', { name: 'Perfil' })).findByRole('button', {
        name: 'Cerrar sesión',
      }),
    );
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('is the "Perfil" tab of the bar, and the privacy screen goes back to it', async () => {
    const user = userEvent.setup();
    const { router } = renderProfile();
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    const tab = within(nav).getByRole('link', { name: 'Perfil' });
    expect(tab.getAttribute('href')).toBe('/perfil');
    expect(tab.getAttribute('aria-current')).toBe('page');

    await user.click(row(/Tu lista/));
    await user.click(await screen.findByRole('link', { name: '‹ Perfil' }));
    expect(router.state.location.pathname).toBe('/perfil');
  });
});

describe('ProfileScreen in English (#43)', () => {
  it('shows its rows in English', async () => {
    await setLocale('en');
    renderProfile();
    const profile = await screen.findByRole('region', { name: 'Profile' });
    within(profile).getByRole('link', { name: 'Edit' });
    within(profile).getByText('PREFERENCES');
    expect(within(profile).getByRole('button', { name: /Count by/ }).textContent).toContain(
      'Franchises',
    );
    expect(within(profile).getByRole('link', { name: /Your list/ }).textContent).toContain(
      'Private',
    );
    within(profile).getByText('ACCOUNT AND PRIVACY');
    within(profile).getByRole('button', { name: /Download my data/ });
    within(profile).getByRole('link', { name: /Delete account/ });
    within(profile).getByRole('link', { name: /About/ });
    within(profile).getByRole('button', { name: /Sign out/ });
    expect(within(profile).queryByText('Descargar mis datos')).toBeNull();
  });
});
