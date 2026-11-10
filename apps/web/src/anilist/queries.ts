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
  coverImage: z.object({ large: z.url({ protocol: /^https$/ }).nullable() }),
  format: z.string().nullable(),
  seasonYear: z.number().int().nullable(),
});

export type Media = z.infer<typeof mediaSchema>;

const pageSchema = z.object({ Page: z.object({ media: z.array(mediaSchema) }) });

// Ids in batches of 50 distinct ones; the answer keeps the given order, repeats included.
async function fetchByIds<T extends { id: number }>(
  client: AniListClient,
  query: string,
  schema: z.ZodType<{ Page: { media: T[] } }>,
  ids: number[],
): Promise<T[]> {
  const unique = [...new Set(ids)];
  const found = new Map<number, T>();
  for (let start = 0; start < unique.length; start += BATCH_SIZE) {
    const batch = unique.slice(start, start + BATCH_SIZE);
    const data = await client.request(query, { ids: batch, perPage: BATCH_SIZE }, schema);
    for (const item of data.Page.media) found.set(item.id, item);
  }
  return ids.flatMap((id) => {
    const item = found.get(id);
    return item ? [item] : [];
  });
}

// One request per 50 distinct ids, for lists and the share card.
export function fetchMediaByIds(client: AniListClient, ids: number[]): Promise<Media[]> {
  return fetchByIds(client, MEDIA_BY_IDS, pageSchema, ids);
}

// Advanced stats (RF-53): length, genres, year and format of every seen title.
export const MEDIA_STATS = `
  query MediaStats($ids: [Int], $perPage: Int) {
    Page(perPage: $perPage) {
      media(id_in: $ids, type: ANIME, isAdult: false) {
        id
        format
        seasonYear
        episodes
        duration
        genres
      }
    }
  }
`;

const statsMediaSchema = z.object({
  id: z.number().int(),
  format: z.string().nullable(),
  seasonYear: z.number().int().nullable(),
  episodes: z.number().int().nonnegative().nullable(),
  // Minutes per episode.
  duration: z.number().int().nonnegative().nullable(),
  genres: z
    .array(z.string())
    .nullable()
    .transform((genres) => genres ?? []),
});

export type StatsMedia = z.infer<typeof statsMediaSchema>;

const statsPageSchema = z.object({ Page: z.object({ media: z.array(statsMediaSchema) }) });

export function fetchMediaStats(client: AniListClient, ids: number[]): Promise<StatsMedia[]> {
  return fetchByIds(client, MEDIA_STATS, statsPageSchema, ids);
}
