import type { DB } from '../../../db/index.js';

export type DbOrTx = DB | Parameters<Parameters<DB['transaction']>[0]>[0];
