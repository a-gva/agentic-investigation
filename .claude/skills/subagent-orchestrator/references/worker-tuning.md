# Worker Tuning

| CPU cores | Recommendation |
|-----------|----------------|
| 4 | 3 ETL workers (one per source) |
| 8+ | 3 ETL workers; increase embed batch to 400 |
| 16+ | Consider splitting house XML across 2 workers by year directory |

House XML dominates file count (~410K files). The house worker is typically the bottleneck.

Memory: 8GB RAM minimum. SQLite `cache_size = -64000` (64MB) in `setup.ts`.
