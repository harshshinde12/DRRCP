import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

/** Create a fresh test database from the Prisma schema before the suite runs. */
export default function globalSetup() {
  process.env.DATABASE_URL ??= 'file:./prisma/test.db';
  try {
    if (existsSync('prisma/test.db')) rmSync('prisma/test.db');
    if (existsSync('prisma/test.db-journal')) rmSync('prisma/test.db-journal');
  } catch {
    // ignore
  }
  execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
  return () => undefined;
}
