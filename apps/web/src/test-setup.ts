import { initI18n } from './i18n';

// Tests read the Spanish source texts, whatever the machine's language is.
await initI18n('es');
try {
  window.localStorage.clear();
} catch {
  // Node environment: there is no window.
}
