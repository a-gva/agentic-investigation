import { and, eq, sql } from 'drizzle-orm';
import { glob } from 'glob';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDB, type DB } from '../../db/index.js';
import { env } from '../env/index.js';
import type { NewDbRecord } from '../../db/schema.js';
import { agentRuns, etlRuns, records } from '../../db/schema.js';
import { setDataDir, toEtlFilePath } from './etl-file-path.js';
import { ingestJsonFile } from './ingest-json.js';
import { ingestPressFile } from './ingest-press.js';
import { ingestXmlFile } from './ingest-xml.js';
import { insertRecords, type DbOrTx } from './insert-records.js';

// --- CLI args ---
const args = process.argv.slice(2);
function getArg(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1]! : fallback;
}
const dataDir = resolve(getArg('--data-dir', './data'));
const databaseUrl = env.DATABASE_URL;

function log(msg: string) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function perfLog(phase: string, elapsedMs: number, rows?: number) {
  const rate =
    rows != null && elapsedMs > 0
      ? ` (${Math.round(rows / (elapsedMs / 1000)).toLocaleString()} rows/s)`
      : '';
  log(`⏱  ${phase}: ${formatDuration(elapsedMs)}${rate}`);
}

// --- Resumability helpers ---

async function alreadyDone(db: DB, filePath: string): Promise<boolean> {
  const key = toEtlFilePath(filePath);
  const [row] = await db
    .select({ status: etlRuns.status })
    .from(etlRuns)
    .where(eq(etlRuns.filePath, key))
    .limit(1);
  return row?.status === 'done';
}

async function markFileStart(
  db: DbOrTx,
  filePath: string,
  source: string,
  batch?: string,
) {
  const key = toEtlFilePath(filePath);
  await db
    .insert(etlRuns)
    .values({ filePath: key, source, batch, rowsWritten: 0, status: 'running' })
    .onConflictDoUpdate({
      target: etlRuns.filePath,
      set: {
        rowsWritten: 0,
        startedAt: sql`now()`,
        status: 'running',
        ...(batch != null ? { batch } : {}),
      },
    });
}

async function markFileDone(db: DbOrTx, filePath: string, rowsWritten: number) {
  const key = toEtlFilePath(filePath);
  await db
    .update(etlRuns)
    .set({ rowsWritten, finishedAt: sql`now()`, status: 'done' })
    .where(eq(etlRuns.filePath, key));
}

async function markFileError(db: DB, filePath: string) {
  const key = toEtlFilePath(filePath);
  await db
    .update(etlRuns)
    .set({ status: 'error', finishedAt: sql`now()` })
    .where(eq(etlRuns.filePath, key));
}

async function loadDonePaths(db: DB, source: string): Promise<Set<string>> {
  const rows = await db
    .select({ filePath: etlRuns.filePath })
    .from(etlRuns)
    .where(and(eq(etlRuns.source, source), eq(etlRuns.status, 'done')));
  return new Set(
    rows.map((r) => r.filePath).filter((p): p is string => p != null),
  );
}

// --- Senate JSON ---

async function runSenateETL(db: DB): Promise<number> {
  const files = [
    ...(await glob(`${dataDir}/senate/*/filings/filings_*.json`)),
    ...(await glob(`${dataDir}/senate/*/contributions/contributions_*.json`)),
  ].sort();

  let total = 0;
  for (const filePath of files) {
    if (await alreadyDone(db, filePath)) {
      log(`  skip (done) ${filePath}`);
      continue;
    }
    log(`  senate ${filePath}`);
    await markFileStart(db, filePath, 'senate');

    try {
      let rows = 0;
      await db.transaction(async (tx) => {
        rows = await ingestJsonFile(filePath, async (batch: NewDbRecord[]) => {
          await insertRecords(tx, batch);
        });
        await markFileDone(tx, filePath, rows);
      });
      log(`    → ${rows} records`);
      total += rows;
    } catch (err) {
      log(`    ERROR: ${err}`);
      await markFileError(db, filePath);
    }
  }
  return total;
}

// --- House XML ---

async function runHouseETL(db: DB): Promise<number> {
  const files = (await glob(`${dataDir}/house/**/*.xml`)).sort();
  const BATCH = 1000;
  const donePaths = await loadDonePaths(db, 'house');

  let total = 0;
  let pending: string[] = [];
  let fileCount = 0;

  const flush = async (chunk: string[], startIdx: number) => {
    const batchId = `house:${startIdx}-${startIdx + chunk.length - 1}`;
    type ParsedFile = { filePath: string; rows: NewDbRecord[] };
    const parsed: ParsedFile[] = [];
    let skipped = 0;
    let errors = 0;

    for (const filePath of chunk) {
      if (donePaths.has(toEtlFilePath(filePath))) {
        skipped++;
        continue;
      }
      await markFileStart(db, filePath, 'house', batchId);
      try {
        parsed.push({ filePath, rows: ingestXmlFile(filePath) });
      } catch (err) {
        log(`    ERROR parsing ${filePath}: ${err}`);
        await markFileError(db, filePath);
        errors++;
      }
    }

    if (parsed.length === 0) {
      if (skipped > 0) {
        log(`  skip (done) ${skipped} house files`);
      }
      return 0;
    }

    const batch = parsed.flatMap(({ rows }) => rows);
    let inserted = 0;
    await db.transaction(async (tx) => {
      inserted = await insertRecords(tx, batch);
      for (const { filePath, rows } of parsed) {
        await markFileDone(tx, filePath, rows.length);
        donePaths.add(toEtlFilePath(filePath));
      }
    });
    log(
      `  house batch ${batchId}: ${parsed.length} files, ${inserted} records (${skipped} skipped, ${errors} parse errors)`,
    );
    return inserted;
  };

  for (const f of files) {
    pending.push(f);
    if (pending.length >= BATCH) {
      total += await flush(pending, fileCount);
      fileCount += pending.length;
      pending = [];
    }
  }
  if (pending.length > 0) {
    total += await flush(pending, fileCount);
  }

  return total;
}

// --- Congress Press ---

async function runPressETL(db: DB): Promise<number> {
  const files = (await glob(`${dataDir}/congress_press/**/*.jsonl`)).sort();

  let total = 0;
  for (const filePath of files) {
    if (await alreadyDone(db, filePath)) {
      log(`  skip (done) ${filePath}`);
      continue;
    }
    log(`  press ${filePath}`);
    await markFileStart(db, filePath, 'congress_press');

    try {
      let rows = 0;
      await db.transaction(async (tx) => {
        rows = await ingestPressFile(filePath, async (batch: NewDbRecord[]) => {
          await insertRecords(tx, batch);
        });
        await markFileDone(tx, filePath, rows);
      });
      log(`    → ${rows} records`);
      total += rows;
    } catch (err) {
      log(`    ERROR: ${err}`);
      await markFileError(db, filePath);
    }
  }
  return total;
}

// --- Main ---

async function main() {
  if (!existsSync(dataDir)) {
    log(`ERROR: data directory not found: ${dataDir}`);
    process.exit(1);
  }

  setDataDir(dataDir);

  log(`Connecting to Postgres (${databaseUrl})`);
  const { db, close } = openDB();
  const runResult = await db
    .insert(agentRuns)
    .values({
      skillName: 'legislative-etl',
      inputsHash: `${dataDir}::${databaseUrl}`,
      status: 'running',
    })
    .returning({ id: agentRuns.id });
  const runId = runResult[0]?.id;
  if (runId == null) {
    throw new Error('Failed to create agent run record');
  }

  const pipelineStart = performance.now();

  log('=== Phase 1: Senate JSON ===');
  const senateStart = performance.now();
  const senateRows = await runSenateETL(db);
  perfLog('Senate', performance.now() - senateStart, senateRows);
  log(`Senate total: ${senateRows}`);

  log('=== Phase 2: House XML ===');
  const houseStart = performance.now();
  const houseRows = await runHouseETL(db);
  perfLog('House', performance.now() - houseStart, houseRows);
  log(`House total: ${houseRows}`);

  log('=== Phase 3: Congress Press ===');
  const pressStart = performance.now();
  const pressRows = await runPressETL(db);
  perfLog('Press', performance.now() - pressStart, pressRows);
  log(`Press total: ${pressRows}`);

  const total = senateRows + houseRows + pressRows;
  const elapsed = performance.now() - pipelineStart;
  log(`=== ETL complete: ${total} records total ===`);
  perfLog('Total pipeline', elapsed, total);

  await db
    .update(agentRuns)
    .set({ status: 'done', finishedAt: sql`now()` })
    .where(eq(agentRuns.id, runId));

  const counts = await db
    .select({ source: records.source, n: sql<number>`count(*)` })
    .from(records)
    .groupBy(records.source)
    .orderBy(records.source);

  log('Record counts by source:');
  for (const row of counts) log(`  ${row.source}: ${row.n}`);

  close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
