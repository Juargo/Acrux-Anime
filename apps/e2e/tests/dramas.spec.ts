import { DRAMAS } from '../support/dramas.ts';
import { expect, test } from '../support/fixtures.ts';

// Journeys of issue #151: the drama section, apart from the anime catalog.
const [CRASH, , UNTOLD] = DRAMAS;

test('Explorar switches from the anime catalog to the dramas and back, each with its own credit', async ({
  page,
  signedIn: _user,
}) => {
  await page.goto('/');
  const switcher = page.getByRole('group', { name: 'Qué explorar' });
  await expect(page.getByRole('list', { name: 'Catálogo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'MyAnimeList' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'TVmaze' })).toHaveCount(0);

  await switcher.getByRole('link', { name: 'Dramas' }).click();
  await expect(page).toHaveURL(/\/dramas$/);
  const grid = page.getByRole('list', { name: 'Dramas' });
  await expect(grid.getByRole('listitem')).toHaveCount(DRAMAS.length);
  await expect(page.getByRole('list', { name: 'Catálogo' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'TVmaze' })).toHaveAttribute(
    'href',
    'https://www.tvmaze.com',
  );
  await expect(page.getByRole('link', { name: 'MyAnimeList' })).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Explorar' }),
  ).toHaveAttribute('aria-current', 'page');

  await switcher.getByRole('link', { name: 'Anime' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('list', { name: 'Catálogo' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Dramas' })).toHaveCount(0);
});

test('a drama card shows its facts, and nothing false when the detail is not read yet', async ({
  page,
  signedIn: _user,
}) => {
  await page.goto('/dramas');
  const grid = page.getByRole('list', { name: 'Dramas' });

  const crash = grid.getByRole('listitem').filter({ hasText: CRASH?.title ?? '' });
  await expect(crash).toContainText('Corea · 2019 · 1 temporada · 16 episodios');

  const untold = grid.getByRole('listitem').filter({ hasText: UNTOLD?.title ?? '' });
  await expect(untold).toContainText('China · 2023');
  await expect(untold).not.toContainText(/temporada|episodio/);
});

test('the dramas filter by country and search says titles are international', async ({
  page,
  signedIn: _user,
}) => {
  await page.goto('/dramas');
  const grid = page.getByRole('list', { name: 'Dramas' });

  await page.getByRole('button', { name: 'País' }).click();
  const sheet = page.getByRole('dialog', { name: 'Filtrar' });
  await sheet.getByRole('button', { name: 'Japón' }).click();
  await sheet.getByRole('button', { name: 'Ver resultados' }).click();
  await expect(grid.getByRole('listitem')).toHaveCount(1);
  await expect(grid).toContainText('Alice in Borderland');

  await page.getByRole('button', { name: 'País · 1' }).click();
  await page
    .getByRole('dialog', { name: 'Filtrar' })
    .getByRole('button', { name: 'Todos' })
    .click();
  await page.getByRole('button', { name: 'Ver resultados' }).click();
  await expect(grid.getByRole('listitem')).toHaveCount(DRAMAS.length);

  await page.getByRole('searchbox', { name: 'Buscar dramas' }).fill('El indomable');
  await expect(page.getByText('No encontramos dramas para «El indomable».')).toBeVisible();
  await expect(page.getByText(/versión internacional/)).toBeVisible();
});

test('the drama screen never asks for the anime catalog', async ({ page, signedIn: _user }) => {
  const catalogCalls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/catalog/')) {
      catalogCalls.push(request.url());
    }
  });

  await page.goto('/dramas');
  await expect(page.getByRole('list', { name: 'Dramas' })).toBeVisible();

  expect(catalogCalls).toEqual([]);
});
