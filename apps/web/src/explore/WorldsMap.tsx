import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ERAS } from '../catalog/eras';
import { genreLabel } from '../catalog-source/catalog';
import { COUNTRIES } from '../dramas/countries';
import { crossingPath, MAP_CROSSINGS } from './crossings';
import { WORLD_PATH } from './last-world';
import { WorldSearchForm } from './WorldSearchForm';

/**
 * Presentational: the map of Explorar. One door per world, and one per level of its native
 * axis: the eras of anime, the countries of the dramas. Series is announced but has no door
 * until its catalog exists. Below them, the genres that cross the worlds. It asks for no
 * catalog data.
 */
export function WorldsMap() {
  const { t } = useTranslation();
  const anime = t('worlds.anime.name');
  const dramas = t('worlds.dramas.name');
  return (
    <section className="worlds">
      <h1 className="worlds__title">{t('worlds.title')}</h1>
      <WorldSearchForm />
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

      <nav className="worlds__crossings" aria-labelledby="worlds-crossings">
        <h2 className="worlds__crossings-title" id="worlds-crossings">
          {t('worlds.crossTitle')}
        </h2>
        <ul className="chips">
          {MAP_CROSSINGS.map((crossing) => (
            <li key={crossing.key}>
              <Link className="chip chip--level chip--door" to={crossingPath(crossing)}>
                {genreLabel(crossing.anime, t)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
