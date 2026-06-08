# Plan: Investigative Journalism Pipeline — 100% Local Architecture

**Stack: TypeScript · Node.js · SQLite (better-sqlite3 + sqlite-vec) · @huggingface/transformers · Claude API**

---

## What Runs Where

| Stage                         | Runs Where                       | External Service    |
| ----------------------------- | -------------------------------- | ------------------- |
| JSON/XML scanning and parsing | Local — worker_threads           | None                |
| SQLite persistence            | Local — WAL mode                 | None                |
| Semantic embeddings           | Local — ONNX CPU (all-MiniLM)    | None                |
| Vector search                 | Local — sqlite-vec (C extension) | None                |
| FTS5 full-text search         | Local — Native SQLite            | None                |
| Entity clustering             | Local — Pure SQL                 | None                |
| Risk classification           | Anthropic Haiku Batch API        | `ANTHROPIC_API_KEY` |
| Deep analysis                 | Anthropic Sonnet                 | `ANTHROPIC_API_KEY` |
| Brief generation              | Anthropic Sonnet                 | `ANTHROPIC_API_KEY` |

**No Docker, no Redis, no PostgreSQL, no external servers.**
A single SQLite `.db` file contains everything: records, embeddings, scores, and stories.

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
│  │ senate/      │ │ house/       │ │ municipal/          │  │
│  │ *.json *.xml │ │ *.json *.xml │ │ *.json *.xml        │  │
│  └──────┬───────┘ └──────┬───────┘ └──────────┬──────────┘  │
│         └────────────────┼────────────────────┘             │
│                          ▼                                  │
│               stream-json / fast-xml-parser                 │
│               normalize → deduplicate (hash) → upsert       │
│                          ▼                                  │
│              investigation.db (WAL mode)                    │
│              TABLE: records (~5M rows)                      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2 — EMBEDDINGS (SKILL: risk-classifier, step 1)      │
│                                                             │
│  @huggingface/transformers v3                               │
│  Model: Xenova/all-MiniLM-L6-v2 (ONNX, ~23MB, dtype=q8)     │
│  Batch: 200 records at a time                               │
│  Input: entity_name + counterparty + description (512 chars)│
│  Output: Float32Array[384] → Uint8Array blob                │
│                          ▼                                  │
│              TABLE: vec_records (sqlite-vec)                │
│              Virtual table — native cosine KNN search       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3 — CLASSIFICATION (SKILL: risk-classifier, step 2)  │
│                                                             │
│  Haiku Batch API — 10k batches, 50% discount, async         │
│  Input: formatted record text                               │
│  Output: riskScore 0–10 + categories[]                      │
│  Poll every 15s → write back to records.risk_score          │
│                                                             │
│  Top 5% (risk >= 7) → Sonnet deep analysis                  │
│  Prompt caching on legal section → ~90% additional savings  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 4 — STORY DETECTION (SKILL: story-detector)          │
│                                                             │
│  1. SQL clustering: entity↔counterparty pairs               │
│     GROUP BY + HAVING co_occurrences >= 2                   │
│  2. sqlite-vec: expand cluster via semantic similarity      │
│     seed centroid → cosine KNN → nearby records             │
│  3. Sonnet: generate journalistic brief for each cluster    │
│  4. Rank by newsworthiness (local formula, no API)          │
│          ▼                                                  │
│              TABLE: stories                                 │
└─────────────────────────────────────────────────────────────┘
```

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
│   │   ├── ingest-json.ts    ← stream-json, pause/resume backpressure
│   │   ├── ingest-xml.ts     ← fast-xml-parser, buffer by root tag
│   │   ├── normalize.ts      ← normalizeEntityName, normalizeAmount, makeHash
│   │   ├── normalize-record.ts ← source-specific mapping → LegislativeRecord
│   │   ├── detect-source.ts  ← detects senate/house/municipal from path
│   │   └── upsert.ts         ← synchronized INSERT OR IGNORE
│   ├── classifier/
│   │   ├── embedder.ts       ← local all-MiniLM, writes to vec_records
│   │   ├── risk-classifier.ts ← Haiku Batch API, polling, SQLite writes
│   │   └── deep-analysis.ts  ← Sonnet with prompt caching, top 5%
│   └── stories/
│       ├── cluster.ts        ← SQL co-occurrence clustering
│       ├── expand-cluster.ts ← sqlite-vec KNN expansion
│       ├── generate-brief.ts ← Sonnet brief + persist to stories table
│       └── run.ts            ← orchestrates cluster → expand → brief → rank
├── skills/
│   ├── legislative-etl/      ← SKILL.md
│   ├── risk-classifier/      ← SKILL.md
│   ├── story-detector/       ← SKILL.md
│   └── subagent-orchestrator/ ← SKILL.md
├── tsconfig.json
└── package.json
```

---

## SQLite Schema (Single File, Everything Inside)

```sql
records          -- ~5M rows: all normalized records
  id, source, sub_source, record_type, date, fiscal_year
  entity_name, entity_type, entity_state, counterparty
  amount_cents, description, tags (JSON), raw_hash (UNIQUE)
  risk_score, chunk_index, metadata (JSON), created_at

records_fts      -- FTS5 virtual table over records
  full-text search on entity_name, counterparty, description

vec_records      -- sqlite-vec virtual table (float[384])
  embedding per records rowid
  native SQL cosine KNN search

stories          -- journalistic leads generated by Sonnet
  id, story_type, headline, confidence, newsworthiness
  actors, financial, timeline, legal, foia_requests (all JSON)

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

# 4. Query results
npx tsx src/query.ts
```

---

## Estimated Cost and Runtime (8GB RAM)

| Phase                                | Duration      | API Cost     |
| ------------------------------------ | ------------- | ------------ |
| ETL (3 parallel workers)             | 30–90 min     | $0           |
| Local ONNX embeddings                | 2–4 h         | $0           |
| Haiku Batch (~5M records)            | 1–2 h (async) | ~$10–15      |
| Sonnet deep analysis (top 5% ≈ 250k) | 2–4 h         | ~$80–130     |
| Story briefs (top clusters)          | 15–30 min     | ~$5–15       |
| **Total**                            | **~6–12 h**   | **~$95–160** |

Compared to the previous version (PostgreSQL + Redis + pgvector):

- Eliminates two external services (Redis and PostgreSQL)
- Eliminates Docker entirely
- Reduces embedding costs from approximately $100 to $0 (local model)
- Reduces setup from "1 hour of infrastructure work" to `npm install`

---

## Detectable Story Categories

| Type                | Signal                                    | Threshold           |
| ------------------- | ----------------------------------------- | ------------------- |
| Quid pro quo        | Donation → vote within 90 days            | > $10,000           |
| Dark money          | PAC with undisclosed donors               | > $25,000           |
| Revolving door      | Regulator ↔ regulated industry            | < 2 years           |
| Suspicious timing   | Donation spike before voting              | > 3× annual average |
| Self-dealing        | Legislator votes for personal benefit     | Any amount          |
| Foreign influence   | Entity linked to a foreign government     | Any amount          |
| Earmark correlation | Budget allocation benefits campaign donor | > $100,000          |
