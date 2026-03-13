CREATE TABLE "company_required_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "company_template_unique" ON "company_required_templates" USING btree ("company_id","template_id");
