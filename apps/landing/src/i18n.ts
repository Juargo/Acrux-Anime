import type { Locale } from '@acrux/i18n';

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
      chip: 'Beta cerrada · gratis',
      title: '¿Cuántos animes has visto de verdad?',
      lead: 'Marca la saga, no las temporadas, y compártelo en segundos. Gratis, en español y sin anuncios en tu tarjeta.',
    },
    form: {
      label: 'Tu correo',
      placeholder: 'tu@correo.com',
      submit: 'Únete a la beta',
      notePrefix: 'Te escribiremos solo para invitarte a la beta. ',
      noteLink: 'Lee la política de privacidad.',
    },
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
      lead: 'Abrimos la beta por invitación a un grupo pequeño. Deja tu correo y te avisamos.',
    },
    footer: {
      nav: 'Enlaces del sitio',
      privacy: { label: 'Política de privacidad', href: '/privacidad' },
      support: { label: 'Soporte', href: '/soporte' },
      deleteAccount: { label: 'Borrar mi cuenta', href: '/soporte#borrar-cuenta' },
      attribution:
        '© 2026 Acrux · Datos del catálogo provistos por AniList. Acrux no está afiliada a AniList.',
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
      chip: 'Closed beta · free',
      title: 'How many anime have you really watched?',
      lead: 'Mark the saga, not the seasons, and share it in seconds. Free, in Spanish and English, with no ads on your card.',
    },
    form: {
      label: 'Your email',
      placeholder: 'you@email.com',
      submit: 'Join the beta',
      notePrefix: 'We will only email you to invite you to the beta. ',
      noteLink: 'Read the privacy policy.',
    },
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
      lead: 'We are opening the beta by invitation to a small group. Leave your email and we will let you know.',
    },
    footer: {
      nav: 'Site links',
      privacy: { label: 'Privacy policy', href: '/en/privacy' },
      support: { label: 'Support', href: '/en/support' },
      deleteAccount: { label: 'Delete my account', href: '/en/support#delete-account' },
      attribution:
        '© 2026 Acrux · Catalog data provided by AniList. Acrux is not affiliated with AniList.',
    },
  },
} as const;

export type Copy = (typeof copy)[Locale];

export function getCopy(locale: Locale): Copy {
  return copy[locale];
}
