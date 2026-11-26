import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { genreLabel } from '../catalog-source/catalog';
import type { CatalogClient } from '../catalog-source/client';
import { DataCredit } from '../components/DataCredit';
import { TvmazeCredit } from '../components/TvmazeCredit';
import type { DramaClient } from '../drama-source/client';
import { CROSSINGS, type Crossing, crossingPath, worldGenrePath } from './crossings';
import { AnimeRow, CrossHeader, DramaRow, LockedSeries } from './WorldRows';

/**
 * Container: one genre in every world (board M4). It asks each catalog for its first page by
 * the name that catalog gives the genre, and shows a row of each.
 */
export function CrossingScreen({
  crossing,
  client,
  dramaClient,
  fetchFn,
}: {
  crossing: Crossing;
  client?: CatalogClient | undefined;
  dramaClient?: DramaClient | undefined;
  fetchFn?: typeof fetch | undefined;
}) {
  const { t } = useTranslation();
  const animeQuery = useMemo(
    () => ({ search: '', years: [], genres: [crossing.anime], formats: [] }),
    [crossing],
  );
  const dramaQuery = useMemo(
    () => ({ search: '', origin: undefined, genres: [crossing.dramas] }),
    [crossing],
  );
  const empty = <p>{t('worlds.crossEmpty')}</p>;

  return (
    <section className="crossing">
      <CrossHeader title={genreLabel(crossing.anime, t)} />

      <nav aria-label={t('worlds.crossGenres')}>
        <ul className="level-row">
          {CROSSINGS.map((it) => (
            <li key={it.key}>
              <Link
                className="chip chip--level"
                to={crossingPath(it)}
                aria-current={it.key === crossing.key ? 'page' : undefined}
              >
                {genreLabel(it.anime, t)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <AnimeRow
        query={animeQuery}
        door={worldGenrePath('anime', crossing)}
        empty={empty}
        client={client}
        fetchFn={fetchFn}
      />
      <DramaRow
        query={dramaQuery}
        door={worldGenrePath('dramas', crossing)}
        empty={empty}
        client={dramaClient}
      />
      <LockedSeries />

      <DataCredit />
      <TvmazeCredit />
    </section>
  );
}
