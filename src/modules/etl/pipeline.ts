import { eq, sql } from 'drizzle-orm';
import { glob } from 'glob';
import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { openPool, tuneLoadSession, type DB } from '../../db/index.js';
import { env } from '../env/index.js';
import type { NewDbRecord } from '../../db/schema.js';
import { agentRuns, records } from '../../db/schema.js';
import { runWithConcurrency } from './concurrency.js';
import {
  loadDonePaths,
  markFileDone,
  markFilesDoneBulk,
  markFilesErrorBulk,
} from './etl-runs.js';
import { setDataDir, toEtlFilePath } from './etl-file-path.js';
import { ingestJsonFile } from './ingest-json.js';
import { runCongressPressETL } from './congress-press/run.js';
import { insertRecords } from './insert-records.js';
import { PARALLEL } from './parallel.js';
import { XmlParsePool } from './workers/xml-parse-pool.js';

// --- CLI args ---
type EtlSource = 'senate' | 'house' | 'congress_press';

const args = process.argv.slice(2);
function getArg(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1]! : fallback;
}

const SOURCE_ALIASES: Record<string, EtlSource> = {
  senate: 'senate',
  house: 'house',
  press: 'congress_press',
  congress_press: 'congress_press',
};

function log(msg: string) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
}

function resolveCorpusRoot(dir: string): {
  dataDir: string;
  implicitSource?: EtlSource;
} {
  const resolved = resolve(dir);
  const name = basename(resolved).toLowerCase();
  if (name === 'senate' || name === 'house') {
    return { dataDir: dirname(resolved), implicitSource: name };
  }
  if (name === 'congress_press') {
    return { dataDir: dirname(resolved), implicitSource: 'congress_press' };
  }
  return { dataDir: resolved };
}

function parseSources(
  explicit: string,
  implicit?: EtlSource,
): Set<EtlSource> | 'all' {
  const raw = explicit.trim().toLowerCase();
  if (raw === 'all' || raw === '') {
    return implicit != null ? new Set([implicit]) : 'all';
  }

  const sources = new Set<EtlSource>();
  for (const part of raw.split(',')) {
    const key = part.trim().toLowerCase();
    const mapped = SOURCE_ALIASES[key];
    if (!mapped) {
      log(
        `ERROR: unknown --source "${part}". Use senate, house, press, all, or comma-separated`,
      );
      process.exit(1);
    }
    sources.add(mapped);
  }
  return sources;
}

const { dataDir, implicitSource } = resolveCorpusRoot(
  getArg('--data-dir', './data'),
);
// Glob requires forward slashes. On Windows, path.resolve() returns backslash-
// separated paths; replace only on win32 so legitimate backslashes in POSIX
// filenames (unusual but valid) are never corrupted on macOS/Linux.
const globDataDir =
  process.platform === 'win32' ? dataDir.replace(/\\/g, '/') : dataDir;
const sourcesFilter = parseSources(getArg('--source', 'all'), implicitSource);
const workersArg = Number(getArg('--workers', String(PARALLEL.houseWorkers)));
const houseWorkers = Math.min(
  PARALLEL.houseWorkers,
  Math.max(
    1,
    Number.isFinite(workersArg) ? workersArg : PARALLEL.houseWorkers,
  ),
);
const databaseUrl = env.DATABASE_URL;

function shouldRun(source: EtlSource): boolean {
  return sourcesFilter === 'all' || sourcesFilter.has(source);
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

// --- Senate JSON ---

async function runSenateETL(db: DB): Promise<number> {
  const files = [
    ...(await glob(`${globDataDir}/senate/*/filings/filings_*.json`)),
    ...(await glob(`${globDataDir}/senate/*/contributions/contributions_*.json`)),
  ].sort();

  const donePaths = await loadDonePaths(db, 'senate');
  const pending = files.filter((f) => !donePaths.has(toEtlFilePath(f)));
  if (pending.length < files.length) {
    log(`  skip (done) ${files.length - pending.length} senate files`);
  }

  const counts = await runWithConcurrency(
    pending,
    PARALLEL.senateFiles,
    async (filePath) => {
      log(`  senate ${filePath}`);
      const fileStart = performance.now();
      try {
        let rows = 0;
        await db.transaction(async (tx) => {
          rows = await ingestJsonFile(
            filePath,
            async (batch: NewDbRecord[]) => {
              await insertRecords(tx, batch);
            },
            PARALLEL.senateBatchSize,
          );
          await markFileDone(tx, filePath, rows, 'senate');
        });
        log(
          `    → ${rows} records (wall=${formatDuration(performance.now() - fileStart)})`,
        );
        return rows;
      } catch (err) {
        log(`    ERROR: ${err}`);
        await markFilesErrorBulk(db, 'senate', [filePath]);
        return 0;
      }
    },
  );

  return counts.reduce((sum, n) => sum + n, 0);
}

// --- House XML ---

type ParsedHouseFile = { filePath: string; rows: NewDbRecord[] };

async function runHouseETL(db: DB, xmlPool: XmlParsePool): Promise<number> {
  const files = (await glob(`${globDataDir}/house/**/*.xml`)).sort();
  const donePaths = await loadDonePaths(db, 'house');
  const BATCH = PARALLEL.houseBatchSize;

  let total = 0;
  let fileCount = 0;
  let pending: string[] = [];

  const flush = async (chunk: string[], startIdx: number) => {
    const batchId = `house:${startIdx}-${startIdx + chunk.length - 1}`;
    const todo = chunk.filter((p) => !donePaths.has(toEtlFilePath(p)));
    const skipped = chunk.length - todo.length;

    if (todo.length === 0) {
      if (skipped > 0) log(`  skip (done) ${skipped} house files`);
      return 0;
    }

    const parseStart = performance.now();
    const results = await xmlPool.parseAll(todo, dataDir);
    const parsed: ParsedHouseFile[] = [];
    const errors: string[] = [];
    for (const r of results) {
      if (r.error) {
        log(`    ERROR parsing ${r.filePath}: ${r.error}`);
        errors.push(r.filePath);
      } else {
        parsed.push({ filePath: r.filePath, rows: r.rows });
      }
    }
    const parseMs = performance.now() - parseStart;

    if (errors.length > 0) {
      await markFilesErrorBulk(db, 'house', errors);
    }
    if (parsed.length === 0) return 0;

    const batch = parsed.flatMap(({ rows }) => rows);
    const insertStart = performance.now();
    let inserted = 0;
    await db.transaction(async (tx) => {
      inserted = await insertRecords(tx, batch);
      await markFilesDoneBulk(
        tx,
        'house',
        parsed.map(({ filePath, rows }) => ({
          filePath,
          rowsWritten: rows.length,
          batch: batchId,
        })),
      );
      for (const { filePath } of parsed) {
        donePaths.add(toEtlFilePath(filePath));
      }
    });
    const insertMs = performance.now() - insertStart;

    log(
      `  house batch ${batchId}: ${parsed.length} files, ${inserted} records` +
        ` (${skipped} skipped, ${errors.length} parse errors)` +
        ` parse=${formatDuration(parseMs)} insert=${formatDuration(insertMs)}`,
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
  const { rowsInserted } = await runCongressPressETL(db, { dataDir });
  return rowsInserted;
}

// --- Main ---

async function main() {
  if (!existsSync(dataDir)) {
    log(`ERROR: data directory not found: ${dataDir}`);
    process.exit(1);
  }

  setDataDir(dataDir);

  log(`Connecting to Postgres (${databaseUrl})`);
  const { db, close } = openPool(3);
  await tuneLoadSession(db);

  const sourceLabel =
    sourcesFilter === 'all'
      ? 'all'
      : [...sourcesFilter].sort().join(',');
  log(`Sources: ${sourceLabel} | house workers: ${houseWorkers}`);

  const runResult = await db
    .insert(agentRuns)
    .values({
      skillName: 'legislative-etl',
      inputsHash: `${dataDir}::${sourceLabel}::${databaseUrl}`,
      status: 'running',
    })
    .returning({ id: agentRuns.id });
  const runId = runResult[0]?.id;
  if (runId == null) {
    throw new Error('Failed to create agent run record');
  }

  const pipelineStart = performance.now();
  const xmlPool = shouldRun('house') ? new XmlParsePool(houseWorkers) : null;

  try {
    const phaseResults = await Promise.all([
      shouldRun('senate')
        ? (async () => {
            log('=== Senate JSON ===');
            const start = performance.now();
            const rows = await runSenateETL(db);
            perfLog('Senate', performance.now() - start, rows);
            log(`Senate total: ${rows}`);
            return rows;
          })()
        : Promise.resolve(0),
      shouldRun('house')
        ? (async () => {
            log('=== House XML ===');
            const start = performance.now();
            const rows = await runHouseETL(db, xmlPool!);
            perfLog('House', performance.now() - start, rows);
            log(`House total: ${rows}`);
            return rows;
          })()
        : Promise.resolve(0),
      shouldRun('congress_press')
        ? (async () => {
            log('=== Congress Press ===');
            const start = performance.now();
            const rows = await runPressETL(db);
            perfLog('Press', performance.now() - start, rows);
            log(`Press total: ${rows}`);
            return rows;
          })()
        : Promise.resolve(0),
    ]);

    const [senateRows, houseRows, pressRows] = phaseResults;
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
  } finally {
    await xmlPool?.close();
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
