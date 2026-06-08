# Newsworthiness Scoring

Local formula in `generate-brief.ts` (no API):

| Factor | Weight |
|--------|--------|
| High-exposure actors | up to 30 pts |
| Legal exposure items | up to 24 pts |
| Model confidence | up to 30 pts |
| Financial magnitude | up to 16 pts |

Stories scoring < 40 newsworthiness are deprioritized for FINDINGS.md export.

Editorial bar (per CHALLENGE.md): claims must be accurate, sourced to specific records, and of genuine public interest — not a dataset summary.
