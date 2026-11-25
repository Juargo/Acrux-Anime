import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { WORLD_PATH, WORLDS } from './last-world';

/**
 * Presentational: the map of Explorar. One door per world; Series is announced but has no door
 * until its catalog exists. It asks for no catalog data.
 */
export function WorldsMap() {
  const { t } = useTranslation();
  return (
    <section className="worlds">
      <h1 className="worlds__title">{t('worlds.title')}</h1>
      <div className="worlds__list">
        {WORLDS.map((world) => {
          const name = t(`worlds.${world}.name`);
          return (
            <section key={world} className={`world world--${world}`}>
              <div className="world__top">
                <h2 className="world__name">{name}</h2>
                <Link
                  className="world__enter"
                  to={WORLD_PATH[world]}
                  aria-label={t('worlds.enterWorld', { world: name })}
                >
                  {t('worlds.enter')}
                </Link>
              </div>
              <p className="world__hint">{t(`worlds.${world}.hint`)}</p>
            </section>
          );
        })}
        <section className="world world--locked">
          <h2 className="world__name">{t('worlds.series.name')}</h2>
          <p className="world__lock">{t('worlds.series.locked')}</p>
        </section>
      </div>
    </section>
  );
}
