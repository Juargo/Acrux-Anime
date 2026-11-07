import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <section className="pwa-notice" aria-label={t('pwa.installLabel')}>
      <p className="pwa-notice__title">{t('pwa.installTitle')}</p>
      {props.offer === 'ios' ? (
        <p className="pwa-notice__text">{t('pwa.installIos')}</p>
      ) : (
        <p className="pwa-notice__text">{t('pwa.installText')}</p>
      )}
      <div className="pwa-notice__buttons">
        <button className="pwa-notice__button" type="button" onClick={props.onDismiss}>
          {t('pwa.notNow')}
        </button>
        {props.offer === 'prompt' && (
          <button
            className="pwa-notice__button pwa-notice__button--primary"
            type="button"
            onClick={props.onInstall}
          >
            {t('pwa.install')}
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
