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
import { autoRecordPublishedPatch } from "./changelog";

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
      connectSrc: ["'self'"],
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
