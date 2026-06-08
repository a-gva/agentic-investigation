---
name: risk-classifier
description: >
  Use this skill to classify legislative records already in a local SQLite database for
  corpus-grounded journalistic risk signals: revolving door, foreign influence, lobbyist
  contribution routing, undisclosed spend gaps, and Senate↔House mismatches. Generates
  384-dimension embeddings locally using @huggingface/transformers and stores them in
  sqlite-vec. Uses Claude Haiku via Batch API only for classification. Triggers after
  entity-resolver completes and before story-detector.
---

# Risk Classifier Skill

Two steps: (1) local embeddings via `@huggingface/transformers` stored in `sqlite-vec`,
(2) risk scoring via Claude Haiku Batch API. Everything except the Claude API call is local.

## Dependencies

```bash
npm install @huggingface/transformers @anthropic-ai/sdk
```

## Step 1 — Local Embeddings

Model: `Xenova/all-MiniLM-L6-v2` (ONNX, ~23MB, dtype=q8). Batch size 200.

Implementation: `src/classifier/embedder.ts`

Input text: `entity_name + counterparty + description` (512 chars max).

## Step 2 — Risk Classification (Haiku Batch)

Corpus-grounded categories only:

| Category | Signal in record text/metadata |
|----------|-------------------------------|
| `revolving_door` | `covered_position` / prior govt role text |
| `foreign_influence` | `foreign_entities` non-empty |
| `contribution_routing` | payee ≠ honoree in contribution items |
| `undisclosed_spend` | missing income/expenses on lobbying filing |
| `senate_house_mismatch` | metadata flags from entity-resolver |
| `say_vs_pay` | press + lobbying co-occurrence (pre-flagged) |
| `clean` | no signal |

**Do not classify** quid pro quo, earmarks, or dark-money PAC patterns unless optional FEC enrichment (Phase 7) has been run.

```typescript
const SYSTEM = `You are an investigative journalism AI. Classify U.S. congressional lobbying
and press records from the GAIN corpus. Return ONLY valid JSON.

Risk categories (use exact strings):
revolving_door | foreign_influence | contribution_routing | undisclosed_spend |
senate_house_mismatch | say_vs_pay | clean

Do NOT use quid_pro_quo, dark_money, or earmark_correlation unless FEC data is present.`;
```

Implementation: `src/classifier/risk-classifier.ts` — batches of 10,000, poll every 15s.

## Step 3 — Deep Analysis (Sonnet, high-risk only)

Only `risk_score >= 7`. Implementation: `src/classifier/deep-analysis.ts`.

## Scale

~2M records. Estimated Haiku batch cost: ~$4–8. Top 5% (~100K) to Sonnet: ~$30–60.

## References

- `references/risk-thresholds.md` — per-category thresholds
- `references/legal-statutes.md` — LDA, revolving door, FARA context

## Scripts

See `scripts/README.md`.
