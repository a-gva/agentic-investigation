# Welcome to the Challenge!

This is a Challenge for the Northwestern University Agentic AI Investigative Journalism Challenge. It is a follow-up to the [Agentic AI Investigative Journalism Challenge](https://nuit.ai/challenges/investigative-journalism-with-ai).
Check the [CHALLENGE.md](CHALLENGE.md) file for more details.

# First steps

Examine the data. Writing an effective skill will mean knowing the data we’ll be working with: lobbying disclosure reports and other data from the U.S. Congress. Read the data manual here.
Join the conversation.

# Links and resources

[Challenge data](https://drive.google.com/drive/folders/1_6y9ZzC3tI2GjM1tZqz4lYHvBYyPcuwN?usp=sharing) — Google Drive containing the lobbying data for the challenge
[Data manual](https://drive.google.com/file/d/1O_z17tLjW1h44kR_-XJyg46DlH_LJb8c/view?usp=sharing) — Northwestern’s detailed write-up of how to use the data and what it contains
[Code of conduct](https://nuit.ai/challenges/investigative-journalism-with-ai/code-of-conduct) — Northwestern’s rules for participation
[Agent skills specification](https://nuit.ai/challenges/investigative-journalism-with-ai/agent-skills-specification) — The specification page and details on writing and using skills
[Using Skills in Claude](https://nuit.ai/challenges/investigative-journalism-with-ai/using-skills-in-claude) — Anthropic’s guide for extending Claude’s capabilities

# Raw data overview

The raw data is stored in the `data/` directory.

```
data/
  congress_press/
  lobbying_disclosures/
  other_data/
```

The data is stored in the `data/` directory.

Check the [RAW_DATA_OVERVIEW.md](RAW_DATA_OVERVIEW.md) file for more details.

# Skills

Skills are stored in `.claude/skills/` (Cursor reads this path).

```
.claude/skills/          # canonical — Cursor + Claude
  legislative-etl/
  entity-resolver/
  risk-classifier/
  story-detector/
  subagent-orchestrator/
```

Check the [SKILLS.md](SKILLS.md) file for more details.

# How to run

## Prerequisites (one-time setup)

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # required for risk-classifier and story-detector only

pnpm install         # install all dependencies
pnpm init            # create investigation.db schema
```

## Pipeline steps (invoke each skill in order)

| Step | Script | Skill | What it does | API cost | Runtime |
|------|--------|-------|-------------|----------|---------|
| 1 | `pnpm etl` | `/legislative-etl` | Parses Senate JSON, House XML, and press JSONL into `investigation.db` | $0 | 30–60 min |
| 2 | `pnpm resolve` | `/entity-resolver` | Normalizes entity names, fuzzy-matches Senate↔House pairs, links press `bioguide_id` | $0 | 15–30 min |
| 3 | `pnpm classify` | `/risk-classifier` | Generates local ONNX embeddings, then classifies all records via Haiku Batch API | ~$5–15 | 2–4 h |
| 4 | `pnpm stories` | `/story-detector` | Runs SQL pattern detectors, say-vs-pay correlator, generates Sonnet briefs | ~$5–15 | 30–60 min |

Run the full pipeline in sequence: `pnpm run`

## One-shot alternative

Type `/subagent-orchestrator` to run the full pipeline end-to-end using `worker_threads`. Resumable via `agent_runs` and `etl_runs` tables if interrupted.

## Export submission artifacts

```bash
pnpm export
```

Writes `submission/findings/FINDINGS.md` and copies traces to `submission/traces/`.

## Data available

| Source | Location | Format | Est. rows |
|--------|----------|--------|-----------|
| Senate LDA filings | `data/senate/*/filings/` | JSON | ~800K activity rows |
| Senate contributions | `data/senate/*/contributions/` | JSON | ~637K item rows |
| House LDA filings | `data/house/*/` | XML (~22K files/quarter) | ~400–800K rows |
| Congress press | `data/congress_press/*.jsonl` | JSONL | ~11K releases (Jan–Mar 2026) |

See [PLAN.md](PLAN.md) for full architecture and cost estimates.

## Available scripts

| Script | Command | Description |
|--------|---------|-------------|
| `init` | `pnpm init` | Create `investigation.db` with full schema |
| `etl` | `pnpm etl` | Ingest all raw data into the database |
| `resolve` | `pnpm resolve` | Resolve and crosswalk entities |
| `classify` | `pnpm classify` | Embed records and run risk classification |
| `stories` | `pnpm stories` | Detect story patterns and generate briefs |
| `run` | `pnpm run` | Run etl → resolve → classify → stories in sequence |
| `export` | `pnpm export` | Write findings and evidence pack to `submission/` |
| `query` | `pnpm query` | Interactive query of the database |
| `typecheck` | `pnpm typecheck` | TypeScript type-check without building |

# Technical requirements

- Subagents shold act locally with deterministic outputs on the raw data - no external AI api calls for the ETL.

# Submission requirements

**Dataset**

- Federal government corpus (2022–March 2026): lobbying filings + congressional press releases
- Access granted upon team registration

**Submission Package (4 components)**

- **Agent Skill(s)** — reusable workflow directory following the Agent Skills spec: a `SKILL.md` with YAML frontmatter, optional `scripts/`, `references/`, and `assets/`; must be self-contained and validate against the spec
- **Findings Report** — written summary of newsworthy discoveries (accurate, sourced to specific records, genuinely of public interest — not just dataset summaries)
- **Interaction Traces** — full logs of model sessions (raw JSON or rendered page) including inputs, tool calls, outputs, and human interventions; keyed to skill invocations
- **README.md** — maps skills to findings, lists outside data used, notes conflicts of interest, flags any possible legal violations

**Evaluation Criteria**

- Findings must be accurate, traceable, and newsworthy (gating requirement)
- Skill scored 0–3 on four equally weighted dimensions:
  - Investigation organization (tracks open/closed threads across sessions)
  - Corpus efficiency (offloads extraction/filtering to deterministic tools)
  - Human verifiability (every claim tied to a source, auditable traces)
  - Novel investigative capability (entity resolvers, cross-reference tools, etc.)
- Skill must be **reproducible** — max score of 1 on any dimension if it can't be re-run

**Ethics**

- Apply newsroom editorial judgment
- Flag potential legal violations in the report and to the evaluation panel
