ALTER TABLE "documents" DROP COLUMN IF EXISTS "review_date";
-- Normalise legacy status value so any rows written before the rename are corrected
UPDATE "documents" SET "status" = 'approval_required' WHERE "status" = 'review_required';
