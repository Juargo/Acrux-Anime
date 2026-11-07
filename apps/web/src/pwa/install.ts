// Chrome's install event (not in the DOM types): prompt() opens the native dialog, once.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const INSTALL_DISMISSED_KEY = 'acrux.install-dismissed';

export type InstallOffer = 'prompt' | 'ios' | null;

/**
 * Which install suggestion fits (ADR-0016): Chrome's own dialog when the browser offered it,
 * instructions on iOS (no such event there), and nothing once installed, dismissed, or when the
 * browser cannot install it.
 */
export function installOffer(state: {
  installed: boolean;
  dismissed: boolean;
  canPrompt: boolean;
  ios: boolean;
}): InstallOffer {
  if (state.installed || state.dismissed) return null;
  if (state.canPrompt) return 'prompt';
  return state.ios ? 'ios' : null;
}

export interface InstallStore {
  subscribe: (listener: () => void) => () => void;
  canPrompt: () => boolean;
  // Opens Chrome's dialog; true when the user installed the app.
  prompt: () => Promise<boolean>;
}

/**
 * Keeps Chrome's beforeinstallprompt, which fires once early on, until the user marks the first
 * anime and the suggestion offers it.
 */
export function createInstallStore(target: Pick<Window, 'addEventListener'>): InstallStore {
  let deferred: BeforeInstallPromptEvent | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  target.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    canPrompt: () => deferred !== null,
    async prompt() {
      const event = deferred;
      if (!event) return false;
      // The event works once: after the dialog, Chrome fires a new one if it can offer it again.
      deferred = null;
      notify();
      await event.prompt();
      const { outcome } = await event.userChoice;
      return outcome === 'accepted';
    },
  };
}

export interface InstallEnvironment {
  installed: () => boolean;
  ios: () => boolean;
  storage: () => Storage | undefined;
}

export const browserEnvironment: InstallEnvironment = {
  installed: () =>
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
  // iPadOS reports itself as a Mac with a touch screen.
  ios: () =>
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  storage: () => {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  },
};
