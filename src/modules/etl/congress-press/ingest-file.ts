import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { DbOrTx } from './db.js';
import {
  loadCongressPress,
  type NewLoadCongressPress,
} from '../../../db/schema.js';
import type { EtlLog } from './etl-log.js';
import {
  getOrCreateLoadMember,
  type MemberCache,
  type PartyLookup,
} from './resolve-member.js';
import {
  detectUnknownKeys,
  parseCongressPressRow,
} from './types.js';

const BATCH_SIZE = 200;

export type IngestFileResult = {
  rowsInserted: number;
  rowsParsed: number;
};

async function insertPressBatch(
  db: DbOrTx,
  batch: NewLoadCongressPress[],
): Promise<number> {
  if (batch.length === 0) return 0;

  const result = await db
    .insert(loadCongressPress)
    .values(batch)
    .onConflictDoNothing({ target: loadCongressPress.url });

  return result.rowCount ?? 0;
}

export async function ingestCongressPressFile(
  memberDb: DbOrTx,
  pressDb: DbOrTx,
  filePath: string,
  partyLookup: PartyLookup,
  memberCache: MemberCache,
  log: EtlLog,
): Promise<IngestFileResult> {
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let rowsParsed = 0;
  let rowsInserted = 0;
  let batch: NewLoadCongressPress[] = [];

  for await (const line of rl) {
    lineNum += 1;
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      log.recordSkipped(filePath, lineNum, 'invalid JSON');
      continue;
    }

    for (const key of detectUnknownKeys(obj)) {
      log.recordUnknownKey(key);
    }

    const { row, missingFields } = parseCongressPressRow(obj);
    if (!row) {
      log.recordSkipped(
        filePath,
        lineNum,
        `missing required fields: ${missingFields.join(', ')}`,
      );
      continue;
    }

    rowsParsed += 1;

    if (!row.collectedAt) {
      log.recordMissingOrDefaulted(
        'collected_at',
        'not in source or invalid, using DB default',
      );
    }
    if (!row.updatedAt) {
      log.recordMissingOrDefaulted(
        'updated_at',
        'not in source or invalid, using DB default',
      );
    }

    const memberId = await getOrCreateLoadMember(
      memberDb,
      row.member,
      partyLookup,
      memberCache,
      log,
    );

    const pressRow: NewLoadCongressPress = {
      url: row.url,
      title: row.title,
      date: row.date,
      dateSource: row.dateSource,
      source: row.source,
      domain: row.domain,
      scraper: row.scraper,
      text: row.text,
      memberId,
      ...(row.collectedAt ? { collectedAt: row.collectedAt } : {}),
      ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}),
    };

    batch.push(pressRow);

    if (batch.length >= BATCH_SIZE) {
      rowsInserted += await insertPressBatch(pressDb, batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    rowsInserted += await insertPressBatch(pressDb, batch);
  }

  log.rowsInserted += rowsInserted;
  return { rowsInserted, rowsParsed };
}
