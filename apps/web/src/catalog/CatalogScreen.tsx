import type { Mark } from '@acrux/domain';
import { useCallback, useMemo, useState } from 'react';
import type { AniListClient } from '../anilist/client';
import { defaultClient, useCatalog, useGenres } from '../anilist/hooks';
import { anilistErrorMessage } from '../anilist/messages';
import { CatalogGrid } from './CatalogGrid';
import { FilterSheet, type Filters } from './FilterSheet';
import { useDebounced, useOnline } from './hooks';
import { toCatalogItems } from './items';

const SEARCH_DEBOUNCE_MS = 300;

// The API does not serve marks yet (GET /api/v1/me/marks, #33 and #35): nothing is dimmed
// until then, but the grid already dims what franchiseProgress reports as seen (RF-23).
const NO_MARKS: Mark[] = [];

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
export function CatalogScreen({ client = defaultClient }: { client?: AniListClient }) {
  const [input, setInput] = useState('');
  const search = useDebounced(input.trim(), SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = useState(defaultFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const online = useOnline();

  const query = useMemo(() => ({ search, ...filters }), [search, filters]);
  const catalog = useCatalog(query, client);
  const genres = useGenres(sheetOpen, client);

  const items = useMemo(
    () =>
      toCatalogItems(
        catalog.data?.pages.flatMap((page) => page.media) ?? [],
        NO_MARKS,
        new Date().toISOString(),
      ),
    [catalog.data],
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
