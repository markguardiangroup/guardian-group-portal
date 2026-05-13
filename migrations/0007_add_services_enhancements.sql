-- Create badge_types lookup table
CREATE TABLE IF NOT EXISTS "badge_types" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "label" text NOT NULL UNIQUE,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Add new columns to services table
ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "service_type" text,
  ADD COLUMN IF NOT EXISTS "price_period" text,
  ADD COLUMN IF NOT EXISTS "badge_type_id" varchar REFERENCES "badge_types"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "is_multi_service" boolean NOT NULL DEFAULT false;

-- Make benchmark_price_gbp nullable (was NOT NULL)
ALTER TABLE "services" ALTER COLUMN "benchmark_price_gbp" DROP NOT NULL;

-- Make sort_order nullable  
ALTER TABLE "services" ALTER COLUMN "sort_order" DROP NOT NULL;

-- Create service_components join table
CREATE TABLE IF NOT EXISTS "service_components" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "parent_service_id" varchar NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "component_service_id" varchar NOT NULL REFERENCES "services"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_components_parent_component_unique"
  ON "service_components" ("parent_service_id", "component_service_id");
