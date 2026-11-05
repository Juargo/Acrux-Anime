import { franchiseProgress } from '@acrux/domain';
import { type ReactNode, useMemo } from 'react';
import { Link } from 'react-router';
import type { AniListClient } from '../anilist/client';
import { defaultClient, useFranchise } from '../anilist/hooks';
import { anilistErrorMessage } from '../anilist/messages';
import { useOnline } from '../catalog/hooks';
import type { CatalogItem } from '../catalog/items';
import { type FranchiseMarkedEvent, useFranchiseMarks } from '../catalog/use-franchise-marks';
import { FranchiseDetailView } from './FranchiseDetail';
import { useEntryMarks } from './use-entry-marks';

/**
 * Container: the franchise detail (RF-16, Figma M09 35:1331, D09 36:1689). It builds the whole
 * franchise from any of its entries and marks from there: one entry at a time, or the whole
 * saga with the catalog's one-tap toggle.
 */
export function FranchiseScreen({
  anilistId,
  client = defaultClient,
  getToken,
  fetchFn = fetch,
  onFranchiseMarked,
}: {
  anilistId: number;
  client?: AniListClient | undefined;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  onFranchiseMarked?: ((event: FranchiseMarkedEvent) => void) | undefined;
}) {
  const online = useOnline();
  const query = useFranchise(anilistId, client);
  const marking = useFranchiseMarks({ client, getToken, fetchFn, onFranchiseMarked });
  const entryMarks = useEntryMarks({ getToken, fetchFn });
  const detail = query.data?.detail;

  const progress = useMemo(
    () => detail && franchiseProgress(detail.franchise, marking.marks, new Date().toISOString()),
    [detail, marking.marks],
  );
  const statusOf = useMemo(
    () => new Map(marking.marks.map((mark) => [mark.anilistId, mark.status])),
    [marking.marks],
  );

  const valid = Number.isInteger(anilistId) && anilistId > 0;
  let body: ReactNode;
  if (!online) {
    body = (
      <p className="catalog__notice" role="alert">
        Estás sin conexión. La franquicia se carga cuando vuelvas a conectarte; lo que marcaste
        sigue guardado.
      </p>
    );
  } else if (!valid || query.data?.detail === null) {
    body = (
      <div className="catalog__notice">
        <p>No encontramos esta franquicia en AniList.</p>
        <Link className="button button--secondary" to="/">
          Volver al catálogo
        </Link>
      </div>
    );
  } else if (query.isPending) {
    body = (
      <p className="catalog__state" role="status">
        Cargando la franquicia…
      </p>
    );
  } else if (query.isError) {
    body = (
      <div className="catalog__notice" role="alert">
        <p>{anilistErrorMessage(query.error)}</p>
        <button className="button button--secondary" type="button" onClick={() => query.refetch()}>
          Reintentar
        </button>
      </div>
    );
  } else if (detail && progress) {
    // The saga button undoes only a core whose released entries are all seen (L3).
    const allSeen =
      progress.releasedCore > 0 &&
      progress.seenCore >= progress.releasedCore &&
      progress.state !== 'watching';
    const coreIds = detail.core.map((entry) => entry.anilistId);
    const saga: CatalogItem = {
      rootId: detail.franchise.rootId,
      title: detail.title,
      coverUrl: detail.coverUrl,
      dimmed: allSeen,
      coreIds,
      entryIds: [...coreIds, ...detail.extras.map((entry) => entry.anilistId)],
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
    <section className="franchise-screen" aria-label="Detalle de franquicia">
      {message && (
        <p className="catalog__message" role={message.kind}>
          {message.text}
        </p>
      )}
      {body}
    </section>
  );
}
