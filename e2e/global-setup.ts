import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Seed a clean demo DB once before the whole E2E run (dev.db, shared by dev servers). */
export default async function globalSetup() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  console.log('[e2e] seeding demo database…');
  execSync('npm run seed:demo', { cwd: rootDir, stdio: 'inherit', timeout: 300_000 });
}

export function reseed() {
  const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  execSync('npm run seed:demo', { cwd: rootDir, stdio: 'pipe', timeout: 300_000 });
}
