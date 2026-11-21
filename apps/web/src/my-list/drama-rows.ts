import type { DramaMarkDto } from '../drama-marks-api';
import type { Drama } from '../drama-source/client';

export interface DramaRow {
  drama: Drama;
  mark: DramaMarkDto;
}

// Watching first, then seen; inside each, the newest mark first and the same moment by title.
const byStateThenNewest = (a: DramaRow, b: DramaRow) =>
  Number(b.mark.status === 'watching') - Number(a.mark.status === 'watching') ||
  b.mark.markedAt.localeCompare(a.mark.markedAt) ||
  a.drama.title.localeCompare(b.drama.title);

/**
 * The marked dramas in the order of "Mi lista" (#166), shared with the picker of the card. A
 * marked drama the catalog does not serve is left out.
 */
export function dramaRows(marks: readonly DramaMarkDto[], dramas: readonly Drama[]): DramaRow[] {
  const known = new Map(dramas.map((drama) => [drama.id, drama]));
  return marks
    .flatMap((mark): DramaRow[] => {
      const drama = known.get(mark.dramaId);
      return drama ? [{ drama, mark }] : [];
    })
    .sort(byStateThenNewest);
}
