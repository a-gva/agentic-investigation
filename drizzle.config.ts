import type { Config } from 'drizzle-kit';
import { env } from './src/modules/env';

const url = env.DATABASE_URL;

export default {
  // Backward-compatible default: control-plane config.
  // Prefer `drizzle.control-plane.config.ts` and `drizzle.data-plane.config.ts`.
  schema: './src/db/schema.ts',
  out: './drizzle/',
  dialect: 'postgresql',
  dbCredentials: {
    url,
  },
  verbose: true,
  migrations: {
    schema: 'public',
  },
} satisfies Config;
