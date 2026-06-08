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
