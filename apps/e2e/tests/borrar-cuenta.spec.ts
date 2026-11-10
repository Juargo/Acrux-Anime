import { makeListPublic, markSeen, profileOf } from '../support/api.ts';
import { FRIEREN } from '../support/catalog.ts';
import { API_URL } from '../support/env.ts';
import { expect, test, visitorContext } from '../support/fixtures.ts';
import { authUserDeleted, createUser } from '../support/neon-auth.ts';

// Journey of issue #47: account deletion (RF-06).
test('@CA-RF06-01 delete the account from Perfil, back to sign-in, the public link is gone', async ({
  page,
  browser,
  request,
  signedIn: user,
}) => {
  // Signed in less than 24 hours ago, with marks and a public list; and someone else.
  const { handle } = await profileOf(request, user);
  await markSeen(request, user, [FRIEREN.rootId]);
  await makeListPublic(request, user);
  const other = await createUser('Otra persona');
  const { handle: otherHandle } = await profileOf(request, other);

  await page.goto('/perfil');
  await page.getByRole('link', { name: 'Borrar cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Borrar tu cuenta' })).toBeVisible();
  const submit = page.getByRole('button', { name: 'Borrar mi cuenta para siempre' });
  await expect(submit).toBeDisabled();
  await page.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR');
  await submit.click();

  // Back to the sign-in screen, signed out.
  await expect(page.getByRole('status')).toHaveText('Borramos tu cuenta y tus datos.');
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();

  // The profile, the marks and the Neon Auth user are gone; nobody else's data changed.
  expect((await request.get(`${API_URL}/api/v1/profiles/${handle}`)).status()).toBe(404);
  expect((await request.get(`${API_URL}/api/v1/profiles/${handle}/marks`)).status()).toBe(404);
  expect(await authUserDeleted(user.id)).toBe(true);
  expect((await request.get(`${API_URL}/api/v1/profiles/${otherHandle}`)).status()).toBe(200);

  // The public link no longer shows the profile.
  const visitor = await visitorContext(browser);
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/@${handle}`);
  await expect(visitorPage.getByRole('heading', { name: 'Perfil no disponible' })).toBeVisible();
  await visitor.close();
});
