-- Add scope and entity_id columns to documents table
-- scope: 'site' (default/existing), 'company', or 'group'
-- entity_id: the owning company/group entity (null for site-scoped docs)

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "scope" text DEFAULT 'site' NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "entity_id" varchar;
--> statement-breakpoint

-- Backfill existing documents as site-scoped (already the default but explicit for clarity)
UPDATE "documents" SET "scope" = 'site' WHERE "scope" IS NULL OR "scope" = '';
--> statement-breakpoint

-- Create document_shares table for explicit sharing records
-- Company-scope: shares target sites (entityType='site', entityId=siteId)
-- Group-scope: shares target companies (entityType='company', entityId=companyId)

CREATE TABLE IF NOT EXISTS "document_shares" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" varchar NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" varchar NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "document_shares_document_id_idx" ON "document_shares" ("document_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_shares_document_entity_idx" ON "document_shares" ("document_id", "entity_type", "entity_id");
