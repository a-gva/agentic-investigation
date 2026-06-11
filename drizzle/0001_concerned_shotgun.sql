CREATE TABLE "agent_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"skill_name" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"inputs_hash" text,
	"output_path" text,
	"trace_path" text,
	"status" text DEFAULT 'running',
	CONSTRAINT "agent_runs_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"canonical_id" text NOT NULL,
	"raw_name" text NOT NULL,
	"source" text NOT NULL,
	"entity_type" text,
	"bioguide_id" text,
	"senate_id" text,
	"house_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entities_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "entities_canonical_id_unique" UNIQUE("canonical_id")
);
--> statement-breakpoint
CREATE TABLE "etl_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"file_path" text,
	"source" text,
	"rows_written" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"status" text DEFAULT 'running',
	CONSTRAINT "etl_runs_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "etl_runs_file_path_unique" UNIQUE("file_path")
);
--> statement-breakpoint
CREATE TABLE "evidence_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"story_id" integer,
	"record_id" integer,
	"field" text,
	"excerpt" text,
	"source_path" text,
	"line_or_uuid" text,
	CONSTRAINT "evidence_links_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "investigation_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"thread_id" text NOT NULL,
	"status" text DEFAULT 'open',
	"summary" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "investigation_ledger_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "investigation_ledger_thread_id_unique" UNIQUE("thread_id")
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"source" text NOT NULL,
	"sub_source" text NOT NULL,
	"record_type" text NOT NULL,
	"date" date NOT NULL,
	"fiscal_year" smallint NOT NULL,
	"entity_name" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_state" text NOT NULL,
	"counterparty" text NOT NULL,
	"amount_cents" numeric NOT NULL,
	"description" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"raw_hash" text NOT NULL,
	"risk_score" smallint,
	"chunk_index" smallint DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "records_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "records_raw_hash_unique" UNIQUE("raw_hash")
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"story_type" text,
	"headline" text,
	"confidence" numeric,
	"newsworthiness" numeric,
	"actors" text DEFAULT '[]',
	"financial" text DEFAULT '{}',
	"timeline" text DEFAULT '[]',
	"legal" text DEFAULT '[]',
	"foia_requests" text DEFAULT '[]',
	"record_ids" text DEFAULT '[]',
	"evidence_links" text DEFAULT '[]',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stories_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;