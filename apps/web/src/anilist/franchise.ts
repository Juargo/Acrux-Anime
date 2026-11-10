import { type Franchise, type FranchiseOverride, groupFranchises } from '@acrux/domain';
import { z } from 'zod';
import { catalogEntries, displayTitle } from '../catalog/items';
import { type CatalogMedia, catalogMediaSchema, MEDIA_FIELDS, type RelatedMedia } from './catalog';
import type { AniListClient } from './client';

// The catalog only knows one hop of relations. Marking a franchise (RDI-31) needs its whole
// core, so this follows sequels and prequels from the known ids, one id_in batch per hop.
export const FRANCHISE_MEDIA = `
  query FranchiseMedia($ids: [Int], $perPage: Int) {
    Page(perPage: $perPage) {
      media(id_in: $ids, type: ANIME, isAdult: false) {
        ${MEDIA_FIELDS}
        episodes
        genres
        relations {
          edges {
            relationType(version: 2)
            node { ${MEDIA_FIELDS} }
          }
        }
      }
    }
  }
`;

const BATCH_SIZE = 50;
// Each request follows one hop, so this bounds the length of a sequel chain: twenty covers
// the longest linear sagas while staying under AniList's 30 requests a minute.
const MAX_REQUESTS = 20;
const CORE_RELATIONS = new Set(['SEQUEL', 'PREQUEL']);

// Episodes and genres only come for the crawled entries, never for their one-hop neighbours.
const franchiseMediaSchema = catalogMediaSchema.extend({
  episodes: z.number().int().nullish(),
  genres: z.array(z.string()).nullish(),
});
type FranchiseMedia = z.infer<typeof franchiseMediaSchema>;

const pageSchema = z.object({ Page: z.object({ media: z.array(franchiseMediaSchema) }) });

export interface FranchiseEntry {
  animeId: number;
  malId: number | null;
}

// One row of the franchise detail (Figma M09: "TV · 24 ep. · 2020").
export interface FranchiseEntryDetail extends FranchiseEntry {
  title: string;
  format: string | null;
  year: number | null;
  episodes: number | null;
  coverUrl: string | null;
}

export interface RelatedFranchise {
  rootId: number;
  title: string;
  coverUrl: string | null;
}

// What the detail screen shows (RF-16).
export interface FranchiseDetail {
  // The grouping, for franchiseProgress.
  franchise: Franchise;
  title: string;
  coverUrl: string | null;
  // AniList genres of the root entry, in English.
  genres: string[];
  core: FranchiseEntryDetail[];
  extras: FranchiseEntryDetail[];
  // Spin-offs and remakes, as far as the one-hop relations show them.
  related: RelatedFranchise[];
}

export interface FullFranchise {
  core: FranchiseEntry[];
  extras: FranchiseEntry[];
  // null when AniList does not know the seed.
  detail: FranchiseDetail | null;
}

// Follows sequels and prequels from the seeds, one id_in batch per hop, for at most
// `maxRequests` requests. `pending` holds the ids it found but had no request left for.
async function crawl(
  client: AniListClient,
  seedIds: readonly number[],
  maxRequests: number,
): Promise<{ fetched: Map<number, FranchiseMedia>; requested: number[]; pending: number[] }> {
  const fetched = new Map<number, FranchiseMedia>();
  const requested: number[] = [];
  let frontier = [...new Set(seedIds)];
  for (let requests = 0; frontier.length > 0 && requests < maxRequests; requests += 1) {
    const batch = frontier.slice(0, BATCH_SIZE);
    const data = await client.request(
      FRANCHISE_MEDIA,
      { ids: batch, perPage: BATCH_SIZE },
      pageSchema,
    );
    requested.push(...batch);
    for (const media of data.Page.media) fetched.set(media.id, media);
    const next = new Set(frontier.slice(BATCH_SIZE));
    for (const media of data.Page.media) {
      for (const { relationType, node } of media.relations.edges) {
        const follow =
          CORE_RELATIONS.has(relationType) &&
          node.type === 'ANIME' &&
          node.isAdult !== true &&
          node.format !== 'MUSIC';
        if (follow && !fetched.has(node.id) && !batch.includes(node.id)) next.add(node.id);
      }
    }
    frontier = [...next];
  }
  return { fetched, requested, pending: frontier };
}

/**
 * The franchises of many entries at once, for the total counter (RDI-32): the media of every
 * crawled id, the ids it asked AniList for (known or not) and the ids left for a later call.
 */
export async function crawlFranchises(
  client: AniListClient,
  seedIds: readonly number[],
): Promise<{ media: CatalogMedia[]; requested: number[]; pending: number[] }> {
  const { fetched, requested, pending } = await crawl(client, seedIds, MAX_REQUESTS);
  return { media: [...fetched.values()], requested, pending };
}

// The curator table (RF-60) is applied before automatic grouping.
export async function fetchFranchise(
  client: AniListClient,
  seedIds: readonly number[],
  overrides: readonly FranchiseOverride[] = [],
): Promise<FullFranchise> {
  const { fetched, pending } = await crawl(client, seedIds, MAX_REQUESTS);

  // RDI-31 marks the whole core: never save part of one.
  if (pending.length > 0) throw new Error('Franchise incomplete: the sequel chain is too long');

  const { entries, known } = catalogEntries([...fetched.values()]);
  const seed = seedIds[0];
  const franchises = groupFranchises(entries, overrides);
  const franchise = franchises.find((candidate) =>
    candidate.core.some((member) => member.id === seed),
  );
  const toEntry = (animeId: number): FranchiseEntry => ({
    animeId,
    malId: known.get(animeId)?.idMal ?? null,
  });
  return {
    core: franchise?.core.map((member) => toEntry(member.id)) ?? [],
    extras: franchise?.extras.map(toEntry) ?? [],
    detail: franchise ? describe(franchise, franchises, known, fetched) : null,
  };
}

function describe(
  franchise: Franchise,
  franchises: readonly Franchise[],
  known: ReadonlyMap<number, RelatedMedia>,
  fetched: ReadonlyMap<number, FranchiseMedia>,
): FranchiseDetail {
  const coverOf = (id: number) => known.get(id)?.coverImage?.large ?? null;
  const toDetail = (animeId: number): FranchiseEntryDetail => {
    const media = known.get(animeId);
    return {
      animeId,
      malId: media?.idMal ?? null,
      title: media ? displayTitle(media) : '',
      format: media?.format ?? null,
      year: media?.startDate.year ?? null,
      episodes: fetched.get(animeId)?.episodes ?? null,
      coverUrl: coverOf(animeId),
    };
  };
  const titleOf = new Map(franchises.map((other) => [other.rootId, other.title]));
  return {
    franchise,
    title: franchise.title,
    coverUrl: coverOf(franchise.rootId),
    genres: fetched.get(franchise.rootId)?.genres ?? [],
    core: franchise.core.map((member) => toDetail(member.id)),
    extras: franchise.extras.map(toDetail),
    related: franchise.related.map((rootId) => ({
      rootId,
      title: titleOf.get(rootId) ?? '',
      coverUrl: coverOf(rootId),
    })),
  };
}
