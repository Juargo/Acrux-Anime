import { type Franchise, type FranchiseOverride, groupFranchises } from '@acrux/domain';
import { catalogEntries, displayTitle } from '../catalog/items';
import type { CatalogAnime, CatalogClient } from './client';

// The server follows sequels and prequels itself, up to a limit per request, and leaves the
// rest as `pending`. Marking a franchise (RDI-31) needs its whole core, so a pending id is
// sent as a seed of the next request.

// The API takes at most this many seeds per request.
const BATCH_SIZE = 100;
// Each request follows the whole chain up to the server's limit, so this bounds the requests
// one crawl makes: ten cover the longest sagas and a very large seed list.
const MAX_REQUESTS = 10;

export interface FranchiseEntry {
  animeId: number;
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
  // Genres of the root entry, in English.
  genres: string[];
  core: FranchiseEntryDetail[];
  extras: FranchiseEntryDetail[];
  // Spin-offs and remakes, as far as the one-hop relations show them.
  related: RelatedFranchise[];
}

export interface FullFranchise {
  core: FranchiseEntry[];
  extras: FranchiseEntry[];
  // null when the catalog does not hold the seed.
  detail: FranchiseDetail | null;
}

interface Crawl {
  items: Map<number, CatalogAnime>;
  related: Map<number, CatalogAnime>;
  // Every id asked about, held by the catalog or not.
  requested: Set<number>;
  // Ids found by a crawl that ran out of requests; the next crawl continues from them.
  pending: number[];
}

// Asks for the seeds in batches and follows `pending` ids, for at most `maxRequests` requests.
async function crawl(
  client: CatalogClient,
  seedIds: readonly number[],
  maxRequests: number,
): Promise<Crawl> {
  const result: Crawl = {
    items: new Map(),
    related: new Map(),
    requested: new Set(),
    pending: [],
  };
  let frontier = [...new Set(seedIds)];
  for (let requests = 0; frontier.length > 0 && requests < maxRequests; requests += 1) {
    const batch = frontier.slice(0, BATCH_SIZE);
    const answer = await client.franchises(batch);
    for (const id of batch) result.requested.add(id);
    for (const id of answer.missing) result.requested.add(id);
    for (const item of answer.items) {
      result.items.set(item.id, item);
      result.requested.add(item.id);
    }
    for (const item of answer.related) result.related.set(item.id, item);
    frontier = [...new Set([...frontier.slice(BATCH_SIZE), ...answer.pending])].filter(
      (id) => !result.requested.has(id),
    );
  }
  result.pending = frontier;
  return result;
}

/**
 * The franchises of many entries at once, for the total counter (RDI-32): the anime of every
 * crawled id, their neighbours, the ids it asked about (held or not) and the ids left for a
 * later call.
 */
export async function crawlFranchises(
  client: CatalogClient,
  seedIds: readonly number[],
): Promise<{
  items: CatalogAnime[];
  related: CatalogAnime[];
  requested: number[];
  pending: number[];
}> {
  const { items, related, requested, pending } = await crawl(client, seedIds, MAX_REQUESTS);
  return {
    items: [...items.values()],
    related: [...related.values()],
    requested: [...requested],
    pending,
  };
}

// The curator table (RF-60) is applied before automatic grouping.
export async function fetchFranchise(
  client: CatalogClient,
  seedIds: readonly number[],
  overrides: readonly FranchiseOverride[] = [],
): Promise<FullFranchise> {
  const { items, related, pending } = await crawl(client, seedIds, MAX_REQUESTS);

  // RDI-31 marks the whole core: never save part of one.
  if (pending.length > 0) throw new Error('Franchise incomplete: the sequel chain is too long');

  const { entries, known } = catalogEntries([...items.values()], [...related.values()]);
  const seed = seedIds[0];
  const franchises = groupFranchises(entries, overrides);
  const franchise = franchises.find((candidate) =>
    candidate.core.some((member) => member.id === seed),
  );
  const toEntry = (animeId: number): FranchiseEntry => ({ animeId });
  return {
    core: franchise?.core.map((member) => toEntry(member.id)) ?? [],
    extras: franchise?.extras.map(toEntry) ?? [],
    detail: franchise ? describe(franchise, franchises, known) : null,
  };
}

function describe(
  franchise: Franchise,
  franchises: readonly Franchise[],
  known: ReadonlyMap<number, CatalogAnime>,
): FranchiseDetail {
  const coverOf = (id: number) => known.get(id)?.coverUrl ?? null;
  const toDetail = (animeId: number): FranchiseEntryDetail => {
    const media = known.get(animeId);
    return {
      animeId,
      title: media ? displayTitle(media) : '',
      format: media?.format ?? null,
      year: media?.year ?? null,
      episodes: media?.episodes ?? null,
      coverUrl: coverOf(animeId),
    };
  };
  const titleOf = new Map(franchises.map((other) => [other.rootId, other.title]));
  return {
    franchise,
    title: franchise.title,
    coverUrl: coverOf(franchise.rootId),
    genres: known.get(franchise.rootId)?.genres ?? [],
    core: franchise.core.map((member) => toDetail(member.id)),
    extras: franchise.extras.map(toDetail),
    related: franchise.related.map((rootId) => ({
      rootId,
      title: titleOf.get(rootId) ?? '',
      coverUrl: coverOf(rootId),
    })),
  };
}
