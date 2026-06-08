---
name: subagent-orchestrator
description: >
  Use this skill to coordinate the full GAIN investigation pipeline end-to-end using
  Node.js worker_threads — entirely locally. Runs ETL in parallel, entity resolution,
  embedding, classification, story detection, and investigation state export. Resumable
  via agent_runs and etl_runs tables. Triggers when the user wants one command from
  data folder to submission-ready findings and traces.
---

# Subagent Orchestrator Skill

One command runs the full pipeline. All state lives in a single SQLite file.

```
npx tsx pipeline.ts --data-dir ./data --db ./investigation.db
```

## Architecture

```
main thread (orchestrator)
│
├─ Phase 1: ETL (parallel worker_threads)
│   ├─ worker[0]: data/senate/**/*.json
│   ├─ worker[1]: data/house/**/*.xml
│   └─ worker[2]: data/congress_press/**/*.jsonl
│
├─ Phase 2: Entity resolution (main thread)
│   └─ entity-resolver → entities table + discrepancy flags
│
├─ Phase 3: Embeddings (main thread, ONNX)
│   └─ @huggingface/transformers → vec_records
│
├─ Phase 4: Classification (main thread, Haiku batch)
│   └─ risk_score + tags → records
│
├─ Phase 5: Story detection (main thread, Sonnet)
│   └─ pattern detectors → cluster → expand → brief → evidence_links
│
├─ Phase 6: Investigation state export
│   └─ export-findings.ts + export-evidence-pack.ts
│
└─ Phase 7 (optional): External enrichment
    └─ FEC / Congress.gov / FARA — document in submission README
```

## Resumability

Each phase logs to `agent_runs`:

```sql
INSERT INTO agent_runs (skill_name, started_at, inputs_hash, output_path, trace_path)
VALUES (?, datetime('now'), ?, ?, ?);
```

On restart, skip phases where `agent_runs` shows successful completion for the same `inputs_hash`.

`investigation_ledger` tracks thread status across sessions: `open | verified | cold | published`.

## Worker buckets

```typescript
const buckets = { senate: [], house: [], congress_press: [] };

for (const f of allFiles) {
  const source = detectSource(f); // never 'municipal'
  buckets[source].push({ path: f, type: fileType(f) });
}
```

## Trace logging

Write interaction traces to `submission/traces/{skill-name}/{run-id}.json` and record path in `agent_runs.trace_path`. Include tool calls, inputs, outputs, and human override moments.

## Dependencies

```bash
npm install better-sqlite3 sqlite-vec stream-json fast-xml-parser glob \
            @huggingface/transformers @anthropic-ai/sdk
npm install -D tsx @types/better-sqlite3 @types/node typescript
```

## Post-pipeline export

```bash
npx tsx src/review/export-findings.ts --db ./investigation.db
npx tsx src/review/export-evidence-pack.ts --db ./investigation.db
```

## What runs where

| Step | Local | API |
|------|-------|-----|
| ETL parsing | worker_threads | None |
| Entity resolution | main thread | None |
| Embeddings | main thread ONNX | None |
| Vector search | sqlite-vec | None |
| Risk classification | Haiku Batch | ANTHROPIC_API_KEY |
| Story briefs | Sonnet | ANTHROPIC_API_KEY |

## References

- `references/error-recovery.md` — resumable pipeline after interruption
- `references/worker-tuning.md` — concurrency by CPU cores

## Scripts

Entry point: `../../../pipeline.ts`. See `scripts/README.md`.
