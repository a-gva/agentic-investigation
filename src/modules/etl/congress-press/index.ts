import { eq, sql } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openPool, tuneLoadSession } from '../../../db/index.js';
import { env } from '../../env/index.js';
import { agentRuns } from '../../../db/schema.js';
import { PARALLEL } from '../parallel.js';
import { setDataDir } from '../etl-file-path.js';
import { DEFAULT_LOG_PATH, runCongressPressETL } from './run.js';

export { EtlLog } from './etl-log.js';
export { DEFAULT_LOG_PATH, runCongressPressETL } from './run.js';
export {
  detectUnknownKeys,
  parseCongressPressRow,
  resolvePartyName,
} from './types.js';

const args = process.argv.slice(2);

function getArg(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1]! : fallback;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

function log(msg: string) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
}

function logError(msg: string) {
  process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ERROR: ${msg}\n`);
}

async function main() {
  const dataDir = resolve(getArg('--data-dir', './data'));
  const logPath = resolve(getArg('--log-file', DEFAULT_LOG_PATH));
  const force = hasFlag('--force');

  if (!existsSync(dataDir)) {
    logError(`data directory not found: ${dataDir}`);
    process.exit(1);
  }

  setDataDir(dataDir);

  const poolSize = PARALLEL.pressFiles + 2;
  log(`Connecting to Postgres (pool=${poolSize})`);
  const { db, close } = openPool(poolSize);

  let runId: number | undefined;
  try {
    await tuneLoadSession(db);

    const runResult = await db
      .insert(agentRuns)
      .values({
        skillName: 'congress-press-etl',
        inputsHash: `${dataDir}::${env.DATABASE_URL}${force ? '::force' : ''}`,
        outputPath: logPath,
        status: 'running',
      })
      .returning({ id: agentRuns.id });
    runId = runResult[0]?.id;

    const started = performance.now();
    log(`Congress Press ETL starting (force=${force})`);

    const { rowsInserted, etlLog } = await runCongressPressETL(db, {
      dataDir,
      logPath,
      force,
      onFileLog: log,
    });

    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    const parts = [
      `${etlLog.filesProcessed} files processed`,
      `${rowsInserted.toLocaleString()} rows inserted`,
    ];
    if (etlLog.filesSkippedDone > 0) {
      parts.push(`${etlLog.filesSkippedDone} skipped (already done)`);
    }
    if (etlLog.filesErrored > 0) {
      parts.push(`${etlLog.filesErrored} errored`);
    }
    log(`Congress Press ETL done in ${seconds}s — ${parts.join(', ')} → ${logPath}`);

    if (runId != null) {
      await db
        .update(agentRuns)
        .set({
          status: etlLog.filesErrored > 0 ? 'error' : 'done',
          finishedAt: sql`now()`,
        })
        .where(eq(agentRuns.id, runId));
    }

    if (etlLog.filesErrored > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    if (runId != null) {
      await db
        .update(agentRuns)
        .set({ status: 'error', finishedAt: sql`now()` })
        .where(eq(agentRuns.id, runId));
    }
    throw err;
  } finally {
    await close();
  }
}

if (import.meta.main) {
  main().catch((err) => {
    logError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
