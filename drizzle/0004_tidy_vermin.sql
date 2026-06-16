CREATE TABLE "contribution_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_types_name_unique" UNIQUE("name"),
	CONSTRAINT "contribution_types_abbreviation_unique" UNIQUE("abbreviation")
);
