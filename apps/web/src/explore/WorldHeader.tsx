import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { MAP_PATH, type World } from './last-world';

/**
 * Presentational: names the world on screen and holds the way back to the map. A world can
 * add one action next to its name and its own controls below it (board M2).
 */
export function WorldHeader(props: { world: World; action?: ReactNode; children?: ReactNode }) {
  const { world } = props;
  const { t } = useTranslation();
  return (
    <header className={`world-header world-header--${world}`}>
      <div className="world-header__top">
        <Link className="world-header__back" to={MAP_PATH} aria-label={t('worlds.backToMap')}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
            <path
              d="M14 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1 className="world-header__title">{t(`worlds.${world}.name`)}</h1>
        {props.action}
      </div>
      {props.children}
    </header>
  );
}
