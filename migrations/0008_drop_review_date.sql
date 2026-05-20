ALTER TABLE "documents" DROP COLUMN IF EXISTS "review_date";
-- Normalise legacy status value so any rows written before the rename are corrected
UPDATE "documents" SET "status" = 'approval_required' WHERE "status" = 'review_required';
-- Correct the column default so fresh deployments never emit the deprecated value
ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'approval_required';
