import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../db/index.js';
import { etlRuns } from '../../db/schema.js';
import { toEtlFilePath } from './etl-file-path.js';
import type { DbOrTx } from './insert-records.js';

const BULK_CHUNK = 500;

export async function loadDonePaths(
  db: DB,
  source: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ filePath: etlRuns.filePath })
    .from(etlRuns)
    .where(and(eq(etlRuns.source, source), eq(etlRuns.status, 'done')));
  return new Set(
    rows.map((r) => r.filePath).filter((p): p is string => p != null),
  );
}

export async function markFileDone(
  db: DbOrTx,
  filePath: string,
  rowsWritten: number,
  source?: string,
  batch?: string,
) {
  const key = toEtlFilePath(filePath);
  await db
    .insert(etlRuns)
    .values({
      filePath: key,
      source,
      batch,
      rowsWritten,
      status: 'done',
      finishedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: etlRuns.filePath,
      set: {
        rowsWritten,
        finishedAt: sql`now()`,
        status: 'done',
        ...(batch != null ? { batch } : {}),
      },
    });
}

type FileRunEntry = {
  filePath: string;
  rowsWritten: number;
  batch?: string;
};

export async function markFilesDoneBulk(
  db: DbOrTx,
  source: string,
  entries: FileRunEntry[],
) {
  if (entries.length === 0) return;

  for (let i = 0; i < entries.length; i += BULK_CHUNK) {
    const chunk = entries.slice(i, i + BULK_CHUNK);
    await db
      .insert(etlRuns)
      .values(
        chunk.map(({ filePath, rowsWritten, batch }) => ({
          filePath: toEtlFilePath(filePath),
          source,
          batch,
          rowsWritten,
          status: 'done' as const,
          finishedAt: sql`now()`,
        })),
      )
      .onConflictDoUpdate({
        target: etlRuns.filePath,
        set: {
          rowsWritten: sql`excluded.rows_written`,
          finishedAt: sql`now()`,
          status: 'done',
          batch: sql`excluded.batch`,
        },
      });
  }
}

export async function markFilesErrorBulk(db: DB, source: string, paths: string[]) {
  if (paths.length === 0) return;

  for (let i = 0; i < paths.length; i += BULK_CHUNK) {
    const chunk = paths.slice(i, i + BULK_CHUNK);
    await db
      .insert(etlRuns)
      .values(
        chunk.map((filePath) => ({
          filePath: toEtlFilePath(filePath),
          source,
          status: 'error' as const,
          finishedAt: sql`now()`,
        })),
      )
      .onConflictDoUpdate({
        target: etlRuns.filePath,
        set: {
          status: 'error',
          finishedAt: sql`now()`,
        },
      });
  }
}
