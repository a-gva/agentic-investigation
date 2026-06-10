// All types are inferred directly from the Drizzle schema.
// Do not hand-edit — add columns in src/db/schema.ts instead.
export type {
  AgentRun,
  Entity,
  EtlRun,
  EvidenceLink,
  InvestigationThread,
  NewAgentRun,
  NewEntity,
  NewEtlRun,
  NewEvidenceLink,
  NewInvestigationThread,
  NewRecord,
  NewStory,
  Record,
  Story,
} from './schema.js';

// Convenience alias used by normalizers
export type { NewRecord as LegislativeRecord } from './schema.js';
