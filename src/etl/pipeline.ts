import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { glob } from 'glob';
import { openDB, type DB } from '../db/setup.js';
import { agentRuns, etlRuns, records } from '../db/schema.js';
import { makeUpsert } from './upsert.js';
import { ingestJsonFile } from './ingest-json.js';
import { ingestXmlFile } from './ingest-xml.js';
import { ingestPressFile } from './ingest-press.js';
import type { LegislativeRecord } from '../types.js';

// --- CLI args ---
const args = process.argv.slice(2);
function getArg(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1]! : fallback;
}
const dataDir = resolve(getArg('--data-dir', './data'));
const dbPath  = resolve(getArg('--db', './investigation.db'));

function log(msg: string) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
}

// --- Resumability helpers ---

function alreadyDone(db: DB, filePath: string): boolean {
  const row = db.select({ status: etlRuns.status })
    .from(etlRuns)
    .where(eq(etlRuns.filePath, filePath))
    .get();
  return row?.status === 'done';
}

function markFileStart(db: DB, filePath: string, source: string) {
  db.insert(etlRuns)
    .values({ filePath, source, rowsWritten: 0, status: 'running' })
    .onConflictDoUpdate({
      target: etlRuns.filePath,
      set: { rowsWritten: 0, startedAt: sql`(datetime('now'))`, status: 'running' },
    })
    .run();
}

function markFileDone(db: DB, filePath: string, rowsWritten: number) {
  db.update(etlRuns)
    .set({ rowsWritten, finishedAt: sql`(datetime('now'))`, status: 'done' })
    .where(eq(etlRuns.filePath, filePath))
    .run();
}

function markFileError(db: DB, filePath: string) {
  db.update(etlRuns)
    .set({ status: 'error', finishedAt: sql`(datetime('now'))` })
    .where(eq(etlRuns.filePath, filePath))
    .run();
}

// --- Senate JSON ---

async function runSenateETL(db: DB): Promise<number> {
  const upsert = makeUpsert(db);
  const files = [
    ...(await glob(`${dataDir}/senate/*/filings/filings_*.json`)),
    ...(await glob(`${dataDir}/senate/*/contributions/contributions_*.json`)),
  ].sort();

  let total = 0;
  for (const filePath of files) {
    if (alreadyDone(db, filePath)) { log(`  skip (done) ${filePath}`); continue; }
    log(`  senate ${filePath}`);
    markFileStart(db, filePath, 'senate');

    try {
      const rows = await ingestJsonFile(filePath, (batch: LegislativeRecord[]) => { upsert(batch); });
      markFileDone(db, filePath, rows);
      log(`    → ${rows} records`);
      total += rows;
    } catch (err) {
      log(`    ERROR: ${err}`);
      markFileError(db, filePath);
    }
  }
  return total;
}

// --- House XML ---

async function runHouseETL(db: DB): Promise<number> {
  const upsert = makeUpsert(db);
  const files  = (await glob(`${dataDir}/house/**/*.xml`)).sort();
  const BATCH  = 1000;

  let total     = 0;
  let fileCount = 0;
  let pending:  string[] = [];

  const flush = async (chunk: string[], startIdx: number) => {
    const key = `house:batch:${startIdx}`;
    if (alreadyDone(db, key)) { log(`  skip (done) house batch ${startIdx}`); return 0; }
    markFileStart(db, key, 'house');

    const batch: LegislativeRecord[] = [];
    let errors = 0;
    for (const f of chunk) {
      try { batch.push(...ingestXmlFile(f)); }
      catch { errors++; }
    }

    const inserted = upsert(batch);
    markFileDone(db, key, inserted);
    log(`  house files ${startIdx}–${startIdx + chunk.length - 1}: ${inserted} records (${errors} parse errors)`);
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
  const upsert = makeUpsert(db);
  const files  = (await glob(`${dataDir}/congress_press/*.jsonl`)).sort();

  let total = 0;
  for (const filePath of files) {
    if (alreadyDone(db, filePath)) { log(`  skip (done) ${filePath}`); continue; }
    log(`  press ${filePath}`);
    markFileStart(db, filePath, 'congress_press');

    try {
      const rows = await ingestPressFile(filePath, (batch: LegislativeRecord[]) => { upsert(batch); });
      markFileDone(db, filePath, rows);
      log(`    → ${rows} records`);
      total += rows;
    } catch (err) {
      log(`    ERROR: ${err}`);
      markFileError(db, filePath);
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
  const { db, close } = openDB(dbPath);

  const runId = db.insert(agentRuns)
    .values({ skillName: 'legislative-etl', inputsHash: `${dataDir}::${dbPath}`, status: 'running' })
    .run().lastInsertRowid;

  log('=== Phase 1: Senate JSON ===');
  const senateRows = await runSenateETL(db);
  log(`Senate total: ${senateRows}`);

  log('=== Phase 2: House XML ===');
  const houseRows = await runHouseETL(db);
  log(`House total: ${houseRows}`);

  log('=== Phase 3: Congress Press ===');
  const pressRows = await runPressETL(db);
  log(`Press total: ${pressRows}`);

  const total = senateRows + houseRows + pressRows;
  log(`=== ETL complete: ${total} records total ===`);

  db.update(agentRuns)
    .set({ status: 'done', finishedAt: sql`(datetime('now'))` })
    .where(eq(agentRuns.id, Number(runId)))
    .run();

  const counts = db
    .select({ source: records.source, n: sql<number>`count(*)` })
    .from(records)
    .groupBy(records.source)
    .orderBy(records.source)
    .all();

  log('Record counts by source:');
  for (const row of counts) log(`  ${row.source}: ${row.n}`);

  close();
}

main().catch(err => { console.error(err); process.exit(1); });
