ALTER TABLE "toolkit_folders" ADD COLUMN IF NOT EXISTS "sources" text[] NOT NULL DEFAULT '{}';
UPDATE "toolkit_folders" SET "sources" = ARRAY['Guardian Support'] WHERE array_length("sources", 1) IS NULL OR array_length("sources", 1) = 0;
