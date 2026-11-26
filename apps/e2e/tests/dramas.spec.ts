import { DRAMAS } from '../support/dramas.ts';
import { expect, test } from '../support/fixtures.ts';

// Journeys of issue #151: the drama section, apart from the anime catalog.
const [CRASH, , UNTOLD] = DRAMAS;

test('Explorar opens on the map, enters each world with its own credit, and reopens the last one', async ({
  page,
  signedIn: _user,
}) => {
  // No world visited yet on this device: the map.
  await page.goto('/');
  await expect(page).toHaveURL(/\/mundos$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Elige un mundo' })).toBeVisible();
  const explore = page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Explorar' });
  await expect(explore).toHaveAttribute('aria-current', 'page');

  await page.getByRole('link', { name: 'Entrar a Anime' }).click();
  await expect(page).toHaveURL(/\/anime$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Anime' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Catálogo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'MyAnimeList' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'TVmaze' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Volver a los mundos' }).click();
  await expect(page).toHaveURL(/\/mundos$/);
  await page.getByRole('link', { name: 'Entrar a Dramas' }).click();
  await expect(page).toHaveURL(/\/dramas$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dramas' })).toBeVisible();
  const grid = page.getByRole('list', { name: 'Dramas' });
  await expect(grid.getByRole('listitem')).toHaveCount(DRAMAS.length);
  await expect(page.getByRole('list', { name: 'Catálogo' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'TVmaze' })).toHaveAttribute(
    'href',
    'https://www.tvmaze.com',
  );
  await expect(page.getByRole('link', { name: 'MyAnimeList' })).toHaveCount(0);
  await expect(explore).toHaveAttribute('aria-current', 'page');

  // Explorar reopens the last world, from another section and after a reload.
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Mi lista' })
    .click();
  await explore.click();
  await expect(page).toHaveURL(/\/dramas$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/dramas$/);
  await expect(grid.getByRole('listitem')).toHaveCount(DRAMAS.length);
});

test('a country door of the map opens the Dramas world on that country', async ({
  page,
  signedIn: _user,
}) => {
  await page.goto('/mundos');
  await page.getByRole('link', { name: 'Corea' }).click();
  await expect(page).toHaveURL(/\/dramas\?origin=KR$/);
  const grid = page.getByRole('list', { name: 'Dramas' });
  await expect(grid.getByRole('listitem')).toHaveCount(1);
  await expect(grid.getByRole('listitem')).toContainText(CRASH?.title ?? '');
  await expect(page.getByRole('button', { name: 'Corea' })).toHaveAttribute('aria-pressed', 'true');
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

  // The countries are in view: one tap takes a country, a second one lets it go.
  const japan = page.getByRole('button', { name: 'Japón' });
  await japan.click();
  await expect(grid.getByRole('listitem')).toHaveCount(1);
  await expect(grid).toContainText('Alice in Borderland');

  await japan.click();
  await expect(grid.getByRole('listitem')).toHaveCount(DRAMAS.length);

  await page.getByRole('button', { name: 'Buscar en Dramas' }).click();
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

// Journey of issue #154: marking a drama, with its own counter.
test('a drama marked as seen stays marked after coming back, with its own counter', async ({
  page,
  signedIn: _user,
}) => {
  const title = CRASH?.title ?? '';
  await page.goto('/dramas');
  const counter = page.getByRole('region', { name: 'Contador de dramas' });
  const card = page
    .getByRole('list', { name: 'Dramas' })
    .getByRole('listitem')
    .filter({ hasText: title });
  await expect(counter).toContainText('0 dramas');
  await expect(page.getByRole('region', { name: 'Contador total' })).toHaveCount(0);

  await card.getByRole('button', { name: `Marcar «${title}» como visto` }).click();
  await expect(counter).toContainText('1 drama');

  // «Un drama marcado sigue marcado al volver a entrar».
  await page.reload();
  await expect(card.getByRole('button', { name: `Quitar «${title}» de vistos` })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(counter).toContainText('1 drama');

  // Two separate numbers: the anime counter does not move.
  await page.getByRole('link', { name: 'Volver a los mundos' }).click();
  await page.getByRole('link', { name: 'Entrar a Anime' }).click();
  await expect(page.getByRole('region', { name: 'Contador total' })).toContainText('0 animes');
  await expect(page.getByRole('region', { name: 'Contador de dramas' })).toHaveCount(0);

  await page.goto('/dramas');
  await card.getByRole('button', { name: `Quitar «${title}» de vistos` }).click();
  await expect(counter).toContainText('0 dramas');
  await page.reload();
  await expect(card.getByRole('button', { name: `Marcar «${title}» como visto` })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

// Journey of issue #166: the marked dramas together, in their own tab of "Mi lista".
test('the marked dramas show together in Mi lista, where they can be unmarked', async ({
  page,
  signedIn: _user,
}) => {
  const title = CRASH?.title ?? '';
  await page.goto('/dramas');
  await page
    .getByRole('list', { name: 'Dramas' })
    .getByRole('listitem')
    .filter({ hasText: title })
    .getByRole('button', { name: `Marcar «${title}» como viendo` })
    .click();
  await expect(page.getByRole('button', { name: `Quitar «${title}» de viendo` })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.goto('/mi-lista');
  const myList = page.getByRole('region', { name: 'Mi lista' });
  await myList.getByRole('tab', { name: 'Dramas (1)' }).click();
  const rows = myList.getByRole('list', { name: 'Tus dramas marcados' });
  await expect(rows.getByRole('listitem')).toHaveCount(1);
  await expect(rows).toContainText(title);
  await expect(myList.getByRole('link', { name: 'TVmaze' })).toBeVisible();
  // The anime figures do not count dramas.
  await expect(myList.getByRole('tab', { name: 'Viendo (0)' })).toBeVisible();

  await rows.getByRole('button', { name: `Quitar «${title}» de viendo` }).click();
  await expect(myList.getByText('Aún no marcaste ningún drama')).toBeVisible();
  await expect(myList.getByRole('tab', { name: 'Dramas (0)' })).toBeVisible();

  await page.reload();
  await myList.getByRole('tab', { name: 'Dramas (0)' }).click();
  await expect(myList.getByText('Aún no marcaste ningún drama')).toBeVisible();
});

test('a genre crosses the worlds from the map and leads into a world on that genre', async ({
  page,
  signedIn: _user,
}) => {
  await page.goto('/mundos');
  await page
    .getByRole('navigation', { name: 'Cruza los mundos por género' })
    .getByRole('link', { name: 'Romance' })
    .click();
  await expect(page).toHaveURL(/\/mundos\/genero\/romance$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Romance' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'En Anime' })).toBeVisible();

  const dramas = page.getByRole('region', { name: 'En Dramas' });
  await expect(dramas.getByRole('listitem')).toHaveCount(1);
  await expect(dramas).toContainText(CRASH?.title ?? '');

  await dramas.getByRole('link', { name: 'Ir al mundo Dramas' }).click();
  await expect(page).toHaveURL(/\/dramas\?genre=Romance$/);
  await expect(page.getByRole('button', { name: 'Romance' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('list', { name: 'Dramas' }).getByRole('listitem')).toHaveCount(1);
});
