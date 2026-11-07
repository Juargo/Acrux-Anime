import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';

// A tab or an installed app can stay open for days: look for a new version every hour.
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * "Hay una nueva versión" (ADR-0016, #44): the new service worker waits until the user reloads,
 * so the page never reloads in the middle of an action.
 */
export function UpdateNotice(props: {
  needRefresh: boolean;
  onReload: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  if (!props.needRefresh) return null;
  return (
    <section className="pwa-notice" role="status">
      <p className="pwa-notice__title">{t('pwa.updateTitle')}</p>
      <div className="pwa-notice__buttons">
        <button className="pwa-notice__button" type="button" onClick={props.onDismiss}>
          {t('pwa.later')}
        </button>
        <button
          className="pwa-notice__button pwa-notice__button--primary"
          type="button"
          onClick={props.onReload}
        >
          {t('pwa.reload')}
        </button>
      </div>
    </section>
  );
}

// Container: registers the service worker of vite-plugin-pwa (registerType prompt).
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
  });
  return (
    <UpdateNotice
      needRefresh={needRefresh}
      onReload={() => void updateServiceWorker(true)}
      onDismiss={() => setNeedRefresh(false)}
    />
  );
}
