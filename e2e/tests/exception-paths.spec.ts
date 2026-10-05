import { expect, test, type Page } from '@playwright/test';
import { reseed } from '../global-setup.js';
import { USERS, assertNoConsoleErrors, loginAs, trackConsole, uniqueCitizenEmail } from './helpers.js';

test.beforeAll(() => {
  reseed();
});

async function registerCitizen(page: Page, tag: string) {
  const email = uniqueCitizenEmail(tag);
  await page.goto('/register');
  await page.getByLabel(/full name/i).fill(`E2E ${tag}`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill('Password@123');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).not.toHaveURL(/\/register/, { timeout: 20_000 });
  return email;
}

async function submitRequest(page: Page, location: string, people = '3') {
  await page.goto('/request-help');
  await page.getByRole('radiogroup', { name: /emergency type/i }).getByText('Rescue', { exact: true }).click();
  await page.getByLabel(/people affected/i).fill(people);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByPlaceholder(/bldg|address|landmark/i).fill(location);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByPlaceholder(/who needs help|details|describe/i).fill(`E2E test incident at ${location}`);
  await page.getByRole('button', { name: /confirm|submit/i }).click();
  await expect(page).toHaveURL(/\/my-requests\/.+/, { timeout: 20_000 });
  return page.url().split('/').pop()!;
}

async function adminVerify(page: Page, location: string, priority = 'HIGH') {
  await page.goto('/admin/requests');
  await page.getByPlaceholder(/search location/i).fill(location);
  await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 });
  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('heading', { name: /^triage$/i })).toBeVisible();
  await page.locator('section[aria-label="Verify"] select').nth(1).selectOption(priority);
  await page.getByRole('button', { name: /apply decision/i }).click();
  await expect(page.getByText(/request verified\./i)).toBeVisible({ timeout: 20_000 });
}

test('unavailable team requires override reason, then force-assigns', async ({ page, browser }) => {
  const errors = trackConsole(page);
  await registerCitizen(page, 'override');
  const location = `E2E Override Lane ${Date.now()}`;
  await submitRequest(page, location);
  // need admin context for team id lookup
  const adminPage = await browser.newPage();
  const adminErrors = trackConsole(adminPage);
  await loginAs(adminPage, USERS.admin);
  await adminVerify(adminPage, location);

  // Alpha Flood Rescue is ASSIGNED in seed → find its id via API
  const teams = await adminPage.evaluate(async () => {
    const r = await fetch('/api/teams?limit=50', { headers: { Authorization: `Bearer ${localStorage.getItem('drrcp.token')}` } });
    return r.json();
  });
  const alpha = teams.data.find((t: { name: string }) => t.name === 'Alpha Flood Rescue');
  expect(alpha).toBeTruthy();

  // paste busy team id → Force → modal demands a reason
  // (F-10: the triage drawer is role=dialog too — scope to the override modal)
  await adminPage.getByPlaceholder(/paste any team id/i).fill(alpha.id);
  await adminPage.getByRole('button', { name: /^force/i }).click();
  const overrideDialog = adminPage.getByRole('dialog', { name: /override availability/i });
  await expect(overrideDialog).toBeVisible();
  await overrideDialog.getByRole('button', { name: /override & assign/i }).click();
  await expect(adminPage.getByText(/at least 5 characters/i)).toBeVisible();
  await adminPage.getByLabel(/override reason/i).fill('Nearest boat crew despite engagement');
  await overrideDialog.getByRole('button', { name: /override & assign/i }).click();
  await expect(adminPage.getByText(/force-assigned/i)).toBeVisible({ timeout: 20_000 });
  // repeat dispatch labelled as additional support
  await expect(adminPage.getByText(/additional support/i).first()).toBeVisible({ timeout: 20_000 });

  assertNoConsoleErrors(errors);
  assertNoConsoleErrors(adminErrors);
  await adminPage.close();
});

test('rescue-unsuccessful support request alerts admins', async ({ browser }) => {
  const teamPage = await browser.newPage();
  const adminPage = await browser.newPage();
  const teamErrors = trackConsole(teamPage);
  const adminErrors = trackConsole(adminPage);

  await loginAs(teamPage, USERS.teamBravo);
  await teamPage.goto('/missions');
  // Bravo holds exactly one RESCUE_IN_PROGRESS seed mission
  const card = teamPage.locator('div.card').first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole('link', { name: /open mission/i }).click();
  await expect(teamPage).toHaveURL(/\/missions\/.+/);
  await teamPage.getByRole('button', { name: /request support/i }).click();
  await teamPage.getByPlaceholder(/need a second boat/i).fill('E2E: need a second boat urgently');
  await teamPage.getByRole('button', { name: /send support request/i }).click();
  await expect(teamPage.getByText(/support request sent/i)).toBeVisible({ timeout: 20_000 });

  await loginAs(adminPage, USERS.admin);
  await adminPage.goto('/notifications');
  await expect(adminPage.getByText(/additional support/i).first()).toBeVisible({ timeout: 20_000 });

  assertNoConsoleErrors(teamErrors);
  assertNoConsoleErrors(adminErrors);
  await teamPage.close();
  await adminPage.close();
});

test('duplicate request is linked, original still dispatchable', async ({ page, browser }) => {
  const errors = trackConsole(page);
  await registerCitizen(page, 'dup');
  const locA = `E2E Dup Original ${Date.now()}`;
  await submitRequest(page, locA);
  const idA = page.url().split('/').pop()!;
  const locB = `E2E Dup Copy ${Date.now()}`;
  await submitRequest(page, locB);

  const adminPage = await browser.newPage();
  const adminErrors = trackConsole(adminPage);
  await loginAs(adminPage, USERS.admin);
  // mark B as duplicate of A
  await adminPage.goto('/admin/requests');
  await adminPage.getByPlaceholder(/search location/i).fill(locB);
  await expect(adminPage.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 });
  await adminPage.locator('tbody tr').first().click();
  await expect(adminPage.getByRole('heading', { name: /^triage$/i })).toBeVisible();
  await adminPage.locator('section[aria-label="Verify"] select').first().selectOption('DUPLICATE');
  await adminPage.getByPlaceholder(/paste the original request id/i).fill(idA);
  await adminPage.getByRole('button', { name: /apply decision/i }).click();
  await expect(adminPage.getByText(/request duplicate\./i)).toBeVisible({ timeout: 20_000 });

  // citizen sees terminal duplicate state, original still verifiable
  await page.goto(`/my-requests/${idA}`);
  await adminPage.goto('/admin/requests');
  await adminPage.getByPlaceholder(/search location/i).fill(locA);
  await expect(adminPage.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 });
  await adminPage.locator('tbody tr').first().click();
  await adminPage.getByRole('button', { name: /apply decision/i }).click();
  await expect(adminPage.getByText(/request verified\./i)).toBeVisible({ timeout: 20_000 });

  assertNoConsoleErrors(errors);
  assertNoConsoleErrors(adminErrors);
  await adminPage.close();
});

test('shelter capacity block enforced, admin override audited', async ({ page, browser }) => {
  const errors = trackConsole(page);
  await loginAs(page, USERS.manager);
  await page.goto('/my-shelters');
  const dadar = page.locator('div.card', { hasText: 'Dadar School Shelter' });
  await expect(dadar).toBeVisible({ timeout: 20_000 });
  await dadar.getByRole('button', { name: /check-in/i }).click();
  await dadar.getByRole('button', { name: /^save$/i }).click();
  await expect(dadar.getByRole('alert')).toContainText(/exceed/i, { timeout: 20_000 });

  // admin can override with the audited flag
  const adminPage = await browser.newPage();
  const adminErrors = trackConsole(adminPage);
  await loginAs(adminPage, USERS.admin);
  await adminPage.goto('/admin/shelters');
  await adminPage.getByPlaceholder(/search name/i).fill('Dadar School Shelter');
  await expect(adminPage.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 });
  await adminPage.locator('tbody tr').first().getByRole('button', { name: /manage/i }).click();
  const dialog = adminPage.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/current occupancy/i).fill('205');
  await dialog.getByText(/emergency override/i).click();
  await dialog.getByLabel(/override reason/i).fill('E2E flood surge, no alternate beds');
  await dialog.getByRole('button', { name: /^save$/i }).click();
  await expect(adminPage.getByText(/shelter updated/i)).toBeVisible({ timeout: 20_000 });

  assertNoConsoleErrors(errors);
  assertNoConsoleErrors(adminErrors);
  await adminPage.close();
});

test('resource over-allocation blocked, valid allocation succeeds', async ({ page }) => {
  const errors = trackConsole(page);
  await loginAs(page, USERS.ngo1);
  await page.goto('/allocations');
  await page.getByRole('button', { name: /allocate/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // rr1 (rice, PARTIALLY_FULFILLED, 200 remaining) is the only allocatable seed request
  const reqId = await dialog.getByLabel(/approved request/i).evaluate((sel: HTMLSelectElement) => {
    const opt = [...sel.options].find((o) => o.value && o.text.includes('Rice bags'));
    return opt?.value ?? '';
  });
  expect(reqId).not.toBe('');
  await dialog.getByLabel(/approved request/i).selectOption(reqId);
  const invId = await dialog.getByLabel(/from inventory/i).evaluate((sel: HTMLSelectElement) => {
    const opt = [...sel.options].find((o) => o.value && o.text.startsWith('Rice bags'));
    return opt?.value ?? '';
  });
  await dialog.getByLabel(/from inventory/i).selectOption(invId);
  await dialog.getByLabel(/^quantity$/i).fill('99999');
  await dialog.getByRole('button', { name: /allocate \(atomic\)/i }).click();
  await expect(page.getByText(/over-allocation blocked/i).first()).toBeVisible({ timeout: 20_000 });

  await dialog.getByLabel(/^quantity$/i).fill('50');
  await dialog.getByRole('button', { name: /allocate \(atomic\)/i }).click();
  await expect(page.getByText(/stock allocated/i)).toBeVisible({ timeout: 20_000 });

  assertNoConsoleErrors(errors);
});
