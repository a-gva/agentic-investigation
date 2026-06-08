# Plan: GAIN Challenge-Aligned Investigation Pipeline

**Stack: TypeScript · Node.js · SQLite (better-sqlite3 + sqlite-vec) · @huggingface/transformers · Claude API**

**Corpus:** Senate LDA JSON, House LDA XML, Congress press JSONL (2022–2026 Q1). See [RAW_DATA_OVERVIEW.md](RAW_DATA_OVERVIEW.md).

---

## What Runs Where

| Stage                         | Runs Where                       | External Service    |
| ----------------------------- | -------------------------------- | ------------------- |
| JSON/XML/JSONL parsing        | Local — worker_threads           | None                |
| SQLite persistence            | Local — WAL mode                 | None                |
| Entity resolution             | Local — SQL + fuzzy match        | None                |
| Semantic embeddings           | Local — ONNX CPU (all-MiniLM)    | None                |
| Vector search                 | Local — sqlite-vec (C extension) | None                |
| FTS5 full-text search         | Local — Native SQLite            | None                |
| Entity clustering             | Local — Pure SQL                 | None                |
| Risk classification           | Anthropic Haiku Batch API        | `ANTHROPIC_API_KEY` |
| Deep analysis                 | Anthropic Sonnet                 | `ANTHROPIC_API_KEY` |
| Brief generation              | Anthropic Sonnet                 | `ANTHROPIC_API_KEY` |

**No Docker, no Redis, no PostgreSQL, no external servers.**
A single SQLite `.db` file contains everything: records, entities, embeddings, scores, stories, and investigation state.

---

## Pipeline Architecture

```text
node pipeline.ts --data-dir ./data --db ./investigation.db
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1 — ETL (SKILL: legislative-etl)                     │
│                                                             │
│  worker_threads (1 per source)                              │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ senate/      │ │ house/       │ │ congress_press/     │  │
│  │ *.json       │ │ *.xml        │ │ *.jsonl             │  │
│  └──────┬───────┘ └──────┬───────┘ └──────────┬──────────┘  │
│         └────────────────┼────────────────────┘             │
│                          ▼                                  │
│               stream-json / fast-xml-parser / readline      │
│               normalize → deduplicate (hash) → upsert       │
│                          ▼                                  │
│              investigation.db (WAL mode)                    │
│              TABLE: records (~2–2.5M rows)                  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2 — ENTITY RESOLUTION (SKILL: entity-resolver)         │
│                                                             │
│  Normalize names → fuzzy-match Senate↔House pairs           │
│  Link press bioguide_id to lobbying targets                 │
│  Flag Senate↔House discrepancies (amount, issue codes)      │
│                          ▼                                  │
│              TABLE: entities                                │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3 — EMBEDDINGS (SKILL: risk-classifier, step 1)      │
│                                                             │
│  @huggingface/transformers v3                               │
│  Model: Xenova/all-MiniLM-L6-v2 (ONNX, ~23MB, dtype=q8)     │
│  Batch: 200 records at a time                               │
│  Input: entity_name + counterparty + description (512 chars)│
│  Output: Float32Array[384] → Uint8Array blob                │
│                          ▼                                  │
│              TABLE: vec_records (sqlite-vec)                │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 4 — CLASSIFICATION (SKILL: risk-classifier, step 2)  │
│                                                             │
│  Haiku Batch API — 10k batches, 50% discount, async         │
│  Corpus-grounded categories (revolving door, foreign        │
│  influence, contribution routing, filing gaps, etc.)         │
│  Poll every 15s → write back to records.risk_score          │
│                                                             │
│  Top 5% (risk >= 7) → Sonnet deep analysis                  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 5 — STORY DETECTION (SKILL: story-detector)          │
│                                                             │
│  1. SQL pattern detectors (revolving door, foreign, etc.)   │
│  2. say-vs-pay correlator (press + lobbying same quarter)   │
│  3. Senate↔House discrepancy detector                     │
│  4. SQL clustering + sqlite-vec expansion                   │
│  5. Sonnet: journalistic brief + evidence_links             │
│  6. Rank by newsworthiness (local formula, no API)          │
│          ▼                                                  │
│              TABLE: stories + evidence_links                │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 6 — INVESTIGATION STATE (SKILL: subagent-orchestrator)│
│                                                             │
│  Resumable agent_runs · investigation_ledger                │
│  export-evidence-pack.ts → editor-reviewable markdown       │
│  export-findings.ts → submission/findings/FINDINGS.md       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼ (optional)
┌─────────────────────────────────────────────────────────────┐
│  PHASE 7 — EXTERNAL ENRICHMENT (optional)                   │
│                                                             │
│  FEC API · Congress.gov · FARA — document in submission     │
│  README which findings used outside data                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Corpus Scale

| Source               | Primary units | Denormalized rows (estimate)  |
| -------------------- | ------------- | ----------------------------- |
| Senate filings       | 418K          | ~800K activity rows           |
| Senate contributions | 156K reports  | ~637K item rows               |
| House XML            | 410K files    | ~400–800K activity rows       |
| Congress press       | 153K releases | 153K (+ chunks if text split) |
| **Total**            |               | **~2–2.5M rows**              |

### Source-specific ETL

- **Senate JSON**: explode `lobbying_activities[]` and `contribution_items[]` into separate `records` rows; preserve `filing_uuid`, `covered_position`, `foreign_entities`, ALI codes in `metadata`
- **House XML**: one row per filing; parse `coveredPosition`, `senateID`/`houseID`, `specific_issues/description`; strip whitespace
- **Congress press JSONL**: one row per release; `entity_name` = member name, `metadata.bioguide_id`, `description` = title + truncated body (chunk long `text` for embeddings)

**Worker layout:** 3 parallel workers — `senate`, `house`, `congress_press`.

---

## File Structure

```text
legislative-investigator/
├── pipeline.ts               ← entry point — runs everything
├── src/
│   ├── db/
│   │   └── setup.ts          ← openDB() with schema + sqlite-vec
│   ├── types.ts              ← LegislativeRecord, StoryCandidate
│   ├── etl/
│   │   ├── ingest-json.ts    ← stream-json, senate filings/contributions
│   │   ├── ingest-xml.ts     ← fast-xml-parser, house LDA
│   │   ├── ingest-press.ts   ← JSONL congress_press
│   │   ├── normalize.ts      ← normalizeEntityName, normalizeAmount, makeHash
│   │   ├── normalize-senate.ts
│   │   ├── normalize-house.ts
│   │   ├── normalize-record.ts
│   │   ├── detect-source.ts  ← detects senate/house/congress_press from path
│   │   └── upsert.ts
│   ├── resolve/
│   │   └── entity-resolver.ts
│   ├── classifier/
│   │   ├── embedder.ts
│   │   ├── risk-classifier.ts
│   │   └── deep-analysis.ts
│   ├── stories/
│   │   ├── cluster.ts
│   │   ├── expand-cluster.ts
│   │   ├── say-vs-pay.ts
│   │   ├── senate-house-diff.ts
│   │   ├── generate-brief.ts
│   │   └── run.ts
│   └── review/
│       ├── export-evidence-pack.ts
│       └── export-findings.ts
├── .claude/skills/           # canonical (Cursor); skills/ → symlink
│   ├── legislative-etl/SKILL.md
│   ├── entity-resolver/SKILL.md
│   ├── risk-classifier/SKILL.md
│   ├── story-detector/SKILL.md
│   └── subagent-orchestrator/SKILL.md
├── submission/
│   ├── findings/FINDINGS.md
│   ├── traces/
│   └── README.md
├── tsconfig.json
└── package.json
```

---

## SQLite Schema (Single File, Everything Inside)

```sql
records          -- ~2–2.5M rows: all normalized records
  id, source, sub_source, record_type, date, fiscal_year
  entity_name, entity_type, entity_state, counterparty
  amount_cents, description, tags (JSON), raw_hash (UNIQUE)
  risk_score, chunk_index, metadata (JSON), created_at
  -- source CHECK: ('senate','house','congress_press')

entities         -- canonical entity resolution
  canonical_id, raw_name, source, entity_type
  bioguide_id, senate_id, house_id

records_fts      -- FTS5 virtual table over records

vec_records      -- sqlite-vec virtual table (float[384])

stories          -- journalistic leads generated by Sonnet
  id, story_type, headline, confidence, newsworthiness
  actors, financial, timeline, legal, foia_requests (all JSON)
  record_ids, evidence_links (JSON)

evidence_links   -- provenance for editor audit
  story_id, record_id, field, excerpt, source_path, line_or_uuid

investigation_ledger  -- thread tracking across sessions
  thread_id, status (open|verified|cold|published)
  summary, updated_at

agent_runs       -- resumable pipeline execution log
  skill_name, started_at, inputs_hash, output_path, trace_path

etl_runs         -- execution log per file
```

---

## Installation and Execution

```bash
# 1. Install dependencies
npm install better-sqlite3 sqlite-vec stream-json fast-xml-parser \
            glob @huggingface/transformers @anthropic-ai/sdk

npm install -D tsx typescript @types/better-sqlite3 @types/node

# 2. Configure API key (only external dependency)
export ANTHROPIC_API_KEY=sk-ant-...

# 3. Run the complete pipeline
npx tsx pipeline.ts --data-dir ./data --db ./investigation.db

# 4. Export findings and evidence for submission
npx tsx src/review/export-findings.ts --db ./investigation.db
npx tsx src/review/export-evidence-pack.ts --db ./investigation.db

# 5. Query results
npx tsx src/query.ts
```

---

## Estimated Cost and Runtime (8GB RAM)

| Phase                                | Duration      | API Cost     |
| ------------------------------------ | ------------- | ------------ |
| ETL (3 parallel workers)             | 30–60 min     | $0           |
| Entity resolution                    | 15–30 min     | $0           |
| Local ONNX embeddings (~2M rows)     | 1–3 h         | $0           |
| Haiku Batch (~2M records)            | 1–2 h (async) | ~$4–8        |
| Sonnet deep analysis (top 5% ≈ 100k) | 1–2 h         | ~$30–60      |
| Story briefs (top clusters)          | 15–30 min     | ~$5–15       |
| **Total**                            | **~4–8 h**    | **~$40–80**  |

---

## Risk Categories (Corpus-Grounded)

| Category               | Detectable from corpus | Signal                                      |
| ---------------------- | ---------------------- | ------------------------------------------- |
| Revolving door         | Yes                    | `covered_position` / `coveredPosition` text   |
| Foreign influence      | Yes                    | `foreign_entities` / `foreignEntities`        |
| Lobbyist contributions | Yes                    | `contribution_items` payee vs honoree         |
| Undisclosed spend gaps | Yes                    | missing income/expenses on filings            |
| Senate↔House mismatch  | Yes                    | reconciled pair divergence                    |
| Say-vs-pay timing      | Yes (with press)       | press topic + lobbying spend same quarter     |
| Quid pro quo / earmarks / dark money PACs | No (needs FEC/votes) | Optional Phase 7 external enrichment only |

---

## Detectable Story Categories

| Type                 | Signal                                                      | Threshold           |
| -------------------- | ----------------------------------------------------------- | ------------------- |
| Revolving door       | Govt title in `covered_position` → lobbyist within 2yr      | any                 |
| Foreign influence    | `foreign_entities` non-empty                                | any                 |
| Contribution routing | payee ≠ honoree, or PAC → member                            | > $1,000            |
| Filing discrepancy   | Senate vs House pair mismatch on amount/issues              | any delta           |
| Say vs pay           | Press issue keyword + client lobbying same issue ±1 quarter | co-occurrence ≥ 2   |
| Spend anomaly        | Quarterly income/expense spike                              | > 3× trailing avg   |
| Data quality         | Systematic missing fields by registrant                     | pattern ≥ 5 filings |

---

## Submission Package

Per [CHALLENGE.md](CHALLENGE.md), each submission contains four artifacts:

```text
submission/
├── skills/                    # symlink to .claude/skills/ (Agent Skills spec)
│   ├── legislative-etl/SKILL.md
│   ├── entity-resolver/SKILL.md
│   ├── risk-classifier/SKILL.md
│   ├── story-detector/SKILL.md
│   └── subagent-orchestrator/SKILL.md
├── findings/
│   └── FINDINGS.md            # newsworthy discoveries, sourced to record IDs
├── traces/
│   └── {skill-name}/{run-id}.json
└── README.md                  # map: skills → findings → traces → outside data → COI → legal flags
```

**Findings report** must pass the journalism bar: specific records, public interest, not a dataset summary. Template fields: headline, actors, timeline, evidence citations (`filing_uuid` / XML path / press URL), confidence, legal-violation flag.

**Interaction traces**: log every skill invocation from `pipeline.ts` and interactive agent sessions; include human override moments. Stored in `agent_runs.trace_path` and copied to `submission/traces/`.

**Submission README**: conflicts of interest, outside data used, which skill produced which finding.

---

## Evaluation Rubric → Design Checklist

| Rubric dimension              | PLAN implementation                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Keeps investigation organized | `investigation_ledger`, resumable `agent_runs`, skill docs for session handoff                                        |
| Efficient with corpus         | Local embeddings, SQL/FTS pre-filter, Haiku batch triage, Sonnet only on top clusters                                 |
| Human can verify              | `evidence_links`, `export-evidence-pack.ts`, citations in `FINDINGS.md`                                               |
| Extends agent capabilities    | Entity resolver, Senate↔House reconciler, say-vs-pay correlator, LDA parsers                                          |
| Reproducibility               | `npm install && npx tsx pipeline.ts --data-dir ./data` reproduces DB + stories; API key is only external dep          |
| Findings are real             | Spot-check workflow in `export-findings.ts`; require ≥3 findings with primary-source citations before submission      |

---

## Recommended Implementation Order

1. Fix data model and ETL for three real sources (congress_press; remove municipal)
2. Entity resolver + Senate↔House crosswalk
3. Skills in `.claude/skills/*/SKILL.md` (symlinked as `skills/` for submission)
4. Retarget risk categories and story detectors to corpus-grounded patterns
5. Add investigation ledger + evidence linking
6. Run pipeline on full corpus; produce `FINDINGS.md` from top stories
7. Capture interaction traces; write submission `README.md`
8. Validate skills against Agent Skills spec; spot-check findings against raw records

---

## Phase 7 — External Enrichment (Optional)

Not blocking reproducibility. Document in submission README when used:

- [FEC](https://www.fec.gov/data/) — contribution validation
- [Congress.gov](https://www.congress.gov/help/using-data-offsite) — bill/committee joins via `bioguide_id`
- [FARA](https://efile.fara.gov/ords/fara/r/fara_ws/api/bulkdata) — foreign-agent cross-check
