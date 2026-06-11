import { eq, sql } from 'drizzle-orm';
import { glob } from 'glob';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDB, type DB } from '../../db/index.js';
import type { NewDbRecord } from '../../db/schema.js';
import { agentRuns, etlRuns, records } from '../../db/schema.js';
import { ingestJsonFile } from './ingest-json.js';
import { ingestPressFile } from './ingest-press.js';
import { ingestXmlFile } from './ingest-xml.js';
import { insertRecords } from './insert-records.js';

// --- CLI args ---
const args = process.argv.slice(2);
function getArg(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1]! : fallback;
}
const dataDir = resolve(getArg('--data-dir', './data'));
const dbPath = resolve(getArg('--db', './investigation.db'));

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
  const [row] = await db
    .select({ status: etlRuns.status })
    .from(etlRuns)
    .where(eq(etlRuns.filePath, filePath))
    .limit(1);
  return row?.status === 'done';
}

async function markFileStart(db: DB, filePath: string, source: string) {
  await db
    .insert(etlRuns)
    .values({ filePath, source, rowsWritten: 0, status: 'running' })
    .onConflictDoUpdate({
      target: etlRuns.filePath,
      set: {
        rowsWritten: 0,
        startedAt: sql`now()`,
        status: 'running',
      },
    });
}

async function markFileDone(db: DB, filePath: string, rowsWritten: number) {
  await db
    .update(etlRuns)
    .set({ rowsWritten, finishedAt: sql`now()`, status: 'done' })
    .where(eq(etlRuns.filePath, filePath));
}

async function markFileError(db: DB, filePath: string) {
  await db
    .update(etlRuns)
    .set({ status: 'error', finishedAt: sql`now()` })
    .where(eq(etlRuns.filePath, filePath));
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
      });
      await markFileDone(db, filePath, rows);
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

  let total = 0;
  let fileCount = 0;
  let pending: string[] = [];

  const flush = async (chunk: string[], startIdx: number) => {
    const key = `house:batch:${startIdx}`;
    if (await alreadyDone(db, key)) {
      log(`  skip (done) house batch ${startIdx}`);
      return 0;
    }
    await markFileStart(db, key, 'house');

    const batch: NewDbRecord[] = [];
    let errors = 0;
    for (const f of chunk) {
      try {
        batch.push(...ingestXmlFile(f));
      } catch {
        errors++;
      }
    }

    let inserted = 0;
    await db.transaction(async (tx) => {
      inserted = await insertRecords(tx, batch);
    });
    await markFileDone(db, key, inserted);
    log(
      `  house files ${startIdx}–${startIdx + chunk.length - 1}: ${inserted} records (${errors} parse errors)`,
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
  const files = (await glob(`${dataDir}/congress_press/*.jsonl`)).sort();

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
      });
      await markFileDone(db, filePath, rows);
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

  log(`Opening database at ${dbPath}`);
  const { db, close } = openDB();
  const runResult = await db
    .insert(agentRuns)
    .values({
      skillName: 'legislative-etl',
      inputsHash: `${dataDir}::${dbPath}`,
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
