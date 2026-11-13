import { markSeen, profileOf } from '../support/api.ts';
import { FRIEREN } from '../support/catalog.ts';
import { expect, test, visitorContext } from '../support/fixtures.ts';

// Journey of issue #47: a private profile, then made public (RF-41, RF-42).
test('@CA-RF42-01 @CA-RF41-02 a visitor sees only the summary of a private list, and the list once it is public', async ({
  page,
  browser,
  request,
  signedIn: user,
}) => {
  const { handle, listVisibility } = await profileOf(request, user);
  expect(listVisibility).toBe('private');
  await markSeen(request, user, [FRIEREN.rootId, 182255]);

  // The owner opens the app once, so the link shows the counter they see.
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Contador total' })).toContainText('1 anime');

  const visitor = await visitorContext(browser);
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/@${handle}`);
  await expect(visitorPage.getByRole('heading', { level: 1, name: user.name })).toBeVisible();
  await expect(visitorPage.getByText(`@${handle}`)).toBeVisible();
  await expect(visitorPage.getByText('ANIMES COMPLETOS')).toBeVisible();
  await expect(visitorPage.getByText(`${user.name} mantiene su lista privada`)).toBeVisible();
  await expect(visitorPage.getByText('SAGAS MÁS RECIENTES')).toHaveCount(0);
  await expect(visitorPage.getByText(FRIEREN.title)).toHaveCount(0);

  // The owner makes the list public from Perfil.
  await page.goto('/perfil');
  await page.getByRole('link', { name: /Tu lista/ }).click();
  await page.getByRole('radio', { name: /Pública/ }).check();
  await expect(page.getByRole('status')).toHaveText('Listo, guardado.');

  await visitorPage.reload();
  await expect(visitorPage.getByText('SAGAS MÁS RECIENTES')).toBeVisible();
  await expect(visitorPage.getByText(FRIEREN.title)).toBeVisible();
  await expect(visitorPage.getByText(`${user.name} mantiene su lista privada`)).toHaveCount(0);
  await visitor.close();
});
