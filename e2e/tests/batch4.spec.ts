import { expect, test, type Browser, type Page } from '@playwright/test';
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

async function submitRequest(page: Page, location: string) {
  await page.goto('/request-help');
  await page.getByRole('radiogroup', { name: /emergency type/i }).getByText('Rescue', { exact: true }).click();
  await page.getByLabel(/people affected/i).fill('3');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByPlaceholder(/bldg|address|landmark/i).fill(location);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByPlaceholder(/who needs help|details|describe/i).fill(`E2E test incident at ${location}`);
  await page.getByRole('button', { name: /confirm|submit/i }).click();
  await expect(page).toHaveURL(/\/my-requests\/.+/, { timeout: 20_000 });
}

test('field-level errors display under the matching form fields', async ({ page, browser }) => {
  const errors = trackConsole(page);
  // Login: client-side field error appears inline without a server round-trip.
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('not-an-email');
  await page.getByLabel(/^password/i).fill('x');
  await page.getByRole('button', { name: /^log in$/i }).click();
  await expect(page.getByText(/enter a valid email/i).first()).toBeVisible({ timeout: 10_000 });

  // Triage: DUPLICATE without an original ID is blocked inline (mirrors backend 422).
  await registerCitizen(page, 'fieldlevel');
  const location = `E2E Field Level ${Date.now()}`;
  await submitRequest(page, location);
  const adminPage = await browser.newPage();
  const adminErrors = trackConsole(adminPage);
  await loginAs(adminPage, USERS.admin);
  await adminPage.goto('/admin/requests');
  await adminPage.getByPlaceholder(/search location/i).fill(location);
  await expect(adminPage.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 });
  await adminPage.locator('tbody tr').first().click();
  await expect(adminPage.getByRole('heading', { name: /^triage$/i })).toBeVisible();
  await adminPage.locator('section[aria-label="Verify"] select').first().selectOption('DUPLICATE');
  await adminPage.getByRole('button', { name: /apply decision/i }).click();
  await expect(adminPage.getByText(/original request id is required/i)).toBeVisible({ timeout: 10_000 });
  assertNoConsoleErrors(errors);
  assertNoConsoleErrors(adminErrors);
  await adminPage.close();
});

test('pagination controls page through admin users', async ({ page }) => {
  const errors = trackConsole(page);
  await loginAs(page, USERS.admin);
  // Seed has ~14 users (limit 15 = single page): provision extras so the pager renders.
  const created = await page.evaluate(async () => {
    const token = sessionStorage.getItem('drrcp.token') ?? localStorage.getItem('drrcp.token');
    const emails: string[] = [];
    for (let i = 0; i < 4; i++) {
      const email = `e2e-page-${Date.now()}-${i}@drrcp.local`;
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: `E2E Page ${i}`, email, password: 'Password@123', role: 'CITIZEN' }),
      });
      if (r.ok) emails.push(email);
    }
    return emails;
  });
  expect(created.length).toBeGreaterThan(0);

  await page.goto('/admin/users');
  await expect(page.getByText(/page 1 of 2/i).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /next/i }).click();
  await expect(page.getByText(/page 2 of 2/i).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /prev/i }).click();
  await expect(page.getByText(/page 1 of 2/i).first()).toBeVisible({ timeout: 20_000 });
  assertNoConsoleErrors(errors);
});

test('role-targeted broadcast reaches only the chosen role', async ({ browser }) => {
  const admin = await browser.newPage();
  const adminErrors = trackConsole(admin);
  await loginAs(admin, USERS.admin);
  await admin.goto('/admin/alerts');
  const msg = `E2E citizens-only ${Date.now()}`;
  await admin.getByPlaceholder(/heavy rainfall/i).fill(msg);
  // I-02: target CITIZEN only (sr-only checkbox — force, the chip span takes pointer events).
  await admin.getByLabel('Citizen', { exact: true }).check({ force: true });
  await expect(admin.getByText(/only citizen will receive/i)).toBeVisible();
  await admin.getByRole('button', { name: /publish alert/i }).click();
  await expect(admin.getByText(/published to citizen/i)).toBeVisible({ timeout: 20_000 });

  const cit = await browser.newPage();
  const citErrors = trackConsole(cit);
  await loginAs(cit, USERS.citizen1);
  await cit.goto('/notifications');
  await expect(cit.getByText(msg).first()).toBeVisible({ timeout: 20_000 });

  const vol = await browser.newPage();
  const volErrors = trackConsole(vol);
  await loginAs(vol, USERS.volunteer1);
  await vol.goto('/notifications');
  await expect(vol.getByText(msg)).toHaveCount(0);
  // Sanity: the volunteer inbox itself loads (targeting didn't break other roles).
  await expect(vol.locator('h1').first()).toBeVisible();

  assertNoConsoleErrors(adminErrors);
  assertNoConsoleErrors(citErrors);
  assertNoConsoleErrors(volErrors);
  await admin.close();
  await cit.close();
  await vol.close();
});

test('shelter manager over-capacity override needs a reason, then succeeds', async ({ page }: { page: Page }) => {
  const errors = trackConsole(page);
  await loginAs(page, USERS.manager);
  await page.goto('/my-shelters');
  const dadar = page.locator('div.card', { hasText: 'Dadar School Shelter' });
  await expect(dadar).toBeVisible({ timeout: 20_000 });
  await dadar.getByRole('button', { name: /check-in/i }).click();
  // I-04: override checkbox + mandatory reason (mirrors the team-override modal).
  await expect(dadar.getByLabel(/emergency override/i)).toBeVisible();
  await dadar.getByRole('button', { name: /^save$/i }).click();
  await expect(dadar.getByRole('alert')).toContainText(/override|reason|exceed/i, { timeout: 10_000 });
  await dadar.getByLabel(/emergency override/i).check();
  await dadar.getByRole('button', { name: /^save$/i }).click();
  await expect(dadar.getByText(/at least 5 characters/i)).toBeVisible();
  await dadar.getByLabel(/override reason/i).fill('E2E flood surge, no alternate beds');
  await dadar.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(/override logged/i)).toBeVisible({ timeout: 20_000 });
  assertNoConsoleErrors(errors);
});

test('mark available shows the 409 while missions are active', async ({ page }) => {
  const errors = trackConsole(page);
  await loginAs(page, USERS.admin);
  await page.goto('/admin/teams');
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
  // Alpha Flood Rescue is ASSIGNED in seed → button exists, action is rejected.
  const alpha = page.locator('tbody tr', { hasText: 'Alpha Flood Rescue' });
  await expect(alpha).toBeVisible({ timeout: 20_000 });
  await alpha.getByRole('button', { name: /mark available/i }).click();
  await expect(page.getByText(/active assignment/i).first()).toBeVisible({ timeout: 20_000 });
  // Charlie is AVAILABLE → no button, steady state shown instead.
  const charlie = page.locator('tbody tr', { hasText: 'Charlie Fire Squad' });
  await expect(charlie).toBeVisible();
  await expect(charlie.getByText(/ready/i)).toBeVisible();
  assertNoConsoleErrors(errors);
});
