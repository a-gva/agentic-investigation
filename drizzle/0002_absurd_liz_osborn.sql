CREATE TABLE "congress_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "congress_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "load_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"bioguide_id" text NOT NULL,
	"name" text NOT NULL,
	"member_type" text NOT NULL,
	"member_state" text NOT NULL,
	"member_district" text NOT NULL,
	"party_id" integer,
	CONSTRAINT "load_members_bioguide_id_unique" UNIQUE("bioguide_id")
);
--> statement-breakpoint
ALTER TABLE "load_members" ADD CONSTRAINT "load_members_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;