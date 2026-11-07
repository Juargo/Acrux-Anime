// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { InstallPrompt } from './InstallSuggestion';
import {
  type BeforeInstallPromptEvent,
  createInstallStore,
  INSTALL_DISMISSED_KEY,
  type InstallEnvironment,
  installOffer,
} from './install';

afterEach(cleanup);

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function setup(options: { installed?: boolean; ios?: boolean; offered?: boolean } = {}) {
  const target = new EventTarget();
  const store = createInstallStore(target as unknown as Window);
  const storage = memoryStorage();
  const environment: InstallEnvironment = {
    installed: () => options.installed ?? false,
    ios: () => options.ios ?? false,
    storage: () => storage,
  };
  const prompt = vi.fn(async () => {});
  const offer = () => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    }) as BeforeInstallPromptEvent;
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  };
  if (options.offered) offer();
  return { target, store, storage, environment, prompt, offer };
}

describe('installOffer (ADR-0016)', () => {
  const base = { installed: false, dismissed: false, canPrompt: false, ios: false };

  it("offers Chrome's dialog when the browser can install the app", () => {
    expect(installOffer({ ...base, canPrompt: true })).toBe('prompt');
  });

  it('offers instructions on iOS', () => {
    expect(installOffer({ ...base, ios: true })).toBe('ios');
  });

  it('offers nothing once installed, dismissed, or where the browser cannot install it', () => {
    expect(installOffer({ ...base, canPrompt: true, installed: true })).toBeNull();
    expect(installOffer({ ...base, canPrompt: true, dismissed: true })).toBeNull();
    expect(installOffer(base)).toBeNull();
  });
});

describe('InstallPrompt (ADR-0016)', () => {
  it('waits for the first anime marked as seen', () => {
    const { store, environment } = setup({ offered: true });
    const { rerender } = render(
      <InstallPrompt show={false} store={store} environment={environment} />,
    );
    expect(screen.queryByRole('button', { name: 'Instalar Acrux' })).toBeNull();
    rerender(<InstallPrompt show store={store} environment={environment} />);
    screen.getByRole('button', { name: 'Instalar Acrux' });
  });

  it("opens Chrome's install dialog from «Instalar Acrux»", async () => {
    const user = userEvent.setup();
    const { store, environment, prompt, offer } = setup();
    render(<InstallPrompt show store={store} environment={environment} />);
    const event = offer();
    expect(event.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Instalar Acrux' }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Instalar Acrux' })).toBeNull();
  });

  it('tells iOS users how to add it to the home screen', () => {
    const { store, environment } = setup({ ios: true });
    render(<InstallPrompt show store={store} environment={environment} />);
    screen.getByText(/Compartir.*Agregar a pantalla de inicio/);
    expect(screen.queryByRole('button', { name: 'Instalar Acrux' })).toBeNull();
  });

  it('never comes back once dismissed', async () => {
    const user = userEvent.setup();
    const { store, environment, storage } = setup({ offered: true });
    render(<InstallPrompt show store={store} environment={environment} />);
    await user.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByRole('button', { name: 'Instalar Acrux' })).toBeNull();
    expect(storage.getItem(INSTALL_DISMISSED_KEY)).toBe('1');

    cleanup();
    render(<InstallPrompt show store={store} environment={environment} />);
    expect(screen.queryByText(/Instala Acrux/)).toBeNull();
  });

  it('shows nothing when the app is already installed', () => {
    const { store, environment } = setup({ installed: true, offered: true });
    render(<InstallPrompt show store={store} environment={environment} />);
    expect(screen.queryByText(/Instala Acrux/)).toBeNull();
  });
});

describe('InstallPrompt in English (#43)', () => {
  afterEach(() => setLocale('es'));

  it('suggests installing Acrux in English', async () => {
    await setLocale('en');
    const { store, environment } = setup({ ios: true });
    render(<InstallPrompt show store={store} environment={environment} />);
    screen.getByRole('region', { name: 'Install Acrux' });
    screen.getByText('Install Acrux on your phone');
    screen.getByText('Tap “Share” and then “Add to Home Screen” to open it like an app.');
    screen.getByRole('button', { name: 'Not now' });
    expect(screen.queryByText('Instala Acrux en tu teléfono')).toBeNull();
  });
});
