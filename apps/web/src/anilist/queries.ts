import { z } from 'zod';
import type { AniListClient } from './client';

// Every query asks only for the fields a screen uses and excludes adult content
// (ADR-0024, rules 3 and 8). Exported query strings are checked for isAdult: false.

const BATCH_SIZE = 50;

export const MEDIA_BY_IDS = `
  query MediaByIds($ids: [Int], $perPage: Int) {
    Page(perPage: $perPage) {
      media(id_in: $ids, type: ANIME, isAdult: false) {
        id
        idMal
        title { romaji english native }
        coverImage { large }
        format
        seasonYear
      }
    }
  }
`;

const mediaSchema = z.object({
  id: z.number().int(),
  idMal: z.number().int().nullable(),
  title: z.object({
    romaji: z.string().nullable(),
    english: z.string().nullable(),
    native: z.string().nullable(),
  }),
  coverImage: z.object({ large: z.url().nullable() }),
  format: z.string().nullable(),
  seasonYear: z.number().int().nullable(),
});

export type Media = z.infer<typeof mediaSchema>;

const pageSchema = z.object({ Page: z.object({ media: z.array(mediaSchema) }) });

// One request per 50 ids, for lists and the share card; the answer keeps the given order.
export async function fetchMediaByIds(client: AniListClient, ids: number[]): Promise<Media[]> {
  const batches: number[][] = [];
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    batches.push(ids.slice(start, start + BATCH_SIZE));
  }
  const found = new Map<number, Media>();
  for (const batch of batches) {
    const data = await client.request(
      MEDIA_BY_IDS,
      { ids: batch, perPage: BATCH_SIZE },
      pageSchema,
    );
    for (const item of data.Page.media) found.set(item.id, item);
  }
  return ids.flatMap((id) => {
    const item = found.get(id);
    return item ? [item] : [];
  });
}
