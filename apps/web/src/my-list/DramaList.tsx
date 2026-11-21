import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { TvmazeCredit } from '../components/TvmazeCredit';
import type { DramaMarkDto } from '../drama-marks-api';
import type { Drama, DramaClient } from '../drama-source/client';
import { defaultDramaClient, useDramasByIds } from '../drama-source/hooks';
import { MARK_BUTTONS } from '../dramas/DramaGrid';
import { useDramaMarkList, useDramaMarks } from '../dramas/use-drama-marks';
import { markedOn } from './items';

interface Row {
  drama: Drama;
  mark: DramaMarkDto;
}

// Watching first, then seen; inside each, the newest mark first and the same moment by title.
const byStateThenNewest = (a: Row, b: Row) =>
  Number(b.mark.status === 'watching') - Number(a.mark.status === 'watching') ||
  b.mark.markedAt.localeCompare(a.mark.markedAt) ||
  a.drama.title.localeCompare(b.drama.title);

/**
 * Container: the "Dramas" tab of "Mi lista" (#166). Every marked drama in one list, each with
 * the two buttons of its card: a drama has no detail screen, so its state changes right here.
 * A marked drama the catalog does not serve is left out.
 */
export function DramaList({
  getToken,
  fetchFn,
  client = defaultDramaClient,
}: {
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  client?: DramaClient | undefined;
}) {
  const { t } = useTranslation();
  const list = useDramaMarkList({ getToken, fetchFn });
  const marking = useDramaMarks({ getToken, fetchFn });
  const marks = marking.marks;
  const ids = useMemo(() => (marks ?? []).map((mark) => mark.dramaId), [marks]);
  const dramas = useDramasByIds(ids, client);
  const rows = useMemo(() => {
    const known = new Map((dramas.data ?? []).map((drama) => [drama.id, drama]));
    return (marks ?? [])
      .flatMap((mark): Row[] => {
        const drama = known.get(mark.dramaId);
        return drama ? [{ drama, mark }] : [];
      })
      .sort(byStateThenNewest);
  }, [marks, dramas.data]);

  if (!marks ? list.isError : dramas.isError && !dramas.data) {
    return (
      <div className="catalog__notice" role="alert">
        <p>{t('myList.dramasLoadFailed')}</p>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => void (marks ? dramas.refetch() : list.refetch())}
        >
          {t('myList.retry')}
        </button>
      </div>
    );
  }
  if (!marks || (marks.length > 0 && !dramas.data)) {
    return (
      <p className="catalog__state" role="status">
        {t('myList.dramasLoading')}
      </p>
    );
  }
  if (marks.length === 0) {
    return (
      <div className="my-list__empty">
        <span className="my-list__empty-icon" aria-hidden="true">
          ✓
        </span>
        <p className="my-list__empty-title">{t('myList.emptyDramasTitle')}</p>
        <Link className="button button--primary" to="/dramas">
          {t('myList.exploreDramas')}
        </Link>
      </div>
    );
  }
  return (
    <>
      {marking.failed && (
        <p className="catalog__notice" role="alert">
          {t('marks.saveFailed')}
        </p>
      )}
      <ul className="my-list__rows" aria-label={t('myList.dramasList')}>
        {rows.map(({ drama, mark }) => (
          <li key={drama.id} className="list-row">
            {drama.coverUrl ? (
              <img className="list-row__cover" src={drama.coverUrl} alt="" width={40} height={56} />
            ) : (
              <span className="list-row__cover" />
            )}
            <span className="list-row__text">
              <span className="list-row__title">{drama.title}</span>
              <span className="list-row__detail">
                {[
                  drama.origin && t(`dramas.origins.${drama.origin}`),
                  drama.year,
                  markedOn(mark.markedAt, t, 'myList.dramaMarkedOn'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            {MARK_BUTTONS.map((button) => {
              const pressed = mark.status === button.status;
              return (
                <button
                  key={button.status}
                  className={`list-row__mark list-row__mark--${button.status}`}
                  type="button"
                  aria-label={t(pressed ? button.unmark : button.mark, { title: drama.title })}
                  aria-pressed={pressed}
                  // The pressed button removes the mark; the other one replaces it.
                  onClick={() =>
                    marking.change({ dramaId: drama.id, status: pressed ? null : button.status })
                  }
                >
                  <span aria-hidden="true">{button.symbol}</span>
                </button>
              );
            })}
          </li>
        ))}
      </ul>
      <TvmazeCredit />
    </>
  );
}
