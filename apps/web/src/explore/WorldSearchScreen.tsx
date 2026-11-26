import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogClient } from '../catalog-source/client';
import { DataCredit } from '../components/DataCredit';
import { TvmazeCredit } from '../components/TvmazeCredit';
import type { DramaClient } from '../drama-source/client';
import { AnimeRow, CrossHeader, DramaRow, LockedSeries } from './WorldRows';
import { WorldSearchForm } from './WorldSearchForm';
import { worldSearchPath } from './world-search';

/**
 * Container: one search in every world (board M1). It asks each catalog for its first page of
 * the name and shows a row of each; the door of a row opens that world on the same search.
 */
export function WorldSearchScreen({
  search,
  client,
  dramaClient,
  fetchFn,
}: {
  // Trimmed and not empty.
  search: string;
  client?: CatalogClient | undefined;
  dramaClient?: DramaClient | undefined;
  fetchFn?: typeof fetch | undefined;
}) {
  const { t } = useTranslation();
  const animeQuery = useMemo(() => ({ search, years: [], genres: [], formats: [] }), [search]);
  const dramaQuery = useMemo(() => ({ search, origin: undefined, genres: [] }), [search]);

  return (
    <section className="crossing">
      <CrossHeader title={t('worlds.searchHeading')} />
      <WorldSearchForm initial={search} />

      <AnimeRow
        query={animeQuery}
        door={worldSearchPath('anime', search)}
        empty={<p>{t('catalog.noResultsFor', { search })}</p>}
        client={client}
        fetchFn={fetchFn}
      />
      <DramaRow
        query={dramaQuery}
        door={worldSearchPath('dramas', search)}
        empty={
          <>
            <p>{t('dramas.noResultsFor', { search })}</p>
            {/* Titles are TVmaze's international ones, so a local name may not match. */}
            <p>{t('dramas.internationalTitles')}</p>
          </>
        }
        client={dramaClient}
      />
      <LockedSeries />

      <DataCredit />
      <TvmazeCredit />
    </section>
  );
}
