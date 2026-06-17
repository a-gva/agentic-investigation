import { writeFileSync } from 'node:fs';

type TallyMap = Map<string, number>;

function inc(map: TallyMap, key: string, n = 1) {
  map.set(key, (map.get(key) ?? 0) + n);
}

export type SkippedRecord = {
  file: string;
  line: number;
  reason: string;
};

export class EtlLog {
  filesProcessed = 0;
  filesSkippedDone = 0;
  filesErrored = 0;
  rowsInserted = 0;
  rowsSkipped = 0;
  membersCreated = 0;

  private missingOrDefaulted = new Map<string, number>();
  private unmappedValues = new Map<string, number>();
  private unknownKeys = new Map<string, number>();
  private skippedRecords: SkippedRecord[] = [];

  recordMissingOrDefaulted(field: string, note?: string) {
    const key = note ? `${field}: ${note}` : field;
    inc(this.missingOrDefaulted, key);
  }

  recordUnmappedValue(field: string, value: string) {
    inc(this.unmappedValues, `${field}=${JSON.stringify(value)}`);
  }

  recordUnknownKey(key: string) {
    inc(this.unknownKeys, key);
  }

  recordSkipped(file: string, line: number, reason: string) {
    this.rowsSkipped += 1;
    this.skippedRecords.push({ file, line, reason });
  }

  merge(other: EtlLog) {
    this.filesProcessed += other.filesProcessed;
    this.filesSkippedDone += other.filesSkippedDone;
    this.filesErrored += other.filesErrored;
    this.rowsInserted += other.rowsInserted;
    this.rowsSkipped += other.rowsSkipped;
    this.membersCreated += other.membersCreated;

    for (const [k, v] of other.missingOrDefaulted) {
      inc(this.missingOrDefaulted, k, v);
    }
    for (const [k, v] of other.unmappedValues) {
      inc(this.unmappedValues, k, v);
    }
    for (const [k, v] of other.unknownKeys) {
      inc(this.unknownKeys, k, v);
    }
    this.skippedRecords.push(...other.skippedRecords);
  }

  format(): string {
    const lines: string[] = [];
    const ts = new Date().toISOString();

    lines.push(`Congress Press ETL — ${ts}`);
    lines.push('');
    lines.push('=== Summary ===');
    lines.push(`Files processed: ${this.filesProcessed}`);
    lines.push(`Files skipped (already done): ${this.filesSkippedDone}`);
    lines.push(`Files errored: ${this.filesErrored}`);
    lines.push(`Rows inserted: ${this.rowsInserted}`);
    lines.push(`Rows skipped: ${this.rowsSkipped}`);
    lines.push(`Members created: ${this.membersCreated}`);
    lines.push('');

    lines.push('=== Missing or defaulted fields ===');
    if (this.missingOrDefaulted.size === 0) {
      lines.push('(none)');
    } else {
      for (const [field, count] of [...this.missingOrDefaulted.entries()].sort()) {
        lines.push(`${field} (${count} occurrences)`);
      }
    }
    lines.push('');

    lines.push('=== Unmapped / skipped values ===');
    if (this.unmappedValues.size === 0 && this.unknownKeys.size === 0) {
      lines.push('(none)');
    } else {
      for (const [key, count] of [...this.unmappedValues.entries()].sort()) {
        lines.push(`${key} (${count} occurrences)`);
      }
      for (const [key, count] of [...this.unknownKeys.entries()].sort()) {
        lines.push(`unknown key: ${key} (${count} occurrences)`);
      }
    }
    lines.push('');

    lines.push('=== Skipped records ===');
    if (this.skippedRecords.length === 0) {
      lines.push('(none)');
    } else {
      for (const { file, line, reason } of this.skippedRecords) {
        lines.push(`${file}:${line} — ${reason}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  writeTo(path: string) {
    writeFileSync(path, this.format(), 'utf8');
  }
}
