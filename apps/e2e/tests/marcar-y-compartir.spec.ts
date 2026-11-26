import { FRIEREN } from '../support/catalog.ts';
import { expect, test } from '../support/fixtures.ts';

// Journey of issue #47: search → mark → counter → share.
test('@CA-RF12-01 @CA-RF24-01 @CA-RF30-02 @CA-RF31-02 search a franchise, mark it, see the counter and download the card', async ({
  page,
  signedIn: _user,
}) => {
  // A first visit lands on the map of worlds.
  await page.goto('/');
  await page.getByRole('link', { name: 'Entrar a Anime' }).click();
  const counter = page.getByRole('region', { name: 'Contador total' });
  await expect(counter).toContainText('0 animes');

  // Two seasons in the catalog, one item in the catalog.
  await page.getByRole('button', { name: 'Buscar en Anime' }).click();
  await page.getByRole('searchbox', { name: 'Buscar anime' }).fill(FRIEREN.search);
  const grid = page.getByRole('list', { name: 'Catálogo' });
  await expect(grid.getByRole('listitem')).toHaveCount(1);
  await expect(grid.getByRole('link', { name: FRIEREN.title })).toBeVisible();

  await grid.getByRole('button', { name: `Marcar «${FRIEREN.title}» como vista` }).click();
  await expect(counter).toContainText('1 anime');
  await expect(
    grid.getByRole('button', { name: `Quitar «${FRIEREN.title}» de vistas` }),
  ).toHaveAttribute('aria-pressed', 'true');

  // "Tarjeta" opens on the card, the first time too.
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Tarjeta' })
    .click();
  await expect(page.getByRole('heading', { name: 'Tu tarjeta' })).toBeVisible();
  await expect(page.getByRole('figure', { name: 'Vista previa de tu tarjeta' })).toContainText('1');

  // No Web Share in this browser: "Descargar imagen" saves the PNG (RF-31).
  const downloadButton = page.getByRole('button', { name: 'Descargar imagen' });
  await expect(downloadButton).toBeEnabled({ timeout: 15_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
  expect(download.suggestedFilename()).toBe('acrux-tarjeta.png');

  // A private list on the first card: the app offers to make it public (RF-30).
  await expect(page.getByRole('heading', { name: '¿Hacemos pública tu lista?' })).toBeVisible();
});

test('a search on the map looks in every world and leads into the world that has it', async ({
  page,
  signedIn: _user,
}) => {
  await page.goto('/mundos');
  const field = page.getByRole('searchbox', { name: 'Buscar en todos los mundos' });
  await field.fill(FRIEREN.search);
  await field.press('Enter');
  await expect(page).toHaveURL(/\/mundos\/buscar\?q=/);
  await expect(page.getByRole('heading', { level: 1, name: 'Búsqueda' })).toBeVisible();

  const anime = page.getByRole('region', { name: 'En Anime' });
  await expect(anime.getByRole('link', { name: FRIEREN.title })).toBeVisible();
  await expect(page.getByRole('region', { name: 'En Dramas' })).toContainText(
    /No encontramos dramas para/,
  );

  await anime.getByRole('link', { name: 'Ir al mundo Anime' }).click();
  await expect(page).toHaveURL(/\/anime\?q=/);
  await expect(page.getByRole('searchbox', { name: 'Buscar anime' })).toHaveValue(FRIEREN.search);
  await expect(page.getByRole('list', { name: 'Catálogo' }).getByRole('listitem')).toHaveCount(1);
});
