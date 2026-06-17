CREATE TABLE "government_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "government_entities_name_unique" UNIQUE("name"),
	CONSTRAINT "government_entities_code_unique" UNIQUE("code")
);
