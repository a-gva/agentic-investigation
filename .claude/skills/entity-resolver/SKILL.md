---
name: entity-resolver
description: >
  Use this skill to resolve messy entity names across Senate LDA, House LDA, and Congress
  press datasets. Normalizes casing, fuzzy-matches registrant/client pairs across chambers,
  links press bioguide_id to lobbying targets, and flags Senate↔House filing discrepancies.
  Triggers after legislative-etl completes and before risk-classifier. Use when the user
  needs entity crosswalks, name reconciliation, or discrepancy detection between chambers.
---

# Entity Resolver Skill

Builds a canonical entity graph from raw `records` and populates the `entities` table.
Runs entirely locally — no API calls.

## Dependencies

Uses the SQLite database created by `legislative-etl`. No additional packages beyond `better-sqlite3`.

## Schema

```sql
CREATE TABLE IF NOT EXISTS entities (
  canonical_id  TEXT PRIMARY KEY,
  raw_name      TEXT NOT NULL,
  source        TEXT NOT NULL,
  entity_type   TEXT,           -- registrant | client | member | lobbyist | org
  bioguide_id   TEXT,
  senate_id     TEXT,
  house_id      TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entities_raw ON entities(raw_name);
CREATE INDEX IF NOT EXISTS idx_entities_bioguide ON entities(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_entities_senate ON entities(senate_id);
```

## Resolution steps

1. **Normalize names** — uppercase, expand CORP/INC, strip punctuation (`normalizeEntityName`)
2. **Extract IDs** — pull `senateID`, `houseID`, `bioguide_id` from `records.metadata`
3. **Fuzzy-match** — Levenshtein or token-overlap on registrant/client names across Senate↔House
4. **Link press → lobbying** — join `bioguide_id` members to government entities lobbied in same chamber
5. **Flag discrepancies** — same `senate_id` pair with different `amount_cents` or issue codes

## Implementation

```typescript
// src/resolve/entity-resolver.ts
import type Database from 'better-sqlite3';
import { normalizeEntityName } from '../etl/normalize';

export function resolveEntities(db: Database.Database): void {
  // 1. Populate entities from distinct entity_name + metadata IDs
  const rows = db.prepare(`
    SELECT DISTINCT entity_name, source,
           json_extract(metadata, '$.bioguide_id') AS bioguide_id,
           json_extract(metadata, '$.senate_id') AS senate_id,
           json_extract(metadata, '$.house_id') AS house_id
    FROM records
  `).all() as any[];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO entities (canonical_id, raw_name, source, bioguide_id, senate_id, house_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const row of rows) {
    const canonical = normalizeEntityName(row.entity_name);
    insert.run(
      `${row.source}:${canonical}`,
      row.entity_name,
      row.source,
      row.bioguide_id,
      row.senate_id,
      row.house_id,
    );
  }
}

export function findSenateHouseDiscrepancies(db: Database.Database) {
  return db.prepare(`
    SELECT
      json_extract(a.metadata, '$.senate_id') AS senate_id,
      a.entity_name AS senate_entity,
      b.entity_name AS house_entity,
      a.amount_cents AS senate_amount,
      b.amount_cents AS house_amount,
      a.description AS senate_desc,
      b.description AS house_desc
    FROM records a
    JOIN records b
      ON json_extract(a.metadata, '$.senate_id') = json_extract(b.metadata, '$.senate_id')
     AND a.source = 'senate' AND b.source = 'house'
    WHERE a.amount_cents IS NOT NULL AND b.amount_cents IS NOT NULL
      AND ABS(a.amount_cents - b.amount_cents) > 100
    LIMIT 500
  `).all();
}
```

## Discrepancy stories

Senate↔House pairs with divergent amounts or issue codes are fed to `story-detector` via `src/stories/senate-house-diff.ts`.

## Scripts

See `scripts/README.md` for `src/resolve/entity-resolver.ts` location.
