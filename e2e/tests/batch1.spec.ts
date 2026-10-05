import { expect, test } from '@playwright/test';
import { reseed } from '../global-setup.js';
import { USERS, assertNoConsoleErrors, loginAs, trackConsole } from './helpers.js';

test.beforeAll(() => {
  reseed();
});

/** F-01: admin relief modals (create item → add stock → approve → allocate) actually submit. */
test('admin relief round-trip: create item, add stock and allocate', async ({ browser }) => {
  const admin = await browser.newPage();
  const errors = trackConsole(admin);
  await loginAs(admin, USERS.admin);
  await admin.goto('/admin/relief');
  await expect(admin.getByRole('heading', { name: /relief & stock/i })).toBeVisible({ timeout: 20_000 });

  const itemName = `E2E Blankets ${Date.now()}`;

  // 1. + Item modal submits (was dead with `void handleSubmit`)
  await admin.getByRole('button', { name: /^\+ item$/i }).click();
  const itemDialog = admin.getByRole('dialog');
  await expect(itemDialog).toBeVisible();
  await itemDialog.getByLabel(/item name/i).fill(itemName);
  await itemDialog.getByLabel(/category/i).selectOption('CLOTHING');
  await itemDialog.getByLabel(/unit/i).fill('kits');
  await itemDialog.getByRole('button', { name: /save item/i }).click();
  await expect(admin.getByText(/relief item registered/i)).toBeVisible({ timeout: 20_000 });
  await expect(admin.getByText(itemName).first()).toBeVisible({ timeout: 20_000 });

  // 2. + Stock modal submits
  await admin.getByRole('button', { name: /^\+ stock$/i }).click();
  const stockDialog = admin.getByRole('dialog');
  await expect(stockDialog).toBeVisible();
  const itemId = await stockDialog.getByLabel(/^item$/i).evaluate(
    (sel: HTMLSelectElement, name: string) => {
      const opt = [...sel.options].find((o) => o.value && o.text.includes(name));
      return opt?.value ?? '';
    },
    itemName,
  );
  expect(itemId).not.toBe('');
  await stockDialog.getByLabel(/^item$/i).selectOption(itemId);
  await stockDialog.getByLabel(/location/i).fill('E2E Depot');
  await stockDialog.getByLabel(/quantity/i).fill('500');
  await stockDialog.getByRole('button', { name: /save stock/i }).click();
  await expect(admin.getByText(/stock registered/i)).toBeVisible({ timeout: 20_000 });

  // 3. Manager raises a request for the new item (so there is something to allocate)
  const mgr = await browser.newPage();
  const mgrErrors = trackConsole(mgr);
  await loginAs(mgr, USERS.manager);
  await mgr.goto('/my-shelters');
  await mgr.getByRole('button', { name: /raise resource request/i }).click();
  const raiseDialog = mgr.getByRole('dialog');
  await expect(raiseDialog).toBeVisible();
  const raiseItemId = await raiseDialog.getByLabel(/^item$/i).evaluate(
    (sel: HTMLSelectElement, name: string) => {
      const opt = [...sel.options].find((o) => o.value && o.text.includes(name));
      return opt?.value ?? '';
    },
    itemName,
  );
  expect(raiseItemId).not.toBe('');
  await raiseDialog.getByLabel(/^item$/i).selectOption(raiseItemId);
  await raiseDialog.getByLabel(/quantity needed/i).fill('100');
  await raiseDialog.getByRole('button', { name: /raise request/i }).click();
  await expect(mgr.getByText(/resource request raised/i)).toBeVisible({ timeout: 20_000 });
  await mgr.close();

  // 4. Admin approves the fresh PENDING request, then allocates via the fixed modal
  await admin.goto('/admin/relief');
  const pendingRow = admin.locator('tbody tr', { hasText: itemName }).filter({ hasText: 'PENDING' });
  await expect(pendingRow.first()).toBeVisible({ timeout: 20_000 });
  await pendingRow.first().getByRole('button', { name: /^approve$/i }).click();
  await expect(admin.getByText(/request approved/i)).toBeVisible({ timeout: 20_000 });

  await admin.getByRole('button', { name: /allocate/i }).click();
  const allocDialog = admin.getByRole('dialog');
  await expect(allocDialog).toBeVisible();
  const reqId = await allocDialog.getByLabel(/approved request/i).evaluate(
    (sel: HTMLSelectElement, name: string) => {
      const opt = [...sel.options].find((o) => o.value && o.text.includes(name));
      return opt?.value ?? '';
    },
    itemName,
  );
  expect(reqId).not.toBe('');
  await allocDialog.getByLabel(/approved request/i).selectOption(reqId);
  const invId = await allocDialog.getByLabel(/from inventory/i).evaluate(
    (sel: HTMLSelectElement, name: string) => {
      const opt = [...sel.options].find((o) => o.value && o.text.includes(name));
      return opt?.value ?? '';
    },
    itemName,
  );
  expect(invId).not.toBe('');
  await allocDialog.getByLabel(/from inventory/i).selectOption(invId);
  await allocDialog.getByLabel(/^quantity$/i).fill('20');
  await allocDialog.getByRole('button', { name: /allocate \(atomic\)/i }).click();
  await expect(admin.getByText(/stock allocated/i)).toBeVisible({ timeout: 20_000 });

  assertNoConsoleErrors(errors);
  assertNoConsoleErrors(mgrErrors);
  await admin.close();
});

/** F-03: sorted-table row click opens the clicked (sorted) request, not the DOM-indexed one. */
test('sorted request queue opens the correct request', async ({ page }) => {
  const errors = trackConsole(page);
  await loginAs(page, USERS.admin);
  await page.goto('/admin/requests');
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
  const count = await page.locator('tbody tr').count();
  expect(count).toBeGreaterThan(1);

  // Sort by People so the visual order differs from the fetch order.
  await page.getByRole('button', { name: /sort by people/i }).click();
  await page.waitForTimeout(500);
  const firstLocation = (await page.locator('tbody tr').first().locator('td').nth(1).innerText()).trim();
  expect(firstLocation).not.toBe('');

  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('heading', { name: /^triage$/i })).toBeVisible({ timeout: 20_000 });
  // The drawer must show the clicked (sorted-first) request's location.
  await expect(page.locator('aside[aria-label="Triage panel"]').getByText(firstLocation, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  // URL focus param is set (drawer state), proving a real row object was passed.
  await expect.poll(async () => page.url(), { timeout: 20_000 }).toContain('focus=');

  assertNoConsoleErrors(errors);
});
