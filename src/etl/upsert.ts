import { records } from '../db/schema.js';
import type { DB } from '../db/setup.js';
import type { LegislativeRecord } from '../types.js';

// SQLite allows at most 32766 bound variables per statement.
// records has 18 columns → max 1820 rows per INSERT.
const COLS = 18;
const MAX_ROWS = Math.floor(32766 / COLS);

export function makeUpsert(db: DB) {
  return (rows: LegislativeRecord[]): number => {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += MAX_ROWS) {
      const chunk = rows.slice(i, i + MAX_ROWS);
      const result = db
        .insert(records)
        .values(chunk)
        .onConflictDoNothing({ target: records.rawHash })
        .run();
      inserted += result.changes;
    }
    return inserted;
  };
}
