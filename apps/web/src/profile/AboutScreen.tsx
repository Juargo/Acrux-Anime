import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

const LANDING = 'https://acruxanime.com';

// Set at build time by vite.config.ts: package version plus the short commit.
export const APP_VERSION = __APP_VERSION__;

/**
 * "Acerca de Acrux" (#45, RF-74). There is no Figma frame yet (P-08), so it reuses the
 * secondary screen layout. The attribution is the landing's own text (apps/landing/src/legal.ts),
 * required by ADR-0024; "AniList" only names the data source, never the app (RES-24).
 */
export function AboutScreen({ version = APP_VERSION }: { version?: string }) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section className="privacy about" aria-labelledby={titleId}>
      <Link className="card-preview__back" to="/perfil">
        {t('app.backToProfile')}
      </Link>
      <h1 className="card-step__title" id={titleId}>
        {t('about.title')}
      </h1>
      <div className="privacy__status about__attribution">
        <p>{t('about.attribution')}</p>
        <a href="https://anilist.co" target="_blank" rel="noreferrer">
          AniList
        </a>
      </div>
      <ul className="profile__rows">
        <li>
          <a
            className="profile__row"
            href={`${LANDING}/privacidad`}
            target="_blank"
            rel="noreferrer"
          >
            <span>{t('about.privacy')}</span>
            <span className="profile__value" aria-hidden="true">
              ↗
            </span>
          </a>
        </li>
        <li>
          <a className="profile__row" href={`${LANDING}/terminos`} target="_blank" rel="noreferrer">
            <span>{t('about.terms')}</span>
            <span className="profile__value" aria-hidden="true">
              ↗
            </span>
          </a>
        </li>
        <li>
          <a className="profile__row" href={`${LANDING}/soporte`} target="_blank" rel="noreferrer">
            <span>{t('about.support')}</span>
            <span className="profile__value" aria-hidden="true">
              ↗
            </span>
          </a>
        </li>
      </ul>
      <p className="about__version">{t('about.version', { version })}</p>
    </section>
  );
}
