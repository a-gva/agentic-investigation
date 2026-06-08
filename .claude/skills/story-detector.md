---
name: story-detector
description: >
  Use this skill to find publishable investigative journalism stories by clustering
  high-risk records already in a local SQLite database. Performs entity co-occurrence
  clustering with SQL, finds related records using sqlite-vec cosine similarity, generates
  narrative story briefs with Claude Sonnet, and ranks leads by newsworthiness. Outputs
  structured StoryCandidate objects saved back to SQLite. Triggers after risk-classifier
  completes. Use when the user wants to identify corruption narratives, lobbying patterns,
  conflict-of-interest stories, generate FOIA requests, or see ranked investigative leads.
---

# Story Detector Skill

Turns risk-scored records into ranked journalism leads using SQL clustering + vector search
(both local, no external services) + Claude Sonnet for narrative generation.

---

## Step 1 — Entity Co-occurrence Clustering (pure SQL)

Groups high-risk records by shared entity pairs that appear together multiple times.

```typescript
// src/stories/cluster.ts
import type Database from 'better-sqlite3';

export interface EntityCluster {
  e1: string;
  e2: string;
  coOccurrences: number;
  totalAmountCents: number;
  firstSeen: string;
  lastSeen: string;
  recordIds: string[];
  avgRisk: number;
}

export function clusterEntities(
  db: Database.Database,
  minRisk = 7,
  minCoOccurrences = 2
): EntityCluster[] {
  const rows = db.prepare(`
    WITH high_risk AS (
      SELECT id, entity_name, counterparty, date, amount_cents, risk_score
      FROM records
      WHERE risk_score >= ?
        AND entity_name IS NOT NULL
        AND counterparty IS NOT NULL
    )
    SELECT
      a.entity_name       AS e1,
      a.counterparty      AS e2,
      COUNT(*)            AS co_occurrences,
      SUM(COALESCE(a.amount_cents, 0)) AS total_amount_cents,
      MIN(a.date)         AS first_seen,
      MAX(a.date)         AS last_seen,
      AVG(a.risk_score)   AS avg_risk,
      json_group_array(a.id) AS record_ids_json
    FROM high_risk a
    GROUP BY a.entity_name, a.counterparty
    HAVING COUNT(*) >= ?
    ORDER BY total_amount_cents DESC, avg_risk DESC
    LIMIT 200
  `).all(minRisk, minCoOccurrences) as any[];

  return rows.map(r => ({
    e1: r.e1,
    e2: r.e2,
    coOccurrences: r.co_occurrences,
    totalAmountCents: r.total_amount_cents,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    avgRisk: r.avg_risk,
    recordIds: JSON.parse(r.record_ids_json),
  }));
}
```

---

## Step 2 — Vector Similarity Expansion (sqlite-vec)

Expands each cluster by finding semantically related records nearby in embedding space.

```typescript
// src/stories/expand-cluster.ts
import type Database from 'better-sqlite3';

export function expandCluster(
  db: Database.Database,
  seedRowids: number[],
  topK = 50,
  minSimilarity = 0.78
): number[] {
  if (seedRowids.length === 0) return [];

  // Compute centroid embedding from seed records
  const placeholders = seedRowids.map(() => '?').join(',');
  const vecs = db.prepare(`
    SELECT embedding FROM vec_records WHERE rowid IN (${placeholders})
  `).all(...seedRowids) as { embedding: Buffer }[];

  if (vecs.length === 0) return [];

  // Average the vectors (manual centroid)
  const dim = 384;
  const centroid = new Float32Array(dim);
  for (const { embedding } of vecs) {
    const arr = new Float32Array(embedding.buffer, embedding.byteOffset, dim);
    for (let i = 0; i < dim; i++) centroid[i] += arr[i] / vecs.length;
  }

  // KNN search via sqlite-vec
  const results = db.prepare(`
    SELECT v.rowid, vec_distance_cosine(v.embedding, ?) AS distance
    FROM vec_records v
    JOIN records r ON r.rowid = v.rowid
    WHERE r.risk_score >= 5
    ORDER BY distance
    LIMIT ?
  `).all(new Uint8Array(centroid.buffer), topK) as { rowid: number; distance: number }[];

  return results
    .filter(r => (1 - r.distance) >= minSimilarity)
    .map(r => r.rowid);
}
```

---

## Step 3 — Story Brief Generation (Claude Sonnet)

```typescript
// src/stories/generate-brief.ts
import Anthropic from '@anthropic-ai/sdk';
import type Database from 'better-sqlite3';
import type { EntityCluster } from './cluster';

const client = new Anthropic();

export interface StoryCandidate {
  id: string;
  storyType: string;
  headline: string;
  subheadline: string;
  confidence: number;
  newsworthiness: number;
  actors: { name: string; role: string; exposure: string }[];
  financialSummary: { totalUSD: number; transactions: number; pattern: string; dateRange: string };
  timeline: { date: string; event: string }[];
  legalExposure: { law: string; description: string }[];
  missingPieces: string[];
  foiaRequests: { agency: string; description: string; priority: string }[];
  recordIds: string[];
}

const EDITOR_SYSTEM = {
  type: 'text' as const,
  text: `You are a senior investigative editor at a major U.S. newspaper. Given clustered
legislative records, determine if a publishable story exists. Be rigorous — only flag
genuine public interest stories with verifiable facts. Return ONLY valid JSON.`,
  cache_control: { type: 'ephemeral' as const },
};

export async function generateBrief(
  db: Database.Database,
  cluster: EntityCluster,
  expandedRowids: number[]
): Promise<StoryCandidate | null> {
  // Fetch the actual records
  const ids = cluster.recordIds.slice(0, 40); // cap context size
  const placeholders = ids.map(() => '?').join(',');
  const records = db.prepare(`
    SELECT date, record_type, entity_name, counterparty, amount_cents, description, risk_score
    FROM records WHERE id IN (${placeholders})
    ORDER BY date
  `).all(...ids) as any[];

  if (records.length < 2) return null;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: [EDITOR_SYSTEM],
    messages: [{
      role: 'user',
      content: `Evaluate ${records.length} records: ${cluster.e1} ↔ ${cluster.e2}
Period: ${cluster.firstSeen} → ${cluster.lastSeen}
Total: $${(cluster.totalAmountCents / 100).toLocaleString()} across ${cluster.coOccurrences} transactions

Records:
${records.map(r =>
  `• ${r.date ?? '?'} | ${r.record_type} | ${r.entity_name}→${r.counterparty ?? '?'} | ` +
  `$${r.amount_cents ? (r.amount_cents/100).toLocaleString() : '?'} | ${String(r.description ?? '').slice(0,180)}`
).join('\n')}

If a publishable story exists, return:
{"storyExists":true,"storyType":"corruption|lobbying|conflict|financial|foreign","headline":string,"subheadline":string,"confidence":0-100,"actors":[{"name":string,"role":string,"exposure":"high|medium|low"}],"financialSummary":{"totalUSD":number,"transactions":number,"pattern":string,"dateRange":string},"timeline":[{"date":string,"event":string}],"legalExposure":[{"law":string,"description":string}],"missingPieces":string[],"foiaRequests":[{"agency":string,"description":string,"priority":"critical|high|medium"}]}

If no story: {"storyExists":false}`,
    }],
  });

  const block = response.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') return null;

  try {
    const parsed = JSON.parse(block.text.replace(/```json\n?|```/g, ''));
    if (!parsed.storyExists) return null;

    const story: StoryCandidate = {
      id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      storyType: parsed.storyType,
      headline: parsed.headline,
      subheadline: parsed.subheadline,
      confidence: parsed.confidence,
      newsworthiness: scoreNewsworthiness(parsed),
      actors: parsed.actors ?? [],
      financialSummary: parsed.financialSummary,
      timeline: parsed.timeline ?? [],
      legalExposure: parsed.legalExposure ?? [],
      missingPieces: parsed.missingPieces ?? [],
      foiaRequests: parsed.foiaRequests ?? [],
      recordIds: cluster.recordIds,
    };

    // Persist to SQLite
    db.prepare(`
      INSERT OR REPLACE INTO stories
        (id, story_type, headline, subheadline, confidence, newsworthiness,
         actors, financial, timeline, legal, missing_pieces, foia_requests, record_ids)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      story.id, story.storyType, story.headline, story.subheadline,
      story.confidence, story.newsworthiness,
      JSON.stringify(story.actors),
      JSON.stringify(story.financialSummary),
      JSON.stringify(story.timeline),
      JSON.stringify(story.legalExposure),
      JSON.stringify(story.missingPieces),
      JSON.stringify(story.foiaRequests),
      JSON.stringify(story.recordIds),
    );

    return story;
  } catch {
    return null;
  }
}

function scoreNewsworthiness(parsed: any): number {
  let score = 0;
  const highExposure = (parsed.actors ?? []).filter((a: any) => a.exposure === 'high').length;
  score += Math.min(highExposure * 12, 30);
  score += Math.min((parsed.legalExposure ?? []).length * 8, 24);
  score += Math.min(parsed.confidence ?? 0, 100) * 0.3;
  score += Math.min((parsed.financialSummary?.totalUSD ?? 0) / 1_000_000, 10) * 1.6;
  return Math.min(Math.round(score), 100);
}
```

---

## Step 4 — Run All & Print Ranked Stories

```typescript
// src/stories/run.ts
import type Database from 'better-sqlite3';
import { clusterEntities } from './cluster';
import { expandCluster } from './expand-cluster';
import { generateBrief } from './generate-brief';

export async function detectStories(db: Database.Database): Promise<void> {
  const clusters = clusterEntities(db);
  console.log(`🔍 Found ${clusters.length} entity clusters to analyze`);

  const stories = [];
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    process.stdout.write(`  [${i+1}/${clusters.length}] ${cluster.e1} ↔ ${cluster.e2}... `);

    const seedRowids: number[] = [];   // resolve IDs to rowids if needed
    const expanded = expandCluster(db, seedRowids);
    const story = await generateBrief(db, cluster, expanded);

    if (story) {
      stories.push(story);
      console.log(`✅ STORY: "${story.headline}" (confidence: ${story.confidence}%)`);
    } else {
      console.log('no story');
    }
  }

  // Print ranked
  const ranked = stories.sort((a, b) => b.newsworthiness - a.newsworthiness);
  console.log(`\n📰 ${ranked.length} stories found:\n`);
  ranked.forEach((s, i) => {
    console.log(`${i+1}. [${s.newsworthiness}/100] ${s.headline}`);
    console.log(`   Type: ${s.storyType} | Confidence: ${s.confidence}%`);
    console.log(`   FOIA: ${s.foiaRequests.length} requests pending`);
    console.log();
  });
}
```

---

## References

- `references/newsworthiness-criteria.md` — Editorial criteria and scoring breakdown
- `references/foia-agencies.md` — Agency list with request templates and typical response times
