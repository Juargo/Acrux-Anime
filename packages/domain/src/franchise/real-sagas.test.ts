import { describe, expect, it } from 'vitest';
import fullmetalAlchemist from './__fixtures__/fullmetal-alchemist.json';
import kimetsuNoYaiba from './__fixtures__/kimetsu-no-yaiba.json';
import shingekiNoKyojin from './__fixtures__/shingeki-no-kyojin.json';
import { groupFranchises } from './grouping';
import { franchiseProgress } from './progress';
import type { CatalogEntry, Franchise, FranchiseOverride, Mark, RelationType } from './types';

// Fixed AniList answers (ADR-0029, rule 3), fetched on 2026-11-03 with relationType(version: 2):
// the core closure of each saga plus one hop of side stories, summaries, spin-offs and remakes.
interface AniListMedia {
  id: number;
  type: string;
  format: string | null;
  title: { romaji: string };
  startDate: { year: number | null; month: number | null; day: number | null };
  relations: { edges: { relationType: string; node: { id: number } }[] };
}

const pad = (value: number) => String(value).padStart(2, '0');

function toCatalog(fixture: { data: { Page: { media: AniListMedia[] } } }): CatalogEntry[] {
  return fixture.data.Page.media.map((media) => ({
    id: media.id,
    type: media.type === 'ANIME' ? 'ANIME' : 'MANGA',
    format: media.format,
    title: media.title.romaji,
    startDate:
      media.startDate.year === null
        ? null
        : `${media.startDate.year}-${pad(media.startDate.month ?? 1)}-${pad(media.startDate.day ?? 1)}`,
    relations: media.relations.edges.map((edge) => ({
      type: edge.relationType as RelationType,
      id: edge.node.id,
    })),
  }));
}

const byRoot = (franchises: Franchise[], rootId: number) =>
  franchises.find((franchise) => franchise.rootId === rootId) as Franchise;
const coreIds = (franchise: Franchise) => franchise.core.map((member) => member.id);
const correction = (anilistId: number, franchiseRootId: number): FranchiseOverride => ({
  anilistId,
  franchiseRootId,
  role: 'extra',
  updatedAt: '2026-11-01T00:00:00Z',
});

describe('real sagas (RNF-41)', () => {
  describe('Shingeki no Kyojin', () => {
    const catalog = toCatalog(shingekiNoKyojin);
    const seasons = [16498, 20958, 99147, 104578, 110277, 131681, 146984, 162314];

    it('groups the seasons in one core, with the OVAs, recaps and the spin-off around it', () => {
      const franchises = groupFranchises(catalog, []);
      const saga = byRoot(franchises, 16498);

      expect(saga.title).toBe('Shingeki no Kyojin');
      // AniList lists the Kuinaki Sentaku OVA (20811) as a prequel, so it joins the core.
      expect(coreIds(saga)).toEqual([16498, 20811, ...seasons.slice(1)]);
      expect(saga.extras).toEqual([18397, 99634, 119113]);
      // The recap movies chain among themselves and the school spin-off stands apart.
      expect(saga.related).toEqual([20691, 21281]);
      expect(coreIds(byRoot(franchises, 20691))).toEqual([20691, 20692, 100465]);
      expect(franchises.map((franchise) => franchise.rootId)).toEqual([16498, 20691, 21281]);
    });

    it('needs the curator table to leave only the eight seasons in the core', () => {
      const overrides = [20811, 20691, 20692, 100465].map((id) => correction(id, 16498));
      const franchises = groupFranchises(catalog, overrides);
      const saga = byRoot(franchises, 16498);

      expect(coreIds(saga)).toEqual(seasons);
      expect(saga.extras).toEqual([18397, 20691, 20692, 20811, 99634, 100465, 119113]);
      expect(saga.related).toEqual([21281]);
      expect(franchises).toHaveLength(2);
    });
  });

  describe('Fullmetal Alchemist', () => {
    it('keeps Brotherhood as a separate franchise linked as a remake', () => {
      const franchises = groupFranchises(toCatalog(fullmetalAlchemist), []);

      expect(coreIds(byRoot(franchises, 121))).toEqual([121, 430]);
      expect(byRoot(franchises, 121).extras).toEqual([664, 908]);
      expect(byRoot(franchises, 121).related).toEqual([5114]);
      expect(byRoot(franchises, 5114).title).toBe('Hagane no Renkinjutsushi: FULLMETAL ALCHEMIST');
      expect(byRoot(franchises, 5114).related).toEqual([121]);
    });
  });

  describe('Kimetsu no Yaiba', () => {
    const [saga] = groupFranchises(toCatalog(kimetsuNoYaiba), []) as [Franchise];

    it('chains the movies into the core and leaves the announced ones unreleased', () => {
      expect(coreIds(saga)).toEqual([
        101922, 112151, 129874, 142329, 145139, 166240, 178788, 195200, 195201,
      ]);
      expect(saga.core.slice(-2).map((member) => member.joinedAt)).toEqual([null, null]);
    });

    it('stays seen when Mugenjou-hen comes out after the user finished Hashira Geiko-hen', () => {
      const marks: Mark[] = coreIds(saga)
        .slice(0, 6)
        .map((anilistId) => ({ anilistId, status: 'seen', markedAt: '2024-07-01T00:00:00Z' }));

      expect(franchiseProgress(saga, marks, '2026-11-03T00:00:00Z')).toEqual({
        state: 'seen',
        seenCore: 6,
        releasedCore: 7,
        complete: true,
        hasNewEntries: true,
      });
    });
  });
});
