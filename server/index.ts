import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { registerRoutes } from "./routes";
import { SECURITY_CONFIG } from "@shared/schema";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";
import { storage } from "./storage";
import { autoRecordPublishedPatch, autoIncrementPatchIfChanged } from "./changelog";
import { acceloGet, getConnectionStatus, listIntegrations, getValidAccessToken, getSourceLabels, verifyConnection } from "./accelo";
import { sendAcceloDisconnectAlertEmail } from "./email";

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
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://challenges.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://www.guardiangroup.ai", "https://challenges.cloudflare.com"],
      frameSrc: ["https://challenges.cloudflare.com"],
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

// Auth rate limiting – keyed by username (body) so each account gets its own bucket.
//
// The windows/max here are deliberately derived from SECURITY_CONFIG's own
// lockout thresholds, not chosen independently. An earlier version of this
// limiter allowed far more requests per identifier (20 per 15 minutes = up to
// 80/hour) than either the soft lockout (3 failures/15min) or the
// hard/permanent lockout (10 failures/60min) thresholds — so an
// unauthenticated caller could freely rack up enough failed attempts to force
// a victim account through both the temporary AND the permanent lock, purely
// through login request volume.
//
// IMPORTANT: neither limiter below is keyed by identifier ALONE. A limiter
// (or the underlying lockout check) that shares one bucket across all
// requests bearing a given username/email is itself an attacker tool: an
// anonymous caller who only knows a victim's identifier can deliberately
// exhaust that shared bucket and get every subsequent request for that
// identifier — including the real owner's own correct-password login —
// rejected with 429/401 for the rest of the window. That is the same
// "anyone can deny a known victim's login" bug this hardening exists to fix,
// just moved from storage-side lockout into the rate limiter. So:
//   - authSoftLimiter is keyed by (identifier + source IP), matching the
//     now IP-scoped storage.isAccountLocked() soft lock (see
//     server/storage.ts). An attacker can only ever throttle/soft-lock
//     THEIR OWN IP's attempts against a victim account; the real owner
//     logging in from their own device/IP is unaffected.
//   - authIpLimiter is keyed by source IP ALONE (no identifier), as a
//     general anti-automation backstop on the login route. Because it does
//     not key on identifier, it cannot be weaponized to target one victim's
//     login — it only throttles a single misbehaving IP's total request
//     volume, capping how fast any one source can grind through consecutive
//     failures against storage.shouldPermanentlyLock() (identifier-only,
//     `permanentLockAttempts` over `permanentLockWindowMinutes`), without
//     ever putting a single victim identifier behind a shared 429 bucket.
// Canonicalize exactly like the login route does (`rawIdentifier.toLowerCase().trim()`
// in server/routes.ts) — a limiter keyed on a different normalization than the
// lockout accounting it's meant to protect can be trivially bypassed by
// submitting whitespace/case variants of the same identifier that all still
// land on the same account in storage.
const authIdentifier = (req: Request) => {
  const username = req.body?.username ?? "anonymous";
  return String(username).toLowerCase().trim();
};

// Set BELOW the soft-lockout threshold (not merely equal to it) so an
// anonymous caller is rate-limited before they can ever complete enough
// requests, from their own IP, to trip the storage-side soft lock at all.
const authSoftLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.lockoutDurationMinutes * 60 * 1000,
  max: SECURITY_CONFIG.maxLoginAttempts - 1,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${authIdentifier(req)}:${ipKeyGenerator(req.ip ?? "unknown")}`,
  skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1",
  validate: { keyGeneratorIpFallback: false },
});

// General per-IP backstop for the login route — deliberately NOT keyed by
// identifier (see comment above). Bounds how many login requests a single
// source IP can make within the permanent-lock window, well below
// `permanentLockAttempts`, so grinding through many different candidate
// identifiers from one IP is also throttled.
const authIpLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.permanentLockWindowMinutes * 60 * 1000,
  max: SECURITY_CONFIG.permanentLockAttempts - 1,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1",
});

// Tight rate limiter for Accelo webhook push — sensitive unauthenticated write endpoint
const acceloPushLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: "Too many webhook requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Bounds how many direct-to-storage upload slots (raw upload or presigned URL) a single
// account can request in a window. Without this, a single authenticated user could script
// unbounded calls to the upload endpoints to fill private object storage with junk data.
// Keyed by session user id (falls back to IP pre-auth, which will just 401 downstream).
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: "Too many upload requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req.session as any)?.userId;
    return userId ? String(userId) : ipKeyGenerator(req.ip ?? "");
  },
  skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1",
});

// Forgot-password rate limiting.
//
// IMPORTANT: this must NOT be keyed by the submitted email alone. A bucket
// shared across every caller who types a given address is itself an attack
// tool — anyone who merely knows a victim's email can send 5 anonymous
// requests from anywhere and (a) burn the victim's entire quota, locking
// them out of their own recovery flow for the rest of the window, and
// (b) immediately invalidate any reset link the victim already had in
// their inbox (the handler revokes prior tokens before issuing a new one).
// That mirrors the same "shared identifier bucket = victim-controlled DoS"
// problem solved for login via authSoftLimiter/authIpLimiter above, so the
// fix follows the same shape:
//   - forgotPasswordSoftLimiter is keyed by (email + source IP). An
//     attacker can only exhaust the slice of the victim's quota tied to
//     the attacker's own IP; the legitimate user requesting a reset from
//     their own device/IP still has their full 5-request allowance.
//   - forgotPasswordIpLimiter is keyed by source IP alone, as a general
//     backstop against one source spraying reset requests across many
//     different email addresses.
const forgotPasswordSoftLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Too many password reset requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.email ?? "anonymous").toLowerCase().trim();
    return `${email}:${ipKeyGenerator(req.ip ?? "unknown")}`;
  },
  skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1",
  validate: { keyGeneratorIpFallback: false },
});

const forgotPasswordIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { error: "Too many password reset requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1",
});

// IP-only rate limiters (don't need a parsed body) are applied immediately.
app.use("/api/", apiLimiter);
app.use("/api/integrations/accelo/push", acceloPushLimiter);

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
app.use(cookieParser());

// Body-keyed rate limiters must be mounted after the body parsers above, or
// req.body is always undefined and every request collapses into a single
// shared "anonymous" bucket — defeating the per-account limiting entirely.
app.use("/api/auth/login", authSoftLimiter, authIpLimiter);
app.use("/api/auth/forgot-password", forgotPasswordSoftLimiter, forgotPasswordIpLimiter);

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

// Must be mounted after session middleware so the key generator can read the session user id.
// Covers every raw-body upload route (direct-to-storage and business-specific), not just the
// generic ones — a route missing from this list has no bound on concurrent/repeated uploads
// beyond the per-request byte cap, which only limits a single request's size, not how many an
// account can fire off in a window.
app.use(
  ["/api/uploads/request-url", "/api/uploads/file", "/api/incidents/:id/upload", "/api/legal-documents/:type"],
  uploadLimiter
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

  // Paths whose response bodies must never appear in logs (contain secrets/tokens)
  const SENSITIVE_RESPONSE_PATHS = new Set([
    "/api/auth/totp-setup",
    "/api/auth/totp-confirm",
    "/api/auth/totp-regenerate-codes",
    "/api/auth/login",
    "/api/auth/change-password",
    "/api/integrations/accelo/webhook-secret",
  ]);

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && !SENSITIVE_RESPONSE_PATHS.has(path)) {
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accelo_sync_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        sync_type text NOT NULL,
        source_code text NOT NULL,
        triggered_by text NOT NULL,
        triggered_by_name text NOT NULL,
        company_id varchar,
        company_name text,
        companies_total integer NOT NULL DEFAULT 0,
        companies_updated integer NOT NULL DEFAULT 0,
        success boolean NOT NULL,
        error_message text,
        synced_at timestamp NOT NULL DEFAULT now()
      )
    `);
    // Toolkit folders table and folder_templates columns added after initial schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS toolkit_folders (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        module text NOT NULL,
        sort_order integer NOT NULL DEFAULT 0,
        created_by varchar NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`ALTER TABLE folder_templates ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE folder_templates ADD COLUMN IF NOT EXISTS toolkit_folder_id varchar`);
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

  // Seed the default industry picklist if none exist yet (idempotent — only
  // runs when the table is empty, so custom edits are never overwritten).
  try {
    await storage.seedDefaultIndustries();
  } catch (err) {
    console.error("Startup industries seed warning (non-fatal):", err);
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

  // One-time data migration: rename legacy user role "admin" → "developer".
  // Idempotent — safe to run on every startup. Uses raw SQL to avoid TypeScript
  // enum constraints on a role value that no longer exists in the schema type.
  // Also rewrites portal_messages.target_roles arrays that reference 'admin'.
  try {
    const roleResult = await pool.query(
      `UPDATE users SET role = 'developer' WHERE role = 'admin'`
    );
    const roleCount = roleResult.rowCount ?? 0;
    if (roleCount > 0) {
      console.log(`[migration] Renamed ${roleCount} user role(s) from 'admin' to 'developer'.`);
    }
    const targetResult = await pool.query(
      `UPDATE portal_messages SET target_roles = array_replace(target_roles, 'admin', 'developer') WHERE 'admin' = ANY(target_roles)`
    );
    const targetCount = targetResult.rowCount ?? 0;
    if (targetCount > 0) {
      console.log(`[migration] Updated ${targetCount} portal message target_roles from 'admin' to 'developer'.`);
    }
  } catch (err) {
    console.error("Startup role-rename migration warning (non-fatal):", err);
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
         AND d.is_mandatory = false
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
  // for their company should have is_mandatory = true and status = 'compliant' (not 'approved').
  // Idempotent — safe to run on every startup.
  try {
    const result = await pool.query(
      `UPDATE documents d
       SET is_mandatory = true,
           status = CASE WHEN d.status = 'approved' THEN 'compliant' ELSE d.status END,
           updated_at = NOW()
       WHERE d.is_mandatory = false
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
      console.log(`[migration] Backfilled is_mandatory=true for ${count} legacy document(s) required via company templates.`);
    }
  } catch (err) {
    console.error("Startup company-required-template is_mandatory backfill warning (non-fatal):", err);
  }

  // One-time data migration: documents marked is_mandatory=true that are approved
  // should have status='compliant' not 'approved'. Covers cases where the toggle
  // was flipped before the status-recalculation logic was in place.
  // Idempotent — safe to run on every startup.
  try {
    const result = await pool.query(
      `UPDATE documents
       SET status = 'compliant', updated_at = NOW()
       WHERE is_mandatory = true
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

  // Add last_seen_at column to users table (SSE presence tracking)
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz`);
  } catch (err) {
    console.error("Startup last_seen_at migration warning (non-fatal):", err);
  }

  // Run expired folder/file cleanup on startup and then daily at 03:00 UK time
  async function runExpiredFolderCleanup() {
    try {
      const count = await storage.cleanupExpiredFolders();
      if (count > 0) {
        console.log(`[scheduler] Deleted ${count} expired client upload file(s) and any empty folders.`);
      }
      storage.upsertSchedulerRun("folder-cleanup").catch(() => {});
    } catch (err) {
      console.error("[scheduler] Expired folder cleanup error:", err);
    }
  }
  function scheduleNextFolderCleanup() {
    const ms = msUntilNextUKTime(3, 0);
    const nextRun = new Date(Date.now() + ms);
    console.log(`[scheduler] Next expired-folder cleanup scheduled for ${nextRun.toISOString()} (${Math.round(ms / 60000)} min from now).`);
    setTimeout(async () => {
      await runExpiredFolderCleanup();
      scheduleNextFolderCleanup();
    }, ms).unref();
  }

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
      storage.upsertSchedulerRun("document-sweep").catch(() => {});
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

  // Run iShare expired file/folder cleanup on startup and then daily at 04:00 UK time
  async function runExpiredIshareCleanup() {
    try {
      const count = await storage.cleanupExpiredIshares();
      if (count > 0) {
        console.log(`[scheduler] Deleted ${count} expired iShare file(s) and any empty folders.`);
      }
      storage.upsertSchedulerRun("ishare-cleanup").catch(() => {});
    } catch (err) {
      console.error("[scheduler] Expired iShare cleanup error:", err);
    }
  }
  function scheduleNextIshareCleanup() {
    const ms = msUntilNextUKTime(4, 0);
    const nextRun = new Date(Date.now() + ms);
    console.log(`[scheduler] Next iShare cleanup scheduled for ${nextRun.toISOString()} (${Math.round(ms / 60000)} min from now).`);
    setTimeout(async () => {
      await runExpiredIshareCleanup();
      scheduleNextIshareCleanup();
    }, ms).unref();
  }

  // Run folder cleanup once on startup, then schedule for 03:00 UK each day
  runExpiredFolderCleanup();
  scheduleNextFolderCleanup();

  // Run iShare cleanup once on startup, then schedule for 04:00 UK each day
  runExpiredIshareCleanup();
  scheduleNextIshareCleanup();

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
      for (const [sourceCode, sourceLinks] of Array.from(bySource)) {
        try {
          const { connected } = await getConnectionStatus(sourceCode);
          if (!connected) {
            console.warn(`[scheduler] Accelo sync: source ${sourceCode} not connected — skipping ${sourceLinks.length} companies.`);
            continue;
          }
          const BATCH_SIZE = 50;
          const updates: Array<{ companyId: string; sourceCode: string; acceloStanding: string | null; acceloType?: string | null; acceloColor?: string | null }> = [];
          for (let i = 0; i < sourceLinks.length; i += BATCH_SIZE) {
            const batch = sourceLinks.slice(i, i + BATCH_SIZE);
            const ids = batch.map((l: typeof sourceLinks[number]) => l.acceloId).join("|");
            try {
              const data = await acceloGet(sourceCode, `/companies?_filters=id_in(${ids})&_fields=id,standing,company_status(id,title,color)&_limit=${BATCH_SIZE}`);
              const results = Array.isArray(data?.response) ? data.response : [];
              for (const r of results) {
                const link = batch.find((l: typeof sourceLinks[number]) => String(l.acceloId) === String(r.id));
                const rawStatus = r.company_status;
                const acceloType = rawStatus
                  ? (typeof rawStatus === "string" ? rawStatus : (rawStatus?.title ?? null))
                  : null;
                const acceloColor = rawStatus && typeof rawStatus === "object" ? (rawStatus?.color ?? null) : null;
                if (link) updates.push({ companyId: link.companyId, sourceCode, acceloStanding: r.standing ?? null, acceloType, acceloColor });
              }
            } catch (batchErr: any) {
              console.error(`[scheduler] Accelo sync batch error (source=${sourceCode}):`, batchErr.message);
            }
          }
          if (updates.length > 0) await storage.bulkUpdateAcceloStandings(updates);
          await storage.createAcceloSyncLog({
            syncType: "scheduled",
            sourceCode,
            triggeredBy: "system",
            triggeredByName: "Scheduled Sync",
            companiesTotal: sourceLinks.length,
            companiesUpdated: updates.length,
            success: true,
          });
          console.log(`[scheduler] Accelo sync (source=${sourceCode}): ${updates.length}/${sourceLinks.length} standing(s) updated.`);
        } catch (sourceErr: any) {
          console.error(`[scheduler] Accelo sync source ${sourceCode} error:`, sourceErr.message);
          await storage.createAcceloSyncLog({
            syncType: "scheduled",
            sourceCode,
            triggeredBy: "system",
            triggeredByName: "Scheduled Sync",
            companiesTotal: sourceLinks.length,
            companiesUpdated: 0,
            success: false,
            errorMessage: sourceErr.message,
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("[scheduler] Accelo status sync error:", err);
    }
  }

  function scheduleNextAcceloSync() {
    if (process.env.NODE_ENV !== "production") {
      console.log("[scheduler] Accelo status sync skipped — only runs in production.");
      return;
    }
    const ms = msUntilNextUKTime(7, 0);
    const nextRun = new Date(Date.now() + ms);
    console.log(`[scheduler] Next Accelo status sync scheduled for ${nextRun.toISOString()} (${Math.round(ms / 60000)} min from now).`);
    setTimeout(async () => {
      await runAcceloStatusSync();
      scheduleNextAcceloSync();
    }, ms).unref();
  }

  scheduleNextAcceloSync();

  // Accelo keep-alive: exercises the refresh token regularly (every 6 hours, in every
  // environment) so it never goes stale from inactivity. This is what makes the Accelo
  // connection "set and forget" — Accelo access tokens always expire (~1 hour) but as
  // long as the refresh token is used periodically it keeps renewing itself indefinitely.
  // If a refresh ever fails (e.g. Accelo revoked the refresh token), alert by email so
  // someone can manually reconnect via /admin/integrations/accelo — capped to one email
  // per source per 24 hours to avoid spamming.
  const acceloDisconnectAlertedAt = new Map<string, number>();
  const ACCELO_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  async function runAcceloKeepAlive() {
    try {
      const integrations = await listIntegrations();
      for (const integration of integrations) {
        if (!integration.refreshToken) continue; // never connected yet — nothing to keep alive
        // Use verifyConnection (a real call to Accelo) rather than getValidAccessToken alone —
        // getValidAccessToken short-circuits and skips contacting Accelo whenever our locally
        // cached expires_at hasn't passed yet, so it can't detect a token Accelo has already
        // revoked out-of-band. verifyConnection always checks against Accelo for real.
        const result = await verifyConnection(integration.sourceCode);
        if (!result.ok) {
          console.error(`[scheduler] Accelo keep-alive failed for source ${integration.sourceCode}:`, result.error);
          const lastAlert = acceloDisconnectAlertedAt.get(integration.sourceCode) ?? 0;
          if (Date.now() - lastAlert > ACCELO_ALERT_COOLDOWN_MS) {
            acceloDisconnectAlertedAt.set(integration.sourceCode, Date.now());
            try {
              const labels = await getSourceLabels();
              await sendAcceloDisconnectAlertEmail({
                sourceCode: integration.sourceCode,
                sourceLabel: labels[integration.sourceCode] || integration.sourceCode,
                errorMessage: result.error ?? "Unknown error",
              });
            } catch (emailErr) {
              console.error("[scheduler] Failed to send Accelo disconnect alert email:", emailErr);
            }
          }
        } else {
          acceloDisconnectAlertedAt.delete(integration.sourceCode);
        }
      }
    } catch (err) {
      console.error("[scheduler] Accelo keep-alive error:", err);
    }
  }

  function scheduleNextAcceloKeepAlive() {
    const INTERVAL_MS = 6 * 60 * 60 * 1000;
    setTimeout(async () => {
      await runAcceloKeepAlive();
      scheduleNextAcceloKeepAlive();
    }, INTERVAL_MS).unref();
  }

  // Run once on startup, then every 6 hours, in every environment.
  runAcceloKeepAlive();
  scheduleNextAcceloKeepAlive();

  // These downloads expose internal, commercially sensitive Guardian Group
  // material (strategic overview / competitive analysis). Access requires an
  // authenticated staff session — a live DB lookup is used (rather than the
  // cached session snapshot) so a deactivated/demoted account loses access
  // immediately, matching the pattern used for other sensitive-data routes.
  const requireInternalStaffSession = async (req: Request, res: Response): Promise<boolean> => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return false;
    }
    const user = await storage.getUser(userId);
    if (!user || user.status === "inactive" || user.status === "blocked" || user.status === "locked") {
      res.status(401).json({ error: "Authentication required" });
      return false;
    }
    if (user.role !== "developer" && user.role !== "administrator" && user.role !== "consultant") {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
    return true;
  };

  app.get("/downloads/strategic-overview.pptx", async (req, res) => {
    if (!(await requireInternalStaffSession(req, res))) return;
    try {
      const fs = await import("fs");
      const buf = fs.readFileSync("/home/runner/workspace/guardian-group-strategic-overview.pptx");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", 'attachment; filename="guardian-group-strategic-overview.pptx"');
      res.setHeader("Content-Length", buf.length);
      res.end(buf);
    } catch (e) {
      console.error("[pptx]", e);
      res.status(500).end();
    }
  });

  app.get("/downloads/competitive-analysis.docx", async (req, res) => {
    if (!(await requireInternalStaffSession(req, res))) return;
    try {
      const { buildCompetitiveReport } = await import("./competitive-report");
      const buf = await buildCompetitiveReport();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", 'attachment; filename="guardian-competitive-analysis.docx"');
      res.setHeader("Content-Length", buf.length);
      res.end(buf);
    } catch (e) {
      console.error("[report]", e);
      res.status(500).end();
    }
  });

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
