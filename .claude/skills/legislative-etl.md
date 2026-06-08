---
name: legislative-etl
description: >
  Use this skill to ingest, stream-parse, filter, normalize, and persist U.S. legislative
  data (JSON or XML) from a local folder into a SQLite database — entirely on the user's
  machine with no external services. Triggers whenever the user wants to process raw
  congressional records, FEC filings, lobbying disclosures, campaign finance data, municipal
  contracts, voting records, or any folder of political data files into a local database.
  Always use this skill as the first step before risk-classifier or story-detector.
---

# Legislative ETL Skill

Streams JSON/XML files from a source folder into a normalized SQLite database using
`better-sqlite3` (synchronous, no async overhead). Never loads entire files into memory.
Runs 100% locally — no Docker, no external DB, no API calls.

---

## Dependencies

```bash
npm install better-sqlite3 sqlite-vec stream-json fast-xml-parser glob
npm install -D @types/better-sqlite3
```

---

## SQLite Schema + sqlite-vec Setup

```typescript
// src/db/setup.ts
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'path';

export function openDB(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // Load vector extension (sqlite-vec — pure C, no external deps)
  sqliteVec.load(db);

  db.pragma('journal_mode = WAL'); // safe concurrent reads
  db.pragma('synchronous = NORMAL'); // fast writes, safe enough
  db.pragma('cache_size = -64000'); // 64MB page cache
  db.pragma('temp_store = MEMORY');

  db.exec(`
    -- Main records table
    CREATE TABLE IF NOT EXISTS records (
      id            TEXT PRIMARY KEY,
      source        TEXT NOT NULL CHECK(source IN ('senate','house','municipal')),
      sub_source    TEXT,
      record_type   TEXT CHECK(record_type IN ('contribution','expenditure','lobbying','vote','contract','earmark','other')),
      date          TEXT,              -- ISO8601 YYYY-MM-DD
      fiscal_year   INTEGER,
      entity_name   TEXT NOT NULL,
      entity_type   TEXT,
      entity_state  TEXT,
      counterparty  TEXT,
      amount_cents  INTEGER,           -- always USD cents, NULL if not financial
      description   TEXT,
      tags          TEXT,              -- JSON array string
      raw_hash      TEXT UNIQUE,       -- dedup key (sha256 hex)
      risk_score    INTEGER,           -- 0-10, set by risk-classifier
      chunk_index   INTEGER DEFAULT 0,
      metadata      TEXT,             -- JSON blob for extra fields
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entity    ON records(entity_name);
    CREATE INDEX IF NOT EXISTS idx_date      ON records(date);
    CREATE INDEX IF NOT EXISTS idx_risk      ON records(risk_score DESC);
    CREATE INDEX IF NOT EXISTS idx_source    ON records(source);
    CREATE INDEX IF NOT EXISTS idx_raw_hash  ON records(raw_hash);

    -- FTS5 full-text search on description + entity names
    CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(
      id UNINDEXED,
      entity_name,
      counterparty,
      description,
      content='records',
      content_rowid='rowid'
    );

    -- Vector table for embeddings (384 dims — all-MiniLM-L6-v2)
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_records USING vec0(
      embedding float[384]
    );

    -- Stories output table
    CREATE TABLE IF NOT EXISTS stories (
      id            TEXT PRIMARY KEY,
      status        TEXT DEFAULT 'lead',
      story_type    TEXT,
      headline      TEXT,
      subheadline   TEXT,
      confidence    INTEGER,
      newsworthiness INTEGER,
      actors        TEXT,   -- JSON
      financial     TEXT,   -- JSON
      timeline      TEXT,   -- JSON
      legal         TEXT,   -- JSON
      missing_pieces TEXT,  -- JSON
      foia_requests TEXT,   -- JSON
      record_ids    TEXT,   -- JSON array of record IDs
      created_at    TEXT DEFAULT (datetime('now'))
    );

    -- ETL run log
    CREATE TABLE IF NOT EXISTS etl_runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path   TEXT,
      source      TEXT,
      records_in  INTEGER DEFAULT 0,
      records_ok  INTEGER DEFAULT 0,
      records_dup INTEGER DEFAULT 0,
      records_err INTEGER DEFAULT 0,
      started_at  TEXT,
      finished_at TEXT
    );
  `);

  return db;
}
```

---

## Normalized Record Type

```typescript
// src/types.ts
export interface LegislativeRecord {
  id: string;
  source: 'senate' | 'house' | 'municipal';
  subSource?: string;
  recordType:
    | 'contribution'
    | 'expenditure'
    | 'lobbying'
    | 'vote'
    | 'contract'
    | 'earmark'
    | 'other';
  date?: string; // YYYY-MM-DD
  fiscalYear?: number;
  entityName: string;
  entityType?: string;
  entityState?: string;
  counterparty?: string;
  amountCents?: number; // integer, USD cents
  description: string;
  tags: string[];
  rawHash: string;
  chunkIndex?: number;
  metadata: Record<string, unknown>;
}
```

---

## Normalization Helpers

```typescript
// src/etl/normalize.ts
import { createHash } from 'crypto';
import type { LegislativeRecord } from '../types';

export function normalizeEntityName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\bCORP\.?\b/g, 'CORPORATION')
    .replace(/\bINC\.?\b/g, 'INCORPORATED')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAmount(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = parseFloat(String(raw).replace(/[$,\s]/g, ''));
  return isNaN(n) ? undefined : Math.round(n * 100);
}

export function makeHash(parts: string[]): string {
  return createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 24);
}

// Chunk long descriptions so they fit in Claude's context window
export function chunkRecord(
  rec: LegislativeRecord,
  maxChars = 2400,
): LegislativeRecord[] {
  if (rec.description.length <= maxChars) return [rec];
  const chunks: LegislativeRecord[] = [];
  for (let i = 0; i < rec.description.length; i += maxChars) {
    chunks.push({
      ...rec,
      description: rec.description.slice(i, i + maxChars),
      chunkIndex: chunks.length,
      id: `${rec.id}-c${chunks.length}`,
    });
  }
  return chunks;
}
```

---

## JSON Streaming Ingestor

```typescript
// src/etl/ingest-json.ts
import { createReadStream } from 'fs';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import type Database from 'better-sqlite3';
import { normalizeRecord } from './normalize-record';
import { upsertRecord } from './upsert';

export async function ingestJSON(
  filePath: string,
  source: 'senate' | 'house' | 'municipal',
  db: Database.Database,
  onProgress?: (n: number) => void,
): Promise<{ ok: number; dup: number; err: number }> {
  const stats = { ok: 0, dup: 0, err: 0 };

  return new Promise((resolve, reject) => {
    const pipeline = chain([
      createReadStream(filePath, { highWaterMark: 128 * 1024 }),
      parser(),
      streamArray(),
    ]);

    pipeline.on('data', ({ value }) => {
      pipeline.pause();
      try {
        const records = normalizeRecord(value, source);
        for (const rec of records) {
          const result = upsertRecord(db, rec);
          if (result === 'ok') stats.ok++;
          if (result === 'dup') stats.dup++;
        }
        onProgress?.(stats.ok);
      } catch (e) {
        stats.err++;
      } finally {
        pipeline.resume();
      }
    });

    pipeline.on('end', () => resolve(stats));
    pipeline.on('error', reject);
  });
}
```

---

## XML Streaming Ingestor

```typescript
// src/etl/ingest-xml.ts
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { XMLParser } from 'fast-xml-parser';
import type Database from 'better-sqlite3';
import { normalizeRecord } from './normalize-record';
import { upsertRecord } from './upsert';

export async function ingestXML(
  filePath: string,
  source: 'senate' | 'house' | 'municipal',
  rootTag: string,
  db: Database.Database,
  onProgress?: (n: number) => void,
): Promise<{ ok: number; dup: number; err: number }> {
  const stats = { ok: 0, dup: 0, err: 0 };
  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
  });
  let buffer = '';
  const openTag = `<${rootTag}`;
  const closeTag = `</${rootTag}>`;

  const rl = createInterface({ input: createReadStream(filePath) });
  for await (const line of rl) {
    buffer += line + '\n';
    if (line.includes(closeTag)) {
      try {
        const obj = xmlParser.parse(buffer);
        const raw = obj[rootTag] ?? obj;
        const records = normalizeRecord(raw, source);
        for (const rec of records) {
          const result = upsertRecord(db, rec);
          if (result === 'ok') stats.ok++;
          if (result === 'dup') stats.dup++;
        }
        onProgress?.(stats.ok);
      } catch {
        stats.err++;
      }
      buffer = line.includes(openTag) ? line + '\n' : '';
    }
  }

  return stats;
}
```

---

## SQLite Upsert (synchronous — no async overhead)

```typescript
// src/etl/upsert.ts
import type Database from 'better-sqlite3';
import type { LegislativeRecord } from '../types';

export function upsertRecord(
  db: Database.Database,
  rec: LegislativeRecord,
): 'ok' | 'dup' {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO records
      (id, source, sub_source, record_type, date, fiscal_year,
       entity_name, entity_type, entity_state, counterparty,
       amount_cents, description, tags, raw_hash, chunk_index, metadata)
    VALUES
      (@id, @source, @subSource, @recordType, @date, @fiscalYear,
       @entityName, @entityType, @entityState, @counterparty,
       @amountCents, @description, @tags, @rawHash, @chunkIndex, @metadata)
  `);

  const info = stmt.run({
    ...rec,
    tags: JSON.stringify(rec.tags),
    metadata: JSON.stringify(rec.metadata),
    chunkIndex: rec.chunkIndex ?? 0,
  });

  return info.changes > 0 ? 'ok' : 'dup';
}
```

---

## Folder Scanner (entry point)

```typescript
// src/etl/scan-folder.ts
import { glob } from 'glob';
import path from 'path';
import type Database from 'better-sqlite3';
import { ingestJSON } from './ingest-json';
import { ingestXML } from './ingest-xml';
import { detectSource, detectXMLRootTag } from './detect-source';

export async function scanFolder(
  dataDir: string,
  db: Database.Database,
  onProgress?: (file: string, n: number) => void,
) {
  const jsonFiles = await glob(`${dataDir}/**/*.json`, { nodir: true });
  const xmlFiles = await glob(`${dataDir}/**/*.xml`, { nodir: true });
  const total = jsonFiles.length + xmlFiles.length;
  let filesDone = 0;

  console.log(
    `📂 Found ${total} files (${jsonFiles.length} JSON, ${xmlFiles.length} XML)`,
  );

  const runLog = db.prepare(`
    INSERT INTO etl_runs (file_path, source, started_at)
    VALUES (?, ?, datetime('now'))
  `);
  const finishLog = db.prepare(`
    UPDATE etl_runs SET records_ok=?, records_dup=?, records_err=?, finished_at=datetime('now')
    WHERE id=?
  `);

  for (const filePath of jsonFiles) {
    const source = detectSource(filePath);
    const runId = runLog.run(filePath, source).lastInsertRowid;
    const stats = await ingestJSON(filePath, source, db, (n) =>
      onProgress?.(filePath, n),
    );
    finishLog.run(stats.ok, stats.dup, stats.err, runId);
    console.log(
      `  ✓ ${path.basename(filePath)} → ${stats.ok} ok, ${stats.dup} dup, ${stats.err} err`,
    );
    filesDone++;
  }

  for (const filePath of xmlFiles) {
    const source = detectSource(filePath);
    const rootTag = await detectXMLRootTag(filePath);
    const runId = runLog.run(filePath, source).lastInsertRowid;
    const stats = await ingestXML(filePath, source, rootTag, db, (n) =>
      onProgress?.(filePath, n),
    );
    finishLog.run(stats.ok, stats.dup, stats.err, runId);
    console.log(
      `  ✓ ${path.basename(filePath)} → ${stats.ok} ok, ${stats.dup} dup, ${stats.err} err`,
    );
    filesDone++;
  }

  const count = db.prepare('SELECT COUNT(*) as n FROM records').get() as {
    n: number;
  };
  console.log(`\n✅ ETL complete. ${count.n} total records in database.`);
}
```

---

## Source Auto-detection

```typescript
// src/etl/detect-source.ts
export function detectSource(
  filePath: string,
): 'senate' | 'house' | 'municipal' {
  const lower = filePath.toLowerCase();
  if (lower.includes('senate') || lower.includes('sen_')) return 'senate';
  if (
    lower.includes('house') ||
    lower.includes('hse_') ||
    lower.includes('fec')
  )
    return 'house';
  return 'municipal';
}

export async function detectXMLRootTag(filePath: string): Promise<string> {
  // Read first 4KB to find the first meaningful XML element
  const { createReadStream } = await import('fs');
  const buf: string[] = [];
  for await (const chunk of createReadStream(filePath, {
    highWaterMark: 4096,
    encoding: 'utf8',
  })) {
    buf.push(chunk);
    break;
  }
  const sample = buf.join('');
  const match = sample.match(/<([A-Za-z][A-Za-z0-9_:-]*)[^/]*>/);
  // Skip root wrapper, return second tag (the repeated record element)
  const allMatches = [...sample.matchAll(/<([A-Za-z][A-Za-z0-9_:-]*)[^/]*>/g)];
  return allMatches[1]?.[1] ?? allMatches[0]?.[1] ?? 'record';
}
```

---

## References

- `references/source-schemas.md` — Field mappings for FEC, LDA, OpenSecrets, GovTrack, USASPENDING formats
