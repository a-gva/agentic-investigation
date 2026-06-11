import { sql } from 'drizzle-orm';
import {
  date,
  jsonb,
  numeric,
  pgTableCreator,
  serial,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { v7 } from 'uuid';

export const createTable = pgTableCreator((name) => name);
// ─── records ─────────────────────────────────────────────────────────────────

export const records = createTable('records', {
  id: serial('id').primaryKey(),
  uuid: text('uuid')
    .notNull()
    .unique()
    .$defaultFn(() => v7()),
  source: text('source').notNull(),
  subSource: text('sub_source').notNull(),
  recordType: text('record_type').notNull(),
  date: date('date').notNull(),
  fiscalYear: smallint('fiscal_year').notNull(),
  entityName: text('entity_name').notNull(),
  entityType: text('entity_type').notNull(),
  entityState: text('entity_state').notNull(),
  counterparty: text('counterparty').notNull(),
  amountCents: numeric('amount_cents').notNull(),
  description: text('description').notNull(),
  tags: jsonb('tags')
    .$type<string[]>()
    .default(sql`'[]'::jsonb`),
  rawHash: text('raw_hash').notNull().unique(),
  riskScore: smallint('risk_score'),
  chunkIndex: smallint('chunk_index').default(0),
  metadata: jsonb('metadata')
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type DbRecord = typeof records.$inferSelect;
export type NewDbRecord = typeof records.$inferInsert;

// ─── entities ────────────────────────────────────────────────────────────────

export const entities = createTable('entities', {
  id: serial('id').primaryKey(),
  uuid: text('uuid')
    .notNull()
    .unique()
    .$defaultFn(() => v7()),
  canonicalId: text('canonical_id').primaryKey(),
  rawName: text('raw_name').notNull(),
  source: text('source').notNull(),
  entityType: text('entity_type'),
  bioguideId: text('bioguide_id'),
  senateId: text('senate_id'),
  houseId: text('house_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

// // ─── stories ─────────────────────────────────────────────────────────────────

export const stories = createTable('stories', {
  id: serial('id').primaryKey(),
  uuid: text('uuid')
    .notNull()
    .unique()
    .$defaultFn(() => v7()),
  storyType: text('story_type'),
  headline: text('headline'),
  confidence: numeric('confidence'),
  newsworthiness: numeric('newsworthiness'),
  actors: text('actors').default('[]'),
  financial: text('financial').default('{}'),
  timeline: text('timeline').default('[]'),
  legal: text('legal').default('[]'),
  foiaRequests: text('foia_requests').default('[]'),
  recordIds: text('record_ids').default('[]'),
  evidenceLinks: text('evidence_links').default('[]'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

// // ─── evidence_links ───────────────────────────────────────────────────────────

export const evidenceLinks = createTable('evidence_links', {
  id: serial('id').primaryKey(),
  uuid: text('uuid')
    .notNull()
    .unique()
    .$defaultFn(() => v7()),
  storyId: text('story_id').references(() => stories.id),
  recordId: text('record_id').references(() => records.id),
  field: text('field'),
  excerpt: text('excerpt'),
  sourcePath: text('source_path'),
  lineOrUuid: text('line_or_uuid'),
});

export type EvidenceLink = typeof evidenceLinks.$inferSelect;
export type NewEvidenceLink = typeof evidenceLinks.$inferInsert;

// // ─── investigation_ledger ─────────────────────────────────────────────────────

export const investigationLedger = createTable('investigation_ledger', {
  id: serial('id').primaryKey(),
  uuid: text('uuid')
    .notNull()
    .unique()
    .$defaultFn(() => v7()),
  threadId: text('thread_id').primaryKey(),
  status: text('status', {
    enum: ['open', 'verified', 'cold', 'published'],
  }).default('open'),
  summary: text('summary'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export type InvestigationThread = typeof investigationLedger.$inferSelect;
export type NewInvestigationThread = typeof investigationLedger.$inferInsert;

// // ─── agent_runs ───────────────────────────────────────────────────────────────

export const agentRuns = createTable('agent_runs', {
  id: serial('id').primaryKey(),
  uuid: text('uuid')
    .notNull()
    .unique()
    .$defaultFn(() => v7()),
  skillName: text('skill_name'),
  startedAt: text('started_at').default(sql`(datetime('now'))`),
  finishedAt: text('finished_at'),
  inputsHash: text('inputs_hash'),
  outputPath: text('output_path'),
  tracePath: text('trace_path'),
  status: text('status').default('running'),
});

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;

// // ─── etl_runs ────────────────────────────────────────────────────────────────

export const etlRuns = createTable('etl_runs', {
  id: serial('id').primaryKey(),
  uuid: text('uuid')
    .notNull()
    .unique()
    .$defaultFn(() => v7()),
  filePath: text('file_path').unique(),
  source: text('source'),
  rowsWritten: smallint('rows_written').default(0),
  startedAt: text('started_at').default(sql`(datetime('now'))`),
  finishedAt: text('finished_at'),
  status: text('status').default('running'),
});

export type EtlRun = typeof etlRuns.$inferSelect;
export type NewEtlRun = typeof etlRuns.$inferInsert;
