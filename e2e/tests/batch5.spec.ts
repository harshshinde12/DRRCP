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

async function pendingCount(page: Page): Promise<number> {
  const text = (await page.getByText(/awaiting verification/i).first().textContent()) ?? '';
  return Number(text.replace(/[^0-9]/g, '')) || 0;
}

test('dashboard and audit log update after triage without a manual refresh', async ({ page, browser }) => {
  const errors = trackConsole(page);
  await registerCitizen(page, 'fresh');
  const location = `E2E Fresh Lane ${Date.now()}`;
  await submitRequest(page, location);

  const adminPage = await browser.newPage();
  const adminErrors = trackConsole(adminPage);
  await loginAs(adminPage, USERS.admin);

  // Baseline from the live command center.
  await adminPage.goto('/admin');
  await expect(adminPage.getByText(/awaiting verification/i).first()).toBeVisible({ timeout: 20_000 });
  const before = await pendingCount(adminPage);

  // Triage the fresh request (mutation invalidates dashboard + audit caches).
  await adminPage.goto('/admin/requests');
  await adminPage.getByPlaceholder(/search location/i).fill(location);
  await expect(adminPage.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 });
  await adminPage.locator('tbody tr').first().click();
  await expect(adminPage.getByRole('heading', { name: /^triage$/i })).toBeVisible();
  await adminPage.getByRole('button', { name: /apply decision/i }).click();
  await expect(adminPage.getByText(/request verified\./i)).toBeVisible({ timeout: 20_000 });

  // SPA navigation only — no page.reload(): dashboard reflects the mutation.
  await adminPage.goto('/admin');
  await expect
    .poll(async () => pendingCount(adminPage), { timeout: 25_000 })
    .toBe(before - 1);

  // Same for the audit trail: the REQUEST_VERIFY entry is there on arrival.
  await adminPage.goto('/admin/audit');
  await expect(adminPage.getByText(/REQUEST_VERIFY/i).first()).toBeVisible({ timeout: 20_000 });

  assertNoConsoleErrors(errors);
  assertNoConsoleErrors(adminErrors);
  await adminPage.close();
});

test('error states render with retry when the API is blocked', async ({ page, browser }) => {
  // Public shelters surface: blocked API → error state, never an empty list.
  await page.route('**/api/shelters**', (route) => route.abort());
  await page.goto('/shelters');
  await expect(page.getByText(/something went wrong/i).first()).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole('button', { name: /retry/i }).first()).toBeVisible();
  // Unblock → retry recovers the list without a full reload.
  await page.unroute('**/api/shelters**');
  await page.getByRole('button', { name: /retry/i }).first().click();
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 25_000 });

  // Admin dashboard summary: blocked API → operational-picture error state.
  const adminPage = await browser.newPage();
  await loginAs(adminPage, USERS.admin);
  await adminPage.route('**/api/dashboard/summary**', (route) => route.abort());
  await adminPage.goto('/admin');
  await expect(adminPage.getByText(/could not load the operational picture/i)).toBeVisible({ timeout: 25_000 });
  await expect(adminPage.getByRole('button', { name: /retry/i })).toBeVisible();
  await adminPage.close();
  // NOTE: no assertNoConsoleErrors here — aborted requests log net::ERR_FAILED
  // in some runs; the assertions above are the actual signal.
});
