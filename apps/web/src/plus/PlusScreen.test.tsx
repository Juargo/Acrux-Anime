// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AniListClient } from '../anilist/client';
import { setLocale } from '../i18n';
import type { Profile } from '../profile-api';
import { Home } from '../routes/Home';
import { signedInRoutes } from '../routes/signed-in-routes';

// Lifetime Plus (epic #50, RF-50, RF-57; Figma M21–M24 adapted to the one-time payment of
// ADR-0036: no annual plan, no renewal and no grace period).
afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  await setLocale('es');
});

const CHECKOUT_URL = 'https://acrux.lemonsqueezy.com/checkout/custom/abc?signature=x';

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
  shownTotal: 48,
  shownMode: 'franchise',
  cardShared: true,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
  plan: 'free',
  plusAvailable: true,
};

function renderAt(
  path: string,
  options: {
    profile?: Profile;
    checkoutStatus?: number;
    // What GET /api/v1/me answers on each poll after returning from the checkout.
    polls?: Profile[];
  } = {},
) {
  const profile = options.profile ?? free;
  const polls = [...(options.polls ?? [])];
  const checkouts: RequestInit[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/v1/me/marks?')) return json({ items: [], nextCursor: null });
    if (url === '/api/v1/me' && init?.method === 'PATCH') return json(profile);
    if (url === '/api/v1/me') return json(polls.shift() ?? profile);
    if (url === '/api/v1/billing/checkout') {
      checkouts.push(init ?? {});
      const status = options.checkoutStatus ?? 200;
      return status === 200
        ? json({ url: CHECKOUT_URL })
        : json({ code: 'billing.provider_error', status }, status);
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const openCheckout = vi.fn();
  const onPlusCheckoutStarted = vi.fn();
  const onPlusPurchased = vi.fn();
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
            client={{ request: vi.fn() } as unknown as AniListClient}
            fetchFn={fetchFn as unknown as typeof fetch}
            onPlusCheckoutStarted={onPlusCheckoutStarted}
            onPlusPurchased={onPlusPurchased}
            openCheckout={openCheckout}
            plusPolling={{ intervalMs: 10, attempts: 3 }}
          />
        ),
        children: signedInRoutes,
      },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { fetchFn, checkouts, openCheckout, onPlusCheckoutStarted, onPlusPurchased };
}

const plusPage = () => screen.getByRole('region', { name: 'Acrux Plus' });

describe('PlusScreen', () => {
  it('offers lifetime Plus as a one-time payment with what it adds (RF-50, M21)', async () => {
    renderAt('/perfil/plus');
    const page = await screen.findByRole('region', { name: 'Acrux Plus' });
    expect(within(page).getByText('Más estilo para tu historial de anime.')).toBeTruthy();
    for (const benefit of [
      'Todos los temas para tu tarjeta',
      'Estadísticas avanzadas',
      'Tu Wrapped anual',
      'Insignias e íconos de la app',
    ]) {
      expect(within(page).getByText(benefit)).toBeTruthy();
    }
    expect(within(page).getByText('Pago único, para siempre. Sin suscripción.')).toBeTruthy();
    expect(
      within(page).getByText('Lo básico sigue gratis: marcar, contar y tu tarjeta Clásica.'),
    ).toBeTruthy();
    expect(within(page).getByRole('button', { name: 'Comprar Plus' })).toBeTruthy();
    expect(within(page).getByText('Pago seguro con Lemon Squeezy.')).toBeTruthy();
  });

  it('@CA-RF50-01 opens the checkout the API creates and records plus_checkout_started (S2, S8)', async () => {
    const user = userEvent.setup();
    const { checkouts, openCheckout, onPlusCheckoutStarted } = renderAt('/perfil/plus');

    await user.click(await screen.findByRole('button', { name: 'Comprar Plus' }));

    await vi.waitFor(() => expect(openCheckout).toHaveBeenCalledWith(CHECKOUT_URL));
    expect(checkouts).toHaveLength(1);
    expect(checkouts[0]?.method).toBe('POST');
    expect(new Headers(checkouts[0]?.headers).get('authorization')).toBe('Bearer jwt');
    // The API takes the user from the session; the web sends no body (S10).
    expect(checkouts[0]?.body).toBeUndefined();
    expect(onPlusCheckoutStarted).toHaveBeenCalledTimes(1);
  });

  it('@CA-RF57-02 says nothing was charged when the checkout cannot start, and retries (M23)', async () => {
    const user = userEvent.setup();
    const { checkouts, openCheckout } = renderAt('/perfil/plus', { checkoutStatus: 502 });

    await user.click(await screen.findByRole('button', { name: 'Comprar Plus' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('No se pudo iniciar el pago')).toBeTruthy();
    expect(
      within(alert).getByText('No se te cobró nada. Vuelve a intentarlo en un momento.'),
    ).toBeTruthy();
    expect(openCheckout).not.toHaveBeenCalled();
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    await vi.waitFor(() => expect(checkouts).toHaveLength(2));
  });

  it('offers no purchase while billing is off (S11)', async () => {
    renderAt('/perfil/plus', { profile: { ...free, plusAvailable: false } });
    const page = await screen.findByRole('region', { name: 'Acrux Plus' });
    expect(within(page).getByText('Acrux Plus llega pronto.')).toBeTruthy();
    expect(within(page).queryByRole('button', { name: 'Comprar Plus' })).toBeNull();
  });

  it('shows lifetime Plus as active, without renewal or cancellation (M24)', async () => {
    renderAt('/perfil/plus', { profile: { ...free, plan: 'plus' } });
    const page = await screen.findByRole('region', { name: 'Acrux Plus' });
    expect(within(page).getByText('Plus vitalicio')).toBeTruthy();
    expect(within(page).getByText('Activo')).toBeTruthy();
    expect(
      within(page).getByText(
        'No vence. Lo tienes en cualquier dispositivo donde inicies sesión con esta cuenta.',
      ),
    ).toBeTruthy();
    expect(within(page).queryByRole('button', { name: 'Comprar Plus' })).toBeNull();
  });

  it('@CA-RF57-01 confirms the purchase once the webhook grants Plus and records plus_purchased (M22, S8)', async () => {
    const { onPlusPurchased } = renderAt('/perfil/plus?compra=lista', {
      polls: [free, { ...free, plan: 'plus' }],
    });

    expect(await screen.findByText('Confirmando tu compra…')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: '¡Ya eres Plus!' })).toBeTruthy();
    expect(screen.getByText('Gracias por apoyar Acrux.')).toBeTruthy();
    expect(onPlusPurchased).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Ver mi tarjeta' }).getAttribute('href')).toBe(
      '/tarjeta',
    );
  });

  it('@CA-RF57-03 says the payment is still pending when the confirmation does not arrive (RF-57)', async () => {
    const { onPlusPurchased } = renderAt('/perfil/plus?compra=lista', {
      polls: [free, free, free],
    });

    const status = await screen.findByText('Tu pago se está confirmando');
    expect(status).toBeTruthy();
    expect(
      screen.getByText(
        'Puede tardar unos minutos. Vuelve a esta pantalla más tarde; si se te cobró y no ves Plus, escríbenos desde Soporte.',
      ),
    ).toBeTruthy();
    expect(onPlusPurchased).not.toHaveBeenCalled();
  });

  it('shows the Plus row in Perfil with the current plan', async () => {
    renderAt('/perfil');
    const freeRow = await screen.findByRole('link', { name: /Acrux Plus/ });
    expect(freeRow.getAttribute('href')).toBe('/perfil/plus');
    expect(within(freeRow).getByText('Gratis ›')).toBeTruthy();
    cleanup();

    renderAt('/perfil', { profile: { ...free, plan: 'plus' } });
    const plusRow = await screen.findByRole('link', { name: /Acrux Plus/ });
    expect(within(plusRow).getByText('Activo ›')).toBeTruthy();
  });

  it('@CA-RF50-02 hides the Plus row from a free user while billing is off', async () => {
    renderAt('/perfil', { profile: { ...free, plusAvailable: false } });
    await screen.findByRole('region', { name: 'Perfil' });
    expect(screen.queryByRole('link', { name: /Acrux Plus/ })).toBeNull();
  });

  it('is in English for an English account (#43)', async () => {
    await setLocale('en');
    renderAt('/perfil/plus');
    const page = await screen.findByRole('region', { name: 'Acrux Plus' });
    expect(within(page).getByRole('button', { name: 'Buy Plus' })).toBeTruthy();
    expect(within(page).getByText('One payment, yours forever. No subscription.')).toBeTruthy();
    void plusPage;
  });
});
