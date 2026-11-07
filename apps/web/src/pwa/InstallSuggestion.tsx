import { useState, useSyncExternalStore } from 'react';
import {
  browserEnvironment,
  createInstallStore,
  INSTALL_DISMISSED_KEY,
  type InstallEnvironment,
  type InstallOffer,
  type InstallStore,
  installOffer,
} from './install';

// Listens from the first import: Chrome fires beforeinstallprompt early, before any mark.
const defaultStore: InstallStore | undefined =
  typeof window === 'undefined' ? undefined : createInstallStore(window);

const noStore: InstallStore = {
  subscribe: () => () => {},
  canPrompt: () => false,
  prompt: async () => false,
};

export function InstallSuggestion(props: {
  offer: Exclude<InstallOffer, null>;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="pwa-notice" aria-label="Instalar Acrux">
      <p className="pwa-notice__title">Instala Acrux en tu teléfono</p>
      {props.offer === 'ios' ? (
        <p className="pwa-notice__text">
          Toca «Compartir» y luego «Agregar a pantalla de inicio» para abrirla como una app.
        </p>
      ) : (
        <p className="pwa-notice__text">Ábrela desde tu pantalla de inicio, como una app.</p>
      )}
      <div className="pwa-notice__buttons">
        <button className="pwa-notice__button" type="button" onClick={props.onDismiss}>
          Ahora no
        </button>
        {props.offer === 'prompt' && (
          <button
            className="pwa-notice__button pwa-notice__button--primary"
            type="button"
            onClick={props.onInstall}
          >
            Instalar Acrux
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * The install suggestion at the moment of value (ADR-0016, #44): after the first anime marked as
 * seen, never on entering; once dismissed it never comes back.
 */
export function InstallPrompt({
  show,
  store = defaultStore ?? noStore,
  environment = browserEnvironment,
}: {
  show: boolean;
  store?: InstallStore | undefined;
  environment?: InstallEnvironment | undefined;
}) {
  const canPrompt = useSyncExternalStore(store.subscribe, store.canPrompt, () => false);
  const [dismissed, setDismissed] = useState(
    () => environment.storage()?.getItem(INSTALL_DISMISSED_KEY) === '1',
  );
  const [closed, setClosed] = useState(false);
  if (!show || closed) return null;
  const offer = installOffer({
    installed: environment.installed(),
    dismissed,
    canPrompt,
    ios: environment.ios(),
  });
  if (!offer) return null;

  function dismiss() {
    try {
      environment.storage()?.setItem(INSTALL_DISMISSED_KEY, '1');
    } catch {
      // Without storage it only stays closed until the next visit.
    }
    setDismissed(true);
  }

  return (
    <InstallSuggestion
      offer={offer}
      onDismiss={dismiss}
      onInstall={() => {
        setClosed(true);
        void store.prompt();
      }}
    />
  );
}
