CREATE TABLE "states" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "states_name_unique" UNIQUE("name"),
	CONSTRAINT "states_abbreviation_unique" UNIQUE("abbreviation")
);
