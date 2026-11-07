import { accountEs } from './screens-account';
import { browseEs } from './screens-browse';

// Spanish texts of the web app (RNF-05). Spanish is the source: English must have the same keys.
export const es = {
  language: {
    label: 'Idioma',
    es: 'Español',
    en: 'English',
    device: 'Idioma del dispositivo',
    saveFailed: 'No pudimos guardar el idioma. Vuelve a intentarlo.',
  },
  ...browseEs,
  ...accountEs,
} as const;
