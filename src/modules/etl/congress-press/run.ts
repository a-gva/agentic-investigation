import { glob } from 'glob';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../db/index.js';
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
  onFileLog?: (msg: string) => void;
};

export async function runCongressPressETL(
  db: DB,
  options: RunCongressPressOptions,
): Promise<{ rowsInserted: number; etlLog: EtlLog }> {
  const { dataDir, logPath = DEFAULT_LOG_PATH } = options;
  const globDataDir = resolve(dataDir);
  setDataDir(globDataDir);
  const etlLog = new EtlLog();

  const files = (await glob(`${globDataDir}/congress_press/**/*.jsonl`)).sort();
  const donePaths = await loadDonePaths(db, 'congress_press');
  const pending = files.filter((f) => !donePaths.has(toEtlFilePath(f)));
  etlLog.filesSkippedDone = files.length - pending.length;

  const partyLookup = await loadPartyLookup(db);
  const memberCache: MemberCache = new Set();

  await runWithConcurrency(
    pending,
    PARALLEL.pressFiles,
    async (filePath) => {
      const fileLog = new EtlLog();
      try {
        let rowsParsed = 0;
        await db.transaction(async (tx) => {
          const result = await ingestCongressPressFile(
            db,
            tx,
            filePath,
            partyLookup,
            memberCache,
            fileLog,
          );
          rowsParsed = result.rowsParsed;
          await markFileDone(tx, filePath, rowsParsed, 'congress_press');
        });
        fileLog.filesProcessed = 1;
        etlLog.merge(fileLog);
        return rowsParsed;
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
