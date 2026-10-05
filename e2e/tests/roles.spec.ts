import { expect, test } from '@playwright/test';
import { USERS, assertNoConsoleErrors, loginAs, trackConsole } from './helpers.js';

/**
 * Every role logs in and lands on its home page with key content.
 * (Deeper workflows live in full-story / exception-paths specs.)
 */
const CASES = [
  { email: USERS.admin, home: '/admin', heading: /command center|dashboard/i },
  { email: USERS.citizen1, home: '/my-requests', heading: /my requests|request/i },
  { email: USERS.teamAlpha, home: '/missions', heading: /mission/i },
  { email: USERS.volunteer1, home: '/tasks', heading: /task/i },
  { email: USERS.manager, home: '/my-shelters', heading: /shelter/i },
  { email: USERS.ngo1, home: '/inventory', heading: /inventor/i },
] as const;

for (const c of CASES) {
  test(`${c.email} logs in and sees home page`, async ({ page }) => {
    const errors = trackConsole(page);
    await loginAs(page, c.email);
    await expect(page).toHaveURL(new RegExp(c.home.replace('/', '\\/')));
    await expect(page.getByRole('heading', { name: c.heading }).first()).toBeVisible({ timeout: 20_000 });
    assertNoConsoleErrors(errors);
  });
}

test('wrong-role route redirects (citizen cannot open admin)', async ({ page }) => {
  const errors = trackConsole(page);
  await loginAs(page, USERS.citizen1);
  await page.goto('/admin');
  await expect(page).not.toHaveURL(/\/admin$/);
  assertNoConsoleErrors(errors);
});

test('unauthenticated deep link redirects to login', async ({ page }) => {
  const errors = trackConsole(page);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
  assertNoConsoleErrors(errors);
});
