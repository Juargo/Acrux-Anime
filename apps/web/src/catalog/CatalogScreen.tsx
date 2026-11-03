import { useCallback, useMemo, useState } from 'react';
import type { AniListClient } from '../anilist/client';
import { defaultClient, useCatalog, useGenres } from '../anilist/hooks';
import { anilistErrorMessage } from '../anilist/messages';
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
 * Container: owns the search, the filters and the AniList queries of the catalog
 * (ADR-0017, ADR-0024). Search by name covers every year; otherwise it browses a year.
 */
export function CatalogScreen({
  client = defaultClient,
  getToken,
  fetchFn = fetch,
  onFranchiseMarked,
}: {
  client?: AniListClient;
  // Without a session the catalog still browses, but cards cannot be marked.
  getToken?: () => Promise<string | null>;
  fetchFn?: typeof fetch;
  onFranchiseMarked?: (event: FranchiseMarkedEvent) => void;
}) {
  const [input, setInput] = useState('');
  const search = useDebounced(input.trim(), SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = useState(defaultFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const online = useOnline();

  const query = useMemo(() => ({ search, ...filters }), [search, filters]);
  const catalog = useCatalog(query, client);
  const genres = useGenres(sheetOpen, client);
  const marking = useFranchiseMarks({ client, getToken, fetchFn, onFranchiseMarked });

  const items = useMemo(
    () =>
      toCatalogItems(
        catalog.data?.pages.flatMap((page) => page.media) ?? [],
        marking.marks,
        new Date().toISOString(),
      ),
    [catalog.data, marking.marks],
  );

  const { fetchNextPage } = catalog;
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const searching = search !== '';

  return (
    <section className="catalog" aria-label="Explorar">
      <input
        className="catalog__search"
        type="search"
        aria-label="Buscar anime"
        placeholder="Buscar anime"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />

      <div className="chips catalog__filters">
        <button className="chip" type="button" onClick={() => setSheetOpen(true)}>
          {searching ? 'Todos los años' : String(filters.year)}
        </button>
        <button
          className="chip"
          type="button"
          aria-pressed={filters.genres.length > 0}
          onClick={() => setSheetOpen(true)}
        >
          {countLabel('Género', filters.genres.length)}
        </button>
        <button
          className="chip"
          type="button"
          aria-pressed={filters.formats.length > 0}
          onClick={() => setSheetOpen(true)}
        >
          {countLabel('Tipo', filters.formats.length)}
        </button>
      </div>

      {marking.message && (
        <p className="catalog__message" role={marking.message.kind}>
          {marking.message.text}
        </p>
      )}

      {!online ? (
        <p className="catalog__notice" role="alert">
          Estás sin conexión. El catálogo se carga cuando vuelvas a conectarte; lo que marcaste
          sigue guardado.
        </p>
      ) : catalog.isPending ? (
        <p className="catalog__state" role="status">
          Cargando el catálogo…
        </p>
      ) : catalog.isLoadingError ? (
        <div className="catalog__notice" role="alert">
          <p>{anilistErrorMessage(catalog.error)}</p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => catalog.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="catalog__state">
          {searching
            ? `No encontramos animes para «${search}».`
            : 'No encontramos animes con estos filtros.'}
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
              Cargando más…
            </p>
          )}
          {catalog.isFetchNextPageError && !catalog.isFetchingNextPage && (
            <div className="catalog__notice" role="alert">
              <p>{anilistErrorMessage(catalog.error)}</p>
              <button className="button button--secondary" type="button" onClick={loadMore}>
                Reintentar
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
