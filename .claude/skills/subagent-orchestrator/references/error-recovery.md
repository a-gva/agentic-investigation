# Error Recovery

## Resumable phases

1. Check `agent_runs` for completed phases matching current `inputs_hash` (hash of `--data-dir` path + file mtimes).
2. ETL: `etl_runs` tracks per-file completion — re-run only files without `finished_at`.
3. Embeddings: `vec_records` LEFT JOIN skips already-embedded rowids.
4. Classification: `WHERE risk_score IS NULL` picks up unclassified records.
5. Stories: `INSERT OR REPLACE` on story id allows re-generation.

## After interruption

```bash
# Safe to re-run — idempotent upserts and skip logic
npx tsx pipeline.ts --data-dir ./data --db ./investigation.db
```

## Corrupt database

Delete `investigation.db` and re-run from scratch. WAL files (`-wal`, `-shm`) can be removed if present.
