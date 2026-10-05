import { expect, test } from '@playwright/test';
import { reseed } from '../global-setup.js';
import { USERS, assertNoConsoleErrors, loginAs, trackConsole } from './helpers.js';

test.beforeAll(() => {
  reseed();
});

/** Volunteer3 holds one ASSIGNED seed task: accept → start → complete. */
test('volunteer completes a task lifecycle', async ({ page }) => {
  const errors = trackConsole(page);
  await loginAs(page, 'volunteer3@drrcp.local');
  await page.goto('/tasks');
  const row = page.locator('tbody tr', { hasText: 'Community kitchen' });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole('button', { name: /accept/i }).click();
  await expect(page.getByText(/task accepted/i)).toBeVisible({ timeout: 20_000 });
  await row.getByRole('button', { name: /start/i }).click();
  await expect(page.getByText(/in progress/i).first()).toBeVisible({ timeout: 20_000 });
  await row.getByRole('button', { name: /complete/i }).click();
  await expect(page.getByText(/task completed/i)).toBeVisible({ timeout: 20_000 });
  assertNoConsoleErrors(errors);
});

/** Manager raises a resource request for their own shelter. */
test('shelter manager raises a resource request', async ({ page }) => {
  const errors = trackConsole(page);
  await loginAs(page, USERS.manager);
  await page.goto('/my-shelters');
  await page.getByRole('button', { name: /raise resource request/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const shelterId = await dialog.getByLabel(/shelter/i).evaluate((sel: HTMLSelectElement) => {
    const opt = [...sel.options].find((o) => o.value && o.text.includes('Andheri Sports Complex'));
    return opt?.value ?? '';
  });
  await dialog.getByLabel(/shelter/i).selectOption(shelterId);
  const itemId = await dialog.getByLabel(/item/i).evaluate((sel: HTMLSelectElement) => {
    const opt = [...sel.options].find((o) => o.value && o.text.startsWith('Rice bags'));
    return opt?.value ?? '';
  });
  await dialog.getByLabel(/item/i).selectOption(itemId);
  await dialog.getByLabel(/quantity/i).fill('120');
  await dialog.getByRole('button', { name: /raise request/i }).click();
  await expect(page.getByText(/resource request raised/i)).toBeVisible({ timeout: 20_000 });
  await page.goto('/resource-requests');
  await expect(page.getByText(/120/i).first()).toBeVisible({ timeout: 20_000 });
  assertNoConsoleErrors(errors);
});

/** NGO approves the fresh PENDING request and allocates stock. */
test('ngo approves and allocates against the new request', async ({ page }) => {
  const errors = trackConsole(page);
  await loginAs(page, USERS.ngo1);
  await page.goto('/relief-requests');
  // Seed rr2 (Drinking water ×1000, PENDING) — the manager test above raised Rice, so no clash.
  const rr2row = page.locator('tbody tr', { hasText: 'Drinking water bottles' }).filter({ hasText: '1000' });
  await expect(rr2row).toBeVisible({ timeout: 20_000 });
  await rr2row.getByRole('button', { name: /^approve$/i }).click();
  await expect(page.getByText(/request approved/i)).toBeVisible({ timeout: 20_000 });

  await page.goto('/allocations');
  await page.getByRole('button', { name: /allocate/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const reqId = await dialog.getByLabel(/approved request/i).evaluate((sel: HTMLSelectElement) => {
    const opt = [...sel.options].find((o) => o.value && o.text.includes('Drinking water'));
    return opt?.value ?? '';
  });
  expect(reqId).not.toBe('');
  await dialog.getByLabel(/approved request/i).selectOption(reqId);
  const invId = await dialog.getByLabel(/from inventory/i).evaluate((sel: HTMLSelectElement) => {
    const opt = [...sel.options].find((o) => o.value && o.text.includes('Drinking water'));
    return opt?.value ?? '';
  });
  await dialog.getByLabel(/from inventory/i).selectOption(invId);
  await dialog.getByLabel(/^quantity$/i).fill('200');
  await dialog.getByRole('button', { name: /allocate \(atomic\)/i }).click();
  await expect(page.getByText(/stock allocated/i)).toBeVisible({ timeout: 20_000 });
  assertNoConsoleErrors(errors);
});

/** Admin broadcast surfaces in the citizen inbox. */
test('broadcast alert reaches citizens', async ({ browser }) => {
  const admin = await browser.newPage();
  const adminErrors = trackConsole(admin);
  await loginAs(admin, USERS.admin);
  await admin.goto('/admin/alerts');
  await admin.getByPlaceholder(/heavy rainfall/i).fill('E2E cyclone warning for the coast');
  await admin.getByRole('button', { name: /publish alert/i }).click();
  await expect(admin.getByText(/published/i)).toBeVisible({ timeout: 20_000 });

  const cit = await browser.newPage();
  const citErrors = trackConsole(cit);
  await loginAs(cit, USERS.citizen1);
  await cit.goto('/notifications');
  await expect(cit.getByText(/cyclone warning/i).first()).toBeVisible({ timeout: 20_000 });

  assertNoConsoleErrors(adminErrors);
  assertNoConsoleErrors(citErrors);
  await admin.close();
  await cit.close();
});
