# GAIN Challenge Submission

Brief map of this submission package per [CHALLENGE.md](../CHALLENGE.md).

## Included Skills

| Skill | Purpose | Location |
|-------|---------|----------|
| `legislative-etl` | Ingest senate JSON, house XML, congress_press JSONL into SQLite | `../.claude/skills/legislative-etl/` |
| `entity-resolver` | Normalize and cross-link entities across sources | `../.claude/skills/entity-resolver/` |
| `risk-classifier` | Local embeddings + Haiku batch risk triage | `../.claude/skills/risk-classifier/` |
| `story-detector` | Pattern detectors, say-vs-pay, story briefs | `../.claude/skills/story-detector/` |
| `subagent-orchestrator` | End-to-end resumable pipeline | `../.claude/skills/subagent-orchestrator/` |

(`skills/` at repo root is a symlink to `.claude/skills/`.)

## Findings

See [findings/FINDINGS.md](findings/FINDINGS.md) for newsworthy discoveries produced by running the skills on the GAIN corpus.

## Interaction Traces

Full model session logs keyed to skill invocations:

```
traces/
  legislative-etl/{run-id}.json
  entity-resolver/{run-id}.json
  risk-classifier/{run-id}.json
  story-detector/{run-id}.json
  subagent-orchestrator/{run-id}.json
```

Traces are also recorded in the `agent_runs` table (`trace_path` column) during pipeline execution.

## Outside Data Used

| Source | Used for | Findings affected |
|--------|----------|-------------------|
| _(none required)_ | Core pipeline uses only provided corpus | All corpus-grounded findings |
| FEC API | _(optional Phase 7)_ | Contribution validation if enabled |
| Congress.gov | _(optional Phase 7)_ | Bill/committee joins if enabled |
| FARA | _(optional Phase 7)_ | Foreign-agent cross-check if enabled |

## Conflicts of Interest

_(Team members: disclose any employment, consulting, or financial relationships relevant to findings here.)_

## Legal Violation Flags

If any finding suggests potential legal violations, it is flagged in FINDINGS.md with `legal_violation_flag: true` for evaluation panel review.
