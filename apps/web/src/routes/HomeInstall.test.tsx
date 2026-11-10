// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogClient } from '../catalog-source/client';
import { setLocale } from '../i18n';
import type { Profile } from '../profile-api';
import { createInstallStore, type InstallEnvironment } from '../pwa/install';
import { Home } from './Home';
import { useSignedIn } from './signed-in-context';

afterEach(cleanup);

const profile: Profile = {
  displayName: 'Camila',
  avatarUrl: null,
  avatarPreset: 'lavanda',
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
  handle: 'camila',
  shownTotal: null,
  shownMode: null,
  cardShared: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  analyticsId: null,
};

// Stands for the screens: they report marks through the layout's context.
function Marker() {
  const { onFranchiseMarked, onEntryMarkedSeen } = useSignedIn();
  return (
    <>
      <button type="button" onClick={() => onFranchiseMarked?.({ status: null, coreSize: 3 })}>
        Quitar saga
      </button>
      <button type="button" onClick={() => onFranchiseMarked?.({ status: 'seen', coreSize: 3 })}>
        Marcar saga
      </button>
      <button type="button" onClick={() => onEntryMarkedSeen?.()}>
        Marcar entrada
      </button>
    </>
  );
}

function renderHome() {
  const fetchFn = vi.fn(async () =>
    Response.json({ items: [], nextCursor: null }, { status: 200 }),
  );
  const onFranchiseMarked = vi.fn();
  // iOS: the suggestion shows its instructions without waiting for any browser event.
  const environment: InstallEnvironment = {
    installed: () => false,
    ios: () => true,
    storage: () => undefined,
  };
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
            client={{ request: vi.fn() } as unknown as CatalogClient}
            fetchFn={fetchFn as unknown as typeof fetch}
            onFranchiseMarked={onFranchiseMarked}
            install={{
              store: createInstallStore(new EventTarget() as unknown as Window),
              environment,
            }}
          />
        ),
        children: [{ index: true, element: <Marker /> }],
      },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { onFranchiseMarked };
}

const suggestion = () => screen.queryByRole('region', { name: 'Instalar Acrux' });

describe('Home: install suggestion (ADR-0016, #44)', () => {
  it('waits for a franchise marked as seen, and still reports the mark', async () => {
    const user = userEvent.setup();
    const { onFranchiseMarked } = renderHome();
    expect(suggestion()).toBeNull();

    await user.click(await screen.findByRole('button', { name: 'Quitar saga' }));
    expect(suggestion()).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Marcar saga' }));
    expect(suggestion()).not.toBeNull();
    expect(onFranchiseMarked).toHaveBeenLastCalledWith({ status: 'seen', coreSize: 3 });
  });

  it('shows after one entry marked as seen', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: 'Marcar entrada' }));
    expect(suggestion()).not.toBeNull();
  });
});

describe('Home in English (#43)', () => {
  afterEach(() => setLocale('es'));

  it('shows the navigation, sign out and install suggestion in English', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    renderHome();
    await screen.findByRole('navigation', { name: 'Main' });
    for (const name of ['Explore', 'My list', 'Card', 'Profile']) {
      screen.getByRole('link', { name });
    }
    screen.getByRole('button', { name: 'Sign out' });
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Marcar entrada' }));
    screen.getByRole('region', { name: 'Install Acrux' });
  });
});
