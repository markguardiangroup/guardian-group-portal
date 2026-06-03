ALTER TABLE "document_versions" ADD COLUMN "version_label" text;
ALTER TABLE "document_versions" ADD COLUMN "is_draft" boolean NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "approved_version" integer NOT NULL DEFAULT 0;
