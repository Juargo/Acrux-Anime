import {
  countCompleteFranchises,
  countSeenEntries,
  type Franchise,
  franchiseProgress,
  type Mark,
} from '@acrux/domain';
import type { RelatedMedia } from '../anilist/catalog';
import { displayTitle } from '../catalog/items';
import type { CounterMode } from '../counter/use-total-counter';
import { FORMAT_LABELS } from '../franchise/FranchiseDetail';

// One row of Figma M12: cover, title and "8 de 8 · marcada el 12 de oct.".
export interface ListRow {
  id: string;
  href: string;
  title: string;
  coverUrl: string | null;
  detail: string;
}

export interface MyList {
  // The three figures of M12: "animes completos", "entradas vistas", "viendo ahora".
  stats: { complete: number; seenEntries: number; watching: number };
  watching: ListRow[];
  // What the counter counts in its mode (RNF-42).
  seen: ListRow[];
}

const MONTHS = [
  'ene.',
  'feb.',
  'mar.',
  'abr.',
  'may.',
  'jun.',
  'jul.',
  'ago.',
  'sept.',
  'oct.',
  'nov.',
  'dic.',
];

export function markedOn(iso: string): string {
  const date = new Date(iso);
  return `marcada el ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

type Sortable = ListRow & { markedAt: string };

// Newest mark first; the same moment goes by title.
const byNewest = (a: Sortable, b: Sortable) =>
  b.markedAt.localeCompare(a.markedAt) || a.title.localeCompare(b.title);
const rows = (items: Sortable[]): ListRow[] =>
  items.sort(byNewest).map(({ markedAt: _markedAt, ...row }) => row);

/**
 * The list of RF-27 from the user's marks and the franchises behind them. Viendo holds the
 * franchises in state Viendo (RF-26); Vistas holds exactly what the counter counts in its mode
 * (RDI-32, RNF-42): complete franchises, or every seen entry of any format.
 */
export function myList(
  franchises: readonly Franchise[],
  marks: readonly Mark[],
  known: ReadonlyMap<number, RelatedMedia>,
  mode: CounterMode,
  now: string,
): MyList {
  const coverOf = (id: number) => known.get(id)?.coverImage?.large ?? null;
  const watching: Sortable[] = [];
  const complete: Sortable[] = [];
  for (const franchise of franchises) {
    const ids = new Set([...franchise.core.map((member) => member.id), ...franchise.extras]);
    const own = marks.filter((mark) => ids.has(mark.anilistId));
    if (own.length === 0) continue;
    const progress = franchiseProgress(franchise, marks, now);
    const markedAt = own
      .map((mark) => mark.markedAt)
      .sort()
      .at(-1) as string;
    const row = (): Sortable => ({
      id: `franchise-${franchise.rootId}`,
      href: `/franquicia/${franchise.rootId}`,
      title: franchise.title,
      coverUrl: coverOf(franchise.rootId),
      detail: `${progress.seenCore} de ${progress.releasedCore} · ${markedOn(markedAt)}`,
      markedAt,
    });
    if (progress.state === 'watching') watching.push(row());
    if (progress.complete) complete.push(row());
  }

  const seenEntries = [
    ...new Map(
      marks.filter((mark) => mark.status === 'seen').map((mark) => [mark.anilistId, mark]),
    ).values(),
  ].map((mark): Sortable => {
    const media = known.get(mark.anilistId);
    const format = media?.format ? (FORMAT_LABELS[media.format] ?? media.format) : null;
    return {
      id: `entry-${mark.anilistId}`,
      href: `/franquicia/${mark.anilistId}`,
      title: media ? displayTitle(media) : `Entrada ${mark.anilistId}`,
      coverUrl: coverOf(mark.anilistId),
      detail: [format, markedOn(mark.markedAt)].filter(Boolean).join(' · '),
      markedAt: mark.markedAt,
    };
  });

  return {
    stats: {
      complete: countCompleteFranchises(franchises, marks, now),
      seenEntries: countSeenEntries(marks),
      watching: watching.length,
    },
    watching: rows(watching),
    seen: rows(mode === 'franchise' ? complete : seenEntries),
  };
}
