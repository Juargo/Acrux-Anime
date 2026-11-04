import type { FranchiseProgress, MarkStatus } from '@acrux/domain';
import { useId } from 'react';
import { Link } from 'react-router';
import { genreLabel } from '../anilist/catalog';
import type { FranchiseDetail, FranchiseEntryDetail } from '../anilist/franchise';
import type { EntryMarkChange } from './use-entry-marks';

// Figma M09 names formats short: "TV · 24 ep. · 2020", "Película · 2021".
export const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV corto',
  MOVIE: 'Película',
  SPECIAL: 'Especial',
  OVA: 'OVA',
  ONA: 'ONA',
};

// RF-26: Viendo > Vista > Parcial > Sin marcar; M35 flags a season released after completing.
const STATE_LABELS: Record<FranchiseProgress['state'], string> = {
  watching: 'Viendo',
  seen: 'Vista',
  partial: 'Parcial',
  unmarked: 'Sin marcar',
};

const SUBTITLE_GENRES = 2;

function entryMeta(entry: FranchiseEntryDetail): string {
  return [
    entry.format ? (FORMAT_LABELS[entry.format] ?? entry.format) : null,
    entry.episodes ? `${entry.episodes} ep.` : null,
    entry.year ? String(entry.year) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function subtitle(detail: FranchiseDetail): string {
  const years = detail.core.flatMap((entry) => (entry.year ? [entry.year] : []));
  const first = Math.min(...years);
  const last = Math.max(...years);
  return [
    `${detail.core.length} ${detail.core.length === 1 ? 'entrada' : 'entradas'}`,
    years.length === 0 ? null : first === last ? String(first) : `${first}–${last}`,
    ...detail.genres.slice(0, SUBTITLE_GENRES).map(genreLabel),
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
}) {
  const { detail, progress, statusOf, onChangeEntry } = props;
  const coreHeading = useId();
  const extrasHeading = useId();
  const relatedHeading = useId();
  const percent =
    progress.releasedCore === 0 ? 0 : Math.round((progress.seenCore / progress.releasedCore) * 100);
  const chip = progress.hasNewEntries ? 'Nueva temporada' : STATE_LABELS[progress.state];
  const chipVariant = progress.hasNewEntries ? 'new' : progress.state;

  const rows = (entries: FranchiseEntryDetail[]) => (
    <ul className="entry-list">
      {entries.map((entry) => (
        <EntryRow
          key={entry.anilistId}
          entry={entry}
          status={statusOf.get(entry.anilistId)}
          onChange={onChangeEntry}
        />
      ))}
    </ul>
  );

  return (
    <article className="franchise">
      <div className="franchise__hero">
        {detail.coverUrl && <img className="franchise__backdrop" src={detail.coverUrl} alt="" />}
        <Link className="franchise__back" to="/" aria-label="Volver al catálogo">
          <span aria-hidden="true">‹</span>
        </Link>
      </div>

      <h1 className="franchise__title">{detail.title}</h1>
      <p className="franchise__subtitle">{subtitle(detail)}</p>

      <div
        className={
          progress.hasNewEntries ? 'franchise__status franchise__status--new' : 'franchise__status'
        }
      >
        <div className="franchise__status-row">
          <span className={`status-chip status-chip--${chipVariant}`}>{chip}</span>
          <span className="franchise__count">
            {`${progress.seenCore} de ${progress.releasedCore} vistas`}
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Progreso del núcleo"
          aria-valuemin={0}
          aria-valuemax={progress.releasedCore}
          aria-valuenow={progress.seenCore}
        >
          <span className="progress__fill" style={{ width: `${percent}%` }} />
        </div>
        {progress.hasNewEntries && (
          <p className="franchise__note">
            Salió una entrada nueva. Tu total no cambia: esta saga sigue sumando.
          </p>
        )}
      </div>

      <section className="franchise__section" aria-labelledby={coreHeading}>
        <h2 className="franchise__heading" id={coreHeading}>
          Núcleo · cuenta para completar
        </h2>
        {rows(detail.core)}
      </section>

      {detail.extras.length > 0 && (
        <section className="franchise__section" aria-labelledby={extrasHeading}>
          <h2 className="franchise__heading" id={extrasHeading}>
            Extras · no cuentan para completar
          </h2>
          {rows(detail.extras)}
        </section>
      )}

      {detail.related.length > 0 && (
        <section className="franchise__section" aria-labelledby={relatedHeading}>
          <h2 className="franchise__heading" id={relatedHeading}>
            Franquicias relacionadas
          </h2>
          <ul className="related-list">
            {detail.related.map((related) => (
              <li key={related.rootId}>
                <Link className="related-card" to={`/franquicia/${related.rootId}`}>
                  <Thumb url={related.coverUrl} />
                  <span className="entry-row__title">{related.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="franchise__actions">
        <button
          className="button button--primary"
          type="button"
          disabled={props.sagaPending}
          onClick={props.onToggleSaga}
        >
          <span aria-hidden="true">✓</span>
          {props.allSeen ? 'Quitar saga de vistas' : 'Marcar saga como vista'}
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

// A two-option toggle: tapping the active option removes the mark (L3).
function EntryRow(props: {
  entry: FranchiseEntryDetail;
  status: MarkStatus | undefined;
  onChange: (change: EntryMarkChange) => void;
}) {
  const { entry, status, onChange } = props;
  const toggle = (next: MarkStatus) =>
    onChange({
      entry: { anilistId: entry.anilistId, malId: entry.malId },
      status: status === next ? null : next,
    });
  return (
    <li className="entry-row">
      <Thumb url={entry.coverUrl} />
      <div className="entry-row__text">
        <span className="entry-row__title">{entry.title}</span>
        <span className="entry-row__meta">{entryMeta(entry)}</span>
      </div>
      <fieldset className="segmented" aria-label={entry.title}>
        <button
          className="segmented__option segmented__option--watching"
          type="button"
          aria-pressed={status === 'watching'}
          onClick={() => toggle('watching')}
        >
          <span aria-hidden="true">▶</span>
          Viendo
        </button>
        <button
          className="segmented__option segmented__option--seen"
          type="button"
          aria-pressed={status === 'seen'}
          onClick={() => toggle('seen')}
        >
          <span aria-hidden="true">✓</span>
          Vista
        </button>
      </fieldset>
    </li>
  );
}
