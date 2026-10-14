import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const PASSWORD = 'Password@123';

export const USERS = {
  admin: 'admin@drrcp.local',
  citizen1: 'citizen1@drrcp.local',
  citizen2: 'citizen2@drrcp.local',
  volunteer1: 'volunteer1@drrcp.local',
  teamAlpha: 'team.alpha@drrcp.local',
  teamBravo: 'team.bravo@drrcp.local',
  teamCharlie: 'team.charlie@drrcp.local',
  manager: 'shelter.manager@drrcp.local',
  ngo1: 'ngo1@drrcp.local',
} as const;

/** Log in through the UI login form. */
export async function loginAs(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/** Attach console/page-error tracking; call assertNoConsoleErrors() at test end. */
export function trackConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text().slice(0, 400)}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${String(err).slice(0, 400)}`));
  return errors;
}

const BENIGN = [
  /favicon\.ico/,
  /net::ERR_/i, // tile/CDN blips must not fail the suite; maps have fallbacks
  /Leaflet/i,
  /openstreetmap/i,
  // Expected client errors (4xx) that the UI handles with toasts/inline errors.
  // Only 5xx (unhandled server failures) fail the suite.
  /Failed to load resource.*status of 4\d\d/i,
];

export function assertNoConsoleErrors(errors: string[]) {
  const real = errors.filter((e) => !BENIGN.some((re) => re.test(e)));
  expect(real, real.join('\n')).toEqual([]);
}

/** Unique citizen email per test for isolation. */
export function uniqueCitizenEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}@drrcp.local`;
}

/**
 * Token lookup mirroring the app's sessionStorage-first store
 * (frontend/src/lib/api-client.ts `getToken()`): per-tab session with
 * legacy localStorage fallback. Use inside `page.evaluate`.
 */
export const TEST_TOKEN_EXPR = `sessionStorage.getItem('drrcp.token') ?? localStorage.getItem('drrcp.token')`;
