import { relations, sql } from 'drizzle-orm';
import {
  date,
  integer,
  jsonb,
  numeric,
  pgTableCreator,
  serial,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const createTable = pgTableCreator((name) => name);
// ─── records ─────────────────────────────────────────────────────────────────

export const states = createTable('states', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  abbreviation: text('abbreviation').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type State = typeof states.$inferSelect;
export type NewState = typeof states.$inferInsert;

export const parties = createTable('parties', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  acronym: text('acronym'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;

export const congressTypes = createTable('congress_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type CongressType = typeof congressTypes.$inferSelect;
export type NewCongressType = typeof congressTypes.$inferInsert;

export const contributionTypes = createTable('contribution_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  abbreviation: text('abbreviation').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ContributionType = typeof contributionTypes.$inferSelect;
export type NewContributionType = typeof contributionTypes.$inferInsert;

export const countries = createTable('countries', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  abbreviation: text('abbreviation').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Country = typeof countries.$inferSelect;
export type NewCountry = typeof countries.$inferInsert;

export const filingTypes = createTable('filing_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  abbreviation: text('abbreviation').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type FilingType = typeof filingTypes.$inferSelect;
export type NewFilingType = typeof filingTypes.$inferInsert;

export const governmentEntities = createTable('government_entities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const governmentEntitySchema = createSelectSchema(governmentEntities);
export const newGovernmentEntitySchema = createInsertSchema(governmentEntities);

export type GovernmentEntity = typeof governmentEntities.$inferSelect;
export type NewGovernmentEntity = typeof governmentEntities.$inferInsert;

export const lobbyingActivityIssues = createTable('lobbying_activity_issues', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  abbreviation: text('abbreviation').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type LobbyingActivityIssue = typeof lobbyingActivityIssues.$inferSelect;
export type NewLobbyingActivityIssue =
  typeof lobbyingActivityIssues.$inferInsert;

export const loadMembers = createTable('load_members', {
  id: serial('id').primaryKey(),
  bioguideId: text('bioguide_id').notNull().unique(),
  name: text('name').notNull(),
  memberState: text('member_state').notNull(),
  memberDistrict: text('member_district').notNull(),
  memberType: text('member_type').references(() => congressTypes.name),
  partyId: integer('party_id').references(() => parties.id),
});

export const loadMemberRelations = relations(loadMembers, ({ one }) => ({
  party: one(parties, {
    fields: [loadMembers.partyId],
    references: [parties.id],
  }),
  congressType: one(congressTypes, {
    fields: [loadMembers.memberType],
    references: [congressTypes.name],
  }),
}));

export type LoadMember = typeof loadMembers.$inferSelect;
export type NewLoadMember = typeof loadMembers.$inferInsert;

export const loadCongressPress = createTable('load_congress_press', {
  id: serial('id').primaryKey(),
  url: text('url').notNull().unique(),
  title: text('title').notNull(),
  date: date('date'),
  dateSource: text('date_source'),
  source: text('source').notNull(),
  domain: text('domain').notNull(),
  scraper: text('scraper').notNull(),
  text: text('text'),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  memberId: text('member_id').references(() => loadMembers.bioguideId),
});

export type LoadCongressPress = typeof loadCongressPress.$inferSelect;
export type NewLoadCongressPress = typeof loadCongressPress.$inferInsert;

export const loadCongressPressRelations = relations(
  loadCongressPress,
  ({ one }) => ({
    member: one(loadMembers, {
      fields: [loadCongressPress.memberId],
      references: [loadMembers.bioguideId],
    }),
  }),
);

export const records = createTable('records', {
  id: serial('id').primaryKey(),
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
  filePath: text('file_path').notNull(),
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
export type NormalizedRecord = Omit<NewDbRecord, 'filePath'>;

// ─── entities ────────────────────────────────────────────────────────────────

export const entities = createTable('entities', {
  id: serial('id').primaryKey(),
  canonicalId: text('canonical_id').notNull().unique(),
  rawName: text('raw_name').notNull(),
  source: text('source').notNull(),
  entityType: text('entity_type'),
  bioguideId: text('bioguide_id'),
  senateId: text('senate_id'),
  houseId: text('house_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

// // ─── stories ─────────────────────────────────────────────────────────────────

export const stories = createTable('stories', {
  id: serial('id').primaryKey(),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

// // ─── evidence_links ───────────────────────────────────────────────────────────

export const evidenceLinks = createTable('evidence_links', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id),
  recordId: integer('record_id').references(() => records.id),
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
  threadId: text('thread_id').notNull().unique(),
  status: text('status', {
    enum: ['open', 'verified', 'cold', 'published'],
  }).default('open'),
  summary: text('summary'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type InvestigationThread = typeof investigationLedger.$inferSelect;
export type NewInvestigationThread = typeof investigationLedger.$inferInsert;

// // ─── agent_runs ───────────────────────────────────────────────────────────────

export const agentRuns = createTable('agent_runs', {
  id: serial('id').primaryKey(),
  skillName: text('skill_name'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
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
  filePath: text('file_path').unique(),
  source: text('source'),
  batch: text('batch'),
  rowsWritten: integer('rows_written').default(0),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
  status: text('status').default('running'),
});

export type EtlRun = typeof etlRuns.$inferSelect;
export type NewEtlRun = typeof etlRuns.$inferInsert;
