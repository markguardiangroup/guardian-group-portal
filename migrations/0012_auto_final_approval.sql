ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "auto_final_approval" boolean NOT NULL DEFAULT false;
