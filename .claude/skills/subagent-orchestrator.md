---
name: subagent-orchestrator
description: >
  Use this skill to coordinate the full legislative investigation pipeline end-to-end
  using Node.js worker_threads — entirely locally, with no Redis, no Docker, no external
  queue systems. Runs ETL ingestion in parallel worker threads, then sequentially executes
  embedding, classification, and story detection against the local SQLite database.
  Triggers when the user wants to run the complete pipeline from a data folder to story
  results in one command, or needs to parallelize file ingestion across CPU cores.
  This is the entry point that glues legislative-etl, risk-classifier, and story-detector.
---

# Subagent Orchestrator Skill

One command runs the full pipeline. Uses Node.js `worker_threads` for parallel ETL
(I/O-bound, safe to parallelize). All state lives in a single SQLite file.

```
node pipeline.ts --data-dir ./data --db ./investigation.db
```

---

## Architecture

```
main thread (orchestrator)
│
├─ Phase 1: ETL (parallel worker_threads)
│   ├─ worker[0]: senate/*.json, senate/*.xml
│   ├─ worker[1]: house/*.json, house/*.xml
│   └─ worker[2]: municipal/*.json, municipal/*.xml
│   All write to same SQLite file (WAL mode = safe concurrent writes)
│
├─ Phase 2: Embed (main thread, CPU-bound ONNX model)
│   └─ @huggingface/transformers, batches of 200, writes to vec_records
│
├─ Phase 3: Classify (main thread, async Anthropic Batch API)
│   └─ Haiku batch → poll → write risk_score back to SQLite
│
└─ Phase 4: Stories (main thread, Claude Sonnet)
    └─ SQL cluster → vector expand → Sonnet brief → write to stories table
```

---

## Dependencies

```bash
npm install better-sqlite3 sqlite-vec stream-json fast-xml-parser glob \
            @huggingface/transformers @anthropic-ai/sdk
npm install -D tsx @types/better-sqlite3 @types/node typescript
```

---

## Entry Point

```typescript
// pipeline.ts
import { workerData, isMainThread, parentPort } from 'worker_threads';
import { Worker } from 'worker_threads';
import path from 'path';
import { glob } from 'glob';
import { openDB } from './src/db/setup';
import { embedBatch } from './src/classifier/embedder';
import { classifyAll } from './src/classifier/risk-classifier';
import { deepAnalyzeHighRisk } from './src/classifier/deep-analysis';
import { detectStories } from './src/stories/run';

// ─── Worker mode ──────────────────────────────────────────────
if (!isMainThread) {
  const { files, source, dbPath } = workerData as {
    files: { path: string; type: 'json' | 'xml' }[];
    source: 'senate' | 'house' | 'municipal';
    dbPath: string;
  };

  // Each worker opens its own DB connection (WAL = safe)
  const { openDB } = require('./src/db/setup');
  const { ingestJSON } = require('./src/etl/ingest-json');
  const { ingestXML } = require('./src/etl/ingest-xml');
  const { detectXMLRootTag } = require('./src/etl/detect-source');

  const db = openDB(dbPath);
  let total = 0;

  for (const file of files) {
    try {
      let stats;
      if (file.type === 'json') {
        stats = await ingestJSON(file.path, source, db, (n: number) => {
          parentPort!.postMessage({ type: 'progress', file: file.path, n });
        });
      } else {
        const rootTag = await detectXMLRootTag(file.path);
        stats = await ingestXML(file.path, source, rootTag, db, (n: number) => {
          parentPort!.postMessage({ type: 'progress', file: file.path, n });
        });
      }
      total += stats.ok;
      parentPort!.postMessage({ type: 'file_done', file: file.path, stats });
    } catch (e) {
      parentPort!.postMessage({ type: 'error', file: file.path, error: String(e) });
    }
  }

  parentPort!.postMessage({ type: 'done', total });
  process.exit(0);
}

// ─── Main thread (orchestrator) ───────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = args['--data-dir'] ?? './data';
  const dbPath  = args['--db'] ?? './investigation.db';

  console.log(`\n🔍 Legislative Investigation Pipeline`);
  console.log(`   Data: ${dataDir}`);
  console.log(`   DB:   ${dbPath}\n`);

  const db = openDB(dbPath);

  // ── Phase 1: Parallel ETL ─────────────────────────────────
  console.log('━━━ Phase 1: ETL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await runParallelETL(dataDir, dbPath);

  const recordCount = (db.prepare('SELECT COUNT(*) as n FROM records').get() as any).n;
  console.log(`\n📊 Records in database: ${recordCount.toLocaleString()}\n`);

  // ── Phase 2: Embeddings ───────────────────────────────────
  console.log('━━━ Phase 2: Embeddings (local model) ━━━━━━━━━━━━');
  await embedBatch(db);
  console.log();

  // ── Phase 3: Classification ───────────────────────────────
  console.log('━━━ Phase 3: Risk Classification (Haiku batch) ━━━');
  await classifyAll(db);
  await deepAnalyzeHighRisk(db);
  console.log();

  // ── Phase 4: Story Detection ──────────────────────────────
  console.log('━━━ Phase 4: Story Detection (Sonnet) ━━━━━━━━━━━━');
  await detectStories(db);

  // ── Summary ───────────────────────────────────────────────
  const stories = db.prepare('SELECT COUNT(*) as n FROM stories').get() as any;
  const highRisk = db.prepare('SELECT COUNT(*) as n FROM records WHERE risk_score >= 7').get() as any;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Pipeline complete!`);
  console.log(`   Records processed : ${recordCount.toLocaleString()}`);
  console.log(`   High-risk records : ${highRisk.n.toLocaleString()}`);
  console.log(`   Stories detected  : ${stories.n}`);
  console.log(`   Database          : ${dbPath}`);
  console.log(`${'═'.repeat(50)}\n`);
}

// ─── Parallel ETL dispatcher ──────────────────────────────────
async function runParallelETL(dataDir: string, dbPath: string) {
  const allFiles = await glob(`${dataDir}/**/*.{json,xml}`, { nodir: true });

  // Bucket files by detected source
  const buckets: Record<string, { path: string; type: 'json' | 'xml' }[]> = {
    senate:    [],
    house:     [],
    municipal: [],
  };

  for (const f of allFiles) {
    const type = f.endsWith('.json') ? 'json' : 'xml';
    const lower = f.toLowerCase();
    const source = lower.includes('senate') || lower.includes('sen_')
      ? 'senate'
      : lower.includes('house') || lower.includes('fec')
      ? 'house'
      : 'municipal';
    buckets[source].push({ path: f, type });
  }

  const workers: Promise<void>[] = [];
  for (const [source, files] of Object.entries(buckets)) {
    if (files.length === 0) continue;
    console.log(`  Spawning worker: ${source} (${files.length} files)`);
    workers.push(spawnWorker(files, source as any, dbPath));
  }

  await Promise.all(workers);
}

function spawnWorker(
  files: { path: string; type: 'json' | 'xml' }[],
  source: 'senate' | 'house' | 'municipal',
  dbPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {  // re-uses same file (worker mode check above)
      workerData: { files, source, dbPath },
    });

    worker.on('message', (msg) => {
      if (msg.type === 'file_done') {
        console.log(`  [${source}] ${path.basename(msg.file)}: ${msg.stats.ok} records`);
      }
      if (msg.type === 'error') {
        console.error(`  [${source}] ERROR ${path.basename(msg.file)}: ${msg.error}`);
      }
    });

    worker.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Worker exited with code ${code}`));
    });

    worker.on('error', reject);
  });
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1]) {
      result[argv[i]] = argv[i + 1];
      i++;
    }
  }
  return result;
}

main().catch(console.error);
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "resolveJsonModule": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---

## package.json scripts

```json
{
  "scripts": {
    "pipeline": "tsx pipeline.ts",
    "pipeline:senate": "tsx pipeline.ts --data-dir ./data/senate",
    "query": "tsx src/query.ts"
  }
}
```

---

## Quick Query CLI (inspect results)

```typescript
// src/query.ts — run interactively after pipeline
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const db = new Database(process.env.DB_PATH ?? './investigation.db');
sqliteVec.load(db);

// Top stories
const stories = db.prepare(`
  SELECT headline, story_type, confidence, newsworthiness, created_at
  FROM stories ORDER BY newsworthiness DESC LIMIT 20
`).all();

console.log('\n📰 TOP STORIES:\n');
stories.forEach((s: any, i) => {
  console.log(`${i+1}. [${s.newsworthiness}/100] ${s.headline}`);
  console.log(`   ${s.story_type} | confidence: ${s.confidence}% | ${s.created_at}\n`);
});

// High-risk records by entity
const entities = db.prepare(`
  SELECT entity_name, COUNT(*) as records, AVG(risk_score) as avg_risk,
         SUM(amount_cents)/100 as total_usd
  FROM records WHERE risk_score >= 7
  GROUP BY entity_name ORDER BY avg_risk DESC LIMIT 20
`).all();

console.log('\n🔴 HIGH-RISK ENTITIES:\n');
entities.forEach((e: any) => {
  console.log(`• ${e.entity_name}: ${e.records} records, avg risk ${e.avg_risk?.toFixed(1)}, $${e.total_usd?.toLocaleString()}`);
});
```

---

## What Runs Where

| Step | Runs Where | External Calls |
|------|-----------|----------------|
| File scanning + parsing | Local (worker_threads) | None |
| SQLite writes | Local (WAL mode) | None |
| Embeddings (all-MiniLM) | Local (ONNX CPU) | None |
| Vector search (sqlite-vec) | Local (SQLite extension) | None |
| Risk classification | Anthropic Haiku Batch API | ANTHROPIC_API_KEY |
| Deep analysis | Anthropic Sonnet API | ANTHROPIC_API_KEY |
| Story generation | Anthropic Sonnet API | ANTHROPIC_API_KEY |

**Only 3 API calls total** (one batch submission + one deep analysis + story briefs).
Everything else — parsing, storage, embeddings, vector search — runs entirely on the user's machine.

---

## References

- `references/worker-tuning.md` — Concurrency tuning by CPU cores and dataset size
- `references/error-recovery.md` — Resumable pipeline: how to re-run after interruption
