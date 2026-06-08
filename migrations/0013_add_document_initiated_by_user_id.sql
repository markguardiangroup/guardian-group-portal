-- Migration: Add initiated_by_user_id to documents
-- Records the Admin (role 'administrator') who initiated an upload on a consultant's
-- behalf via "approval on behalf of". Null for normal uploads. Nullable FK to users.id.

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "initiated_by_user_id" varchar;
--> statement-breakpoint

-- Add the FK constraint only if it does not already exist (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_initiated_by_user_id_fkey'
  ) THEN
    ALTER TABLE "documents"
      ADD CONSTRAINT "documents_initiated_by_user_id_fkey"
      FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id");
  END IF;
END $$;
