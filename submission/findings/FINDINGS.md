# Findings Report

Newsworthy discoveries from running the investigation pipeline on the GAIN corpus (2022–2026 Q1).

> **Template:** Replace placeholders below with verified findings after running the pipeline.
> Each finding must cite specific primary-source records — not a summary of the dataset.

---

## Finding 1

**Headline:** _(publishable headline)_

**Story type:** revolving_door | foreign_influence | contribution_routing | filing_discrepancy | say_vs_pay | spend_anomaly | data_quality

**Actors:**
- _(name, role)_

**Timeline:**
- _(date): _(event)_

**Evidence citations:**
| Record ID | Source path | Field | Excerpt |
|-----------|-------------|-------|---------|
| _(id)_ | `data/senate/...` or `data/house/...` or `data/congress_press/...` | _(field)_ | _(quote)_ |

**Confidence:** _(0–100)_

**Legal violation flag:** false

**Skill that produced this finding:** story-detector

**Trace:** `traces/story-detector/{run-id}.json`

---

## Finding 2

_(Repeat structure above.)_

---

## Finding 3

_(Repeat structure above. Minimum 3 findings with primary-source citations before submission.)_

---

## Editorial Notes

- All claims spot-checked against raw records via `export-evidence-pack.ts`
- Findings that used optional external enrichment (FEC, Congress.gov, FARA) are noted in the evidence table
