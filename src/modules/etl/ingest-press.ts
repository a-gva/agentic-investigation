import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { NewDbRecord } from '../../db/schema.js';

function hash(...parts: (string | null | undefined)[]): string {
  return createHash('sha256')
    .update(parts.map((p) => p ?? '').join('\x00'))
    .digest('hex')
    .slice(0, 32);
}

export async function ingestPressFile(
  filePath: string,
  onBatch: (records: NewDbRecord[]) => void | Promise<void>,
  batchSize = 200,
): Promise<number> {
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let total = 0;
  let batch: NewDbRecord[] = [];

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = (obj.member ?? {}) as any;
    const url = String(obj.url ?? '');
    const title = String(obj.title ?? '');
    const text = String(obj.text ?? '');
    const date = String(obj.date ?? '').slice(0, 10) || null;

    const description = text
      ? `${title}\n\n${text.slice(0, 500)}${text.length > 500 ? '…' : ''}`
      : title || null;

    batch.push({
      source: 'congress_press',
      subSource: 'press',
      recordType: member.chamber ?? null,
      date,
      fiscalYear: date ? Number(date.slice(0, 4)) || null : null,
      entityName: member.name ?? null,
      entityType: 'member',
      entityState: member.state ?? null,
      counterparty: null,
      amountCents: null,
      description,
      tags: JSON.stringify([member.party, member.chamber].filter(Boolean)),
      rawHash: hash('press', url),
      metadata: JSON.stringify({
        url,
        bioguide_id: member.bioguide_id ?? null,
        party: member.party ?? null,
        chamber: member.chamber ?? null,
        source_domain: obj.domain ?? null,
        date_source: obj.date_source ?? null,
      }),
    });

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
