import type { WebMessages } from './messages';

// English texts of the web app. The type makes a missing or extra key a compile error.
export const en: WebMessages = {
  language: {
    label: 'Language',
    es: 'Español',
    en: 'English',
    device: 'Device language',
    saveFailed: "We couldn't save the language. Try again.",
  },
};
