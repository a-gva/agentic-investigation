import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../modules/env';

const { DATABASE_URL } = env;

export const openDB = () => {
  const db = drizzle(DATABASE_URL);
  return { db, close: () => db.$client.end() };
};

export type DB = ReturnType<typeof openDB>['db'];

export const db = drizzle(DATABASE_URL);

export function openPool(max = 3) {
  const pool = new Pool({ connectionString: DATABASE_URL, max });
  const pooled = drizzle(pool);
  return {
    db: pooled,
    close: async () => {
      await pool.end();
    },
  };
}

/** Session knobs for bulk ETL loads (best-effort; skipped if Postgres disallows). */
export async function tuneLoadSession(db: DB) {
  const settings = [
    sql`SET synchronous_commit = off`,
    sql`SET maintenance_work_mem = '256MB'`,
    sql`SET checkpoint_timeout = '30min'`,
  ];
  for (const stmt of settings) {
    try {
      await db.execute(stmt);
    } catch {
      // Docker / managed Postgres may reject elevated session params.
    }
  }
}
