import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Drama } from '../drama-source/client';

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
 * Presentational: the dramas as cards. A card only informs: dramas have no detail screen and
 * cannot be marked (#154).
 */
export function DramaGrid({ items }: { items: Drama[] }) {
  const { t } = useTranslation();
  return (
    <ul className="drama-grid" aria-label={t('dramas.grid')}>
      {items.map((drama) => (
        <DramaCard key={drama.id} drama={drama} />
      ))}
    </ul>
  );
}

// The cover is decorative: the title names the card.
function DramaCard({ drama }: { drama: Drama }) {
  const { t } = useTranslation();
  const details = facts(drama, t);
  return (
    <li className="drama-card">
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
