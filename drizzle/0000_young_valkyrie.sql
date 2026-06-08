CREATE TABLE `agent_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`skill_name` text,
	`started_at` text DEFAULT (datetime('now')),
	`finished_at` text,
	`inputs_hash` text,
	`output_path` text,
	`trace_path` text,
	`status` text DEFAULT 'running'
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`canonical_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`raw_name` text NOT NULL,
	`source` text NOT NULL,
	`entity_type` text,
	`bioguide_id` text,
	`senate_id` text,
	`house_id` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `etl_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_path` text,
	`source` text,
	`rows_written` integer DEFAULT 0,
	`started_at` text DEFAULT (datetime('now')),
	`finished_at` text,
	`status` text DEFAULT 'running'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `etl_runs_file_path_unique` ON `etl_runs` (`file_path`);--> statement-breakpoint
CREATE TABLE `evidence_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_id` integer,
	`record_id` integer,
	`field` text,
	`excerpt` text,
	`source_path` text,
	`line_or_uuid` text,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `investigation_ledger` (
	`thread_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'open',
	`summary` text,
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`sub_source` text NOT NULL,
	`record_type` text,
	`date` text,
	`fiscal_year` integer,
	`entity_name` text,
	`entity_type` text,
	`entity_state` text,
	`counterparty` text,
	`amount_cents` integer,
	`description` text,
	`tags` text DEFAULT '[]',
	`raw_hash` text NOT NULL,
	`risk_score` real,
	`chunk_index` integer DEFAULT 0,
	`metadata` text DEFAULT '{}',
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `records_raw_hash_unique` ON `records` (`raw_hash`);--> statement-breakpoint
CREATE TABLE `stories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_type` text,
	`headline` text,
	`confidence` real,
	`newsworthiness` real,
	`actors` text DEFAULT '[]',
	`financial` text DEFAULT '{}',
	`timeline` text DEFAULT '[]',
	`legal` text DEFAULT '[]',
	`foia_requests` text DEFAULT '[]',
	`record_ids` text DEFAULT '[]',
	`evidence_links` text DEFAULT '[]',
	`created_at` text DEFAULT (datetime('now'))
);
