// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DramaMarkDto } from '../drama-marks-api';
import type { Drama } from '../drama-source/client';
import { drama, fakeDramaClient } from '../drama-source/test-support';
import { DramaList } from './DramaList';

afterEach(cleanup);

const mark = (dramaId: number, status: DramaMarkDto['status'], day = 10): DramaMarkDto => ({
  dramaId,
  status,
  markedAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const CATALOG: Drama[] = [
  drama(1, { title: 'Crash Landing on You', year: 2019 }),
  drama(2, { title: 'Alice in Borderland', origin: 'JP', year: 2020 }),
  drama(3, { title: 'The Untold Palace', origin: 'CN', year: 2023, coverUrl: null }),
];

function renderDramas(initial: DramaMarkDto[] | 'fail', options: { saveFails?: boolean } = {}) {
  let stored = initial === 'fail' ? [] : [...initial];
  let failing = initial === 'fail';
  const writes: string[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url.startsWith('/api/v1/me/drama-marks?')) {
      return failing
        ? json({ status: 503, code: 'drama_marks.unavailable' }, 503)
        : json({ items: stored, nextCursor: null });
    }
    const dramaId = Number(url.split('/').at(-1));
    writes.push(`${method} ${url}`);
    if (options.saveFails) return json({ status: 500, code: 'internal' }, 500);
    stored = stored.filter((current) => current.dramaId !== dramaId);
    if (method === 'DELETE') return new Response(null, { status: 204 });
    const written = mark(dramaId, JSON.parse(init?.body as string).status, 20);
    stored.push(written);
    return json(written);
  });
  const client = fakeDramaClient({
    byIds: async (ids) => CATALOG.filter((item) => ids.includes(item.id)),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DramaList
          getToken={async () => 'jwt'}
          fetchFn={fetchFn as unknown as typeof fetch}
          client={client}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return {
    client,
    writes,
    recover: () => {
      failing = false;
    },
  };
}

const rows = () => screen.findByRole('list', { name: 'Tus dramas marcados' });
const titles = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.list-row__title')?.textContent);

describe('DramaList', () => {
  it('lists every marked drama, watching first and then seen, newest mark first', async () => {
    const { client } = renderDramas([
      mark(1, 'seen', 5),
      mark(2, 'seen', 9),
      mark(3, 'watching', 2),
    ]);

    const list = await rows();
    expect(titles(list)).toEqual([
      'The Untold Palace',
      'Alice in Borderland',
      'Crash Landing on You',
    ]);
    expect(within(list).getByText('Japón · 2020 · marcado el 9 de oct.')).toBeTruthy();
    const covers = [...list.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(covers).toEqual([
      'https://static.tvmaze.test/2.jpg',
      'https://static.tvmaze.test/1.jpg',
    ]);
    expect(client.byIds).toHaveBeenCalledTimes(1);
    expect([...(client.byIds.mock.calls[0]?.[0] ?? [])].sort()).toEqual([1, 2, 3]);
  });

  it('shows the state of each drama on its two buttons', async () => {
    renderDramas([mark(1, 'seen'), mark(3, 'watching')]);

    const list = await rows();
    const pressed = (name: string) =>
      within(list).getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed('Quitar «Crash Landing on You» de vistos')).toBe('true');
    expect(pressed('Marcar «Crash Landing on You» como viendo')).toBe('false');
    expect(pressed('Quitar «The Untold Palace» de viendo')).toBe('true');
    expect(pressed('Marcar «The Untold Palace» como visto')).toBe('false');
  });

  it('takes an unmarked drama out of the list', async () => {
    const user = userEvent.setup();
    const { writes } = renderDramas([mark(1, 'seen', 5), mark(2, 'seen', 9)]);

    const list = await rows();
    await user.click(
      within(list).getByRole('button', { name: 'Quitar «Alice in Borderland» de vistos' }),
    );

    await waitFor(() => expect(titles(list)).toEqual(['Crash Landing on You']));
    await waitFor(() => expect(writes).toEqual(['DELETE /api/v1/me/drama-marks/2']));
  });

  it('changes the state of a drama and keeps it in the list', async () => {
    const user = userEvent.setup();
    const { writes } = renderDramas([mark(1, 'seen', 5), mark(2, 'seen', 9)]);

    const list = await rows();
    await user.click(
      within(list).getByRole('button', { name: 'Marcar «Crash Landing on You» como viendo' }),
    );

    await waitFor(() =>
      expect(titles(list)).toEqual(['Crash Landing on You', 'Alice in Borderland']),
    );
    expect(
      within(list)
        .getByRole('button', { name: 'Quitar «Crash Landing on You» de viendo' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    await waitFor(() => expect(writes).toEqual(['PUT /api/v1/me/drama-marks/1']));
  });

  it('puts the drama back and says so when the change cannot be saved', async () => {
    const user = userEvent.setup();
    renderDramas([mark(1, 'seen', 5)], { saveFails: true });

    const list = await rows();
    await user.click(
      within(list).getByRole('button', { name: 'Quitar «Crash Landing on You» de vistos' }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos guardar');
    expect(titles(await rows())).toEqual(['Crash Landing on You']);
  });

  it('leaves out a marked drama the catalog does not serve', async () => {
    renderDramas([mark(1, 'seen'), mark(99, 'seen')]);

    expect(titles(await rows())).toEqual(['Crash Landing on You']);
  });

  it('shows an empty state with a way to the dramas, and asks for no drama', async () => {
    const { client } = renderDramas([]);

    expect(await screen.findByText('Aún no marcaste ningún drama')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Explorar dramas' }).getAttribute('href')).toBe(
      '/dramas',
    );
    expect(screen.queryByRole('list', { name: 'Tus dramas marcados' })).toBeNull();
    expect(client.byIds).not.toHaveBeenCalled();
  });

  it('says so when the drama marks cannot load, and loads them on retry', async () => {
    const user = userEvent.setup();
    const { recover } = renderDramas('fail');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No pudimos cargar tus dramas');
    recover();
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Aún no marcaste ningún drama')).toBeTruthy();
  });

  it('credits TVmaze with a link (ADR-0046)', async () => {
    renderDramas([mark(1, 'seen')]);

    expect((await screen.findByRole('link', { name: 'TVmaze' })).getAttribute('href')).toBe(
      'https://www.tvmaze.com',
    );
  });
});
