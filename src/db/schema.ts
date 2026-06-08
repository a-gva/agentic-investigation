import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ─── records ─────────────────────────────────────────────────────────────────

export const records = sqliteTable('records', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  source:      text('source', { enum: ['senate', 'house', 'congress_press'] }).notNull(),
  subSource:   text('sub_source').notNull(),
  recordType:  text('record_type'),
  date:        text('date'),
  fiscalYear:  integer('fiscal_year'),
  entityName:  text('entity_name'),
  entityType:  text('entity_type'),
  entityState: text('entity_state'),
  counterparty:text('counterparty'),
  amountCents: integer('amount_cents'),
  description: text('description'),
  tags:        text('tags').default('[]'),
  rawHash:     text('raw_hash').notNull().unique(),
  riskScore:   real('risk_score'),
  chunkIndex:  integer('chunk_index').default(0),
  metadata:    text('metadata').default('{}'),
  createdAt:   text('created_at').default(sql`(datetime('now'))`),
});

export type Record    = typeof records.$inferSelect;
export type NewRecord = typeof records.$inferInsert;

// ─── entities ────────────────────────────────────────────────────────────────

export const entities = sqliteTable('entities', {
  canonicalId: integer('canonical_id').primaryKey({ autoIncrement: true }),
  rawName:     text('raw_name').notNull(),
  source:      text('source').notNull(),
  entityType:  text('entity_type'),
  bioguideId:  text('bioguide_id'),
  senateId:    text('senate_id'),
  houseId:     text('house_id'),
  createdAt:   text('created_at').default(sql`(datetime('now'))`),
});

export type Entity    = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

// ─── stories ─────────────────────────────────────────────────────────────────

export const stories = sqliteTable('stories', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  storyType:      text('story_type'),
  headline:       text('headline'),
  confidence:     real('confidence'),
  newsworthiness: real('newsworthiness'),
  actors:         text('actors').default('[]'),
  financial:      text('financial').default('{}'),
  timeline:       text('timeline').default('[]'),
  legal:          text('legal').default('[]'),
  foiaRequests:   text('foia_requests').default('[]'),
  recordIds:      text('record_ids').default('[]'),
  evidenceLinks:  text('evidence_links').default('[]'),
  createdAt:      text('created_at').default(sql`(datetime('now'))`),
});

export type Story    = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

// ─── evidence_links ───────────────────────────────────────────────────────────

export const evidenceLinks = sqliteTable('evidence_links', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  storyId:    integer('story_id').references(() => stories.id),
  recordId:   integer('record_id').references(() => records.id),
  field:      text('field'),
  excerpt:    text('excerpt'),
  sourcePath: text('source_path'),
  lineOrUuid: text('line_or_uuid'),
});

export type EvidenceLink    = typeof evidenceLinks.$inferSelect;
export type NewEvidenceLink = typeof evidenceLinks.$inferInsert;

// ─── investigation_ledger ─────────────────────────────────────────────────────

export const investigationLedger = sqliteTable('investigation_ledger', {
  threadId:  text('thread_id').primaryKey(),
  status:    text('status', { enum: ['open', 'verified', 'cold', 'published'] }).default('open'),
  summary:   text('summary'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export type InvestigationThread    = typeof investigationLedger.$inferSelect;
export type NewInvestigationThread = typeof investigationLedger.$inferInsert;

// ─── agent_runs ───────────────────────────────────────────────────────────────

export const agentRuns = sqliteTable('agent_runs', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  skillName:  text('skill_name'),
  startedAt:  text('started_at').default(sql`(datetime('now'))`),
  finishedAt: text('finished_at'),
  inputsHash: text('inputs_hash'),
  outputPath: text('output_path'),
  tracePath:  text('trace_path'),
  status:     text('status').default('running'),
});

export type AgentRun    = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;

// ─── etl_runs ────────────────────────────────────────────────────────────────

export const etlRuns = sqliteTable('etl_runs', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  filePath:    text('file_path').unique(),
  source:      text('source'),
  rowsWritten: integer('rows_written').default(0),
  startedAt:   text('started_at').default(sql`(datetime('now'))`),
  finishedAt:  text('finished_at'),
  status:      text('status').default('running'),
});

export type EtlRun    = typeof etlRuns.$inferSelect;
export type NewEtlRun = typeof etlRuns.$inferInsert;
