-- Add portal_messages table for admin-broadcast messages shown on the home page

CREATE TABLE IF NOT EXISTS "portal_messages" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "type" text NOT NULL DEFAULT 'update',
  "target_roles" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "status" text NOT NULL DEFAULT 'draft',
  "pinned" boolean NOT NULL DEFAULT false,
  "published_at" timestamp,
  "expires_at" timestamp,
  "created_by" varchar NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "portal_messages_status_idx" ON "portal_messages" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portal_messages_published_at_idx" ON "portal_messages" ("published_at");
--> statement-breakpoint

-- CTA columns (added after initial release)
ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "cta_type" text NOT NULL DEFAULT 'none';
ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "cta_url" text;
ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "cta_label" text;
