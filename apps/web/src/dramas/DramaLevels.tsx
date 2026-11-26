import { useTranslation } from 'react-i18next';
import { genreLabel } from '../catalog-source/catalog';
import type { Origin } from '../drama-source/client';
import { COUNTRIES } from './countries';

/**
 * Presentational: the countries as the levels of the Dramas world (board M3). One at most:
 * a tile takes its country, and the tile taken lets it go.
 */
export function CountryTiles(props: {
  origin: Origin | undefined;
  onChange: (origin: Origin | undefined) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="world__countries" aria-label={t('dramas.origin')}>
      {COUNTRIES.map((country) => (
        <button
          key={country}
          type="button"
          className="world__country"
          aria-label={t(`dramas.origins.${country}`)}
          aria-pressed={props.origin === country}
          onClick={() => props.onChange(props.origin === country ? undefined : country)}
        >
          <span className="world__country-name">{t(`dramas.origins.${country}`)}</span>
          <span className="world__country-tag">{t(`worlds.dramas.tags.${country}`)}</span>
        </button>
      ))}
    </fieldset>
  );
}

/**
 * Presentational: the genres in one row, any number of them. "Todos" is the row with none
 * taken; each tap applies at once.
 */
export function GenreRow(props: {
  // Undefined while they load.
  genres: readonly string[] | undefined;
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}) {
  const { selected } = props;
  const { t } = useTranslation();
  return (
    <fieldset className="chip-levels chip-levels--row" aria-label={t('catalog.genre')}>
      <ul className="level-row">
        <li>
          <button
            type="button"
            className="chip chip--level"
            aria-pressed={selected.length === 0}
            onClick={() => props.onChange([])}
          >
            {t('dramas.allGenres')}
          </button>
        </li>
        {props.genres?.map((genre) => (
          <li key={genre}>
            <button
              type="button"
              className="chip chip--level"
              aria-pressed={selected.includes(genre)}
              onClick={() =>
                props.onChange(
                  selected.includes(genre)
                    ? selected.filter((it) => it !== genre)
                    : [...selected, genre],
                )
              }
            >
              {genreLabel(genre, t)}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
