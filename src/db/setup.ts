import BetterSQLite from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema.js';

export type DB = BetterSQLite3Database<typeof schema>;

export function openDB(dbPath: string): { db: DB; close: () => void } {
  const dir = dirname(dbPath);
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });

  const sqlite = new BetterSQLite(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('cache_size = -64000'); // 64MB page cache

  // DDL: keep raw SQL for FTS5 / vec virtual tables which Drizzle doesn't model.
  // Column names here must exactly match schema.ts.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      source        TEXT    NOT NULL CHECK(source IN ('senate','house','congress_press')),
      sub_source    TEXT    NOT NULL,
      record_type   TEXT,
      date          TEXT,
      fiscal_year   INTEGER,
      entity_name   TEXT,
      entity_type   TEXT,
      entity_state  TEXT,
      counterparty  TEXT,
      amount_cents  INTEGER,
      description   TEXT,
      tags          TEXT    DEFAULT '[]',
      raw_hash      TEXT    UNIQUE NOT NULL,
      risk_score    REAL,
      chunk_index   INTEGER DEFAULT 0,
      metadata      TEXT    DEFAULT '{}',
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_source      ON records(source);
    CREATE INDEX IF NOT EXISTS idx_records_fiscal_year ON records(fiscal_year);
    CREATE INDEX IF NOT EXISTS idx_records_entity_name ON records(entity_name);
    CREATE INDEX IF NOT EXISTS idx_records_risk_score  ON records(risk_score);

    CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(
      entity_name, counterparty, description,
      content='records', content_rowid='id'
    );

    CREATE TABLE IF NOT EXISTS entities (
      canonical_id  INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_name      TEXT NOT NULL,
      source        TEXT NOT NULL,
      entity_type   TEXT,
      bioguide_id   TEXT,
      senate_id     TEXT,
      house_id      TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stories (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      story_type       TEXT,
      headline         TEXT,
      confidence       REAL,
      newsworthiness   REAL,
      actors           TEXT DEFAULT '[]',
      financial        TEXT DEFAULT '{}',
      timeline         TEXT DEFAULT '[]',
      legal            TEXT DEFAULT '[]',
      foia_requests    TEXT DEFAULT '[]',
      record_ids       TEXT DEFAULT '[]',
      evidence_links   TEXT DEFAULT '[]',
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evidence_links (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id     INTEGER REFERENCES stories(id),
      record_id    INTEGER REFERENCES records(id),
      field        TEXT,
      excerpt      TEXT,
      source_path  TEXT,
      line_or_uuid TEXT
    );

    CREATE TABLE IF NOT EXISTS investigation_ledger (
      thread_id  TEXT PRIMARY KEY,
      status     TEXT DEFAULT 'open' CHECK(status IN ('open','verified','cold','published')),
      summary    TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_name  TEXT,
      started_at  TEXT DEFAULT (datetime('now')),
      finished_at TEXT,
      inputs_hash TEXT,
      output_path TEXT,
      trace_path  TEXT,
      status      TEXT DEFAULT 'running'
    );

    CREATE TABLE IF NOT EXISTS etl_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path    TEXT UNIQUE,
      source       TEXT,
      rows_written INTEGER DEFAULT 0,
      started_at   TEXT DEFAULT (datetime('now')),
      finished_at  TEXT,
      status       TEXT DEFAULT 'running'
    );
  `);

  const db = drizzle(sqlite, { schema });
  return { db, close: () => sqlite.close() };
}

// When this file is run directly: pnpm init
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] ?? './investigation.db';
  const { close } = openDB(dbPath);
  console.log(`Database initialised at ${dbPath}`);
  close();
}
