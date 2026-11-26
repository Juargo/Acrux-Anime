import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ERAS } from '../catalog/eras';
import { WORLD_PATH } from './last-world';

// The order of the board, not the one of the API.
const COUNTRIES = ['KR', 'CN', 'JP'] as const;

/**
 * Presentational: the map of Explorar. One door per world, and one per level of its native
 * axis: the eras of anime, the countries of the dramas. Series is announced but has no door
 * until its catalog exists. It asks for no catalog data.
 */
export function WorldsMap() {
  const { t } = useTranslation();
  const anime = t('worlds.anime.name');
  const dramas = t('worlds.dramas.name');
  return (
    <section className="worlds">
      <h1 className="worlds__title">{t('worlds.title')}</h1>
      <div className="worlds__list">
        <section className="world world--anime">
          <div className="world__top">
            <h2 className="world__name">{anime}</h2>
            <Link
              className="world__enter"
              to={WORLD_PATH.anime}
              aria-label={t('worlds.enterWorld', { world: anime })}
            >
              {t('worlds.enter')}
            </Link>
          </div>
          <ol className="world__eras">
            {ERAS.map((era, index) => (
              <li key={era.key}>
                <Link
                  className="world__era"
                  to={`${WORLD_PATH.anime}?era=${era.key}`}
                  aria-label={t('worlds.eraDoor', {
                    name: t(`eras.${era.key}`),
                    from: String(era.first),
                    to: era.last === null ? t('eras.today') : String(era.last),
                  })}
                >
                  <span className="world__era-level">{index + 1}</span>
                  <span className="world__era-year">{era.first}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="world__hint">{t('worlds.anime.hint')}</p>
        </section>

        <section className="world world--dramas">
          <div className="world__top">
            <h2 className="world__name">{dramas}</h2>
            <Link
              className="world__enter"
              to={WORLD_PATH.dramas}
              aria-label={t('worlds.enterWorld', { world: dramas })}
            >
              {t('worlds.enter')}
            </Link>
          </div>
          <ul className="world__countries">
            {COUNTRIES.map((country) => (
              <li key={country}>
                <Link className="world__country" to={`${WORLD_PATH.dramas}?origin=${country}`}>
                  <span className="world__country-name">{t(`dramas.origins.${country}`)}</span>
                  <span className="world__country-tag">{t(`worlds.dramas.tags.${country}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="world world--locked">
          <h2 className="world__name">{t('worlds.series.name')}</h2>
          <p className="world__lock">{t('worlds.series.locked')}</p>
        </section>
      </div>
    </section>
  );
}
