import type { DB } from '../../db/index.js';
import type { NewDbRecord } from '../../db/schema.js';
import { records } from '../../db/schema.js';

type DbOrTx = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

// Postgres allows ~65535 bound parameters per statement; records has 18 columns.
const COLS = 18;
const MAX_ROWS = Math.floor(65535 / COLS);

export async function insertRecords(
  db: DbOrTx,
  rows: NewDbRecord[],
): Promise<number> {
  if (rows.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += MAX_ROWS) {
    const chunk = rows.slice(i, i + MAX_ROWS);
    const result = await db.insert(records).values(chunk);
    inserted += result.rowCount ?? chunk.length;
  }
  return inserted;
}
