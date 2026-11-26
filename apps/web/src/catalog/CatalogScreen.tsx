import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdSlot } from '../ads/AdSlot';
import { FORMAT_FILTERS, formatFilterLabel, genreLabel } from '../catalog-source/catalog';
import type { CatalogClient } from '../catalog-source/client';
import { defaultClient, useCatalog, useFranchiseYears, useGenres } from '../catalog-source/hooks';
import { catalogErrorMessage } from '../catalog-source/messages';
import { DataCredit } from '../components/DataCredit';
import { WorldHeader } from '../explore/WorldHeader';
import { WorldSearchButton } from '../explore/WorldSearchButton';
import { useFranchiseOverrides } from '../franchise/use-franchise-overrides';
import { CatalogGrid } from './CatalogGrid';
import { ChipLevels } from './ChipLevels';
import { EraRail, EraYears } from './EraLevels';
import { eraOf } from './eras';
import { useDebounced, useOnline } from './hooks';
import { toCatalogItems } from './items';
import { AXES, type Axis, LevelAxis } from './LevelAxis';
import { type FranchiseMarkedEvent, useFranchiseMarks } from './use-franchise-marks';

const SEARCH_DEBOUNCE_MS = 300;

const countLabel = (label: string, count: number) => (count > 0 ? `${label} · ${count}` : label);

// Stable, so React calls it once: when the search box comes into view.
const focusOnMount = (element: HTMLInputElement | null) => element?.focus();

/**
 * Container: the Anime world (board M2). Owns the search, the levels taken on each axis (era,
 * genre, format) and the catalog queries (ADR-0017, ADR-0043). Every pick applies at once.
 * Search by name covers every year; otherwise it browses the years of the era taken, or every
 * year when none is.
 */
export function CatalogScreen({
  client = defaultClient,
  getToken,
  fetchFn = fetch,
  onFranchiseMarked,
  initialYears,
}: {
  client?: CatalogClient | undefined;
  // Without a session the catalog still browses, but cards cannot be marked.
  getToken?: (() => Promise<string | null>) | undefined;
  fetchFn?: typeof fetch | undefined;
  onFranchiseMarked?: ((event: FranchiseMarkedEvent) => void) | undefined;
  // The years the screen opens on: the era of the door taken on the map of worlds.
  initialYears?: number[] | undefined;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const search = useDebounced(input.trim(), SEARCH_DEBOUNCE_MS);
  const [years, setYears] = useState<number[]>(initialYears ?? []);
  const [genres, setGenres] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [axis, setAxis] = useState<Axis>('era');
  const [searchOpen, setSearchOpen] = useState(false);
  const axisRef = useRef<HTMLDivElement>(null);
  // Set by a chip that swaps the axis and goes away with it: focus follows to the axis.
  const focusAxis = useRef(false);
  const online = useOnline();

  const query = useMemo(
    () => ({ search, years, genres, formats }),
    [search, years, genres, formats],
  );
  const catalog = useCatalog(query, client);
  const genreOptions = useGenres(axis === 'genre', client);
  // Without the counts the years still work, just without numbers.
  const franchiseYears = useFranchiseYears(client);
  const counts = useMemo(
    () =>
      franchiseYears.data &&
      Object.fromEntries(franchiseYears.data.map((it) => [it.year, it.franchises])),
    [franchiseYears.data],
  );
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
        catalog.data?.pages.flatMap((page) => page.chain) ?? [],
      ),
    [catalog.data, marking.marks, overrides],
  );

  const { fetchNextPage } = catalog;
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const searching = search !== '';
  const currentYear = new Date().getFullYear();
  const era = eraOf(years[0], currentYear);

  useEffect(() => {
    if (!focusAxis.current) return;
    focusAxis.current = false;
    axisRef.current?.querySelector<HTMLInputElement>(`input[value="${axis}"]`)?.focus();
  }, [axis]);

  // What each axis holds, as the chip of the axes that are not in view says it.
  const held: Record<Axis, { label: string; active: boolean }> = {
    era: { label: era ? t(`eras.${era.key}`) : t('levels.era'), active: era !== undefined },
    genre: { label: countLabel(t('levels.genre'), genres.length), active: genres.length > 0 },
    format: { label: countLabel(t('levels.format'), formats.length), active: formats.length > 0 },
  };
  const eraLevels = { years, currentYear, disabled: searching, onChange: setYears };

  return (
    <section className="catalog catalog--world" aria-label={t('catalog.label')}>
      <WorldHeader
        world="anime"
        action={
          <WorldSearchButton
            label={t('catalog.openSearch')}
            open={searchOpen}
            onToggle={() => {
              // A search out of view would filter in silence: closing it clears it.
              if (searchOpen) setInput('');
              setSearchOpen(!searchOpen);
            }}
          />
        }
      >
        {searchOpen && (
          <input
            ref={focusOnMount}
            className="catalog__search"
            type="search"
            aria-label={t('catalog.search')}
            placeholder={t('catalog.search')}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        )}
        <LevelAxis axis={axis} onChange={setAxis} groupRef={axisRef} />
        {axis === 'era' && <EraRail {...eraLevels} />}
        {axis === 'era' && searching && (
          <p className="catalog__era-hint">{t('filters.searchCoversAllYears')}</p>
        )}
      </WorldHeader>

      {axis === 'era' && <EraYears {...eraLevels} counts={counts} />}
      {axis === 'genre' && (
        <ChipLevels
          label={t('levels.genre')}
          options={genreOptions.data?.map((genre) => ({
            value: genre.value,
            label: genreLabel(genre.value, t),
          }))}
          selected={genres}
          loadingText={t('filters.loadingGenres')}
          hint={t('filters.sagaHint')}
          onChange={setGenres}
        />
      )}
      {axis === 'format' && (
        <ChipLevels
          label={t('levels.format')}
          options={FORMAT_FILTERS.map((format) => ({
            value: format.value,
            label: formatFilterLabel(format.value, t),
          }))}
          selected={formats}
          hint={t('filters.sagaHint')}
          onChange={setFormats}
        />
      )}

      <div className="chips catalog__filters">
        {AXES.filter((it) => it !== axis).map((it) => (
          <button
            key={it}
            className="chip chip--level"
            type="button"
            aria-pressed={held[it].active}
            onClick={() => {
              focusAxis.current = true;
              setAxis(it);
            }}
          >
            {!held[it].active && (
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                <path
                  d="M8 2v12M2 8h12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {held[it].label}
          </button>
        ))}
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
      <DataCredit />
    </section>
  );
}
