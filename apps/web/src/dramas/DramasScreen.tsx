import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounced, useOnline } from '../catalog/hooks';
import { catalogErrorMessage } from '../catalog-source/messages';
import { TvmazeCredit } from '../components/TvmazeCredit';
import type { DramaClient } from '../drama-source/client';
import { defaultDramaClient, useDramaGenres, useDramas } from '../drama-source/hooks';
import { DramaFilterSheet, type DramaFilters } from './DramaFilterSheet';
import { DramaGrid } from './DramaGrid';
import { type DramaMarkStatus, useDramaMarks } from './use-drama-marks';

const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters = (): DramaFilters => ({ origin: undefined, genres: [] });

const countLabel = (label: string, count: number) => (count > 0 ? `${label} · ${count}` : label);

/**
 * Container: owns the search, the filters and the drama queries (ADR-0046). It is a sibling of
 * the anime catalog, not a mode of it: it never asks for anime. A card marks the whole show
 * (#154), with its own marks, apart from the anime ones.
 */
export function DramasScreen({
  client = defaultDramaClient,
  getToken,
  fetchFn,
}: {
  client?: DramaClient | undefined;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const search = useDebounced(input.trim(), SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = useState(defaultFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const online = useOnline();

  const query = useMemo(() => ({ search, ...filters }), [search, filters]);
  const dramas = useDramas(query, client);
  const genres = useDramaGenres(sheetOpen, client);
  const items = useMemo(
    () => dramas.data?.pages.flatMap((page) => page.items) ?? [],
    [dramas.data],
  );

  const marking = useDramaMarks({ getToken, fetchFn });
  const marks = useMemo(
    () =>
      new Map<number, DramaMarkStatus>(
        (marking.marks ?? []).map((mark) => [mark.dramaId, mark.status]),
      ),
    [marking.marks],
  );

  const { fetchNextPage } = dramas;
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const searching = search !== '';

  return (
    <section className="catalog" aria-label={t('dramas.label')}>
      <input
        className="catalog__search"
        type="search"
        aria-label={t('dramas.search')}
        placeholder={t('dramas.search')}
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />

      <div className="chips catalog__filters">
        <button
          className="chip"
          type="button"
          aria-pressed={filters.origin !== undefined}
          onClick={() => setSheetOpen(true)}
        >
          {countLabel(t('dramas.origin'), filters.origin ? 1 : 0)}
        </button>
        <button
          className="chip"
          type="button"
          aria-pressed={filters.genres.length > 0}
          onClick={() => setSheetOpen(true)}
        >
          {countLabel(t('catalog.genre'), filters.genres.length)}
        </button>
      </div>

      {!online ? (
        <p className="catalog__notice" role="alert">
          {t('catalog.offline')}
        </p>
      ) : dramas.isPending ? (
        <p className="catalog__state" role="status">
          {t('catalog.loading')}
        </p>
      ) : dramas.isLoadingError ? (
        <div className="catalog__notice" role="alert">
          <p>{catalogErrorMessage(dramas.error, t)}</p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => dramas.refetch()}
          >
            {t('catalog.retry')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="catalog__state">
          <p>{searching ? t('dramas.noResultsFor', { search }) : t('dramas.noResults')}</p>
          {/* S7: titles are TVmaze's international ones, so a local name may not match. */}
          {searching && <p>{t('dramas.internationalTitles')}</p>}
        </div>
      ) : (
        <>
          {marking.failed && (
            <p className="catalog__message" role="alert">
              {t('marks.saveFailed')}
            </p>
          )}
          <DramaGrid items={items} marks={marks} onChange={marking.change} />
          {dramas.isFetchingNextPage && (
            <p className="catalog__state" role="status">
              {t('catalog.loadingMore')}
            </p>
          )}
          {dramas.isFetchNextPageError && !dramas.isFetchingNextPage && (
            <div className="catalog__notice" role="alert">
              <p>{catalogErrorMessage(dramas.error, t)}</p>
              <button className="button button--secondary" type="button" onClick={loadMore}>
                {t('catalog.retry')}
              </button>
            </div>
          )}
          {dramas.hasNextPage && !dramas.isFetchingNextPage && !dramas.isFetchNextPageError && (
            <div className="catalog__more">
              <button className="button button--secondary" type="button" onClick={loadMore}>
                {t('dramas.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
      <TvmazeCredit />

      {sheetOpen && (
        <DramaFilterSheet
          initial={filters}
          genres={genres.data}
          onApply={(next) => {
            setFilters(next);
            setSheetOpen(false);
          }}
          onClear={() => {
            setFilters(defaultFilters());
            setSheetOpen(false);
          }}
          onClose={closeSheet}
        />
      )}
    </section>
  );
}
