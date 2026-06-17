import { eq } from 'drizzle-orm';
import { glob } from 'glob';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../db/index.js';
import { etlRuns } from '../../../db/schema.js';
import { runWithConcurrency } from '../concurrency.js';
import {
  loadDonePaths,
  markFileDone,
  markFilesErrorBulk,
} from '../etl-runs.js';
import { setDataDir, toEtlFilePath } from '../etl-file-path.js';
import { PARALLEL } from '../parallel.js';
import { EtlLog } from './etl-log.js';
import { formatEtlFileError } from './errors.js';
import { ingestCongressPressFile } from './ingest-file.js';
import {
  loadCongressTypeLookup,
  loadPartyLookup,
  type MemberCache,
} from './resolve-member.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LOG_PATH = resolve(MODULE_DIR, 'log.txt');

function logError(filePath: string, err: unknown) {
  process.stderr.write(
    `[${new Date().toISOString().slice(11, 19)}] ERROR ${formatEtlFileError(filePath, err)}\n`,
  );
}

export type RunCongressPressOptions = {
  dataDir: string;
  logPath?: string;
  force?: boolean;
  onFileLog?: (msg: string) => void;
};

export async function runCongressPressETL(
  db: DB,
  options: RunCongressPressOptions,
): Promise<{ rowsInserted: number; etlLog: EtlLog }> {
  const { dataDir, logPath = DEFAULT_LOG_PATH, force = false, onFileLog } =
    options;
  const globDataDir = resolve(dataDir);
  setDataDir(globDataDir);
  const etlLog = new EtlLog();

  if (force) {
    await db.delete(etlRuns).where(eq(etlRuns.source, 'congress_press'));
    onFileLog?.('cleared congress_press etl_runs (--force)');
  }

  const files = (await glob(`${globDataDir}/congress_press/**/*.jsonl`)).sort();
  const donePaths = await loadDonePaths(db, 'congress_press');
  const pending = files.filter((f) => !donePaths.has(toEtlFilePath(f)));
  etlLog.filesSkippedDone = files.length - pending.length;

  onFileLog?.(
    `found ${files.length} files, ${pending.length} pending, ${etlLog.filesSkippedDone} skipped`,
  );

  const partyLookup = await loadPartyLookup(db);
  const congressTypeLookup = await loadCongressTypeLookup(db);
  const memberCache: MemberCache = new Map();

  await runWithConcurrency(
    pending,
    PARALLEL.pressFiles,
    async (filePath) => {
      const label = basename(filePath);
      onFileLog?.(`processing ${label}`);
      const fileLog = new EtlLog();
      try {
        let rowsInserted = 0;
        await db.transaction(async (tx) => {
          const result = await ingestCongressPressFile(
            db,
            tx,
            filePath,
            partyLookup,
            congressTypeLookup,
            memberCache,
            fileLog,
          );
          rowsInserted = result.rowsInserted;
          await markFileDone(tx, filePath, rowsInserted, 'congress_press');
        });
        onFileLog?.(`  ${label} → ${rowsInserted} rows inserted`);
        fileLog.filesProcessed = 1;
        etlLog.merge(fileLog);
        return rowsInserted;
      } catch (err) {
        logError(filePath, err);
        etlLog.filesErrored += 1;
        await markFilesErrorBulk(db, 'congress_press', [filePath]);
        return 0;
      }
    },
  );

  etlLog.writeTo(logPath);

  return {
    rowsInserted: etlLog.rowsInserted,
    etlLog,
  };
}
