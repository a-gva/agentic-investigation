CREATE TABLE "load_congress_press" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"date_source" text NOT NULL,
	"source" text NOT NULL,
	"domain" text NOT NULL,
	"scraper" text NOT NULL,
	"text" text NOT NULL,
	"collected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"member_id" integer,
	CONSTRAINT "load_congress_press_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "load_congress_press" ADD CONSTRAINT "load_congress_press_member_id_load_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."load_members"("id") ON DELETE no action ON UPDATE no action;