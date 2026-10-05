import { expect, test, type Browser, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reseed } from '../global-setup.js';
import { USERS, loginAs, trackConsole } from './helpers.js';

test.beforeAll(() => {
  reseed();
});

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const shot = (name: string, width: number) =>
  path.join(rootDir, 'docs', 'screenshots', `${name}-${width === 390 ? 'mobile' : 'desktop'}.png`);

async function snap(browser: Browser, width: number, email: string | null, url: string, name: string, waitFor?: string) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
  const page = await ctx.newPage();
  if (email) await loginAs(page, email);
  await page.goto(url);
  if (waitFor) await expect(page.locator(waitFor).first()).toBeVisible({ timeout: 25_000 });
  else await page.waitForTimeout(2500);
  await page.screenshot({ path: shot(name, width) });
  await ctx.close();
}

const WIDTHS = [1440, 390];

for (const w of WIDTHS) {
  test(`public pages @${w}px`, async ({ browser }) => {
    await snap(browser, w, null, '/', 'landing', 'h1');
    await snap(browser, w, null, '/login', 'login', 'h1');
    await snap(browser, w, null, '/shelters', 'shelters-public', 'h1');
  });

  test(`citizen pages @${w}px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
    const page = await ctx.newPage();
    void trackConsole(page);
    await loginAs(page, USERS.citizen1);
    for (const [url, name, sel] of [
      ['/my-requests', 'citizen-requests', 'h1'],
      ['/request-help', 'citizen-new-request', 'h1'],
      ['/shelters', 'citizen-shelters', 'h1'],
      ['/notifications', 'citizen-notifications', 'h1'],
    ] as const) {
      await page.goto(url);
      await expect(page.locator(sel).first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: shot(name, w) });
    }
    await ctx.close();
  });

  test(`admin pages @${w}px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
    const page = await ctx.newPage();
    void trackConsole(page);
    await loginAs(page, USERS.admin);
    for (const [url, name] of [
      ['/admin', 'admin-dashboard'],
      ['/admin/requests', 'admin-queue'],
      ['/admin/teams', 'admin-teams'],
      ['/admin/relief', 'admin-relief'],
    ] as const) {
      await page.goto(url);
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(2000); // let map tiles + charts settle
      await page.screenshot({ path: shot(name, w) });
    }
    await ctx.close();
  });

  test(`field roles @${w}px`, async ({ browser }) => {
    await snap(browser, w, USERS.teamAlpha, '/missions', 'team-missions', 'h1');
    await snap(browser, w, USERS.volunteer1, '/tasks', 'volunteer-tasks', 'h1');
    await snap(browser, w, USERS.manager, '/my-shelters', 'manager-shelters', 'h1');
    await snap(browser, w, USERS.ngo1, '/inventory', 'ngo-inventory', 'h1');
  });
}
