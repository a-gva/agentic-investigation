---
name: story-detector
description: >
  Use this skill to find publishable investigative journalism stories from the GAIN corpus
  by running corpus-grounded pattern detectors (revolving door, foreign influence,
  contribution routing, Senate↔House discrepancies, say-vs-pay), SQL clustering, sqlite-vec
  expansion, and Claude Sonnet narrative briefs. Outputs ranked StoryCandidate objects with
  evidence_links for editor verification. Triggers after risk-classifier completes.
---

# Story Detector Skill

Turns risk-scored records into ranked journalism leads. All pattern detection is local SQL;
only brief generation uses Claude Sonnet.

## Detectable story types

| Type | Detector module | Threshold |
|------|-----------------|-----------|
| Revolving door | `cluster.ts` + metadata filter | any covered_position match |
| Foreign influence | metadata filter | foreign_entities non-empty |
| Contribution routing | SQL on contribution records | > $1,000, payee ≠ honoree |
| Filing discrepancy | `senate-house-diff.ts` | any amount/issue delta |
| Say vs pay | `say-vs-pay.ts` | co-occurrence ≥ 2 |
| Spend anomaly | SQL window aggregate | > 3× trailing quarterly avg |
| Data quality | SQL group-by on null fields | ≥ 5 filings same registrant |

## Step 1 — Pattern detectors

```typescript
// src/stories/say-vs-pay.ts
// Join congress_press records (bioguide_id + extracted topics)
// to lobbying records in same fiscal quarter targeting member's chamber.

// src/stories/senate-house-diff.ts
// Surface entity-resolver discrepancies as story seeds.
```

## Step 2 — Entity co-occurrence clustering

`src/stories/cluster.ts` — GROUP BY entity↔counterparty on high-risk records.

## Step 3 — Vector expansion

`src/stories/expand-cluster.ts` — sqlite-vec cosine KNN from cluster centroid.

## Step 4 — Story brief + evidence links

`src/stories/generate-brief.ts` — Sonnet generates headline, timeline, actors.

Every story persists `evidence_links` pointing to:
- `filing_uuid` (Senate)
- XML file path (House)
- `url` (Congress press)

```typescript
// evidence_links row per cited record
db.prepare(`
  INSERT INTO evidence_links (story_id, record_id, field, excerpt, source_path, line_or_uuid)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(storyId, recordId, field, excerpt, sourcePath, citation);
```

## Step 5 — Rank and export

`src/stories/run.ts` orchestrates detectors → cluster → expand → brief → rank.

Export for submission: `src/review/export-findings.ts` → `submission/findings/FINDINGS.md`

## References

- `references/newsworthiness-criteria.md`
- `references/foia-agencies.md`

## Scripts

See `scripts/README.md`.
