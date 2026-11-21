import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Drama } from '../drama-source/client';
import type { DramaMarkChange, DramaMarkStatus } from './use-drama-marks';

// Country, year, seasons and episodes, in that order; what the API does not know is left out
// instead of shown as zero or as a guess.
function facts(drama: Drama, t: TFunction): string[] {
  const list: string[] = [];
  if (drama.origin) list.push(t(`dramas.origins.${drama.origin}`));
  if (drama.year !== null) list.push(String(drama.year));
  if (drama.seasons) list.push(t('dramas.seasons', { count: drama.seasons }));
  if (drama.episodes) list.push(t('dramas.episodes', { count: drama.episodes }));
  return list;
}

/**
 * Presentational: the dramas as cards. Dramas have no detail screen, so a card is marked from
 * its two buttons (#154): seen or watching, for the whole show.
 */
export function DramaGrid(props: {
  items: Drama[];
  // The mark of each drama by id.
  marks: ReadonlyMap<number, DramaMarkStatus>;
  onChange: (change: DramaMarkChange) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="drama-grid" aria-label={t('dramas.grid')}>
      {props.items.map((drama) => (
        <DramaCard
          key={drama.id}
          drama={drama}
          status={props.marks.get(drama.id)}
          onChange={props.onChange}
        />
      ))}
    </ul>
  );
}

// Shared with the drama rows of "Mi lista" (#166).
export const MARK_BUTTONS = [
  { status: 'seen', symbol: '✓', mark: 'dramas.markSeen', unmark: 'dramas.unmarkSeen' },
  {
    status: 'watching',
    symbol: '▶',
    mark: 'dramas.markWatching',
    unmark: 'dramas.unmarkWatching',
  },
] as const;

// The cover is decorative: the title names the card.
function DramaCard(props: {
  drama: Drama;
  status: DramaMarkStatus | undefined;
  onChange: (change: DramaMarkChange) => void;
}) {
  const { drama, status } = props;
  const { t } = useTranslation();
  const details = facts(drama, t);
  return (
    <li className="drama-card">
      {MARK_BUTTONS.map((button) => {
        const pressed = status === button.status;
        return (
          <button
            key={button.status}
            className={`catalog-card__mark drama-card__mark drama-card__mark--${button.status}`}
            type="button"
            aria-label={t(pressed ? button.unmark : button.mark, { title: drama.title })}
            aria-pressed={pressed}
            // The pressed button removes the mark; the other one replaces it.
            onClick={() =>
              props.onChange({ dramaId: drama.id, status: pressed ? null : button.status })
            }
          >
            <span aria-hidden="true">{button.symbol}</span>
          </button>
        );
      })}
      {drama.coverUrl ? (
        <img
          className="catalog-card__cover"
          src={drama.coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="catalog-card__cover catalog-card__cover--empty" />
      )}
      <span className="catalog-card__title">{drama.title}</span>
      {details.length > 0 && <span className="drama-card__facts">{details.join(' · ')}</span>}
    </li>
  );
}
