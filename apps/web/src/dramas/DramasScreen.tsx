import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounced, useOnline } from '../catalog/hooks';
import { catalogErrorMessage } from '../catalog-source/messages';
import { TvmazeCredit } from '../components/TvmazeCredit';
import type { DramaClient, Origin } from '../drama-source/client';
import { defaultDramaClient, useDramaGenres, useDramas } from '../drama-source/hooks';
import { WorldHeader } from '../explore/WorldHeader';
import { WorldSearchButton } from '../explore/WorldSearchButton';
import { DramaGrid } from './DramaGrid';
import { CountryTiles, GenreRow } from './DramaLevels';
import { type DramaMarkStatus, useDramaMarks } from './use-drama-marks';

const SEARCH_DEBOUNCE_MS = 300;

// Stable, so React calls it once: when the search box comes into view.
const focusOnMount = (element: HTMLInputElement | null) => element?.focus();

/**
 * Container: the Dramas world (board M3). Owns the search, the country and the genres taken,
 * and the drama queries (ADR-0046). Every pick applies at once. It is a sibling of the anime
 * catalog, not a mode of it: it never asks for anime. A card marks the whole show (#154), with
 * its own marks, apart from the anime ones.
 */
export function DramasScreen({
  client = defaultDramaClient,
  getToken,
  fetchFn,
  initialOrigin,
}: {
  client?: DramaClient | undefined;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  // The country the screen opens on: the door taken on the map of worlds.
  initialOrigin?: Origin | undefined;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const search = useDebounced(input.trim(), SEARCH_DEBOUNCE_MS);
  const [origin, setOrigin] = useState(initialOrigin);
  const [genres, setGenres] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const online = useOnline();

  const query = useMemo(() => ({ search, origin, genres }), [search, origin, genres]);
  const dramas = useDramas(query, client);
  const genreOptions = useDramaGenres(true, client);
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
  const searching = search !== '';

  return (
    <section className="catalog catalog--world" aria-label={t('dramas.label')}>
      <WorldHeader
        world="dramas"
        action={
          <WorldSearchButton
            label={t('dramas.openSearch')}
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
            aria-label={t('dramas.search')}
            placeholder={t('dramas.search')}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        )}
        <CountryTiles origin={origin} onChange={setOrigin} />
      </WorldHeader>

      <h2 className="level-title">
        {origin
          ? t('dramas.titleOf', { country: t(`dramas.origins.${origin}`) })
          : t('dramas.titleAll')}
      </h2>
      <GenreRow genres={genreOptions.data} selected={genres} onChange={setGenres} />

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
    </section>
  );
}
