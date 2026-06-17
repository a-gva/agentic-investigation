ALTER TABLE "load_congress_press" DROP CONSTRAINT "load_congress_press_member_id_load_members_id_fk";
--> statement-breakpoint
ALTER TABLE "load_congress_press" ADD COLUMN "member_bioguide_id" text;
--> statement-breakpoint
UPDATE "load_congress_press" AS p
SET "member_bioguide_id" = m."bioguide_id"
FROM "load_members" AS m
WHERE p."member_id" = m."id";
--> statement-breakpoint
ALTER TABLE "load_congress_press" DROP COLUMN "member_id";
--> statement-breakpoint
ALTER TABLE "load_congress_press" RENAME COLUMN "member_bioguide_id" TO "member_id";
--> statement-breakpoint
ALTER TABLE "load_congress_press" ADD CONSTRAINT "load_congress_press_member_id_load_members_bioguide_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."load_members"("bioguide_id") ON DELETE no action ON UPDATE no action;
