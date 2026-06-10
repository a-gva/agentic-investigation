---
name: legislative-etl
description: >
  Use this skill to ingest, stream-parse, filter, normalize, and persist U.S. congressional
  lobbying disclosures (Senate JSON, House XML) and press releases (congress_press JSONL)
  from a local folder into a SQLite database — entirely on the user's machine with no
  external services. Triggers whenever the user wants to process raw GAIN corpus files
  into a local database. Always use this skill as the first step before entity-resolver,
  risk-classifier, or story-detector.
---

# Legislative ETL Skill

Streams JSON, XML, and JSONL files from the GAIN corpus into a normalized SQLite database using
`better-sqlite3`. Never loads entire files into memory. Runs 100% locally — no API calls.

## Corpus sources

| Source         | Path                   | Format                               |
| -------------- | ---------------------- | ------------------------------------ |
| Senate LDA     | `data/senate/`         | JSON arrays (filings, contributions) |
| House LDA      | `data/house/`          | XML per filing                       |
| Congress press | `data/congress_press/` | JSONL per month                      |

See `references/source-schemas.md` for field mappings.

## Dependencies

```bash
npm install better-sqlite3 sqlite-vec stream-json fast-xml-parser glob
npm install -D @types/better-sqlite3
```

## How to run

```bash
pnpm etl
```

## Source-specific normalization

- **Senate JSON**: explode `lobbying_activities[]` and `contribution_items[]` into separate `records` rows; preserve `filing_uuid`, `covered_position`, `foreign_entities`, ALI codes in `metadata`
- **House XML**: one row per filing; parse `coveredPosition`, `senateID`/`houseID`, `specific_issues/description`; strip whitespace
- **Congress press JSONL**: one row per release; `entity_name` = member name, `metadata.bioguide_id`, `description` = title + truncated body; chunk long `text` for embeddings

## Schema

`source` must be one of: `senate`, `house`, `congress_press`.

Implementation: `src/db/setup.ts` — creates `records`, `entities`, `records_fts`, `vec_records`, `stories`, `evidence_links`, `investigation_ledger`, `agent_runs`, `etl_runs`.

## Key modules

| Module                        | Purpose                                        |
| ----------------------------- | ---------------------------------------------- |
| `src/etl/ingest-json.ts`      | Stream-parse Senate JSON arrays                |
| `src/etl/ingest-xml.ts`       | Parse House LDA XML files                      |
| `src/etl/ingest-press.ts`     | Read congress_press JSONL line-by-line         |
| `src/etl/normalize-senate.ts` | Senate filing/contribution → LegislativeRecord |
| `src/etl/normalize-house.ts`  | House XML → LegislativeRecord                  |
| `src/etl/detect-source.ts`    | Route path → senate / house / congress_press   |
| `src/etl/upsert.ts`           | INSERT OR IGNORE with dedup hash               |

## Source detection

```typescript
export function detectSource(
  filePath: string,
): 'senate' | 'house' | 'congress_press' {
  const lower = filePath.toLowerCase();
  if (lower.includes('congress_press')) return 'congress_press';
  if (lower.includes('senate') || lower.includes('sen_')) return 'senate';
  if (lower.includes('house') || lower.includes('hse_')) return 'house';
  throw new Error(`Unknown source for path: ${filePath}`);
}
```

## Worker layout

Three parallel workers: `senate`, `house`, `congress_press`. All write to the same SQLite file (WAL mode).

## Scale target

~2–2.5M denormalized rows (not 5M). See [PLAN.md](../../../PLAN.md) for breakdown.

## Scripts

Runnable implementations live in `scripts/` (wrappers around `src/etl/`). See `scripts/README.md`.
