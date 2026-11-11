import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdSlot } from '../ads/AdSlot';
import type { CatalogClient } from '../catalog-source/client';
import { defaultClient, useCatalog, useGenres } from '../catalog-source/hooks';
import { catalogErrorMessage } from '../catalog-source/messages';
import { useFranchiseOverrides } from '../franchise/use-franchise-overrides';
import { CatalogGrid } from './CatalogGrid';
import { FilterSheet, type Filters } from './FilterSheet';
import { useDebounced, useOnline } from './hooks';
import { toCatalogItems } from './items';
import { type FranchiseMarkedEvent, useFranchiseMarks } from './use-franchise-marks';

const SEARCH_DEBOUNCE_MS = 300;

// The current year is computed at run time (ADR-0017).
const defaultFilters = (): Filters => ({
  year: new Date().getFullYear(),
  genres: [],
  formats: [],
});

const countLabel = (label: string, count: number) => (count > 0 ? `${label} · ${count}` : label);

/**
 * Container: owns the search, the filters and the catalog queries
 * (ADR-0017, ADR-0043). Search by name covers every year; otherwise it browses a year.
 */
export function CatalogScreen({
  client = defaultClient,
  getToken,
  fetchFn = fetch,
  onFranchiseMarked,
}: {
  client?: CatalogClient | undefined;
  // Without a session the catalog still browses, but cards cannot be marked.
  getToken?: (() => Promise<string | null>) | undefined;
  fetchFn?: typeof fetch | undefined;
  onFranchiseMarked?: ((event: FranchiseMarkedEvent) => void) | undefined;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const search = useDebounced(input.trim(), SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = useState(defaultFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const online = useOnline();

  const query = useMemo(() => ({ search, ...filters }), [search, filters]);
  const catalog = useCatalog(query, client);
  const genres = useGenres(sheetOpen, client);
  const marking = useFranchiseMarks({ client, getToken, fetchFn, onFranchiseMarked });
  const overrides = useFranchiseOverrides(fetchFn);

  const items = useMemo(
    () =>
      toCatalogItems(
        catalog.data?.pages.flatMap((page) => page.items) ?? [],
        catalog.data?.pages.flatMap((page) => page.related) ?? [],
        marking.marks,
        new Date().toISOString(),
        overrides,
      ),
    [catalog.data, marking.marks, overrides],
  );

  const { fetchNextPage } = catalog;
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const searching = search !== '';

  return (
    <section className="catalog" aria-label={t('catalog.label')}>
      <input
        className="catalog__search"
        type="search"
        aria-label={t('catalog.search')}
        placeholder={t('catalog.search')}
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />

      <div className="chips catalog__filters">
        <button className="chip" type="button" onClick={() => setSheetOpen(true)}>
          {searching ? t('catalog.allYears') : String(filters.year)}
        </button>
        <button
          className="chip"
          type="button"
          aria-pressed={filters.genres.length > 0}
          onClick={() => setSheetOpen(true)}
        >
          {countLabel(t('catalog.genre'), filters.genres.length)}
        </button>
        <button
          className="chip"
          type="button"
          aria-pressed={filters.formats.length > 0}
          onClick={() => setSheetOpen(true)}
        >
          {countLabel(t('catalog.format'), filters.formats.length)}
        </button>
      </div>
      {/* RF-58, ADR-0038: between sections, after the filters; never while loading or failing. */}
      {online && !catalog.isPending && !catalog.isLoadingError && <AdSlot />}

      {marking.message && (
        <p className="catalog__message" role={marking.message.kind}>
          {marking.message.text}
        </p>
      )}

      {!online ? (
        <p className="catalog__notice" role="alert">
          {t('catalog.offline')}
        </p>
      ) : catalog.isPending ? (
        <p className="catalog__state" role="status">
          {t('catalog.loading')}
        </p>
      ) : catalog.isLoadingError ? (
        <div className="catalog__notice" role="alert">
          <p>{catalogErrorMessage(catalog.error, t)}</p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => catalog.refetch()}
          >
            {t('catalog.retry')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="catalog__state">
          {searching ? t('catalog.noResultsFor', { search }) : t('catalog.noResults')}
        </p>
      ) : (
        <>
          <CatalogGrid
            items={items}
            hasMore={catalog.hasNextPage && !catalog.isFetchNextPageError}
            loadingMore={catalog.isFetchingNextPage}
            onLoadMore={loadMore}
            onToggle={marking.canMark ? marking.toggle : undefined}
            pendingRootId={marking.pendingRootId}
          />
          {catalog.isFetchingNextPage && (
            <p className="catalog__state" role="status">
              {t('catalog.loadingMore')}
            </p>
          )}
          {catalog.isFetchNextPageError && !catalog.isFetchingNextPage && (
            <div className="catalog__notice" role="alert">
              <p>{catalogErrorMessage(catalog.error, t)}</p>
              <button className="button button--secondary" type="button" onClick={loadMore}>
                {t('catalog.retry')}
              </button>
            </div>
          )}
        </>
      )}

      {sheetOpen && (
        <FilterSheet
          initial={filters}
          currentYear={new Date().getFullYear()}
          searching={searching}
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
