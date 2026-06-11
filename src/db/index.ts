import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../modules/env';

const { DATABASE_URL } = env;

export const openDB = () => {
  const db = drizzle(DATABASE_URL);
  return { db, close: () => db.$client.end() };
};

export type DB = ReturnType<typeof openDB>['db'];

export const db = drizzle(DATABASE_URL);
