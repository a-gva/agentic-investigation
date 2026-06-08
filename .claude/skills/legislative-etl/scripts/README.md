# legislative-etl scripts

Implementation source files (create during pipeline build):

- `../../../../src/etl/ingest-json.ts`
- `../../../../src/etl/ingest-xml.ts`
- `../../../../src/etl/ingest-press.ts`
- `../../../../src/etl/normalize-senate.ts`
- `../../../../src/etl/normalize-house.ts`
- `../../../../src/etl/detect-source.ts`
- `../../../../src/etl/upsert.ts`
- `../../../../src/etl/scan-folder.ts`

Run ETL via the orchestrator: `npx tsx pipeline.ts --data-dir ./data`
