import { useTranslation } from 'react-i18next';
import { BADGES, type BadgeKind } from '../badges/catalog';

const SYMBOL: Record<BadgeKind, string> = { titles: '★', hours: '⏱', genres: '◆' };

/** Presentational: the round mark of a badge (RF-55), dimmed until it is earned. */
export function BadgeMark({ kind, earned = true }: { kind: BadgeKind; earned?: boolean }) {
  return (
    <span
      className={`badge-mark badge-mark--${kind}${earned ? '' : ' badge-mark--locked'}`}
      aria-hidden="true"
    >
      {SYMBOL[kind]}
    </span>
  );
}

/**
 * Presentational: the earned badges shown to others (RF-55), on the public profile and the
 * share card. Unknown ids are skipped; nothing renders without badges.
 */
export function BadgeRow({ ids, className }: { ids: readonly string[]; className?: string }) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);
  const badges = BADGES.filter((badge) => ids.includes(badge.id));
  if (badges.length === 0) return null;
  return (
    <ul className={`badge-row ${className ?? ''}`.trim()} aria-label={t('badges.title')}>
      {badges.map((badge) => (
        <li
          key={badge.id}
          aria-label={t(`badges.name.${badge.kind}`, { goal: number.format(badge.goal) })}
        >
          <BadgeMark kind={badge.kind} />
        </li>
      ))}
    </ul>
  );
}
