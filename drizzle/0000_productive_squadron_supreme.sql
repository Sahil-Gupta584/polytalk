CREATE TABLE "todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"source_text" text NOT NULL,
	"translated_text" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
