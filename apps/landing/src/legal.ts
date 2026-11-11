import type { Locale } from '@acrux/i18n';

// Privacy (Figma D42/M42), support (D43) and terms pages, issue #16. The terms page has no
// Figma frame and reuses the D42 layout. Processors and regions follow ADR-0028, ADR-0033 and
// ADR-0034; backup retention follows ADR-0032.

export type LegalPageKey = 'privacy' | 'support' | 'terms';

// "{email}" inside a paragraph renders as a mailto link to CONTACT_EMAIL.
export interface LegalSection {
  id?: string;
  title: string;
  paragraphs: readonly string[];
}

export interface LegalPage {
  path: string;
  meta: { title: string; description: string };
  title: string;
  updated?: string;
  sections: readonly LegalSection[];
}

export const CONTACT_EMAIL = 'jorgeretamal.jjra@gmail.com';
// Credit link requested by MyAnimeList's support (ADR-0043, point 7); `{mal}` in a paragraph renders it.
export const MAL_URL = 'https://myanimelist.net';
const OWNER = 'Jorge Retamal';
const RESPONSE_TIME = { es: '3 días hábiles', en: '3 business days' };

const pages: Record<Locale, Record<LegalPageKey, LegalPage>> = {
  es: {
    privacy: {
      path: '/privacidad',
      meta: {
        title: 'Política de privacidad · Acrux',
        description:
          'Qué datos guarda Acrux, para qué los usa, con quién los comparte y cómo ejercer tus derechos.',
      },
      title: 'Política de privacidad',
      updated: 'Última actualización: 10 de noviembre de 2026',
      sections: [
        {
          title: 'Quién es responsable',
          paragraphs: [
            `Acrux es un proyecto independiente desarrollado en Chile. Responsable: ${OWNER} · {email}.`,
          ],
        },
        {
          title: 'Qué datos guardamos',
          paragraphs: [
            'En la lista de espera, solo tu correo, y lo borramos al terminar la beta. En la app, el nombre y el avatar de tu cuenta de Google, tus preferencias y los animes que marcas. Nunca mostramos tu correo.',
          ],
        },
        {
          title: 'Para qué los usamos',
          paragraphs: [
            'Para invitarte a la beta y para que la app funcione. Si aceptas la analítica, medimos el uso de forma agregada para saber si Acrux le sirve a más gente.',
            'La lista de espera y la analítica se basan en tu consentimiento, que puedes retirar cuando quieras. Los datos de la app se tratan porque son necesarios para darte el servicio que pides.',
          ],
        },
        {
          title: 'Con quién los compartimos',
          paragraphs: [
            'Solo con los servicios que hacen funcionar Acrux, bajo acuerdos de tratamiento de datos: Neon (base de datos e inicio de sesión), Vercel (servidores), PostHog (analítica), Sentry (errores), Lemon Squeezy (pagos), Backblaze (respaldos), Upstash (límite de peticiones), Buttondown (lista de espera) y, cuando activemos los anuncios, Google AdSense (publicidad). No vendemos tus datos.',
          ],
        },
        {
          title: 'Publicidad',
          paragraphs: [
            'Cuando activemos los anuncios, quienes usen Acrux sin Plus verán anuncios de Google AdSense en el inicio, Mi lista, la ficha de cada franquicia y la pantalla de la tarjeta, nunca dentro de la tarjeta que compartes ni en tu perfil público. Con Plus no se cargan anuncios.',
            'Los anuncios personalizados según tus intereses solo se muestran si los aceptas, y puedes cambiar esa decisión desde tu perfil. Si no los aceptas, verás anuncios no personalizados.',
            'Aunque no aceptes los anuncios personalizados, fuera de la Unión Europea, el Reino Unido y Suiza Google puede usar cookies o identificadores para limitar cuántas veces ves un anuncio y para prevenir fraude. En la Unión Europea, el Reino Unido y Suiza, la elección se hace en el aviso de privacidad de Google.',
          ],
        },
        {
          title: 'Dónde se guardan',
          paragraphs: [
            'La base de datos está en Ohio, Estados Unidos, y los servidores en São Paulo, Brasil. La analítica, en la Unión Europea. Las transferencias fuera de Chile se protegen con cláusulas contractuales tipo.',
          ],
        },
        {
          title: 'Cuánto tiempo los guardamos',
          paragraphs: [
            'Mientras sigas en la lista de espera o tengas cuenta. Si te das de baja o borras tu cuenta, tus datos se eliminan de inmediato y desaparecen de las copias de respaldo a más tardar en 30 días.',
          ],
        },
        {
          title: 'Tus derechos',
          paragraphs: [
            'Puedes acceder a tus datos, descargarlos, corregirlos, borrarlos y retirar el consentimiento de analítica cuando quieras. Te amparan la Ley 21.719 de Chile y el RGPD si vives en Europa.',
          ],
        },
        {
          title: 'Contacto',
          paragraphs: ['Escríbenos a {email} para cualquier consulta sobre tus datos.'],
        },
      ],
    },
    support: {
      path: '/soporte',
      meta: {
        title: 'Soporte · Acrux',
        description:
          'Cómo contactar a Acrux, salir de la lista de espera, descargar tus datos o borrar tu cuenta.',
      },
      title: 'Soporte',
      sections: [
        {
          title: 'Escríbenos',
          paragraphs: [`Escríbenos a {email}. Respondemos en ${RESPONSE_TIME.es}.`],
        },
        {
          title: 'Salir de la lista de espera',
          paragraphs: [
            'Cada correo que te enviamos incluye un enlace para salir de la lista. También puedes pedirlo por correo.',
          ],
        },
        {
          title: 'Descargar tus datos',
          paragraphs: ['En la app, abre Ajustes › Cuenta y privacidad › Descargar mis datos.'],
        },
        {
          id: 'borrar-cuenta',
          title: 'Borrar tu cuenta',
          paragraphs: [
            'En la app, abre Ajustes › Cuenta y privacidad › Borrar cuenta. Tus datos se borran de inmediato y no se puede deshacer.',
          ],
        },
      ],
    },
    terms: {
      path: '/terminos',
      meta: {
        title: 'Términos de uso · Acrux',
        description: 'Las reglas para usar Acrux.',
      },
      title: 'Términos de uso',
      updated: 'Última actualización: 11 de noviembre de 2026',
      sections: [
        {
          title: 'Qué es Acrux',
          paragraphs: [
            'Acrux es una app independiente para marcar los animes que has visto y compartir tu historial. La app puede cambiar o fallar.',
          ],
        },
        {
          title: 'Uso aceptable',
          paragraphs: [
            'No uses Acrux para enviar spam, entrar a cuentas ajenas ni sobrecargar el servicio. Podemos suspender las cuentas que lo hagan.',
          ],
        },
        {
          title: 'Catálogo y MyAnimeList',
          paragraphs: [
            'Los datos del catálogo los provee {mal}. Acrux no está afiliada a {mal} ni cuenta con su respaldo. Los títulos e imágenes de cada anime pertenecen a sus dueños.',
          ],
        },
        {
          title: 'Precio',
          paragraphs: [
            'Marcar, contar y compartir es gratis. Si más adelante hay funciones de pago, las procesará Lemon Squeezy y te avisaremos antes de cobrarte nada.',
          ],
        },
        {
          title: 'Sin garantías',
          paragraphs: [
            'Acrux se ofrece tal como está, sin garantías, en la medida en que la ley lo permita.',
          ],
        },
        {
          title: 'Cambios',
          paragraphs: [
            'Podemos actualizar estos términos y te avisaremos si el cambio es importante. Puedes borrar tu cuenta cuando quieras.',
          ],
        },
        {
          title: 'Ley aplicable y contacto',
          paragraphs: ['Estos términos se rigen por las leyes de Chile. Escríbenos a {email}.'],
        },
      ],
    },
  },
  en: {
    privacy: {
      path: '/en/privacy',
      meta: {
        title: 'Privacy policy · Acrux',
        description:
          'What data Acrux keeps, why, who it shares it with and how to exercise your rights.',
      },
      title: 'Privacy policy',
      updated: 'Last updated: November 10, 2026',
      sections: [
        {
          title: 'Who is responsible',
          paragraphs: [
            `Acrux is an independent project developed in Chile. Data controller: ${OWNER} · {email}.`,
          ],
        },
        {
          title: 'What data we keep',
          paragraphs: [
            'On the waitlist, only your email, and we delete it when the beta ends. In the app, the name and avatar of your Google account, your preferences and the anime you mark. We never show your email.',
          ],
        },
        {
          title: 'What we use it for',
          paragraphs: [
            'To invite you to the beta and to make the app work. If you accept analytics, we measure usage in aggregate to learn whether Acrux is useful to more people.',
            'The waitlist and analytics rely on your consent, which you can withdraw at any time. App data is processed because it is needed to provide the service you ask for.',
          ],
        },
        {
          title: 'Who we share it with',
          paragraphs: [
            'Only with the services that run Acrux, under data processing agreements: Neon (database and sign-in), Vercel (servers), PostHog (analytics), Sentry (errors), Lemon Squeezy (payments), Backblaze (backups), Upstash (rate limiting), Buttondown (waitlist) and, once we turn ads on, Google AdSense (advertising). We do not sell your data.',
          ],
        },
        {
          title: 'Advertising',
          paragraphs: [
            'Once we turn ads on, people who use Acrux without Plus will see Google AdSense ads on the home screen, My list, each franchise page and the card screen, never inside the card you share or on your public profile. With Plus, no ads load.',
            'Ads personalized to your interests show only if you accept them, and you can change that choice from your profile. If you decline, you will see non-personalized ads.',
            'Even if you decline personalized ads, outside the European Union, the United Kingdom and Switzerland Google may use cookies or identifiers to limit how often you see an ad and to prevent fraud. In the European Union, the United Kingdom and Switzerland, the choice is made in Google’s privacy message.',
          ],
        },
        {
          title: 'Where it is stored',
          paragraphs: [
            'The database is in Ohio, United States, and the servers are in São Paulo, Brazil. Analytics, in the European Union. Transfers outside Chile are protected by standard contractual clauses.',
          ],
        },
        {
          title: 'How long we keep it',
          paragraphs: [
            'While you stay on the waitlist or have an account. If you unsubscribe or delete your account, your data is erased immediately and disappears from backups within 30 days at the latest.',
          ],
        },
        {
          title: 'Your rights',
          paragraphs: [
            'You can access, download, correct and delete your data, and withdraw analytics consent, at any time. You are protected by Chilean Law 21.719 and, if you live in Europe, by the GDPR.',
          ],
        },
        {
          title: 'Contact',
          paragraphs: ['Write to {email} with any question about your data.'],
        },
      ],
    },
    support: {
      path: '/en/support',
      meta: {
        title: 'Support · Acrux',
        description:
          'How to contact Acrux, leave the waitlist, download your data or delete your account.',
      },
      title: 'Support',
      sections: [
        {
          title: 'Write to us',
          paragraphs: [`Write to {email}. We reply within ${RESPONSE_TIME.en}.`],
        },
        {
          title: 'Leave the waitlist',
          paragraphs: [
            'Every email we send includes a link to leave the list. You can also ask by email.',
          ],
        },
        {
          title: 'Download your data',
          paragraphs: ['In the app, open Settings › Account and privacy › Download my data.'],
        },
        {
          id: 'delete-account',
          title: 'Delete your account',
          paragraphs: [
            'In the app, open Settings › Account and privacy › Delete account. Your data is erased immediately and this cannot be undone.',
          ],
        },
      ],
    },
    terms: {
      path: '/en/terms',
      meta: {
        title: 'Terms of use · Acrux',
        description: 'The rules for using Acrux.',
      },
      title: 'Terms of use',
      updated: 'Last updated: November 11, 2026',
      sections: [
        {
          title: 'What Acrux is',
          paragraphs: [
            'Acrux is an independent app to mark the anime you have watched and share your history. The app may change or fail.',
          ],
        },
        {
          title: 'Acceptable use',
          paragraphs: [
            'Do not use Acrux to send spam, access other people’s accounts or overload the service. We may suspend accounts that do.',
          ],
        },
        {
          title: 'Catalog and MyAnimeList',
          paragraphs: [
            'Catalog data is provided by {mal}. Acrux is not affiliated with or endorsed by {mal}. Anime titles and images belong to their owners.',
          ],
        },
        {
          title: 'Price',
          paragraphs: [
            'Marking, counting and sharing are free. If paid features come later, Lemon Squeezy will process payments and we will let you know before charging you anything.',
          ],
        },
        {
          title: 'No warranty',
          paragraphs: [
            'Acrux is provided as is, without warranties, to the extent the law allows.',
          ],
        },
        {
          title: 'Changes',
          paragraphs: [
            'We may update these terms and will let you know if a change is important. You can delete your account at any time.',
          ],
        },
        {
          title: 'Governing law and contact',
          paragraphs: ['These terms are governed by the laws of Chile. Write to {email}.'],
        },
      ],
    },
  },
};

export function getLegalPage(locale: Locale, key: LegalPageKey): LegalPage {
  return pages[locale][key];
}

// The same page in the other locale, for the language switch and hreflang.
export function legalAlternates(key: LegalPageKey): Record<Locale, string> {
  return { es: pages.es[key].path, en: pages.en[key].path };
}
