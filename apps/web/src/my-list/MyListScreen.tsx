import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AdSlot } from '../ads/AdSlot';
import type { CatalogClient } from '../catalog-source/client';
import { defaultClient } from '../catalog-source/hooks';
import { DataCredit } from '../components/DataCredit';
import { useCounterMode } from '../counter/use-counter-mode';
import { useMarkedFranchises } from '../counter/use-marked-franchises';
import type { CounterMode } from '../counter/use-total-counter';
import type { DramaClient } from '../drama-source/client';
import { useDramaMarkList } from '../dramas/use-drama-marks';
import { DramaList } from './DramaList';
import { type ListRow, myList } from './items';

type AnimeTab = 'watching' | 'seen';
// Dramas have their own tab, apart from the two of the anime (#166).
type Tab = AnimeTab | 'dramas';
const TABS = ['watching', 'seen', 'dramas'] as const satisfies readonly Tab[];

const EMPTY = {
  watching: { title: 'myList.emptyWatchingTitle', text: 'myList.emptyWatchingText' },
  seen: { title: 'myList.emptySeenTitle', text: null },
} as const satisfies Record<AnimeTab, { title: string; text: string | null }>;

function Rows({ rows, tab }: { rows: ListRow[]; tab: AnimeTab }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    const empty = EMPTY[tab];
    return (
      <div className="my-list__empty">
        <span className="my-list__empty-icon" aria-hidden="true">
          {tab === 'watching' ? '▶' : '✓'}
        </span>
        <p className="my-list__empty-title">{t(empty.title)}</p>
        {empty.text && <p className="my-list__empty-text">{t(empty.text)}</p>}
        <Link className="button button--primary" to="/anime">
          {t('myList.explore')}
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
 * Dramas is a third tab with the marked dramas, which the anime figures never count (#166).
 */
export function MyListScreen({
  getToken,
  client = defaultClient,
  dramaClient,
  fetchFn = fetch,
  counterMode,
}: {
  getToken: () => Promise<string | null>;
  client?: CatalogClient | undefined;
  dramaClient?: DramaClient | undefined;
  fetchFn?: typeof fetch | undefined;
  counterMode: CounterMode;
}) {
  const { t } = useTranslation();
  const [mode] = useCounterMode(counterMode);
  const [tab, setTab] = useState<Tab>('seen');
  const marked = useMarkedFranchises({ client, getToken, fetchFn, crawl: true });
  // Only for the count on the tab; the rows load when the tab opens.
  const dramaMarks = useDramaMarkList({ getToken, fetchFn }).data;
  const panelId = useId();
  const { marks, franchises, known, ready } = marked;
  const list = useMemo(
    () =>
      marks && ready ? myList(franchises, marks, known, mode, new Date().toISOString(), t) : null,
    [marks, franchises, known, ready, mode, t],
  );

  return (
    <section className="my-list" aria-labelledby={`${panelId}-title`}>
      <h1 className="my-list__title" id={`${panelId}-title`}>
        {t('myList.title')}
      </h1>
      {marked.failed ? (
        <div className="catalog__notice" role="alert">
          <p>{t('myList.loadFailed')}</p>
          <button className="button button--secondary" type="button" onClick={marked.retry}>
            {t('myList.retry')}
          </button>
        </div>
      ) : !list ? (
        <p className="catalog__state" role="status">
          {t('myList.loading')}
        </p>
      ) : (
        <>
          <dl className="my-list__stats">
            <div>
              <dt>{t('myList.complete')}</dt>
              <dd>{list.stats.complete}</dd>
            </div>
            <div>
              <dt>{t('myList.seenEntries')}</dt>
              <dd>{list.stats.seenEntries}</dd>
            </div>
            <div>
              <dt>{t('myList.watchingNow')}</dt>
              <dd>{list.stats.watching}</dd>
            </div>
          </dl>
          {/* RF-58, ADR-0038: inside the list, between the stats and the tabs. */}
          <AdSlot />
          <div className="my-list__tabs" role="tablist" aria-label={t('myList.title')}>
            {TABS.map((value) => (
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
                  ? t('myList.watchingTab', { count: list.watching.length })
                  : value === 'seen'
                    ? t('myList.seenTab', { count: list.seen.length })
                    : dramaMarks
                      ? t('myList.dramasTab', { count: dramaMarks.length })
                      : t('myList.dramasTabPending')}
              </button>
            ))}
          </div>
          <div id={`${panelId}-panel`} role="tabpanel" aria-labelledby={`${panelId}-${tab}`}>
            {tab === 'dramas' ? (
              <DramaList getToken={getToken} fetchFn={fetchFn} client={dramaClient} />
            ) : (
              <Rows rows={tab === 'watching' ? list.watching : list.seen} tab={tab} />
            )}
          </div>
        </>
      )}
      <DataCredit />
    </section>
  );
}
