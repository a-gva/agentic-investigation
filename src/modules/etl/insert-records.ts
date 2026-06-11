import type { DB } from '../../db/index.js';
import type { NewDbRecord } from '../../db/schema.js';
import { records } from '../../db/schema.js';

export type DbOrTx = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

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
    const seen = new Set<string>();
    const chunk = rows.slice(i, i + MAX_ROWS).filter((row) => {
      if (seen.has(row.rawHash)) return false;
      seen.add(row.rawHash);
      return true;
    });
    if (chunk.length === 0) continue;

    const result = await db
      .insert(records)
      .values(chunk)
      .onConflictDoNothing({ target: records.rawHash });
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}
