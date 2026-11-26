import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toCatalogItems } from '../catalog/items';
import type { CatalogQuery } from '../catalog-source/catalog';
import type { CatalogClient } from '../catalog-source/client';
import { defaultClient, useCatalog } from '../catalog-source/hooks';
import { catalogErrorMessage } from '../catalog-source/messages';
import type { DramaBrowseParams, DramaClient } from '../drama-source/client';
import { defaultDramaClient, useDramas } from '../drama-source/hooks';
import { useFranchiseOverrides } from '../franchise/use-franchise-overrides';
import { MAP_PATH, type World } from './last-world';

// The screens that read across the worlds (a genre, a search) show a taste of each world, not
// its catalog: the rest is one tap away, behind the door of the row.
const ROW_LIMIT = 12;

/** Presentational: the way back to the map and what is being read across the worlds. */
export function CrossHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <header className="crossing__header">
      <Link className="world-header__back" to={MAP_PATH} aria-label={t('worlds.backToMap')}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
          <path
            d="M14 5l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
      <h1 className="world-header__title">{title}</h1>
    </header>
  );
}

/** Presentational: Series has no catalog yet, so it is announced with no row. */
export function LockedSeries() {
  const { t } = useTranslation();
  return (
    <section className="world world--locked">
      <h2 className="world__name">{t('worlds.inWorld', { world: t('worlds.series.name') })}</h2>
      <p className="world__lock">{t('worlds.series.locked')}</p>
    </section>
  );
}

/** Presentational: one world, with its row and the door to the world. */
function WorldRow(props: {
  world: World;
  door: string;
  pending: boolean;
  error: unknown;
  // Shown instead of the row when the world has nothing.
  empty: ReactNode;
  children: ReactNode[];
}) {
  const { world } = props;
  const { t } = useTranslation();
  const name = t(`worlds.${world}.name`);
  const titleId = `crossing-${world}`;
  return (
    <section className="crossing__world" aria-labelledby={titleId}>
      <div className="crossing__world-top">
        <span className={`crossing__swatch world--${world}`} aria-hidden="true" />
        <h2 className="crossing__world-name" id={titleId}>
          {t('worlds.inWorld', { world: name })}
        </h2>
        <Link
          className="crossing__door"
          to={props.door}
          aria-label={t('worlds.goToWorldNamed', { world: name })}
        >
          {t('worlds.goToWorld')}
        </Link>
      </div>
      {props.pending ? (
        <p className="crossing__state" role="status">
          {t('catalog.loading')}
        </p>
      ) : props.error ? (
        <p className="crossing__state" role="alert">
          {catalogErrorMessage(props.error, t)}
        </p>
      ) : props.children.length === 0 ? (
        <div className="crossing__state">{props.empty}</div>
      ) : (
        <ul className="crossing__row">{props.children}</ul>
      )}
    </section>
  );
}

function Cover({ url }: { url: string | null }) {
  return url ? (
    <img className="catalog-card__cover" src={url} alt="" loading="lazy" />
  ) : (
    <span className="catalog-card__cover catalog-card__cover--empty" />
  );
}

/**
 * Container: the first page of the anime catalog for a query, one card per franchise. A card
 * opens its franchise; marking stays in the world.
 */
export function AnimeRow({
  query,
  door,
  empty,
  client = defaultClient,
  fetchFn = fetch,
}: {
  // Memoized by the caller.
  query: CatalogQuery;
  door: string;
  empty: ReactNode;
  client?: CatalogClient | undefined;
  fetchFn?: typeof fetch | undefined;
}) {
  const anime = useCatalog(query, client);
  const overrides = useFranchiseOverrides(fetchFn);
  const items = useMemo(() => {
    const page = anime.data?.pages[0];
    if (!page) return [];
    return toCatalogItems(
      page.items,
      page.related,
      [],
      new Date().toISOString(),
      overrides,
      page.chain,
    ).slice(0, ROW_LIMIT);
  }, [anime.data, overrides]);

  return (
    <WorldRow
      world="anime"
      door={door}
      pending={anime.isPending}
      error={anime.isLoadingError ? anime.error : null}
      empty={empty}
    >
      {items.map((item) => (
        <li className="crossing__card" key={item.rootId}>
          <Link className="crossing__card-link" to={`/franquicia/${item.rootId}`}>
            <Cover url={item.coverUrl} />
            <span className="crossing__card-title">{item.title}</span>
          </Link>
        </li>
      ))}
    </WorldRow>
  );
}

/**
 * Container: the first page of the dramas for a query. The dramas have no detail screen, so a
 * card opens nothing.
 */
export function DramaRow({
  query,
  door,
  empty,
  client = defaultDramaClient,
}: {
  // Memoized by the caller.
  query: Omit<DramaBrowseParams, 'page'>;
  door: string;
  empty: ReactNode;
  client?: DramaClient | undefined;
}) {
  const { t } = useTranslation();
  const dramas = useDramas(query, client);
  const items = dramas.data?.pages[0]?.items.slice(0, ROW_LIMIT) ?? [];

  return (
    <WorldRow
      world="dramas"
      door={door}
      pending={dramas.isPending}
      error={dramas.isLoadingError ? dramas.error : null}
      empty={empty}
    >
      {items.map((item) => (
        <li className="crossing__card" key={item.id}>
          <Cover url={item.coverUrl} />
          <span className="crossing__card-title">{item.title}</span>
          <span className="crossing__card-facts">
            {[item.origin && t(`dramas.origins.${item.origin}`), item.year]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </li>
      ))}
    </WorldRow>
  );
}
