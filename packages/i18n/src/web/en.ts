import type { WebMessages } from './messages';
import { accountEn } from './screens-account';
import { browseEn } from './screens-browse';

// English texts of the web app. The type makes a missing or extra key a compile error.
export const en: WebMessages = {
  language: {
    label: 'Language',
    es: 'Español',
    en: 'English',
    device: 'Device language',
    saveFailed: "We couldn't save the language. Try again.",
  },
  ...browseEn,
  ...accountEn,
};
