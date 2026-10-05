import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { USERS, loginAs, trackConsole } from './helpers.js';

/** Lighthouse-style accessibility audit via axe (wcag2a + wcag2aa). */

/** Wait until Tailwind/webfont styles are actually applied (avoid FOUC flakes). */
async function settled(page: Page) {
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => getComputedStyle(document.body).backgroundColor.replace(/\s/g, '') === 'rgb(2,6,23)',
    { timeout: 20_000 },
  );
  await page.waitForTimeout(800); // Leaflet tiles / charts paint
}

test('landing + login have no serious a11y violations', async ({ page }) => {
  for (const url of ['/', '/login', '/register', '/shelters']) {
    await page.goto(url);
    await settled(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const summary = results.violations.map((v) => ({
      url,
      id: v.id,
      nodes: v.nodes.map((n) => n.html.slice(0, 160)),
    }));
    expect(results.violations, `a11y violations on ${url}:\n` + JSON.stringify(summary, null, 2)).toEqual([]);
  }
});

test('authenticated citizen + admin pages have no serious a11y violations', async ({ page }) => {
  const errors = trackConsole(page);
  await loginAs(page, USERS.citizen1);
  for (const url of ['/my-requests', '/request-help', '/notifications']) {
    await page.goto(url);
    await settled(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const summary = results.violations.map((v) => ({
      url,
      id: v.id,
      nodes: v.nodes.map((n) => n.html.slice(0, 160)),
    }));
    expect(results.violations, `a11y violations on ${url}:\n` + JSON.stringify(summary, null, 2)).toEqual([]);
  }
  expect(errors).toEqual([]);
});
