import type { CatalogClient, Opening } from './client';

// The API takes at most this many ids per request.
const BATCH_SIZE = 100;
// The server reads a few details per request and leaves the rest pending: ten requests cover
// the longest sagas. What is still pending after them shows as not known yet.
const MAX_REQUESTS = 10;

/**
 * The openings of some anime, by id. An id missing from the answer has no known openings yet:
 * the catalog does not hold the anime, or could not read them from its source.
 */
export async function fetchOpenings(
  client: CatalogClient,
  ids: readonly number[],
): Promise<Map<number, Opening[]>> {
  const found = new Map<number, Opening[]>();
  let waiting = [...new Set(ids)];
  for (let request = 0; request < MAX_REQUESTS && waiting.length > 0; request += 1) {
    const answer = await client.openings(waiting.slice(0, BATCH_SIZE));
    for (const item of answer.items) found.set(item.animeId, item.openings);
    waiting = [...answer.pending, ...waiting.slice(BATCH_SIZE)];
  }
  return found;
}

/**
 * A YouTube search for one opening. A plain link: the app calls no YouTube API and embeds no
 * player, so nothing about a video is stored or shown here.
 */
export function youtubeSearchUrl(animeTitle: string, opening: Opening): string {
  const words = [animeTitle, 'opening', opening.title, opening.artist].filter(Boolean).join(' ');
  return `https://www.youtube.com/results?${new URLSearchParams({ search_query: words })}`;
}
