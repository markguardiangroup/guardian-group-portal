CREATE TABLE IF NOT EXISTS "testing_task_lists" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "module" text DEFAULT 'general' NOT NULL,
        "tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "testing_task_assignments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "task_list_id" varchar NOT NULL,
        "assigned_to" varchar NOT NULL,
        "assigned_by" varchar NOT NULL,
        "completed_task_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "testing_task_assignments_list_consultant_idx" ON "testing_task_assignments" ("task_list_id", "assigned_to");
