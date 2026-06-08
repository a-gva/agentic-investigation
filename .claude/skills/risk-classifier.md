---
name: risk-classifier
description: >
  Use this skill to classify legislative records already in a local SQLite database for
  journalistic risk signals: corruption, bribery, lobbying influence, conflict of interest,
  dark money, and quid-pro-quo patterns. Also generates 384-dimension embeddings locally
  using @huggingface/transformers (no API cost) and stores them in sqlite-vec for similarity
  search. Uses Claude Haiku via Batch API only for classification (50% discount, async).
  Triggers after legislative-etl completes and before story-detector. Use when the user
  wants to score, triage, rank, or flag records for investigative leads.
---

# Risk Classifier Skill

Two steps: (1) local embeddings via `@huggingface/transformers` stored in `sqlite-vec`,
(2) risk scoring via Claude Haiku Batch API. Everything except the Claude API call is local.

---

## Dependencies

```bash
npm install @huggingface/transformers @anthropic-ai/sdk
```

---

## Step 1 — Local Embeddings with Transformers.js v3

Runs `all-MiniLM-L6-v2` (ONNX, ~23MB) locally. First run downloads the model once to
`~/.cache/huggingface`. Subsequent runs are instant.

```typescript
// src/classifier/embedder.ts
import { pipeline } from '@huggingface/transformers';
import type Database from 'better-sqlite3';

let _embedder: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getEmbedder() {
  if (!_embedder) {
    console.log('Loading embedding model (first run downloads ~23MB)...');
    _embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'q8',        // quantized = faster, ~half size
      device: 'cpu',
    });
    console.log('Model ready.');
  }
  return _embedder;
}

export async function embedBatch(
  db: Database.Database,
  batchSize = 200
): Promise<void> {
  const embedder = await getEmbedder();

  // Process only records without embeddings yet
  const getUnembedded = db.prepare(`
    SELECT r.rowid, r.id, r.entity_name, r.counterparty, r.description
    FROM records r
    LEFT JOIN vec_records v ON r.rowid = v.rowid
    WHERE v.rowid IS NULL
    LIMIT ?
  `);

  const insertVec = db.prepare(`
    INSERT OR REPLACE INTO vec_records (rowid, embedding) VALUES (?, ?)
  `);

  let total = 0;
  while (true) {
    const rows = getUnembedded.all(batchSize) as any[];
    if (rows.length === 0) break;

    for (const row of rows) {
      const text = [row.entity_name, row.counterparty ?? '', row.description]
        .join(' ')
        .slice(0, 512);  // MiniLM max context

      const output = await embedder(text, { pooling: 'mean', normalize: true });
      const vec = new Float32Array(output.data as number[]);

      insertVec.run(row.rowid, new Uint8Array(vec.buffer));
      total++;
    }

    console.log(`  Embedded ${total} records...`);
  }

  console.log(`✅ Embeddings complete: ${total} records`);
}
```

---

## Step 2 — Risk Classification via Claude Haiku Batch API

Submits records in batches of 10,000. 50% cheaper than real-time. Polls until done, then
writes `risk_score` and `tags` back into SQLite.

```typescript
// src/classifier/risk-classifier.ts
import Anthropic from '@anthropic-ai/sdk';
import type Database from 'better-sqlite3';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const SYSTEM = `You are an investigative journalism AI. Classify U.S. legislative records.
Return ONLY valid JSON — no preamble, no markdown fences.

Risk categories (use exact strings):
quid_pro_quo | revolving_door | dark_money | unusual_timing |
self_dealing | foreign_influence | earmark_correlation | shell_structure | clean

Key thresholds:
- quid_pro_quo: contribution > $10,000 within 90 days of related vote/action
- unusual_timing: contribution spike >3x the 12-month average near a key vote
- dark_money: PAC spending >$25,000 with no publicly disclosed donors
- revolving_door: person moved regulator ↔ regulated industry within 2 years`;

export async function classifyAll(
  db: Database.Database,
  batchSize = 10_000
): Promise<void> {
  const getUnclassified = db.prepare(`
    SELECT id, source, record_type, date, entity_name, entity_type,
           counterparty, amount_cents, description
    FROM records
    WHERE risk_score IS NULL
    LIMIT ?
  `);

  const updateRisk = db.prepare(`
    UPDATE records SET risk_score = ?, tags = ? WHERE id = ?
  `);

  let totalClassified = 0;

  while (true) {
    const rows = getUnclassified.all(batchSize) as any[];
    if (rows.length === 0) break;

    console.log(`Submitting batch of ${rows.length} records to Haiku...`);

    const batchId = await submitBatch(rows);
    const results = await pollBatch(batchId);

    // Write results back into SQLite synchronously
    const writeMany = db.transaction((items: typeof results) => {
      for (const r of items) {
        updateRisk.run(r.riskScore, JSON.stringify(r.categories), r.recordId);
      }
    });
    writeMany(results);

    totalClassified += results.length;
    console.log(`  ✓ Classified ${totalClassified} records so far`);
  }

  const highRisk = db.prepare('SELECT COUNT(*) as n FROM records WHERE risk_score >= 7').get() as any;
  console.log(`✅ Classification done. ${highRisk.n} high-risk records (score ≥ 7)`);
}

async function submitBatch(rows: any[]): Promise<string> {
  const requests = rows.map(row => ({
    custom_id: row.id,
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM,
      messages: [{
        role: 'user' as const,
        content: `Classify:
Entity: ${row.entity_name} (${row.entity_type ?? '?'})
Counterparty: ${row.counterparty ?? 'N/A'}
Amount: ${row.amount_cents ? '$' + (row.amount_cents / 100).toLocaleString() : 'N/A'}
Date: ${row.date ?? 'unknown'}
Type: ${row.record_type}
Description: ${String(row.description ?? '').slice(0, 500)}

JSON: {"riskScore":0-10,"categories":[],"confidence":0-100}`,
      }],
    },
  }));

  const batch = await client.messages.batches.create({ requests });
  return batch.id;
}

async function pollBatch(batchId: string) {
  console.log(`  Polling batch ${batchId}...`);
  while (true) {
    const batch = await client.messages.batches.retrieve(batchId);
    if (batch.processing_status === 'ended') break;
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 15_000));
  }
  console.log(' done.');

  const results: { recordId: string; riskScore: number; categories: string[] }[] = [];
  for await (const result of await client.messages.batches.results(batchId)) {
    if (result.result.type !== 'succeeded') continue;
    const block = result.result.message.content[0];
    if (block.type !== 'text') continue;
    try {
      const p = JSON.parse(block.text);
      results.push({
        recordId: result.custom_id,
        riskScore: Math.min(10, Math.max(0, Number(p.riskScore) || 0)),
        categories: Array.isArray(p.categories) ? p.categories : [],
      });
    } catch { /* skip malformed JSON */ }
  }
  return results;
}
```

---

## Step 3 — Deep Analysis (Sonnet, high-risk only)

Only called for `risk_score >= 7`. Uses prompt caching for the legal context block.

```typescript
// src/classifier/deep-analysis.ts
import Anthropic from '@anthropic-ai/sdk';
import type Database from 'better-sqlite3';

const client = new Anthropic();

const LEGAL_CONTEXT = `LEGAL REFERENCE:
- FECA limits: $3,300/candidate/election; $41,300/party committee (2024)
- LDA: lobbying registration required if >$3,000 in activities/quarter
- 18 USC 201: bribery of public officials (up to 15 years)
- 18 USC 1346: honest services fraud
- BCRA: soft money ban, electioneering communication restrictions
- Revolving door: 1-year (2-year senior officials) cooling-off period
- FEC Form 8: independent expenditures >$10,000 trigger disclosure`;

export async function deepAnalyzeHighRisk(db: Database.Database): Promise<void> {
  const getHighRisk = db.prepare(`
    SELECT id, source, record_type, date, entity_name, entity_type,
           counterparty, amount_cents, description, tags
    FROM records WHERE risk_score >= 7
    ORDER BY risk_score DESC
  `);

  const rows = getHighRisk.all() as any[];
  if (rows.length === 0) { console.log('No high-risk records to analyze.'); return; }

  console.log(`Running deep analysis on ${rows.length} high-risk records...`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: [
      {
        type: 'text',
        text: LEGAL_CONTEXT,
        cache_control: { type: 'ephemeral' }, // cached — saves tokens on repeated calls
      },
      {
        type: 'text',
        text: 'You are a senior investigative journalist. Analyze high-risk legislative records for publishable stories. Return only valid JSON.',
      }
    ],
    messages: [{
      role: 'user',
      content: `Analyze these ${rows.length} high-risk records and identify the top stories:

${rows.slice(0, 50).map(r =>
  `[score:${r.risk_score}] ${r.date} | ${r.entity_name}→${r.counterparty ?? '?'} | $${r.amount_cents ? (r.amount_cents/100).toLocaleString() : '?'} | ${String(r.description ?? '').slice(0,200)}`
).join('\n')}
${rows.length > 50 ? `\n...and ${rows.length - 50} more records` : ''}

Return JSON: {"stories":[{"headline":string,"type":string,"actors":string[],"amountUSD":number,"dateRange":string,"legalRisk":"high|medium|low","confidence":0-100,"foiaRequests":string[]}]}`
    }],
  });

  const block = response.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') return;

  try {
    const { stories } = JSON.parse(block.text.replace(/```json\n?|```/g, ''));
    const insert = db.prepare(`
      INSERT OR REPLACE INTO stories (id, story_type, headline, confidence, actors, foia_requests, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    for (const s of stories) {
      insert.run(
        `story-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        s.type, s.headline, s.confidence,
        JSON.stringify(s.actors),
        JSON.stringify(s.foiaRequests)
      );
    }
    console.log(`✅ Deep analysis done. ${stories.length} story candidates saved.`);
  } catch (e) {
    console.error('Failed to parse deep analysis response:', e);
  }
}
```

---

## References

- `references/risk-thresholds.md` — Configurable thresholds per record type and source
- `references/legal-statutes.md` — Full statute reference for violation tagging
