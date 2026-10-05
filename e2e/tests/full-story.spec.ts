import { expect, test, type Page } from '@playwright/test';
import { reseed } from '../global-setup.js';
import { USERS, assertNoConsoleErrors, loginAs, trackConsole, uniqueCitizenEmail } from './helpers.js';

test.beforeAll(() => {
  reseed();
});

const LOCATION = `E2E Flood Lane ${Date.now()}`;

/**
 * The report's flagship story (flood, 5 trapped people, 1 injured):
 * Citizen submits → Admin verifies Critical + assigns available team →
 * team acknowledges → On the Way → In Progress → report → Resolved →
 * citizen sees every displayStatus update on the timeline.
 */
test('full flood story with live citizen timeline', async ({ browser }) => {
  const citizenCtx = await browser.newContext();
  const teamCtx = await browser.newContext();
  const citizen: Page = await citizenCtx.newPage();
  const teamPage: Page = await teamCtx.newPage();
  const citizenErrors = trackConsole(citizen);
  const teamErrors = trackConsole(teamPage);
  const email = uniqueCitizenEmail('story');

  // 1. Citizen registers + submits (3-step form)
  await citizen.goto('/register');
  await citizen.getByLabel(/full name|name/i).fill('E2E Flood Victim');
  await citizen.getByLabel(/email/i).fill(email);
  await citizen.getByLabel(/^password/i).fill('Password@123');
  await citizen.getByRole('button', { name: /create account|register|sign up/i }).click();
  await expect(citizen).not.toHaveURL(/\/register/, { timeout: 20_000 });

  await citizen.goto('/request-help');
  await citizen.getByRole('radiogroup', { name: /emergency type/i }).getByText('Rescue', { exact: true }).click();
  await citizen.getByLabel(/people affected/i).fill('5');
  await citizen.getByText(/anyone injured\?/i).click();
  await citizen.getByLabel(/injury severity/i).selectOption('SEVERE');
  await citizen.getByRole('button', { name: /continue/i }).click();
  await citizen.getByPlaceholder(/bldg|address|landmark/i).fill(LOCATION);
  await citizen.getByRole('button', { name: /continue/i }).click();
  await citizen.getByPlaceholder(/who needs help|details|describe/i).fill('Five people trapped on the roof, one injured, water rising fast');
  await citizen.getByRole('button', { name: /confirm|submit/i }).click();
  await expect(citizen).toHaveURL(/\/my-requests\/.+/, { timeout: 20_000 });
  const detailUrl = citizen.url();
  await expect(citizen.getByText(/awaiting verification/i).first()).toBeVisible();

  // 2. Admin verifies Critical + assigns Charlie (AVAILABLE in seed)
  const admin = await browser.newPage();
  const adminErrors = trackConsole(admin);
  await loginAs(admin, USERS.admin);
  await admin.goto('/admin/requests');
  await admin.getByPlaceholder(/search location/i).fill(LOCATION);
  await expect(admin.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 });
  await admin.locator('tbody tr').first().click();
  await expect(admin.getByRole('heading', { name: /^triage$/i })).toBeVisible();
  await admin.locator('section[aria-label="Verify"] select').nth(1).selectOption('CRITICAL');
  await admin.getByRole('button', { name: /apply decision/i }).click();
  await expect(admin.getByText(/request verified\./i)).toBeVisible({ timeout: 20_000 });
  const charlieRow = admin.locator('li', { hasText: 'Charlie Fire Squad' });
  await expect(charlieRow).toBeVisible({ timeout: 20_000 });
  await charlieRow.getByRole('button', { name: /assign/i }).click();
  await expect(admin.getByText(/team assigned/i).first()).toBeVisible({ timeout: 20_000 });
  await admin.close();

  // 3. Team works the mission; citizen timeline follows live
  await loginAs(teamPage, USERS.teamCharlie);
  await teamPage.goto('/missions');
  const missionCard = teamPage.locator('div.card', { hasText: LOCATION });
  await expect(missionCard).toBeVisible({ timeout: 20_000 });
  await missionCard.getByRole('link', { name: /open mission/i }).click();
  await expect(teamPage).toHaveURL(/\/missions\/.+/);
  await teamPage.getByRole('button', { name: /acknowledge/i }).click();
  await expect(teamPage.getByText(/acknowledged/i).first()).toBeVisible({ timeout: 20_000 });

  await teamPage.getByRole('button', { name: /on the way/i }).click();
  // LIVE: citizen page updates via polling without reload
  await citizen.goto(detailUrl);
  await expect(citizen.getByText(/team on the way/i).first()).toBeVisible({ timeout: 30_000 });

  await teamPage.getByRole('button', { name: /start rescue/i }).click();
  await expect(teamPage.getByText(/rescue in progress/i).first()).toBeVisible({ timeout: 20_000 });
  await citizen.reload();
  await expect(citizen.getByText(/rescue in progress/i).first()).toBeVisible({ timeout: 30_000 });

  await teamPage.getByLabel(/people rescued/i).fill('5');
  await teamPage.getByLabel(/injured encountered/i).fill('1');
  await teamPage.getByLabel(/mission notes/i).fill('All five evacuated by boat, one to hospital');
  await teamPage.getByRole('button', { name: /file report/i }).click();
  await expect(teamPage.getByText(/resolved|mission complete/i).first()).toBeVisible({ timeout: 20_000 });

  // 4. Citizen sees Resolved + history
  await citizen.reload();
  await expect(citizen.getByText(/resolved/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(citizen.getByText(/request_resolve|REQUEST_RESOLVE|resolved/i).first()).toBeVisible();
  // notification arrived
  await citizen.goto('/notifications');
  await expect(citizen.getByText(/resolved/i).first()).toBeVisible({ timeout: 20_000 });

  assertNoConsoleErrors(citizenErrors);
  assertNoConsoleErrors(teamErrors);
  assertNoConsoleErrors(adminErrors);
  await citizenCtx.close();
  await teamCtx.close();
});
