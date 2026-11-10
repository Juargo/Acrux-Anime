import { franchiseProgress } from '@acrux/domain';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AdSlot } from '../ads/AdSlot';
import { useOnline } from '../catalog/hooks';
import type { CatalogItem } from '../catalog/items';
import { type FranchiseMarkedEvent, useFranchiseMarks } from '../catalog/use-franchise-marks';
import type { CatalogClient } from '../catalog-source/client';
import { defaultClient, useFranchise } from '../catalog-source/hooks';
import { catalogErrorMessage } from '../catalog-source/messages';
import { FranchiseDetailView } from './FranchiseDetail';
import { useEntryMarks } from './use-entry-marks';

/**
 * Container: the franchise detail (RF-16, Figma M09 35:1331, D09 36:1689). It builds the whole
 * franchise from any of its entries and marks from there: one entry at a time, or the whole
 * saga with the catalog's one-tap toggle.
 */
export function FranchiseScreen({
  animeId,
  client = defaultClient,
  getToken,
  fetchFn = fetch,
  onFranchiseMarked,
  onEntryMarkedSeen,
}: {
  animeId: number;
  client?: CatalogClient | undefined;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  onFranchiseMarked?: ((event: FranchiseMarkedEvent) => void) | undefined;
  onEntryMarkedSeen?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const online = useOnline();
  const query = useFranchise(animeId, client, fetchFn);
  const marking = useFranchiseMarks({ client, getToken, fetchFn, onFranchiseMarked });
  const entryMarks = useEntryMarks({ getToken, fetchFn, onMarkedSeen: onEntryMarkedSeen });
  const detail = query.data?.detail;

  const progress = useMemo(
    () => detail && franchiseProgress(detail.franchise, marking.marks, new Date().toISOString()),
    [detail, marking.marks],
  );
  const statusOf = useMemo(
    () => new Map(marking.marks.map((mark) => [mark.animeId, mark.status])),
    [marking.marks],
  );

  const valid = Number.isInteger(animeId) && animeId > 0;
  let body: ReactNode;
  if (!online) {
    body = (
      <p className="catalog__notice" role="alert">
        {t('franchise.offline')}
      </p>
    );
  } else if (!valid || query.data?.detail === null) {
    body = (
      <div className="catalog__notice">
        <p>{t('franchise.notFound')}</p>
        <Link className="button button--secondary" to="/">
          {t('franchise.backToCatalog')}
        </Link>
      </div>
    );
  } else if (query.isPending) {
    body = (
      <p className="catalog__state" role="status">
        {t('franchise.loading')}
      </p>
    );
  } else if (query.isError) {
    body = (
      <div className="catalog__notice" role="alert">
        <p>{catalogErrorMessage(query.error, t)}</p>
        <button className="button button--secondary" type="button" onClick={() => query.refetch()}>
          {t('franchise.retry')}
        </button>
      </div>
    );
  } else if (detail && progress) {
    // The saga button undoes only a core whose released entries are all seen (L3).
    const allSeen =
      progress.releasedCore > 0 &&
      progress.seenCore >= progress.releasedCore &&
      progress.state !== 'watching';
    const coreIds = detail.core.map((entry) => entry.animeId);
    const saga: CatalogItem = {
      rootId: detail.franchise.rootId,
      title: detail.title,
      coverUrl: detail.coverUrl,
      dimmed: allSeen,
      coreIds,
      entryIds: [...coreIds, ...detail.extras.map((entry) => entry.animeId)],
    };
    body = (
      <FranchiseDetailView
        detail={detail}
        progress={progress}
        statusOf={statusOf}
        allSeen={allSeen}
        sagaPending={marking.pendingRootId === saga.rootId}
        onToggleSaga={() => marking.toggle(saga)}
        onChangeEntry={entryMarks.change}
      />
    );
  }

  const message = entryMarks.message ?? marking.message;
  return (
    <section className="franchise-screen" aria-label={t('franchise.label')}>
      {message && (
        <p className="catalog__message" role={message.kind}>
          {message.text}
        </p>
      )}
      {body}
      {/* RF-58, ADR-0038: under the detail, only once it is shown (no ads on loading or errors). */}
      {detail && progress && !query.isError && <AdSlot />}
    </section>
  );
}
