import { createReadStream } from 'node:fs';
import chain from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/stream-array.js';
import type { LegislativeRecord } from '../types.js';
import { normalizeFiling, normalizeContribution } from './normalize-senate.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isContributionReport(obj: any): boolean {
  return 'lobbyist' in obj || 'contribution_items' in obj || 'filer_type' in obj;
}

export async function ingestJsonFile(
  filePath: string,
  onBatch: (records: LegislativeRecord[]) => void,
  batchSize = 200
): Promise<number> {
  const isContributions = filePath.toLowerCase().includes('contribution');

  const pipeline = chain([
    createReadStream(filePath),
    parser(),
    streamArray(),
  ]);

  let total = 0;
  let batch: LegislativeRecord[] = [];

  for await (const { value } of pipeline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = value as any;

    const records: LegislativeRecord[] =
      isContributions || isContributionReport(obj)
        ? normalizeContribution(obj)
        : normalizeFiling(obj);

    batch.push(...records);
    if (batch.length >= batchSize) {
      onBatch(batch);
      total += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    onBatch(batch);
    total += batch.length;
  }

  return total;
}
