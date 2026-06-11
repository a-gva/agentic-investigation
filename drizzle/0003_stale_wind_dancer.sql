ALTER TABLE "records" ADD COLUMN "file_path" text;--> statement-breakpoint
UPDATE "records" SET "file_path" = '/data/unknown' WHERE "file_path" IS NULL;--> statement-breakpoint
ALTER TABLE "records" ALTER COLUMN "file_path" SET NOT NULL;
