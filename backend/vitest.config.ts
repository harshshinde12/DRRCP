import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // Isolated SQLite file for tests (+ rate limits off via NODE_ENV=test).
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./prisma/test.db',
      JWT_SECRET: 'test-secret-min-32-chars-0123456789abcdef',
      JWT_EXPIRES_IN: '1h',
    },
    globalSetup: ['./tests/globalSetup.ts'],
    testTimeout: 30000,
    // SQLite is a single file — run everything serially.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    sequence: { shuffle: false },
    fileParallelism: false,
  },
});
