// All types are inferred directly from the Drizzle schema.
// Do not hand-edit — add columns in src/db/schema.ts instead.
export type {
  Record,
  NewRecord,
  Entity,
  NewEntity,
  Story,
  NewStory,
  EvidenceLink,
  NewEvidenceLink,
  InvestigationThread,
  NewInvestigationThread,
  AgentRun,
  NewAgentRun,
  EtlRun,
  NewEtlRun,
} from './db/schema.js';

// Convenience alias used by normalizers
export type { NewRecord as LegislativeRecord } from './db/schema.js';
