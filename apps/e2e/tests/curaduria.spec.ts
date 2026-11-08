import { SPY_FAMILY } from '../support/anilist.ts';
import { markSeen } from '../support/api.ts';
import { API_URL, CURATOR_USER_ID } from '../support/env.ts';
import { expect, test } from '../support/fixtures.ts';
import { createUser, installNeonAuth } from '../support/neon-auth.ts';

// Journeys of issue #42: the curator table (RF-60) against the real API and Postgres.
test('@CA-RF60-03 a user without the curator role cannot edit the table, which anyone can read', async ({
  request,
  signedIn: user,
}) => {
  const edit = await request.put(`${API_URL}/api/v1/franchise-overrides/${SPY_FAMILY.part2Id}`, {
    headers: { Authorization: `Bearer ${user.token}` },
    data: { franchiseRootId: SPY_FAMILY.rootId, role: 'separate' },
  });
  expect(edit.status()).toBe(403);
  expect((await edit.json()).code).toBe('auth.forbidden');

  const table = await request.get(`${API_URL}/api/v1/franchise-overrides`);
  expect(table.ok()).toBe(true);
});

test('@CA-RF60-01 the curator splits a saga from /curador and the counter follows the table', async ({
  page,
  context,
  request,
}) => {
  const curator = await createUser('Curadora', { id: CURATOR_USER_ID });
  await installNeonAuth(context, curator);
  await markSeen(request, curator, [SPY_FAMILY.rootId]);

  await page.goto('/perfil');
  await page.getByRole('link', { name: /Curaduría/ }).click();
  await page.getByLabel('ID de AniList de la entrada').fill(String(SPY_FAMILY.part2Id));
  await page.getByLabel('ID de AniList de la franquicia').fill(String(SPY_FAMILY.rootId));
  await page.getByRole('radio', { name: /^Separada/ }).check();
  await page.getByRole('button', { name: 'Guardar corrección' }).click();
  await expect(page.getByText('Corrección guardada.')).toBeVisible();
  const list = page.getByRole('list', { name: 'Correcciones' });
  await expect(list.getByText('SPY x FAMILY Cour 2')).toBeVisible();

  const table = await (await request.get(`${API_URL}/api/v1/franchise-overrides`)).json();
  expect(table.items).toContainEqual(
    expect.objectContaining({
      anilistId: SPY_FAMILY.part2Id,
      franchiseRootId: SPY_FAMILY.rootId,
      role: 'separate',
    }),
  );

  // Part 1 alone is now a whole franchise, so the one seen entry completes it.
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Contador total' })).toContainText('1 anime');
});
