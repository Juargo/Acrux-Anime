import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toCatalogItems } from '../catalog/items';
import { genreLabel } from '../catalog-source/catalog';
import type { CatalogClient } from '../catalog-source/client';
import { defaultClient, useCatalog } from '../catalog-source/hooks';
import { catalogErrorMessage } from '../catalog-source/messages';
import { DataCredit } from '../components/DataCredit';
import { TvmazeCredit } from '../components/TvmazeCredit';
import type { DramaClient } from '../drama-source/client';
import { defaultDramaClient, useDramas } from '../drama-source/hooks';
import { useFranchiseOverrides } from '../franchise/use-franchise-overrides';
import { CROSSINGS, type Crossing, crossingPath, worldGenrePath } from './crossings';
import { MAP_PATH, type World } from './last-world';

// A crossing is a taste of each world, not its catalog: the rest is one tap away.
const ROW_LIMIT = 12;

interface RowState {
  pending: boolean;
  error: unknown;
  empty: boolean;
}

/** Presentational: one world of the crossing, with its row and the door to the world. */
function WorldRow(props: {
  world: World;
  crossing: Crossing;
  state: RowState;
  children: ReactNode;
}) {
  const { world, state } = props;
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
          to={worldGenrePath(world, props.crossing)}
          aria-label={t('worlds.goToWorldNamed', { world: name })}
        >
          {t('worlds.goToWorld')}
        </Link>
      </div>
      {state.pending ? (
        <p className="crossing__state" role="status">
          {t('catalog.loading')}
        </p>
      ) : state.error ? (
        <p className="crossing__state" role="alert">
          {catalogErrorMessage(state.error, t)}
        </p>
      ) : state.empty ? (
        <p className="crossing__state">{t('worlds.crossEmpty')}</p>
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
 * Container: one genre in every world (board M4). It asks each catalog for its first page by
 * the name that catalog gives the genre, and shows a row of each. Marking stays in the worlds.
 */
export function CrossingScreen({
  crossing,
  client = defaultClient,
  dramaClient = defaultDramaClient,
  fetchFn = fetch,
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
  const anime = useCatalog(animeQuery, client);
  const dramas = useDramas(dramaQuery, dramaClient);
  const overrides = useFranchiseOverrides(fetchFn);

  const animeItems = useMemo(() => {
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
  const dramaItems = dramas.data?.pages[0]?.items.slice(0, ROW_LIMIT) ?? [];

  return (
    <section className="crossing">
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
        <h1 className="world-header__title">{genreLabel(crossing.anime, t)}</h1>
      </header>

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

      <WorldRow
        world="anime"
        crossing={crossing}
        state={{
          pending: anime.isPending,
          error: anime.isLoadingError ? anime.error : null,
          empty: animeItems.length === 0,
        }}
      >
        {animeItems.map((item) => (
          <li className="crossing__card" key={item.rootId}>
            <Link className="crossing__card-link" to={`/franquicia/${item.rootId}`}>
              <Cover url={item.coverUrl} />
              <span className="crossing__card-title">{item.title}</span>
            </Link>
          </li>
        ))}
      </WorldRow>

      <WorldRow
        world="dramas"
        crossing={crossing}
        state={{
          pending: dramas.isPending,
          error: dramas.isLoadingError ? dramas.error : null,
          empty: dramaItems.length === 0,
        }}
      >
        {dramaItems.map((item) => (
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

      <section className="world world--locked">
        <h2 className="world__name">{t('worlds.inWorld', { world: t('worlds.series.name') })}</h2>
        <p className="world__lock">{t('worlds.series.locked')}</p>
      </section>

      <DataCredit />
      <TvmazeCredit />
    </section>
  );
}
