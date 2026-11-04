import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { AniListClient } from '../anilist/client';
import { defaultClient } from '../anilist/hooks';
import { useCounterMode } from '../counter/use-counter-mode';
import { useMarkedFranchises } from '../counter/use-marked-franchises';
import type { CounterMode } from '../counter/use-total-counter';
import { type ListRow, myList } from './items';

type Tab = 'watching' | 'seen';

const EMPTY: Record<Tab, { title: string; text: string | null }> = {
  watching: {
    title: 'Aún no estás viendo nada',
    text: 'Marca una saga como "Viendo" y aparecerá en tu tarjeta.',
  },
  seen: { title: 'Aún no marcaste nada como visto.', text: null },
};

function Rows({ rows, tab }: { rows: ListRow[]; tab: Tab }) {
  if (rows.length === 0) {
    const empty = EMPTY[tab];
    return (
      <div className="my-list__empty">
        <span className="my-list__empty-icon" aria-hidden="true">
          {tab === 'watching' ? '▶' : '✓'}
        </span>
        <p className="my-list__empty-title">{empty.title}</p>
        {empty.text && <p className="my-list__empty-text">{empty.text}</p>}
        <Link className="button button--primary" to="/">
          Explorar el catálogo
        </Link>
      </div>
    );
  }
  return (
    <ul className="my-list__rows">
      {rows.map((row) => (
        <li key={row.id}>
          <Link className="list-row" to={row.href}>
            {row.coverUrl ? (
              <img className="list-row__cover" src={row.coverUrl} alt="" width={40} height={56} />
            ) : (
              <span className="list-row__cover" />
            )}
            <span className="list-row__text">
              <span className="list-row__title">{row.title}</span>
              <span className="list-row__detail">{row.detail}</span>
            </span>
            <span className={`list-row__badge list-row__badge--${tab}`} aria-hidden="true">
              {tab === 'watching' ? '▶' : '✓'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Container: "Mi lista" (RF-27, Figma M12/M13). Viendo and Vistas come from the marks and the
 * franchises behind them, crawled once with the counter; Vistas follows the counter's mode.
 */
export function MyListScreen({
  getToken,
  client = defaultClient,
  fetchFn = fetch,
  counterMode,
}: {
  getToken: () => Promise<string | null>;
  client?: AniListClient | undefined;
  fetchFn?: typeof fetch | undefined;
  counterMode: CounterMode;
}) {
  const [mode] = useCounterMode(counterMode);
  const [tab, setTab] = useState<Tab>('seen');
  const marked = useMarkedFranchises({ client, getToken, fetchFn, crawl: true });
  const panelId = useId();
  const { marks, franchises, known, ready } = marked;
  const list = useMemo(
    () =>
      marks && ready ? myList(franchises, marks, known, mode, new Date().toISOString()) : null,
    [marks, franchises, known, ready, mode],
  );

  return (
    <section className="my-list" aria-labelledby={`${panelId}-title`}>
      <h1 className="my-list__title" id={`${panelId}-title`}>
        Mi lista
      </h1>
      {marked.failed ? (
        <div className="catalog__notice" role="alert">
          <p>No pudimos cargar tu lista. Vuelve a intentarlo.</p>
          <button className="button button--secondary" type="button" onClick={marked.retry}>
            Reintentar
          </button>
        </div>
      ) : !list ? (
        <p className="catalog__state" role="status">
          Cargando tu lista…
        </p>
      ) : (
        <>
          <dl className="my-list__stats">
            <div>
              <dt>animes completos</dt>
              <dd>{list.stats.complete}</dd>
            </div>
            <div>
              <dt>entradas vistas</dt>
              <dd>{list.stats.seenEntries}</dd>
            </div>
            <div>
              <dt>viendo ahora</dt>
              <dd>{list.stats.watching}</dd>
            </div>
          </dl>
          <div className="my-list__tabs" role="tablist" aria-label="Mi lista">
            {(['watching', 'seen'] as const).map((value) => (
              <button
                key={value}
                className="my-list__tab"
                type="button"
                role="tab"
                id={`${panelId}-${value}`}
                aria-selected={tab === value}
                aria-controls={`${panelId}-panel`}
                onClick={() => setTab(value)}
              >
                {value === 'watching'
                  ? `Viendo (${list.watching.length})`
                  : `Vistas (${list.seen.length})`}
              </button>
            ))}
          </div>
          <div id={`${panelId}-panel`} role="tabpanel" aria-labelledby={`${panelId}-${tab}`}>
            <Rows rows={tab === 'watching' ? list.watching : list.seen} tab={tab} />
          </div>
        </>
      )}
    </section>
  );
}
