CREATE TABLE "filing_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "filing_types_name_unique" UNIQUE("name"),
	CONSTRAINT "filing_types_abbreviation_unique" UNIQUE("abbreviation")
);
