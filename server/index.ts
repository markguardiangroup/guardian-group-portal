import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";
import { storage } from "./storage";
import { autoRecordPublishedPatch, autoIncrementPatchIfChanged } from "./changelog";
import { acceloGet, getConnectionStatus } from "./accelo";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

// 301 redirect: enforce www.guardiangroup.ai as canonical
app.use((req, res, next) => {
  const host = req.headers.host;
  if (host === "guardiangroup.ai") {
    const url = `https://www.guardiangroup.ai${req.originalUrl}`;
    return res.redirect(301, url);
  }
  next();
});

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://www.guardiangroup.ai"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting for API endpoints
// Note: generously sized because all Replit traffic shares one proxy IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1",
});

// Auth rate limiting – keyed by username (body) so each account gets its own bucket
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const username = req.body?.username ?? "anonymous";
    return String(username).toLowerCase();
  },
  skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1",
  validate: { keyGeneratorIpFallback: false },
});

// Apply rate limiting
app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Session configuration with security hardening - using PostgreSQL for persistence
const PgSession = connectPgSimple(session);
const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "guardian-group-secret-key",
    name: "guardian.sid", // Custom session name (not default 'connect.sid')
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    store: new PgSession({
      pool: pool,
      tableName: "session", // Use 'session' table in database
      createTableIfMissing: true, // Auto-create session table if it doesn't exist
      ttl: 8 * 60 * 60, // Prune orphaned rows after 8 hours (seconds, not ms)
    }),
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks
      sameSite: "lax", // Lax allows cookies in iframe/preview environments
      // No maxAge → session cookie: browser deletes it when the tab/window closes
    },
  })
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

(async () => {
  // Idempotent schema migrations for columns added after initial schema creation.
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS company_accelo_links (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id varchar NOT NULL,
        source_code text NOT NULL,
        accelo_id text NOT NULL,
        accelo_standing text,
        accelo_type text,
        last_checked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (company_id, source_code)
      )
    `);
    await pool.query(`ALTER TABLE company_accelo_links ADD COLUMN IF NOT EXISTS accelo_type text`);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS riddor_notes text`);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS riddor_reference text`);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS inv_amendments text`);
    await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS group_owner_id varchar`);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'companies_group_owner_id_fk'
        ) THEN
          ALTER TABLE companies ADD CONSTRAINT companies_group_owner_id_fk
            FOREIGN KEY (group_owner_id) REFERENCES companies(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    // 0007_add_services_enhancements
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "badge_types" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "label" text NOT NULL UNIQUE,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "service_type" text`);
    await pool.query(`ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "price_period" text`);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'badge_type_id'
        ) THEN
          ALTER TABLE "services" ADD COLUMN "badge_type_id" varchar REFERENCES "badge_types"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await pool.query(`ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "is_multi_service" boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE "services" ALTER COLUMN "benchmark_price_gbp" DROP NOT NULL`);
    await pool.query(`ALTER TABLE "services" ALTER COLUMN "sort_order" DROP NOT NULL`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" text PRIMARY KEY,
        "value" text NOT NULL,
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "service_components" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "parent_service_id" varchar NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
        "component_service_id" varchar NOT NULL REFERENCES "services"("id") ON DELETE CASCADE
      );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "service_components_parent_component_unique"
        ON "service_components" ("parent_service_id", "component_service_id");
    `);
  } catch (err) {
    console.error("Startup migration warning (non-fatal):", err);
  }

  // Seed locked root Toolkit folder templates for all modules (idempotent).
  // Awaited before route registration so templates exist before any request is served.
  // If seeding fails the process exits to prevent serving requests in an invalid state.
  try {
    await storage.seedToolkitRootFolders();
  } catch (err) {
    console.error("Fatal: startup toolkit root folder seed failed:", err);
    process.exit(1);
  }

  // Repair any historical group→member required-template cascade gaps.
  // Idempotent: only inserts missing rows. Non-fatal — if it fails we still
  // serve, but the gap will persist until the next successful run.
  try {
    const { inserted } = await storage.backfillGroupRequiredTemplatesCascade();
    if (inserted > 0) {
      console.log(`[seed] Backfilled ${inserted} missing inherited required-template row(s) for member companies.`);
    }
  } catch (err) {
    console.error("Startup required-template cascade backfill warning (non-fatal):", err);
  }

  // One-time data migration: rename legacy "inactive" company status to "cancelled".
  // Idempotent — safe to run on every startup.
  try {
    const { db } = await import("./db");
    const { companies: companiesTable } = await import("@shared/schema");
    const { eq, sql: drizzleSql } = await import("drizzle-orm");
    const result = await db.update(companiesTable)
      .set({ status: "cancelled" as any })
      .where(eq(companiesTable.status, "inactive" as any));
    const count = (result as any).rowCount ?? (result as any).count ?? 0;
    if (count > 0) {
      console.log(`[migration] Renamed ${count} company status(es) from 'inactive' to 'cancelled'.`);
    }
  } catch (err) {
    console.error("Startup company-status migration warning (non-fatal):", err);
  }

  // One-time data migration: rename legacy document status "review_required" → "approval_required".
  // Idempotent — safe to run on every startup. Uses raw SQL to avoid TypeScript
  // enum constraints on a value that no longer exists in the schema type.
  try {
    const result = await pool.query(
      `UPDATE documents SET status = 'approval_required', updated_at = NOW() WHERE status = 'review_required'`
    );
    const count = result.rowCount ?? 0;
    if (count > 0) {
      console.log(`[migration] Renamed ${count} document status(es) from 'review_required' to 'approval_required'.`);
    }
  } catch (err) {
    console.error("Startup document-status migration warning (non-fatal):", err);
  }

  // One-time data migration: non-required documents that are compliant should
  // have status "approved" not "compliant". Excludes documents whose template is
  // in company_required_templates for their company (they are effectively required).
  // Idempotent — safe to run on every startup.
  try {
    const result = await pool.query(
      `UPDATE documents d
       SET status = 'approved', updated_at = NOW()
       WHERE d.status = 'compliant'
         AND d.is_required = false
         AND NOT EXISTS (
           SELECT 1 FROM company_required_templates crt
           WHERE crt.template_id = d.template_id
             AND crt.company_id = d.entity_id
         )`
    );
    const count = result.rowCount ?? 0;
    if (count > 0) {
      console.log(`[migration] Updated ${count} non-required document status(es) from 'compliant' to 'approved'.`);
    }
  } catch (err) {
    console.error("Startup non-required document status migration warning (non-fatal):", err);
  }

  // One-time data migration: legacy documents whose template is in company_required_templates
  // for their company should have is_required = true and status = 'compliant' (not 'approved').
  // Idempotent — safe to run on every startup.
  try {
    const result = await pool.query(
      `UPDATE documents d
       SET is_required = true,
           status = CASE WHEN d.status = 'approved' THEN 'compliant' ELSE d.status END,
           updated_at = NOW()
       WHERE d.is_required = false
         AND d.is_archived = false
         AND d.template_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM company_required_templates crt
           WHERE crt.template_id = d.template_id
             AND crt.company_id = d.entity_id
         )`
    );
    const count = result.rowCount ?? 0;
    if (count > 0) {
      console.log(`[migration] Backfilled is_required=true for ${count} legacy document(s) required via company templates.`);
    }
  } catch (err) {
    console.error("Startup company-required-template is_required backfill warning (non-fatal):", err);
  }

  // One-time data migration: documents marked is_required=true that are approved
  // should have status='compliant' not 'approved'. Covers cases where the toggle
  // was flipped before the status-recalculation logic was in place.
  // Idempotent — safe to run on every startup.
  try {
    const result = await pool.query(
      `UPDATE documents
       SET status = 'compliant', updated_at = NOW()
       WHERE is_required = true
         AND approval_status = 'approved'
         AND status = 'approved'
         AND is_archived = false`
    );
    const count = result.rowCount ?? 0;
    if (count > 0) {
      console.log(`[migration] Fixed ${count} required document(s) with status='approved' → 'compliant'.`);
    }
  } catch (err) {
    console.error("Startup required-doc status fix warning (non-fatal):", err);
  }

  // Run expired folder cleanup on startup and then daily
  storage.cleanupExpiredFolders().catch((err) =>
    console.error("Startup folder cleanup error:", err)
  );
  setInterval(
    () =>
      storage.cleanupExpiredFolders().catch((err) =>
        console.error("Scheduled folder cleanup error:", err)
      ),
    24 * 60 * 60 * 1000
  );

  // Run expired document status sweep on startup, then every day at 05:00 UK time.
  // Finds compliant documents whose renewalDate or expiryDate has passed and marks them overdue.
  function msUntilNextUKTime(hour: number, minute: number): number {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    }).formatToParts(now);
    const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value);
    const currentMinutesInDay = get("hour") * 60 + get("minute");
    const currentSeconds = get("second");
    const targetMinutesInDay = hour * 60 + minute;
    const minutesUntil = currentMinutesInDay < targetMinutesInDay
      ? targetMinutesInDay - currentMinutesInDay
      : 24 * 60 - currentMinutesInDay + targetMinutesInDay;
    return minutesUntil * 60 * 1000 - currentSeconds * 1000;
  }

  async function runExpiredDocumentSweep() {
    try {
      const expired = await storage.markExpiredDocumentsOverdue();
      if (expired > 0) {
        console.log(`[scheduler] Marked ${expired} expired document(s) as overdue.`);
      }
      const corrected = await storage.correctMisclassifiedDocuments();
      if (corrected > 0) {
        console.log(`[scheduler] Corrected ${corrected} misclassified document(s) back to compliant/approved.`);
      }
    } catch (err) {
      console.error("[scheduler] Expired document sweep error:", err);
    }
  }

  function scheduleNextDocumentSweep() {
    const ms = msUntilNextUKTime(5, 0);
    const nextRun = new Date(Date.now() + ms);
    console.log(`[scheduler] Next expired-document sweep scheduled for ${nextRun.toISOString()} (${Math.round(ms / 60000)} min from now).`);
    setTimeout(async () => {
      await runExpiredDocumentSweep();
      scheduleNextDocumentSweep();
    }, ms).unref();
  }

  // Run once immediately on startup to catch anything that expired overnight
  runExpiredDocumentSweep();
  // Then schedule for 05:00 UK time each day
  scheduleNextDocumentSweep();

  // Daily Accelo standing sync at 07:00 UK time
  async function runAcceloStatusSync() {
    try {
      const links = await storage.getAcceloLinksForSync();
      if (links.length === 0) return;
      const bySource = new Map<string, typeof links>();
      for (const link of links) {
        const arr = bySource.get(link.sourceCode) ?? [];
        arr.push(link);
        bySource.set(link.sourceCode, arr);
      }
      for (const [sourceCode, sourceLinks] of bySource) {
        try {
          const { connected } = await getConnectionStatus(sourceCode);
          if (!connected) {
            console.warn(`[scheduler] Accelo sync: source ${sourceCode} not connected — skipping ${sourceLinks.length} companies.`);
            continue;
          }
          const BATCH_SIZE = 50;
          const updates: Array<{ companyId: string; sourceCode: string; acceloStanding: string | null }> = [];
          for (let i = 0; i < sourceLinks.length; i += BATCH_SIZE) {
            const batch = sourceLinks.slice(i, i + BATCH_SIZE);
            const ids = batch.map(l => l.acceloId).join("|");
            try {
              const data = await acceloGet(sourceCode, `/companies?_filters=id_in(${ids})&_fields=id,standing,type&_limit=${BATCH_SIZE}`);
              const results = Array.isArray(data?.response) ? data.response : [];
              for (const r of results) {
                const link = batch.find(l => String(l.acceloId) === String(r.id));
                if (link) updates.push({ companyId: link.companyId, sourceCode, acceloStanding: r.standing ?? null, acceloType: r.type ?? null });
              }
            } catch (batchErr: any) {
              console.error(`[scheduler] Accelo sync batch error (source=${sourceCode}):`, batchErr.message);
            }
          }
          if (updates.length > 0) await storage.bulkUpdateAcceloStandings(updates);
          await storage.createAuditLog({
            action: "accelo_status_sync",
            userId: "system",
            userName: "Scheduled Sync",
            details: `Accelo standing sync for source ${sourceCode}: ${updates.length}/${sourceLinks.length} companies updated`,
            metadata: JSON.stringify({ sourceCode, updated: updates.length, total: sourceLinks.length }),
          });
          console.log(`[scheduler] Accelo sync (source=${sourceCode}): ${updates.length}/${sourceLinks.length} standing(s) updated.`);
        } catch (sourceErr: any) {
          console.error(`[scheduler] Accelo sync source ${sourceCode} error:`, sourceErr.message);
        }
      }
    } catch (err) {
      console.error("[scheduler] Accelo status sync error:", err);
    }
  }

  function scheduleNextAcceloSync() {
    const ms = msUntilNextUKTime(7, 0);
    const nextRun = new Date(Date.now() + ms);
    console.log(`[scheduler] Next Accelo status sync scheduled for ${nextRun.toISOString()} (${Math.round(ms / 60000)} min from now).`);
    setTimeout(async () => {
      await runAcceloStatusSync();
      scheduleNextAcceloSync();
    }, ms).unref();
  }

  scheduleNextAcceloSync();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Express error handler:", err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
    // Record publishedPatch = current patch so the /api/changelog/published-patch
    // endpoint returns what was actually shipped. Does NOT increment the patch counter.
    autoRecordPublishedPatch().catch((e) =>
      console.error("[changelog] autoRecordPublishedPatch failed:", e)
    );
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
    // On dev restart, advance the patch counter if new entries have been added
    // since the last publish. This is the only place the patch is incremented —
    // the build script must NOT touch changelog.json.
    autoIncrementPatchIfChanged().catch((e) =>
      console.error("[changelog] autoIncrementPatchIfChanged failed:", e)
    );
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
