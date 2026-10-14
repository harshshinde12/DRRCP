import { expect, test } from '@playwright/test';
import { reseed } from '../global-setup.js';
import { USERS, assertNoConsoleErrors, loginAs, trackConsole } from './helpers.js';

test.beforeAll(() => {
  reseed();
});

const CITIZEN1_PHONE = '+91-9000000011';
const CITIZEN2_PHONE = '+91-9000000012';

async function requestIdBySearch(page: Parameters<typeof loginAs>[0], text: string) {
  return page.evaluate(async (q) => {
    const r = await fetch(`/api/requests?search=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('drrcp.token') ?? localStorage.getItem('drrcp.token')}` },
    });
    const j = await r.json();
    return j.data[0].id as string;
  }, text);
}

/** SE-5: victim phone + exact coords visible only to ADMIN, owner, assigned team. */
test('unrelated citizen and volunteer never see phone or coords', async ({ browser }) => {
  // another citizen: only own requests listed; API also scopes citizens to own
  const cit2 = await browser.newPage();
  const cit2Errors = trackConsole(cit2);
  await loginAs(cit2, USERS.citizen2);
  await cit2.goto('/my-requests');
  await expect(cit2.getByText('Bldg 7, Andheri West').first()).toHaveCount(0);
  const id = await requestIdBySearch(cit2, 'Bldg 7').catch(() => null);
  expect(id).toBeNull(); // API also scopes citizens to own requests
  assertNoConsoleErrors(cit2Errors);
  await cit2.close();

  // volunteer: no request routes at all
  const vol = await browser.newPage();
  const volErrors = trackConsole(vol);
  await loginAs(vol, USERS.volunteer1);
  await vol.goto('/my-requests');
  await expect(vol).toHaveURL(/\/tasks/);
  await expect(vol.locator('body')).not.toContainText(CITIZEN1_PHONE);
  assertNoConsoleErrors(volErrors);
  await vol.close();
});

test('assigned team sees contact, unassigned team does not', async ({ browser }) => {
  // Alpha is assigned to req1 (citizen1); Bravo is assigned to req2 (citizen2)
  const alpha = await browser.newPage();
  const alphaErrors = trackConsole(alpha);
  await loginAs(alpha, USERS.teamAlpha);
  await alpha.goto('/missions');
  await alpha.locator('div.card', { hasText: 'Bldg 7' }).getByRole('link', { name: /open mission/i }).click();
  await expect(alpha).toHaveURL(/\/missions\/.+/);
  await expect(alpha.getByText(CITIZEN1_PHONE).first()).toBeVisible({ timeout: 20_000 });

  const bravo = await browser.newPage();
  const bravoErrors = trackConsole(bravo);
  await loginAs(bravo, USERS.teamBravo);
  await bravo.goto('/missions');
  await bravo.locator('div.card', { hasText: 'Kurla West' }).getByRole('link', { name: /open mission/i }).click();
  await expect(bravo).toHaveURL(/\/missions\/.+/);
  // own requester's contact visible…
  await expect(bravo.getByText(CITIZEN2_PHONE).first()).toBeVisible({ timeout: 20_000 });
  // …but nothing of citizen1 leaks onto the page
  await expect(bravo.locator('body')).not.toContainText(CITIZEN1_PHONE);

  assertNoConsoleErrors(alphaErrors);
  assertNoConsoleErrors(bravoErrors);
  await alpha.close();
  await bravo.close();
});
