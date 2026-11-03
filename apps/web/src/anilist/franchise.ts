import { groupFranchises } from '@acrux/domain';
import { z } from 'zod';
import { catalogEntries } from '../catalog/items';
import { type CatalogMedia, catalogMediaSchema, MEDIA_FIELDS } from './catalog';
import type { AniListClient } from './client';

// The catalog only knows one hop of relations. Marking a franchise (RDI-31) needs its whole
// core, so this follows sequels and prequels from the known ids, one id_in batch per hop.
export const FRANCHISE_MEDIA = `
  query FranchiseMedia($ids: [Int], $perPage: Int) {
    Page(perPage: $perPage) {
      media(id_in: $ids, type: ANIME, isAdult: false) {
        ${MEDIA_FIELDS}
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

const pageSchema = z.object({ Page: z.object({ media: z.array(catalogMediaSchema) }) });

export interface FranchiseEntry {
  anilistId: number;
  malId: number | null;
}

export interface FullFranchise {
  core: FranchiseEntry[];
  extras: FranchiseEntry[];
}

export async function fetchFranchise(
  client: AniListClient,
  seedIds: readonly number[],
): Promise<FullFranchise> {
  const fetched = new Map<number, CatalogMedia>();
  let frontier = [...new Set(seedIds)];
  for (let requests = 0; frontier.length > 0 && requests < MAX_REQUESTS; requests += 1) {
    const batch = frontier.slice(0, BATCH_SIZE);
    const data = await client.request(
      FRANCHISE_MEDIA,
      { ids: batch, perPage: BATCH_SIZE },
      pageSchema,
    );
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

  // RDI-31 marks the whole core: never save part of one.
  if (frontier.length > 0) throw new Error('Franchise incomplete: the sequel chain is too long');

  const { entries, known } = catalogEntries([...fetched.values()]);
  const seed = seedIds[0];
  const franchise = groupFranchises(entries, []).find((candidate) =>
    candidate.core.some((member) => member.id === seed),
  );
  const toEntry = (anilistId: number): FranchiseEntry => ({
    anilistId,
    malId: known.get(anilistId)?.idMal ?? null,
  });
  return {
    core: franchise?.core.map((member) => toEntry(member.id)) ?? [],
    extras: franchise?.extras.map(toEntry) ?? [],
  };
}
