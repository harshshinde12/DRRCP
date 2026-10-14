import { expect, test } from '@playwright/test';
import { reseed } from '../global-setup.js';
import { USERS, assertNoConsoleErrors, loginAs, trackConsole, uniqueCitizenEmail } from './helpers.js';

test.beforeAll(() => {
  reseed();
});

/** S-02: a rescue team sees only requests assigned to its own team. */
test('rescue team cannot see unassigned requests', async ({ browser }) => {
  // Fresh citizen request — verified by nobody, assigned to nobody.
  const cit = await browser.newPage();
  const citErrors = trackConsole(cit);
  await cit.goto('/register');
  await cit.getByLabel(/full name|name/i).fill('E2E Teamscope Victim');
  await cit.getByLabel(/email/i).fill(uniqueCitizenEmail('teamscope'));
  await cit.getByLabel(/^password/i).fill('Password@123');
  await cit.getByRole('button', { name: /create account|register|sign up/i }).click();
  await expect(cit).not.toHaveURL(/\/register/, { timeout: 20_000 });

  const location = `E2E Teamscope Lane ${Date.now()}`;
  await cit.goto('/request-help');
  await cit.getByRole('radiogroup', { name: /emergency type/i }).getByText('Rescue', { exact: true }).click();
  await cit.getByLabel(/people affected/i).fill('2');
  await cit.getByRole('button', { name: /continue/i }).click();
  await cit.getByPlaceholder(/bldg|address|landmark/i).fill(location);
  await cit.getByRole('button', { name: /continue/i }).click();
  await cit.getByPlaceholder(/who needs help|details|describe/i).fill(`E2E scoping probe at ${location}`);
  await cit.getByRole('button', { name: /confirm|submit/i }).click();
  await expect(cit).toHaveURL(/\/my-requests\/.+/, { timeout: 20_000 });
  const reqId = cit.url().split('/').pop()!;
  await cit.close();

  const team = await browser.newPage();
  const teamErrors = trackConsole(team);
  await loginAs(team, USERS.teamAlpha);

  // The fresh request never appears in the team's list…
  const ids = await team.evaluate(async () => {
    const r = await fetch('/api/requests?limit=100', {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('drrcp.token') ?? localStorage.getItem('drrcp.token')}` },
    });
    const j = await r.json();
    return (j.data as Array<{ id: string }>).map((x) => x.id);
  });
  expect(ids).not.toContain(reqId);

  // …and direct detail access is fenced with 403.
  const status = await team.evaluate(async (id: string) => {
    const r = await fetch(`/api/requests/${id}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('drrcp.token') ?? localStorage.getItem('drrcp.token')}` },
    });
    return r.status;
  }, reqId);
  expect(status).toBe(403);

  // The team's missions page (own assignments) still works.
  await team.goto('/missions');
  await expect(team.getByRole('heading', { name: /mission/i })).toBeVisible({ timeout: 20_000 });

  assertNoConsoleErrors(citErrors);
  assertNoConsoleErrors(teamErrors);
  await team.close();
});
