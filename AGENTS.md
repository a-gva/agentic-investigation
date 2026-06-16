# Agent Instructions — agentic-investigation codebase

> Full challenge context, submission requirements, and pipeline overview: [CLAUDE.md](CLAUDE.md)

This is the TypeScript pipeline codebase for the GAIN challenge. It parses ~2–2.5M legislative records into PostgreSQL and runs multi-phase analysis (ETL → entity resolution → classification → story detection).

---

## ⚠️ Stack divergence (read before touching architecture)

Several documents in this repo (PLAN.md, `.claude/skills/` SKILL.md files) describe an **SQLite/better-sqlite3/sqlite-vec** approach. The **actual implementation uses PostgreSQL + pgvector**. Do not introduce SQLite dependencies.

| What docs say | What the code actually is |
|---------------|--------------------------|
| SQLite / better-sqlite3 | PostgreSQL 16 via Docker |
| sqlite-vec | pgvector extension |
| Single `.db` file | `DATABASE_URL` env var |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | **Bun** (not Node.js) |
| Package manager | **pnpm** |
| Database | PostgreSQL 16 + pgvector (Docker) |
| ORM | Drizzle ORM |
| Schema file | [`src/db/schema.ts`](src/db/schema.ts) |
| Migrations | [`drizzle/`](drizzle/) |
| XML parsing | fast-xml-parser |
| JSON streaming | stream-json |
| Test runner | Vitest |
| Env validation | @t3-oss/env-nuxt + Zod |

---

## Essential commands

```bash
# 1. Start PostgreSQL (required before any DB work)
docker compose up -d

# 2. Apply schema
pnpm db:migrate      # apply migration files (preferred for prod)
pnpm db:push         # push schema directly (dev only)
pnpm db:studio       # open Drizzle Studio UI

# 3. Run full ETL pipeline (migrate + ingest all corpus files)
pnpm etl             # = pnpm db:migrate && bun run src/modules/etl/pipeline.ts --data-dir ./data

# 4. Dev
pnpm test            # Vitest
pnpm typecheck       # tsc --noEmit
```

**`DATABASE_URL` must be set** — defined in `.env`, validated in [`src/modules/env/index.ts`](src/modules/env/index.ts).

---

## Source layout

```
src/
  db/
    schema.ts       ← Drizzle table definitions (records, entities, stories, …)
    index.ts        ← openDB() helper
  modules/
    env/            ← @t3-oss/env-nuxt env validation
    etl/
      pipeline.ts   ← ETL entry point — resume-safe, worker-per-source
      ingest-json.ts, ingest-xml.ts, ingest-press.ts
      normalize-senate.ts, normalize-house.ts
      insert-records.ts, detect-source.ts, coerce.ts
    tests/
  resolve/          ← entity resolution (Phase 2)
```

---

## Database schema (core tables)

| Table | Purpose |
|-------|---------|
| `records` | Normalized legislative records; `source` = `senate\|house\|congress_press`; `raw_hash` for dedup |
| `entities` | Canonical entities after resolution; links `bioguide_id`, `senate_id`, `house_id` |
| `stories` | Story candidates with `newsworthiness` + `confidence` scores |
| `evidence_links` | Ties stories → specific records with excerpts and `source_path` |
| `investigation_ledger` | Resumable investigation state |
| `agent_runs` | Subagent session tracking |
| `etl_runs` | Per-file ETL progress for resume-safe restarts |

---

## Skills (GAIN challenge)

Challenge skills live in [`.claude/skills/`](.claude/skills/) — Claude/GAIN format, **not** `.github/`:

| Skill | Phase | What it does |
|-------|-------|-------------|
| `legislative-etl` | 1 | Stream-parse corpus → `records` table |
| `entity-resolver` | 2 | Fuzzy-match + canonical entities |
| `risk-classifier` | 3–4 | Embeddings (HuggingFace ONNX) + Haiku Batch classification |
| `story-detector` | 5 | SQL pattern detectors + Sonnet story briefs |
| `subagent-orchestrator` | 6 | Resumable agent runs + evidence-pack export |

---

## Common pitfalls

- **Docker must be running** before any `pnpm db:*` or `pnpm etl` commands.
- **Use `bun run <file.ts>`** for one-off scripts — not `node` or `npx tsx` (Bun is configured as runtime).
- **ETL is resume-safe** via `etl_runs` table — re-running `pnpm etl` skips already-processed files.
- **`raw_hash` deduplication** — never insert without generating the hash; see `insert-records.ts`.
- **Migrations in `drizzle/`** — prefer `pnpm db:migrate` over `pnpm db:push` in shared environments.
- **GAIN skills spec** — `SKILL.md` frontmatter must have `name` matching folder name; description is the discovery trigger.