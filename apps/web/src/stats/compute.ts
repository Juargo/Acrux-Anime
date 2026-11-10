import type { StatsMedia } from '../anilist/queries';

// Advanced stats (RF-53), computed in the browser from the seen titles (ADR-0024).
export interface Stats {
  titles: number;
  episodes: number;
  minutes: number;
  // Seen titles whose episodes or duration AniList does not know: counted, without time.
  unknownLength: number;
  genres: { genre: string; count: number; share: number }[];
  // Distinct genres among the seen titles, for the badges (RF-55).
  genreCount: number;
  decades: { decade: number; count: number }[];
  formats: { format: string; count: number }[];
}

const TOP_GENRES = 5;

function tally<K>(keys: Iterable<K>): Map<K, number> {
  const counts = new Map<K, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

export function computeStats(seen: StatsMedia[]): Stats {
  let episodes = 0;
  let minutes = 0;
  let unknownLength = 0;
  for (const item of seen) {
    if (item.episodes === null || item.duration === null) {
      unknownLength += 1;
      continue;
    }
    episodes += item.episodes;
    minutes += item.episodes * item.duration;
  }

  const titles = seen.length;
  const genreCounts = tally(seen.flatMap((item) => item.genres));
  const genres = [...genreCounts]
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .slice(0, TOP_GENRES)
    .map(([genre, count]) => ({ genre, count, share: count / titles }));
  const decades = [
    ...tally(
      seen.flatMap((item) =>
        item.seasonYear === null ? [] : [Math.floor(item.seasonYear / 10) * 10],
      ),
    ),
  ]
    .sort(([a], [b]) => a - b)
    .map(([decade, count]) => ({ decade, count }));
  const formats = [...tally(seen.flatMap((item) => (item.format === null ? [] : [item.format])))]
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .map(([format, count]) => ({ format, count }));

  return {
    titles,
    episodes,
    minutes,
    unknownLength,
    genres,
    genreCount: genreCounts.size,
    decades,
    formats,
  };
}
