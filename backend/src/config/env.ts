import 'dotenv/config';

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL ?? 'file:./dev.db',
  JWT_SECRET: requireEnv('JWT_SECRET', 'dev-only-insecure-secret-change-me-32chars!!'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  // Rate limits (RMMM R5). Disabled entirely when NODE_ENV=test so suites never flake.
  API_RATE_LIMIT_MAX: Number(process.env.API_RATE_LIMIT_MAX ?? 300),
  API_RATE_LIMIT_WINDOW_MS: Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 50),
  AUTH_RATE_LIMIT_WINDOW_MS: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
};

if (env.NODE_ENV === 'production' && env.JWT_SECRET.includes('dev-only')) {
  throw new Error('JWT_SECRET must be set to a strong value in production');
}
