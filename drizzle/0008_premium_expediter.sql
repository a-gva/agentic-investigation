CREATE TABLE "lobbying_activity_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lobbying_activity_issues_name_unique" UNIQUE("name"),
	CONSTRAINT "lobbying_activity_issues_abbreviation_unique" UNIQUE("abbreviation")
);
