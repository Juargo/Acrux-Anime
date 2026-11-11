import type { Locale } from '@acrux/i18n';

// Where the calls to action send people since the direct public launch (ADR-0044).
export const APP_URL = 'https://app.acruxanime.com';

// Landing copy per locale. Spanish matches Figma D40/M40; English is its translation.
const copy = {
  es: {
    meta: {
      title: 'Acrux · Tu historial de anime, en una sola tarjeta',
      description:
        'Marca la saga, no las temporadas, y compártelo en segundos. Gratis, en español y sin anuncios en tu tarjeta.',
    },
    otherLocale: { label: 'English', href: '/en/', lang: 'en' },
    hero: {
      chip: 'Gratis',
      title: '¿Cuántos animes has visto de verdad?',
      lead: 'Marca la saga, no las temporadas, y compártelo en segundos. Gratis, en español y sin anuncios en tu tarjeta.',
    },
    cta: { label: 'Abrir Acrux' },
    card: {
      label:
        'Ejemplo de tarjeta para compartir: @camila, 63 animes completos y 3 que está viendo ahora.',
      total: 'Animes completos',
      watching: 'Viendo ahora',
    },
    howItWorks: {
      title: 'Así funciona',
      lead: 'Tres pasos y tienes tu historial listo para mostrar.',
      blocks: [
        {
          icon: 'check',
          title: '1. Marca la saga, no las temporadas',
          text: 'Temporadas, películas y OVAs van juntas en un solo ítem. Un toque y queda marcada.',
        },
        {
          icon: 'lista',
          title: '2. Ve tu total real',
          text: 'Contamos sagas, no entradas sueltas. Si prefieres el número grande, cambia a contar por entradas.',
        },
        {
          icon: 'compartir',
          title: '3. Compártelo en segundos',
          text: 'Tu tarjeta vertical para Stories y TikTok, con tu total y lo que estás viendo ahora.',
        },
      ],
    },
    whyAcrux: {
      title: 'Por qué Acrux',
      blocks: [
        {
          icon: 'estrella',
          title: 'En español, de verdad',
          text: 'Pensada desde Latinoamérica, no traducida a última hora. También en inglés.',
        },
        {
          icon: 'candado',
          title: 'Tu lista es tuya',
          text: 'Es privada hasta que decidas compartirla. Puedes descargar tus datos o borrar tu cuenta cuando quieras.',
        },
        {
          icon: 'tarjeta',
          title: 'Gratis y sin anuncios en tu tarjeta',
          text: 'Marcar, contar y compartir es gratis para siempre.',
        },
      ],
    },
    finalCta: {
      title: 'Sé de los primeros en probarla',
      lead: 'Entra con tu cuenta de Google y empieza a marcar.',
    },
    consent: {
      title: '¿Nos ayudas a medir?',
      text: 'Usamos analítica para saber si Acrux le sirve a más gente. Sin cookies hasta que aceptes, y puedes cambiarlo cuando quieras desde el pie de página.',
      more: 'Más información',
      decline: 'Rechazar',
      accept: 'Aceptar',
    },
    footer: {
      nav: 'Enlaces del sitio',
      privacy: { label: 'Política de privacidad', href: '/privacidad' },
      support: { label: 'Soporte', href: '/soporte' },
      terms: { label: 'Términos de uso', href: '/terminos' },
      deleteAccount: { label: 'Borrar mi cuenta', href: '/soporte#borrar-cuenta' },
      analytics: 'Preferencias de analítica',
      attribution:
        '© 2026 Acrux · Datos del catálogo provistos por {mal}. Acrux no está afiliada a {mal}.',
    },
  },
  en: {
    meta: {
      title: 'Acrux · Your anime history, on a single card',
      description:
        'Mark the saga, not the seasons, and share it in seconds. Free, in Spanish and English, with no ads on your card.',
    },
    otherLocale: { label: 'Español', href: '/', lang: 'es' },
    hero: {
      chip: 'Free',
      title: 'How many anime have you really watched?',
      lead: 'Mark the saga, not the seasons, and share it in seconds. Free, in Spanish and English, with no ads on your card.',
    },
    cta: { label: 'Open Acrux' },
    card: {
      label: 'Example share card: @camila, 63 completed anime and 3 currently watching.',
      total: 'Completed anime',
      watching: 'Watching now',
    },
    howItWorks: {
      title: 'How it works',
      lead: 'Three steps and your history is ready to show off.',
      blocks: [
        {
          icon: 'check',
          title: '1. Mark the saga, not the seasons',
          text: 'Seasons, movies and OVAs go together as a single item. One tap and it is marked.',
        },
        {
          icon: 'lista',
          title: '2. See your real total',
          text: 'We count sagas, not loose entries. If you prefer the big number, switch to counting by entries.',
        },
        {
          icon: 'compartir',
          title: '3. Share it in seconds',
          text: 'Your vertical card for Stories and TikTok, with your total and what you are watching now.',
        },
      ],
    },
    whyAcrux: {
      title: 'Why Acrux',
      blocks: [
        {
          icon: 'estrella',
          title: 'Truly in Spanish',
          text: 'Built from Latin America, not translated at the last minute. Also in English.',
        },
        {
          icon: 'candado',
          title: 'Your list is yours',
          text: 'It stays private until you decide to share it. Download your data or delete your account whenever you want.',
        },
        {
          icon: 'tarjeta',
          title: 'Free, with no ads on your card',
          text: 'Marking, counting and sharing are free forever.',
        },
      ],
    },
    finalCta: {
      title: 'Be among the first to try it',
      lead: 'Sign in with your Google account and start marking.',
    },
    consent: {
      title: 'Will you help us measure?',
      text: 'We use analytics to learn whether Acrux is useful to more people. No cookies until you accept, and you can change it anytime from the footer.',
      more: 'Learn more',
      decline: 'Decline',
      accept: 'Accept',
    },
    footer: {
      nav: 'Site links',
      privacy: { label: 'Privacy policy', href: '/en/privacy' },
      support: { label: 'Support', href: '/en/support' },
      terms: { label: 'Terms of use', href: '/en/terms' },
      deleteAccount: { label: 'Delete my account', href: '/en/support#delete-account' },
      analytics: 'Analytics preferences',
      attribution:
        '© 2026 Acrux · Catalog data provided by {mal}. Acrux is not affiliated with {mal}.',
    },
  },
} as const;

export type Copy = (typeof copy)[Locale];

export function getCopy(locale: Locale): Copy {
  return copy[locale];
}
