import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openPool, tuneLoadSession } from '../../../db/index.js';
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

function logError(msg: string) {
  process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ERROR: ${msg}\n`);
}

async function main() {
  const dataDir = resolve(getArg('--data-dir', './data'));
  const logPath = resolve(getArg('--log-file', DEFAULT_LOG_PATH));

  if (!existsSync(dataDir)) {
    logError(`data directory not found: ${dataDir}`);
    process.exit(1);
  }

  setDataDir(dataDir);

  const { db, close } = openPool(3);
  await tuneLoadSession(db);

  try {
    await runCongressPressETL(db, {
      dataDir,
      logPath,
    });
  } finally {
    await close();
  }
}

if (import.meta.main) {
  void main();
}
