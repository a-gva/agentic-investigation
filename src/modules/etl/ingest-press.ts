import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { NewDbRecord } from '../../db/schema.js';
import {
  cents,
  dateStr,
  fiscalYear as coerceFiscalYear,
  meta,
  str,
  tags,
} from './coerce.js';
import { toEtlFilePath } from './etl-file-path.js';

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
  const etlPath = toEtlFilePath(filePath);
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
      recordType: str(member.chamber),
      date: dateStr(date),
      fiscalYear: coerceFiscalYear(date),
      entityName: str(member.name),
      entityType: 'member',
      entityState: str(member.state),
      counterparty: '',
      amountCents: cents(null),
      description: str(description),
      tags: tags(member.party, member.chamber),
      rawHash: hash('press', url),
      filePath: etlPath,
      metadata: meta({
        url,
        title: title || null,
        text: text || null,
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
