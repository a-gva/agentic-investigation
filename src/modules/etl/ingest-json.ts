import { createReadStream } from 'node:fs';
import chain from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/stream-array.js';
import type { NewRecord } from '../../db/schema.js';
import { normalizeContribution, normalizeFiling } from './normalize-senate.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isContributionReport(obj: any): boolean {
  return (
    'lobbyist' in obj || 'contribution_items' in obj || 'filer_type' in obj
  );
}

export async function ingestJsonFile(
  filePath: string,
  onBatch: (records: NewRecord[]) => void | Promise<void>,
  batchSize = 200,
): Promise<number> {
  const isContributions = filePath.toLowerCase().includes('contribution');

  const pipeline = chain([createReadStream(filePath), parser(), streamArray()]);

  let total = 0;
  let batch: NewRecord[] = [];

  for await (const { value } of pipeline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = value as any;

    const records: NewRecord[] =
      isContributions || isContributionReport(obj)
        ? normalizeContribution(obj)
        : normalizeFiling(obj);

    batch.push(...records);
    if (batch.length >= batchSize) {
      await onBatch(batch);
      total += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await onBatch(batch);
    total += batch.length;
  }

  return total;
}
