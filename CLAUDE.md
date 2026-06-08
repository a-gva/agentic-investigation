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
