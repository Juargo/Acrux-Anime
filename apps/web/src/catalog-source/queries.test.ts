import { describe, expect, it } from 'vitest';
import { fetchAnimeByIds } from './queries';
import { anime, fakeCatalogClient } from './test-support';

const answer = (ids: readonly number[]) => ids.filter((id) => id < 1000).map((id) => anime(id));

describe('fetchAnimeByIds', () => {
  it('asks for 100 distinct ids per request, in as many requests as needed', async () => {
    const ids = Array.from({ length: 250 }, (_, index) => index + 1);
    const client = fakeCatalogClient({ byIds: async (batch) => answer(batch) });

    const found = await fetchAnimeByIds(client, ids);

    expect(client.byIds.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 50]);
    expect(found).toHaveLength(250);
  });

  it('answers in the order given, repeats included, and leaves out ids the catalog lacks', async () => {
    const client = fakeCatalogClient({ byIds: async (batch) => answer([...batch].reverse()) });

    const found = await fetchAnimeByIds(client, [3, 1, 3, 2000, 2]);

    expect(found.map((item) => item.id)).toEqual([3, 1, 3, 2]);
    expect(client.byIds).toHaveBeenCalledTimes(1);
    expect(client.byIds).toHaveBeenCalledWith([3, 1, 2000, 2]);
  });

  it('makes no request without ids', async () => {
    const client = fakeCatalogClient();

    expect(await fetchAnimeByIds(client, [])).toEqual([]);
    expect(client.byIds).not.toHaveBeenCalled();
  });
});
