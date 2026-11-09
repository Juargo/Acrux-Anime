import { describe, expect, it, vi } from 'vitest';
import { AniListError, createAniListClient } from './client';
import { anilistErrorMessage } from './messages';
import * as queries from './queries';
import { fetchMediaByIds, fetchMediaStats } from './queries';

function media(id: number) {
  return {
    id,
    idMal: id + 1000,
    title: { romaji: `Title ${id}`, english: null, native: null },
    coverImage: {
      large: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/${id}.jpg`,
    },
    format: 'TV',
    seasonYear: 2020,
  };
}

describe('queries', () => {
  it('excludes adult content in every query', () => {
    const documents = Object.values(queries).filter((value) => typeof value === 'string');
    expect(documents.length).toBeGreaterThan(0);
    for (const document of documents) expect(document).toContain('isAdult: false');
  });

  it('asks for many ids in batches of 50 and keeps the requested order', async () => {
    const bodies: { variables: { ids: number[] } }[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { variables: { ids: number[] } };
      bodies.push(body);
      return Response.json({
        data: { Page: { media: [...body.variables.ids].reverse().map(media) } },
      });
    });
    const client = createAniListClient({ fetch });
    const ids = Array.from({ length: 51 }, (_, index) => index + 1);
    const result = await fetchMediaByIds(client, ids);
    expect(bodies.map((body) => body.variables.ids.length)).toEqual([50, 1]);
    expect(result.map((item) => item.id)).toEqual(ids);
    expect(result[0]).toMatchObject({ idMal: 1001, title: { romaji: 'Title 1' } });
  });

  it('makes no request for an empty list', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    expect(await fetchMediaByIds(createAniListClient({ fetch }), [])).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks for a repeated id once and returns it wherever it was requested', async () => {
    const bodies: { variables: { ids: number[] } }[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { variables: { ids: number[] } };
      bodies.push(body);
      return Response.json({ data: { Page: { media: body.variables.ids.map(media) } } });
    });
    const result = await fetchMediaByIds(createAniListClient({ fetch }), [7, 7, 8, 7]);
    expect(bodies.map((body) => body.variables.ids)).toEqual([[7, 8]]);
    expect(result.map((item) => item.id)).toEqual([7, 7, 8, 7]);
  });

  it('rejects a cover that is not an https URL', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({
        data: { Page: { media: [{ ...media(1), coverImage: { large: 'javascript:alert(1)' } }] } },
      }),
    );
    const error = await fetchMediaByIds(createAniListClient({ fetch }), [1]).catch(
      (caught: unknown) => caught,
    );
    expect((error as AniListError).kind).toBe('invalid-response');
  });
});

describe('anilistErrorMessage', () => {
  it('explains a rate limit and reassures that marks are kept', () => {
    const message = anilistErrorMessage(new AniListError('rate-limited', 'limited'));
    expect(message).toContain('AniList');
    expect(message).toContain('lo que marcaste sigue guardado');
  });

  it('has a message for every other failure', () => {
    for (const kind of ['unavailable', 'invalid-response', 'query'] as const) {
      expect(anilistErrorMessage(new AniListError(kind, kind))).toContain(
        'lo que marcaste sigue guardado',
      );
    }
    expect(anilistErrorMessage(new Error('other'))).toContain('lo que marcaste sigue guardado');
  });
});

describe('fetchMediaStats (RF-53)', () => {
  it('asks for length, genres, year and format of every id in batches of 50', async () => {
    const bodies: { query: string; variables: { ids: number[] } }[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: { ids: number[] };
      };
      bodies.push(body);
      return Response.json({
        data: {
          Page: {
            media: body.variables.ids.map((id) => ({
              id,
              format: 'TV',
              seasonYear: 2020,
              episodes: id === 1 ? null : 12,
              duration: 24,
              genres: ['Action'],
            })),
          },
        },
      });
    });
    const ids = Array.from({ length: 51 }, (_, index) => index + 1);

    const result = await fetchMediaStats(createAniListClient({ fetch }), ids);

    expect(bodies.map((body) => body.variables.ids.length)).toEqual([50, 1]);
    expect(bodies[0]?.query).toContain('MediaStats');
    expect(result).toHaveLength(51);
    expect(result[0]).toEqual({
      id: 1,
      format: 'TV',
      seasonYear: 2020,
      episodes: null,
      duration: 24,
      genres: ['Action'],
    });
  });
});
