import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

export const dbFileName = 'investigation.db';

const client = createClient({ url: `file:${dbFileName}` });
export const db = drizzle(client);

export type DB = typeof db;

export function openDB(dbPath: string) {
  const client = createClient({ url: `file:${dbPath}` });
  const db = drizzle(client);
  return { db, close: () => client.close() };
}
