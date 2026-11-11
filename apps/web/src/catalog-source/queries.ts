import type { CatalogAnime, CatalogClient } from './client';

// The API takes at most this many ids per request.
const BATCH_SIZE = 100;

/**
 * The anime of some ids, for lists, the share card, the curator table and the stats: one
 * request per 100 distinct ids. The answer keeps the given order, repeats included, and
 * leaves out the ids the catalog does not hold.
 */
export async function fetchAnimeByIds(
  client: CatalogClient,
  ids: readonly number[],
): Promise<CatalogAnime[]> {
  const unique = [...new Set(ids)];
  const found = new Map<number, CatalogAnime>();
  for (let start = 0; start < unique.length; start += BATCH_SIZE) {
    for (const item of await client.byIds(unique.slice(start, start + BATCH_SIZE))) {
      found.set(item.id, item);
    }
  }
  return ids.flatMap((id) => {
    const item = found.get(id);
    return item ? [item] : [];
  });
}
