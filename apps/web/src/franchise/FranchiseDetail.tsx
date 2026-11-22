import type { FranchiseProgress, MarkStatus } from '@acrux/domain';
import type { TFunction } from 'i18next';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatLabel, genreLabel } from '../catalog-source/catalog';
import type { FranchiseDetail, FranchiseEntryDetail } from '../catalog-source/franchise';
import { FranchiseOpenings, type OpeningsState } from './FranchiseOpenings';
import type { EntryMarkChange } from './use-entry-marks';

// RF-26: Viendo > Vista > Parcial > Sin marcar; M35 flags a season released after completing.
const STATE_LABELS = {
  watching: 'franchise.watching',
  seen: 'franchise.seen',
  partial: 'franchise.partial',
  unmarked: 'franchise.unmarked',
} as const satisfies Record<FranchiseProgress['state'], string>;

const SUBTITLE_GENRES = 2;

export const FRANCHISE_TABS = ['timeline', 'openings'] as const;
export type FranchiseTab = (typeof FRANCHISE_TABS)[number];

const TAB_LABELS = {
  timeline: 'franchise.timeline',
  openings: 'franchise.openings',
} as const satisfies Record<FranchiseTab, string>;

// Figma M09: "TV · 24 ep. · 2020", "Película · 2021". A film is one episode: saying so adds nothing.
function entryMeta(entry: FranchiseEntryDetail, t: TFunction): string {
  const singleFilm = entry.format === 'MOVIE' && entry.episodes === 1;
  return [
    entry.format ? formatLabel(entry.format, t) : null,
    entry.episodes && !singleFilm ? t('franchise.episodes', { count: entry.episodes }) : null,
    entry.year ? String(entry.year) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function subtitle(detail: FranchiseDetail, t: TFunction): string {
  const years = detail.core.flatMap((entry) => (entry.year ? [entry.year] : []));
  const first = Math.min(...years);
  const last = Math.max(...years);
  return [
    t('franchise.entries', { count: detail.core.length }),
    years.length === 0 ? null : first === last ? String(first) : `${first}–${last}`,
    ...detail.genres.slice(0, SUBTITLE_GENRES).map((genre) => genreLabel(genre, t)),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Presentational: the franchise detail (Figma M09 35:1331, D09 36:1689, M35 49:4093). */
export function FranchiseDetailView(props: {
  detail: FranchiseDetail;
  progress: FranchiseProgress;
  statusOf: ReadonlyMap<number, MarkStatus>;
  allSeen: boolean;
  sagaPending: boolean;
  onToggleSaga: () => void;
  onChangeEntry: (change: EntryMarkChange) => void;
  tab: FranchiseTab;
  onChangeTab: (tab: FranchiseTab) => void;
  openings: OpeningsState;
}) {
  const { detail, progress, statusOf, onChangeEntry, tab } = props;
  const { t } = useTranslation();
  const timelineHeading = useId();
  const tabsId = useId();
  const timeline = timelineOf(detail);
  const percent =
    progress.releasedCore === 0 ? 0 : Math.round((progress.seenCore / progress.releasedCore) * 100);
  const chip = t(progress.hasNewEntries ? 'franchise.newSeason' : STATE_LABELS[progress.state]);
  const chipVariant = progress.hasNewEntries ? 'new' : progress.state;

  return (
    <article className="franchise">
      <div className="franchise__hero">
        {detail.coverUrl && <img className="franchise__backdrop" src={detail.coverUrl} alt="" />}
        <Link className="franchise__back" to="/" aria-label={t('franchise.backToCatalog')}>
          <span aria-hidden="true">‹</span>
        </Link>
      </div>

      <h1 className="franchise__title">{detail.title}</h1>
      <p className="franchise__subtitle">{subtitle(detail, t)}</p>

      <div
        className={
          progress.hasNewEntries ? 'franchise__status franchise__status--new' : 'franchise__status'
        }
      >
        <div className="franchise__status-row">
          <span className={`status-chip status-chip--${chipVariant}`}>{chip}</span>
          <span className="franchise__count">
            {t('franchise.seenCount', {
              seen: String(progress.seenCore),
              total: String(progress.releasedCore),
            })}
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label={t('franchise.progress')}
          aria-valuemin={0}
          aria-valuemax={progress.releasedCore}
          aria-valuenow={progress.seenCore}
        >
          <span className="progress__fill" style={{ width: `${percent}%` }} />
        </div>
        {progress.hasNewEntries && <p className="franchise__note">{t('franchise.newEntryNote')}</p>}
      </div>

      <div className="franchise__tabs" role="tablist" aria-label={t('franchise.tabs')}>
        {FRANCHISE_TABS.map((value) => (
          <button
            key={value}
            className="franchise__tab"
            type="button"
            role="tab"
            id={`${tabsId}-${value}`}
            aria-selected={tab === value}
            aria-controls={`${tabsId}-panel`}
            onClick={() => props.onChangeTab(value)}
          >
            {t(TAB_LABELS[value])}
          </button>
        ))}
      </div>
      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`}>
        {tab === 'openings' ? (
          <FranchiseOpenings entries={timeline.map(({ entry }) => entry)} state={props.openings} />
        ) : (
          <section className="franchise__section" aria-labelledby={timelineHeading}>
            {/* The tab already shows the name; the heading keeps it in the outline. */}
            <h2 className="visually-hidden" id={timelineHeading}>
              {t('franchise.timeline')}
            </h2>
            <div className="timeline__legend">
              <span className="timeline__legend-item timeline__legend-item--core">
                {t('franchise.core')}
              </span>
              {detail.extras.length > 0 && (
                <span className="timeline__legend-item timeline__legend-item--extra">
                  {t('franchise.extras')}
                </span>
              )}
            </div>
            <ol className="timeline">
              {timeline.map(({ entry, core }) => (
                <EntryRow
                  key={entry.animeId}
                  entry={entry}
                  core={core}
                  status={statusOf.get(entry.animeId)}
                  onChange={onChangeEntry}
                />
              ))}
              {detail.related.map((related) => (
                <li className="timeline__item timeline__item--related" key={related.rootId}>
                  <Link className="timeline__link" to={`/franquicia/${related.rootId}`}>
                    <span className="timeline__icon timeline__icon--related">
                      <Icon name="related" />
                    </span>
                    <span className="entry-row__text">
                      <span className="entry-row__title">{related.title}</span>
                      <span className="entry-row__meta">{t('franchise.relatedEntry')}</span>
                    </span>
                    <span className="timeline__chevron">
                      <Icon name="chevron" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <div className="franchise__actions">
        <button
          className="button button--primary"
          type="button"
          disabled={props.sagaPending}
          onClick={props.onToggleSaga}
        >
          <span aria-hidden="true">✓</span>
          {t(props.allSeen ? 'franchise.unmarkSaga' : 'franchise.markSaga')}
        </button>
      </div>
    </article>
  );
}

// The cover is decorative: the title names the row.
function Thumb({ url }: { url: string | null }) {
  return url ? (
    <img className="entry-row__thumb" src={url} alt="" loading="lazy" decoding="async" />
  ) : (
    <span className="entry-row__thumb" />
  );
}

// A two-option toggle: tapping the active option removes the mark (L3). Core entries sit on the
// rail with their cover; extras branch off it with the icon of their format.
function EntryRow(props: {
  entry: FranchiseEntryDetail;
  core: boolean;
  status: MarkStatus | undefined;
  onChange: (change: EntryMarkChange) => void;
}) {
  const { entry, core, status, onChange } = props;
  const { t } = useTranslation();
  const icon = iconOf(entry.format);
  const toggle = (next: MarkStatus) =>
    onChange({
      entry: { animeId: entry.animeId },
      status: status === next ? null : next,
    });
  return (
    <li className={core ? 'timeline__item' : 'timeline__item timeline__item--extra'}>
      {core ? (
        <>
          <span
            className={status ? `timeline__node timeline__node--${status}` : 'timeline__node'}
          />
          <Thumb url={entry.coverUrl} />
        </>
      ) : (
        <span className="timeline__icon">
          <Icon name={icon ?? 'special'} />
        </span>
      )}
      <div className="entry-row__text">
        <span className="entry-row__title">
          {core && icon && <Icon name={icon} />}
          {entry.title}
        </span>
        <span className="entry-row__meta">{entryMeta(entry, t)}</span>
        {!core && <span className="visually-hidden">{t('franchise.extra')}</span>}
      </div>
      <fieldset className="segmented segmented--icons" aria-label={entry.title}>
        <button
          className="segmented__option segmented__option--watching"
          type="button"
          aria-label={t('franchise.watching')}
          aria-pressed={status === 'watching'}
          onClick={() => toggle('watching')}
        >
          <Icon name="play" />
        </button>
        <button
          className="segmented__option segmented__option--seen"
          type="button"
          aria-label={t('franchise.seen')}
          aria-pressed={status === 'seen'}
          onClick={() => toggle('seen')}
        >
          <Icon name="check" />
        </button>
      </fieldset>
    </li>
  );
}

const ICON_PATHS = {
  movie: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4" />
    </>
  ),
  special: (
    <path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z" />
  ),
  related: (
    <>
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <path d="M6 7.5v9M18 10.5a6 6 0 0 1-6 6H8.5" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M9 5l7 7-7 7" />,
} as const;

type IconName = keyof typeof ICON_PATHS;

// Decorative: the text next to each icon already names what it stands for.
function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      data-icon={name}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// OVAs read as specials; the other formats have no icon of their own.
function iconOf(format: string | null): 'movie' | 'special' | null {
  if (format === 'MOVIE') return 'movie';
  return format === 'SPECIAL' || format === 'OVA' ? 'special' : null;
}

// Core and extras as one list by year: within a year the core goes first, and entries without
// a year (not released yet) close the list.
export function timelineOf(
  detail: FranchiseDetail,
): { entry: FranchiseEntryDetail; core: boolean }[] {
  const yearOf = (entry: FranchiseEntryDetail) => entry.year ?? Number.MAX_SAFE_INTEGER;
  return [
    ...detail.core.map((entry) => ({ entry, core: true })),
    ...detail.extras.map((entry) => ({ entry, core: false })),
  ].sort((a, b) => yearOf(a.entry) - yearOf(b.entry));
}
