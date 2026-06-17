import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  buildAuthUrlFromIntegration,
  exchangeCode,
  saveTokens,
  clearTokens,
  getConnectionStatus,
  acceloGet,
  getIntegration,
  listIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  decodeOAuthState,
  getSourceLabels,
} from "./accelo";
import fs from "fs/promises";
import { createWriteStream, existsSync } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import type { ModuleType, InvitationPurpose, InsertService } from "@shared/schema";
import { pool } from "./db";
import { SECURITY_CONFIG, getClientCapabilities } from "@shared/schema";
import PDFDocument from "pdfkit";
import archiver from "archiver";
import { registerObjectStorageRoutes, ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage";
import { sendInvitationEmail, sendPasswordResetEmail, sendDocumentApprovalEmail, sendClientSignOffEmail, sendAutoApprovedNotificationEmail, sendDocumentApprovedEmail, sendChangesRequestedEmail, sendCloudUploadNotificationEmail, sendIShareNotificationEmail, sendBookingEnquiryEmail, sendIncidentNotificationEmail, listResendEmails, getResendEmail, getResendEnvironment } from "./email";
import type { ResendEmailSummary } from "./email";
import { readChangelog, writeChangelog, generateChangelogId, bumpDevPatchAfterPublish, type ChangelogCategory, type ChangelogEntry } from "./changelog";
import { addClient, removeClient, emitToUser, emitToRole, emitToCompany, emitToAll, getOnlineUserIds } from "./sse";

const execAsync = promisify(exec);

// ── Bundle PDF Generation ─────────────────────────────────────────────────────

// Serial queue: only one LibreOffice conversion at a time globally
let _libreOfficeQueue: Promise<unknown> = Promise.resolve();

function withLibreOffice<T>(fn: () => Promise<T>): Promise<T> {
  let res!: (v: T) => void;
  let rej!: (e: unknown) => void;
  const p = new Promise<T>((r, e) => { res = r; rej = e; });
  _libreOfficeQueue = _libreOfficeQueue.then(
    () => fn().then(res, rej),
    () => fn().then(res, rej),
  );
  return p;
}

// Serial queue: only one bundle PDF generation pipeline at a time globally
let _bundleQueue: Promise<unknown> = Promise.resolve();

function withBundleGeneration<T>(fn: () => Promise<T>): Promise<T> {
  let res!: (v: T) => void;
  let rej!: (e: unknown) => void;
  const p = new Promise<T>((r, e) => { res = r; rej = e; });
  _bundleQueue = _bundleQueue.then(
    () => fn().then(res, rej),
    () => fn().then(res, rej),
  );
  return p;
}

function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.ms-outlook": "msg",
    "application/rtf": "rtf",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/vnd.oasis.opendocument.text": "odt",
    "application/vnd.oasis.opendocument.spreadsheet": "ods",
    "application/vnd.oasis.opendocument.presentation": "odp",
    "application/vnd.oasis.opendocument.graphics": "odg",
    "text/html": "html",
    "application/xhtml+xml": "xhtml",
  };
  return map[mimeType] ?? "bin";
}

/** Derive file extension from filename when MIME type is generic (e.g. application/octet-stream). */
function extensionFromFileName(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const ext = fileName.split(".").pop()?.toLowerCase();
  const allowed = new Set(["docx","doc","xlsx","xls","pptx","ppt","msg","rtf","txt","csv","odt","ods","odp","odg","html","xhtml","pdf"]);
  return ext && allowed.has(ext) ? ext : null;
}

/** Parse image dimensions from PNG/JPEG buffer headers without any-cast hacks. */
function getImageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } {
  try {
    if (mimeType === "image/png" && buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    } else if ((mimeType === "image/jpeg" || mimeType === "image/jpg") && buffer.length > 10) {
      let i = 2;
      while (i < buffer.length - 8) {
        if (buffer[i] !== 0xff) break;
        const marker = buffer[i + 1];
        const segLen = buffer.readUInt16BE(i + 2);
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const h = buffer.readUInt16BE(i + 5);
          const w = buffer.readUInt16BE(i + 7);
          if (w > 0 && h > 0) return { width: w, height: h };
        }
        i += 2 + segLen;
      }
    }
  } catch {
    // fall through
  }
  return { width: 800, height: 600 };
}

async function convertFileToPdf(
  fileBuffer: Buffer,
  mimeType: string,
  tempDir: string,
  index: number,
  fileName?: string | null,
): Promise<string> {
  const outputPath = path.join(tempDir, `${index}.pdf`);

  if (mimeType === "application/pdf") {
    await fs.writeFile(outputPath, fileBuffer);
    return outputPath;
  }

  if (mimeType.startsWith("image/")) {
    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 0 });
      const stream = createWriteStream(outputPath);
      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.pipe(stream);

      const A4_W = 595, A4_H = 842, MARGIN = 20;
      const maxW = A4_W - 2 * MARGIN;
      const maxH = A4_H - 2 * MARGIN;

      try {
        const { width: nW, height: nH } = getImageDimensions(fileBuffer, mimeType);
        let drawW = nW, drawH = nH;
        if (nW > maxW || nH > maxH) {
          const scale = Math.min(maxW / nW, maxH / nH);
          drawW = Math.floor(nW * scale);
          drawH = Math.floor(nH * scale);
        }
        const x = (A4_W - drawW) / 2;
        const y = (A4_H - drawH) / 2;
        doc.image(fileBuffer, x, y, { width: drawW, height: drawH });
      } catch (err) {
        // If image embedding fails, create blank page
        doc.text("(Image could not be rendered)", 50, 50);
      }
      doc.end();
    });
    return outputPath;
  }

  // Office file — convert via LibreOffice (serial queue)
  return withLibreOffice(async () => {
    // If MIME type is generic, fall back to extension derived from the original filename
    const ext = mimeToExtension(mimeType) !== "bin"
      ? mimeToExtension(mimeType)
      : (extensionFromFileName(fileName) ?? "bin");
    const outDir = path.join(tempDir, `lo_${index}`);
    await fs.mkdir(outDir, { recursive: true });

    if (ext === "msg") {
      // .msg is OLE2 binary (Outlook email) — LibreOffice cannot open it.
      // Use extract-msg + pyppeteer (Python) to produce an A4 PDF via headless Chromium.
      const msgPath = path.join(tempDir, `${index}_src.msg`);
      await fs.writeFile(msgPath, fileBuffer);
      const pythonScript = path.join(process.cwd(), "server", "msg_to_html.py");
      const pythonBin = path.join(process.cwd(), ".pythonlibs", "bin", "python3");
      const python = (await fs.access(pythonBin).then(() => true).catch(() => false))
        ? pythonBin
        : "python3";
      await execAsync(`"${python}" "${pythonScript}" "${msgPath}" "${outputPath}"`, { timeout: 60_000 });
      return outputPath;
    }

    const inputPath = path.join(tempDir, `${index}_src.${ext}`);
    await fs.writeFile(inputPath, fileBuffer);

    await execAsync(
      `soffice --headless --norestore --nologo --nolockcheck --convert-to pdf --outdir "${outDir}" "${inputPath}"`,
      { timeout: 60_000, env: { ...process.env, HOME: outDir } },
    );
    const outFiles = await fs.readdir(outDir);
    const pdfFile = outFiles.find(f => f.endsWith(".pdf"));
    if (!pdfFile) throw new Error(`LibreOffice produced no PDF for file ${index} (ext: ${ext})`);
    await fs.rename(path.join(outDir, pdfFile), outputPath);
    return outputPath;
  });
}

// ── DOCX Preview Cache ────────────────────────────────────────────────────────

const DOCX_PREVIEW_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

// In-memory cache stores the PDF buffer directly so repeat views skip GCS entirely.
const docxPreviewCache = new Map<string, { buffer: Buffer; gcsPath: string; cachedAt: number }>();
const DOCX_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Per-site cooldown for cloud upload notifications — one email per site per hour maximum.
const cloudUploadNotifiedAt = new Map<string, Date>();
const CLOUD_UPLOAD_NOTIFY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// Per-folder cooldown for iShare notifications — one email per folder per hour maximum.
const ishareNotifiedAt = new Map<string, Date>();

// Periodic cleanup: evict expired entries and delete their backing GCS objects.
setInterval(async () => {
  const now = Date.now();
  const svc = new ObjectStorageService();
  for (const [key, entry] of docxPreviewCache.entries()) {
    if (now - entry.cachedAt >= DOCX_CACHE_TTL_MS) {
      docxPreviewCache.delete(key);
      try { await svc.deleteObjectEntityFile(entry.gcsPath); } catch {}
    }
  }
}, 15 * 60 * 1000).unref();


// Pre-warm LibreOffice on startup so the first real conversion is faster.
(async () => {
  try {
    const warmDir = await fs.mkdtemp(path.join(os.tmpdir(), "lowarm_"));
    const dummyPath = path.join(warmDir, "warm.txt");
    await fs.writeFile(dummyPath, "warm");
    await execAsync(
      `soffice --headless --norestore --nologo --nolockcheck --convert-to pdf --outdir "${warmDir}" "${dummyPath}"`,
      { timeout: 30_000, env: { ...process.env, HOME: warmDir } },
    ).catch(() => {});
    await fs.rm(warmDir, { recursive: true, force: true }).catch(() => {});
    console.log("[docx-preview] LibreOffice pre-warmed.");
  } catch {}
})();

async function getOrConvertDocxPreview(fileUrl: string, mimeType: string): Promise<Buffer> {
  const cacheKey = crypto.createHash("sha256").update(fileUrl).digest("hex").slice(0, 32);
  const objectStorageService = new ObjectStorageService();
  const now = Date.now();
  const cached = docxPreviewCache.get(cacheKey);

  // Cache hit: return buffer directly from memory — no GCS round-trip needed.
  if (cached && (now - cached.cachedAt) < DOCX_CACHE_TTL_MS) {
    return cached.buffer;
  }

  // Stale entry: clean up GCS and remove from map.
  if (cached) {
    docxPreviewCache.delete(cacheKey);
    try { await objectStorageService.deleteObjectEntityFile(cached.gcsPath); } catch {}
  }

  const objectFile = await objectStorageService.getObjectEntityFile(fileUrl);
  const [docxBuf] = await objectFile.download();

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "docxprev_"));
  let pdfBuffer: Buffer;
  try {
    const pdfPath = await convertFileToPdf(
      Buffer.from(docxBuf),
      mimeType,
      tempDir,
      0,
    );
    pdfBuffer = await fs.readFile(pdfPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }

  // Cache the buffer immediately so any concurrent/subsequent request gets a
  // hit straight away — don't wait for the GCS backup to finish.
  docxPreviewCache.set(cacheKey, { buffer: pdfBuffer, gcsPath: "", cachedAt: now });

  // Back up to GCS in the background; update gcsPath once done.
  objectStorageService.saveDocxPreview(pdfBuffer, cacheKey)
    .then(gcsPath => {
      const entry = docxPreviewCache.get(cacheKey);
      if (entry) docxPreviewCache.set(cacheKey, { ...entry, gcsPath });
    })
    .catch(() => { /* GCS save failed — in-memory cache is still valid */ });

  return pdfBuffer;
}

async function mergePdfs(pdfPaths: string[], outputPath: string): Promise<void> {
  const quoted = pdfPaths.map(p => `"${p}"`).join(" ");
  await execAsync(
    `gs -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -sOutputFile="${outputPath}" ${quoted}`,
    { timeout: 120_000 },
  );
}

async function countPdfPages(pdfPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `gs -q -dNODISPLAY -c "(${pdfPath}) (r) file runpdfbegin pdfpagecount = quit"`,
      { timeout: 30_000 },
    );
    const n = parseInt(stdout.trim(), 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

async function addPageNumbers(inputPath: string, outputPath: string): Promise<void> {
  // Uses a Python script (pypdf + reportlab) to stamp page numbers.
  // The old Ghostscript BeginPage/EndPage hook approach misfired on Chromium-generated
  // PDFs (transparency layers cause BeginPage to fire 3× per page → numbers 3, 6, 9 …).
  const scriptPath = path.join(process.cwd(), "server", "add_page_numbers.py");
  const libBin = path.join(process.cwd(), ".pythonlibs", "bin", "python3");
  const pythonBin = existsSync(libBin) ? libBin : "python3";
  console.log(`[addPageNumbers] using pythonBin=${pythonBin}`);
  const { stdout, stderr } = await execAsync(`"${pythonBin}" "${scriptPath}" "${inputPath}" "${outputPath}"`, {
    timeout: 120_000,
  });
  if (stdout) console.log("[addPageNumbers] stdout:", stdout.trim());
  if (stderr) console.warn("[addPageNumbers] stderr:", stderr.trim());
}

const BCRYPT_SALT_ROUNDS = 12;

// Invitation token configuration
const INVITE_TOKEN_EXPIRY_HOURS = 48; // 48 hours for new user invites
const RESET_TOKEN_EXPIRY_HOURS = 1; // 1 hour for password resets

// Generate a secure random token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash a token for storage (we don't store raw tokens)
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Returns true if the user is allowed to manage the Template Library
// (admins, plus consultants whose `templateLibrary` permission toggle is on).
// Anyone who can see the page gets full add/edit/archive/delete access.
function canManageTemplateLibrary(user: { role?: string | null; consultantPermissions?: unknown } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "developer") return true;
  if (user.role === "consultant" || user.role === "administrator") {
    const perms = user.consultantPermissions as { templateLibrary?: boolean } | null;
    return perms?.templateLibrary === true;
  }
  return false;
}

const createDocumentSchema = z.object({
  title: z.string().min(1),
  comments: z.string().optional().nullable(),
  module: z.enum(["health_safety", "human_resources", "employment_law", "training", "support"]),
  type: z.string().min(1),
  documentTypeId: z.string().nullable().optional(),
  // siteId is required for site-scope docs; optional for company/group scope
  siteId: z.string().optional().nullable(),
  // scope: 'site' (default), 'company', or 'group'
  scope: z.enum(["site", "company", "group"]).optional().default("site"),
  // entityId: company ID — required for company/group scope; inferred from siteId for site scope
  entityId: z.string().optional().nullable(),
  folderId: z.string().nullable().optional(),
  caseId: z.string().nullable().optional(),
  fileName: z.string().min(1),
  fileUrl: z.string().optional(),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
  expiryDate: z.string().optional(),
  renewalDate: z.string().optional(),
  source: z.enum(["template", "upload", "external"]).optional(),
  templateId: z.string().optional(),
  templateVersion: z.number().optional(),
  // Training certificate specific fields
  trainingCourseTitle: z.string().optional(),
  trainingCourseCode: z.string().optional(),
  trainingDate: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  autoFinalApproval: z.boolean().optional(),
  isMandatory: z.boolean().optional(),
  approvalRequestedFrom: z.string().optional(),
  notifyUserIds: z.array(z.string()).optional(),
  renewalPeriodMonths: z.number().nullable().optional(),
  shareDestinations: z.array(z.string()).optional(),
  // When an Admin (administrator) uploads a document that requires approval, they must
  // nominate a consultant to own the sign-off. The document is stored as owned by that
  // consultant (uploadedBy), with the admin recorded as the initiator (initiatedByUserId).
  onBehalfOfUserId: z.string().optional(),
});

const createCaseSchema = z.object({
  entityId: z.string().min(1),
  siteId: z.string().min(1),
  caseNumber: z.string().min(1),
  caseName: z.string().min(1, "Case name is required"),
  employeeName: z.string().min(1),
  employeeId: z.string().optional(),
  caseType: z.enum(["disciplinary", "grievance", "tupe", "redundancy", "tribunal_claim", "settlement", "appeal", "investigation"]),
  description: z.string().optional(),
  isConfidential: z.boolean().optional(),
  sources: z.array(z.string()).optional(),
  restrictedToUsers: z.array(z.string()).optional(),
  hearingDate: z.string().optional(),
  responseDeadline: z.string().min(1, "Response deadline is required"),
});

const updateCaseSchema = z.object({
  caseNumber: z.string().min(1).optional(),
  caseName: z.string().min(1).optional(),
  status: z.enum(["open", "under_investigation", "hearing_scheduled", "resolved", "closed"]).optional(),
  description: z.string().optional(),
  isConfidential: z.boolean().optional(),
  sources: z.array(z.string()).optional(),
  restrictedToUsers: z.array(z.string()).optional(),
  hearingDate: z.string().optional(),
  responseDeadline: z.string().optional(),
  resolutionDate: z.string().optional(),
  assignedConsultant: z.string().optional(),
});

const createMilestoneSchema = z.object({
  caseId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});

const createChecklistItemSchema = z.object({
  caseId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  submissionDate: z.string().optional().nullable(),
});

const createSupportRequestSchema = z.object({
  subject: z.string().min(5),
  description: z.string().min(20),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string().min(1),
  siteId: z.string().min(1),
  module: z.enum(["health_safety", "human_resources", "employment_law", "support"]).optional(),
});

const updateSupportRequestSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  assignedTo: z.string().nullable().optional(),
  response: z.string().optional(),
});

const createFeedbackSchema = z.object({
  message: z.string().min(1),
});

const updateFeedbackSchema = z.object({
  adminNotes: z.string().optional(),
});

const approvalSchema = z.object({
  action: z.enum(["approve", "changes"]),
  feedback: z.string().optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  turnstileToken: z.string().optional(),
});

const createDocumentTypeSchema = z.object({
  name: z.string().min(1),
  module: z.enum(["health_safety", "human_resources", "employment_law", "training", "support"]),
  description: z.string().optional(),
  isMandatory: z.boolean().optional(),
  renewalPeriodMonths: z.number().positive().optional().nullable(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

const updateDocumentTypeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isMandatory: z.boolean().optional(),
  renewalPeriodMonths: z.number().positive().optional().nullable(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  // Health check endpoint — no auth, no DB queries, responds immediately.
  // Used by uptime monitors and load balancers to confirm the process is alive.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ts: Date.now() });
  });

  // Destroy all active sessions belonging to client users of a given company.
  // Uses direct SQL to avoid loading the entire users table into memory.
  async function destroyCompanyClientSessions(companyId: string): Promise<number> {
    try {
      // Targeted query: fetch only the IDs of client users for this company
      const { rows: userRows } = await pool.query<{ id: string }>(
        "SELECT id FROM users WHERE entity_id = $1 AND role = 'client'",
        [companyId]
      );
      const clientUserIds = userRows.map(r => r.id);
      if (clientUserIds.length === 0) return 0;
      const { rowCount } = await pool.query(
        "DELETE FROM session WHERE (sess::json->>'userId') = ANY($1::text[])",
        [clientUserIds]
      );
      const terminated = rowCount ?? 0;
      console.log(`[company-status] Terminated ${terminated} session(s) for ${clientUserIds.length} client(s) of company ${companyId}`);
      return terminated;
    } catch (err) {
      // Log but do not re-throw: the status update has already been persisted.
      // Any sessions that slip through will be caught by the auth/me safety net.
      console.error("[company-status] Failed to destroy client sessions:", err);
      return 0;
    }
  }

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid credentials format" });
      }

      const { username: rawIdentifier, password, turnstileToken } = parseResult.data;
      const loginIdentifier = rawIdentifier.toLowerCase().trim();
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

      // Verify Cloudflare Turnstile token when secret key is configured
      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
      if (turnstileSecret) {
        if (!turnstileToken) {
          return res.status(400).json({ error: "Security verification required. Please complete the challenge and try again." });
        }
        try {
          const formData = new FormData();
          formData.append("secret", turnstileSecret);
          formData.append("response", turnstileToken);
          formData.append("remoteip", ipAddress);
          const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            body: formData,
          });
          const verifyData = await verifyRes.json() as { success: boolean };
          if (!verifyData.success) {
            return res.status(400).json({ error: "Security verification failed. Please refresh and try again." });
          }
        } catch {
          return res.status(500).json({ error: "Could not verify security token. Please try again." });
        }
      }
      const userAgent = req.get("User-Agent") || "unknown";

      // Check if account is locked due to too many failed attempts
      const isLocked = await storage.isAccountLocked(loginIdentifier);
      if (isLocked) {
        await storage.recordLoginAttempt({
          username: loginIdentifier,
          ipAddress,
          userAgent,
          success: false,
          failureReason: "account_locked",
        });
        
        // Create audit log for locked account attempt
        const lockedUser = loginIdentifier.includes("@") 
          ? await storage.getUserByEmail(loginIdentifier) 
          : await storage.getUserByUsername(loginIdentifier);
        if (lockedUser) {
          await storage.createAuditLog({
            action: "account_locked",
            userId: lockedUser.id,
            userName: lockedUser.fullName,
            details: `Login attempt while account locked from IP ${ipAddress}`,
          });
        }
        
        return res.status(423).json({ 
          error: `Account temporarily locked. Please try again in ${SECURITY_CONFIG.lockoutDurationMinutes} minutes.` 
        });
      }

      const user = loginIdentifier.includes("@") 
        ? await storage.getUserByEmail(loginIdentifier) 
        : await storage.getUserByUsername(loginIdentifier);

      // Check if user exists
      if (!user) {
        await storage.recordLoginAttempt({
          username: loginIdentifier,
          ipAddress,
          userAgent,
          success: false,
          failureReason: "user_not_found",
        });
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Check if user account is locked by status (permanent lock requiring reset or admin unlock)
      if (user.status === "locked") {
        await storage.recordLoginAttempt({
          username: loginIdentifier,
          ipAddress,
          userAgent,
          success: false,
          failureReason: "account_locked",
        });
        return res.status(423).json({ 
          error: "Your account has been locked due to too many failed login attempts. Please reset your password using the Forgot Password link, or contact an administrator.",
          code: "account_locked",
        });
      }

      // Inactive users are blocked by an administrator — only an admin/consultant can re-activate them.
      // Return a generic 401 so the reason isn't revealed; do not count this toward lockout.
      if (user.status === "inactive") {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Block client users whose company is On Hold or Inactive
      if (user.role === "client" && user.companyId) {
        const userCompany = await storage.getCompany(user.companyId);
        if (userCompany && (userCompany.status === "on_hold" || userCompany.status === "cancelled")) {
          return res.status(403).json({ error: "Your account is currently unavailable. Please contact your Consultant." });
        }
      }

      // Check password - support both bcrypt hashed and legacy plain text (for migration)
      let passwordValid = false;
      if (user.password.startsWith("$2")) {
        // Bcrypt hashed password
        passwordValid = await bcrypt.compare(password, user.password);
      } else {
        // Legacy plain text password - upgrade it
        passwordValid = user.password === password;
        if (passwordValid) {
          // Upgrade to bcrypt hash
          const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
          await storage.updateUser(user.id, { password: hashedPassword });
        }
      }

      if (!passwordValid) {
        await storage.recordLoginAttempt({
          username: loginIdentifier,
          ipAddress,
          userAgent,
          success: false,
          failureReason: "invalid_password",
        });
        
        // Check if this failure triggers a lockout — only lock active accounts.
        // Inactive/invited/etc. users are already blocked above; we never change their status.
        const nowLocked = await storage.isAccountLocked(loginIdentifier);
        if (nowLocked && user.status === "active") {
          // Permanently lock the user account (requires reset or admin unlock)
          await storage.updateUser(user.id, { status: "locked" });
          await storage.createAuditLog({
            action: "account_locked",
            userId: user.id,
            userName: user.fullName,
            details: `Account locked after ${SECURITY_CONFIG.maxLoginAttempts} failed attempts from IP ${ipAddress}`,
          });
          return res.status(423).json({ 
            error: "Your account has been locked due to too many failed login attempts. Please reset your password using the Forgot Password link, or contact an administrator.",
            code: "account_locked",
          });
        }
        
        // Calculate remaining attempts before lockout
        const recentAttempts = await storage.getRecentLoginAttempts(loginIdentifier, SECURITY_CONFIG.lockoutDurationMinutes);
        let consecutiveFailed = 0;
        for (const attempt of recentAttempts) {
          if (attempt.success) break;
          consecutiveFailed++;
        }
        const remaining = SECURITY_CONFIG.maxLoginAttempts - consecutiveFailed;
        
        return res.status(401).json({ 
          error: "Invalid username or password",
          attemptsRemaining: remaining > 0 ? remaining : 0,
        });
      }

      // Successful login - record attempt
      await storage.recordLoginAttempt({
        username: loginIdentifier,
        ipAddress,
        userAgent,
        success: true,
      });

      // Create audit log for successful login
      await storage.createAuditLog({
        action: "login",
        userId: user.id,
        userName: user.fullName,
        details: `Successful login from IP ${ipAddress}`,
      });

      // Update last login timestamp
      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      // Invalidate any outstanding password-reset tokens — if the user just proved
      // they know their password, any reset link in their inbox is now redundant.
      try {
        await storage.invalidateUserInvitations(user.id, "password_reset");
      } catch (tokenErr) {
        console.error("Failed to invalidate reset tokens on login:", tokenErr);
      }

      // Set user in session
      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        clientPermissionRole: user.clientPermissionRole,
        consultantTier: user.consultantTier,
        sources: user.sources,
      };

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        clientPermissionRole: user.clientPermissionRole,
        consultantTier: user.consultantTier,
        consultantPermissions: user.consultantPermissions,
        title: user.title,
        firstName: user.firstName,
        lastName: user.lastName,
        jobTitle: user.jobTitle,
        department: user.department,
        phone: user.phone,
        mobile: user.mobile,
        preferredContactMethod: user.preferredContactMethod,
        notes: user.notes,
        referenceNumber: user.referenceNumber,
        legalAcceptedAt: user.legalAcceptedAt,
        sources: user.sources,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const user = (req.session as any)?.user;
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      
      // Create audit log for logout before destroying session
      if (user) {
        try {
          await storage.createAuditLog({
            action: "logout",
            userId: user.id,
            userName: user.fullName,
            details: `User logged out from IP ${ipAddress}`,
          });
        } catch (auditErr) {
          console.error("Failed to create logout audit log:", auditErr);
        }
      }
      
      // Set headers to prevent caching of auth state
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
        
        res.clearCookie("guardian.sid", { path: "/" });
        res.clearCookie("guardian.sid");
        
        res.json({ message: "Logged out successfully" });
      });
    } catch (err) {
      console.error("Logout error:", err);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Run company lookup and legal-revision check in parallel — saves ~200-300 ms per request
    const [company, latestRevision] = await Promise.all([
      user.companyId ? storage.getCompany(user.companyId) : Promise.resolve(null),
      getLatestLegalRevisionDate(),
    ]);

    const companyName: string | null = company?.name ?? null;

    // Safety net: if the company is suspended, destroy the session and kick the client out
    if (user.role === "client" && company && (company.status === "on_hold" || company.status === "cancelled")) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Your account is currently unavailable. Please contact your Consultant." });
    }

    // Group-primary-contact check — only needed for client primary contacts of group-owner companies
    let isGroupPrimaryContact = false;
    if (user.role === "client" && user.companyId && company?.contactUserId === user.id) {
      const groupMembers = await storage.getGroupMembers(user.companyId);
      isGroupPrimaryContact = groupMembers.length > 0;
    }

    // Use the already-fetched latestRevision for legal acceptance check
    const legalAcceptanceRequired = latestRevision
      ? (!user.legalAcceptedAt || new Date(user.legalAcceptedAt) < latestRevision)
      : false;

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
      companyName,
      clientPermissionRole: user.clientPermissionRole,
      referenceNumber: user.referenceNumber,
      title: user.title,
      firstName: user.firstName,
      lastName: user.lastName,
      jobTitle: user.jobTitle,
      department: user.department,
      phone: user.phone,
      mobile: user.mobile,
      preferredContactMethod: user.preferredContactMethod,
      notes: user.notes,
      legalAcceptedAt: user.legalAcceptedAt,
      consultantTier: user.consultantTier,
      consultantPermissions: user.consultantPermissions,
      legalAcceptanceRequired,
      sources: user.sources,
      isGroupPrimaryContact,
    });
  });

  // ==================== INVITATION & PASSWORD RESET ENDPOINTS ====================

  // Validate an invitation token (public - no auth required)
  app.get("/api/invitations/validate", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token is required" });
      }
      
      const tokenHash = hashToken(token);
      const invitation = await storage.getUserInvitationByToken(tokenHash);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invalid or expired invitation link" });
      }
      
      // Check if already used
      if (invitation.usedAt) {
        return res.status(400).json({ error: "This invitation has already been used" });
      }
      
      // Check if superseded by a newer invite/reset email
      if (invitation.invalidatedAt) {
        return res.status(400).json({ error: "This invitation link has been replaced by a newer email. Please use the most recent invitation we sent you." });
      }
      
      // Check if expired
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ error: "This invitation has expired. Please request a new one." });
      }
      
      // Get user info for the form
      const user = await storage.getUser(invitation.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        valid: true,
        purpose: invitation.purpose,
        email: user.email,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      console.error("Validate invitation error:", error);
      res.status(500).json({ error: "Failed to validate invitation" });
    }
  });

  // Accept an invitation and set password (public - no auth required)
  app.post("/api/invitations/accept", async (req, res) => {
    try {
      const { token, password, acceptedTerms, acceptedPrivacy } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      
      const tokenHash = hashToken(token);
      const invitation = await storage.getUserInvitationByToken(tokenHash);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invalid or expired invitation link" });
      }
      
      if (invitation.usedAt) {
        return res.status(400).json({ error: "This invitation has already been used" });
      }
      
      if (invitation.invalidatedAt) {
        return res.status(400).json({ error: "This invitation link has been replaced by a newer email. Please use the most recent invitation we sent you." });
      }
      
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ error: "This invitation has expired. Please request a new one." });
      }

      // For all new user invitations, enforce legal document acceptance server-side
      const invitedUser = await storage.getUser(invitation.userId);
      if (invitation.purpose === "invite") {
        const objectStorageService = new ObjectStorageService();
        const privateObjectDir = objectStorageService.getPrivateObjectDir();

        const checkDocExists = async (type: string) => {
          try {
            const fullPath = `${privateObjectDir}/legal/${type}`;
            const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
            const bucketName = pathParts[0];
            const objectName = pathParts.slice(1).join("/");
            const bucket = objectStorageClient.bucket(bucketName);
            const file = bucket.file(objectName);
            const [exists] = await file.exists();
            return exists;
          } catch {
            return false;
          }
        };

        const [termsExists, privacyExists] = await Promise.all([
          checkDocExists("terms"),
          checkDocExists("privacy"),
        ]);

        if (termsExists && !acceptedTerms) {
          return res.status(400).json({ error: "You must accept the Terms & Conditions to continue." });
        }
        if (privacyExists && !acceptedPrivacy) {
          return res.status(400).json({ error: "You must accept the Privacy Policy to continue." });
        }
      }
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      
      // Update user with the new password and set status to active
      // Also set legalAcceptedAt if this is a new invitation with legal documents accepted
      const updateData: any = {
        password: hashedPassword,
        status: "active",
      };
      if (invitation.purpose === "invite" && (acceptedTerms || acceptedPrivacy)) {
        updateData.legalAcceptedAt = new Date();
      }
      const updatedUser = await storage.updateUser(invitation.userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Mark the invitation as used
      await storage.markInvitationUsed(invitation.id);

      // Clear the lockout by recording a successful login attempt.
      // isAccountLocked() counts consecutive failures and stops at the first success,
      // so this immediately breaks the chain and lets the user log in again.
      if (invitation.purpose === "password_reset") {
        await storage.recordLoginAttempt({
          username: updatedUser.username || updatedUser.email,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
          success: true,
          failureReason: null,
        });
      }
      
      // Create audit log with legal acceptance details
      const legalDetails = invitation.purpose === "invite" 
        ? ` (T&C accepted: ${!!req.body.acceptedTerms}, Privacy accepted: ${!!req.body.acceptedPrivacy})`
        : "";
      
      await storage.createAuditLog({
        action: invitation.purpose === "invite" ? "user_activated" : "password_reset",
        userId: updatedUser.id,
        userName: updatedUser.fullName,
        details: (invitation.purpose === "invite" 
          ? "User accepted invitation and set their password" 
          : "User reset their password") + legalDetails,
      });

      // Notify admins/consultants so they see the status change without refreshing
      if (invitation.purpose === "invite") {
        emitToRole("developer", "user-updated", { userId: updatedUser.id });
        emitToRole("consultant", "user-updated", { userId: updatedUser.id });
      }
      
      res.json({ 
        success: true, 
        message: invitation.purpose === "invite" 
          ? "Account activated successfully. You can now log in." 
          : "Password reset successfully. You can now log in."
      });
    } catch (error) {
      console.error("Accept invitation error:", error);
      res.status(500).json({ error: "Failed to complete password setup" });
    }
  });

  // Request password reset (public - no auth required)
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ 
          success: true, 
          message: "If an account exists with this email, a password reset link will be sent." 
        });
      }
      
      // User must be active to reset password
      if (user.status === "invited") {
        return res.json({ 
          success: true, 
          message: "If an account exists with this email, a password reset link will be sent." 
        });
      }
      
      // Invalidate any existing reset tokens for this user
      await storage.invalidateUserInvitations(user.id, "password_reset");
      
      // Generate reset token
      const token = generateSecureToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
      
      await storage.createUserInvitation({
        userId: user.id,
        email: user.email,
        tokenHash,
        purpose: "password_reset",
        expiresAt,
        createdBy: null,
      });
      
      // Build the reset URL
      const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${baseUrl}/set-password?token=${token}`;
      
      // Send the password reset email
      let emailSent = false;
      try {
        await sendPasswordResetEmail({
          to: user.email,
          fullName: user.fullName,
          resetUrl,
          expiresAt,
          role: user.role,
        });
        emailSent = true;
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }
      
      console.log(`Password reset requested for ${email}, email sent: ${emailSent}`);
      
      const isDev = process.env.NODE_ENV !== 'production';
      res.json({ 
        success: true, 
        message: "If an account exists with this email, a password reset link will be sent.",
        ...(isDev && { resetUrl })
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // ==================== END PUBLIC INVITATION ENDPOINTS ====================

  // Authentication middleware for protected routes
  const requireAuth = (req: any, res: any, next: any) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };

  // Change password (authenticated users only)
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.session?.userId;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify the current password
      let currentValid = false;
      if (user.password.startsWith("$2")) {
        currentValid = await bcrypt.compare(currentPassword, user.password);
      } else {
        currentValid = user.password === currentPassword;
      }

      if (!currentValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
      await storage.updateUser(userId, { password: hashedPassword });

      await storage.createAuditLog({
        action: "password_changed",
        userId: user.id,
        userName: user.fullName,
        details: "User changed their password via settings",
      });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Helper: check if a consultant user has the pro tier
  // Function definition moved to before its first usage in Companies list route

  // Helper: returns the union of a consultant's own assigned site IDs plus the site IDs
  // of any consultant they are actively covering for today.
  const getEffectiveSiteIds = async (consultantId: string): Promise<Set<string>> => {
    const [ownAssignments, coveringFor] = await Promise.all([
      storage.getConsultantSites(consultantId),
      storage.getActiveCoverageForCovering(consultantId),
    ]);
    const siteIds = new Set<string>(ownAssignments.map(a => a.siteId));
    for (const c of coveringFor) {
      const absentAssignments = await storage.getConsultantSites(c.absentConsultantId);
      for (const a of absentAssignments) siteIds.add(a.siteId);
    }
    return siteIds;
  };

  // Helper to check if a client user can access a site (based on companyId)
  const canUserAccessSite = async (user: { id?: string; role: string; companyId: string | null; consultantTier?: string | null; sources?: string[] | null }, siteId: string): Promise<boolean> => {
    // Admins have unrestricted access to all sites
    if (user.role === "developer") return true;
    
    // Pro consultants (and Admins) can access sites whose parent company shares at least one source,
    // OR sites in member companies of a GO whose effective sources (own + members' union) overlap
    if (hasProPrivileges(user)) {
      const site = await storage.getSite(siteId);
      if (!site) return false;
      const company = await storage.getCompany(site.companyId);
      if (!company) return false;
      // Direct access via source overlap
      if (sourcesOverlap(user.sources ?? [], company.sources ?? [])) return true;
      // GO member access: check if site's company is a member of a GO with effective source overlap
      if (company.groupOwnerId) {
        const goEffectiveSources = await getEffectiveGoSources(company.groupOwnerId);
        if (sourcesOverlap(user.sources ?? [], goEffectiveSources)) return true;
      }
      return false;
    }
    
    // Standard consultants: must be directly assigned to the site (with source overlap),
    // OR the site is in a GO member company (GO-level source check),
    // OR the site belongs to a consultant they are actively covering for (no source check).
    if (user.role === "consultant" && user.id) {
      const site = await storage.getSite(siteId);
      if (!site) return false;
      const company = await storage.getCompany(site.companyId);
      if (!company) return false;

      // Use direct assignments only — source-overlap must apply to direct assignments
      const ownAssignments = await storage.getConsultantSites(user.id);
      const directSiteIds = new Set(ownAssignments.map(a => a.siteId));

      // Case 1: Direct assignment with source overlap
      if (directSiteIds.has(siteId)) {
        return sourcesOverlap(user.sources ?? [], company.sources ?? []);
      }
      
      // Case 2: GO member site — consultant is assigned to a site in the GO company
      if (company.groupOwnerId) {
        const allSites = await storage.getSitesWithDetails();
        const goSiteIds = new Set(allSites.filter(s => s.companyId === company.groupOwnerId).map(s => s.id));
        if ([...directSiteIds].some(id => goSiteIds.has(id))) {
          // Consultant is assigned to the GO — allow access to member site if effective GO sources overlap
          const goEffectiveSources = await getEffectiveGoSources(company.groupOwnerId);
          return sourcesOverlap(user.sources ?? [], goEffectiveSources);
        }
      }

      // Case 3: Coverage-derived — covering consultant gets full access without source check
      const coveringFor = await storage.getActiveCoverageForCovering(user.id);
      for (const coverage of coveringFor) {
        const absentAssignments = await storage.getConsultantSites(coverage.absentConsultantId);
        if (absentAssignments.some(a => a.siteId === siteId)) return true;
      }

      return false;
    }
    
    // Clients access depends on whether they have site assignments
    if (user.role === "client" && user.id) {
      if (!user.companyId) return false;
      const site = await storage.getSite(siteId);
      if (!site) return false;
      
      // Site must be in the client's effective company set (own company + GO members)
      const effectiveCompanyIds = await getEffectiveCompanyIds(user.companyId);
      if (!effectiveCompanyIds.has(site.companyId)) return false;

      // For member-company sites (GO access): effective-company membership is sufficient.
      // For own-company sites: require an explicit site assignment.
      if (site.companyId !== user.companyId) return true;
      const clientSites = await storage.getClientSites(user.id);
      return clientSites.some(a => a.siteId === siteId);
    }
    
    return false;
  };

  /**
   * Unified document access check that handles site-scoped, company-scoped, and group-scoped docs.
   * For site-scoped (siteId != null): delegates to canUserAccessSite.
   * For company/group-scoped (siteId == null): checks role and source/assignment against entityId.
   */
  const canUserAccessDocument = async (
    user: { id?: string; role: string; companyId: string | null; consultantTier?: string | null; sources?: string[] | null },
    doc: { id?: string; siteId: string | null; scope?: string | null; entityId?: string | null }
  ): Promise<boolean> => {
    // Site-scoped: use existing site-level check
    if (doc.siteId) {
      return canUserAccessSite(user, doc.siteId);
    }
    // Company/group scoped (siteId is null)
    if (user.role === "developer") return true;
    const entityId = doc.entityId;
    if (!entityId) return false;
    // Fetch shares once; needed for destination-aware access checks
    const shares = doc.id ? await storage.getDocumentShares(doc.id) : [];

    // Origin check helper: user is on the owning side of this document
    const isOriginConsultant = async () => {
      // Pro consultants / Admins: direct source overlap with entity company
      if (hasProPrivileges(user)) {
        const company = await storage.getCompany(entityId);
        return !!company && sourcesOverlap(user.sources ?? [], company.sources ?? []);
      }
      // Standard consultants: direct assignment to entity company sites + source overlap
      if (user.role === "consultant" && user.id) {
        const company = await storage.getCompany(entityId);
        if (!company) return false;
        const assignments = await storage.getConsultantSites(user.id);
        const entitySites = await storage.getSitesByCompanyId(entityId);
        const entitySiteIds = new Set(entitySites.map(s => s.id));
        const assignedToEntity = assignments.some(a => entitySiteIds.has(a.siteId));
        return assignedToEntity && sourcesOverlap(user.sources ?? [], company.sources ?? []);
      }
      return false;
    };

    // For company-scope: doc is owned by entityId, shared to specific sites
    if (doc.scope === "company") {
      // Origin client (owns the company that uploaded the doc)
      if (user.role === "client" && user.companyId === entityId) return true;
      // Group Owner client: user's company is the group owner of the doc's entity company
      if (user.role === "client" && user.companyId) {
        const entityCompanyForGO = await storage.getCompany(entityId);
        if (entityCompanyForGO?.groupOwnerId === user.companyId) return true;
      }
      // Origin consultant: has direct source overlap with the entity company
      const originConsultant = await isOriginConsultant();
      if (originConsultant) return true;
      // Destination access: must have an explicit share to a site the user can access
      // For clients: share must target a site they can actually access via canUserAccessSite
      if (user.role === "client" && user.companyId) {
        const siteShares = shares.filter(s => s.entityType === "site");
        for (const share of siteShares) {
          if (await canUserAccessSite(user, share.entityId)) return true;
        }
        return false;
      }
      // For standard consultants (non-pro): must be assigned to one of the share-destination sites + source overlap
      if (user.role === "consultant" && user.id && !isProConsultant(user)) {
        const company = await storage.getCompany(entityId);
        if (!company) return false;
        if (!sourcesOverlap(user.sources ?? [], company.sources ?? [])) return false;
        const assignments = await storage.getConsultantSites(user.id);
        const assignedSiteIds = new Set(assignments.map(a => a.siteId));
        const siteShares = shares.filter(s => s.entityType === "site");
        return siteShares.some(s => assignedSiteIds.has(s.entityId));
      }
      // Pro consultants / Admins: source overlap with entity company + must be in a share-destination site
      if (hasProPrivileges(user)) {
        const company = await storage.getCompany(entityId);
        if (!company) return false;
        if (!sourcesOverlap(user.sources ?? [], company.sources ?? [])) return false;
        // Pro consultants access all sites in their sources — allow if any share-destination site
        // belongs to a company with matching sources
        const allSites = await storage.getSites();
        const shareDestSiteIds = new Set(shares.filter(s => s.entityType === "site").map(s => s.entityId));
        const shareDestSites = allSites.filter(s => shareDestSiteIds.has(s.id));
        for (const site of shareDestSites) {
          if (await canUserAccessSite(user, site.id)) return true;
        }
        return false;
      }
    }

    // For group-scope: doc is owned by entityId (group owner), shared to specific member companies
    if (doc.scope === "group") {
      // Origin client (owns the group-owner company)
      if (user.role === "client" && user.companyId === entityId) return true;
      // Origin consultant: has direct source overlap with the group-owner company
      const originConsultant = await isOriginConsultant();
      if (originConsultant) return true;
      // Destination access: must have an explicit share to the user's company (client)
      // or to a company the consultant is assigned to (consultant)
      if (user.role === "client" && user.companyId) {
        // Must be in a shared destination company AND have site-level access within it
        const companyShare = shares.find(s => s.entityType === "company" && s.entityId === user.companyId);
        if (!companyShare) return false;
        const companySites = await storage.getSitesByCompanyId(user.companyId);
        for (const site of companySites) {
          if (await canUserAccessSite(user, site.id)) return true;
        }
        return false;
      }
      // For standard consultants (non-pro): must be assigned to a site in one of the share-destination companies + source overlap
      if (user.role === "consultant" && user.id && !isProConsultant(user)) {
        const goEffectiveSources = await getEffectiveGoSources(entityId);
        if (!sourcesOverlap(user.sources ?? [], goEffectiveSources)) return false;
        const assignments = await storage.getConsultantSites(user.id);
        const assignedSiteIds = new Set(assignments.map(a => a.siteId));
        const companyShares = shares.filter(s => s.entityType === "company");
        for (const share of companyShares) {
          const shareSites = await storage.getSitesByCompanyId(share.entityId);
          if (shareSites.some(s => assignedSiteIds.has(s.id))) return true;
        }
        return false;
      }
      // Pro consultants / Admins: source overlap with GO effective sources + assignment to share destination
      if (hasProPrivileges(user)) {
        const goEffectiveSources = await getEffectiveGoSources(entityId);
        if (!sourcesOverlap(user.sources ?? [], goEffectiveSources)) return false;
        const companyShares = shares.filter(s => s.entityType === "company");
        for (const share of companyShares) {
          const company = await storage.getCompany(share.entityId);
          if (company && sourcesOverlap(user.sources ?? [], company.sources ?? [])) return true;
        }
        return false;
      }
    }

    return false;
  };

  // Returns true if the user is an origin-side writer of the document.
  // Site-scoped: any authorized user. Company/group-scoped: admin; pro consultant (source overlap
  // with entity company); standard consultant (source overlap + assigned to entity company sites);
  // client (companyId === entityId). Destination-side users are read-only.
  const isDocumentOriginUser = async (
    user: { id?: string; role: string; companyId: string | null; consultantTier?: string | null; sources?: string[] | null },
    doc: { scope?: string | null; entityId?: string | null; siteId?: string | null }
  ): Promise<boolean> => {
    if (user.role === "developer") return true;
    if (doc.siteId) return true;
    if (!doc.entityId) return false;
    if (hasProPrivileges(user)) {
      const entityCompany = await storage.getCompany(doc.entityId);
      return !!entityCompany && sourcesOverlap(user.sources ?? [], entityCompany.sources ?? []);
    }
    if (user.role === "consultant" && user.id) {
      const entityCompany = await storage.getCompany(doc.entityId);
      if (!entityCompany) return false;
      if (!sourcesOverlap(user.sources ?? [], entityCompany.sources ?? [])) return false;
      const assignments = await storage.getConsultantSites(user.id);
      const entitySites = await storage.getSitesByCompanyId(doc.entityId);
      const entitySiteIds = new Set(entitySites.map(s => s.id));
      return assignments.some(a => entitySiteIds.has(a.siteId));
    }
    if (user.role === "client" && user.companyId) {
      if (user.companyId === doc.entityId) return true;
      // Group Primary Contact: primary contact of a group owner company can act as origin
      // user for any member company's documents
      if (user.id && doc.entityId) {
        const userCompany = await storage.getCompany(user.companyId);
        if (userCompany?.contactUserId === user.id) {
          const groupMembers = await storage.getGroupMembers(user.companyId);
          if (groupMembers.some(m => m.id === doc.entityId)) return true;
        }
      }
      return false;
    }
    return false;
  };

  // Emits "document-updated" to all users who should see changes for this document:
  // – the document's own company (entityId), – the site's company (siteId → getSite),
  // – the group owner of each company (so group-owner clients receive the update),
  // – all clients directly assigned to the site (cross-company assignments),
  // – all admin and consultant roles.
  const emitDocumentUpdated = async (
    doc: { entityId?: string | null; siteId?: string | null },
    payload: object
  ): Promise<void> => {
    const companiesEmitted = new Set<string>();
    if (doc.entityId) {
      emitToCompany(doc.entityId, "document-updated", payload);
      companiesEmitted.add(doc.entityId);
    }
    if (doc.siteId) {
      const site = await storage.getSite(doc.siteId).catch(() => null);
      if (site?.companyId && !companiesEmitted.has(site.companyId)) {
        emitToCompany(site.companyId, "document-updated", payload);
        companiesEmitted.add(site.companyId);
      }
      // Notify cross-company clients directly assigned to this site
      try {
        const assigned = await pool.query<{ client_id: string }>(
          `SELECT client_id FROM client_site_assignments WHERE site_id = $1`,
          [doc.siteId]
        );
        for (const row of assigned.rows) {
          emitToUser(row.client_id, "document-updated", payload);
        }
      } catch { /* non-fatal */ }
    }
    // Also notify group owner companies so their client users receive updates
    for (const companyId of Array.from(companiesEmitted)) {
      const company = await storage.getCompany(companyId).catch(() => null);
      if (company?.groupOwnerId && !companiesEmitted.has(company.groupOwnerId)) {
        emitToCompany(company.groupOwnerId, "document-updated", payload);
        companiesEmitted.add(company.groupOwnerId);
      }
    }
    emitToRole("developer", "document-updated", payload);
    emitToRole("consultant", "document-updated", payload);
  };

  // ── SSE STANDARD (read before adding a new mutating route) ──────────────────
  // Every route that CREATES, UPDATES, ARCHIVES, or DELETES a persistent entity
  // MUST emit its SSE event before returning, using one of the helpers below so
  // targeting stays consistent across the app:
  //   • emitCompanyScoped  — company-level changes (company profile, services…)
  //   • emitSiteScoped     — anything tied to a site (cases, incidents, site
  //                          docs, assignments). Also reaches cross-company
  //                          clients assigned to the site and group-owner clients.
  //   • emitUserUpdated    — user create/edit/delete and assignment changes.
  // This keeps the UI "free flowing": lists, detail pages, dashboards, calendars
  // and summaries all refresh in real time for every user who can see the data.

  // Emit to all admins + consultants, the owning company, and its group owner.
  const emitCompanyScoped = async (
    event: string,
    companyId: string | null | undefined,
    payload: object = {},
  ): Promise<void> => {
    emitToRole("developer", event, payload);
    emitToRole("consultant", event, payload);
    if (companyId) {
      emitToCompany(companyId, event, payload);
      const company = await storage.getCompany(companyId).catch(() => null);
      if (company?.groupOwnerId) emitToCompany(company.groupOwnerId, event, payload);
    }
  };

  // Emit to all admins + consultants, the site's company, that company's group
  // owner, and every cross-company client directly assigned to the site.
  const emitSiteScoped = async (
    event: string,
    siteId: string | null | undefined,
    companyId: string | null | undefined,
    payload: object = {},
  ): Promise<void> => {
    emitToRole("developer", event, payload);
    emitToRole("consultant", event, payload);
    const emitted = new Set<string>();
    let resolvedCompanyId = companyId ?? null;
    if (!resolvedCompanyId && siteId) {
      const site = await storage.getSite(siteId).catch(() => null);
      resolvedCompanyId = site?.companyId ?? null;
    }
    if (resolvedCompanyId) {
      emitToCompany(resolvedCompanyId, event, payload);
      emitted.add(resolvedCompanyId);
      const company = await storage.getCompany(resolvedCompanyId).catch(() => null);
      if (company?.groupOwnerId && !emitted.has(company.groupOwnerId)) {
        emitToCompany(company.groupOwnerId, event, payload);
        emitted.add(company.groupOwnerId);
      }
    }
    if (siteId) {
      try {
        const assigned = await pool.query<{ client_id: string }>(
          `SELECT client_id FROM client_site_assignments WHERE site_id = $1`,
          [siteId],
        );
        for (const row of assigned.rows) emitToUser(row.client_id, event, payload);
      } catch { /* non-fatal */ }
    }
  };

  // Emit a user-updated event to admins, consultants, and the user themselves.
  const emitUserUpdated = (userId: string, extra: object = {}): void => {
    const payload = { userId, ...extra };
    emitToRole("developer", "user-updated", payload);
    emitToRole("consultant", "user-updated", payload);
    emitToUser(userId, "user-updated", payload);
  };

  const canUserAccessFolder = async (
    user: { id?: string; role: string; companyId: string | null; consultantTier?: string | null; sources?: string[] | null },
    folder: { id: string; siteId: string; allocatedClientId: string | null }
  ): Promise<boolean> => {
    if (user.role === "developer") return true;
    // Consultants and administrators are gated by site-level source access
    if (user.role === "consultant" || user.role === "administrator") {
      return canUserAccessSite(user, folder.siteId);
    }
    if (user.role === "client" && user.id) {
      if (!user.companyId) return false;
      const site = await storage.getSite(folder.siteId);
      if (!site) return false;
      // Use effective company set (own company + any GO member companies)
      const effectiveIds = await getEffectiveCompanyIds(user.companyId);
      if (!effectiveIds.has(site.companyId)) return false;
      if (folder.allocatedClientId === user.id) return true;
      const grants = await storage.getClientUploadFolderAccess(folder.id);
      return grants.some((g) => g.userId === user.id);
    }
    return false;
  };

  // Apply auth middleware to all routes below this point
  app.use("/api/dashboard", requireAuth);
  app.use("/api/documents", requireAuth);
  app.use("/api/sites", requireAuth);
  app.use("/api/sites", requireAuth);
  app.use("/api/support", requireAuth);
  app.use("/api/audit", requireAuth);
  app.use("/api/modules", requireAuth);

  // ==================== SERVER-SENT EVENTS (SSE) ====================

  // GET /api/events — persistent SSE stream for real-time updates
  app.get("/api/events", requireAuth, async (req: any, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).end();

    let user: Awaited<ReturnType<typeof storage.getUser>>;
    try {
      user = await storage.getUser(userId);
    } catch {
      return res.status(500).end();
    }
    if (!user) return res.status(401).end();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const client = { userId, role: user.role, companyId: user.companyId ?? null, res };
    addClient(client);

    // Record when the user connected and notify presence watchers
    storage.updateUser(userId, { lastSeenAt: new Date() }).catch(() => {});
    emitToRole("developer", "presence-changed", { userId, online: true });
    emitToRole("consultant", "presence-changed", { userId, online: true });

    // Confirm connection
    res.write(`event: connected\ndata: {"userId":"${userId}"}\n\n`);

    // Heartbeat every 15 seconds to keep the connection alive through proxies
    const heartbeat = setInterval(() => {
      try { res.write(":ping\n\n"); } catch { clearInterval(heartbeat); }
    }, 15_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      removeClient(client);
      // Record when the user disconnected and notify presence watchers
      storage.updateUser(userId, { lastSeenAt: new Date() }).catch(() => {});
      emitToRole("developer", "presence-changed", { userId, online: false });
      emitToRole("consultant", "presence-changed", { userId, online: false });
    });
  });

  // GET /api/users/online — returns IDs of users with an active SSE connection
  app.get("/api/users/online", requireAuth, async (req: any, res) => {
    const caller = await storage.getUser(req.session?.userId);
    if (!caller || (caller.role !== "developer" && caller.role !== "consultant" && caller.role !== "administrator")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({ userIds: getOnlineUserIds() });
  });

  // ==================== AUTHENTICATED INVITATION ENDPOINTS ====================

  // Resend invitation (admin only)
  // Admin-initiated password reset — sends the same reset email as "forgot password"
  app.post("/api/users/:userId/reset-password", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser || (currentUser.role !== "developer" && currentUser.role !== "consultant" && currentUser.role !== "administrator")) {
        return res.status(403).json({ error: "Only staff can reset user passwords" });
      }

      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      if (targetUser.status !== "active" && targetUser.status !== "locked") {
        return res.status(400).json({ error: "Password reset is only available for active or locked accounts" });
      }

      await storage.invalidateUserInvitations(targetUser.id, "password_reset");

      const token = generateSecureToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      await storage.createUserInvitation({
        userId: targetUser.id,
        email: targetUser.email,
        tokenHash,
        purpose: "password_reset",
        expiresAt,
        createdBy: currentUser.id,
      });

      const baseUrl = req.headers.origin || `${req.protocol}://${req.get("host")}`;
      const resetUrl = `${baseUrl}/set-password?token=${token}`;

      let emailSent = false;
      try {
        await sendPasswordResetEmail({
          to: targetUser.email,
          fullName: targetUser.fullName,
          resetUrl,
          expiresAt,
          role: targetUser.role,
        });
        emailSent = true;
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }

      await storage.createAuditLog({
        action: "password_reset_requested",
        userId: currentUser.id,
        userName: currentUser.fullName,
        entityId: targetUser.id,
        details: emailSent
          ? `Password reset email sent to ${targetUser.fullName} (${targetUser.email}) by ${currentUser.fullName}`
          : `Password reset link generated for ${targetUser.fullName} — email delivery failed`,
        metadata: JSON.stringify({ targetUserId: targetUser.id }),
      });

      res.json({ success: true, emailSent });
    } catch (error) {
      console.error("Admin reset password error:", error);
      res.status(500).json({ error: "Failed to send password reset" });
    }
  });

  app.post("/api/users/:userId/resend-invite", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser || (currentUser.role !== "developer" && currentUser.role !== "consultant" && currentUser.role !== "administrator")) {
        return res.status(403).json({ error: "Only developers and consultants can send invitations" });
      }
      
      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (targetUser.status !== "invited" && targetUser.status !== "invite_required") {
        return res.status(400).json({ error: "User has already activated their account or is not ready for an invitation" });
      }
      
      // For client users with site_required status, block invitation
      if (targetUser.role === "client" && targetUser.status === "site_required") {
        return res.status(400).json({ 
          error: "Client must be assigned to a site or set as a primary contact for a company before an invitation can be sent." 
        });
      }
      
      // Invalidate any existing invitations for this user
      await storage.invalidateUserInvitations(targetUser.id, "invite");
      
      // Generate new invitation token
      const token = generateSecureToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
      
      await storage.createUserInvitation({
        userId: targetUser.id,
        email: targetUser.email,
        tokenHash,
        purpose: "invite",
        expiresAt,
        createdBy: currentUser.id,
      });
      
      // Build the invite URL
      const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const inviteUrl = `${baseUrl}/set-password?token=${token}`;
      
      // Try to send the email
      let emailSent = false;
      try {
        await sendInvitationEmail({
          to: targetUser.email,
          fullName: targetUser.fullName,
          inviteUrl,
          expiresAt,
          role: targetUser.role,
        });
        emailSent = true;
      } catch (emailError) {
        console.error("Failed to send invitation email (link still generated):", emailError);
      }
      
      // Transition status to 'invited' when invite is sent/generated
      if (targetUser.status === "invite_required") {
        await storage.updateUser(targetUser.id, { status: "invited" });
      }

      await storage.createAuditLog({
        action: "email_sent",
        userId: currentUser.id,
        userName: currentUser.fullName,
        entityId: targetUser.id,
        details: emailSent
          ? `Invitation email sent to ${targetUser.fullName} (${targetUser.email})`
          : `Invitation link generated for ${targetUser.fullName} (${targetUser.email}) — email delivery failed`,
        metadata: JSON.stringify({ targetUserId: targetUser.id, emailType: "invitation" }),
      });

      emitUserUpdated(targetUser.id);

      res.json({ 
        success: true, 
        inviteUrl,
        inviteExpiresAt: expiresAt.toISOString(),
        emailSent,
        message: emailSent 
          ? "Invitation email sent successfully" 
          : "Invitation link regenerated (email sending failed - you can copy the link manually)"
      });
    } catch (error) {
      console.error("Resend invitation error:", error);
      res.status(500).json({ error: "Failed to resend invitation" });
    }
  });

  // Get user's current invitation status (admin only)
  app.get("/api/users/:userId/invitation", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser || currentUser.role !== "developer") {
        return res.status(403).json({ error: "Only developers can view invitation status" });
      }
      
      const invitations = await storage.getUserInvitationsByUser(req.params.userId);
      const activeInvitation = invitations.find(inv => !inv.usedAt && !inv.invalidatedAt && new Date(inv.expiresAt) > new Date());
      
      if (!activeInvitation) {
        return res.json({ hasActiveInvitation: false });
      }
      
      res.json({
        hasActiveInvitation: true,
        expiresAt: activeInvitation.expiresAt,
        purpose: activeInvitation.purpose,
      });
    } catch (error) {
      console.error("Get invitation status error:", error);
      res.status(500).json({ error: "Failed to get invitation status" });
    }
  });

  // ==================== END AUTHENTICATED INVITATION ENDPOINTS ====================

  // Get user activity log (admin/consultant only)
  app.get("/api/users/:id/activity", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser || (currentUser.role !== "developer" && currentUser.role !== "consultant" && currentUser.role !== "administrator")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      const logs = await storage.getUserActivityLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Get user activity error:", error);
      res.status(500).json({ error: "Failed to fetch user activity" });
    }
  });

  // Shared helper: slot-based compliance calculation
  const complianceModules: ModuleType[] = ["health_safety", "human_resources", "employment_law"];

  async function computeSlotBasedCompliance(
    user: any,
    documents: any[],
    module: ModuleType | undefined,
    siteFilter?: { siteId?: string; siteIds?: string }
  ) {
    // Fetch all bulk data in a single parallel round-trip to avoid N+1 DB queries.
    const [sites, templates, companies, allSharesRaw, allSiteOverridesRaw, allCompanyReqsRaw] = await Promise.all([
      storage.getSites(),
      storage.getDocumentTemplates(),
      storage.getCompanies(),
      storage.getAllDocumentSharesRaw(),
      storage.getAllSiteTemplateOverridesRaw(),
      storage.getAllCompanyRequiredTemplatesRaw(),
    ]);
    const templateMap = new Map(templates.map(t => [t.id, t]));
    const companyMap = new Map(companies.map(c => [c.id, c]));

    // Build group-owner → members map so inherited module access is respected —
    // mirrors the same logic in storage.ts computePerModuleScores / getSitesWithDetails.
    const membersByGoId = new Map<string, typeof companies>();
    for (const company of companies) {
      if (company.groupOwnerId) {
        if (!membersByGoId.has(company.groupOwnerId)) membersByGoId.set(company.groupOwnerId, []);
        membersByGoId.get(company.groupOwnerId)!.push(company);
      }
    }

    // Build lookup maps from the bulk data (all in-memory, zero additional DB calls).
    const sharesByDocId = new Map<string, typeof allSharesRaw>();
    for (const share of allSharesRaw) {
      if (!sharesByDocId.has(share.documentId)) sharesByDocId.set(share.documentId, []);
      sharesByDocId.get(share.documentId)!.push(share);
    }
    const excludedTemplatesBySiteId = new Map<string, Set<string>>();
    for (const override of allSiteOverridesRaw) {
      if (override.action !== "exclude") continue;
      if (!excludedTemplatesBySiteId.has(override.siteId)) excludedTemplatesBySiteId.set(override.siteId, new Set());
      excludedTemplatesBySiteId.get(override.siteId)!.add(override.templateId);
    }
    const companyReqsByCompanyId = new Map<string, Set<string>>();
    for (const req of allCompanyReqsRaw) {
      if (req.removedAt) continue;
      if (!companyReqsByCompanyId.has(req.companyId)) companyReqsByCompanyId.set(req.companyId, new Set());
      companyReqsByCompanyId.get(req.companyId)!.add(req.templateId);
    }

    // All scoped (non-site) docs for in-memory shared-doc computation.
    const allScopedDocs = documents.filter(d => !d.siteId && (d.scope === "company" || d.scope === "group"));

    // Determine which scoped-doc folders have a folder-template link.
    // Matched shared docs (folderTemplateId != null) are expanded per-site in the
    // Document Progress counts — mirroring the folder-view's sharedExpansionDeltas logic.
    // Unmatched shared docs are counted once globally (same as hierarchy.summary.totalDocuments).
    const _scopedFolderIds = Array.from(new Set(allScopedDocs.map(d => (d as any).folderId).filter((v): v is string => !!v)));
    const folderHasTemplate = new Set<string>(); // folderIds whose folder has a folderTemplateId
    if (_scopedFolderIds.length > 0) {
      const _folderRows = await Promise.all(_scopedFolderIds.map(fid => storage.getDocumentFolder(fid)));
      for (const f of _folderRows) {
        if (f && (f as any).templateId) folderHasTemplate.add(f.id);
      }
    }

    // In-memory equivalent of getSharedDocumentsForSite — no extra DB calls.
    function computeSharedDocsForSite(site: typeof sites[0]) {
      const company = companyMap.get(site.companyId);
      if (!company) return [];
      const seenIds = new Set<string>();
      const results: any[] = [];
      for (const doc of allScopedDocs) {
        if (seenIds.has(doc.id)) continue;
        if (doc.isArchived) continue;
        if (module && doc.module !== module) continue;
        const shares = sharesByDocId.get(doc.id) ?? [];
        if (doc.scope === "company" && doc.entityId === site.companyId) {
          // Company-scope docs owned by this company always appear at this company's
          // own sites — no explicit share record required.
          seenIds.add(doc.id);
          results.push({ ...doc, sharedScope: "company", sharedFromEntityName: company.name });
        } else if (doc.scope === "group" && doc.entityId === site.companyId) {
          // Own group doc: appears at own sites only if at least one share record exists
          // (i.e. the user chose "share this" when uploading — 0 shares = not shared)
          if (shares.length > 0) {
            seenIds.add(doc.id);
            results.push({ ...doc, sharedScope: "group", sharedFromEntityName: company.name });
          }
        } else if (doc.scope === "group" && company.groupOwnerId && doc.entityId === company.groupOwnerId) {
          if (shares.some(s => s.entityType === "company" && s.entityId === site.companyId)) {
            const goCompany = companyMap.get(company.groupOwnerId);
            seenIds.add(doc.id);
            results.push({ ...doc, sharedScope: "group", sharedFromEntityName: goCompany?.name ?? null });
          }
        }
      }
      return results;
    }

    // Batch access checks in parallel (admins short-circuit immediately).
    const preFilteredSites = sites.filter(site => {
      if (!site.companyId) return false;
      if (siteFilter?.siteId && siteFilter.siteId !== "all" && site.id !== siteFilter.siteId) return false;
      if (siteFilter?.siteIds) {
        const ids = siteFilter.siteIds.split(",");
        if (!ids.includes(site.id)) return false;
      }
      // Filter by module access — use inherited access for Group Owner companies,
      // matching storage.ts getSitesWithDetails (hrEnabled = own flag OR any member flag).
      if (module) {
        const company = companyMap.get(site.companyId);
        if (!company) return false;
        const goMembers = membersByGoId.get(site.companyId) ?? [];
        const hrEffective = !!company.humanResourcesAccess || goMembers.some(m => m.humanResourcesAccess);
        const hsEffective = !!company.healthSafetyAccess  || goMembers.some(m => m.healthSafetyAccess);
        const elEffective = !!company.employmentLawAccess || goMembers.some(m => m.employmentLawAccess);
        if (module === "human_resources" && !hrEffective) return false;
        if (module === "health_safety"   && !hsEffective) return false;
        if (module === "employment_law"  && !elEffective) return false;
      }
      return true;
    });
    const accessResults = await Promise.all(preFilteredSites.map(s => canUserAccessSite(user, s.id)));
    const accessibleSites = preFilteredSites.filter((_, i) => accessResults[i]);

    let slotTotal = 0;
    let slotCompliantDocs = 0;  // individual compliant docs in required slots (used for display)
    let slotApprovalRequired = 0;
    let slotOverdue = 0;
    let missingRequired = 0;
    const consumedDocIds = new Set<string>();
    const filteredSiteIds = new Set<string>(accessibleSites.map(s => s.id));
    // Company/group-scoped required docs shared to filtered sites — one entry per applicable site
    const sharedRequiredCandidates: any[] = [];

    // "Document Progress" expanded counts: shared docs counted once per site they cover,
    // matching the folder-view stats bar (hierarchy total + sharedExpansionDeltas).
    // Unmatched shared docs (no folder template link) are counted once globally —
    // same as hierarchy.summary.totalDocuments; matched ones are expanded per-site.
    let expandedDocTotal = 0;
    let expandedCompliant = 0;
    let expandedApprovalReq = 0;
    let expandedOverdue = 0;
    const _expNow = new Date();
    const _seenUnmatchedSharedIds = new Set<string>(); // dedup for unmatched shared docs

    for (const site of accessibleSites) {
      filteredSiteIds.add(site.id);
      const requiredIds = companyReqsByCompanyId.get(site.companyId) ?? new Set<string>();
      const siteExcluded = excludedTemplatesBySiteId.get(site.id) ?? new Set<string>();
      const siteDocs = documents.filter(d => d.siteId === site.id && !d.isArchived && !d.caseId && !d.incidentId && d.source !== "external");
      // Include company/group-scoped documents shared to this site in compliance scoring
      const validShared = computeSharedDocsForSite(site).filter((sd: any) => !sd.isArchived && !sd.caseId && !sd.incidentId && sd.source !== "external");
      const allSiteDocs = [...siteDocs, ...validShared];

      for (const rtTemplateId of requiredIds) {
        if (siteExcluded.has(rtTemplateId)) continue;
        const tmpl = templateMap.get(rtTemplateId);
        if (!tmpl || tmpl.visibility !== "private" || !tmpl.isActive) continue;
        if (module && tmpl.module !== module) continue;
        if (!module && !complianceModules.includes(tmpl.module as ModuleType)) continue;

        slotTotal++;
        const matchingDocs = allSiteDocs.filter(d => d.templateId === rtTemplateId);
        matchingDocs.forEach(d => consumedDocIds.add(d.id));

        if (matchingDocs.length === 0) {
          missingRequired++;
          continue;
        }

        // Count individual docs in this slot — overdue from dates only, approval from workflow state.
        const _slotNow = new Date();
        matchingDocs.forEach(d => {
          const dateOverdue = !!(d.expiryDate && new Date(d.expiryDate) < _slotNow) ||
            !!(d.renewalDate && new Date(d.renewalDate) < _slotNow);
          const approvalPending = d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off";
          if (dateOverdue) slotOverdue++;
          else if (approvalPending) slotApprovalRequired++;
          else if (d.status === "compliant") slotCompliantDocs++;
        });
      }

      // Collect shared required docs that weren't consumed by a template slot
      // (e.g. their template is excluded by a site override). Push once per
      // applicable site so they expand per-site — matching the tile's coveredSites logic.
      for (const sd of validShared) {
        if (sd.isMandatory && !consumedDocIds.has(sd.id)) {
          if (module && sd.module !== module) continue;
          if (!module && !complianceModules.includes(sd.module as ModuleType)) continue;
          sharedRequiredCandidates.push(sd);
        }
      }

      // Expanded document progress counts.
      // Site-scoped docs: count once each (they only belong to this one site).
      // Shared docs: matched (folder has a folderTemplateId) → count per-site, same as
      //   the folder-view's sharedExpansionDeltas; unmatched → count once globally
      //   (same as hierarchy.summary.totalDocuments, which also counts them once).
      const progressSiteDocs = siteDocs.filter(d => module ? d.module === module : complianceModules.includes(d.module as ModuleType));
      const progressSharedDocs = validShared.filter(d => module ? (d as any).module === module : complianceModules.includes((d as any).module as ModuleType));

      const _countDoc = (d: any) => {
        expandedDocTotal++;
        const dateOverdue = !!(d.expiryDate && new Date(d.expiryDate) < _expNow) ||
          !!(d.renewalDate && new Date(d.renewalDate) < _expNow);
        const approvalPending = d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off";
        if (dateOverdue) expandedOverdue++;
        else if (approvalPending) expandedApprovalReq++;
        else if (d.status === "compliant") expandedCompliant++;
      };

      for (const d of progressSiteDocs) _countDoc(d);

      for (const d of progressSharedDocs) {
        const folderId = (d as any).folderId;
        const isMatched = !!folderId && folderHasTemplate.has(folderId);
        if (isMatched) {
          // Matched: expand per-site (mirrors sharedExpansionDeltas in the folder view)
          _countDoc(d);
        } else {
          // Unmatched: count once globally across all sites
          if (!_seenUnmatchedSharedIds.has(d.id)) {
            _seenUnmatchedSharedIds.add(d.id);
            _countDoc(d);
          }
        }
      }
    }

    // Manually-required docs not already consumed by a template slot.
    // Includes site-scoped docs (filtered by filteredSiteIds) plus any
    // company/group-scoped shared docs collected above (one entry per applicable site).
    const manualRequired = [
      ...documents.filter(d => {
        if (!d.isMandatory) return false;
        if (consumedDocIds.has(d.id)) return false;
        if (d.isArchived || d.caseId || d.incidentId) return false;
        if (d.source === "external") return false;
        if (!filteredSiteIds.has(d.siteId)) return false;
        if (module && d.module !== module) return false;
        if (!module && !complianceModules.includes(d.module as ModuleType)) return false;
        return true;
      }),
      ...sharedRequiredCandidates.filter(d => !consumedDocIds.has(d.id)),
    ];

    const totalDocuments = slotTotal + manualRequired.length;
    // Per-document counts — overdue is strictly date-based; approval required from workflow state
    const _manualNow = new Date();
    const isManualOverdue = (d: any): boolean =>
      !!(d.expiryDate && new Date(d.expiryDate) < _manualNow) ||
      !!(d.renewalDate && new Date(d.renewalDate) < _manualNow);
    const isManualApprovalRequired = (d: any): boolean =>
      d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off";
    const manualCompliant = manualRequired.filter(d => d.status === "compliant" && !isManualOverdue(d) && !isManualApprovalRequired(d)).length;
    const compliantDocuments = slotCompliantDocs + manualCompliant;
    const approvalRequired = slotApprovalRequired + manualRequired.filter(d => !isManualOverdue(d) && isManualApprovalRequired(d)).length;
    const overdueDocuments = slotOverdue + manualRequired.filter(isManualOverdue).length;
    const missingRequiredDocuments = missingRequired;
    // Compliance score: compliant / (compliant + not compliant + missing)
    // This ties the percentage directly to the four tiles shown on the dashboard card.
    const complianceScoreDenominator = compliantDocuments + approvalRequired + overdueDocuments + missingRequiredDocuments;
    const complianceScore = complianceScoreDenominator > 0 ? Math.round((compliantDocuments / complianceScoreDenominator) * 100) : 0;

    return { totalDocuments, compliantDocuments, approvalRequired, overdueDocuments, missingRequiredDocuments, complianceScore, consumedDocIds, expandedDocTotal, expandedCompliant, expandedApprovalReq, expandedOverdue };
  }

  /**
   * Computes per-company module scores (health_safety / human_resources / employment_law)
   * using exactly the same algorithm as computeSlotBasedCompliance — one consumedDocIds set
   * and one sharedRequiredCandidates map shared across all sites of the same company.
   * This avoids double-counting company-scoped required docs across sites.
   */
  async function computePerCompanyModuleScores(
    user: any,
  ): Promise<Map<string, { health_safety: number; human_resources: number; employment_law: number }>> {
    const [allDocuments, sites, templates, companies, allSharesRaw, allSiteOverridesRaw, allCompanyReqsRaw] = await Promise.all([
      storage.getDocuments(),
      storage.getSites(),
      storage.getDocumentTemplates(),
      storage.getCompanies(),
      storage.getAllDocumentSharesRaw(),
      storage.getAllSiteTemplateOverridesRaw(),
      storage.getAllCompanyRequiredTemplatesRaw(),
    ]);

    const templateMap = new Map(templates.map(t => [t.id, t]));
    const companyMap = new Map(companies.map(c => [c.id, c]));

    const sharesByDocId = new Map<string, typeof allSharesRaw>();
    for (const share of allSharesRaw) {
      if (!sharesByDocId.has(share.documentId)) sharesByDocId.set(share.documentId, []);
      sharesByDocId.get(share.documentId)!.push(share);
    }

    const excludedTemplatesBySiteId = new Map<string, Set<string>>();
    for (const ov of allSiteOverridesRaw) {
      if (ov.action !== "exclude") continue;
      if (!excludedTemplatesBySiteId.has(ov.siteId)) excludedTemplatesBySiteId.set(ov.siteId, new Set());
      excludedTemplatesBySiteId.get(ov.siteId)!.add(ov.templateId);
    }

    const companyReqsByCompanyId = new Map<string, Set<string>>();
    for (const req of allCompanyReqsRaw) {
      if (req.removedAt) continue;
      if (!companyReqsByCompanyId.has(req.companyId)) companyReqsByCompanyId.set(req.companyId, new Set());
      companyReqsByCompanyId.get(req.companyId)!.add(req.templateId);
    }

    // All scoped (non-site) docs — used for per-module shared-doc computation
    const allScopedDocs = allDocuments.filter(d => !d.siteId && (d.scope === "company" || d.scope === "group"));

    function computeSharedDocsForSite(site: typeof sites[0], module: string) {
      const company = companyMap.get(site.companyId);
      if (!company) return [];
      const seenIds = new Set<string>();
      const results: any[] = [];
      for (const doc of allScopedDocs) {
        if (seenIds.has(doc.id)) continue;
        if (doc.isArchived) continue;
        if (doc.module !== module) continue;
        const shares = sharesByDocId.get(doc.id) ?? [];
        if (doc.scope === "company" && doc.entityId === site.companyId) {
          const hasShare = shares.some(s =>
            (s.entityType === "site" && s.entityId === site.id) ||
            (s.entityType === "company" && s.entityId === site.companyId)
          );
          if (hasShare) { seenIds.add(doc.id); results.push(doc); }
        } else if (doc.scope === "group" && doc.entityId === site.companyId) {
          if (shares.length > 0) { seenIds.add(doc.id); results.push(doc); }
        } else if (doc.scope === "group" && company.groupOwnerId && doc.entityId === company.groupOwnerId) {
          if (shares.some(s => s.entityType === "company" && s.entityId === site.companyId)) {
            seenIds.add(doc.id); results.push(doc);
          }
        }
      }
      return results;
    }

    // Only accessible sites (admins get all)
    const accessResults = await Promise.all(sites.map(s => canUserAccessSite(user, s.id)));
    const accessibleSites = sites.filter((_, i) => accessResults[i] && sites[i].companyId);
    const filteredSiteIds = new Set(accessibleSites.map(s => s.id));
    const siteToCompany = new Map(accessibleSites.map(s => [s.id, s.companyId]));

    const _now = new Date();
    function isDateOverdue(d: any) {
      return !!(d.expiryDate && new Date(d.expiryDate) < _now) || !!(d.renewalDate && new Date(d.renewalDate) < _now);
    }
    function isApprovalPending(d: any) {
      return d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off";
    }

    // Final result map
    const result = new Map<string, { health_safety: number; human_resources: number; employment_law: number }>();

    for (const module of complianceModules) {
      // Per-company accumulators — shared across all sites of the same company.
      // This exactly mirrors computeSlotBasedCompliance called per-company.
      const cSlotCompliant  = new Map<string, number>();
      const cSlotApproval   = new Map<string, number>();
      const cSlotOverdue    = new Map<string, number>();
      const cMissing        = new Map<string, number>();
      const cConsumed       = new Map<string, Set<string>>();
      const cSharedReq      = new Map<string, Map<string, any>>();

      function ensureCompany(cid: string) {
        if (!cConsumed.has(cid)) {
          cConsumed.set(cid, new Set());
          cSharedReq.set(cid, new Map());
          cSlotCompliant.set(cid, 0);
          cSlotApproval.set(cid, 0);
          cSlotOverdue.set(cid, 0);
          cMissing.set(cid, 0);
        }
      }

      for (const site of accessibleSites) {
        const cid = site.companyId;
        ensureCompany(cid);
        const consumedDocIds = cConsumed.get(cid)!;
        const sharedReq      = cSharedReq.get(cid)!;

        const requiredIds  = companyReqsByCompanyId.get(cid) ?? new Set<string>();
        const siteExcluded = excludedTemplatesBySiteId.get(site.id) ?? new Set<string>();

        const siteDocs   = allDocuments.filter(d => d.siteId === site.id && !d.isArchived && !d.caseId && !d.incidentId && d.source !== "external");
        const validShared = computeSharedDocsForSite(site, module).filter((sd: any) => !sd.isArchived && !sd.caseId && !sd.incidentId && sd.source !== "external");
        const allSiteDocs = [...siteDocs, ...validShared];

        for (const rtTemplateId of requiredIds) {
          if (siteExcluded.has(rtTemplateId)) continue;
          const tmpl = templateMap.get(rtTemplateId);
          if (!tmpl || !tmpl.isActive || tmpl.visibility !== "private" || tmpl.module !== module) continue;

          const matchingDocs = allSiteDocs.filter(d => d.templateId === rtTemplateId);
          matchingDocs.forEach(d => consumedDocIds.add(d.id));

          if (matchingDocs.length === 0) {
            cMissing.set(cid, (cMissing.get(cid) ?? 0) + 1);
            continue;
          }
          matchingDocs.forEach(d => {
            if (isDateOverdue(d))    cSlotOverdue.set(cid, (cSlotOverdue.get(cid) ?? 0) + 1);
            else if (isApprovalPending(d)) cSlotApproval.set(cid, (cSlotApproval.get(cid) ?? 0) + 1);
            else if (d.status === "compliant") cSlotCompliant.set(cid, (cSlotCompliant.get(cid) ?? 0) + 1);
          });
        }

        // Collect company/group-scoped required docs not consumed by a slot (deduplicated per company)
        for (const sd of validShared) {
          if (sd.isMandatory && !consumedDocIds.has(sd.id)) sharedReq.set(sd.id, sd);
        }
      }

      // Site-scoped manual-required docs (not consumed by any slot), grouped by company
      const siteManualByCompany = new Map<string, any[]>();
      for (const d of allDocuments) {
        if (!d.isMandatory || d.isArchived || d.caseId || d.incidentId || d.source === "external") continue;
        if (!filteredSiteIds.has(d.siteId)) continue;
        if (d.module !== module) continue;
        const cid = siteToCompany.get(d.siteId);
        if (!cid) continue;
        if (cConsumed.get(cid)?.has(d.id)) continue;
        if (!siteManualByCompany.has(cid)) siteManualByCompany.set(cid, []);
        siteManualByCompany.get(cid)!.push(d);
      }

      // Compute score for each company that had at least one site
      for (const cid of cConsumed.keys()) {
        const sharedManual   = [...(cSharedReq.get(cid)?.values() ?? [])].filter((d: any) => !cConsumed.get(cid)?.has(d.id));
        const siteManual     = siteManualByCompany.get(cid) ?? [];
        const manualRequired = [...sharedManual, ...siteManual];

        const manualCompliant = manualRequired.filter(d => d.status === "compliant" && !isDateOverdue(d) && !isApprovalPending(d)).length;
        const manualApproval  = manualRequired.filter(d => !isDateOverdue(d) && isApprovalPending(d)).length;
        const manualOverdue   = manualRequired.filter(isDateOverdue).length;

        const compliant = (cSlotCompliant.get(cid) ?? 0) + manualCompliant;
        const approval  = (cSlotApproval.get(cid) ?? 0)  + manualApproval;
        const overdue   = (cSlotOverdue.get(cid) ?? 0)   + manualOverdue;
        const missing   = cMissing.get(cid) ?? 0;
        const denom     = compliant + approval + overdue + missing;

        const existing = result.get(cid) ?? { health_safety: 0, human_resources: 0, employment_law: 0 };
        existing[module as "health_safety" | "human_resources" | "employment_law"] =
          denom > 0 ? Math.round((compliant / denom) * 100) : 0;
        result.set(cid, existing);
      }
    }

    return result;
  }

  interface MissingRequiredTemplateDetail {
    templateId: string;
    templateName: string;
    module: string;
    requiresApproval: boolean;
    siteId: string;
    siteName: string;
    companyId: string;
    companyName: string;
    groupOwnerId?: string | null;
    folderTemplateId?: string | null;
    documentId?: string;
    documentStatus?: string;
    kind: "template_slot" | "required_document";
  }

  async function getMissingRequiredTemplatesForCompany(
    user: any,
    companyId: string,
    module: ModuleType | undefined,
  ): Promise<MissingRequiredTemplateDetail[]> {
    const company = await storage.getCompany(companyId);
    if (!company) return [];

    const templates = await storage.getDocumentTemplates(module);
    const templateMap = new Map(templates.map(t => [t.id, t]));

    // Effective required template IDs for this company (inherited + own), no site-exclusion filtering.
    const requiredIds = await storage.getEffectiveCompanyRequiredTemplateIds(companyId);

    // Only company-scoped and group-scoped docs count as fulfilling requirements
    // at company level. Site-scoped docs fulfil site-level slots, not company-level
    // ones — the company Documents page only shows company/group-scoped docs, so
    // a site doc covering "Contract" should not hide the company-level missing slot.
    const allDocs = await storage.getDocuments(module);
    const companyScopedDocs = allDocs.filter(d => !d.siteId && (d.scope === "company" || d.scope === "group") && !d.isArchived && !d.caseId);

    // Collect fulfilled templateIds from company/group-scoped docs only.
    // Fetch all share records for group-scoped docs in parallel rather than sequentially.
    const groupScopedDocs = companyScopedDocs.filter(d => d.scope === "group" && d.templateId);
    const groupSharesResults = await Promise.all(groupScopedDocs.map(d => storage.getDocumentShares(d.id)));
    const groupSharesMap = new Map(groupScopedDocs.map((d, i) => [d.id, groupSharesResults[i]]));

    const fulfilledTemplateIds = new Set<string>();
    for (const d of companyScopedDocs) {
      // Company-owned docs count directly.
      if (d.scope === "company" && d.entityId === companyId && d.templateId) {
        fulfilledTemplateIds.add(d.templateId);
        continue;
      }
      // Group-scoped docs need an explicit share record pointing to this company.
      if (d.scope === "group" && d.templateId) {
        const shares = groupSharesMap.get(d.id) ?? [];
        const sharedToCompany = shares.some(s => s.entityType === "company" && s.entityId === companyId);
        if (sharedToCompany) fulfilledTemplateIds.add(d.templateId);
      }
    }

    const results: MissingRequiredTemplateDetail[] = [];
    for (const templateId of requiredIds) {
      if (fulfilledTemplateIds.has(templateId)) continue;
      const tmpl = templateMap.get(templateId);
      if (!tmpl || tmpl.visibility !== "private" || !tmpl.isActive) continue;
      if (module && tmpl.module !== module) continue;
      if (!module && !complianceModules.includes(tmpl.module as ModuleType)) continue;
      results.push({
        templateId,
        templateName: tmpl.name,
        module: tmpl.module,
        requiresApproval: tmpl.requiresApproval || false,
        siteId: "",
        siteName: "",
        companyId,
        companyName: company.name,
        groupOwnerId: company.groupOwnerId ?? null,
        folderTemplateId: (tmpl as any).folderTemplateId ?? null,
        kind: "template_slot" as const,
      });
    }
    return results;
  }

  async function getMissingRequiredTemplateDetails(
    user: any,
    module: ModuleType | undefined,
    siteFilter?: { siteId?: string; siteIds?: string }
  ): Promise<MissingRequiredTemplateDetail[]> {
    const results: MissingRequiredTemplateDetail[] = [];

    // Fetch all data in one parallel round-trip — bulk methods avoid N+1 queries.
    const [sites, templates, docs, companies, allSharesRaw, allSiteOverridesRaw, allCompanyReqsRaw] = await Promise.all([
      storage.getSites(),
      storage.getDocumentTemplates(),
      storage.getDocuments(module),
      storage.getCompanies(),
      storage.getAllDocumentSharesRaw(),
      storage.getAllSiteTemplateOverridesRaw(),
      storage.getAllCompanyRequiredTemplatesRaw(),
    ]);
    const templateMap = new Map(templates.map(t => [t.id, t]));
    const companyMap = new Map(companies.map(c => [c.id, c]));

    // Build in-memory lookup maps — zero additional DB calls from here on.
    const sharesByDocId = new Map<string, typeof allSharesRaw>();
    for (const share of allSharesRaw) {
      if (!sharesByDocId.has(share.documentId)) sharesByDocId.set(share.documentId, []);
      sharesByDocId.get(share.documentId)!.push(share);
    }
    const excludedTemplatesBySiteId = new Map<string, Set<string>>();
    for (const override of allSiteOverridesRaw) {
      if (override.action !== "exclude") continue;
      if (!excludedTemplatesBySiteId.has(override.siteId)) excludedTemplatesBySiteId.set(override.siteId, new Set());
      excludedTemplatesBySiteId.get(override.siteId)!.add(override.templateId);
    }
    const companyReqsByCompanyId = new Map<string, Set<string>>();
    for (const req of allCompanyReqsRaw) {
      if (req.removedAt) continue;
      if (!companyReqsByCompanyId.has(req.companyId)) companyReqsByCompanyId.set(req.companyId, new Set());
      companyReqsByCompanyId.get(req.companyId)!.add(req.templateId);
    }

    // All scoped (non-site) docs for in-memory shared-doc computation.
    const allScopedDocs = docs.filter(d => !d.siteId && (d.scope === "company" || d.scope === "group"));

    // In-memory equivalent of getSharedDocumentsForSite — no DB calls.
    function computeSharedDocsForSiteMRTD(site: typeof sites[0]) {
      const company = companyMap.get(site.companyId);
      if (!company) return [];
      const seenIds = new Set<string>();
      const results: any[] = [];
      for (const doc of allScopedDocs) {
        if (seenIds.has(doc.id)) continue;
        if (doc.isArchived) continue;
        if (module && doc.module !== module) continue;
        const shares = sharesByDocId.get(doc.id) ?? [];
        if (doc.scope === "company" && doc.entityId === site.companyId) {
          // Company-scope docs owned by this company always appear at this company's
          // own sites — no explicit share record required.
          seenIds.add(doc.id);
          results.push({ ...doc, sharedScope: "company", sharedFromEntityName: company.name });
        } else if (doc.scope === "group" && doc.entityId === site.companyId) {
          // Own group doc: appears at own sites only if at least one share record exists
          if (shares.length > 0) {
            seenIds.add(doc.id);
            results.push({ ...doc, sharedScope: "group", sharedFromEntityName: company.name });
          }
        } else if (doc.scope === "group" && company.groupOwnerId && doc.entityId === company.groupOwnerId) {
          if (shares.some(s => s.entityType === "company" && s.entityId === site.companyId)) {
            const goCompany = companyMap.get(company.groupOwnerId);
            seenIds.add(doc.id);
            results.push({ ...doc, sharedScope: "group", sharedFromEntityName: goCompany?.name ?? null });
          }
        }
      }
      return results;
    }

    // Pre-filter by siteFilter before the access checks.
    const filterSiteIds = siteFilter?.siteIds ? new Set(siteFilter.siteIds.split(",")) : null;
    const candidateSites = sites.filter(site => {
      if (!site.companyId) return false;
      if (siteFilter?.siteId && siteFilter.siteId !== "all" && site.id !== siteFilter.siteId) return false;
      if (filterSiteIds && !filterSiteIds.has(site.id)) return false;
      return true;
    });

    // Batch all access checks in parallel (admins short-circuit immediately).
    const accessResults = await Promise.all(candidateSites.map(s => canUserAccessSite(user, s.id)));
    const accessibleSites = candidateSites.filter((_, i) => accessResults[i]);

    if (accessibleSites.length === 0) return results;

    // All data is now in-memory — synchronous loop, zero further DB calls.
    for (const site of accessibleSites) {
      const requiredIds = companyReqsByCompanyId.get(site.companyId) ?? new Set<string>();
      const siteExcluded = excludedTemplatesBySiteId.get(site.id) ?? new Set<string>();
      const siteDocs = docs.filter(d => d.siteId === site.id && !d.isArchived && !d.caseId);
      const sharedDocs = computeSharedDocsForSiteMRTD(site);
      const allSiteDocs = [...siteDocs, ...sharedDocs.filter((d: any) => !d.isArchived && !d.caseId)];
      const company = companyMap.get(site.companyId);

      for (const templateId of requiredIds) {
        if (siteExcluded.has(templateId)) continue;
        const tmpl = templateMap.get(templateId);
        if (!tmpl || tmpl.visibility !== "private" || !tmpl.isActive) continue;
        if (module && tmpl.module !== module) continue;
        if (!module && !complianceModules.includes(tmpl.module as ModuleType)) continue;
        // Only count as "missing" when no document has been uploaded at all for this slot
        // (docs that exist but are overdue/review-required are counted in those other stats)
        const matchingDocs = allSiteDocs.filter(d => d.templateId === templateId);
        if (matchingDocs.length === 0) {
          results.push({
            templateId,
            templateName: tmpl.name,
            module: tmpl.module,
            requiresApproval: tmpl.requiresApproval || false,
            siteId: site.id,
            siteName: site.name,
            companyId: site.companyId,
            companyName: company?.name || "Unknown",
            groupOwnerId: company?.groupOwnerId ?? null,
            folderTemplateId: (tmpl as any).folderTemplateId ?? null,
            kind: "template_slot" as const,
          });
        }
      }
    }
    return results;
  }

  app.get("/api/required-template-ids", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const allSites = await storage.getSites();
      const accessChecks = await Promise.all(allSites.map(s => canUserAccessSite(user, s.id)));
      const accessibleSites = allSites.filter((_, i) => accessChecks[i]);

      const uniqueCompanyIds = [...new Set(accessibleSites.map(s => s.companyId))];
      const companyReqSets = await Promise.all(
        uniqueCompanyIds.map(cid => storage.getEffectiveCompanyRequiredTemplateIds(cid))
      );

      const requiredIds = new Set<string>();
      for (const set of companyReqSets) {
        for (const id of set) requiredIds.add(id);
      }

      const allTemplates = await storage.getDocumentTemplates();
      for (const t of allTemplates) {
        if (t.isMandatory) requiredIds.add(t.id);
      }

      res.json([...requiredIds]);
    } catch (error) {
      console.error("Error fetching required template IDs:", error);
      res.status(500).json({ error: "Failed to fetch required template IDs" });
    }
  });

  // Returns required template IDs grouped by company (for accessible companies).
  // Used by Module Sites tiles to compute "Missing" at the group/company scope —
  // i.e. required templates with no document uploaded at that scope.
  // Filters to active, private templates and (if `module` provided) the given module,
  // matching the same rules used by getMissingRequiredTemplateDetails.
  app.get("/api/required-template-ids-by-company", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const moduleParam = req.query.module as ModuleType | undefined;

      const allSites = await storage.getSites();
      const accessChecks = await Promise.all(allSites.map(s => canUserAccessSite(user, s.id)));
      const accessibleCompanyIds = new Set(
        allSites.filter((_, i) => accessChecks[i]).map(s => s.companyId).filter((id): id is string => !!id)
      );

      // Also include group-owner companies whose owned companies the user can access,
      // so the Group tile can resolve required templates for the group owner even when
      // the owner company itself has no directly-accessible sites.
      const allCompanies = await storage.getCompanies();
      for (const c of allCompanies) {
        if (accessibleCompanyIds.has(c.id) && c.groupOwnerId) {
          accessibleCompanyIds.add(c.groupOwnerId);
        }
      }

      const templates = await storage.getDocumentTemplates();
      const allowedTemplateIds = new Set(
        templates
          .filter(t => t.isActive && t.visibility === "private" && (!moduleParam || t.module === moduleParam))
          .map(t => t.id)
      );

      const companyIds = [...accessibleCompanyIds];
      const reqLists = await Promise.all(
        companyIds.map(cid => storage.getCompanyRequiredTemplates(cid))
      );

      const result: Record<string, string[]> = {};
      companyIds.forEach((cid, i) => {
        // Return all required templates registered on the company (direct rows
        // where inheritedFromCompanyId is null). Cascaded inherited rows are
        // excluded here because their fulfilment is checked per-site (taking
        // site overrides + shared docs into account) and surfaced via the
        // /api/missing-required-templates endpoint, which the Company tile uses
        // for its Missing count. The Group tile, which queries the group-owner
        // companyId, sees the group's own direct rows naturally.
        result[cid] = reqLists[i]
          .filter(r => r.inheritedFromCompanyId == null)
          .map(r => r.templateId)
          .filter(id => allowedTemplateIds.has(id));
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching required template IDs by company:", error);
      res.status(500).json({ error: "Failed to fetch required template IDs by company" });
    }
  });

  // Returns the effective required template IDs grouped by site, after applying
  // site-level template overrides (action="exclude") to the company's effective
  // required template set. Used by the Module Sites Site tile so its
  // Compliant/Review/Overdue counts can be constrained to docs whose template is
  // actually required at the site (otherwise group/company-shared docs whose
  // template isn't part of the site's required set would inflate Compliant
  // beyond the site's effective required count).
  // Filters templates the same way as getMissingRequiredTemplateDetails:
  // active + private + (if `module` is provided) matching module.
  app.get("/api/fulfilled-template-ids", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const scope = (req.query.scope as string) || "";
      const entityId = req.query.entityId as string | undefined;
      const siteId = req.query.siteId as string | undefined;
      const templateIds = await storage.getFulfilledTemplateIds(scope, entityId, siteId);
      res.json({ templateIds });
    } catch (error) {
      console.error("Error fetching fulfilled template IDs:", error);
      res.status(500).json({ error: "Failed to fetch fulfilled template IDs" });
    }
  });

  app.get("/api/effective-required-template-ids-by-site", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const moduleParam = req.query.module as ModuleType | undefined;

      const allSites = await storage.getSites();
      const accessChecks = await Promise.all(allSites.map(s => canUserAccessSite(user, s.id)));
      const accessibleSites = allSites.filter((_, i) => accessChecks[i]);

      const templates = await storage.getDocumentTemplates();
      const allowedTemplateIds = new Set(
        templates
          .filter(t => t.isActive && t.visibility === "private" && (!moduleParam || t.module === moduleParam))
          .map(t => t.id)
      );

      // Load bulk data to avoid N per-site DB calls.
      const [allCompanyReqsERT, allSiteOverridesERT] = await Promise.all([
        storage.getAllCompanyRequiredTemplatesRaw(),
        storage.getAllSiteTemplateOverridesRaw(),
      ]);
      const companyReqsByCompanyERT = new Map<string, Set<string>>();
      for (const req of allCompanyReqsERT) {
        if (req.removedAt) continue;
        if (!companyReqsByCompanyERT.has(req.companyId)) companyReqsByCompanyERT.set(req.companyId, new Set());
        companyReqsByCompanyERT.get(req.companyId)!.add(req.templateId);
      }
      const excludedBySiteERT = new Map<string, Set<string>>();
      for (const override of allSiteOverridesERT) {
        if (override.action !== "exclude") continue;
        if (!excludedBySiteERT.has(override.siteId)) excludedBySiteERT.set(override.siteId, new Set());
        excludedBySiteERT.get(override.siteId)!.add(override.templateId);
      }

      const result: Record<string, string[]> = {};
      for (const site of accessibleSites) {
        if (!site.companyId) { result[site.id] = []; continue; }
        const companyRequired = companyReqsByCompanyERT.get(site.companyId) ?? new Set<string>();
        const excluded = excludedBySiteERT.get(site.id) ?? new Set<string>();
        const effective: string[] = [];
        for (const tid of companyRequired) {
          if (excluded.has(tid)) continue;
          if (!allowedTemplateIds.has(tid)) continue;
          effective.push(tid);
        }
        result[site.id] = effective;
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching effective required template IDs by site:", error);
      res.status(500).json({ error: "Failed to fetch effective required template IDs by site" });
    }
  });

  app.get("/api/missing-required-templates", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const module = req.query.module as ModuleType | undefined;
      const companyId = req.query.companyId as string | undefined;
      const siteId = req.query.siteId as string | undefined;
      const siteIds = req.query.siteIds as string | undefined;

      // Company-scope request: compute requirements at the company level without
      // applying per-site exclusions.  Each required template appears once; a template
      // is "fulfilled" when any document visible to the company (site docs, company/group
      // scoped shared docs) has a matching templateId.
      if (companyId) {
        const details = await getMissingRequiredTemplatesForCompany(user, companyId, module);
        return res.json(details);
      }

      const details = await getMissingRequiredTemplateDetails(user, module, { siteId, siteIds });
      res.json(details);
    } catch (error) {
      console.error("Error fetching missing required templates:", error);
      res.status(500).json({ error: "Failed to fetch missing required templates" });
    }
  });

  // Batch company-level missing-required-templates endpoint.
  // Returns a flat array of company-scope missing slots for every accessible company,
  // computed WITHOUT per-site exclusions (matching the company Documents page view).
  // Used by module-sites tiles to display a consistent Missing count.
  app.get("/api/missing-required-templates/by-company", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const moduleParam = req.query.module as ModuleType | undefined;

      const allSites = await storage.getSites();
      const accessChecks = await Promise.all(allSites.map(s => canUserAccessSite(user, s.id)));
      const accessibleCompanyIds = [
        ...new Set(
          allSites.filter((_, i) => accessChecks[i]).map(s => s.companyId).filter((id): id is string => !!id)
        ),
      ];

      const results = (
        await Promise.all(
          accessibleCompanyIds.map(cid => getMissingRequiredTemplatesForCompany(user, cid, moduleParam))
        )
      ).flat();

      res.json(results);
    } catch (error) {
      console.error("Error fetching company-scope missing templates:", error);
      res.status(500).json({ error: "Failed to fetch company-scope missing templates" });
    }
  });

  // Module-specific dashboard
  app.get("/api/dashboard/:module", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const module = req.params.module as ModuleType;
      if (module !== "health_safety" && module !== "human_resources" && module !== "employment_law" && module !== "training") {
        return res.status(400).json({ error: "Invalid module" });
      }
      
      // Parse optional filter params from frontend
      const requestedSiteId = req.query.siteId as string | undefined;
      const requestedSiteIds = req.query.siteIds as string | undefined;
      
      const allDocuments = await storage.getDocuments(module);
      
      // Filter documents by sites the user can access AND by requested filters
      const accessibleDocuments = await Promise.all(
        allDocuments.map(async (doc) => {
          const canAccess = await canUserAccessDocument(user, doc);
          if (!canAccess) return null;
          
          // Apply additional site filter if specified
          if (requestedSiteId && requestedSiteId !== "all") {
            if (doc.siteId !== requestedSiteId) {
              // For scoped docs (null siteId), check if visible to the requested site
              if (!doc.siteId && (doc.scope === "company" || doc.scope === "group")) {
                const site = await storage.getSite(requestedSiteId);
                if (!site) return null;
                const shares = await storage.getDocumentShares(doc.id);
                // Group-scoped docs owned by this company appear if at least one share exists
                if (doc.scope === "group" && doc.entityId === site.companyId && shares.length > 0) return doc;
                // All other scoped docs require an explicit site or company share record
                const isSharedToSite = shares.some(s =>
                  (s.entityType === "site" && s.entityId === requestedSiteId) ||
                  (s.entityType === "company" && s.entityId === site.companyId)
                );
                if (!isSharedToSite) return null;
              } else {
                return null;
              }
            }
          } else if (requestedSiteIds) {
            const siteIdList = requestedSiteIds.split(",");
            if (!doc.siteId) {
              // For scoped docs, check if visible to any of the requested sites
              if (doc.scope === "company" || doc.scope === "group") {
                const matchedSite = await Promise.all(siteIdList.map(sid => storage.getSite(sid)));
                const matchedCompanyIds = new Set(matchedSite.filter(Boolean).map(s => s!.companyId));
                const shares = await storage.getDocumentShares(doc.id);
                // Group-scoped docs owned by one of the matched companies appear if at least one share exists
                if (doc.scope === "group" && doc.entityId && matchedCompanyIds.has(doc.entityId) && shares.length > 0) return doc;
                // All other scoped docs require an explicit site or company share record
                const isShared = shares.some(s =>
                  (s.entityType === "site" && siteIdList.includes(s.entityId)) ||
                  (s.entityType === "company" && matchedCompanyIds.has(s.entityId))
                );
                if (!isShared) return null;
              } else {
                return null;
              }
            } else if (!siteIdList.includes(doc.siteId)) {
              return null;
            }
          }
          
          return doc;
        })
      );
      const documents = accessibleDocuments.filter((d): d is NonNullable<typeof d> => d !== null);
      
      // Slot-based compliance calculation: each required template contributes exactly one slot
      const complianceResult = await computeSlotBasedCompliance(
        user, documents, module, { siteId: requestedSiteId, siteIds: requestedSiteIds }
      );
      const { totalDocuments, compliantDocuments, approvalRequired, overdueDocuments, missingRequiredDocuments, complianceScore, consumedDocIds, expandedDocTotal, expandedCompliant, expandedApprovalReq, expandedOverdue } = complianceResult;
      // Pending approvals remain based on ALL docs (approval workflow, not compliance scope)
      const pendingApprovals = documents.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;

      // Document Progress counts: shared docs counted once per site they're visible at,
      // matching the folder-view stats bar (hierarchy total + sharedExpansionDeltas).
      // These come from computeSlotBasedCompliance's per-site expansion loop.
      const allDocumentsCount = expandedDocTotal;
      const allCompliantDocuments = expandedCompliant;
      const allApprovalRequired = expandedApprovalReq;
      const allOverdueDocuments = expandedOverdue;
      
      // Calculate split approval metrics based on user role (all docs)
      let awaitingYourApproval = 0;
      let awaitingOthersApproval = 0;
      
      for (const doc of documents) {
        if (doc.approvalStatus !== "pending" && doc.approvalStatus !== "client_signed_off") {
          continue;
        }
        
        const uploader = await storage.getUser(doc.uploadedBy);
        if (!uploader) continue;
        
        const uploaderIsClient = uploader.role === "client";
        const uploadedByCurrentUser = doc.uploadedBy === user.id;
        
        if (user.role === "client") {
          const isDesignatedApprover = !doc.approvalRequestedFrom || doc.approvalRequestedFrom === user.id;
          if (!uploaderIsClient && doc.approvalStatus === "pending" && isDesignatedApprover) {
            awaitingYourApproval++;
          } else if (uploadedByCurrentUser && doc.approvalStatus === "pending") {
            awaitingOthersApproval++;
          }
        } else {
          if (uploaderIsClient && doc.approvalStatus === "pending") {
            awaitingYourApproval++;
          } else if (doc.approvalStatus === "client_signed_off") {
            awaitingYourApproval++;
          } else if (uploadedByCurrentUser && doc.approvalStatus === "pending") {
            awaitingOthersApproval++;
          }
        }
      }
      
      const summary = {
        totalDocuments,
        compliantDocuments,
        approvalRequired,
        overdueDocuments,
        missingRequiredDocuments,
        complianceScore,
        totalAllDocuments: allDocumentsCount,
        allDocuments: allDocumentsCount,
        allCompliantDocuments,
        allApprovalRequired,
        allOverdueDocuments,
        pendingApprovals,
        awaitingYourApproval,
        awaitingOthersApproval,
      };
      
      const recentDocuments = documents.slice(0, 5);
      
      const now = new Date();
      const upcomingReviews = documents
        .filter(doc => doc.renewalDate && new Date(doc.renewalDate) > now)
        .sort((a, b) => new Date(a.renewalDate!).getTime() - new Date(b.renewalDate!).getTime())
        .slice(0, 5);

      // For employment_law, include cases and all documents for client-side metrics
      let elCases: any[] | undefined;
      let elAllDocuments: any[] | undefined;
      if (module === "employment_law") {
        const caseFilters: { siteId?: string; entityId?: string; includeArchived?: boolean } = {};
        if (user.role === "client" && user.companyId) {
          caseFilters.entityId = user.companyId;
        } else {
          const requestedEntityId = req.query.entityId as string | undefined;
          if (requestedEntityId) caseFilters.entityId = requestedEntityId;
        }
        if (requestedSiteId && requestedSiteId !== "all") {
          caseFilters.siteId = requestedSiteId;
        }
        const rawCases = await storage.getCases(caseFilters);
        const filteredRawCases = rawCases.filter(c => {
          if (!c.isConfidential) return true;
          if (user.role === "developer") return true;
          if (user.role === "consultant") return true;
          if (c.createdBy === user.id) return true;
          if (c.assignedConsultant === user.id) return true;
          if (c.restrictedToUsers && c.restrictedToUsers.includes(user.id)) return true;
          return false;
        });
        // Attach split milestone deadline fields (same as /api/cases)
        const elCaseIds = filteredRawCases.map(c => c.id);
        const elMilestones = await storage.getCaseMilestonesForCases(elCaseIds);
        const elNow = new Date();
        const elOverdueByCase: Record<string, Date | null> = {};
        const elUpcomingByCase: Record<string, Date | null> = {};
        for (const m of elMilestones) {
          if (!m.isCompleted && m.dueDate && !m.isResponseDeadline) {
            const mDate = new Date(m.dueDate);
            if (mDate < elNow) {
              const ex = elOverdueByCase[m.caseId];
              if (!ex || mDate < ex) elOverdueByCase[m.caseId] = mDate;
            } else {
              const ex = elUpcomingByCase[m.caseId];
              if (!ex || mDate < ex) elUpcomingByCase[m.caseId] = mDate;
            }
          }
        }
        elCases = filteredRawCases.map(c => ({
          ...c,
          overduesMilestoneDueDate: elOverdueByCase[c.id] ?? null,
          upcomingMilestoneDueDate: elUpcomingByCase[c.id] ?? null,
        }));
        elAllDocuments = documents;
      }

      res.json({
        summary,
        recentDocuments,
        upcomingReviews,
        ...(module === "employment_law" ? { cases: elCases, allDocuments: elAllDocuments } : {}),
      });
    } catch (error) {
      console.error("Module dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch module dashboard data" });
    }
  });

  // Main Dashboard (overview of all modules)
  app.get("/api/dashboard", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const module = req.query.module as ModuleType | undefined;
      const allDocuments = await storage.getDocuments(module);
      
      // Filter documents by sites the user can access
      const accessibleDocuments = await Promise.all(
        allDocuments.map(async (doc) => {
          const canAccess = await canUserAccessDocument(user, doc);
          return canAccess ? doc : null;
        })
      );
      const documents = accessibleDocuments.filter((d): d is NonNullable<typeof d> => d !== null);
      
      // Slot-based compliance calculation: each required template contributes exactly one slot
      const complianceResult = await computeSlotBasedCompliance(user, documents, module);
      const { totalDocuments, compliantDocuments, approvalRequired, overdueDocuments, missingRequiredDocuments, complianceScore, consumedDocIds } = complianceResult;
      // Pending approvals remain based on ALL docs (approval workflow, not compliance scope)
      const pendingApprovals = documents.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;

      // Document Progress stats — regular module folder documents only
      // Exclude: archived, case docs (EL), incident docs (H&S), cloud share (source "external")
      // When no specific module is requested, restrict to H&S/HR/EL (compliance modules only)
      const _dashComplianceModules = new Set(["health_safety", "human_resources", "employment_law"]);
      const allNonCaseDocs = documents.filter(d =>
        !d.isArchived &&
        !d.caseId &&
        !d.incidentId &&
        d.source !== "external" &&
        (module ? true : _dashComplianceModules.has(d.module))
      );
      const _progNow2 = new Date();
      // Overdue strictly date-based; approval from workflow state
      const isDocOverdue2 = (d: any): boolean =>
        !!(d.expiryDate && new Date(d.expiryDate) < _progNow2) ||
        !!(d.renewalDate && new Date(d.renewalDate) < _progNow2);
      const isDocApprovalRequired2 = (d: any): boolean =>
        d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off";
      const allDocsProgress = allNonCaseDocs.length;
      const allCompliantProgress = allNonCaseDocs.filter(d => d.status === "compliant" && !isDocOverdue2(d) && !isDocApprovalRequired2(d)).length;
      const allApprovalRequiredProgress = allNonCaseDocs.filter(isDocApprovalRequired2).length;
      const allOverdueProgress = allNonCaseDocs.filter(isDocOverdue2).length;
      
      // Calculate split approval metrics based on user role (all docs)
      let awaitingYourApproval = 0;
      let awaitingOthersApproval = 0;
      
      for (const doc of documents) {
        if (doc.approvalStatus !== "pending" && doc.approvalStatus !== "client_signed_off") {
          continue;
        }
        
        const uploader = await storage.getUser(doc.uploadedBy);
        if (!uploader) continue;
        
        const uploaderIsClient = uploader.role === "client";
        const uploadedByCurrentUser = doc.uploadedBy === user.id;
        
        if (user.role === "client") {
          const isDesignatedApprover = !doc.approvalRequestedFrom || doc.approvalRequestedFrom === user.id;
          if (!uploaderIsClient && doc.approvalStatus === "pending" && isDesignatedApprover) {
            awaitingYourApproval++;
          } else if (uploadedByCurrentUser && doc.approvalStatus === "pending") {
            awaitingOthersApproval++;
          }
        } else {
          if (uploaderIsClient && doc.approvalStatus === "pending") {
            awaitingYourApproval++;
          } else if (doc.approvalStatus === "client_signed_off") {
            awaitingYourApproval++;
          } else if (uploadedByCurrentUser && doc.approvalStatus === "pending") {
            awaitingOthersApproval++;
          }
        }
      }
      
      const summary = {
        totalDocuments,
        compliantDocuments,
        approvalRequired,
        overdueDocuments,
        missingRequiredDocuments,
        complianceScore,
        totalAllDocuments: allDocsProgress,
        allDocuments: allDocsProgress,
        allCompliantDocuments: allCompliantProgress,
        allApprovalRequired: allApprovalRequiredProgress,
        allOverdueDocuments: allOverdueProgress,
        pendingApprovals,
        awaitingYourApproval,
        awaitingOthersApproval,
      };
      
      const recentDocuments = documents.slice(0, 5);
      
      const now = new Date();
      const upcomingReviews = documents
        .filter(doc => doc.renewalDate && new Date(doc.renewalDate) > now)
        .sort((a, b) => new Date(a.renewalDate!).getTime() - new Date(b.renewalDate!).getTime())
        .slice(0, 5);
      
      res.json({
        summary,
        recentDocuments,
        upcomingReviews,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Module summaries for overview dashboard
  app.get("/api/modules/summary", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const siteId = req.query.siteId as string | undefined;
      const requestedCompanyId = req.query.companyId as string | undefined;
      const requestedSiteIds = req.query.siteIds as string | undefined;

      // Determine the set of accessible site IDs based on user role and filters
      let accessibleSiteIds: string[] | undefined;

      if (user.role === "client") {
        if (!user.companyId) {
          return res.json([]);
        }
        const clientSiteAssignments = await storage.getClientSites(user.id);
        const assignedSiteIds = clientSiteAssignments.map(a => a.siteId);
        if (assignedSiteIds.length === 0) {
          return res.json([]);
        }
        if (siteId) {
          if (!assignedSiteIds.includes(siteId)) {
            return res.status(403).json({ error: "Not authorized to access this site" });
          }
          accessibleSiteIds = [siteId];
        } else {
          accessibleSiteIds = assignedSiteIds;
        }
      } else if (user.role === "developer") {
        if (requestedCompanyId) {
          const companySites = await storage.getSitesByCompanyId(requestedCompanyId);
          if (companySites.length === 0) return res.json([]);
          accessibleSiteIds = companySites.map(s => s.id);
        } else if (requestedSiteIds) {
          accessibleSiteIds = requestedSiteIds.split(",");
        } else if (siteId) {
          accessibleSiteIds = [siteId];
        }
      } else if (user.role === "consultant" || user.role === "administrator") {
        if (requestedCompanyId) {
          const companySites = await storage.getSitesByCompanyId(requestedCompanyId);
          const accessibleSites = await Promise.all(
            companySites.map(async (site) => {
              const canAccess = await canUserAccessSite(user, site.id);
              return canAccess ? site : null;
            })
          );
          const filteredSites = accessibleSites.filter((s): s is NonNullable<typeof s> => s !== null);
          if (filteredSites.length === 0) return res.json([]);
          accessibleSiteIds = filteredSites.map(s => s.id);
        } else if (requestedSiteIds) {
          const siteIds = requestedSiteIds.split(",");
          const accessChecks = await Promise.all(
            siteIds.map(async (id) => {
              const canAccess = await canUserAccessSite(user, id);
              return canAccess ? id : null;
            })
          );
          const filteredIds = accessChecks.filter((id): id is string => id !== null);
          if (filteredIds.length === 0) return res.json([]);
          accessibleSiteIds = filteredIds;
        } else if (siteId) {
          const canAccess = await canUserAccessSite(user, siteId);
          if (!canAccess) {
            return res.status(403).json({ error: "Access denied to this site" });
          }
          accessibleSiteIds = [siteId];
        } else if (!hasProPrivileges(user)) {
          const assignments = await storage.getConsultantSites(user.id);
          if (assignments.length === 0) return res.json([]);
          accessibleSiteIds = assignments.map(a => a.siteId);
        }
      }

      // Fetch regular module folder documents
      // Exclude: archived, case docs (EL), incident docs (H&S), cloud share (source "external")
      const allDocs = await storage.getDocuments();

      // Site-scoped docs filtered to accessible sites
      const siteScopedDocs = allDocs.filter(d =>
        !d.isArchived &&
        !d.caseId &&
        !d.incidentId &&
        d.source !== "external" &&
        d.siteId != null &&
        (!accessibleSiteIds || accessibleSiteIds.includes(d.siteId))
      );

      // Company/group scoped docs (siteId=null) — expanded once per site they cover,
      // mirroring the scopedDocMultiplier logic on the module dashboard page.
      const allSitesForSummary = await storage.getSites();
      const siteToCompanySummary = new Map(allSitesForSummary.map(s => [s.id, s.companyId]));
      const effectiveAccessibleSiteIds = accessibleSiteIds ?? allSitesForSummary.map(s => s.id);

      const rawScopedDocs = allDocs.filter(d =>
        !d.isArchived &&
        !d.caseId &&
        !d.incidentId &&
        d.source !== "external" &&
        d.siteId == null
      );

      type ScopedExpansion = { module: string; status: string; approvalStatus: string; siteCount: number };
      const scopedExpansions: ScopedExpansion[] = [];
      const accessibleScopedDocIds = new Set<string>();

      // Batch step 1: check access for all scoped docs in parallel (replaces sequential awaits)
      const accessFlags = await Promise.all(rawScopedDocs.map(doc => canUserAccessDocument(user, doc)));
      const accessibleScopedDocs = rawScopedDocs.filter((_, i) => accessFlags[i]);
      accessibleScopedDocs.forEach(doc => accessibleScopedDocIds.add(doc.id));

      // Batch step 2: load all share records in parallel
      const allShareResults = await Promise.all(accessibleScopedDocs.map(doc => storage.getDocumentShares(doc.id)));

      for (let i = 0; i < accessibleScopedDocs.length; i++) {
        const doc = accessibleScopedDocs[i];
        const shareRecords = allShareResults[i];
        const sharedWithCompanyIds = new Set(shareRecords.filter(s => s.entityType === "company").map(s => s.entityId));
        const sharedWithSiteIds = new Set(shareRecords.filter(s => s.entityType === "site").map(s => s.entityId));

        const count = effectiveAccessibleSiteIds.filter(sid => {
          if (sharedWithSiteIds.has(sid)) return true;
          const companyId = siteToCompanySummary.get(sid);
          if (companyId && sharedWithCompanyIds.has(companyId)) return true;
          // Company-scoped docs owned by this company always count for its sites.
          // Group-scoped docs owned by this company only count if at least one
          // share record exists (i.e. the uploader chose to share it).
          if (companyId && doc.entityId === companyId) {
            if (doc.scope === "group") return shareRecords.length > 0;
            return true;
          }
          return false;
        }).length;

        scopedExpansions.push({
          module: doc.module,
          status: doc.status,
          approvalStatus: doc.approvalStatus,
          siteCount: Math.max(count, 1),
        });
      }

      const moduleNames: Record<string, string> = {
        health_safety: "Health & Safety",
        human_resources: "Human Resources",
        employment_law: "Employment Law",
        support: "Support",
      };

      const siteFilter = accessibleSiteIds
        ? { siteIds: accessibleSiteIds.join(",") }
        : undefined;

      const modules: ModuleType[] = ["health_safety", "human_resources", "employment_law"];
      const summaries = await Promise.all(modules.map(async (mod) => {
        // Compliance calculation uses all docs (site-scoped + scoped) for the module
        const allModuleDocs = [
          ...siteScopedDocs.filter(d => d.module === mod),
          ...rawScopedDocs.filter(d => d.module === mod && accessibleScopedDocIds.has(d.id)),
        ];
        // All-doc tile stats — overdue strictly date-based; approval from workflow state
        const _modNow = new Date();
        const isModOverdue = (d: any): boolean =>
          !!(d.expiryDate && new Date(d.expiryDate) < _modNow) ||
          !!(d.renewalDate && new Date(d.renewalDate) < _modNow);
        const isModApprovalRequired = (d: any): boolean =>
          d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off";
        const allDocsCount = allModuleDocs.length;
        const allCompliant = allModuleDocs.filter(d => d.status === "compliant" && !isModOverdue(d) && !isModApprovalRequired(d)).length;
        const allApprovalRequired = allModuleDocs.filter(isModApprovalRequired).length;
        const allOverdue = allModuleDocs.filter(isModOverdue).length;
        const pending = allApprovalRequired;

        if (complianceModules.includes(mod)) {
          const compliance = await computeSlotBasedCompliance(user, allModuleDocs, mod, siteFilter);
          return {
            module: mod,
            moduleName: moduleNames[mod],
            ...compliance,
            totalAllDocuments: allDocsCount,
            allDocuments: compliance.expandedDocTotal,
            allCompliantDocuments: compliance.expandedCompliant,
            allApprovalRequired: compliance.expandedApprovalReq,
            allOverdueDocuments: compliance.expandedOverdue,
            pendingApprovals: pending,
            awaitingYourApproval: 0,
            awaitingOthersApproval: 0,
          };
        }
        return {
          module: mod,
          moduleName: moduleNames[mod],
          totalDocuments: allDocsCount,
          compliantDocuments: allCompliant,
          approvalRequired: allApprovalRequired,
          overdueDocuments: allOverdue,
          missingRequiredDocuments: 0,
          complianceScore: allDocsCount > 0 ? Math.round((allCompliant / allDocsCount) * 100) : 0,
          totalAllDocuments: allDocsCount,
          allDocuments: allDocsCount,
          allCompliantDocuments: allCompliant,
          allApprovalRequired,
          allOverdueDocuments: allOverdue,
          pendingApprovals: pending,
          awaitingYourApproval: 0,
          awaitingOthersApproval: 0,
        };
      }));

      res.json(summaries);
    } catch (error) {
      console.error("Module summaries error:", error);
      res.status(500).json({ error: "Failed to fetch module summaries" });
    }
  });

  // Documents by module
  app.get("/api/documents/module/:module", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const module = req.params.module as ModuleType;
      if (module !== "health_safety" && module !== "human_resources" && module !== "employment_law" && module !== "training") {
        return res.status(400).json({ error: "Invalid module" });
      }
      const includeArchived = req.query.includeArchived === "true";
      const allDocuments = await storage.getDocuments(module, includeArchived);
      
      // Get document templates to enrich documents with isMandatory/renewalPeriodMonths
      const docTemplates = await storage.getDocumentTemplates(module);

      // Build company required-templates lookup so documents required via company
      // configuration show the correct compliance badge (not "Not Required")
      const allSitesForModule = await storage.getSites();
      const siteToCompanyModule = new Map(allSitesForModule.map(s => [s.id, s.companyId]));
      const uniqueCompanyIdsModule = [...new Set(allDocuments.map(d => siteToCompanyModule.get(d.siteId)).filter(Boolean) as string[])];
      const companyReqCacheModule = new Map<string, Set<string>>();
      await Promise.all(uniqueCompanyIdsModule.map(async (companyId) => {
        companyReqCacheModule.set(companyId, await storage.getEffectiveCompanyRequiredTemplateIds(companyId));
      }));
      
      // Filter documents by sites the user can access (site-scoped docs)
      const accessibleDocuments = await Promise.all(
        allDocuments.filter(d => d.siteId != null).map(async (doc) => {
          const canAccess = await canUserAccessSite(user, doc.siteId!);
          if (!canAccess) return null;
          
          // Enrich document with template properties + company required-template check
          const docTemplate = docTemplates.find(dt => dt.id === doc.templateId);
          const companyId = siteToCompanyModule.get(doc.siteId!);
          const isRequiredViaCompanyTemplate = companyId && doc.templateId
            ? (companyReqCacheModule.get(companyId)?.has(doc.templateId) ?? false)
            : false;
          return {
            ...doc,
            isMandatory: doc.isMandatory || docTemplate?.isMandatory || isRequiredViaCompanyTemplate,
            renewalPeriodMonths: doc.renewalPeriodMonths ?? docTemplate?.renewalPeriodMonths ?? null,
          };
        })
      );

      // Include company/group scoped docs (siteId=null) that the user can access
      const scopedDocs = allDocuments.filter(d => d.siteId == null && (d.scope === "company" || d.scope === "group"));
      const scopedAccessChecks = await Promise.all(scopedDocs.map(doc => canUserAccessDocument(user, doc)));
      // Pre-resolve source folder template ids so scoped docs whose folderId points
      // to a different scope's folder (e.g. group-scoped doc with a group folderId
      // viewed at company scope) can still be matched to the equivalent folder.
      const scopedFolderIds = Array.from(new Set(
        scopedDocs.map(d => d.folderId).filter((v): v is string => !!v)
      ));
      const scopedFolderTemplateMap = new Map<string, string | null>();
      if (scopedFolderIds.length > 0) {
        const scopedFolderRows = await Promise.all(
          scopedFolderIds.map(fid => storage.getDocumentFolder(fid))
        );
        for (const f of scopedFolderRows) {
          if (f) scopedFolderTemplateMap.set(f.id, f.templateId ?? null);
        }
      }
      const accessibleScopedDocs = await Promise.all(
        scopedDocs
          .filter((_, idx) => scopedAccessChecks[idx])
          .map(async (doc) => {
            const docTemplate = docTemplates.find(dt => dt.id === doc.templateId);
            // Compute shared-link metadata for destination users (mirror /api/documents logic)
            const isOrigin = await isDocumentOriginUser(user, doc);
            const isSharedLink = !isOrigin;
            let sharedFromEntityName: string | null = null;
            if (isSharedLink && doc.entityId) {
              const entityCompany = await storage.getCompany(doc.entityId);
              sharedFromEntityName = entityCompany?.name ?? null;
            }
            // Surface explicit share assignments so company/site tiles can include
            // group/company-scoped documents in their compliance counts.
            const shareRecords = await storage.getDocumentShares(doc.id);
            const sharedWithCompanyIds = shareRecords
              .filter(s => s.entityType === "company")
              .map(s => s.entityId);
            const sharedWithSiteIds = shareRecords
              .filter(s => s.entityType === "site")
              .map(s => s.entityId);

            // A scoped doc is "required" when its template is in the required
            // list of any destination company (or, for site shares, the site's
            // owning company), or for the doc's origin entity itself.
            let isRequiredViaScope = false;
            if (doc.templateId) {
              const candidateCompanyIds = new Set<string>(sharedWithCompanyIds);
              if (doc.scope === "company" && doc.entityId) candidateCompanyIds.add(doc.entityId);
              for (const sid of sharedWithSiteIds) {
                const cId = siteToCompanyModule.get(sid);
                if (cId) candidateCompanyIds.add(cId);
              }
              for (const cId of candidateCompanyIds) {
                if (!companyReqCacheModule.has(cId)) {
                  companyReqCacheModule.set(cId, await storage.getEffectiveCompanyRequiredTemplateIds(cId));
                }
                if (companyReqCacheModule.get(cId)?.has(doc.templateId)) {
                  isRequiredViaScope = true;
                  break;
                }
              }
            }

            return {
              ...doc,
              isMandatory: doc.isMandatory || docTemplate?.isMandatory || isRequiredViaScope,
              renewalPeriodMonths: doc.renewalPeriodMonths ?? docTemplate?.renewalPeriodMonths ?? null,
              folderTemplateId: doc.folderId ? (scopedFolderTemplateMap.get(doc.folderId) ?? null) : null,
              isSharedLink,
              sharedScope: isSharedLink ? (doc.scope as "company" | "group") : undefined,
              sharedFromEntityName: isSharedLink ? sharedFromEntityName : undefined,
              sharedWithCompanyIds,
              sharedWithSiteIds,
            };
          })
      );
      
      // Exclude case documents (EL), incident-linked documents (H&S), and cloud share uploads
      // These are managed in their own dedicated sections, not the module document folder
      const regularDocs = [
        ...accessibleDocuments.filter((d): d is NonNullable<typeof d> =>
          d !== null && !d.caseId && !d.incidentId && d.source !== "external"
        ),
        ...accessibleScopedDocs.filter(d => !d.caseId && !d.incidentId && d.source !== "external"),
      ];
      res.json(regularDocs);
    } catch (error) {
      console.error("Module documents error:", error);
      res.status(500).json({ error: "Failed to fetch module documents" });
    }
  });

  // Documents
  app.get("/api/documents", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const module = req.query.module as ModuleType | undefined;
      const siteId = req.query.siteId as string | undefined;
      const siteIds = req.query.siteIds as string | undefined;
      const includeArchived = req.query.includeArchived === "true";
      
      // Parallel baseline fetch — 4 queries in one round-trip instead of sequential
      const [allDocuments, allSitesForDocs, allDocTemplates, allCompanyReqsRaw, allCompaniesForDocs] = await Promise.all([
        storage.getDocuments(module, includeArchived),
        storage.getSites(),
        storage.getDocumentTemplates(),
        storage.getAllCompanyRequiredTemplatesRaw(),  // single query replaces N per-company calls
        storage.getCompanies(),
      ]);

      const siteToCompanyDocs = new Map(allSitesForDocs.map(s => [s.id, s.companyId]));
      const docTemplateMap = new Map(allDocTemplates.map(dt => [dt.id, dt]));
      const companyNameMap = new Map(allCompaniesForDocs.map(c => [c.id, c.name]));

      // Build company→required-template-ids map in memory (replaces N per-company DB queries)
      const companyReqCacheDocs = new Map<string, Set<string>>();
      for (const req of allCompanyReqsRaw) {
        if (req.removedAt) continue;
        if (!companyReqCacheDocs.has(req.companyId)) companyReqCacheDocs.set(req.companyId, new Set());
        companyReqCacheDocs.get(req.companyId)!.add(req.templateId);
      }

      // Pre-compute which sites are accessible — M unique-site checks instead of N per-document checks
      const uniqueSiteIds = [...new Set(allDocuments.filter(d => d.siteId).map(d => d.siteId as string))];
      const siteAccessChecks = await Promise.all(uniqueSiteIds.map(sid => canUserAccessSite(user, sid)));
      const accessibleSiteIds = new Set(uniqueSiteIds.filter((_, i) => siteAccessChecks[i]));

      // Filter documents by sites the user can access
      const accessibleDocuments = await Promise.all(
        allDocuments.map(async (doc) => {
          // Site-scoped: resolved from pre-computed set (zero extra DB calls)
          // Company/group-scoped: still requires the full async check (complex rules, rare docs)
          const canAccess = doc.siteId
            ? accessibleSiteIds.has(doc.siteId)
            : await canUserAccessDocument(user, doc);
          if (!canAccess) return null;
          const docTemplate = doc.templateId ? docTemplateMap.get(doc.templateId) : undefined;
          // For site-scoped docs use site→company map; for company/group scoped use entityId directly
          const companyId = doc.siteId
            ? siteToCompanyDocs.get(doc.siteId)
            : (doc.entityId || undefined);
          const isRequiredViaCompanyTemplate = companyId && doc.templateId
            ? (companyReqCacheDocs.get(companyId)?.has(doc.templateId) ?? false)
            : false;
          // Site-scoped docs are always origin-side; skip the async check for them
          const isOrigin = doc.siteId ? true : await isDocumentOriginUser(user, doc);
          const isSharedLink = !doc.siteId && (doc.scope === "company" || doc.scope === "group") && !isOrigin;
          // Company name resolved from pre-fetched map — no extra DB call
          const sharedFromEntityName = isSharedLink && doc.entityId
            ? (companyNameMap.get(doc.entityId) ?? null)
            : null;
          return {
            ...doc,
            isMandatory: doc.isMandatory || docTemplate?.isMandatory || isRequiredViaCompanyTemplate,
            isSharedLink,
            sharedScope: isSharedLink ? (doc.scope as "company" | "group") : undefined,
            sharedFromEntityName: isSharedLink ? sharedFromEntityName : undefined,
          };
        })
      );
      
      let filteredDocuments = accessibleDocuments.filter((d): d is NonNullable<typeof d> => d !== null);
      
      // Apply additional siteId/siteIds filter if provided
      // For scoped docs (siteId null), include them only if explicitly shared to the requested site
      if (siteId) {
        const siteForFilter = await storage.getSite(siteId);
        filteredDocuments = (await Promise.all(filteredDocuments.map(async d => {
          if (d.siteId === siteId) return d;
          if (!d.siteId && (d.scope === "company" || d.scope === "group") && siteForFilter) {
            const shares = await storage.getDocumentShares(d.id);
            const isShared = shares.some(s =>
              (s.entityType === "site" && s.entityId === siteId) ||
              (s.entityType === "company" && s.entityId === siteForFilter.companyId)
            );
            return isShared ? d : null;
          }
          return null;
        }))).filter((d): d is NonNullable<typeof d> => d !== null);
      } else if (siteIds) {
        const siteIdArray = siteIds.split(",");
        const rawSitesForFilter = await Promise.all(siteIdArray.map(sid => storage.getSite(sid)));
        const sitesForFilter = rawSitesForFilter.filter((s): s is NonNullable<typeof s> => s != null);
        const filterCompanyIds = new Set(sitesForFilter.map(s => s!.companyId));
        filteredDocuments = (await Promise.all(filteredDocuments.map(async d => {
          if (d.siteId && siteIdArray.includes(d.siteId)) return d;
          if (!d.siteId && (d.scope === "company" || d.scope === "group")) {
            const shares = await storage.getDocumentShares(d.id);
            const isShared = shares.some(s =>
              (s.entityType === "site" && siteIdArray.includes(s.entityId)) ||
              (s.entityType === "company" && filterCompanyIds.has(s.entityId))
            );
            return isShared ? d : null;
          }
          return null;
        }))).filter((d): d is NonNullable<typeof d> => d !== null);
      }
      
      res.json(filteredDocuments);
    } catch (error) {
      console.error("Documents error:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Authorization: check if user can access this document's site
      const canAccess = await canUserAccessDocument(user, document);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }
      
      // Add shared-link metadata for destination users
      const isSharedLink = !document.siteId && (document.scope === "company" || document.scope === "group") && !(await isDocumentOriginUser(user, document));
      let sharedFromEntityName: string | null = null;
      let companyName: string | null = null;
      if (!document.siteId && document.entityId && (document.scope === "company" || document.scope === "group")) {
        const entityCompany = await storage.getCompany(document.entityId);
        companyName = entityCompany?.name ?? null;
        if (isSharedLink) sharedFromEntityName = companyName;
      }
      
      // Add uploaderRole so the frontend can gate approval buttons correctly
      let uploaderRole: string | undefined;
      if (document.uploadedBy) {
        const uploader = await storage.getUser(document.uploadedBy);
        uploaderRole = uploader?.role ?? undefined;
      }

      res.json({
        ...document,
        uploaderRole,
        isSharedLink,
        sharedScope: isSharedLink ? document.scope : undefined,
        sharedFromEntityName: isSharedLink ? sharedFromEntityName : undefined,
        companyName: companyName ?? (document as any).companyName ?? null,
      });
    } catch (error) {
      console.error("Document error:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Dedicated view-logging endpoint — called once per mount from the frontend
  // so window-focus refetches don't create duplicate "viewed" audit entries.
  app.post("/api/documents/:id/view", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const document = await storage.getDocument(req.params.id);
      if (!document) return res.status(404).json({ error: "Document not found" });
      const canAccess = await canUserAccessDocument(user, document);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      await storage.createAuditLog({
        action: "document_viewed",
        userId: user.id,
        userName: user.fullName,
        entityId: document.siteId || document.entityId,
        documentId: document.id,
        supportRequestId: null,
        module: document.module,
        details: `Viewed ${document.title}`,
        metadata: null,
      });
      // Broadcast so all audit-trail viewers refresh in real time
      emitToAll("document-audit-updated", { documentId: document.id });
      res.json({ ok: true });
    } catch (error) {
      console.error("Document view log error:", error);
      res.status(500).json({ error: "Failed to log view" });
    }
  });

  app.get("/api/documents/:id/versions", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Authorization: check if user can access this document's site
      const canAccess = await canUserAccessDocument(user, document);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }
      
      const versions = await storage.getDocumentVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error("Document versions error:", error);
      res.status(500).json({ error: "Failed to fetch document versions" });
    }
  });

  // Upload new version of a document
  app.post("/api/documents/:id/versions", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only developers and consultants can upload new versions
      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
        return res.status(403).json({ error: "Only developers and consultants can upload new document versions" });
      }
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Authorization: check if user can access this document's site
      const canAccess = await canUserAccessDocument(user, document);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }

      // For company/group scoped docs: only origin users can upload new versions
      if ((document.scope === "company" || document.scope === "group") && !(await isDocumentOriginUser(user, document))) {
        return res.status(403).json({ error: "Only origin users can upload new versions of company or group scoped documents" });
      }
      
      const { fileName, fileUrl, fileSize, mimeType, changeNote, approvalRequestedFrom, autoFinalApproval, onBehalfOfUserId, approvers: approversRaw } = req.body;
      // Support either a single approvalRequestedFrom or an array of approvers
      const approversArray: string[] = Array.isArray(approversRaw) && approversRaw.length > 0
        ? approversRaw
        : (approvalRequestedFrom ? [approvalRequestedFrom] : []);
      const primaryApprover = approversArray[0] ?? null;

      if (!fileName || !fileUrl || !fileSize || !mimeType) {
        return res.status(400).json({ error: "Missing required file information" });
      }

      // Admin on-behalf validation — mirrors the main document upload route
      let versionOnBehalfConsultant: { id: string; fullName: string } | null = null;
      if (user.role === "administrator") {
        if (!onBehalfOfUserId) {
          return res.status(400).json({ error: "An 'approval on behalf of' consultant is required when an Admin uploads a new version." });
        }
        const obUser = await storage.getUser(onBehalfOfUserId);
        if (!obUser || obUser.role !== "consultant") {
          return res.status(400).json({ error: "The selected 'approval on behalf of' user must be a consultant." });
        }
        if (obUser.status !== "active") {
          return res.status(400).json({ error: "The selected 'approval on behalf of' consultant must be an active user." });
        }
        versionOnBehalfConsultant = obUser;
      }

      // Determine approval status BEFORE any DB writes so we can validate early.
      let newStatus: "approval_required" | "compliant" | "approved" = "approval_required";
      let newApprovalStatus: "pending" | null = "pending";

      if (document.templateId) {
        const template = await storage.getDocumentTemplate(document.templateId);
        if (template && template.requiresApproval === false) {
          newStatus = document.isMandatory ? "compliant" : "approved";
          newApprovalStatus = null;
        }
      }

      // Approver is mandatory when the new version will require client approval.
      if (newApprovalStatus === "pending" && approversArray.length === 0) {
        return res.status(400).json({ error: "At least one approver must be selected when uploading a new version that requires approval" });
      }
      
      const newVersionNumber = document.version + 1;
      
      // Determine the archive label for the version being replaced:
      // – if the current document is already approved, archive it as its approved version number (not a draft)
      // – otherwise archive it as the next decimal draft: {approvedVersion}.{draftCount + 1}
      const existingVersionsForLabel = await storage.getDocumentVersions(document.id);
      const existingDraftCount = existingVersionsForLabel.filter(v => v.isDraft).length;
      const isCurrentlyApproved = document.approvalStatus === "approved";
      const archiveVersionLabel = isCurrentlyApproved
        ? `${document.approvedVersion ?? 0}`
        : `${document.approvedVersion ?? 0}.${existingDraftCount + 1}`;
      const archiveIsDraft = !isCurrentlyApproved;

      // Create version record for the current document state (archiving current version)
      await storage.createDocumentVersion({
        documentId: document.id,
        version: document.version,
        versionLabel: archiveVersionLabel,
        isDraft: archiveIsDraft,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        uploadedBy: document.uploadedBy,
        changeNote: changeNote || `Replaced by version ${newVersionNumber}`,
      });
      
      // Update the main document with new file info.
      // For admin on-behalf uploads: uploadedBy = the consultant (nominal owner / sign-off holder),
      // initiatedByUserId = the admin (the one actually driving the approval cycle).
      // For all other uploads: uploadedBy = the uploader, initiatedByUserId = null.
      const resolvedUploadedBy = versionOnBehalfConsultant ? versionOnBehalfConsultant.id : user.id;
      const resolvedInitiatedBy = versionOnBehalfConsultant ? user.id : null;
      const resolvedAutoFinalApproval = typeof autoFinalApproval === "boolean" ? autoFinalApproval : document.autoFinalApproval;
      console.log(`[version-upload] doc=${document.id} autoFinalApproval received=${autoFinalApproval} (${typeof autoFinalApproval}) → saving=${resolvedAutoFinalApproval}`);

      const updatedDocument = await storage.updateDocument(document.id, {
        fileName,
        fileUrl,
        fileSize,
        mimeType,
        version: newVersionNumber,
        status: newStatus,
        approvalStatus: newApprovalStatus,
        uploadedBy: resolvedUploadedBy,
        initiatedByUserId: resolvedInitiatedBy,
        updatedAt: new Date(),
        ...(primaryApprover ? { approvalRequestedFrom: primaryApprover } : { approvalRequestedFrom: null }),
        autoFinalApproval: resolvedAutoFinalApproval,
      });
      
      // Log the version upload
      await storage.createAuditLog({
        action: "document_version_uploaded",
        userId: user.id,
        userName: user.fullName,
        entityId: document.siteId,
        documentId: document.id,
        module: document.module,
        details: `Uploaded version ${newVersionNumber} of "${document.title}"`,
        metadata: JSON.stringify({ 
          previousVersion: document.version, 
          newVersion: newVersionNumber,
          changeNote,
          onBehalfUserName: versionOnBehalfConsultant ? versionOnBehalfConsultant.fullName : null,
        }),
      });

      // If the new version requires approval, notify the designated approver (or
      // fall back to the client who previously signed off / requested changes).
      if (newApprovalStatus === "pending" && document.siteId) {
        try {
          const site = await storage.getSite(document.siteId);
          const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
          const modulePath = document.module === "health_safety" ? "health-safety"
            : document.module === "human_resources" ? "human-resources"
            : document.module === "employment_law" ? "employment-law"
            : "documents";
          const documentUrl = `${baseUrl}/${modulePath}/documents/${document.id}`;

          // Determine who to notify: all designated approvers, or fall back to last
          // sign-off / changes-requested actor from the audit log.
          let notifyUserIds: string[] = approversArray.length > 0 ? [...approversArray] : [];
          if (notifyUserIds.length === 0) {
            const docLogs = await storage.getAuditLogs(document.id);
            const lastSignOff = docLogs.find(l => (l.action === "document_signed_off" || l.action === "changes_requested") && l.userId);
            if (lastSignOff?.userId) notifyUserIds = [lastSignOff.userId];
          }

          const notifiedSet = new Set<string>();
          for (const uid of notifyUserIds) {
            if (notifiedSet.has(uid)) continue;
            notifiedSet.add(uid);
            const notifyUser = await storage.getUser(uid);
            if (notifyUser && notifyUser.email && notifyUser.role === "client" && notifyUser.status === "active") {
              await sendDocumentApprovalEmail({
                to: notifyUser.email,
                fullName: notifyUser.fullName,
                documentTitle: document.title,
                siteName: site?.name || "Unknown Site",
                uploadedBy: user.fullName,
                portalUrl: baseUrl,
                documentUrl,
                role: "client",
              });
              await storage.createAuditLog({
                action: "email_sent",
                userId: user.id,
                userName: user.fullName,
                entityId: document.siteId,
                documentId: document.id,
                supportRequestId: null,
                module: document.module,
                details: `Approval notification email sent to ${notifyUser.fullName} (${notifyUser.email})`,
                metadata: JSON.stringify({ targetUserId: notifyUser.id, emailType: "approval_notification" }),
              });
            }
          }
        } catch (emailErr) {
          console.error("Failed to send version-upload approval notification:", emailErr);
        }
      }

      // Emit document-updated so all relevant users (including clients) see the new version in real time
      try {
        const versionPayload = {
          documentId: document.id,
          siteId: document.siteId,
          entityId: document.entityId,
          approvalStatus: updatedDocument?.approvalStatus,
        };
        await emitDocumentUpdated(document, versionPayload);
        emitToAll("document-audit-updated", { documentId: document.id });
      } catch { /* non-fatal */ }

      res.json(updatedDocument);
    } catch (error) {
      console.error("Upload document version error:", error);
      res.status(500).json({ error: "Failed to upload new document version" });
    }
  });

  app.get("/api/documents/:id/audit", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Authorization: check if user can access this document's site
      const canAccess = await canUserAccessDocument(user, document);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }
      
      const logs = await storage.getAuditLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Audit logs error:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Document download endpoint - returns original uploaded file
  app.get("/api/documents/:id/download", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // If the URL has an 'email' query parameter, verify it matches the logged-in user
      const targetEmail = req.query.email as string;
      if (targetEmail && user.email.toLowerCase() !== targetEmail.toLowerCase()) {
        return res.status(403).json({ 
          error: "This link was intended for a different user. Please ensure you are logged in with the correct account." 
        });
      }
      
      // Authorization: check if user can access this document's site
      const canAccess = await canUserAccessDocument(user, document);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }

      // Check if a specific version is requested
      const requestedVersion = req.query.version ? parseInt(req.query.version as string) : null;
      let fileUrl = document.fileUrl;
      let fileName = document.fileName;
      let mimeType = document.mimeType;

      if (requestedVersion && requestedVersion !== document.version) {
        const versions = await storage.getDocumentVersions(req.params.id);
        const versionInfo = versions.find(v => v.version === requestedVersion);
        if (!versionInfo) {
          return res.status(404).json({ error: "Version not found" });
        }
        fileUrl = versionInfo.fileUrl;
        fileName = versionInfo.fileName;
        mimeType = versionInfo.mimeType;
      }

      if (!fileUrl) {
        return res.status(404).json({ error: "File not available - this document was uploaded before file storage was enabled. Please re-upload the document." });
      }

      await storage.createAuditLog({
        action: "document_downloaded",
        userId: user.id,
        userName: user.fullName,
        entityId: document.siteId,
        documentId: document.id,
        supportRequestId: null,
        module: document.module,
        details: `Downloaded ${document.title}${requestedVersion ? ` (Version ${requestedVersion})` : ''}`,
        metadata: null,
      });

      const objectStorageService = new ObjectStorageService();
      
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(fileUrl);
        await objectStorageService.downloadObject(objectFile, res, 0, fileName);
      } catch (storageError: any) {
        if (storageError.name === 'ObjectNotFoundError') {
          return res.status(404).json({ error: "File not found in storage" });
        }
        throw storageError;
      }
    } catch (error) {
      console.error("Document download error:", error);
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  app.get("/api/documents/:id/preview", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // If the URL has an 'email' query parameter, verify it matches the logged-in user
      const targetEmail = req.query.email as string;
      if (targetEmail && user.email.toLowerCase() !== targetEmail.toLowerCase()) {
        return res.status(403).json({ 
          error: "This link was intended for a different user. Please ensure you are logged in with the correct account." 
        });
      }
      
      const canAccess = await canUserAccessDocument(user, document);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }

      const requestedVersion = req.query.version ? parseInt(req.query.version as string) : null;
      let fileUrl = document.fileUrl;
      let fileName = document.fileName;
      let mimeType = document.mimeType;

      if (requestedVersion && requestedVersion !== document.version) {
        const versions = await storage.getDocumentVersions(req.params.id);
        const versionInfo = versions.find(v => v.version === requestedVersion);
        if (!versionInfo) {
          return res.status(404).json({ error: "Version not found" });
        }
        fileUrl = versionInfo.fileUrl;
        fileName = versionInfo.fileName;
        mimeType = versionInfo.mimeType;
      }

      if (!fileUrl) {
        return res.status(404).json({ error: "File not available - this document was uploaded before file storage was enabled." });
      }

      const objectStorageService = new ObjectStorageService();

      // DOCX — convert via LibreOffice and stream as PDF
      if (mimeType && DOCX_PREVIEW_MIME_TYPES.has(mimeType)) {
        try {
          const pdfBuffer = await getOrConvertDocxPreview(fileUrl, mimeType);
          const pdfName = fileName.replace(/\.(docx?|doc)$/i, ".pdf");
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(pdfName)}"`);
          res.setHeader("Content-Length", pdfBuffer.length.toString());
          return res.end(pdfBuffer);
        } catch (convErr) {
          console.error("DOCX conversion error:", convErr);
          return res.status(422).json({ error: "Unable to convert document to PDF for preview" });
        }
      }
      
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(fileUrl);
        
        res.setHeader("Content-Type", mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
        
        const [metadata] = await objectFile.getMetadata();
        if (metadata.size) {
          res.setHeader("Content-Length", metadata.size.toString());
        }
        
        const readStream = objectFile.createReadStream();
        readStream.pipe(res);
      } catch (storageError: any) {
        if (storageError.name === 'ObjectNotFoundError') {
          return res.status(404).json({ error: "File not found in storage" });
        }
        throw storageError;
      }
    } catch (error) {
      console.error("Document preview error:", error);
      res.status(500).json({ error: "Failed to preview document" });
    }
  });

  // ── Document Template Preview ─────────────────────────────────────────────
  app.get("/api/document-templates/:id/preview", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: "Template not found" });

      if (!template.fileUrl) {
        return res.status(404).json({ error: "No file available for this template" });
      }

      const mimeType = template.mimeType || "";
      const objectStorageService = new ObjectStorageService();

      if (DOCX_PREVIEW_MIME_TYPES.has(mimeType)) {
        try {
          const pdfBuffer = await getOrConvertDocxPreview(template.fileUrl, mimeType);
          const pdfName = template.fileName.replace(/\.(docx?|doc)$/i, ".pdf");
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(pdfName)}"`);
          res.setHeader("Content-Length", pdfBuffer.length.toString());
          return res.end(pdfBuffer);
        } catch (convErr) {
          console.error("Template DOCX conversion error:", convErr);
          return res.status(422).json({ error: "Unable to convert template to PDF for preview" });
        }
      }

      try {
        const objectFile = await objectStorageService.getObjectEntityFile(template.fileUrl);
        res.setHeader("Content-Type", mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(template.fileName)}"`);
        const [metadata] = await objectFile.getMetadata();
        if (metadata.size) res.setHeader("Content-Length", metadata.size.toString());
        objectFile.createReadStream().pipe(res);
      } catch (storageError: any) {
        if (storageError.name === "ObjectNotFoundError") {
          return res.status(404).json({ error: "File not found in storage" });
        }
        throw storageError;
      }
    } catch (error) {
      console.error("Template preview error:", error);
      res.status(500).json({ error: "Failed to preview template" });
    }
  });

  app.post("/api/documents", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const parseResult = createDocumentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
      }
      
      const body = parseResult.data;
      const docScope = body.scope ?? "site";

      // Authorization: for site-scope docs check site access; for company/group scope check admin/consultant
      if (docScope === "site") {
        // Site-scope uploads are restricted to admin and consultant roles only (preserves pre-existing behavior)
        if (user.role === "client") {
          return res.status(403).json({ error: "Client users cannot upload site-scoped documents. Use company or group scope instead." });
        }
        if (!body.siteId) {
          return res.status(400).json({ error: "siteId is required for site-scoped documents" });
        }
        const canAccess = await canUserAccessSite(user, body.siteId);
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied to upload documents to this site" });
        }
      } else {
        // Company/group scope upload:
        //   - Company scope: admins, consultants (with source overlap), full-permission client users of that company
        //   - Group scope: admins, consultants (with source overlap), group-owner company clients
        if (!body.entityId) {
          return res.status(400).json({ error: "entityId (company ID) is required for company/group scoped documents" });
        }
        if (user.role === "client") {
          if (!user.companyId) return res.status(403).json({ error: "Access denied" });
          if (user.clientPermissionRole !== "full") {
            return res.status(403).json({ error: "Full permission required to upload company or group level documents" });
          }
          if (docScope === "group") {
            // Client must belong to the group owner company itself (entityId IS the group owner company)
            if (user.companyId !== body.entityId) {
              return res.status(403).json({ error: "Only users belonging to the group owner company can upload group-scope documents" });
            }
          } else {
            // Company scope: client must belong to the target company
            if (user.companyId !== body.entityId) {
              return res.status(403).json({ error: "You can only upload company-scope documents for your own company" });
            }
          }
        } else if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
          return res.status(403).json({ error: "Only developers, consultants, and full-permission company users can upload company or group level documents" });
        }
        // Validate consultant/admin has source overlap with the target company/group (not blanket access)
        if (user.role === "consultant" || user.role === "administrator") {
          const targetCompany = await storage.getCompany(body.entityId);
          if (!targetCompany) {
            return res.status(400).json({ error: "Target company/group not found" });
          }
          if (hasProPrivileges(user)) {
            // For group-scope upload, pro-consultants must have DIRECT source overlap with the
            // group-owner company itself (not via effective/member sources). Origin-side only.
            const requiredSources = docScope === "group"
              ? (targetCompany.sources ?? [])
              : (targetCompany.sources ?? []);
            if (!sourcesOverlap(user.sources ?? [], requiredSources)) {
              return res.status(403).json({ error: "Your service scope does not cover this company or group" });
            }
          } else {
            // Standard consultant: must be assigned to at least one site in the OWNING company
            // (for group-scope: group owner only, NOT member companies — origin-side only)
            const assignments = await storage.getConsultantSites(user.id!);
            const ownerSites = await storage.getSitesByCompanyId(body.entityId);
            const ownerSiteIds = new Set(ownerSites.map(s => s.id));
            const assignedToOwner = assignments.some(a => ownerSiteIds.has(a.siteId));
            if (!assignedToOwner) {
              return res.status(403).json({ error: "You are not assigned to the owning company for this document" });
            }
            // Must also have direct source overlap with the owning company (not via effective GO sources)
            if (!sourcesOverlap(user.sources ?? [], targetCompany.sources ?? [])) {
              return res.status(403).json({ error: "Your service scope does not cover this company or group" });
            }
          }
        }
      }

      // For group-scope: entityId must be a group owner company
      // (i.e., at least one other company references it as their groupOwnerId).
      // Note: Company.isGroupOwner is a computed field added by listing endpoints,
      // not a DB column, so we must check membership directly.
      if (docScope === "group" && body.entityId) {
        const groupOwnerCompany = await storage.getCompany(body.entityId);
        if (!groupOwnerCompany) {
          return res.status(400).json({ error: "entityId must be a group owner company for group-scoped documents" });
        }
        const groupMembers = await storage.getGroupMembers(body.entityId);
        if (!groupMembers || groupMembers.length === 0) {
          return res.status(400).json({ error: "entityId must be a group owner company for group-scoped documents" });
        }
      }

      // For company/group scope: validate destinations are within allowed hierarchy boundaries
      // An empty (or absent) destinations list is valid — it means company/group-level only with no site push-down
      if (docScope !== "site" && Array.isArray(body.shareDestinations) && body.shareDestinations.length > 0) {
        if (docScope === "company" && body.entityId) {
          const companySites = await storage.getSitesByCompanyId(body.entityId);
          const validSiteIds = new Set(companySites.map(s => s.id));
          const invalid = body.shareDestinations.filter((id: string) => !validSiteIds.has(id));
          if (invalid.length > 0) {
            return res.status(400).json({ error: `Invalid destination sites: must belong to the target company` });
          }
        } else if (docScope === "group" && body.entityId) {
          const memberCompanies = await storage.getGroupMembers(body.entityId);
          const validCompanyIds = new Set(memberCompanies.map(c => c.id));
          const invalid = body.shareDestinations.filter((id: string) => !validCompanyIds.has(id));
          if (invalid.length > 0) {
            return res.status(400).json({ error: `Invalid destination companies: must be member companies of the group owner` });
          }
        }
      }

      // Resolve entityId
      let resolvedEntityId = body.entityId || null;
      if (!resolvedEntityId && body.siteId) {
        const siteForEntity = await storage.getSite(body.siteId);
        resolvedEntityId = siteForEntity?.companyId ?? null;
      }
      if (!resolvedEntityId) {
        return res.status(400).json({ error: "Could not resolve company (entityId) for this document" });
      }
      
      // Check if approval is required
      let documentStatus: "approval_required" | "compliant" | "approved" = "approval_required";
      let documentApprovalStatus: string = "pending";
      let isAutoApproved = false;
      
      // Training certificates are automatically compliant - they prove completion
      if (body.module === "training") {
        documentStatus = "compliant";
        documentApprovalStatus = "approved";
        isAutoApproved = true;
      } else if (body.requiresApproval === false) {
        // Uploader explicitly set no approval required
        documentStatus = body.isMandatory ? "compliant" : "approved";
        documentApprovalStatus = "approved";
        isAutoApproved = true;
      } else if (body.templateId) {
        const template = await storage.getDocumentTemplate(body.templateId);
        if (template && template.requiresApproval === false) {
          // Template doesn't require approval — required docs → compliant, non-required → approved
          const effectiveIsRequired = body.isMandatory ?? template.isMandatory ?? false;
          documentStatus = effectiveIsRequired ? "compliant" : "approved";
          documentApprovalStatus = "approved";
          isAutoApproved = true;
        }
      }

      // Renewal date is only calculated when the document is approved.
      // For auto-approved docs (no approval workflow) approval time = now.
      // For pending docs, renewalDate remains null until they are approved.
      const autoApprovalTime = isAutoApproved ? new Date() : null;
      const renewalPeriodMonths = body.renewalPeriodMonths ?? null;
      let computedRenewalDate: Date | null = null;
      if (autoApprovalTime && renewalPeriodMonths) {
        computedRenewalDate = new Date(autoApprovalTime);
        computedRenewalDate.setMonth(computedRenewalDate.getMonth() + renewalPeriodMonths);
      }

      // Admin "approval on behalf of" resolution:
      // When an Admin uploads a document that needs approval, they cannot personally own the
      // sign-off. They must nominate a consultant who becomes the document owner (uploadedBy),
      // so the standard consultant-uploaded approval workflow (client sign-off → consultant final
      // approval) applies unchanged. The admin is recorded as the initiator for dual notification
      // and audit. Auto-approved uploads (training / requiresApproval=false) keep the admin owner.
      let resolvedUploadedBy = user.id;
      let resolvedInitiatedBy: string | null = null;
      let onBehalfConsultant: Awaited<ReturnType<typeof storage.getUser>> | null = null;
      if (user.role === "administrator" && documentStatus === "approval_required") {
        if (!body.onBehalfOfUserId) {
          return res.status(400).json({ error: "An 'approval on behalf of' consultant is required when an Admin uploads a document that needs approval." });
        }
        onBehalfConsultant = await storage.getUser(body.onBehalfOfUserId);
        if (!onBehalfConsultant || onBehalfConsultant.role !== "consultant") {
          return res.status(400).json({ error: "The selected 'approval on behalf of' user must be a consultant." });
        }
        if (onBehalfConsultant.status !== "active") {
          return res.status(400).json({ error: "The selected 'approval on behalf of' consultant must be an active user." });
        }
        // Enforce eligibility server-side (never trust the client list): the nominated
        // consultant must actually be able to own sign-off for this document's target —
        // assigned to the site, or pro-by-source for the company/group.
        let onBehalfEligible = false;
        if (docScope === "site" && body.siteId) {
          onBehalfEligible = await canUserAccessSite(onBehalfConsultant, body.siteId);
        } else if ((docScope === "company" || docScope === "group") && resolvedEntityId) {
          onBehalfEligible = await isDocumentOriginUser(onBehalfConsultant, {
            scope: docScope,
            entityId: resolvedEntityId,
            siteId: null,
          });
        }
        if (!onBehalfEligible) {
          return res.status(400).json({ error: "The selected consultant is not eligible to sign off for the chosen site or company." });
        }
        resolvedUploadedBy = onBehalfConsultant.id;
        resolvedInitiatedBy = user.id;
      }

      const document = await storage.createDocument({
        title: body.title,
        comments: body.comments || null,
        module: body.module,
        type: body.type as any,
        documentTypeId: body.documentTypeId || null,
        entityId: resolvedEntityId,
        siteId: docScope === "site" ? (body.siteId ?? null) : null,
        scope: docScope,
        folderId: body.folderId || null,
        caseId: body.caseId || null,
        fileName: body.fileName,
        fileUrl: body.fileUrl || null,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
        version: 1,
        status: documentStatus,
        approvalStatus: documentApprovalStatus,
        approvalRequestedFrom: body.approvalRequestedFrom ?? body.notifyUserIds?.[0] ?? null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        lastApprovedAt: autoApprovalTime,
        uploadedBy: resolvedUploadedBy,
        initiatedByUserId: resolvedInitiatedBy,
        isArchived: false,
        isMandatory: body.isMandatory || false,
        source: body.source || "upload",
        templateId: body.templateId || null,
        templateVersion: body.templateVersion ?? null,
        // Training certificate fields
        trainingCourseTitle: body.trainingCourseTitle || null,
        trainingCourseCode: body.trainingCourseCode || null,
        trainingDate: body.trainingDate ? new Date(body.trainingDate) : null,
        renewalDate: computedRenewalDate,
        renewalPeriodMonths,
        autoFinalApproval: body.autoFinalApproval ?? false,
      });

      await storage.createAuditLog({
        action: "document_uploaded",
        userId: user.id,
        userName: user.fullName,
        entityId: document.siteId || document.entityId,
        documentId: document.id,
        supportRequestId: null,
        module: body.module,
        details: `Uploaded ${body.title}${docScope !== "site" ? ` (${docScope}-level document)` : ""}${onBehalfConsultant ? ` on behalf of ${onBehalfConsultant.fullName}` : ""}`,
        metadata: docScope !== "site" || resolvedInitiatedBy
          ? JSON.stringify({
              ...(docScope !== "site" ? { scope: docScope, entityId: resolvedEntityId } : {}),
              ...(resolvedInitiatedBy ? {
                initiatedByUserId: resolvedInitiatedBy,
                onBehalfOfUserId: resolvedUploadedBy,
                onBehalfUserName: onBehalfConsultant?.fullName ?? null,
              } : {}),
            })
          : null,
      });

      // Create explicit share records for company/group scoped documents
      if (docScope !== "site" && Array.isArray(body.shareDestinations) && body.shareDestinations.length > 0) {
        const entityType = docScope === "company" ? "site" : "company";
        await Promise.all(body.shareDestinations.map((destId: string) =>
          storage.createDocumentShare({ documentId: document.id, entityType: entityType as "site" | "company", entityId: destId })
        ));
      }

      // Send approval notification emails if document requires approval.
      // Use notifyUserIds if provided; fall back to approvalRequestedFrom so that
      // the email fires even if the frontend only sent one of the two fields.
      const effectiveNotifyIds: string[] = body.notifyUserIds?.length
        ? body.notifyUserIds
        : body.approvalRequestedFrom
          ? [body.approvalRequestedFrom]
          : [];
      if (documentStatus === "approval_required" && effectiveNotifyIds.length > 0) {
        const site = body.siteId ? await storage.getSite(body.siteId) : null;
        const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
        
        for (const notifyUserId of effectiveNotifyIds) {
          try {
            const notifyUser = await storage.getUser(notifyUserId);
            if (notifyUser && notifyUser.email) {
              const modulePath = body.module === "health_safety" ? "health-safety" 
                : body.module === "human_resources" ? "human-resources" 
                : body.module === "employment_law" ? "employment-law" 
                : "documents";
              const documentUrl = `${baseUrl}/${modulePath}/documents/${document.id}`;
              await sendDocumentApprovalEmail({
                to: notifyUser.email,
                fullName: notifyUser.fullName,
                documentTitle: body.title,
                siteName: site?.name || "Unknown Site",
                uploadedBy: user.fullName,
                portalUrl: baseUrl,
                documentUrl,
                role: notifyUser.role,
              });
              await storage.createAuditLog({
                action: "email_sent",
                userId: user.id,
                userName: user.fullName,
                entityId: document.siteId || document.entityId,
                documentId: document.id,
                supportRequestId: null,
                module: body.module,
                details: `Approval notification email sent to ${notifyUser.fullName} (${notifyUser.email})`,
                metadata: JSON.stringify({ targetUserId: notifyUser.id, emailType: "approval_notification" }),
              });
            }
          } catch (emailError) {
            console.error(`Failed to send approval notification to user ${notifyUserId}:`, emailError);
          }
        }
      }

      // Emit document-uploaded so all relevant users see new documents in real time
      try {
        const uploadPayload = { documentId: document.id, siteId: document.siteId };
        const companiesEmittedUpload = new Set<string>();
        if (document.entityId) {
          emitToCompany(document.entityId, "document-uploaded", uploadPayload);
          companiesEmittedUpload.add(document.entityId);
          // Also notify group owner if this company is a member (company-scope docs skip the siteId block)
          const entityCompany = await storage.getCompany(document.entityId).catch(() => null);
          if (entityCompany?.groupOwnerId && !companiesEmittedUpload.has(entityCompany.groupOwnerId)) {
            emitToCompany(entityCompany.groupOwnerId, "document-uploaded", uploadPayload);
            companiesEmittedUpload.add(entityCompany.groupOwnerId);
          }
        }
        if (document.siteId) {
          const uploadSite = await storage.getSite(document.siteId).catch(() => null);
          if (uploadSite?.companyId && !companiesEmittedUpload.has(uploadSite.companyId)) {
            emitToCompany(uploadSite.companyId, "document-uploaded", uploadPayload);
            companiesEmittedUpload.add(uploadSite.companyId);
          }
          // Notify cross-company clients directly assigned to this site
          const assignedUpload = await pool.query<{ client_id: string }>(
            `SELECT client_id FROM client_site_assignments WHERE site_id = $1`,
            [document.siteId]
          ).catch(() => ({ rows: [] as { client_id: string }[] }));
          for (const row of assignedUpload.rows) {
            emitToUser(row.client_id, "document-uploaded", uploadPayload);
          }
          // Also notify group owner companies
          for (const cId of Array.from(companiesEmittedUpload)) {
            const uploadCompany = await storage.getCompany(cId).catch(() => null);
            if (uploadCompany?.groupOwnerId && !companiesEmittedUpload.has(uploadCompany.groupOwnerId)) {
              emitToCompany(uploadCompany.groupOwnerId, "document-uploaded", uploadPayload);
              companiesEmittedUpload.add(uploadCompany.groupOwnerId);
            }
          }
        }
        emitToRole("developer", "document-uploaded", uploadPayload);
        emitToRole("consultant", "document-uploaded", uploadPayload);
      } catch { /* non-fatal */ }

      res.status(201).json(document);
    } catch (error) {
      console.error("Create document error:", error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  // Document shares endpoints
  app.get("/api/documents/:id/shares", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const doc = await storage.getDocument(req.params.id);
      if (!doc) return res.status(404).json({ error: "Document not found" });
      // Shares only exist for company/group scoped documents
      if (doc.scope !== "company" && doc.scope !== "group") {
        return res.status(400).json({ error: "Shares are only applicable to company or group scoped documents" });
      }
      const canAccess = await canUserAccessDocument(user, doc);
      if (!canAccess) return res.status(403).json({ error: "Access denied to this document" });
      // Only origin users (admin, consultant, or owning-company client) can view shares
      if (!(await isDocumentOriginUser(user, doc))) {
        return res.status(403).json({ error: "Only origin users can view share details" });
      }
      const shares = await storage.getDocumentShares(req.params.id);
      // Enrich with entity names
      const enriched = await Promise.all(shares.map(async (s) => {
        let name: string | null = null;
        if (s.entityType === "site") {
          const site = await storage.getSite(s.entityId);
          name = site?.name ?? null;
        } else if (s.entityType === "company") {
          const company = await storage.getCompany(s.entityId);
          name = company?.name ?? null;
        }
        return { ...s, entityName: name };
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document shares" });
    }
  });

  app.post("/api/documents/:id/shares", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const doc = await storage.getDocument(req.params.id);
      if (!doc) return res.status(404).json({ error: "Document not found" });
      // Shares only exist for company/group scoped documents
      if (doc.scope !== "company" && doc.scope !== "group") {
        return res.status(400).json({ error: "Shares are only applicable to company or group scoped documents" });
      }
      const canAccess = await canUserAccessDocument(user, doc);
      if (!canAccess) return res.status(403).json({ error: "Access denied to this document" });
      if (!(await isDocumentOriginUser(user, doc))) {
        return res.status(403).json({ error: "Only origin users can manage shares" });
      }
      const { entityType, entityId } = req.body;
      if (!entityType || !entityId) {
        return res.status(400).json({ error: "entityType and entityId are required" });
      }
      // Strict entityType validation
      if (!["site", "company"].includes(entityType)) {
        return res.status(400).json({ error: "entityType must be 'site' or 'company'" });
      }
      // Validate destination is within allowed hierarchy boundary
      if (doc.scope === "company" && doc.entityId) {
        if (entityType !== "site") return res.status(400).json({ error: "Company-scope shares must target sites" });
        const site = await storage.getSite(entityId);
        if (!site || site.companyId !== doc.entityId) {
          return res.status(400).json({ error: "Destination site must belong to the document's company" });
        }
      } else if (doc.scope === "group" && doc.entityId) {
        if (entityType !== "company") return res.status(400).json({ error: "Group-scope shares must target companies" });
        const targetCompany = await storage.getCompany(entityId);
        if (!targetCompany || targetCompany.groupOwnerId !== doc.entityId) {
          return res.status(400).json({ error: "Destination company must be a member of the group owner" });
        }
      }
      // Check for duplicate share
      const existingShares = await storage.getDocumentShares(req.params.id);
      const alreadyShared = existingShares.some(s => s.entityType === entityType && s.entityId === entityId);
      if (alreadyShared) {
        return res.status(409).json({ error: "This document is already shared to the specified destination" });
      }
      const share = await storage.createDocumentShare({ documentId: req.params.id, entityType, entityId });
      res.status(201).json(share);
    } catch (error) {
      res.status(500).json({ error: "Failed to create document share" });
    }
  });

  app.delete("/api/documents/:id/shares/:entityId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const doc = await storage.getDocument(req.params.id);
      if (!doc) return res.status(404).json({ error: "Document not found" });
      // Shares only exist for company/group scoped documents
      if (doc.scope !== "company" && doc.scope !== "group") {
        return res.status(400).json({ error: "Shares are only applicable to company or group scoped documents" });
      }
      const canAccess = await canUserAccessDocument(user, doc);
      if (!canAccess) return res.status(403).json({ error: "Access denied to this document" });
      if (!(await isDocumentOriginUser(user, doc))) {
        return res.status(403).json({ error: "Only origin users can manage shares" });
      }
      // Validate entityType query param
      const { entityType } = req.query;
      if (!entityType || !["site", "company"].includes(entityType as string)) {
        return res.status(400).json({ error: "entityType query param must be 'site' or 'company'" });
      }
      // Verify the share actually exists before deleting
      const currentShares = await storage.getDocumentShares(req.params.id);
      const shareExists = currentShares.some(s => s.entityId === req.params.entityId && s.entityType === entityType);
      if (!shareExists) {
        return res.status(404).json({ error: "Share not found" });
      }
      // Block deleting the last share (doc would become invisible)
      if (currentShares.length <= 1) {
        return res.status(400).json({ error: "Cannot remove the last share destination. A company or group-scoped document must be shared to at least one destination. Delete the document or change its scope instead." });
      }
      await storage.deleteDocumentShare(req.params.id, entityType as string, req.params.entityId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document share" });
    }
  });

  app.post("/api/documents/:id/approval", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const parseResult = approvalSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
      }
      
      const { action, feedback } = parseResult.data;
      const documentId = req.params.id;

      const existingDoc = await storage.getDocument(documentId);
      if (!existingDoc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Authorization: check if user can access this document's site
      const canAccess = await canUserAccessDocument(user, existingDoc);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }

      // For company/group scoped docs: only origin-level users can approve
      // Destination clients (share recipients, not the owning company) cannot approve
      if ((existingDoc.scope === "company" || existingDoc.scope === "group") && !(await isDocumentOriginUser(user, existingDoc))) {
        return res.status(403).json({ error: "Approval must be performed at the source document level. Shared-link recipients cannot approve." });
      }
      
      // Three-stage approval workflow for consultant-uploaded documents:
      // 1. Consultant uploads → status: "pending" (awaiting client sign-off)
      // 2. Client signs off → status: "client_signed_off" (awaiting consultant final approval)
      // 3. Consultant final approves → status: "approved" (triggers renewal date)
      //
      // Two-stage workflow for client-uploaded documents:
      // 1. Client uploads → status: "pending"
      // 2. Consultant/admin approves → status: "approved" (triggers renewal date)
      
      const uploader = await storage.getUser(existingDoc.uploadedBy);
      
      // If uploader not found, block approval for safety (can't determine workflow)
      if (!uploader) {
        return res.status(403).json({ error: "Cannot determine document uploader. Approval blocked for safety." });
      }
      
      const uploaderRole = uploader.role;
      const currentApprovalStatus = existingDoc.approvalStatus;
      
      // Determine what kind of approval action this is
      let isClientSignOff = false; // Client signing off on consultant-uploaded doc
      let isConsultantFinalApproval = false; // Consultant final approving after client sign-off
      let isConsultantApprovalOfClientDoc = false; // Consultant approving client-uploaded doc
      
      if (user.role === "client") {
        // For company/group scoped docs: full-permission origin-entity clients can directly approve
        // (regardless of who uploaded, since origin-entity sign-off is the authoritative action)

        // Check if user is Group Primary Contact acting on a member company's document
        let isGroupPrimaryContactForDoc = false;
        if (user.companyId && user.id && existingDoc.entityId &&
            user.companyId !== existingDoc.entityId &&
            (existingDoc.scope === "company" || existingDoc.scope === "group")) {
          const userCompanyForApproval = await storage.getCompany(user.companyId);
          if (userCompanyForApproval?.contactUserId === user.id) {
            const groupMembersForApproval = await storage.getGroupMembers(user.companyId);
            isGroupPrimaryContactForDoc = groupMembersForApproval.some(m => m.id === existingDoc.entityId);
          }
        }

        const isScopedOriginClient = (existingDoc.scope === "company" || existingDoc.scope === "group")
          && (
            (user.companyId === existingDoc.entityId && user.clientPermissionRole === "full") ||
            isGroupPrimaryContactForDoc
          );
        
        if (!isScopedOriginClient) {
          // Clients can only sign off on consultant/admin-uploaded documents
        }
        
        // Document must be pending for client sign-off or direct approval
        if (currentApprovalStatus !== "pending") {
          return res.status(400).json({ error: "This document is not awaiting your sign-off" });
        }

        // Enforce designated approver: only the notified person may sign off
        if (existingDoc.approvalRequestedFrom && existingDoc.approvalRequestedFrom !== user.id) {
          return res.status(403).json({ error: "This document was sent to a specific approver. Only that person can sign off on it." });
        }
        
        // Check if client has approval permission (owner or approver role)
        // Group Primary Contacts bypass the permission-role check — their group ownership grants approval rights
        if (!isGroupPrimaryContactForDoc) {
          if (!user.clientPermissionRole) {
            return res.status(403).json({ error: "You don't have permission to approve documents. Contact your administrator." });
          }
          const capabilities = getClientCapabilities(user.clientPermissionRole);
          if (!capabilities.canApproveDocuments) {
            return res.status(403).json({ error: "You don't have permission to approve documents. Contact your administrator." });
          }
        }
        
        // Scoped-doc origin client approval is a direct approval (no consultant countersign needed)
        if (isScopedOriginClient) {
          isConsultantApprovalOfClientDoc = true; // reuse "direct approval" path to set status to "approved"
        } else {
          isClientSignOff = true;
        }
      } else {
        // Administrators are never eligible approvers and can never personally sign off.
        // The consultant who owns the document (uploadedBy) must perform the final approval.
        if (user.role === "administrator") {
          return res.status(403).json({ error: "Admins cannot approve or sign off documents. The consultant who owns this document must sign it off." });
        }
        // Consultants — documents are always uploaded by consultants/admins
        // Check if it's awaiting final approval (client already signed off)
        if (currentApprovalStatus === "client_signed_off") {
          isConsultantFinalApproval = true;
        } else if (currentApprovalStatus === "pending") {
          return res.status(400).json({ 
            error: "Cannot approve yet - client sign-off required",
            message: "This document was uploaded by a consultant and requires client sign-off before final approval. The client must review and sign off on the document first, then you can give final approval."
          });
        } else {
          return res.status(400).json({ error: "This document is not awaiting approval" });
        }
      }

      let approvalStatus: "approved" | "changes_requested" | "client_signed_off";
      let documentStatus: "compliant" | "approval_required" | "overdue" | "approved";
      let auditAction: "document_approved" | "changes_requested" | "document_signed_off";

      // When autoFinalApproval is enabled and the client is signing off with
      // approval (not requesting changes), treat it as an immediate final
      // approval — bypass the consultant step. Must gate on action === "approve"
      // so that a changes_requested submission never triggers the auto-approval
      // email path even if the doc has autoFinalApproval enabled.
      const isAutoFinalApproval = isClientSignOff && existingDoc.autoFinalApproval === true && action === "approve";

      switch (action) {
        case "approve":
          if (isClientSignOff && !isAutoFinalApproval) {
            // Client sign-off: move to awaiting consultant final approval
            approvalStatus = "client_signed_off";
            documentStatus = "approval_required"; // Still needs final approval
            auditAction = "document_signed_off";
          } else {
            // Consultant final approval, direct approval of client doc, or auto-final on client sign-off
            // Required docs → compliant; non-required docs → approved
            approvalStatus = "approved";
            documentStatus = existingDoc.isMandatory ? "compliant" : "approved";
            auditAction = isAutoFinalApproval ? "document_signed_off" : "document_approved";
          }
          break;
        case "changes":
          approvalStatus = "changes_requested";
          documentStatus = "approval_required";
          auditAction = "changes_requested";
          break;
        default:
          return res.status(400).json({ error: "Invalid action" });
      }

      // Calculate renewal date for final approvals (consultant or auto-final on client sign-off)
      let lastApprovedAt: Date | undefined;
      let renewalDate: Date | undefined;
      
      const isFinalApproval = action === "approve" && (isConsultantFinalApproval || isConsultantApprovalOfClientDoc || isAutoFinalApproval);
      if (isFinalApproval) {
        lastApprovedAt = new Date();
        
        // Determine renewal period: document's own setting takes priority over template's
        let effectiveRenewalPeriodMonths: number | null = existingDoc.renewalPeriodMonths ?? null;
        if (!effectiveRenewalPeriodMonths && existingDoc.templateId) {
          const template = await storage.getDocumentTemplate(existingDoc.templateId);
          effectiveRenewalPeriodMonths = template?.renewalPeriodMonths ?? null;
        }

        if (effectiveRenewalPeriodMonths) {
          renewalDate = new Date(lastApprovedAt);
          renewalDate.setMonth(renewalDate.getMonth() + effectiveRenewalPeriodMonths);
        }
      }

      const document = await storage.updateDocument(documentId, {
        approvalStatus,
        status: documentStatus,
        ...(lastApprovedAt && { lastApprovedAt }),
        ...(renewalDate && { renewalDate }),
        ...(isFinalApproval && { approvedVersion: (existingDoc.approvedVersion ?? 0) + 1 }),
        // Clear the designated approver once client has signed off — the next stage is consultant-only
        ...(isClientSignOff && { approvalRequestedFrom: null }),
      });

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // On final approval: purge all draft version history — only approved snapshots remain
      if (isFinalApproval) {
        await storage.deleteDocumentDraftVersions(documentId);
      }

      await storage.createAuditLog({
        action: auditAction,
        userId: user.id,
        userName: user.fullName,
        entityId: document.siteId || document.entityId,
        documentId: document.id,
        supportRequestId: null,
        module: existingDoc.module,
        details: feedback || (action === "approve" ? "Document approved" : "Changes requested"),
        metadata: null,
      });

      // Only send sign-off / auto-approval emails when the client actually
      // signed off (action === "approve"). When the client requests changes
      // (action === "changes") the changes-requested block below handles
      // notification — sending a sign-off email would be incorrect.
      if (isClientSignOff && document.siteId && action === "approve") {
        try {
          const site = await storage.getSite(document.siteId);
          const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
          const modulePath = existingDoc.module === "health_safety" ? "health-safety" 
            : existingDoc.module === "human_resources" ? "human-resources" 
            : existingDoc.module === "employment_law" ? "employment-law" 
            : "documents";
          const documentUrl = `${baseUrl}/${modulePath}/documents/${document.id}`;

          const notifiedUserIds = new Set<string>();

          const uploader = existingDoc.uploadedBy
            ? await storage.getUser(existingDoc.uploadedBy)
            : null;

          if (isAutoFinalApproval) {
            // ── Auto-final-approval path ──────────────────────────────────────
            // Document is already fully approved. Notify the consultant/admin
            // as an FYI — no action needed from them.
            const sendAutoNotifTo = async (target: { id: string; email: string | null; fullName: string; role: string | null }, label: string) => {
              if (!target.email) return false;
              if (notifiedUserIds.has(target.id)) return true;
              try {
                await sendAutoApprovedNotificationEmail({
                  to: target.email,
                  fullName: target.fullName,
                  documentTitle: existingDoc.title,
                  siteName: site?.name || "Unknown Site",
                  clientName: user.fullName,
                  documentUrl,
                  comments: feedback || null,
                  role: target.role || "consultant",
                });
                notifiedUserIds.add(target.id);
                await storage.createAuditLog({
                  action: "email_sent",
                  userId: user.id,
                  userName: user.fullName,
                  entityId: document.siteId,
                  documentId: document.id,
                  supportRequestId: null,
                  module: existingDoc.module,
                  details: `Auto-approval notification email sent to ${target.fullName} (${target.email})`,
                  metadata: JSON.stringify({ targetUserId: target.id, emailType: "auto_approval_notification" }),
                });
                return true;
              } catch (emailError) {
                console.error(`Failed to send auto-approval notification to ${label} ${target.id}:`, emailError);
                return false;
              }
            };

            // Step 1: notify the uploading consultant.
            if (uploader && uploader.email && uploader.role === "consultant") {
              await sendAutoNotifTo(uploader, "consultant");
            }

            // Step 1b: if an Admin initiated this upload on the consultant's behalf, notify them too.
            if (existingDoc.initiatedByUserId) {
              const initiator = await storage.getUser(existingDoc.initiatedByUserId);
              if (initiator && initiator.email) {
                await sendAutoNotifTo(initiator, "admin");
              }
            }

            // Step 2: assigned pro consultants if uploader wasn't reached.
            if (notifiedUserIds.size === 0) {
              try {
                const assignments = await storage.getConsultantAssignments(document.siteId);
                const assignedConsultants = await Promise.all(
                  assignments.map(a => storage.getUser(a.consultantId))
                );
                const proConsultants = assignedConsultants.filter(
                  (u): u is NonNullable<typeof u> =>
                    !!u && u.role === "consultant" && u.consultantTier === "pro" && !!u.email && u.status === "active"
                );
                for (const pc of proConsultants) {
                  await sendAutoNotifTo(pc, "assigned pro consultant");
                }
              } catch (err) {
                console.error("Failed to look up assigned pro consultants for auto-approval notification:", err);
              }
            }

            // Step 3: fall back to first admin only.
            if (notifiedUserIds.size === 0) {
              const allUsers = await storage.getAllUsers();
              const admins = allUsers.filter(u => u.role === "developer" && u.email && u.status === "active");
              for (const admin of admins) {
                const sent = await sendAutoNotifTo(admin, "developer");
                if (sent) break; // notify exactly one
              }
            }
          } else {
            // ── Standard client sign-off path ─────────────────────────────────
            // Document is awaiting consultant final approval. Notify them to act.
            const sendSignOffTo = async (target: { id: string; email: string | null; fullName: string; role: string | null }, label: string) => {
              if (!target.email) return false;
              if (notifiedUserIds.has(target.id)) return true;
              try {
                await sendClientSignOffEmail({
                  to: target.email,
                  fullName: target.fullName,
                  documentTitle: existingDoc.title,
                  siteName: site?.name || "Unknown Site",
                  clientName: user.fullName,
                  documentUrl,
                  comments: feedback || null,
                  role: target.role || "consultant",
                });
                notifiedUserIds.add(target.id);
                await storage.createAuditLog({
                  action: "email_sent",
                  userId: user.id,
                  userName: user.fullName,
                  entityId: document.siteId,
                  documentId: document.id,
                  supportRequestId: null,
                  module: existingDoc.module,
                  details: `Client sign-off notification email sent to ${target.fullName} (${target.email})`,
                  metadata: JSON.stringify({ targetUserId: target.id, emailType: "sign_off_notification" }),
                });
                return true;
              } catch (emailError) {
                console.error(`Failed to send sign-off notification to ${label} ${target.id}:`, emailError);
                return false;
              }
            };

            // Step 1: notify the uploading consultant (if applicable).
            if (uploader && uploader.email && uploader.role === "consultant") {
              await sendSignOffTo(uploader, "consultant");
            }

            // Step 1b: if an Admin initiated this upload on the consultant's behalf, notify them too.
            if (existingDoc.initiatedByUserId) {
              const initiator = await storage.getUser(existingDoc.initiatedByUserId);
              if (initiator && initiator.email) {
                await sendSignOffTo(initiator, "admin");
              }
            }

            // Step 2: notify any Pro consultant assigned to the site.
            if (notifiedUserIds.size === 0) {
              try {
                const assignments = await storage.getConsultantAssignments(document.siteId);
                const assignedConsultants = await Promise.all(
                  assignments.map(a => storage.getUser(a.consultantId))
                );
                const proConsultants = assignedConsultants.filter(
                  (u): u is NonNullable<typeof u> =>
                    !!u && u.role === "consultant" && u.consultantTier === "pro" && !!u.email && u.status === "active"
                );
                for (const pc of proConsultants) {
                  const sent = await sendSignOffTo(pc, "assigned pro consultant");
                  if (sent) break; // notify exactly one
                }
              } catch (err) {
                console.error("Failed to look up assigned pro consultants for sign-off notification:", err);
              }
            }

            // Step 3: only escalate to first admin if no consultant was notified.
            if (notifiedUserIds.size === 0) {
              const allUsers = await storage.getAllUsers();
              const admins = allUsers.filter(u => u.role === "developer" && u.email && u.status === "active");
              for (const admin of admins) {
                try {
                  await sendClientSignOffEmail({
                    to: admin.email!,
                    fullName: admin.fullName,
                    documentTitle: existingDoc.title,
                    siteName: site?.name || "Unknown Site",
                    clientName: user.fullName,
                    documentUrl,
                    noConsultantAssigned: true,
                    comments: feedback || null,
                    role: "developer",
                  });
                  await storage.createAuditLog({
                    action: "email_sent",
                    userId: user.id,
                    userName: user.fullName,
                    entityId: document.siteId,
                    documentId: document.id,
                    supportRequestId: null,
                    module: existingDoc.module,
                    details: `Client sign-off notification email sent to admin ${admin.fullName} (${admin.email}) - no consultant assigned to site`,
                    metadata: JSON.stringify({ targetUserId: admin.id, emailType: "sign_off_notification" }),
                  });
                  break; // notify exactly one
                } catch (emailError) {
                  console.error(`Failed to send sign-off notification to admin ${admin.id}:`, emailError);
                }
              }
            }
          }
        } catch (err) {
          console.error("Failed to send client sign-off notifications:", err);
        }
      }

      // Send approval confirmation email to the client who signed off
      // Skip for auto-final approval — the client triggered it themselves; consultant is already notified separately
      if (isFinalApproval && !isAutoFinalApproval && document.siteId) {
        try {
          const site = await storage.getSite(document.siteId);
          const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
          const modulePath = existingDoc.module === "health_safety" ? "health-safety"
            : existingDoc.module === "human_resources" ? "human-resources"
            : existingDoc.module === "employment_law" ? "employment-law"
            : "documents";
          const documentUrl = `${baseUrl}/${modulePath}/documents/${document.id}`;

          // Find the client who signed off via the audit log
          const docLogs = await storage.getAuditLogs(document.id);
          const signOffEntry = docLogs.find(l => l.action === "document_signed_off" && l.userId);
          const signOffClient = signOffEntry?.userId ? await storage.getUser(signOffEntry.userId) : null;

          // Only notify the client who signed off — no blast to all site clients
          const approvedRecipients = (signOffClient && signOffClient.email && signOffClient.status === "active")
            ? [signOffClient]
            : [];

          for (const client of approvedRecipients) {
            try {
              await sendDocumentApprovedEmail({
                to: client.email!,
                fullName: client.fullName,
                documentTitle: existingDoc.title,
                siteName: site?.name || "Unknown Site",
                isMandatory: !!existingDoc.isMandatory,
                documentUrl,
                approvedBy: user.fullName,
                comments: feedback || null,
                role: "client",
              });
              await storage.createAuditLog({
                action: "email_sent",
                userId: user.id,
                userName: user.fullName,
                entityId: document.siteId,
                documentId: document.id,
                supportRequestId: null,
                module: existingDoc.module,
                details: `Document approved notification email sent to client ${client.fullName} (${client.email})`,
                metadata: JSON.stringify({ targetUserId: client.id, emailType: "document_approved_notification" }),
              });
            } catch (emailError) {
              console.error(`Failed to send approval notification to client ${client.id}:`, emailError);
            }
          }
        } catch (err) {
          console.error("Failed to send document approved notifications:", err);
        }
      }

      // Send changes-requested notification.
      // Works for both site-scoped (siteId set) and company/group-scoped (siteId null, entityId set) docs.
      if (action === "changes" && (document.siteId || document.entityId)) {
        try {
          const site = document.siteId ? await storage.getSite(document.siteId) : null;
          // For company-scoped docs fall back to company name as the "site" label in emails.
          let siteName = site?.name || "Unknown Site";
          if (!site && document.entityId) {
            const entityCompany = await storage.getCompany(document.entityId).catch(() => null);
            if (entityCompany?.name) siteName = entityCompany.name;
          }
          const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
          const modulePath = existingDoc.module === "health_safety" ? "health-safety"
            : existingDoc.module === "human_resources" ? "human-resources"
            : existingDoc.module === "employment_law" ? "employment-law"
            : "documents";
          const documentUrl = `${baseUrl}/${modulePath}/documents/${document.id}`;
          const notifEntityId = document.siteId || document.entityId;
          const changesNotifiedIds = new Set<string>();

          if (user.role === "consultant" || user.role === "developer") {
            // Consultant/admin requested changes → notify the client who signed off
            const docLogsForChanges = await storage.getAuditLogs(document.id);
            const signOffEntryForChanges = docLogsForChanges.find(l => l.action === "document_signed_off" && l.userId);
            const signOffClientForChanges = signOffEntryForChanges?.userId ? await storage.getUser(signOffEntryForChanges.userId) : null;
            // Only notify the client who signed off — no blast to all site clients
            const changesRecipients = (signOffClientForChanges && signOffClientForChanges.email && signOffClientForChanges.status === "active")
              ? [signOffClientForChanges]
              : [];

            for (const client of changesRecipients) {
              try {
                await sendChangesRequestedEmail({
                  to: client.email!,
                  fullName: client.fullName,
                  documentTitle: existingDoc.title,
                  siteName,
                  requestedBy: user.fullName,
                  comments: feedback || null,
                  documentUrl,
                  role: "client",
                });
                changesNotifiedIds.add(client.id);
                await storage.createAuditLog({
                  action: "email_sent",
                  userId: user.id,
                  userName: user.fullName,
                  entityId: notifEntityId,
                  documentId: document.id,
                  supportRequestId: null,
                  module: existingDoc.module,
                  details: `Changes-requested notification email sent to client ${client.fullName} (${client.email})`,
                  metadata: JSON.stringify({ targetUserId: client.id, emailType: "changes_requested_notification" }),
                });
              } catch (emailError) {
                console.error(`Failed to send changes-requested notification to client ${client.id}:`, emailError);
              }
            }
          } else if (user.role === "client") {
            // Client requested changes → notify the consultant responsible for this document.
            // Use the same fallback chain as the sign-off notification:
            //   1. Uploading consultant
            //   2. Assigned pro consultant for the site (site-scoped docs only)
            //   3. Admin fallback
            const sendChangesNotifToConsultant = async (target: { id: string; email: string | null; fullName: string; role: string | null }, label: string) => {
              if (!target.email) return false;
              if (changesNotifiedIds.has(target.id)) return true;
              try {
                await sendChangesRequestedEmail({
                  to: target.email,
                  fullName: target.fullName,
                  documentTitle: existingDoc.title,
                  siteName,
                  requestedBy: user.fullName,
                  comments: feedback || null,
                  documentUrl,
                  role: target.role || "consultant",
                });
                changesNotifiedIds.add(target.id);
                await storage.createAuditLog({
                  action: "email_sent",
                  userId: user.id,
                  userName: user.fullName,
                  entityId: notifEntityId,
                  documentId: document.id,
                  supportRequestId: null,
                  module: existingDoc.module,
                  details: `Changes-requested notification email sent to ${target.fullName} (${target.email})`,
                  metadata: JSON.stringify({ targetUserId: target.id, emailType: "changes_requested_notification" }),
                });
                return true;
              } catch (emailError) {
                console.error(`Failed to send changes-requested notification to ${label} ${target.id}:`, emailError);
                return false;
              }
            };

            // Step 1: if an Admin initiated this upload on behalf of a consultant,
            // the notification goes to the Admin — they are the one "taking charge".
            // We add the admin to changesNotifiedIds AFTER the attempt (success or fail)
            // so the consultant fallback (step 1b) never fires for on-behalf documents.
            if (existingDoc.initiatedByUserId) {
              const initiator = await storage.getUser(existingDoc.initiatedByUserId);
              if (initiator && initiator.role === "administrator") {
                await sendChangesNotifToConsultant(initiator, "admin");
                // Block consultant fallback regardless of email success
                changesNotifiedIds.add(initiator.id);
              }
            }

            // Step 1b: no initiator — notify the uploading consultant/developer directly
            if (changesNotifiedIds.size === 0) {
              const uploaderForChanges = existingDoc.uploadedBy ? await storage.getUser(existingDoc.uploadedBy) : null;
              if (uploaderForChanges && (uploaderForChanges.role === "consultant" || uploaderForChanges.role === "developer")) {
                await sendChangesNotifToConsultant(uploaderForChanges, uploaderForChanges.role === "developer" ? "developer" : "consultant");
              }
            }
            // Step 2: first assigned pro consultant (only if step 1 didn't fire; site-scoped docs only)
            if (changesNotifiedIds.size === 0 && document.siteId) {
              try {
                const assignments = await storage.getConsultantAssignments(document.siteId);
                const assignedConsultants = await Promise.all(assignments.map(a => storage.getUser(a.consultantId)));
                const proConsultants = assignedConsultants.filter(
                  (u): u is NonNullable<typeof u> =>
                    !!u && u.role === "consultant" && u.consultantTier === "pro" && !!u.email && u.status === "active"
                );
                for (const pc of proConsultants) {
                  const sent = await sendChangesNotifToConsultant(pc, "assigned pro consultant");
                  if (sent) break; // notify exactly one
                }
              } catch (err) {
                console.error("Failed to look up consultants for client changes notification:", err);
              }
            }
            // Step 3: first admin fallback (only if steps 1 & 2 didn't fire)
            if (changesNotifiedIds.size === 0) {
              const allUsers = await storage.getAllUsers();
              const admins = allUsers.filter(u => u.role === "developer" && u.email && u.status === "active");
              for (const admin of admins) {
                const sent = await sendChangesNotifToConsultant(admin, "developer");
                if (sent) break; // notify exactly one
              }
            }
          }
        } catch (err) {
          console.error("Failed to send changes-requested notifications:", err);
        }
      }

      // Emit document-updated to all affected users (company, group owner, admins, consultants)
      try {
        const payload = {
          documentId: document.id,
          siteId: document.siteId,
          entityId: document.entityId,
          approvalStatus: document.approvalStatus,
        };
        await emitDocumentUpdated(document, payload);
      } catch { /* non-fatal */ }

      res.json(document);
    } catch (error) {
      console.error("Document approval error:", error);
      res.status(500).json({ error: "Failed to update document approval" });
    }
  });

  // Re-issue a document as reviewed with no content changes
  app.post("/api/documents/:id/reissue", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
        return res.status(403).json({ error: "Only developers and consultants can re-issue documents" });
      }

      const { id: documentId } = req.params;
      const { renewalBase, note, renewalPeriodMonths: overrideRenewalPeriod } = req.body as { renewalBase?: "today" | "last_approval"; note?: string; renewalPeriodMonths?: number | null };
      const hasRenewalOverride = "renewalPeriodMonths" in req.body;

      const existingDoc = await storage.getDocument(documentId);
      if (!existingDoc) return res.status(404).json({ error: "Document not found" });
      if (existingDoc.isArchived) return res.status(400).json({ error: "Cannot re-issue an archived document" });

      // Determine base date for new renewal calculation
      const today = new Date();
      let newLastApprovedAt: Date;
      if (renewalBase === "last_approval" && existingDoc.lastApprovedAt) {
        newLastApprovedAt = new Date(existingDoc.lastApprovedAt);
      } else {
        newLastApprovedAt = today;
      }

      // Determine effective renewal period (override from request takes priority)
      let effectiveRenewalPeriodMonths: number | null;
      if (hasRenewalOverride) {
        effectiveRenewalPeriodMonths = typeof overrideRenewalPeriod === "number" ? overrideRenewalPeriod : null;
      } else {
        effectiveRenewalPeriodMonths = existingDoc.renewalPeriodMonths ?? null;
        if (!effectiveRenewalPeriodMonths && existingDoc.templateId) {
          const template = await storage.getDocumentTemplate(existingDoc.templateId);
          effectiveRenewalPeriodMonths = template?.renewalPeriodMonths ?? null;
        }
      }

      let newRenewalDate: Date | null = null;
      if (effectiveRenewalPeriodMonths) {
        newRenewalDate = new Date(newLastApprovedAt);
        newRenewalDate.setMonth(newRenewalDate.getMonth() + effectiveRenewalPeriodMonths);
      }

      // Create a new document version (copy of current file) — archive current as its approved version label
      const newVersion = existingDoc.version + 1;
      const newApprovedVersionOnReissue = (existingDoc.approvedVersion ?? 0) + 1;
      await storage.createDocumentVersion({
        documentId,
        version: newVersion,
        versionLabel: `${existingDoc.approvedVersion ?? 0}`,
        isDraft: false,
        fileName: existingDoc.fileName,
        fileUrl: existingDoc.fileUrl ?? undefined,
        fileSize: existingDoc.fileSize,
        mimeType: existingDoc.mimeType,
        uploadedBy: user.id,
        changeNote: note || "Re-issued — reviewed with no content changes",
      });

      // Update the document
      const updated = await storage.updateDocument(documentId, {
        approvalStatus: "approved",
        status: "compliant",
        version: newVersion,
        approvedVersion: newApprovedVersionOnReissue,
        lastApprovedAt: newLastApprovedAt,
        ...(hasRenewalOverride ? { renewalPeriodMonths: effectiveRenewalPeriodMonths } : {}),
        renewalDate: newRenewalDate ?? null,
      });

      if (!updated) return res.status(404).json({ error: "Document not found" });

      await storage.createAuditLog({
        action: "document_reissued",
        userId: user.id,
        userName: user.fullName,
        entityId: existingDoc.siteId || existingDoc.entityId,
        documentId,
        supportRequestId: null,
        module: existingDoc.module,
        details: note || "Document re-issued — reviewed with no content changes",
        metadata: JSON.stringify({
          renewalBase: renewalBase || "today",
          newLastApprovedAt: newLastApprovedAt.toISOString(),
          ...(newRenewalDate ? { newRenewalDate: newRenewalDate.toISOString() } : {}),
        }),
      });

      // Invalidation signal for real-time clients
      try {
        const payload = { documentId: updated.id, siteId: updated.siteId, entityId: updated.entityId, approvalStatus: updated.approvalStatus };
        await emitDocumentUpdated(updated, payload);
      } catch { /* non-fatal */ }

      res.json(updated);
    } catch (error) {
      console.error("Document re-issue error:", error);
      res.status(500).json({ error: "Failed to re-issue document" });
    }
  });

  // Resend or change approver for a document approval notification
  app.post("/api/documents/:id/approval-notify", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
        return res.status(403).json({ error: "Only developers and consultants can manage approval notifications" });
      }

      const documentId = req.params.id;
      const { userId: targetUserId } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const existingDoc = await storage.getDocument(documentId);
      if (!existingDoc) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (existingDoc.approvalStatus !== "pending" && existingDoc.approvalStatus !== "review_required") {
        return res.status(400).json({ error: "Document is not awaiting client approval" });
      }

      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || !targetUser.email) {
        return res.status(404).json({ error: "User not found or has no email" });
      }

      const site = await storage.getSite(existingDoc.siteId);
      const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const modulePath = existingDoc.module === "health_safety" ? "health-safety" 
        : existingDoc.module === "human_resources" ? "human-resources" 
        : existingDoc.module === "employment_law" ? "employment-law" 
        : "documents";
      const documentUrl = `${baseUrl}/${modulePath}/documents/${documentId}`;

      await sendDocumentApprovalEmail({
        to: targetUser.email,
        fullName: targetUser.fullName,
        documentTitle: existingDoc.title,
        siteName: site?.name || "Unknown Site",
        uploadedBy: user.fullName,
        portalUrl: baseUrl,
        documentUrl,
        role: targetUser.role,
      });

      await storage.createAuditLog({
        action: "email_sent",
        userId: user.id,
        userName: user.fullName,
        entityId: existingDoc.siteId,
        documentId: documentId,
        supportRequestId: null,
        module: existingDoc.module,
        details: `Approval notification email sent to ${targetUser.fullName} (${targetUser.email})`,
        metadata: JSON.stringify({ targetUserId: targetUser.id, emailType: "approval_notification" }),
      });

      // Refresh audit trail for all users viewing this document
      try {
        emitToAll("document-audit-updated", { documentId });
      } catch { /* non-fatal */ }

      // Record which user was designated as the approver for this document
      await storage.updateDocument(documentId, { approvalRequestedFrom: targetUserId });

      // Emit document-updated so the recipient's alert count, my-actions and document
      // list refresh in real time (without this they only update on page reload).
      try {
        const docPayload = { documentId, siteId: existingDoc.siteId };
        emitToUser(targetUserId, "document-updated", docPayload);
        emitToRole("developer", "document-updated", docPayload);
        emitToRole("consultant", "document-updated", docPayload);
      } catch { /* non-fatal */ }

      res.json({ success: true, message: `Approval notification sent to ${targetUser.fullName}` });
    } catch (error) {
      console.error("Send approval notification error:", error);
      res.status(500).json({ error: "Failed to send approval notification" });
    }
  });

  // Archive a document
  app.patch("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const id = req.params.id;
      const doc = await storage.getDocument(id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // For company/group scoped docs: only origin-level users can mutate
      if ((doc.scope === "company" || doc.scope === "group") && !(await isDocumentOriginUser(user, doc))) {
        return res.status(403).json({ error: "Only origin users can edit company or group scoped documents" });
      }

      const body = { ...req.body };
      if ("expiryDate" in body) {
        body.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
      }
      if ("renewalDate" in body) {
        body.renewalDate = body.renewalDate ? new Date(body.renewalDate) : null;
      }
      // When renewalPeriodMonths is being updated, recalculate renewalDate server-side.
      // Renewal date only exists when the document is approved.
      if ("renewalPeriodMonths" in body) {
        const newPeriod = body.renewalPeriodMonths ?? null;
        if (newPeriod && doc.approvalStatus === "approved" && doc.lastApprovedAt) {
          const base = new Date(doc.lastApprovedAt);
          base.setMonth(base.getMonth() + newPeriod);
          body.renewalDate = base;
        } else {
          // No approval yet, or period cleared — no renewal date
          body.renewalDate = null;
        }
      }

      // Recalculate compliance status when isMandatory is toggled
      if ("isMandatory" in body && doc.approvalStatus === "approved") {
        if (body.isMandatory && doc.status === "approved") {
          // Toggled ON — doc was approved (non-required) → now required → compliant
          body.status = "compliant";
        } else if (!body.isMandatory && doc.status === "compliant") {
          // Toggled OFF — doc was compliant (required) → no longer required → approved
          body.status = "approved";
        }
      }

      // Recalculate compliance status when dates are changed
      if (("expiryDate" in body || "renewalDate" in body) && doc.approvalStatus === "approved") {
        const now = new Date();
        const newExpiryDate = "expiryDate" in body ? body.expiryDate : doc.expiryDate;
        const newRenewalDate = "renewalDate" in body ? body.renewalDate : doc.renewalDate;
        if ((newExpiryDate && new Date(newExpiryDate) < now) || (newRenewalDate && new Date(newRenewalDate) < now)) {
          body.status = "overdue";
        } else {
          // Required docs → compliant; non-required docs → approved
          body.status = doc.isMandatory ? "compliant" : "approved";
        }
      }

      const updated = await storage.updateDocument(id, body);
      
      // Log the change — use a dedicated rename action when the title changed
      const titleChanged = "title" in req.body && req.body.title !== doc.title;
      if (titleChanged) {
        await storage.createAuditLog({
          userId: user.id,
          userName: user.fullName,
          action: "document_renamed",
          entityId: doc.entityId,
          documentId: id,
          module: doc.module as any,
          details: `Document name updated`,
          metadata: JSON.stringify({ from: doc.title, to: req.body.title }),
          ipAddress: req.ip,
        });
      } else {
        await storage.createAuditLog({
          userId: user.id,
          userName: user.fullName,
          action: "update_document",
          entityId: doc.entityId,
          documentId: id,
          module: doc.module as any,
          details: `Updated: ${Object.keys(req.body).join(", ")}`,
          ipAddress: req.ip,
        });
      }

      try {
        const payload = { documentId: updated.id, siteId: updated.siteId };
        await emitDocumentUpdated(updated, payload);
      } catch { /* non-fatal */ }

      res.json(updated);
    } catch (error) {
      console.error("Update document error:", error);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  app.post("/api/documents/:id/archive", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const documentId = req.params.id;
      const { reason } = req.body;

      const existingDoc = await storage.getDocument(documentId);
      if (!existingDoc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Authorization: check if user can access this document's site
      const canAccess = await canUserAccessDocument(user, existingDoc);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }

      // Only developers and consultants can archive documents
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot archive documents" });
      }

      // For company/group scoped docs: only origin users can archive
      if ((existingDoc.scope === "company" || existingDoc.scope === "group") && !(await isDocumentOriginUser(user, existingDoc))) {
        return res.status(403).json({ error: "Only origin users can archive company or group scoped documents" });
      }

      const document = await storage.updateDocument(documentId, {
        isArchived: true,
      });

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      await storage.createAuditLog({
        action: "document_archived",
        userId: user.id,
        userName: user.fullName,
        entityId: document.siteId,
        documentId: document.id,
        supportRequestId: null,
        module: existingDoc.module,
        details: reason || "Document archived",
        metadata: null,
      });

      try {
        const payload = { documentId: document.id, siteId: document.siteId };
        await emitDocumentUpdated(document, payload);
      } catch { /* non-fatal */ }

      res.json({ message: "Document archived successfully", document });
    } catch (error) {
      console.error("Document archive error:", error);
      res.status(500).json({ error: "Failed to archive document" });
    }
  });

  // Restore (unarchive) a document
  app.post("/api/documents/:id/restore", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const documentId = req.params.id;

      const existingDoc = await storage.getDocument(documentId);
      if (!existingDoc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Authorization: check if user can access this document's site
      const canAccess = await canUserAccessDocument(user, existingDoc);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }

      // Only developers and consultants can restore documents
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot restore documents" });
      }

      // For company/group scoped docs: only origin users can restore
      if ((existingDoc.scope === "company" || existingDoc.scope === "group") && !(await isDocumentOriginUser(user, existingDoc))) {
        return res.status(403).json({ error: "Only origin users can restore company or group scoped documents" });
      }

      const document = await storage.updateDocument(documentId, {
        isArchived: false,
      });

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      await storage.createAuditLog({
        action: "document_restored",
        userId: user.id,
        userName: user.fullName,
        entityId: document.siteId,
        documentId: document.id,
        supportRequestId: null,
        module: existingDoc.module,
        details: "Document restored from archive",
        metadata: null,
      });

      try {
        const payload = { documentId: document.id, siteId: document.siteId };
        await emitDocumentUpdated(document, payload);
      } catch { /* non-fatal */ }

      res.json({ message: "Document restored successfully", document });
    } catch (error) {
      console.error("Document restore error:", error);
      res.status(500).json({ error: "Failed to restore document" });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      if (user.role !== "developer" && !hasProPrivileges(user)) {
        return res.status(403).json({ error: "Only developers and pro consultants can delete documents" });
      }

      const documentId = req.params.id;
      const existingDoc = await storage.getDocument(documentId);
      if (!existingDoc) return res.status(404).json({ error: "Document not found" });

      // Pro consultants / Admins must have access to the document's site
      if (hasProPrivileges(user)) {
        const canAccess = await canUserAccessDocument(user, existingDoc);
        if (!canAccess) return res.status(403).json({ error: "Access denied to this document" });
      }

      // For company/group scoped docs: only origin users can delete
      if ((existingDoc.scope === "company" || existingDoc.scope === "group") && user.role !== "developer" && !(await isDocumentOriginUser(user, existingDoc))) {
        return res.status(403).json({ error: "Only origin users can delete company or group scoped documents" });
      }

      const success = await storage.deleteDocument(documentId);
      if (!success) return res.status(404).json({ error: "Document not found" });

      await storage.createAuditLog({
        action: "document_deleted",
        userId: user.id,
        userName: user.fullName,
        entityId: existingDoc.siteId,
        documentId: null,
        supportRequestId: null,
        module: existingDoc.module,
        details: `Document permanently deleted: "${existingDoc.title}"`,
        metadata: null,
      });

      try {
        const payload = { documentId: existingDoc.id, siteId: existingDoc.siteId };
        await emitDocumentUpdated(existingDoc, payload);
      } catch { /* non-fatal */ }

      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Document delete error:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Document Folders
  app.get("/api/folders", requireAuth, async (req, res) => {
    try {
      const siteId = req.query.siteId as string | undefined;
      const scope = req.query.scope as "company" | "group" | undefined;
      const entityId = req.query.entityId as string | undefined;
      const module = req.query.module as ModuleType | undefined;
      
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Scoped (company/group) folders
      if (scope === "company" || scope === "group") {
        if (!entityId) {
          return res.status(400).json({ error: "entityId is required for scoped folders" });
        }
        // Privileged users (admin/consultant), clients of that entity, and Group Owner
        // clients whose company is the groupOwnerId of the entity may view.
        if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator" && user.companyId !== entityId) {
          const entityCompany = await storage.getCompany(entityId);
          if (!entityCompany || entityCompany.groupOwnerId !== user.companyId) {
            return res.status(403).json({ error: "Access denied to this scope" });
          }
        }
        const folders = await storage.getScopedDocumentFolders(scope, entityId, module);
        return res.json(folders);
      }
      
      if (!siteId) {
        return res.status(400).json({ error: "siteId or scope+entityId is required" });
      }
      
      const canAccess = await canUserAccessSite(user, siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this site" });
      }
      
      const folders = await storage.getDocumentFolders(siteId, module);
      res.json(folders);
    } catch (error) {
      console.error("Folders error:", error);
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  app.get("/api/folders/:id", requireAuth, async (req, res) => {
    try {
      const folder = await storage.getDocumentFolder(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const canAccess = await canUserAccessSite(user, folder.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(folder);
    } catch (error) {
      console.error("Get folder error:", error);
      res.status(500).json({ error: "Failed to fetch folder" });
    }
  });

  app.post("/api/folders", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot create folders" });
      }
      
      const { name, description, module, siteId, scope, entityId, parentId } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Folder name is required" });
      }
      
      if (!module) {
        return res.status(400).json({ error: "Module is required" });
      }

      // Scoped (company/group) folder
      if (scope === "company" || scope === "group") {
        if (!entityId) {
          return res.status(400).json({ error: "entityId is required for scoped folders" });
        }
        if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator" && user.companyId !== entityId) {
          return res.status(403).json({ error: "Access denied to this scope" });
        }
        const folder = await storage.createDocumentFolder({
          name: name.trim(),
          description: description || null,
          module,
          siteId: null as any,
          scope,
          entityId,
          parentId: parentId || null,
          sortOrder: 0,
          createdBy: user.id,
        } as any);
        return res.status(201).json(folder);
      }
      
      if (!siteId) {
        return res.status(400).json({ error: "Site ID or scope+entityId is required" });
      }
      
      const canAccess = await canUserAccessSite(user, siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this site" });
      }
      
      const folder = await storage.createDocumentFolder({
        name: name.trim(),
        description: description || null,
        module,
        siteId,
        scope: "site",
        entityId: null as any,
        parentId: parentId || null,
        sortOrder: 0,
        createdBy: user.id,
      } as any);
      
      res.status(201).json(folder);
    } catch (error) {
      console.error("Create folder error:", error);
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  app.patch("/api/folders/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot update folders" });
      }
      
      const folder = await storage.getDocumentFolder(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      
      if (folder.siteId) {
        const canAccess = await canUserAccessSite(user, folder.siteId);
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (folder.scope === "company" || folder.scope === "group") {
        if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator" && user.companyId !== folder.entityId) {
          return res.status(403).json({ error: "Access denied to this scope" });
        }
      }
      
      const { name, description, parentId, sortOrder } = req.body;
      
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (parentId !== undefined) updates.parentId = parentId;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      
      const updated = await storage.updateDocumentFolder(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Update folder error:", error);
      res.status(500).json({ error: "Failed to update folder" });
    }
  });

  app.delete("/api/folders/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot delete folders" });
      }
      
      const folder = await storage.getDocumentFolder(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      
      if (folder.siteId) {
        const canAccess = await canUserAccessSite(user, folder.siteId);
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (folder.scope === "company" || folder.scope === "group") {
        if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator" && user.companyId !== folder.entityId) {
          return res.status(403).json({ error: "Access denied to this scope" });
        }
      }
      
      await storage.deleteDocumentFolder(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete folder error:", error);
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  // Provision folders from templates for a site
  app.post("/api/folders/provision", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const { siteId, scope, entityId, module } = req.body;
      
      if (!module) {
        return res.status(400).json({ error: "Module is required" });
      }

      // Scoped (company/group) provisioning
      if (scope === "company" || scope === "group") {
        if (!entityId) {
          return res.status(400).json({ error: "entityId is required for scoped provisioning" });
        }
        if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator" && user.companyId !== entityId) {
          const entityCompany = await storage.getCompany(entityId);
          if (!entityCompany || entityCompany.groupOwnerId !== user.companyId) {
            return res.status(403).json({ error: "Access denied to this scope" });
          }
        }
        const existing = await storage.getScopedDocumentFolders(scope, entityId, module);
        if (existing.length === 0) {
          const folders = await storage.provisionFoldersFromTemplates({ scope, entityId }, module, user.id);
          return res.status(201).json({ folders, provisioned: true });
        }
        return res.json({ folders: existing, provisioned: false });
      }
      
      if (!siteId) {
        return res.status(400).json({ error: "Site ID or scope+entityId is required" });
      }
      
      const canAccess = await canUserAccessSite(user, siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this site" });
      }
      
      // Get existing folders and templates
      const existingFolders = await storage.getDocumentFolders(siteId, module);
      const templates = await storage.getFolderTemplates(module as any);
      const activeTemplates = templates.filter(t => t.isActive);
      
      if (existingFolders.length === 0) {
        // No folders - provision all from templates
        const folders = await storage.provisionFoldersFromTemplates(siteId, module, user.id);
        return res.status(201).json({ folders, provisioned: true });
      }
      
      // Check if there are any templates missing site folders
      const existingTemplateIds = new Set(existingFolders.map(f => f.templateId).filter(Boolean));
      const missingTemplates = activeTemplates.filter(t => !existingTemplateIds.has(t.id));
      
      if (missingTemplates.length === 0) {
        return res.json({ folders: existingFolders, provisioned: false });
      }
      
      // Provision missing folders - need to handle parent-child relationships
      const createdFolders: typeof existingFolders = [];
      const templateIdToFolderId = new Map<string, string>();
      
      // Build map of existing template -> folder
      for (const folder of existingFolders) {
        if (folder.templateId) {
          templateIdToFolderId.set(folder.templateId, folder.id);
        }
      }
      
      // Sort missing templates - parents first (no parentId), then children
      const sortedMissing = [...missingTemplates].sort((a, b) => {
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && !b.parentId) return 1;
        return a.sortOrder - b.sortOrder;
      });
      
      for (const template of sortedMissing) {
        // Determine parent folder ID
        let parentFolderId: string | undefined = undefined;
        if (template.parentId) {
          // Find parent folder ID from existing folders or just created ones
          parentFolderId = templateIdToFolderId.get(template.parentId);
          if (!parentFolderId) {
            // Parent template doesn't have a folder yet, skip for now
            console.log(`Skipping template ${template.name} - parent folder not found`);
            continue;
          }
        }
        
        const folder = await storage.createDocumentFolder({
          name: template.name,
          description: template.description ?? undefined,
          module: template.module,
          siteId,
          parentId: parentFolderId,
          templateId: template.id,
          sortOrder: template.sortOrder,
          createdBy: user.id,
        });
        templateIdToFolderId.set(template.id, folder.id);
        createdFolders.push(folder);
      }
      
      const allFolders = [...existingFolders, ...createdFolders];
      res.status(201).json({ folders: allFolders, provisioned: true, newFolders: createdFolders.length });
    } catch (error) {
      console.error("Provision folders error:", error);
      res.status(500).json({ error: "Failed to provision folders" });
    }
  });

  app.get("/api/folders/:id/documents", requireAuth, async (req, res) => {
    try {
      const folder = await storage.getDocumentFolder(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const canAccess = await canUserAccessSite(user, folder.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const documents = await storage.getDocumentsByFolder(req.params.id);
      res.json(documents);
    } catch (error) {
      console.error("Get folder documents error:", error);
      res.status(500).json({ error: "Failed to fetch folder documents" });
    }
  });

  app.post("/api/documents/:id/move", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot move documents" });
      }
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      const canAccess = await canUserAccessDocument(user, document);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { folderId } = req.body;
      
      // Validate folder exists and belongs to same site if specified
      if (folderId) {
        const folder = await storage.getDocumentFolder(folderId);
        if (!folder) {
          return res.status(404).json({ error: "Target folder not found" });
        }
        if (folder.siteId !== document.siteId) {
          return res.status(400).json({ error: "Cannot move document to folder in different site" });
        }
      }
      
      const updated = await storage.moveDocumentToFolder(req.params.id, folderId || null);
      res.json(updated);
    } catch (error) {
      console.error("Move document error:", error);
      res.status(500).json({ error: "Failed to move document" });
    }
  });

  // Folder Templates (Admin-managed master folder structure)
  app.get("/api/folder-templates", requireAuth, async (req, res) => {
    try {
      const module = req.query.module as ModuleType | undefined;
      const templates = await storage.getFolderTemplates(module);
      res.json(templates);
    } catch (error) {
      console.error("Get folder templates error:", error);
      res.status(500).json({ error: "Failed to fetch folder templates" });
    }
  });

  app.get("/api/folder-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getFolderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Get folder template error:", error);
      res.status(500).json({ error: "Failed to fetch folder template" });
    }
  });

  app.post("/api/folder-templates", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      const schema = z.object({
        name: z.string().min(1),
        module: z.enum(["health_safety", "human_resources", "employment_law", "support"]),
        description: z.string().optional(),
        parentId: z.string().nullable().optional(),
        isMandatory: z.boolean().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      // Convert null parentId to undefined for storage - code is auto-generated
      const dataForStorage = {
        ...parsed.data,
        parentId: parsed.data.parentId ?? undefined,
        createdBy: user.id,
      };
      
      const template = await storage.createFolderTemplate(dataForStorage);
      emitToRole("developer", "folder-template-updated", {});
      emitToRole("consultant", "folder-template-updated", {});
      res.status(201).json(template);
    } catch (error) {
      console.error("Create folder template error:", error);
      res.status(500).json({ error: "Failed to create folder template" });
    }
  });

  app.patch("/api/folder-templates/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      const template = await storage.getFolderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      
      const schema = z.object({
        name: z.string().min(1).optional(),
        code: z.string().min(1).regex(/^[a-z0-9_]+$/, "Code must be lowercase with underscores only").optional(),
        description: z.string().optional(),
        parentId: z.string().nullable().optional(),
        isMandatory: z.boolean().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const updated = await storage.updateFolderTemplate(req.params.id, parsed.data);
      emitToRole("developer", "folder-template-updated", {});
      emitToRole("consultant", "folder-template-updated", {});
      res.json(updated);
    } catch (error) {
      console.error("Update folder template error:", error);
      res.status(500).json({ error: "Failed to update folder template" });
    }
  });

  app.delete("/api/folder-templates/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      const template = await storage.getFolderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      
      await storage.deleteFolderTemplate(req.params.id);
      emitToRole("developer", "folder-template-updated", {});
      emitToRole("consultant", "folder-template-updated", {});
      res.status(204).send();
    } catch (error) {
      console.error("Delete folder template error:", error);
      res.status(500).json({ error: "Failed to delete folder template" });
    }
  });

  // Folder-Document Type Rules
  app.get("/api/folder-document-type-rules", requireAuth, async (req, res) => {
    try {
      const rules = await storage.getAllFolderDocumentTypeRules();
      res.json(rules);
    } catch (error) {
      console.error("Get all folder document type rules error:", error);
      res.status(500).json({ error: "Failed to fetch folder document type rules" });
    }
  });

  app.post("/api/folder-document-type-rules", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      const schema = z.object({
        folderTemplateId: z.string().min(1),
        documentTypeId: z.string().min(1),
        isMandatory: z.boolean().optional(),
        sortOrder: z.number().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const template = await storage.getFolderTemplate(parsed.data.folderTemplateId);
      if (!template) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      
      const docType = await storage.getDocumentType(parsed.data.documentTypeId);
      if (!docType) {
        return res.status(404).json({ error: "Document type not found" });
      }
      
      if (docType.module !== template.module) {
        return res.status(400).json({ error: "Document type module must match folder template module" });
      }
      
      const rule = await storage.createFolderDocumentTypeRule({
        folderTemplateId: parsed.data.folderTemplateId,
        documentTypeId: parsed.data.documentTypeId,
        isMandatory: parsed.data.isMandatory ?? false,
        sortOrder: parsed.data.sortOrder ?? 0,
        createdBy: user.id,
      });
      
      res.status(201).json(rule);
    } catch (error) {
      console.error("Create folder document type rule error:", error);
      res.status(500).json({ error: "Failed to create folder document type rule" });
    }
  });

  app.get("/api/folder-templates/:id/rules", requireAuth, async (req, res) => {
    try {
      const template = await storage.getFolderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      
      const rules = await storage.getDocumentTypeRulesForTemplate(req.params.id);
      res.json(rules);
    } catch (error) {
      console.error("Get folder template rules error:", error);
      res.status(500).json({ error: "Failed to fetch folder template rules" });
    }
  });

  app.post("/api/folder-templates/:id/rules", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      const template = await storage.getFolderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      
      const schema = z.object({
        documentTypeId: z.string().min(1),
        isMandatory: z.boolean().optional(),
        sortOrder: z.number().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      // Verify document type exists
      const docType = await storage.getDocumentType(parsed.data.documentTypeId);
      if (!docType) {
        return res.status(404).json({ error: "Document type not found" });
      }
      
      // Verify document type module matches template module
      if (docType.module !== template.module) {
        return res.status(400).json({ error: "Document type module must match folder template module" });
      }
      
      const rule = await storage.createFolderDocumentTypeRule({
        folderTemplateId: req.params.id,
        ...parsed.data,
        createdBy: user.id,
      });
      
      res.status(201).json(rule);
    } catch (error) {
      console.error("Create folder template rule error:", error);
      res.status(500).json({ error: "Failed to create folder template rule" });
    }
  });

  app.delete("/api/folder-template-rules/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      await storage.deleteFolderDocumentTypeRule(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete folder template rule error:", error);
      res.status(500).json({ error: "Failed to delete folder template rule" });
    }
  });

  // ============================================
  // DOCUMENT TEMPLATES (The "Document Bible")
  // ============================================
  
  // Get all document templates (optionally filtered by module or folder)
  app.get("/api/document-templates", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const module = req.query.module as ModuleType | undefined;
      const folderTemplateId = req.query.folderTemplateId as string | undefined;
      // Admins see all templates; others only see source-matched templates
      const userSources: string[] | undefined =
        user.role === "developer" ? undefined : (user.sources ?? []);
      let result = await storage.getDocumentTemplates(module, folderTemplateId, userSources);
      // Allow an optional ?source=<code> param for UI-driven strict source filtering
      const sourceParam = req.query.source as string | undefined;
      if (sourceParam) {
        if (user.role === "developer") {
          // Admin strict filter: only templates explicitly tagged with this source
          result = result.filter(t => (t.sources ?? []).includes(sourceParam));
        } else {
          // Non-admin: further narrow to templates matching this specific own source
          if ((user.sources ?? []).includes(sourceParam)) {
            result = result.filter(t => (t.sources ?? []).includes(sourceParam));
          }
        }
      }
      res.json(result);
    } catch (error) {
      console.error("Get document templates error:", error);
      res.status(500).json({ error: "Failed to fetch document templates" });
    }
  });
  
  // Get archived document templates (template-library managers only)
  app.get("/api/document-templates-archived", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      const templates = await storage.getArchivedDocumentTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Get archived document templates error:", error);
      res.status(500).json({ error: "Failed to fetch archived document templates" });
    }
  });
  
  // Get single document template
  app.get("/api/document-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Get document template error:", error);
      res.status(500).json({ error: "Failed to fetch document template" });
    }
  });
  
  // Get templates for a specific folder template
  app.get("/api/folder-templates/:id/templates", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const folderTemplate = await storage.getFolderTemplate(req.params.id);
      if (!folderTemplate) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      const userSources = user.role === "developer" ? undefined : (user.sources ?? []);
      const templates = await storage.getDocumentTemplates(undefined, req.params.id, userSources);
      res.json(templates);
    } catch (error) {
      console.error("Get folder templates error:", error);
      res.status(500).json({ error: "Failed to fetch folder templates" });
    }
  });
  
  // Create document template (admin only)
  app.post("/api/document-templates", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        module: z.enum(["health_safety", "human_resources", "employment_law"]),
        folderTemplateId: z.string().min(1).optional(),
        documentTypeId: z.string().optional(), // Legacy - kept for backward compatibility
        fileName: z.string().min(1),
        fileUrl: z.string().min(1), // Path to the uploaded file in object storage
        fileSize: z.number().min(1),
        mimeType: z.string().min(1),
        placeholders: z.string().optional(), // JSON array of placeholder names
        sortOrder: z.number().optional(),
        isMandatory: z.boolean().optional(), // Compliance: is this template required?
        renewalPeriodMonths: z.number().nullable().optional(), // Compliance: how often to renew
        requiresApproval: z.boolean().optional(), // Does document need client approval workflow?
        visibility: z.enum(["public", "private"]).optional(),
        toolkitFolderId: z.string().nullable().optional(),
        sources: z.array(z.string()).optional(), // Source codes restricting visibility
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      let resolvedFolderTemplateId = parsed.data.folderTemplateId ?? null;
      
      // Auto-assign folderTemplateId for public templates based on the toolkit folder
      if (parsed.data.visibility === "public" && parsed.data.toolkitFolderId) {
        const linked = await storage.getFolderTemplateByToolkitFolderId(parsed.data.toolkitFolderId);
        if (linked) resolvedFolderTemplateId = linked.id;
      }
      
      if (!resolvedFolderTemplateId) {
        return res.status(400).json({ error: "folderTemplateId is required" });
      }
      
      // Verify folder template exists and module matches
      const folderTemplate = await storage.getFolderTemplate(resolvedFolderTemplateId);
      if (!folderTemplate) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      if (folderTemplate.module !== parsed.data.module) {
        return res.status(400).json({ error: "Template module must match folder template module" });
      }
      
      const template = await storage.createDocumentTemplate({
        ...parsed.data,
        folderTemplateId: resolvedFolderTemplateId,
        createdBy: user.id,
      });
      
      // Create audit log
      await storage.createAuditLog({
        action: "template_created",
        userId: user.id,
        userName: user.fullName,
        module: template.module,
        details: `Created template "${template.name}"`,
        metadata: JSON.stringify({
          templateId: template.id,
          templateName: template.name,
          folderTemplateId: template.folderTemplateId,
        }),
      });
      
      emitToRole("developer", "document-template-updated", { templateId: template.id });
      emitToRole("consultant", "document-template-updated", { templateId: template.id });
      res.status(201).json(template);
    } catch (error) {
      console.error("Create document template error:", error);
      res.status(500).json({ error: "Failed to create document template" });
    }
  });
  
  // Bulk assign / clear sources on multiple templates (admin only) — MUST be before /:id
  app.patch("/api/document-templates/bulk-sources", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      const schema = z.object({
        templateIds: z.array(z.string()).min(1),
        sources: z.array(z.string()),
        mode: z.enum(["merge", "clear"]),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      await storage.bulkUpdateTemplateSources(parsed.data.templateIds, parsed.data.sources, parsed.data.mode);
      res.json({ success: true, count: parsed.data.templateIds.length });
    } catch (error) {
      console.error("Bulk update template sources error:", error);
      res.status(500).json({ error: "Failed to bulk update template sources" });
    }
  });

  // Update document template (admin only, except folder reassignment which consultants can also do)
  app.patch("/api/document-templates/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot update document templates" });
      }
      
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        placeholders: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
        isMandatory: z.boolean().optional(), // Compliance: is this template required?
        renewalPeriodMonths: z.number().nullable().optional(), // Compliance: how often to renew
        requiresApproval: z.boolean().optional(), // Does document need client approval workflow?
        visibility: z.enum(["public", "private"]).optional(),
        sources: z.array(z.string()).optional(), // Source codes restricting visibility
        folderTemplateId: z.string().nullable().optional(), // Allow folder reassignment (Template Library), null = unassigned
        toolkitFolderId: z.string().nullable().optional(), // Allow toolkit folder assignment (Toolkit drag-and-drop)
        synopsis: z.string().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }

      // If only toolkitFolderId or folderTemplateId is being changed, consultants are also allowed
      const changedKeys = Object.keys(parsed.data);
      const isJustFolderChange = changedKeys.length === 1 && (changedKeys[0] === "toolkitFolderId" || changedKeys[0] === "folderTemplateId");
      if (!isJustFolderChange && !canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      // Auto-assign folderTemplateId for public templates based on the toolkit folder
      let updateData: any = { ...parsed.data };
      const effectiveVisibility = parsed.data.visibility ?? template.visibility;
      const effectiveToolkitFolderId = parsed.data.toolkitFolderId !== undefined ? parsed.data.toolkitFolderId : template.toolkitFolderId;
      if (effectiveVisibility === "public" && effectiveToolkitFolderId) {
        const linked = await storage.getFolderTemplateByToolkitFolderId(effectiveToolkitFolderId);
        if (linked) updateData.folderTemplateId = linked.id;
      }
      
      const updated = await storage.updateDocumentTemplate(req.params.id, updateData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "template_updated",
        userId: user.id,
        userName: user.fullName,
        module: template.module,
        details: `Updated template "${template.name}"`,
        metadata: JSON.stringify({
          templateId: template.id,
          templateName: template.name,
          changes: parsed.data,
        }),
      });
      
      emitToRole("developer", "document-template-updated", { templateId: req.params.id });
      emitToRole("consultant", "document-template-updated", { templateId: req.params.id });
      res.json(updated);
    } catch (error) {
      console.error("Update document template error:", error);
      res.status(500).json({ error: "Failed to update document template" });
    }
  });
  
  // Bulk reorder templates within a folder (admin only)
  app.post("/api/document-templates/reorder", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      const schema = z.object({
        folderTemplateId: z.string().min(1),
        templateOrder: z.array(z.object({
          id: z.string(),
          sortOrder: z.number(),
        })),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      // Check for duplicate IDs in the request
      const requestedIds = parsed.data.templateOrder.map(t => t.id);
      const uniqueIds = new Set(requestedIds);
      if (uniqueIds.size !== requestedIds.length) {
        return res.status(400).json({ error: "Duplicate template IDs in request" });
      }
      
      // Get all templates in this folder
      const allTemplates = await storage.getDocumentTemplates();
      const folderTemplates = allTemplates.filter(
        t => t.folderTemplateId === parsed.data.folderTemplateId && t.isActive
      );
      const folderTemplateIds = new Set(folderTemplates.map(t => t.id));
      
      // Verify all requested templates belong to the folder
      for (const id of requestedIds) {
        if (!folderTemplateIds.has(id)) {
          return res.status(400).json({ error: "One or more templates do not belong to the specified folder" });
        }
      }
      
      // Verify all templates in folder are included in request
      if (requestedIds.length !== folderTemplates.length) {
        return res.status(400).json({ 
          error: "Request must include all templates in the folder",
          expected: folderTemplates.length,
          received: requestedIds.length
        });
      }
      
      // Update each template's sortOrder
      const updates = await Promise.all(
        parsed.data.templateOrder.map(({ id, sortOrder }) =>
          storage.updateDocumentTemplate(id, { sortOrder })
        )
      );
      
      // Create audit log
      await storage.createAuditLog({
        action: "templates_reordered",
        userId: user.id,
        userName: user.fullName,
        details: `Reordered ${parsed.data.templateOrder.length} templates in folder`,
        metadata: JSON.stringify({
          folderTemplateId: parsed.data.folderTemplateId,
          templateCount: parsed.data.templateOrder.length,
        }),
      });
      
      res.json({ success: true, updated: updates.length });
    } catch (error) {
      console.error("Reorder templates error:", error);
      res.status(500).json({ error: "Failed to reorder templates" });
    }
  });

  // Upload new version of document template (admin/consultant)
  app.post("/api/document-templates/:id/versions", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot update document templates" });
      }
      
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      
      const schema = z.object({
        fileName: z.string().min(1),
        fileUrl: z.string().min(1),
        fileSize: z.number().min(1),
        mimeType: z.string().min(1),
        changeNote: z.string().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const newVersion = template.version + 1;
      
      // Create new version record
      const version = await storage.createDocumentTemplateVersion({
        templateId: template.id,
        version: newVersion,
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        fileSize: parsed.data.fileSize,
        mimeType: parsed.data.mimeType,
        changeNote: parsed.data.changeNote,
        uploadedBy: user.id,
      });
      
      // Update template with new version info
      await storage.updateDocumentTemplate(template.id, {
        version: newVersion,
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        fileSize: parsed.data.fileSize,
        mimeType: parsed.data.mimeType,
      });
      
      // Create audit log
      await storage.createAuditLog({
        action: "template_version_uploaded",
        userId: user.id,
        userName: user.fullName,
        module: template.module,
        details: `Uploaded version ${newVersion} of template "${template.name}"`,
        metadata: JSON.stringify({
          templateId: template.id,
          templateName: template.name,
          version: newVersion,
          fileName: parsed.data.fileName,
          changeNote: parsed.data.changeNote,
        }),
      });
      
      res.status(201).json(version);
    } catch (error) {
      console.error("Create document template version error:", error);
      res.status(500).json({ error: "Failed to create document template version" });
    }
  });
  
  // Get template versions
  app.get("/api/document-templates/:id/versions", requireAuth, async (req, res) => {
    try {
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      
      const versions = await storage.getDocumentTemplateVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error("Get document template versions error:", error);
      res.status(500).json({ error: "Failed to fetch document template versions" });
    }
  });
  
  // Toolkit Folder CRUD (admin only)
  app.get("/api/toolkit/folders", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const module = req.query.module as string | undefined;
      const allFolders = await storage.getToolkitFolders(module as any);

      // Source-filter: admins see all; consultants use their own sources;
      // clients use their company's sources.
      let effectiveSourcesForFolders: string[] = (user.sources ?? []) as string[];
      if (user.role === "client" && user.companyId) {
        const company = await storage.getCompany(user.companyId);
        effectiveSourcesForFolders = (company?.sources ?? []) as string[];
      }
      const filteredFolders = user.role === "developer"
        ? allFolders
        : allFolders.filter(f => {
            const fs = (f.sources ?? []) as string[];
            return fs.length === 0 || fs.some(s => effectiveSourcesForFolders.includes(s));
          });

      // Enrich each folder with its linked FolderTemplate id (for auto-assign in template library)
      const enriched = await Promise.all(filteredFolders.map(async (f) => {
        const linked = await storage.getFolderTemplateByToolkitFolderId(f.id);
        return { ...f, linkedFolderTemplateId: linked?.id ?? null };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Get toolkit folders error:", error);
      res.status(500).json({ error: "Failed to fetch toolkit folders" });
    }
  });

  app.post("/api/toolkit/folders", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!canManageTemplateLibrary(user)) return res.status(403).json({ error: "Only developers or template library managers can create toolkit folders" });

      const schema = z.object({
        name: z.string().min(1).max(100),
        module: z.enum(["health_safety", "human_resources", "employment_law"]),
        sortOrder: z.number().optional(),
        sources: z.array(z.string()).min(1, "At least one source is required"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });

      const folder = await storage.createToolkitFolder({
        name: parsed.data.name,
        module: parsed.data.module,
        sortOrder: parsed.data.sortOrder ?? 0,
        sources: parsed.data.sources,
        createdBy: user.id,
      });

      // Mirror: create a FolderTemplate subfolder linked to this toolkit folder
      const rootLibraryFolder = await storage.getModuleToolkitRootFolder(parsed.data.module as any);
      if (rootLibraryFolder) {
        const mirrorData: any = {
          name: parsed.data.name,
          module: parsed.data.module,
          parentId: rootLibraryFolder.id,
          toolkitFolderId: folder.id,
          isMandatory: false,
          sortOrder: parsed.data.sortOrder ?? 0,
          isActive: true,
          createdBy: user.id,
        };
        await storage.createFolderTemplate(mirrorData);
      }

      await storage.createAuditLog({
        action: "toolkit_folder_created",
        userId: user.id,
        userName: user.fullName,
        module: parsed.data.module,
        details: `Created toolkit folder "${parsed.data.name}"`,
        metadata: JSON.stringify({ folderId: folder.id }),
      });

      res.status(201).json(folder);
    } catch (error) {
      console.error("Create toolkit folder error:", error);
      res.status(500).json({ error: "Failed to create toolkit folder" });
    }
  });

  app.patch("/api/toolkit/folders/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!canManageTemplateLibrary(user)) return res.status(403).json({ error: "Only developers or template library managers can update toolkit folders" });

      const schema = z.object({
        name: z.string().min(1).max(100).optional(),
        sortOrder: z.number().optional(),
        sources: z.array(z.string()).min(1, "At least one source is required").optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });

      const updated = await storage.updateToolkitFolder(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "Folder not found" });

      await storage.createAuditLog({
        action: "toolkit_folder_updated",
        userId: user.id,
        userName: user.fullName,
        module: updated.module as any,
        details: `Updated toolkit folder "${updated.name}"`,
        metadata: JSON.stringify({ folderId: updated.id, changes: parsed.data }),
      });

      res.json(updated);
    } catch (error) {
      console.error("Update toolkit folder error:", error);
      res.status(500).json({ error: "Failed to update toolkit folder" });
    }
  });

  app.delete("/api/toolkit/folders/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!canManageTemplateLibrary(user)) return res.status(403).json({ error: "Only developers or template library managers can delete toolkit folders" });

      // Soft-delete all active templates inside this toolkit folder
      const templatesInFolder = await storage.getDocumentTemplatesByToolkitFolderId(req.params.id);
      for (const template of templatesInFolder) {
        await storage.deleteDocumentTemplate(
          template.id,
          user.id,
          user.fullName,
          "Deleted with toolkit folder",
        );
      }

      // Delete the mirrored FolderTemplate subfolder (templates already soft-deleted so nothing to unassign)
      const mirroredFolder = await storage.getFolderTemplateByToolkitFolderId(req.params.id);
      if (mirroredFolder) {
        await storage.deleteFolderTemplate(mirroredFolder.id);
      }

      const deleted = await storage.deleteToolkitFolder(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Folder not found" });

      await storage.createAuditLog({
        action: "toolkit_folder_deleted",
        userId: user.id,
        userName: user.fullName,
        module: "health_safety",
        details: `Deleted toolkit folder and ${templatesInFolder.length} template(s) inside it`,
        metadata: JSON.stringify({ folderId: req.params.id, deletedTemplateCount: templatesInFolder.length }),
      });

      res.json({ success: true, deletedTemplateCount: templatesInFolder.length });
    } catch (error) {
      console.error("Delete toolkit folder error:", error);
      res.status(500).json({ error: "Failed to delete toolkit folder" });
    }
  });

  // Toolkit: get all public templates grouped by toolkit folder (all authenticated roles)
  app.get("/api/toolkit", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      // Get all toolkit folders then apply source-based visibility filter.
      // Admins see all folders.
      // Consultants see folders whose sources list is empty OR overlaps with their sources.
      // Clients use their company's sources for the same check.
      const allToolkitFolders = await storage.getToolkitFolders();
      let visibleFolders = allToolkitFolders;

      if (user.role !== "developer") {
        let effectiveSources: string[] = (user.sources ?? []) as string[];

        if (user.role === "client" && user.companyId) {
          const company = await storage.getCompany(user.companyId);
          effectiveSources = (company?.sources ?? []) as string[];
        }

        visibleFolders = allToolkitFolders.filter(f => {
          const fs = (f.sources ?? []) as string[];
          return fs.length === 0 || fs.some(s => effectiveSources.includes(s));
        });
      }

      // Get all public, active, non-deleted document templates
      const allTemplates = await storage.getDocumentTemplates();
      const publicTemplates = allTemplates.filter(
        (t) => !t.deletedAt && t.isActive && (t as any).visibility !== "private"
      );

      // Build folder map with templates, keyed by toolkit folder id
      const folderMap = new Map<string, {
        id: string; name: string; module: string; sortOrder: number; sources: string[]; templates: typeof publicTemplates;
      }>();

      for (const folder of visibleFolders) {
        folderMap.set(folder.id, {
          id: folder.id,
          name: folder.name,
          module: folder.module,
          sortOrder: folder.sortOrder,
          sources: (folder.sources ?? []) as string[],
          templates: [],
        });
      }

      // Build a set of ALL toolkit folder ids (visible + hidden) so we can
      // distinguish "genuinely unassigned" from "assigned to a hidden folder".
      const allFolderIds = new Set(allToolkitFolders.map(f => f.id));

      const unassigned: typeof publicTemplates = [];

      for (const template of publicTemplates) {
        const tkFolderId = (template as any).toolkitFolderId;
        if (tkFolderId && folderMap.has(tkFolderId)) {
          // Assigned to a visible folder — add to that folder's template list
          folderMap.get(tkFolderId)!.templates.push(template);
        } else if (!tkFolderId || !allFolderIds.has(tkFolderId)) {
          // Truly unassigned (no folder id, or orphaned reference) — include in unassigned
          unassigned.push(template);
        }
        // else: template is assigned to a folder that exists but is outside this
        // user's source scope — silently drop it (no data leak via unassigned)
      }

      const folders = Array.from(folderMap.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

      res.json({ folders, unassigned });
    } catch (error) {
      console.error("Toolkit fetch error:", error);
      res.status(500).json({ error: "Failed to fetch toolkit" });
    }
  });

  // Toolkit: replace a template's file (admin or consultant)
  app.post("/api/toolkit/:templateId/replace", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role === "client") return res.status(403).json({ error: "Clients cannot replace template files" });

      const template = await storage.getDocumentTemplate(req.params.templateId);
      if (!template) return res.status(404).json({ error: "Template not found" });

      const schema = z.object({
        fileUrl: z.string().min(1),
        fileName: z.string().min(1),
        fileSize: z.number().min(1),
        mimeType: z.string().min(1),
        changeNote: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });

      // Archive current file as a new version entry
      await storage.createDocumentTemplateVersion({
        templateId: template.id,
        version: template.version,
        fileName: template.fileName,
        fileUrl: template.fileUrl ?? undefined,
        fileSize: template.fileSize,
        mimeType: template.mimeType,
        changeNote: parsed.data.changeNote ?? `Replaced by ${user.fullName}`,
        uploadedBy: user.id,
      });

      // Update template with new file and incremented version
      const updated = await storage.updateDocumentTemplate(template.id, {
        fileUrl: parsed.data.fileUrl,
        fileName: parsed.data.fileName,
        fileSize: parsed.data.fileSize,
        mimeType: parsed.data.mimeType,
        version: template.version + 1,
      });

      await storage.createAuditLog({
        action: "toolkit_file_replaced",
        userId: user.id,
        userName: user.fullName,
        module: template.module,
        details: `Replaced file for template "${template.name}" (now v${template.version + 1})`,
        metadata: JSON.stringify({ templateId: template.id, changeNote: parsed.data.changeNote }),
      });

      res.json(updated);
    } catch (error) {
      console.error("Toolkit replace error:", error);
      res.status(500).json({ error: "Failed to replace template file" });
    }
  });

  // Delete document template (admin only)
  app.delete("/api/document-templates/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      // Require deletion reason
      const { reason } = req.body || {};
      if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        return res.status(400).json({ error: "A deletion reason is required (minimum 5 characters)" });
      }
      
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      
      // Soft delete with audit trail
      const success = await storage.deleteDocumentTemplate(req.params.id, user.id, user.fullName, reason.trim());
      
      if (!success) {
        return res.status(500).json({ error: "Failed to archive document template" });
      }
      
      emitToRole("developer", "document-template-updated", { templateId: req.params.id });
      emitToRole("consultant", "document-template-updated", { templateId: req.params.id });
      res.status(200).json({ 
        message: "Template archived successfully",
        archivedAt: new Date().toISOString(),
        archivedBy: user.fullName,
        reason: reason.trim()
      });
    } catch (error) {
      console.error("Delete document template error:", error);
      res.status(500).json({ error: "Failed to delete document template" });
    }
  });
  
  // Restore archived document template (admin only)
  app.post("/api/document-templates/:id/restore", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }
      
      const success = await storage.restoreDocumentTemplate(req.params.id, user.id);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to restore document template" });
      }
      
      emitToRole("developer", "document-template-updated", { templateId: req.params.id });
      emitToRole("consultant", "document-template-updated", { templateId: req.params.id });
      res.status(200).json({ 
        message: "Template restored successfully",
        restoredAt: new Date().toISOString(),
        restoredBy: user.fullName
      });
    } catch (error) {
      console.error("Restore document template error:", error);
      res.status(500).json({ error: "Failed to restore document template" });
    }
  });

  // Permanently delete document template (admin only)
  app.delete("/api/document-templates/:id/permanent", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!canManageTemplateLibrary(user)) {
        return res.status(403).json({ error: "You do not have permission to manage the Template Library" });
      }

      const { reason } = req.body || {};
      if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        return res.status(400).json({ error: "A deletion reason is required (minimum 5 characters)" });
      }

      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }

      const success = await storage.permanentlyDeleteDocumentTemplate(req.params.id, user.id, user.fullName, reason.trim());

      if (!success) {
        return res.status(500).json({ error: "Failed to permanently delete document template" });
      }

      res.status(200).json({ message: "Template permanently deleted" });
    } catch (error) {
      console.error("Permanent delete document template error:", error);
      res.status(500).json({ error: "Failed to permanently delete document template" });
    }
  });

  // Provision folders from templates for a site
  app.post("/api/sites/:siteId/provision-folders", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot provision folders" });
      }
      
      const site = await storage.getSite(req.params.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      
      const canAccess = await canUserAccessSite(user, req.params.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const schema = z.object({
        module: z.enum(["health_safety", "human_resources", "employment_law", "support"]),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const folders = await storage.provisionFoldersFromTemplates(
        req.params.siteId,
        parsed.data.module,
        user.id
      );
      
      res.status(201).json(folders);
    } catch (error) {
      console.error("Provision folders error:", error);
      res.status(500).json({ error: "Failed to provision folders" });
    }
  });

  // Training Modules (Training Library)
  app.get("/api/training-modules", requireAuth, async (req, res) => {
    try {
      const module = req.query.module as ModuleType | undefined;
      const trainingModules = await storage.getTrainingModules(module);
      res.json(trainingModules);
    } catch (error) {
      console.error("Get training modules error:", error);
      res.status(500).json({ error: "Failed to fetch training modules" });
    }
  });

  app.get("/api/training-modules/:id", requireAuth, async (req, res) => {
    try {
      const trainingModule = await storage.getTrainingModule(req.params.id);
      if (!trainingModule) {
        return res.status(404).json({ error: "Training module not found" });
      }
      res.json(trainingModule);
    } catch (error) {
      console.error("Get training module error:", error);
      res.status(500).json({ error: "Failed to fetch training module" });
    }
  });

  app.post("/api/training-modules", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can create training modules" });
      }
      
      const schema = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        module: z.enum(["health_safety", "human_resources", "employment_law", "support"]),
        folderTemplateId: z.string().optional(),
        provider: z.string().optional(),
        externalLink: z.string().url(),
        duration: z.string().optional(),
        isMandatory: z.boolean().optional(),
        renewalPeriodMonths: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const trainingModule = await storage.createTrainingModule({
        ...parsed.data,
        createdBy: user.id,
      });
      
      await storage.createAuditLog({
        action: "training_module_created",
        userId: user.id,
        userName: user.fullName,
        module: trainingModule.module,
        details: `Created training module "${trainingModule.title}"`,
        metadata: JSON.stringify({
          trainingModuleId: trainingModule.id,
          trainingModuleTitle: trainingModule.title,
        }),
      });
      
      res.status(201).json(trainingModule);
    } catch (error) {
      console.error("Create training module error:", error);
      res.status(500).json({ error: "Failed to create training module" });
    }
  });

  app.patch("/api/training-modules/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can update training modules" });
      }
      
      const trainingModule = await storage.getTrainingModule(req.params.id);
      if (!trainingModule) {
        return res.status(404).json({ error: "Training module not found" });
      }
      
      const schema = z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        module: z.enum(["health_safety", "human_resources", "employment_law", "support"]).optional(),
        folderTemplateId: z.string().optional().nullable(),
        provider: z.string().optional().nullable(),
        externalLink: z.string().url().optional(),
        duration: z.string().optional().nullable(),
        isMandatory: z.boolean().optional(),
        renewalPeriodMonths: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const updated = await storage.updateTrainingModule(req.params.id, parsed.data);
      
      await storage.createAuditLog({
        action: "training_module_updated",
        userId: user.id,
        userName: user.fullName,
        module: updated?.module || trainingModule.module,
        details: `Updated training module "${updated?.title || trainingModule.title}"`,
        metadata: JSON.stringify({
          trainingModuleId: req.params.id,
          changes: Object.keys(parsed.data),
        }),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Update training module error:", error);
      res.status(500).json({ error: "Failed to update training module" });
    }
  });

  app.delete("/api/training-modules/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can delete training modules" });
      }
      
      const trainingModule = await storage.getTrainingModule(req.params.id);
      if (!trainingModule) {
        return res.status(404).json({ error: "Training module not found" });
      }
      
      await storage.deleteTrainingModule(req.params.id);
      
      await storage.createAuditLog({
        action: "training_module_deleted",
        userId: user.id,
        userName: user.fullName,
        module: trainingModule.module,
        details: `Deleted training module "${trainingModule.title}"`,
        metadata: JSON.stringify({
          trainingModuleId: req.params.id,
          trainingModuleTitle: trainingModule.title,
        }),
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete training module error:", error);
      res.status(500).json({ error: "Failed to delete training module" });
    }
  });

  // Training Folders
  app.get("/api/training-folders", requireAuth, async (req, res) => {
    try {
      const module = req.query.module as ModuleType | undefined;
      const folders = await storage.getTrainingFolders(module);
      res.json(folders);
    } catch (error) {
      console.error("Get training folders error:", error);
      res.status(500).json({ error: "Failed to fetch training folders" });
    }
  });

  app.get("/api/training-folders/:id", requireAuth, async (req, res) => {
    try {
      const folder = await storage.getTrainingFolder(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Training folder not found" });
      }
      res.json(folder);
    } catch (error) {
      console.error("Get training folder error:", error);
      res.status(500).json({ error: "Failed to fetch training folder" });
    }
  });

  app.post("/api/training-folders", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can create training folders" });
      }
      
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        module: z.enum(["health_safety", "human_resources", "employment_law", "support"]),
        sortOrder: z.number().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const folder = await storage.createTrainingFolder({
        ...parsed.data,
        createdBy: user.id,
      });
      
      res.status(201).json(folder);
    } catch (error) {
      console.error("Create training folder error:", error);
      res.status(500).json({ error: "Failed to create training folder" });
    }
  });

  app.patch("/api/training-folders/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can update training folders" });
      }
      
      const folder = await storage.getTrainingFolder(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Training folder not found" });
      }
      
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        module: z.enum(["health_safety", "human_resources", "employment_law", "support"]).optional(),
        sortOrder: z.number().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const updated = await storage.updateTrainingFolder(req.params.id, parsed.data);
      res.json(updated);
    } catch (error) {
      console.error("Update training folder error:", error);
      res.status(500).json({ error: "Failed to update training folder" });
    }
  });

  app.delete("/api/training-folders/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can delete training folders" });
      }
      
      await storage.deleteTrainingFolder(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete training folder error:", error);
      res.status(500).json({ error: "Failed to delete training folder" });
    }
  });

  // Training Courses
  app.get("/api/training-courses", requireAuth, async (req, res) => {
    try {
      const module = req.query.module as ModuleType | undefined;
      const folderId = req.query.folderId as string | undefined;
      const courses = await storage.getTrainingCourses(module, folderId);
      res.json(courses);
    } catch (error) {
      console.error("Get training courses error:", error);
      res.status(500).json({ error: "Failed to fetch training courses" });
    }
  });

  app.get("/api/training-courses/:id", requireAuth, async (req, res) => {
    try {
      const course = await storage.getTrainingCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Training course not found" });
      }
      res.json(course);
    } catch (error) {
      console.error("Get training course error:", error);
      res.status(500).json({ error: "Failed to fetch training course" });
    }
  });

  app.post("/api/training-courses", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can create training courses" });
      }
      
      const faqSchema = z.object({
        question: z.string(),
        answer: z.string(),
      });
      
      const pricingRowSchema = z.object({
        column1: z.string(),
        column2: z.string(),
      });
      
      const pricingTableSchema = z.object({
        headingRow: pricingRowSchema,
        dataRows: z.array(pricingRowSchema).max(5),
      });
      
      const schema = z.object({
        title: z.string().min(1),
        summary: z.string().optional(),
        productCode: z.string().optional(),
        module: z.enum(["health_safety", "human_resources", "employment_law", "support"]),
        trainingFolderId: z.string().optional(),
        provider: z.string().optional(),
        externalLink: z.string().url().optional().nullable(),
        duration: z.string().optional(),
        courseOverview: z.array(z.string()).optional(),
        faqs: z.array(faqSchema).max(5).optional(),
        pricingTable: pricingTableSchema.optional(),
        trainingMethod: z.enum(["online", "in_person"]).optional().nullable(),
        isMandatory: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        renewalPeriodMonths: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const course = await storage.createTrainingCourse({
        ...parsed.data,
        faqs: parsed.data.faqs ? JSON.stringify(parsed.data.faqs) : undefined,
        pricingTable: parsed.data.pricingTable ? JSON.stringify(parsed.data.pricingTable) : undefined,
        createdBy: user.id,
      });
      
      res.status(201).json(course);
    } catch (error) {
      console.error("Create training course error:", error);
      res.status(500).json({ error: "Failed to create training course" });
    }
  });

  app.patch("/api/training-courses/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can update training courses" });
      }
      
      const course = await storage.getTrainingCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Training course not found" });
      }
      
      const faqSchema = z.object({
        question: z.string(),
        answer: z.string(),
      });
      
      const pricingRowSchema = z.object({
        column1: z.string(),
        column2: z.string(),
      });
      
      const pricingTableSchema = z.object({
        headingRow: pricingRowSchema,
        dataRows: z.array(pricingRowSchema).max(5),
      });
      
      const schema = z.object({
        title: z.string().min(1).optional(),
        summary: z.string().optional().nullable(),
        productCode: z.string().optional().nullable(),
        module: z.enum(["health_safety", "human_resources", "employment_law", "support"]).optional(),
        trainingFolderId: z.string().optional().nullable(),
        provider: z.string().optional().nullable(),
        trainingMethod: z.enum(["online", "in_person"]).optional().nullable(),
        externalLink: z.string().url().optional().nullable(),
        duration: z.string().optional().nullable(),
        courseOverview: z.array(z.string()).optional().nullable(),
        faqs: z.array(faqSchema).max(5).optional().nullable(),
        pricingTable: pricingTableSchema.optional().nullable(),
        isMandatory: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        renewalPeriodMonths: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const updateData: any = { ...parsed.data };
      if (parsed.data.faqs !== undefined) {
        updateData.faqs = parsed.data.faqs ? JSON.stringify(parsed.data.faqs) : null;
      }
      if (parsed.data.pricingTable !== undefined) {
        updateData.pricingTable = parsed.data.pricingTable ? JSON.stringify(parsed.data.pricingTable) : null;
      }
      
      const updated = await storage.updateTrainingCourse(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Update training course error:", error);
      res.status(500).json({ error: "Failed to update training course" });
    }
  });

  app.delete("/api/training-courses/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can delete training courses" });
      }
      
      await storage.deleteTrainingCourse(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete training course error:", error);
      res.status(500).json({ error: "Failed to delete training course" });
    }
  });

  // Training Requests
  app.get("/api/training-requests", requireAuth, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.siteId) filters.siteId = req.query.siteId as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.courseId) filters.courseId = req.query.courseId as string;
      
      const requests = await storage.getTrainingRequests(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(requests);
    } catch (error) {
      console.error("Get training requests error:", error);
      res.status(500).json({ error: "Failed to fetch training requests" });
    }
  });

  app.post("/api/training-requests", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const schema = z.object({
        trainingCourseId: z.string(),
        siteId: z.string(),
        requestType: z.enum(["info", "booking"]),
        message: z.string().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const request = await storage.createTrainingRequest({
        ...parsed.data,
        requestedBy: user.id,
        status: "pending",
      });

      // Send email notification for booking enquiries
      if (parsed.data.requestType === "booking") {
        let courseName = `Course ID: ${parsed.data.trainingCourseId}`;
        let courseCode = "";
        let siteName = `Site ID: ${parsed.data.siteId}`;
        let companyName = "Unknown Company";

        try {
          const course = await storage.getTrainingCourse(parsed.data.trainingCourseId);
          if (course) { courseName = course.title; courseCode = course.productCode; }
        } catch { /* non-fatal */ }

        try {
          const site = await storage.getSite(parsed.data.siteId);
          if (site) {
            siteName = site.name;
            const company = await storage.getCompany(site.companyId).catch(() => undefined);
            if (company) companyName = company.name;
          }
        } catch { /* non-fatal */ }

        try {
          await sendBookingEnquiryEmail({
            courseName,
            courseCode,
            siteName,
            companyName,
            requestedByName: user.fullName,
            requestedByEmail: user.email,
            message: parsed.data.message ?? null,
          });
        } catch (emailError) {
          console.error("Failed to send booking enquiry notification email:", emailError);
        }
      }

      emitToRole("developer", "training-request-updated", { requestId: request.id, siteId: parsed.data.siteId });
      emitToRole("consultant", "training-request-updated", { requestId: request.id, siteId: parsed.data.siteId });
      res.status(201).json(request);
    } catch (error) {
      console.error("Create training request error:", error);
      res.status(500).json({ error: "Failed to create training request" });
    }
  });

  app.patch("/api/training-requests/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admins/consultants can update request status
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot update training requests" });
      }
      
      const schema = z.object({
        status: z.enum(["pending", "contacted", "booked", "completed", "cancelled"]).optional(),
        responseNotes: z.string().optional(),
        scheduledDate: z.string().optional(), // ISO date string for scheduled training
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const updateData: any = { ...parsed.data };
      
      // Track who responded and when
      if (parsed.data.status && parsed.data.status !== "pending") {
        updateData.respondedBy = user.id;
        updateData.respondedAt = new Date();
      }
      
      // Handle booking - track who booked and when
      if (parsed.data.status === "booked") {
        updateData.bookedBy = user.id;
        updateData.bookedAt = new Date();
        if (parsed.data.scheduledDate) {
          updateData.scheduledDate = new Date(parsed.data.scheduledDate);
        }
      }
      
      // Handle completion - track who completed and calculate renewal date
      if (parsed.data.status === "completed") {
        updateData.completedBy = user.id;
        updateData.completedAt = new Date();
        
        // Get the training course to calculate renewal date
        const request = await storage.getTrainingRequest(req.params.id);
        if (request) {
          const course = await storage.getTrainingCourse(request.trainingCourseId);
          if (course && course.renewalPeriodMonths) {
            const renewalDate = new Date();
            renewalDate.setMonth(renewalDate.getMonth() + course.renewalPeriodMonths);
            updateData.renewalDate = renewalDate;
          }
        }
      }
      
      const updated = await storage.updateTrainingRequest(req.params.id, updateData);
      emitToRole("developer", "training-request-updated", { requestId: req.params.id, siteId: updated.siteId });
      emitToRole("consultant", "training-request-updated", { requestId: req.params.id, siteId: updated.siteId });
      res.json(updated);
    } catch (error) {
      console.error("Update training request error:", error);
      res.status(500).json({ error: "Failed to update training request" });
    }
  });

  // Training Bookings (simplified training management)
  app.get("/api/training-bookings", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const filters: any = {};
      if (req.query.siteId) filters.siteId = req.query.siteId as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.courseId) filters.courseId = req.query.courseId as string;
      
      const bookings = await storage.getTrainingBookings(Object.keys(filters).length > 0 ? filters : undefined);
      
      // Filter by user access
      let filteredBookings = bookings;
      if (user.role === "consultant") {
        if (!isProConsultant(user)) {
          const assignments = await storage.getConsultantSites(user.id);
          const assignedSiteIds = new Set(assignments.map(a => a.siteId));
          filteredBookings = bookings.filter(b => assignedSiteIds.has(b.siteId));
        }
        // Pro consultants see all bookings
      } else if (user.role === "client" && user.companyId) {
        const sites = await storage.getSitesByCompanyId(user.companyId);
        const clientSiteIds = new Set(sites.map(s => s.id));
        filteredBookings = bookings.filter(b => clientSiteIds.has(b.siteId));
      }
      
      res.json(filteredBookings);
    } catch (error) {
      console.error("Get training bookings error:", error);
      res.status(500).json({ error: "Failed to fetch training bookings" });
    }
  });

  app.get("/api/training-bookings/:id", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getTrainingBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Training booking not found" });
      }
      res.json(booking);
    } catch (error) {
      console.error("Get training booking error:", error);
      res.status(500).json({ error: "Failed to fetch training booking" });
    }
  });

  app.post("/api/training-bookings", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admins/consultants can create bookings
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot create training bookings" });
      }
      
      const schema = z.object({
        trainingCourseId: z.string(),
        siteId: z.string(),
        scheduledDate: z.string().optional(),
        accessUrl: z.string().optional(),
        accessUsername: z.string().optional(),
        accessPassword: z.string().optional(),
        providerName: z.string().optional(),
        providerContact: z.string().optional(),
        notes: z.string().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const booking = await storage.createTrainingBooking({
        ...parsed.data,
        scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : undefined,
        bookedBy: user.id,
        status: "booked",
      });
      try {
        const bSite = await storage.getSite(booking.siteId);
        if (bSite) emitToCompany(bSite.companyId, "training-booking-updated", { bookingId: booking.id, siteId: booking.siteId });
      } catch { /* non-fatal */ }
      emitToRole("developer", "training-booking-updated", { bookingId: booking.id, siteId: booking.siteId });
      emitToRole("consultant", "training-booking-updated", { bookingId: booking.id, siteId: booking.siteId });
      res.status(201).json(booking);
    } catch (error) {
      console.error("Create training booking error:", error);
      res.status(500).json({ error: "Failed to create training booking" });
    }
  });

  app.patch("/api/training-bookings/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admins/consultants can update bookings
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot update training bookings" });
      }
      
      const schema = z.object({
        scheduledDate: z.string().optional(),
        accessUrl: z.string().optional(),
        accessUsername: z.string().optional(),
        accessPassword: z.string().optional(),
        providerName: z.string().optional(),
        providerContact: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(["booked", "completed"]).optional(),
        certificateId: z.string().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const updateData: any = { ...parsed.data };
      
      if (parsed.data.scheduledDate) {
        updateData.scheduledDate = new Date(parsed.data.scheduledDate);
      }
      
      // Handle completion
      if (parsed.data.status === "completed") {
        updateData.completedBy = user.id;
        updateData.completedAt = new Date();
      }
      
      const updated = await storage.updateTrainingBooking(req.params.id, updateData);
      try {
        const bSite = await storage.getSite(updated.siteId);
        if (bSite) emitToCompany(bSite.companyId, "training-booking-updated", { bookingId: updated.id, siteId: updated.siteId });
      } catch { /* non-fatal */ }
      emitToRole("developer", "training-booking-updated", { bookingId: updated.id, siteId: updated.siteId });
      emitToRole("consultant", "training-booking-updated", { bookingId: updated.id, siteId: updated.siteId });
      res.json(updated);
    } catch (error) {
      console.error("Update training booking error:", error);
      res.status(500).json({ error: "Failed to update training booking" });
    }
  });

  app.delete("/api/training-bookings/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only developers can delete bookings
      if (user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can delete training bookings" });
      }
      
      const bookingToDelete = await storage.getTrainingBooking(req.params.id).catch(() => null);
      await storage.deleteTrainingBooking(req.params.id);
      if (bookingToDelete) {
        try {
          const bSite = await storage.getSite(bookingToDelete.siteId);
          if (bSite) emitToCompany(bSite.companyId, "training-booking-updated", { bookingId: req.params.id });
        } catch { /* non-fatal */ }
        emitToRole("developer", "training-booking-updated", { bookingId: req.params.id });
        emitToRole("consultant", "training-booking-updated", { bookingId: req.params.id });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete training booking error:", error);
      res.status(500).json({ error: "Failed to delete training booking" });
    }
  });

    const isProConsultant = (user: { role: string; consultantTier?: string | null }): boolean => {
    return user.role === "consultant" && user.consultantTier === "pro";
  };

  // "Has Pro-Consultant-style privileges" = a real Pro Consultant OR an Admin (administrator).
  // Use this for source-scoped visibility / create / manage gates where Admin should behave
  // like a Pro Consultant. Do NOT use it for approver-eligibility, final document sign-off,
  // or manager allocation — those stay strict (isProConsultant) so Admin is excluded.
  const hasProPrivileges = (user: { role: string; consultantTier?: string | null }): boolean => {
    return isProConsultant(user) || user.role === "administrator";
  };

  const sourcesOverlap = (a: string[] | null | undefined, b: string[] | null | undefined): boolean => {
    if (!a || a.length === 0 || !b || b.length === 0) return false;
    return a.some(s => b.includes(s));
  };

  /**
   * Returns the effective set of company IDs a client/consultant user can see.
   * If the user's own company is a Group Owner, includes all its member companies.
   * Admins should not call this — they have unrestricted access.
   */
  const getEffectiveCompanyIds = async (userCompanyId: string): Promise<Set<string>> => {
    const ids = new Set<string>([userCompanyId]);
    const members = await storage.getGroupMembers(userCompanyId);
    for (const m of members) ids.add(m.id);
    return ids;
  };

  // Returns the effective (computed) sources for a GO company: union of its own stored sources
  // and all member company sources. Used to determine consultant access to a GO and its members.
  const getEffectiveGoSources = async (goCompanyId: string): Promise<string[]> => {
    const goCompany = await storage.getCompany(goCompanyId);
    const members = await storage.getGroupMembers(goCompanyId);
    const union = new Set<string>([...(goCompany?.sources ?? [])]);
    for (const m of members) {
      const memberCompany = await storage.getCompany(m.id);
      for (const s of memberCompany?.sources ?? []) union.add(s);
    }
    return [...union];
  };

  // Companies
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Parse query parameters for pagination and search
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
      const search = (req.query.search as string || "").toLowerCase();
      const status = req.query.status as string | undefined;
      
      const isLite = req.query.lite === "true";
      let rawCompanies: Awaited<ReturnType<typeof storage.getCompaniesWithSiteCount>>;
      let allSitesForCompliance: Awaited<ReturnType<typeof storage.getSitesWithDetails>>;
      let perCompanyModuleScores: Awaited<ReturnType<typeof computePerCompanyModuleScores>>;
      if (isLite) {
        rawCompanies = await storage.getCompaniesWithSiteCount();
        allSitesForCompliance = [];
        perCompanyModuleScores = new Map();
      } else {
        [rawCompanies, allSitesForCompliance, perCompanyModuleScores] = await Promise.all([
          storage.getCompaniesWithSiteCount(),
          storage.getSitesWithDetails(),
          computePerCompanyModuleScores(user),
        ]);
      }

      // Aggregate site-level compliance summaries into company-level totals
      type ComplianceAccum = { compliant: number; total: number; totalDocs: number; approvalRequired: number; overdue: number; missing: number; };
      const complianceAccum = new Map<string, ComplianceAccum>();
      const moduleDocAccum = new Map<string, { health_safety: number; human_resources: number; employment_law: number }>();
      for (const site of allSitesForCompliance) {
        if (!site.complianceSummary) continue;
        const s = site.complianceSummary;
        const existing = complianceAccum.get(site.companyId);
        if (existing) {
          existing.compliant += s.compliantDocuments;
          existing.total += s.totalDocuments;
          existing.totalDocs += s.totalAllDocuments;
          existing.approvalRequired += s.approvalRequired;
          existing.overdue += s.overdueDocuments;
          existing.missing += s.missingRequiredDocuments;
        } else {
          complianceAccum.set(site.companyId, {
            compliant: s.compliantDocuments,
            total: s.totalDocuments,
            totalDocs: s.totalAllDocuments,
            approvalRequired: s.approvalRequired,
            overdue: s.overdueDocuments,
            missing: s.missingRequiredDocuments,
          });
        }
        const mdc = site.moduleDocCounts;
        if (mdc) {
          const existingMdc = moduleDocAccum.get(site.companyId);
          if (existingMdc) {
            existingMdc.health_safety += mdc.health_safety;
            existingMdc.human_resources += mdc.human_resources;
            existingMdc.employment_law += mdc.employment_law;
          } else {
            moduleDocAccum.set(site.companyId, { health_safety: mdc.health_safety, human_resources: mdc.human_resources, employment_law: mdc.employment_law });
          }
        }
      }

      // Build new objects (spread) so complianceSummary is a plain own property
      const allCompanies = rawCompanies.map(c => {
        const acc = complianceAccum.get(c.id);
        // Use the per-company module scores computed by computePerCompanyModuleScores,
        // which mirrors computeSlotBasedCompliance exactly (correct deduplication across sites).
        const moduleScores = perCompanyModuleScores.get(c.id);
        const moduleDocCounts = moduleDocAccum.get(c.id);
        if (!acc) return { ...c, moduleScores, moduleDocCounts };
        const scoreDenom = acc.compliant + acc.approvalRequired + acc.overdue + acc.missing;
        return {
          ...c,
          moduleScores,
          moduleDocCounts,
          complianceSummary: {
            totalDocuments: acc.total,
            compliantDocuments: acc.compliant,
            approvalRequired: acc.approvalRequired,
            overdueDocuments: acc.overdue,
            missingRequiredDocuments: acc.missing,
            complianceScore: scoreDenom > 0 ? Math.round((acc.compliant / scoreDenom) * 100) : 0,
            totalAllDocuments: acc.totalDocs,
            allDocuments: acc.totalDocs,
            allCompliantDocuments: 0,
            allApprovalRequired: 0,
            allOverdueDocuments: 0,
            pendingApprovals: 0,
            awaitingYourApproval: 0,
            awaitingOthersApproval: 0,
          },
        };
      });

      let filteredCompanies = allCompanies;
      
      // Role-based filtering
      const myAssigned = req.query.myAssigned === "true";
      if (user.role === "consultant" || user.role === "administrator") {
        const mySources = user.sources ?? [];
        if (hasProPrivileges(user) && !myAssigned) {
          // Pro consultants see companies whose sources overlap with their own,
          // PLUS GO companies whose effective sources (own + members') overlap,
          // PLUS member companies of any visible GO
          const directlyVisible = new Set(
            allCompanies.filter(c => sourcesOverlap(mySources, c.sources ?? [])).map(c => c.id)
          );
          // Expand: GO companies visible via effective sources
          for (const c of allCompanies) {
            if (!directlyVisible.has(c.id)) {
              const effective = await getEffectiveGoSources(c.id);
              if (sourcesOverlap(mySources, effective)) directlyVisible.add(c.id);
            }
          }
          // Expand: member companies of any visible GO — only if member shares a source with this user
          const goExpandedIds = new Set<string>(directlyVisible);
          for (const cId of directlyVisible) {
            const members = await storage.getGroupMembers(cId);
            for (const m of members) {
              if (sourcesOverlap(mySources, m.sources ?? [])) goExpandedIds.add(m.id);
            }
          }
          filteredCompanies = allCompanies.filter(c => goExpandedIds.has(c.id));
        } else {
          // Standard consultants (or pro with myAssigned=true) see only their assigned companies
          // (including companies of any consultant they're actively covering for)
          // that also share at least one source, PLUS member companies of any GO they're assigned to
          const effectiveSiteIds = await getEffectiveSiteIds(user.id);
          const siteCompanyIds = new Set<string>();
          for (const siteId of effectiveSiteIds) {
            const site = await storage.getSite(siteId);
            if (site) siteCompanyIds.add(site.companyId);
          }
          // Source-overlapping assigned companies (coverage sites are allowed regardless of source)
          const ownAssignments = await storage.getConsultantSites(user.id);
          const directAssignedSiteIds = new Set(ownAssignments.map(a => a.siteId));
          const directCompanyIds = new Set<string>();
          for (const siteId of directAssignedSiteIds) {
            const site = await storage.getSite(siteId);
            if (site) directCompanyIds.add(site.companyId);
          }
          const sourceOverlapCompanyIds = new Set(
            [...directCompanyIds].filter(cId => {
              const co = allCompanies.find(c => c.id === cId);
              return co && sourcesOverlap(mySources, co.sources ?? []);
            })
          );
          // Add coverage-derived companies only (no source check needed for coverage)
          // Coverage-derived = effectiveSiteIds minus the consultant's own direct assignments
          const coverageCompanyIds = new Set<string>();
          for (const siteId of effectiveSiteIds) {
            if (!directAssignedSiteIds.has(siteId)) {
              const site = await storage.getSite(siteId);
              if (site) coverageCompanyIds.add(site.companyId);
            }
          }
          for (const cId of coverageCompanyIds) sourceOverlapCompanyIds.add(cId);
          // GO expansion: member companies of any source-overlapping GO (no member source check)
          const goExpandedIds = new Set<string>(sourceOverlapCompanyIds);
          for (const cId of sourceOverlapCompanyIds) {
            const members = await storage.getGroupMembers(cId);
            for (const m of members) goExpandedIds.add(m.id);
          }
          filteredCompanies = allCompanies.filter(c => goExpandedIds.has(c.id));
        }
      } else if (user.role === "client" && user.companyId) {
        const effectiveIds = await getEffectiveCompanyIds(user.companyId);
        filteredCompanies = allCompanies.filter(c => effectiveIds.has(c.id));
      } else if (user.role !== "developer") {
        filteredCompanies = [];
      }

      // Admin/Pro: staffId filter — narrow to companies where a specific consultant is assigned
      const staffId = req.query.staffId as string | undefined;
      if (staffId && (user.role === "developer" || hasProPrivileges(user))) {
        const staffAssignments = await storage.getConsultantSites(staffId);
        const staffCompanyIds = new Set<string>();
        for (const a of staffAssignments) {
          const site = await storage.getSite(a.siteId);
          if (site) staffCompanyIds.add(site.companyId);
        }
        filteredCompanies = filteredCompanies.filter(c => staffCompanyIds.has(c.id));
      }
      
      // Apply group filter — show the GO itself plus all its members
      const groupFilter = req.query.groupFilter as string | undefined;
      if (groupFilter && groupFilter !== "all") {
        filteredCompanies = filteredCompanies.filter(
          c => c.id === groupFilter || c.groupOwnerId === groupFilter
        );
      }
      // Apply groupOwnerId filter — show only member companies of a specific group owner
      const groupOwnerIdFilter = req.query.groupOwnerId as string | undefined;
      if (groupOwnerIdFilter) {
        filteredCompanies = filteredCompanies.filter(c => c.groupOwnerId === groupOwnerIdFilter);
      }

      // Apply status filter
      if (status && status !== "all") {
        filteredCompanies = filteredCompanies.filter(c => c.status === status);
      }
      
      // Apply search filter
      if (search) {
        filteredCompanies = filteredCompanies.filter(c => 
          c.name.toLowerCase().includes(search) ||
          c.companyNumber?.toLowerCase().includes(search) ||
          c.internalCompanyNumber?.toLowerCase().includes(search) ||
          c.searchTag?.toLowerCase().includes(search)
        );
      }
      
      // Sort alphabetically
      filteredCompanies.sort((a, b) => a.name.localeCompare(b.name));
      
      // Paginate
      const total = filteredCompanies.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const paginatedCompanies = filteredCompanies.slice(start, start + limit);
      
      res.json({
        companies: paginatedCompanies,
        total,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      console.error("Companies error:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });
  
  // Compliance-only endpoint — returns a map of companyId → compliance data for all
  // companies visible to this user. Called as the "phase 2" background fetch after the
  // lite (fast) companies list has already rendered.
  app.get("/api/companies/compliance", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const [rawCompanies, allSitesForCompliance, perCompanyModuleScores] = await Promise.all([
        storage.getCompaniesWithSiteCount(),
        storage.getSitesWithDetails(),
        computePerCompanyModuleScores(user),
      ]);

      type ComplianceAccum = { compliant: number; total: number; totalDocs: number; approvalRequired: number; overdue: number; missing: number; };
      const complianceAccum = new Map<string, ComplianceAccum>();
      const moduleDocAccum = new Map<string, { health_safety: number; human_resources: number; employment_law: number }>();
      for (const site of allSitesForCompliance) {
        if (!site.complianceSummary) continue;
        const s = site.complianceSummary;
        const existing = complianceAccum.get(site.companyId);
        if (existing) {
          existing.compliant += s.compliantDocuments;
          existing.total += s.totalDocuments;
          existing.totalDocs += s.totalAllDocuments;
          existing.approvalRequired += s.approvalRequired;
          existing.overdue += s.overdueDocuments;
          existing.missing += s.missingRequiredDocuments;
        } else {
          complianceAccum.set(site.companyId, {
            compliant: s.compliantDocuments, total: s.totalDocuments, totalDocs: s.totalAllDocuments,
            approvalRequired: s.approvalRequired, overdue: s.overdueDocuments, missing: s.missingRequiredDocuments,
          });
        }
        const mdc = site.moduleDocCounts;
        if (mdc) {
          const existingMdc = moduleDocAccum.get(site.companyId);
          if (existingMdc) {
            existingMdc.health_safety += mdc.health_safety;
            existingMdc.human_resources += mdc.human_resources;
            existingMdc.employment_law += mdc.employment_law;
          } else {
            moduleDocAccum.set(site.companyId, { health_safety: mdc.health_safety, human_resources: mdc.human_resources, employment_law: mdc.employment_law });
          }
        }
      }

      const allCompanies = rawCompanies.map(c => {
        const acc = complianceAccum.get(c.id);
        const moduleScores = perCompanyModuleScores.get(c.id);
        const moduleDocCounts = moduleDocAccum.get(c.id);
        if (!acc) return { ...c, moduleScores, moduleDocCounts, complianceSummary: undefined as any };
        const scoreDenom = acc.compliant + acc.approvalRequired + acc.overdue + acc.missing;
        return {
          ...c, moduleScores, moduleDocCounts,
          complianceSummary: {
            totalDocuments: acc.total, compliantDocuments: acc.compliant,
            approvalRequired: acc.approvalRequired, overdueDocuments: acc.overdue,
            missingRequiredDocuments: acc.missing,
            complianceScore: scoreDenom > 0 ? Math.round((acc.compliant / scoreDenom) * 100) : 0,
            totalAllDocuments: acc.totalDocs, allDocuments: acc.totalDocs,
            allCompliantDocuments: 0, allApprovalRequired: 0, allOverdueDocuments: 0,
            pendingApprovals: 0, awaitingYourApproval: 0, awaitingOthersApproval: 0,
          },
        };
      });

      let filteredCompanies = allCompanies;
      if (user.role === "consultant" || user.role === "administrator") {
        const mySources = user.sources ?? [];
        if (hasProPrivileges(user)) {
          const directlyVisible = new Set(allCompanies.filter(c => sourcesOverlap(mySources, c.sources ?? [])).map(c => c.id));
          for (const c of allCompanies) {
            if (!directlyVisible.has(c.id)) {
              const effective = await getEffectiveGoSources(c.id);
              if (sourcesOverlap(mySources, effective)) directlyVisible.add(c.id);
            }
          }
          const goExpandedIds = new Set<string>(directlyVisible);
          for (const cId of directlyVisible) {
            const members = await storage.getGroupMembers(cId);
            for (const m of members) { if (sourcesOverlap(mySources, m.sources ?? [])) goExpandedIds.add(m.id); }
          }
          filteredCompanies = allCompanies.filter(c => goExpandedIds.has(c.id));
        } else {
          const effectiveSiteIds = await getEffectiveSiteIds(user.id);
          const ownAssignments = await storage.getConsultantSites(user.id);
          const directAssignedSiteIds = new Set(ownAssignments.map(a => a.siteId));
          const directCompanyIds = new Set<string>();
          for (const siteId of directAssignedSiteIds) { const site = await storage.getSite(siteId); if (site) directCompanyIds.add(site.companyId); }
          const sourceOverlapCompanyIds = new Set([...directCompanyIds].filter(cId => { const co = allCompanies.find(c => c.id === cId); return co && sourcesOverlap(mySources, co.sources ?? []); }));
          for (const siteId of effectiveSiteIds) { if (!directAssignedSiteIds.has(siteId)) { const site = await storage.getSite(siteId); if (site) sourceOverlapCompanyIds.add(site.companyId); } }
          const goExpandedIds = new Set<string>(sourceOverlapCompanyIds);
          for (const cId of sourceOverlapCompanyIds) { const members = await storage.getGroupMembers(cId); for (const m of members) goExpandedIds.add(m.id); }
          filteredCompanies = allCompanies.filter(c => goExpandedIds.has(c.id));
        }
      } else if (user.role === "client" && user.companyId) {
        const effectiveIds = await getEffectiveCompanyIds(user.companyId);
        filteredCompanies = allCompanies.filter(c => effectiveIds.has(c.id));
      } else if (user.role !== "developer") {
        filteredCompanies = [];
      }

      const result: Record<string, any> = {};
      for (const c of filteredCompanies) {
        result[c.id] = { complianceSummary: c.complianceSummary, moduleScores: c.moduleScores, moduleDocCounts: c.moduleDocCounts };
      }
      res.json(result);
    } catch (error) {
      console.error("Companies compliance error:", error);
      res.status(500).json({ error: "Failed to fetch compliance" });
    }
  });

  // Get single company with sites
  app.get("/api/companies/:companyId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const company = await storage.getCompany(req.params.companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Check access
      if (user.role === "consultant" || user.role === "administrator") {
        const mySources = user.sources ?? [];
        if (hasProPrivileges(user)) {
          // Pro consultants can access companies that share at least one source,
          // OR are member companies of any GO whose effective sources (own + members' union) overlap
          const directAccess = sourcesOverlap(mySources, company.sources ?? []);
          if (!directAccess) {
            if (company.groupOwnerId) {
              const goEffective = await getEffectiveGoSources(company.groupOwnerId);
              if (!sourcesOverlap(mySources, goEffective)) {
                return res.status(403).json({ error: "Access denied" });
              }
            } else {
              return res.status(403).json({ error: "Access denied" });
            }
          }
        } else {
          // Standard consultants: must be assigned to a site in this company (with source overlap)
          // OR this company is a GO member of an assigned company (GO effective source check)
          const assignments = await storage.getConsultantSites(user.id);
          const siteCompanyIds = new Set<string>();
          for (const a of assignments) {
            const site = await storage.getSite(a.siteId);
            if (site) siteCompanyIds.add(site.companyId);
          }
          const isDirectlyAssigned = siteCompanyIds.has(company.id) && sourcesOverlap(mySources, company.sources ?? []);
          let isGoMemberOfAssigned = false;
          if (company.groupOwnerId) {
            const goEffective = await getEffectiveGoSources(company.groupOwnerId);
            isGoMemberOfAssigned = siteCompanyIds.has(company.groupOwnerId) && sourcesOverlap(mySources, goEffective);
          }
          if (!isDirectlyAssigned && !isGoMemberOfAssigned) {
            return res.status(403).json({ error: "Access denied" });
          }
        }
      } else if (user.role === "client") {
        if (!user.companyId) return res.status(403).json({ error: "Access denied" });
        const effectiveIds = await getEffectiveCompanyIds(user.companyId);
        if (!effectiveIds.has(company.id)) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (user.role !== "developer") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get sites for this company (optimized - only fetches this company's sites)
      const companySites = await storage.getSitesWithDetailsByCompanyId(company.id);

      // Fetch GO metadata
      const [groupMembers, groupOwner] = await Promise.all([
        storage.getGroupMembers(company.id),
        company.groupOwnerId ? storage.getCompany(company.groupOwnerId) : Promise.resolve(null),
      ]);

      // For GO companies, compute effective sources as union of all member sources
      const isGroupOwner = groupMembers.length > 0;
      const computedSources = isGroupOwner ? await getEffectiveGoSources(company.id) : null;
      
      res.json({
        ...company,
        sites: companySites,
        isGroupOwner,
        groupOwnerName: groupOwner?.name ?? null,
        groupOwnerId: company.groupOwnerId ?? null,
        groupMembers,
        computedSources,
      });
    } catch (error) {
      console.error("Company detail error:", error);
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  // Company stats: document counts by module, case count, incident count
  app.get("/api/companies/:companyId/stats", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const company = await storage.getCompany(req.params.companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });

      if (user.role === "consultant" || user.role === "administrator") {
        const mySources = user.sources ?? [];
        if (hasProPrivileges(user)) {
          // Pro consultants can access stats for companies that share at least one source,
          // OR are GO members of a GO whose effective sources overlap
          const directAccess = sourcesOverlap(mySources, company.sources ?? []);
          if (!directAccess) {
            if (company.groupOwnerId) {
              const goEffective = await getEffectiveGoSources(company.groupOwnerId);
              if (!sourcesOverlap(mySources, goEffective)) {
                return res.status(403).json({ error: "Access denied" });
              }
            } else {
              return res.status(403).json({ error: "Access denied" });
            }
          }
        } else {
          // Standard consultants: must be assigned to a site in this company (with source overlap)
          // OR this company is a GO member of an assigned company (GO effective source check)
          const assignments = await storage.getConsultantSites(user.id);
          const siteCompanyIds = new Set<string>();
          for (const a of assignments) {
            const site = await storage.getSite(a.siteId);
            if (site) siteCompanyIds.add(site.companyId);
          }
          const isDirectlyAssigned = siteCompanyIds.has(company.id) && sourcesOverlap(mySources, company.sources ?? []);
          let isGoMemberOfAssigned = false;
          if (company.groupOwnerId) {
            const goEffective = await getEffectiveGoSources(company.groupOwnerId);
            isGoMemberOfAssigned = siteCompanyIds.has(company.groupOwnerId) && sourcesOverlap(mySources, goEffective);
          }
          if (!isDirectlyAssigned && !isGoMemberOfAssigned) return res.status(403).json({ error: "Access denied" });
        }
      } else if (user.role === "client") {
        if (!user.companyId) return res.status(403).json({ error: "Access denied" });
        const effectiveIds = await getEffectiveCompanyIds(user.companyId);
        if (!effectiveIds.has(company.id)) return res.status(403).json({ error: "Access denied" });
      } else if (user.role !== "developer") {
        return res.status(403).json({ error: "Access denied" });
      }

      const companyId = req.params.companyId;

      const docRows = await pool.query(
        `SELECT module, COUNT(*) as count FROM documents WHERE entity_id = $1 AND is_archived = false GROUP BY module`,
        [companyId]
      );
      const documents: Record<string, number> = {};
      for (const row of docRows.rows) documents[row.module] = parseInt(row.count, 10);

      const caseRow = await pool.query(
        `SELECT COUNT(*) as count FROM cases WHERE entity_id = $1 AND is_archived = false`,
        [companyId]
      );
      const incidentRow = await pool.query(
        `SELECT COUNT(*) as count FROM incidents WHERE entity_id = $1`,
        [companyId]
      );

      res.json({
        documents,
        cases: parseInt(caseRow.rows[0].count, 10),
        incidents: parseInt(incidentRow.rows[0].count, 10),
      });
    } catch (error) {
      console.error("Company stats error:", error);
      res.status(500).json({ error: "Failed to fetch company stats" });
    }
  });

  // ── Group Owner routes ──────────────────────────────────────────────────────

  // GET /api/companies/:companyId/group — list companies that belong to this GO
  // Admin: unrestricted. Consultant/client: must have access to the GO company itself.
  app.get("/api/companies/:companyId/group", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const company = await storage.getCompany(req.params.companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });

      // Access check (mirrors company detail rules)
      if (user.role !== "developer") {
        const mySources = user.sources ?? [];
        if (user.role === "consultant" || user.role === "administrator") {
          if (hasProPrivileges(user)) {
            if (!sourcesOverlap(mySources, company.sources ?? [])) {
              return res.status(403).json({ error: "Access denied" });
            }
          } else {
            const assignments = await storage.getConsultantSites(user.id);
            const siteCompanyIds = new Set<string>();
            for (const a of assignments) {
              const site = await storage.getSite(a.siteId);
              if (site) siteCompanyIds.add(site.companyId);
            }
            if (!siteCompanyIds.has(company.id) || !sourcesOverlap(mySources, company.sources ?? [])) {
              return res.status(403).json({ error: "Access denied" });
            }
          }
        } else if (user.role === "client") {
          if (!user.companyId) return res.status(403).json({ error: "Access denied" });
          const effectiveIds = await getEffectiveCompanyIds(user.companyId);
          if (!effectiveIds.has(company.id)) return res.status(403).json({ error: "Access denied" });
        } else {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const members = await storage.getGroupMembers(req.params.companyId);
      res.json(members);
    } catch (error) {
      console.error("Group members error:", error);
      res.status(500).json({ error: "Failed to fetch group members" });
    }
  });

  // GET /api/companies/:companyId/accelo-links — admin (unrestricted) + consultant (company-scoped)
  app.get("/api/companies/:companyId/accelo-links", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") return res.status(403).json({ error: "Forbidden" });

      if (user.role === "consultant" || user.role === "administrator") {
        const company = await storage.getCompany(req.params.companyId);
        if (!company) return res.status(404).json({ error: "Company not found" });
        const mySources = user.sources ?? [];
        if (hasProPrivileges(user)) {
          const directAccess = sourcesOverlap(mySources, company.sources ?? []);
          if (!directAccess) {
            if (company.groupOwnerId) {
              const goEffective = await getEffectiveGoSources(company.groupOwnerId);
              if (!sourcesOverlap(mySources, goEffective)) return res.status(403).json({ error: "Access denied" });
            } else {
              return res.status(403).json({ error: "Access denied" });
            }
          }
        } else {
          const assignments = await storage.getConsultantSites(user.id);
          const siteCompanyIds = new Set<string>();
          for (const a of assignments) {
            const site = await storage.getSite(a.siteId);
            if (site) siteCompanyIds.add(site.companyId);
          }
          const isDirectlyAssigned = siteCompanyIds.has(company.id) && sourcesOverlap(mySources, company.sources ?? []);
          let isGoMemberOfAssigned = false;
          if (company.groupOwnerId) {
            const goEffective = await getEffectiveGoSources(company.groupOwnerId);
            isGoMemberOfAssigned = siteCompanyIds.has(company.groupOwnerId) && sourcesOverlap(mySources, goEffective);
          }
          if (!isDirectlyAssigned && !isGoMemberOfAssigned) return res.status(403).json({ error: "Access denied" });
        }
      }

      const links = await storage.getAcceloLinksByCompany(req.params.companyId);
      res.json(links);
    } catch (err) {
      console.error("Accelo links fetch error:", err);
      res.status(500).json({ error: "Failed to fetch Accelo links" });
    }
  });

  // POST /api/companies/:companyId/accelo-link — upsert an Accelo link (admin + pro consultant)
  app.post("/api/companies/:companyId/accelo-link", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "developer" && !hasProPrivileges(user)) return res.status(403).json({ error: "Forbidden" });
      const { sourceCode, acceloId, acceloStanding, acceloType, acceloColor } = req.body as { sourceCode: string; acceloId: string; acceloStanding?: string | null; acceloType?: string | null; acceloColor?: string | null };
      if (!sourceCode || !acceloId) return res.status(400).json({ error: "Missing sourceCode or acceloId" });
      await storage.upsertAcceloLink(req.params.companyId, String(sourceCode).toUpperCase(), String(acceloId), acceloStanding ?? null, acceloType ?? null, acceloColor ?? null);
      const importedCompany = await storage.getCompany(req.params.companyId).catch(() => null);
      await storage.createAcceloSyncLog({
        syncType: "import",
        sourceCode: String(sourceCode).toUpperCase(),
        triggeredBy: user.id,
        triggeredByName: user.fullName || user.email,
        companyId: req.params.companyId,
        companyName: importedCompany?.name ?? null,
        companiesTotal: 1,
        companiesUpdated: 1,
        success: true,
      }).catch(() => {});
      res.json({ ok: true });
    } catch (err) {
      console.error("Accelo link upsert error:", err);
      res.status(500).json({ error: "Failed to upsert Accelo link" });
    }
  });

  // POST /api/companies/:companyId/accelo-sync — re-fetch type + standing for all Accelo links (admin + pro consultant)
  app.post("/api/companies/:companyId/accelo-sync", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "developer" && !hasProPrivileges(user)) return res.status(403).json({ error: "Forbidden" });
      const links = await storage.getAcceloLinksByCompany(req.params.companyId);
      if (links.length === 0) return res.json({ updated: 0 });
      const company = await storage.getCompany(req.params.companyId);
      let updated = 0;
      const sourcesSynced = new Set<string>();
      for (const link of links) {
        try {
          if (!canAccessAcceloSource(user, link.sourceCode)) continue;
          const data = await acceloGet(link.sourceCode, `/companies/${link.acceloId}?_fields=id,standing,company_status(id,title,color)`);
          const r = data?.response;
          const rawStatus = r?.company_status;
          const acceloType = rawStatus
            ? (typeof rawStatus === "string" ? rawStatus : (rawStatus?.title ?? null))
            : null;
          const acceloColor = rawStatus && typeof rawStatus === "object" ? (rawStatus?.color ?? null) : null;
          if (r) {
            await storage.upsertAcceloLink(req.params.companyId, link.sourceCode, link.acceloId, r.standing ?? null, acceloType || null, acceloColor);
            updated++;
            sourcesSynced.add(link.sourceCode);
          }
        } catch (linkErr: any) {
          if (linkErr.message?.includes("no tokens stored") || linkErr.message?.includes("not connected")) {
            throw linkErr;
          }
          console.warn(`[accelo-sync] Failed for source=${link.sourceCode} id=${link.acceloId}:`, linkErr.message);
          await storage.createAcceloSyncLog({
            syncType: "manual",
            sourceCode: link.sourceCode,
            triggeredBy: user.id,
            triggeredByName: user.fullName || user.email,
            companyId: req.params.companyId,
            companyName: company?.name ?? null,
            companiesTotal: 1,
            companiesUpdated: 0,
            success: false,
            errorMessage: linkErr.message,
          }).catch(() => {});
        }
      }
      for (const sourceCode of sourcesSynced) {
        await storage.createAcceloSyncLog({
          syncType: "manual",
          sourceCode,
          triggeredBy: user.id,
          triggeredByName: user.fullName || user.email,
          companyId: req.params.companyId,
          companyName: company?.name ?? null,
          companiesTotal: 1,
          companiesUpdated: 1,
          success: true,
        }).catch(() => {});
      }
      res.json({ updated });
    } catch (err: any) {
      if (err.message?.includes("no tokens stored") || err.message?.includes("not connected")) {
        return res.status(503).json({ error: "Accelo not connected for this source" });
      }
      console.error("Accelo sync error:", err);
      res.status(500).json({ error: "Failed to sync Accelo data" });
    }
  });

  // GET /api/developer/accelo-sync-logs — admin only
  app.get("/api/developer/accelo-sync-logs", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Forbidden" });
      const limit = Math.min(parseInt(req.query.limit as string || "200", 10), 500);
      const logs = await storage.getAcceloSyncLogs(limit);
      res.json(logs);
    } catch (err) {
      console.error("Accelo sync logs error:", err);
      res.status(500).json({ error: "Failed to fetch sync logs" });
    }
  });

  // GET /api/developer/scheduled-tasks — list all server scheduled tasks + current env status
  app.get("/api/developer/scheduled-tasks", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Forbidden" });
      const environment = process.env.NODE_ENV === "production" ? "production" : "development";

      // Fetch last run times in parallel
      const [folderCleanupRun, documentSweepRun, acceloLastRows] = await Promise.all([
        storage.getSchedulerRun("folder-cleanup"),
        storage.getSchedulerRun("document-sweep"),
        storage.getAcceloSyncLogs(1),
      ]);
      const acceloLastScheduled = acceloLastRows.find(r => r.syncType === "scheduled");

      const tasks = [
        {
          id: "folder-cleanup",
          name: "Expired Folder Cleanup",
          description: "Deletes client upload files past their 30-day expiry, then removes any folders that are empty or past their safety-net date",
          schedule: "Daily at 03:00 UK",
          runsIn: "all" as const,
          lastRunAt: folderCleanupRun ? new Date(folderCleanupRun).toISOString() : null,
        },
        {
          id: "document-sweep",
          name: "Expired Document Sweep",
          description: "Marks overdue documents as expired and auto-corrects any misclassified compliant documents",
          schedule: "Daily at 05:00 UK",
          runsIn: "all" as const,
          lastRunAt: documentSweepRun ? new Date(documentSweepRun).toISOString() : null,
        },
        {
          id: "accelo-status-sync",
          name: "Accelo Status Sync",
          description: "Fetches the latest standing and company status from Accelo for all linked companies",
          schedule: "Daily at 07:00 UK",
          runsIn: "production" as const,
          lastRunAt: acceloLastScheduled?.syncedAt ? new Date(acceloLastScheduled.syncedAt).toISOString() : null,
        },
      ];

      res.json({ environment, tasks });
    } catch (err) {
      console.error("Scheduled tasks error:", err);
      res.status(500).json({ error: "Failed to fetch scheduled tasks" });
    }
  });

  // PATCH /api/companies/:companyId/group-owner — set or remove a company's group owner (admin + pro consultant)
  app.patch("/api/companies/:companyId/group-owner", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role !== "developer" && !hasProPrivileges(user)) return res.status(403).json({ error: "Developers and Pro consultants only" });

      const company = await storage.getCompany(req.params.companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });

      // Pro consultants / Admins may only manage companies within their own source access
      if (hasProPrivileges(user)) {
        const mySources = Array.isArray(user.sources) ? user.sources : [];
        const companySources = Array.isArray(company.sources) ? company.sources : [];
        if (!sourcesOverlap(mySources, companySources)) {
          return res.status(403).json({ error: "You do not have source access to this company" });
        }
      }

      const { groupOwnerId } = req.body as { groupOwnerId: string | null };

      // Validate: cannot link a GO to another GO (no nesting)
      if (groupOwnerId) {
        const proposedGO = await storage.getCompany(groupOwnerId);
        if (!proposedGO) return res.status(400).json({ error: "Proposed Group Owner not found" });
        if (proposedGO.groupOwnerId) return res.status(400).json({ error: "A Group Owner cannot itself belong to another Group Owner" });
        // Prevent self-linking
        if (groupOwnerId === req.params.companyId) return res.status(400).json({ error: "A company cannot be its own Group Owner" });
        // Prevent the target GO from being a member company (i.e., it must not have a groupOwnerId set)
        const targetMembers = await storage.getGroupMembers(req.params.companyId);
        if (targetMembers.length > 0) return res.status(400).json({ error: "A Group Owner cannot be linked to another Group Owner" });
      }

      const updated = await storage.setGroupOwner(req.params.companyId, groupOwnerId ?? null);
      if (!updated) return res.status(500).json({ error: "Failed to update" });

      // When linking a member company to a GO, propagate any "share to all"
      // group-scoped documents and required templates from the GO down to the
      // new member company.
      if (groupOwnerId) {
        await storage.autoShareGroupDocumentsToCompany(groupOwnerId, req.params.companyId);
        await storage.cascadeGroupRequiredsToMember(groupOwnerId, req.params.companyId);
      }

      // When linking a member company to a GO, auto-assign the GO's primary contact to all member's sites
      if (groupOwnerId) {
        const goCompany = await storage.getCompany(groupOwnerId);
        if (goCompany && goCompany.contactUserId) {
          const goPrimaryContact = await storage.getUser(goCompany.contactUserId);
          if (goPrimaryContact && goPrimaryContact.role === "client" && goPrimaryContact.companyId === groupOwnerId) {
            const memberSites = await storage.getSitesByCompanyId(req.params.companyId);
            for (const site of memberSites) {
              await storage.assignClientToSite({
                clientId: goPrimaryContact.id,
                siteId: site.id,
                assignedBy: user.id,
              });
            }
            if (memberSites.length > 0) {
              await storage.createAuditLog({
                action: "primary_contact_auto_assigned",
                entityType: "company",
                entityId: req.params.companyId,
                userId: user.id,
                userName: user.fullName,
                details: `Group Owner primary contact ${goPrimaryContact.fullName} auto-assigned to ${memberSites.length} site(s) of newly-linked member company`,
                metadata: { contactUserId: goPrimaryContact.id, siteCount: memberSites.length, groupOwnerId },
              });
            }
          }
        }
      }

      await emitCompanyScoped("company-updated", req.params.companyId, { companyId: req.params.companyId });
      if (groupOwnerId) await emitCompanyScoped("company-updated", groupOwnerId, { companyId: groupOwnerId });

      res.json(updated);
    } catch (error) {
      console.error("Set group owner error:", error);
      res.status(500).json({ error: "Failed to set group owner" });
    }
  });

  // Create company
  app.post("/api/companies", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role !== "developer" && !hasProPrivileges(user)) {
        return res.status(403).json({ error: "Only developers and pro consultants can create companies" });
      }
      
      const { name, companyNumber, internalCompanyNumber, website, address, contactEmail, contactPhone, site, addressLine1, addressLine2, city, county, postalCode, country, employeeRange, industry, sources } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Company name is required" });
      }
      
      if (!industry || !industry.trim()) {
        return res.status(400).json({ error: "Industry is required" });
      }
      
      if (!site || !site.name || !site.name.trim()) {
        return res.status(400).json({ error: "At least one site with a name is required when creating a company" });
      }

      if (!Array.isArray(sources) || sources.length === 0) {
        return res.status(400).json({ error: "At least one source is required for a company" });
      }

      // Pro consultants / Admins may only assign sources that are within their own source list
      if (hasProPrivileges(user) && user.role !== "developer") {
        const allowedSources = Array.isArray(user.sources) ? user.sources : [];
        const forbidden = sources.filter((s: string) => !allowedSources.includes(s));
        if (forbidden.length > 0) {
          return res.status(403).json({ error: `You can only assign sources within your own access: ${forbidden.join(", ")}` });
        }
      }

      const existingCompanies = await storage.getCompanies();
      const duplicate = existingCompanies.find(
        (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicate) {
        return res.status(409).json({ error: "A company with this name already exists" });
      }

      if (companyNumber && companyNumber.trim()) {
        const dupRegNo = existingCompanies.find(
          (c) => c.companyNumber && c.companyNumber.trim().toLowerCase() === companyNumber.trim().toLowerCase()
        );
        if (dupRegNo) {
          return res.status(409).json({ error: "A company with this Registered Company Number already exists" });
        }
      }

      if (internalCompanyNumber && internalCompanyNumber.trim()) {
        const dupIntNo = existingCompanies.find(
          (c) => c.internalCompanyNumber && c.internalCompanyNumber.trim().toLowerCase() === internalCompanyNumber.trim().toLowerCase()
        );
        if (dupIntNo) {
          return res.status(409).json({ error: "A company with this Internal Company Number already exists" });
        }
      }
      
      const company = await storage.createCompany({
        name: name.trim(),
        companyNumber: companyNumber || null,
        internalCompanyNumber: internalCompanyNumber || null,
        website: website || null,
        address: address || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        county: county || null,
        postalCode: postalCode || null,
        country: country || null,
        employeeRange: employeeRange || null,
        industry: industry.trim(),
        sources: Array.isArray(sources) ? sources : null,
      });
      
      await storage.createSite({
        name: site.name.trim(),
        companyId: company.id,
        addressLine1: site.addressLine1 || null,
        addressLine2: site.addressLine2 || null,
        city: site.city || null,
        county: site.county || null,
        postalCode: site.postalCode || null,
        country: site.country || null,
        contactName: site.contactName || null,
        contactPosition: site.contactPosition || null,
        contactPhone: site.contactPhone || null,
        contactEmail: site.contactEmail || null,
      });
      
      // Emit company-updated so admins/consultants see new companies in real time
      try {
        emitToRole("developer", "company-updated", { companyId: company.id });
        emitToRole("consultant", "company-updated", { companyId: company.id });
      } catch { /* non-fatal */ }

      res.status(201).json(company);
    } catch (error) {
      console.error("Create company error:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  // Update company
  app.patch("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const isStandardConsultantUser = user.role === "consultant" && !isProConsultant(user);
      if (user.role !== "developer" && !hasProPrivileges(user) && !isStandardConsultantUser) {
        return res.status(403).json({ error: "Only developers and consultants can update companies" });
      }

      // Standard consultants may only set the primary contact (contactUserId) for companies they are assigned to
      if (isStandardConsultantUser) {
        const requestedKeys = Object.keys(req.body).filter(k => k !== "contactUserId");
        if (requestedKeys.length > 0) {
          return res.status(403).json({ error: "Standard consultants can only update the primary contact for a company" });
        }
        const consultantSiteAssignments = await storage.getConsultantSites(user.id);
        const assignedSiteIds = new Set(consultantSiteAssignments.map(a => a.entityId));
        const allSites = await storage.getSites();
        const assignedCompanyIds = new Set(allSites.filter(s => assignedSiteIds.has(s.id)).map(s => s.companyId));
        if (!assignedCompanyIds.has(req.params.id)) {
          return res.status(403).json({ error: "You can only manage companies you are assigned to" });
        }
      }
      
      const { name, companyNumber, internalCompanyNumber, website, address, contactEmail, contactPhone, contactName, contactPosition, contactUserId, status, addressLine1, addressLine2, city, county, postalCode, country, searchTag, employeeRange, industry, sources } = req.body;

      // Uniqueness checks — exclude the company being updated
      if (companyNumber && companyNumber.trim()) {
        const allCompaniesForCheck = await storage.getCompanies();
        const dupRegNo = allCompaniesForCheck.find(
          (c) => c.id !== req.params.id && c.companyNumber && c.companyNumber.trim().toLowerCase() === companyNumber.trim().toLowerCase()
        );
        if (dupRegNo) {
          return res.status(409).json({ error: "A company with this Registered Company Number already exists" });
        }
      }

      if (internalCompanyNumber && internalCompanyNumber.trim()) {
        const allCompaniesForIntCheck = await storage.getCompanies();
        const dupIntNo = allCompaniesForIntCheck.find(
          (c) => c.id !== req.params.id && c.internalCompanyNumber && c.internalCompanyNumber.trim().toLowerCase() === internalCompanyNumber.trim().toLowerCase()
        );
        if (dupIntNo) {
          return res.status(409).json({ error: "A company with this Internal Company Number already exists" });
        }
      }

      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (companyNumber !== undefined) updates.companyNumber = companyNumber || null;
      if (internalCompanyNumber !== undefined) updates.internalCompanyNumber = internalCompanyNumber || null;
      if (website !== undefined) updates.website = website || null;
      if (address !== undefined) updates.address = address || null;
      if (contactEmail !== undefined) updates.contactEmail = contactEmail || null;
      if (contactPhone !== undefined) updates.contactPhone = contactPhone || null;
      if (contactUserId !== undefined) updates.contactUserId = contactUserId || null;
      if (contactName !== undefined) updates.contactName = contactName || null;
      if (contactPosition !== undefined) updates.contactPosition = contactPosition || null;
      if (status !== undefined) updates.status = status;
      if (addressLine1 !== undefined) updates.addressLine1 = addressLine1 || null;
      if (addressLine2 !== undefined) updates.addressLine2 = addressLine2 || null;
      if (city !== undefined) updates.city = city || null;
      if (county !== undefined) updates.county = county || null;
      if (postalCode !== undefined) updates.postalCode = postalCode || null;
      if (country !== undefined) updates.country = country || null;
      if (searchTag !== undefined) updates.searchTag = searchTag || null;
      if (employeeRange !== undefined) updates.employeeRange = employeeRange || null;
      if (industry !== undefined) updates.industry = industry || null;
      if (sources !== undefined) {
        if (!Array.isArray(sources) || sources.length === 0) {
          return res.status(400).json({ error: "At least one source is required for a company" });
        }
        // Pro consultants may only assign sources that are within their own source list
        if (isProConsultant(user) && user.role !== "developer") {
          const allowedSources = Array.isArray(user.sources) ? user.sources : [];
          const forbidden = sources.filter((s: string) => !allowedSources.includes(s));
          if (forbidden.length > 0) {
            return res.status(403).json({ error: `You can only assign sources within your own access: ${forbidden.join(", ")}` });
          }
        }
        updates.sources = sources;
      }

      // If a contactUserId is being set, auto-populate contact fields from the user's profile
      // (only if those fields weren't explicitly provided in the request)
      let contactUser: any = null;
      if (contactUserId) {
        contactUser = await storage.getUser(contactUserId);
        if (contactUser && contactUser.role === "client" && contactUser.companyId === req.params.id) {
          if (updates.contactName === undefined) updates.contactName = contactUser.fullName || null;
          if (updates.contactEmail === undefined) updates.contactEmail = contactUser.email || null;
          if (updates.contactPhone === undefined) updates.contactPhone = contactUser.phone || contactUser.mobile || null;
          if (updates.contactPosition === undefined) updates.contactPosition = contactUser.jobTitle || null;
          // Auto-update status from pending to active when a primary contact is set
          if (updates.status === undefined) updates.status = "active";
        }
      }
      
      const existingCompanyForPatch = updates.status !== undefined ? await storage.getCompany(req.params.id) : null;
      const previousStatusForPatch = existingCompanyForPatch?.status ?? null;

      const company = await storage.updateCompany(req.params.id, updates);
      
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // If company is being suspended, immediately log out all its client users
      const patchStatusChanged = updates.status !== undefined && previousStatusForPatch !== updates.status;
      if (patchStatusChanged && (updates.status === "on_hold" || updates.status === "cancelled")) {
        const terminatedSessions = await destroyCompanyClientSessions(req.params.id);
        await storage.createAuditLog({
          action: "company_suspended",
          entityType: "company",
          entityId: req.params.id,
          userId: user.id,
          userName: user.fullName,
          details: `Company "${company.name}" status changed from ${previousStatusForPatch} to ${updates.status}. ${terminatedSessions} client session(s) terminated.`,
          metadata: { previousStatus: previousStatusForPatch, newStatus: updates.status, terminatedSessions },
        });
      } else if (
        patchStatusChanged &&
        (updates.status === "active" || updates.status === "pending") &&
        (previousStatusForPatch === "on_hold" || previousStatusForPatch === "cancelled")
      ) {
        await storage.createAuditLog({
          action: "company_reactivated",
          entityType: "company",
          entityId: req.params.id,
          userId: user.id,
          userName: user.fullName,
          details: `Company "${company.name}" status changed from ${previousStatusForPatch} to ${updates.status}.`,
          metadata: { previousStatus: previousStatusForPatch, newStatus: updates.status },
        });
      }

      // Auto-assign primary contact user to all company sites
      if (contactUserId) {
        if (!contactUser) contactUser = await storage.getUser(contactUserId);
        if (contactUser && contactUser.role === "client" && contactUser.companyId === req.params.id) {
          const companySites = await storage.getSitesByCompanyId(req.params.id);
          for (const site of companySites) {
            await storage.assignClientToSite({
              clientId: contactUserId,
              siteId: site.id,
              assignedBy: user.id,
            });
          }
          
          // Auto-transition client from site_required to invite_required
          if (contactUser.status === "site_required") {
            await storage.updateUser(contactUserId, { status: "invite_required" });
          }
          
          await storage.createAuditLog({
            action: "primary_contact_auto_assigned",
            entityType: "company",
            entityId: req.params.id,
            userId: user.id,
            userName: user.fullName,
            details: `Primary contact ${contactUser.fullName} auto-assigned to all ${companySites.length} company sites`,
            metadata: { contactUserId, siteCount: companySites.length },
          });

          // If this company is a Group Owner, also assign the new primary contact to all member company sites
          const groupMembers = await storage.getGroupMembers(req.params.id);
          if (groupMembers.length > 0) {
            let totalMemberSites = 0;
            for (const member of groupMembers) {
              const memberSites = await storage.getSitesByCompanyId(member.id);
              for (const site of memberSites) {
                await storage.assignClientToSite({
                  clientId: contactUserId,
                  siteId: site.id,
                  assignedBy: user.id,
                });
              }
              totalMemberSites += memberSites.length;
            }
            if (totalMemberSites > 0) {
              await storage.createAuditLog({
                action: "primary_contact_auto_assigned",
                entityType: "company",
                entityId: req.params.id,
                userId: user.id,
                userName: user.fullName,
                details: `Group Owner primary contact ${contactUser.fullName} auto-assigned to ${totalMemberSites} site(s) across ${groupMembers.length} member company(ies)`,
                metadata: { contactUserId, totalMemberSites, memberCount: groupMembers.length },
              });
            }
          }
        }
      }
      
      // Emit company-updated so admins/consultants see company changes in real time
      try {
        emitToRole("developer", "company-updated", { companyId: req.params.id });
        emitToRole("consultant", "company-updated", { companyId: req.params.id });
      } catch { /* non-fatal */ }

      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  // Update company status only
  app.patch("/api/companies/:id/status", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role !== "developer" && !hasProPrivileges(user)) {
        return res.status(403).json({ error: "Only developers and pro consultants can update company status" });
      }
      
      const { status } = req.body;
      if (!status || !["pending", "active", "on_hold", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }

      const existingCompany = await storage.getCompany(req.params.id);
      if (!existingCompany) {
        return res.status(404).json({ error: "Company not found" });
      }
      const previousStatus = existingCompany.status;
      
      const company = await storage.updateCompany(req.params.id, { status });
      
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      const statusChanged = previousStatus !== status;
      const isSuspended = status === "on_hold" || status === "cancelled";
      const isReactivated = (status === "active" || status === "pending") &&
        (previousStatus === "on_hold" || previousStatus === "cancelled");

      let terminatedSessions = 0;
      if (statusChanged && isSuspended) {
        terminatedSessions = await destroyCompanyClientSessions(req.params.id);
        await storage.createAuditLog({
          action: "company_suspended",
          entityType: "company",
          entityId: req.params.id,
          userId: user.id,
          userName: user.fullName,
          details: `Company "${company.name}" status changed from ${previousStatus} to ${status}. ${terminatedSessions} client session(s) terminated.`,
          metadata: { previousStatus, newStatus: status, terminatedSessions },
        });
      } else if (statusChanged && isReactivated) {
        await storage.createAuditLog({
          action: "company_reactivated",
          entityType: "company",
          entityId: req.params.id,
          userId: user.id,
          userName: user.fullName,
          details: `Company "${company.name}" status changed from ${previousStatus} to ${status}.`,
          metadata: { previousStatus, newStatus: status },
        });
      }
      
      await emitCompanyScoped("company-updated", req.params.id, { companyId: req.params.id });

      res.json(company);
    } catch (error) {
      console.error("Update company status error:", error);
      res.status(500).json({ error: "Failed to update company status" });
    }
  });

  app.delete("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (user.role !== "developer" && !hasProPrivileges(user)) {
        return res.status(403).json({ error: "Only developers and pro consultants can delete companies" });
      }

      const companyId = req.params.id;
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const siteRows = await client.query("SELECT id FROM sites WHERE entity_id = $1", [companyId]);
        const siteIds = siteRows.rows.map((r: any) => r.id);

        if (siteIds.length > 0) {
          const ph = siteIds.map((_: string, i: number) => `$${i + 1}`).join(",");

          await client.query(`DELETE FROM support_request_reads WHERE request_id IN (SELECT id FROM support_requests WHERE site_id IN (${ph}))`, siteIds);
          await client.query(`DELETE FROM support_messages WHERE request_id IN (SELECT id FROM support_requests WHERE site_id IN (${ph}))`, siteIds);
          await client.query(`DELETE FROM support_requests WHERE site_id IN (${ph})`, siteIds);

          await client.query(`DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE site_id IN (${ph}))`, siteIds);
          await client.query(`DELETE FROM documents WHERE site_id IN (${ph})`, siteIds);
          await client.query(`DELETE FROM document_folders WHERE site_id IN (${ph})`, siteIds);
          await client.query(`DELETE FROM site_document_type_access WHERE site_id IN (${ph})`, siteIds);

          await client.query(`DELETE FROM case_milestones WHERE case_id IN (SELECT id FROM cases WHERE site_id IN (${ph}))`, siteIds);
          await client.query(`DELETE FROM cases WHERE site_id IN (${ph})`, siteIds);

          await client.query(`DELETE FROM training_bookings WHERE site_id IN (${ph})`, siteIds);
          await client.query(`DELETE FROM training_requests WHERE site_id IN (${ph})`, siteIds);

          await client.query(`DELETE FROM consultant_assignments WHERE entity_id IN (${ph})`, siteIds);
          await client.query(`DELETE FROM client_site_assignments WHERE site_id IN (${ph})`, siteIds);
          await client.query(`DELETE FROM site_module_access WHERE site_id IN (${ph})`, siteIds);
          await client.query(`DELETE FROM module_access_requests WHERE site_id IN (${ph})`, siteIds);
        }

        await client.query(`DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE entity_id = $1)`, [companyId]);
        await client.query(`DELETE FROM documents WHERE entity_id = $1`, [companyId]);

        const userRows = await client.query("SELECT id FROM users WHERE entity_id = $1 AND role = 'client'", [companyId]);
        const userIds = userRows.rows.map((r: any) => r.id);
        if (userIds.length > 0) {
          const uph = userIds.map((_: string, i: number) => `$${i + 1}`).join(",");
          await client.query(`DELETE FROM user_invitations WHERE user_id IN (${uph})`, userIds);
          await client.query(`DELETE FROM session WHERE sess::text LIKE ANY(ARRAY[${userIds.map((_: string, i: number) => `'%' || $${i + 1} || '%'`).join(",")}])`, userIds);
        }
        await client.query("DELETE FROM users WHERE entity_id = $1 AND role = 'client'", [companyId]);

        await client.query("DELETE FROM sites WHERE entity_id = $1", [companyId]);
        await client.query("DELETE FROM companies WHERE id = $1", [companyId]);

        await client.query("COMMIT");

        await emitCompanyScoped("company-updated", companyId, { companyId, deleted: true });
        // The company row is now gone, so the helper can't resolve its group
        // owner — notify the captured group owner's clients explicitly.
        if (company.groupOwnerId) {
          emitToCompany(company.groupOwnerId, "company-updated", { companyId, deleted: true });
        }

        await storage.createAuditLog({
          userId: user.id,
          userName: user.fullName,
          action: "company_deleted",
          entityType: "company",
          entityId: companyId,
          details: `Deleted company "${company.name}" and all associated data`,
        });

        res.json({ success: true, message: `Company "${company.name}" and all associated data deleted` });
      } catch (txError) {
        await client.query("ROLLBACK");
        throw txError;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Delete company error:", error);
      res.status(500).json({ error: "Failed to delete company" });
    }
  });

  // ── Consultant Coverage ─────────────────────────────────────────────────────

  // Eligible covering consultants for a given absent consultant
  app.get("/api/consultant-coverage/eligible-consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role === "client") return res.status(403).json({ error: "Forbidden" });
      const absentConsultantId = req.query.absentConsultantId as string;
      if (!absentConsultantId) return res.status(400).json({ error: "absentConsultantId required" });
      const absentConsultant = await storage.getUser(absentConsultantId);
      if (!absentConsultant || absentConsultant.role !== "consultant") {
        return res.status(404).json({ error: "Consultant not found" });
      }
      const allConsultants = await storage.getConsultants();
      const consultants = allConsultants.filter(u =>
        u.status === "active" && u.id !== absentConsultantId && u.id !== absentConsultant.managerId
      );
      // Admins see all consultants; others filtered by source overlap.
      // If the absent consultant has no sources configured, skip the source filter
      // (no constraint defined means any consultant can cover).
      const absentSources = absentConsultant.sources ?? [];
      // Eligible if: admin, OR absent has no sources (unconstrained), OR covering consultant
      // has no sources (unconfigured = no restriction), OR there is a shared source.
      const eligible = user.role === "developer" || absentSources.length === 0
        ? consultants
        : consultants.filter(c => {
            const coveringSources = c.sources ?? [];
            return coveringSources.length === 0 || sourcesOverlap(absentSources, coveringSources);
          });
      res.json(eligible.map(c => ({ id: c.id, fullName: c.fullName, consultantTier: c.consultantTier })));
    } catch (error) {
      console.error("Eligible consultants error:", error);
      res.status(500).json({ error: "Failed to fetch eligible consultants" });
    }
  });

  // Get my active coverage entries (covering for + being covered by)
  app.get("/api/consultant-coverage/my-active", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role === "client") return res.status(403).json({ error: "Forbidden" });

      // Admins see all active arrangements
      if (user.role === "developer") {
        const allEntries = await storage.getAllCoverageEntries(false);
        const today = new Date().toISOString().split("T")[0];
        const active = allEntries.filter(e => e.startDate <= today && e.endDate >= today);
        const allIds = new Set([...active.map(e => e.absentConsultantId), ...active.map(e => e.coveringConsultantId)]);
        const userMap = new Map<string, string>();
        for (const id of allIds) {
          const u = await storage.getUser(id);
          if (u) userMap.set(id, u.fullName);
        }
        return res.json({
          coveringFor: [],
          beingCoveredBy: [],
          allActive: active.map(e => ({
            ...e,
            absentConsultantName: userMap.get(e.absentConsultantId) ?? "Unknown",
            coveringConsultantName: userMap.get(e.coveringConsultantId) ?? "Unknown",
          })),
        });
      }

      const [coveringFor, beingCoveredBy] = await Promise.all([
        storage.getActiveCoverageForCovering(user.id),
        storage.getActiveCoverageForAbsent(user.id),
      ]);
      const allIds = new Set([
        ...coveringFor.map(e => e.absentConsultantId),
        ...beingCoveredBy.map(e => e.coveringConsultantId),
      ]);
      const userMap = new Map<string, string>();
      for (const id of allIds) {
        const u = await storage.getUser(id);
        if (u) userMap.set(id, u.fullName);
      }
      res.json({
        coveringFor: coveringFor.map(e => ({ ...e, absentConsultantName: userMap.get(e.absentConsultantId) ?? "Unknown" })),
        beingCoveredBy: beingCoveredBy.map(e => ({ ...e, coveringConsultantName: userMap.get(e.coveringConsultantId) ?? "Unknown" })),
        allActive: [],
      });
    } catch (error) {
      console.error("My active coverage error:", error);
      res.status(500).json({ error: "Failed to fetch coverage" });
    }
  });

  // Create coverage entries
  app.post("/api/consultant-coverage", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role === "client") return res.status(403).json({ error: "Forbidden" });
      const { absentConsultantId, coveringConsultantIds, startDate, endDate } = req.body;
      if (!absentConsultantId || !Array.isArray(coveringConsultantIds) || coveringConsultantIds.length === 0 || !startDate || !endDate) {
        return res.status(400).json({ error: "absentConsultantId, coveringConsultantIds (non-empty array), startDate, and endDate are required" });
      }
      if (startDate > endDate) return res.status(400).json({ error: "startDate must be on or before endDate" });
      // Permission: consultants can only arrange cover for themselves or their managed consultants
      // Validate absent consultant exists and is a consultant
      const absentUser = await storage.getUser(absentConsultantId);
      if (!absentUser || absentUser.role !== "consultant") {
        return res.status(400).json({ error: "absentConsultantId must refer to a consultant" });
      }
      if (user.role === "consultant") {
        if (absentConsultantId !== user.id) {
          if (!isProConsultant(user)) return res.status(403).json({ error: "Forbidden" });
          const managed = await storage.getUser(absentConsultantId);
          if (!managed || managed.managerId !== user.id) return res.status(403).json({ error: "Forbidden" });
        }
      }
      // Validate each covering consultant: must exist, be a consultant, and not be the absent consultant.
      // For non-admins, enforce source-overlap eligibility — unless the absent consultant has no sources
      // configured, in which case any consultant can cover (no constraint to apply).
      const absentSources = absentUser.sources ?? [];
      // Source check applies only for non-admins when the absent consultant has sources configured.
      // If the absent has no sources (unconstrained) or the covering has no sources (unconfigured),
      // the check is skipped — same logic as the eligible-consultants picker.
      const sourceCheckApplies = user.role !== "developer" && absentSources.length > 0;
      for (const cId of coveringConsultantIds as string[]) {
        const covering = await storage.getUser(cId);
        if (!covering || covering.role !== "consultant") {
          return res.status(400).json({ error: `User ${cId} is not a valid consultant` });
        }
        if (cId === absentConsultantId) {
          return res.status(400).json({ error: "A consultant cannot cover for themselves" });
        }
        const coveringSources = covering.sources ?? [];
        if (sourceCheckApplies && coveringSources.length > 0 && !sourcesOverlap(absentSources, coveringSources)) {
          return res.status(403).json({ error: `Consultant ${covering.fullName} is not eligible to cover (no shared source)` });
        }
      }
      const entries = (coveringConsultantIds as string[]).map(coveringConsultantId => ({
        absentConsultantId,
        coveringConsultantId,
        startDate,
        endDate,
        createdBy: user.id,
      }));
      const created = await storage.createConsultantCoverageEntries(entries);
      res.json(created);
    } catch (error) {
      console.error("Create coverage error:", error);
      res.status(500).json({ error: "Failed to create coverage" });
    }
  });

  // Admin: get all coverage entries
  app.get("/api/developer/consultant-coverage", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Forbidden" });
      const includeExpired = req.query.includeExpired === "true";
      const entries = await storage.getAllCoverageEntries(includeExpired);
      const allIds = new Set([
        ...entries.map(e => e.absentConsultantId),
        ...entries.map(e => e.coveringConsultantId),
        ...entries.map(e => e.createdBy),
      ]);
      const userMap = new Map<string, string>();
      for (const id of allIds) {
        const u = await storage.getUser(id);
        if (u) userMap.set(id, u.fullName);
      }
      const today = new Date().toISOString().split("T")[0];
      res.json(entries.map(e => ({
        ...e,
        absentConsultantName: userMap.get(e.absentConsultantId) ?? "Unknown",
        coveringConsultantName: userMap.get(e.coveringConsultantId) ?? "Unknown",
        createdByName: userMap.get(e.createdBy) ?? "Unknown",
        status: e.endDate < today ? "expired" : e.startDate > today ? "upcoming" : "active",
      })));
    } catch (error) {
      console.error("Admin coverage error:", error);
      res.status(500).json({ error: "Failed to fetch coverage entries" });
    }
  });

  // All consultants — admin-only, used by ArrangeCoverDialog absent picker
  app.get("/api/consultant-coverage/all-consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const consultants = await storage.getConsultants();
      res.json(consultants.map(c => ({ id: c.id, fullName: c.fullName, consultantTier: c.consultantTier })));
    } catch (error) {
      console.error("All consultants error:", error);
      res.status(500).json({ error: "Failed to fetch consultants" });
    }
  });

  // Delete a coverage entry
  app.delete("/api/consultant-coverage/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role === "client") return res.status(403).json({ error: "Forbidden" });
      const entry = await storage.getCoverageEntryById(req.params.id);
      if (!entry) return res.status(404).json({ error: "Coverage entry not found" });
      if (user.role !== "developer" && user.id !== entry.createdBy && user.id !== entry.absentConsultantId && user.id !== entry.coveringConsultantId) {
        return res.status(403).json({ error: "Not authorised to cancel this coverage arrangement" });
      }
      await storage.deleteConsultantCoverage(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Delete coverage error:", error);
      res.status(500).json({ error: "Failed to delete coverage entry" });
    }
  });

  // Sites
  app.get("/api/sites", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const isLite = req.query.lite === "true";
      const allSites = await storage.getSitesWithDetails(isLite);
      
      // Admin sees all sites, optionally filtered by companyId or staffId
      const companyIdFilter = req.query.companyId as string | undefined;
      const staffIdFilter = req.query.staffId as string | undefined;
      if (user.role === "developer") {
        let result = companyIdFilter ? allSites.filter(s => s.companyId === companyIdFilter) : allSites;
        if (staffIdFilter) {
          const staffAssignments = await storage.getConsultantSites(staffIdFilter);
          const assignedSiteIds = new Set(staffAssignments.map(a => a.entityId));
          result = result.filter(s => assignedSiteIds.has(s.id));
        }
        res.json(result);
        return;
      }
      
      // Consultant site visibility
      if (user.role === "consultant" || user.role === "administrator") {
        const myAssigned = req.query.myAssigned === "true";
        const mySources = user.sources ?? [];
        if (hasProPrivileges(user) && !myAssigned) {
          // Pro consultants see sites whose parent company shares at least one source,
          // PLUS all sites in member companies of any GO company they can see
          const visibleCompanyIds = new Set(
            allSites
              .filter(site => sourcesOverlap(mySources, site.companySources ?? []))
              .map(site => site.companyId)
          );
          // Expand: for each visible GO, include member companies that share a source with this user
          const goExpanded = new Set<string>(visibleCompanyIds);
          for (const cId of visibleCompanyIds) {
            const members = await storage.getGroupMembers(cId);
            for (const m of members) {
              if (sourcesOverlap(mySources, m.sources ?? [])) goExpanded.add(m.id);
            }
          }
          let filteredSites = allSites.filter(site =>
            sourcesOverlap(mySources, site.companySources ?? []) || goExpanded.has(site.companyId)
          );
          if (companyIdFilter) filteredSites = filteredSites.filter(s => s.companyId === companyIdFilter);
          // Pro consultant filtering by a specific staff member's assignments
          if (staffIdFilter) {
            const staffAssignments = await storage.getConsultantSites(staffIdFilter);
            const staffSiteIds = new Set(staffAssignments.map(a => a.entityId));
            filteredSites = filteredSites.filter(s => staffSiteIds.has(s.id));
          }
          res.json(filteredSites);
          return;
        }
        // Standard consultants (or pro with myAssigned=true) see their directly assigned sites
        // plus any sites belonging to consultants they are actively covering for
        const assignedSiteIds = await getEffectiveSiteIds(user.id);
        let filteredSites = allSites.filter(site => assignedSiteIds.has(site.id));
        if (companyIdFilter) filteredSites = filteredSites.filter(s => s.companyId === companyIdFilter);
        // Allow staffId filter for covering consultants — lets them view only the absent consultant's sites
        if (staffIdFilter) {
          const activeCovering = await storage.getActiveCoverageForCovering(user.id);
          const coveringIds = new Set(activeCovering.map(c => c.absentConsultantId));
          if (coveringIds.has(staffIdFilter)) {
            const staffAssignments = await storage.getConsultantSites(staffIdFilter);
            const staffSiteIds = new Set(staffAssignments.map(a => a.siteId).filter(Boolean) as string[]);
            filteredSites = filteredSites.filter(s => staffSiteIds.has(s.id));
          }
        }
        res.json(filteredSites);
        return;
      }
      
      // Client sees only their explicitly assigned sites (across their company + any GO member companies)
      if (user.role === "client" && user.companyId) {
        // Full-permission clients querying sites for their OWN company (as share destination owner)
        // should see ALL sites in that company, not just their assigned ones.
        // This allows them to select any site as a share destination when uploading company/group scope docs.
        if (user.clientPermissionRole === "full" && companyIdFilter && companyIdFilter === user.companyId) {
          const ownCompanySites = allSites.filter(s => s.companyId === companyIdFilter);
          res.json(ownCompanySites);
          return;
        }
        const effectiveCompanyIds = await getEffectiveCompanyIds(user.companyId);
        const clientSiteAssignments = await storage.getClientSites(user.id);
        const assignedSiteIds = new Set(clientSiteAssignments.map(a => a.siteId));
        let filteredSites = allSites.filter(site => 
          effectiveCompanyIds.has(site.companyId) && assignedSiteIds.has(site.id)
        );
        if (companyIdFilter) filteredSites = filteredSites.filter(s => s.companyId === companyIdFilter);
        res.json(filteredSites);
        return;
      }
      
      // Fallback: return empty if no match
      res.json([]);
    } catch (error) {
      console.error("Entities error:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  // Compliance-only endpoint for sites — returns a map of siteId → compliance data.
  // Called as the "phase 2" background fetch after the lite (fast) sites list has rendered.
  app.get("/api/sites/compliance", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const allSites = await storage.getSitesWithDetails(false);

      let filteredSites = allSites;
      if (user.role === "developer") {
        // sees all
      } else if (user.role === "consultant" || user.role === "administrator") {
        const mySources = user.sources ?? [];
        if (hasProPrivileges(user)) {
          const visibleCompanyIds = new Set(allSites.filter(s => sourcesOverlap(mySources, s.companySources ?? [])).map(s => s.companyId));
          const goExpanded = new Set<string>(visibleCompanyIds);
          for (const cId of visibleCompanyIds) {
            const members = await storage.getGroupMembers(cId);
            for (const m of members) { if (sourcesOverlap(mySources, m.sources ?? [])) goExpanded.add(m.id); }
          }
          filteredSites = allSites.filter(s => sourcesOverlap(mySources, s.companySources ?? []) || goExpanded.has(s.companyId));
        } else {
          const assignedSiteIds = await getEffectiveSiteIds(user.id);
          filteredSites = allSites.filter(s => assignedSiteIds.has(s.id));
        }
      } else if (user.role === "client" && user.companyId) {
        const effectiveCompanyIds = await getEffectiveCompanyIds(user.companyId);
        const clientSiteAssignments = await storage.getClientSites(user.id);
        const assignedSiteIds = new Set(clientSiteAssignments.map(a => a.siteId));
        filteredSites = allSites.filter(s => effectiveCompanyIds.has(s.companyId) && assignedSiteIds.has(s.id));
      } else {
        filteredSites = [];
      }

      const result: Record<string, any> = {};
      for (const site of filteredSites) {
        result[site.id] = {
          complianceSummary: site.complianceSummary,
          moduleScores: site.moduleScores,
          moduleDocCounts: site.moduleDocCounts,
          moduleAccess: site.moduleAccess,
        };
      }
      res.json(result);
    } catch (error) {
      console.error("Sites compliance error:", error);
      res.status(500).json({ error: "Failed to fetch compliance" });
    }
  });

  // Create entity
  app.post("/api/sites", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin or pro consultant can create sites
      if (user.role !== "developer" && !hasProPrivileges(user)) {
        return res.status(403).json({ error: "Only developers and pro consultants can create sites" });
      }
      
      const { name, companyId, address, contactPhone, addressLine1, addressLine2, city, county, postalCode, country, contactName, contactPosition, contactEmail } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Site name is required" });
      }
      
      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }
      
      const entity = await storage.createSite({
        name: name.trim(),
        companyId,
        address: address || null,
        contactPhone: contactPhone || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        county: county || null,
        postalCode: postalCode || null,
        country: country || null,
        contactName: contactName || null,
        contactPosition: contactPosition || null,
        contactEmail: contactEmail || null,
      });
      
      // Auto-assign the company's primary contact to the new site
      const company = await storage.getCompany(companyId);
      if (company && company.contactUserId) {
        const primaryContact = await storage.getUser(company.contactUserId);
        if (primaryContact && primaryContact.role === "client" && primaryContact.companyId === companyId) {
          await storage.assignClientToSite({
            clientId: primaryContact.id,
            siteId: entity.id,
            assignedBy: user.id,
          });
          
          // Auto-transition client from site_required to invite_required
          if (primaryContact.status === "site_required") {
            await storage.updateUser(primaryContact.id, { status: "invite_required" });
          }
          
          await storage.createAuditLog({
            action: "primary_contact_auto_assigned",
            entityType: "site",
            entityId: entity.id,
            userId: user.id,
            userName: user.fullName,
            details: `Primary contact ${primaryContact.fullName} auto-assigned to new site ${entity.name}`,
            metadata: { contactUserId: primaryContact.id, siteId: entity.id },
          });
        }
      }

      // Also auto-assign the Group Owner's primary contact if this company belongs to a group
      if (company && company.groupOwnerId) {
        const goCompany = await storage.getCompany(company.groupOwnerId);
        if (goCompany && goCompany.contactUserId) {
          const goPrimaryContact = await storage.getUser(goCompany.contactUserId);
          if (goPrimaryContact && goPrimaryContact.role === "client" && goPrimaryContact.companyId === company.groupOwnerId) {
            await storage.assignClientToSite({
              clientId: goPrimaryContact.id,
              siteId: entity.id,
              assignedBy: user.id,
            });
            await storage.createAuditLog({
              action: "primary_contact_auto_assigned",
              entityType: "site",
              entityId: entity.id,
              userId: user.id,
              userName: user.fullName,
              details: `Group Owner primary contact ${goPrimaryContact.fullName} auto-assigned to new site ${entity.name}`,
              metadata: { contactUserId: goPrimaryContact.id, siteId: entity.id, groupOwnerId: company.groupOwnerId },
            });
          }
        }
      }
      
      // Auto-assign clients who are already on ALL existing sites of this company
      // (i.e. "company-wide" users) so they land on every new site automatically.
      const allCompanySitesNow = await storage.getSitesByCompanyId(companyId);
      const preExistingSiteIds = allCompanySitesNow
        .filter(s => s.id !== entity.id)
        .map(s => s.id);

      if (preExistingSiteIds.length > 0) {
        // Build intersection: clients present on EVERY pre-existing site
        const perSiteClients = await Promise.all(
          preExistingSiteIds.map(sid => storage.getClientSiteAssignments(sid))
        );
        const firstSet = new Set(perSiteClients[0].map(a => a.clientId));
        const companyWideClientIds = perSiteClients.slice(1).reduce<Set<string>>((acc, clients) => {
          const ids = new Set(clients.map(a => a.clientId));
          return new Set([...acc].filter(id => ids.has(id)));
        }, firstSet);

        for (const clientId of companyWideClientIds) {
          // Skip primary contact (already handled above)
          if (company?.contactUserId === clientId) continue;
          // Skip GO primary contact (already handled above)
          if (company?.groupOwnerId) {
            const goCompany = await storage.getCompany(company.groupOwnerId);
            if (goCompany?.contactUserId === clientId) continue;
          }
          try {
            await storage.assignClientToSite({ clientId, siteId: entity.id, assignedBy: user.id });
            const clientUser = await storage.getUser(clientId);
            await storage.createAuditLog({
              action: "client_auto_assigned_new_site",
              entityType: "site",
              entityId: entity.id,
              userId: user.id,
              userName: user.fullName,
              details: `${clientUser?.fullName ?? clientId} auto-assigned to new site "${entity.name}" (assigned to all company sites)`,
              metadata: { clientUserId: clientId, siteId: entity.id, companyId },
            });
          } catch {
            // ignore duplicate-assignment errors
          }
        }
      }

      // Auto-create site-level share records for any company-scoped documents
      // already shared with this company, so the new site appears in their
      // Shared Sites list and the docs show up in the site's folder/table view.
      if (company) {
        await storage.autoShareCompanyDocumentsToSite(companyId, entity.id);
      }

      // Emit site-updated so admins/consultants and affected clients see new sites in real time
      try {
        emitToRole("developer", "site-updated", { siteId: entity.id, companyId });
        emitToRole("consultant", "site-updated", { siteId: entity.id, companyId });
        emitToCompany(companyId, "site-updated", { siteId: entity.id, companyId });
      } catch { /* non-fatal */ }

      res.status(201).json(entity);
    } catch (error) {
      console.error("Create entity error:", error);
      res.status(500).json({ error: "Failed to create entity" });
    }
  });

  // Update entity
  app.patch("/api/sites/:siteId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin or pro consultant can update sites
      if (user.role !== "developer" && !hasProPrivileges(user)) {
        return res.status(403).json({ error: "Only developers and pro consultants can update sites" });
      }
      
      const { name, companyNumber, address, contactEmail, contactPhone, website, addressLine1, addressLine2, city, county, postalCode, country, contactName, contactPosition, contactUserId } = req.body;
      
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (companyNumber !== undefined) updates.companyNumber = companyNumber || null;
      if (address !== undefined) updates.address = address || null;
      if (contactEmail !== undefined) updates.contactEmail = contactEmail || null;
      if (contactPhone !== undefined) updates.contactPhone = contactPhone || null;
      if (website !== undefined) updates.website = website || null;
      if (addressLine1 !== undefined) updates.addressLine1 = addressLine1 || null;
      if (addressLine2 !== undefined) updates.addressLine2 = addressLine2 || null;
      if (city !== undefined) updates.city = city || null;
      if (county !== undefined) updates.county = county || null;
      if (postalCode !== undefined) updates.postalCode = postalCode || null;
      if (country !== undefined) updates.country = country || null;
      if (contactName !== undefined) updates.contactName = contactName || null;
      if (contactPosition !== undefined) updates.contactPosition = contactPosition || null;
      if (contactUserId !== undefined) updates.contactUserId = contactUserId || null;
      
      const entity = await storage.updateSite(req.params.siteId, updates);
      if (!entity) {
        return res.status(404).json({ error: "Entity not found" });
      }
      
      // Emit site-updated so admins/consultants and affected clients see site changes in real time
      try {
        emitToRole("developer", "site-updated", { siteId: req.params.siteId, companyId: entity.companyId });
        emitToRole("consultant", "site-updated", { siteId: req.params.siteId, companyId: entity.companyId });
        if (entity.companyId) emitToCompany(entity.companyId, "site-updated", { siteId: req.params.siteId, companyId: entity.companyId });
      } catch { /* non-fatal */ }

      res.json(entity);
    } catch (error) {
      console.error("Update entity error:", error);
      res.status(500).json({ error: "Failed to update entity" });
    }
  });

  // Delete a single site — admin only
  app.delete("/api/sites/:siteId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role !== "developer") return res.status(403).json({ error: "Only developers can delete sites" });

      const siteId = req.params.siteId;
      const site = await storage.getSite(siteId);
      if (!site) return res.status(404).json({ error: "Site not found" });

      const companyId = site.companyId;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Incidents
        await client.query(`DELETE FROM incident_milestones WHERE incident_id IN (SELECT id FROM incidents WHERE site_id = $1)`, [siteId]);
        await client.query(`DELETE FROM incidents WHERE site_id = $1`, [siteId]);

        // Support
        await client.query(`DELETE FROM support_request_reads WHERE request_id IN (SELECT id FROM support_requests WHERE site_id = $1)`, [siteId]);
        await client.query(`DELETE FROM support_messages WHERE request_id IN (SELECT id FROM support_requests WHERE site_id = $1)`, [siteId]);
        await client.query(`DELETE FROM support_requests WHERE site_id = $1`, [siteId]);

        // Documents
        await client.query(`DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE site_id = $1)`, [siteId]);
        await client.query(`DELETE FROM documents WHERE site_id = $1`, [siteId]);
        await client.query(`DELETE FROM document_folders WHERE site_id = $1`, [siteId]);
        await client.query(`DELETE FROM site_document_type_access WHERE site_id = $1`, [siteId]);

        // Cases
        await client.query(`DELETE FROM case_milestones WHERE case_id IN (SELECT id FROM cases WHERE site_id = $1)`, [siteId]);
        await client.query(`DELETE FROM case_bundles WHERE case_id IN (SELECT id FROM cases WHERE site_id = $1)`, [siteId]);
        await client.query(`DELETE FROM cases WHERE site_id = $1`, [siteId]);

        // Training
        await client.query(`DELETE FROM training_bookings WHERE site_id = $1`, [siteId]);
        await client.query(`DELETE FROM training_requests WHERE site_id = $1`, [siteId]);

        // Client upload folders
        await client.query(`DELETE FROM client_upload_folder_access WHERE folder_id IN (SELECT id FROM client_upload_folders WHERE site_id = $1)`, [siteId]);
        await client.query(`DELETE FROM client_uploads WHERE site_id = $1`, [siteId]);
        await client.query(`DELETE FROM client_upload_folders WHERE site_id = $1`, [siteId]);

        // Assignments & access (unassign, not delete users)
        await client.query(`DELETE FROM consultant_assignments WHERE entity_id = $1`, [siteId]);
        await client.query(`DELETE FROM client_site_assignments WHERE site_id = $1`, [siteId]);
        await client.query(`DELETE FROM site_module_access WHERE site_id = $1`, [siteId]);
        await client.query(`DELETE FROM module_access_requests WHERE site_id = $1`, [siteId]);
        await client.query(`DELETE FROM site_template_overrides WHERE site_id = $1`, [siteId]);

        // Delete the site itself
        await client.query(`DELETE FROM sites WHERE id = $1`, [siteId]);

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "site_deleted",
        entityType: "site",
        entityId: siteId,
        details: `Site "${site.name}" deleted`,
        metadata: { siteName: site.name, companyId },
      });

      // Notify all connected users so lists refresh immediately
      try {
        emitToRole("developer", "site-updated", { siteId, companyId });
        emitToRole("consultant", "site-updated", { siteId, companyId });
        if (companyId) emitToCompany(companyId, "site-updated", { siteId, companyId });
      } catch { /* non-fatal */ }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete site error:", error);
      res.status(500).json({ error: "Failed to delete site" });
    }
  });

  // Get single entity
  app.get("/api/sites/:siteId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Clients can only access sites in their company
      const canAccess = await canUserAccessSite(user, req.params.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const entity = await storage.getSite(req.params.siteId);
      if (!entity) {
        return res.status(404).json({ error: "Entity not found" });
      }
      // Include parent company sources for derived access control
      const siteCompany = await storage.getCompany(entity.companyId);
      res.json({ ...entity, companySources: siteCompany?.sources ?? null });
    } catch (error) {
      console.error("Get entity error:", error);
      res.status(500).json({ error: "Failed to fetch entity" });
    }
  });

  // Site stats: document counts by module, case count, incident count
  app.get("/api/sites/:siteId/stats", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const canAccess = await canUserAccessSite(user, req.params.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const siteId = req.params.siteId;

      const docRows = await pool.query(
        `SELECT module, COUNT(*) as count FROM documents WHERE site_id = $1 AND is_archived = false GROUP BY module`,
        [siteId]
      );
      const documents: Record<string, number> = {};
      for (const row of docRows.rows) documents[row.module] = parseInt(row.count, 10);

      const caseRow = await pool.query(
        `SELECT COUNT(*) as count FROM cases WHERE site_id = $1 AND is_archived = false`,
        [siteId]
      );
      const incidentRow = await pool.query(
        `SELECT COUNT(*) as count FROM incidents WHERE site_id = $1`,
        [siteId]
      );

      res.json({
        documents,
        cases: parseInt(caseRow.rows[0].count, 10),
        incidents: parseInt(incidentRow.rows[0].count, 10),
      });
    } catch (error) {
      console.error("Site stats error:", error);
      res.status(500).json({ error: "Failed to fetch site stats" });
    }
  });

  // Get sites for entity
  app.get("/api/sites/:siteId/sites", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Clients can only access their own company's sites
      const canAccess = await canUserAccessSite(user, req.params.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get the site to find its companyId, then get all sites in that company
      const currentSite = await storage.getSite(req.params.siteId);
      if (!currentSite) {
        return res.status(404).json({ error: "Site not found" });
      }
      const sites = await storage.getSitesByCompanyId(currentSite.companyId);
      res.json(sites);
    } catch (error) {
      console.error("Get entity sites error:", error);
      res.status(500).json({ error: "Failed to fetch entity sites" });
    }
  });

  // Support Requests
  app.get("/api/support-requests", async (req, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const module = req.query.module as ModuleType | undefined;
      const siteId = req.query.siteId as string | undefined;
      const companyId = req.query.companyId as string | undefined;
      
      let requests = await storage.getSupportRequests(module);
      
      // Role-based filtering
      if (user.role === "developer") {
        // Admins can see all requests, optionally filter by company/site
        if (siteId) {
          requests = requests.filter(r => r.siteId === siteId);
        } else if (companyId) {
          const companySites = await storage.getSites();
          const siteIds = companySites.filter(s => s.companyId === companyId).map(s => s.id);
          requests = requests.filter(r => siteIds.includes(r.siteId));
        }
      } else if (user.role === "consultant" || user.role === "administrator") {
        if (hasProPrivileges(user)) {
          // Pro consultants see all requests, optionally filter by site
          if (siteId) requests = requests.filter(r => r.siteId === siteId);
        } else {
          // Standard consultants see requests from their assigned sites only
          const assignments = await storage.getConsultantSites(user.id);
          const assignedSiteIds = assignments.map((a: { siteId: string }) => a.siteId);
          requests = requests.filter(r => assignedSiteIds.includes(r.siteId));
          if (siteId) requests = requests.filter(r => r.siteId === siteId);
        }
      } else {
        // Clients see only their own requests from their explicitly assigned sites
        const clientSites = await storage.getClientSites(user.id);
        const assignedSiteIds = clientSites.map(a => a.siteId);
        if (assignedSiteIds.length === 0) {
          requests = [];
        } else {
          requests = requests.filter(r => r.createdBy === user.id && assignedSiteIds.includes(r.siteId));
        }
        // Apply site filter for clients
        if (siteId) {
          requests = requests.filter(r => r.siteId === siteId);
        }
      }
      
      // Enrich with user names, unread count, and latest message.
      // Batch all async lookups to avoid N×5 sequential DB round-trips.
      const [latestMessages, unreadCounts] = await Promise.all([
        Promise.all(requests.map(r => storage.getLatestSupportMessage(r.id))),
        Promise.all(requests.map(r => storage.getUnreadMessageCount(r.id, user.id))),
      ]);

      // Collect all unique user IDs needed (creators, responders, message senders).
      const uniqueUserIds = [...new Set([
        ...requests.map(r => r.createdBy),
        ...requests.filter(r => r.respondedBy).map(r => r.respondedBy!),
        ...latestMessages.filter(m => m?.senderId).map(m => m!.senderId),
      ])];
      const fetchedUsers = await Promise.all(uniqueUserIds.map(id => storage.getUser(id)));
      const userMap = new Map(uniqueUserIds.map((id, i) => [id, fetchedUsers[i]]));

      const enrichedRequests = requests.map((request, i) => {
        const latestMsg = latestMessages[i];
        const sender = latestMsg ? userMap.get(latestMsg.senderId) : null;
        return {
          ...request,
          createdByName: userMap.get(request.createdBy)?.fullName || userMap.get(request.createdBy)?.username || "Unknown",
          respondedByName: request.respondedBy
            ? (userMap.get(request.respondedBy)?.fullName || userMap.get(request.respondedBy)?.username || null)
            : null,
          unreadCount: unreadCounts[i],
          latestMessage: latestMsg ? {
            message: latestMsg.message.length > 80 ? latestMsg.message.slice(0, 80) + "..." : latestMsg.message,
            senderName: sender?.fullName || sender?.username || "Unknown",
            createdAt: latestMsg.createdAt,
          } : null,
        };
      });

      res.json(enrichedRequests);
    } catch (error) {
      console.error("Support requests error:", error);
      res.status(500).json({ error: "Failed to fetch support requests" });
    }
  });

  // Get support request counts for notifications (must be before :id route)
  app.get("/api/support-requests/counts", async (req, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const allRequests = await storage.getSupportRequests();
      
      let relevantRequests: typeof allRequests = [];
      
      if (user.role === "developer" || hasProPrivileges(user)) {
        relevantRequests = allRequests;
      } else if (user.role === "consultant") {
        const assignments = await storage.getConsultantSites(user.id);
        const assignedSiteIds = new Set(assignments.map(a => a.siteId));
        relevantRequests = allRequests.filter(r => assignedSiteIds.has(r.siteId));
      } else {
        relevantRequests = allRequests.filter(r => r.createdBy === user.id);
      }

      const openCount = relevantRequests.filter(r => 
        r.status === "open" || r.status === "in_progress"
      ).length;

      res.json({ openCount });
    } catch (error) {
      console.error("Get support counts error:", error);
      res.status(500).json({ error: "Failed to get support counts" });
    }
  });

  app.post("/api/support-requests", async (req, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const parseResult = createSupportRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
      }
      
      const body = parseResult.data;
      
      // Verify user can access the site
      const canAccess = await canUserAccessSite(user, body.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "You don't have access to this site" });
      }
      
      const request = await storage.createSupportRequest({
        subject: body.subject,
        description: body.description,
        priority: body.priority,
        status: "open",
        category: body.category,
        module: body.module || null,
        siteId: body.siteId,
        createdBy: user.id,
        assignedTo: null,
      });

      await storage.createAuditLog({
        action: "support_request_created",
        userId: user.id,
        userName: user.fullName || user.username,
        entityId: body.siteId,
        documentId: null,
        supportRequestId: request.id,
        module: body.module || null,
        details: `Created support request: ${body.subject}`,
        metadata: null,
      });

      // Emit support-request-created so admins/consultants see new requests instantly
      try {
        emitToRole("developer", "support-request-created", { requestId: request.id });
        emitToRole("consultant", "support-request-created", { requestId: request.id });
      } catch { /* non-fatal */ }

      res.status(201).json(request);
    } catch (error) {
      console.error("Create support request error:", error);
      res.status(500).json({ error: "Failed to create support request" });
    }
  });

  // Update/respond to support request
  app.patch("/api/support-requests/:id", async (req, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Only developers and consultants can update requests
      if (user.role === "client") {
        return res.status(403).json({ error: "Only consultants and developers can respond to requests" });
      }

      const parseResult = updateSupportRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
      }

      const existingRequest = await storage.getSupportRequest(req.params.id);
      if (!existingRequest) {
        return res.status(404).json({ error: "Support request not found" });
      }

      // Check consultant can access the site
      if (user.role === "consultant") {
        const canAccess = await canUserAccessSite(user, existingRequest.siteId);
        if (!canAccess) {
          return res.status(403).json({ error: "You don't have access to this site's requests" });
        }
      }

      const body = parseResult.data;
      const updates: Partial<typeof existingRequest> = {};
      
      if (body.status) {
        updates.status = body.status;
        if (body.status === "resolved" || body.status === "closed") {
          updates.resolvedAt = new Date();
        }
      }
      if (body.assignedTo !== undefined) {
        updates.assignedTo = body.assignedTo;
      }
      if (body.response) {
        updates.response = body.response;
        updates.respondedBy = user.id;
        updates.respondedAt = new Date();
      }
      updates.updatedAt = new Date();

      const updated = await storage.updateSupportRequest(req.params.id, updates);

      await storage.createAuditLog({
        action: "support_request_updated",
        userId: user.id,
        userName: user.fullName || user.username,
        entityId: existingRequest.siteId,
        documentId: null,
        supportRequestId: req.params.id,
        module: existingRequest.module,
        details: body.response || `Updated support request status to ${body.status}`,
        metadata: null,
      });

      // Emit support-request-updated so badge counts and lists refresh in real time
      try {
        emitToRole("developer", "support-request-updated", { requestId: req.params.id });
        emitToRole("consultant", "support-request-updated", { requestId: req.params.id });
      } catch { /* non-fatal */ }

      res.json(updated);
    } catch (error) {
      console.error("Update support request error:", error);
      res.status(500).json({ error: "Failed to update support request" });
    }
  });

  // Get single support request
  app.get("/api/support-requests/:id", async (req, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const request = await storage.getSupportRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Support request not found" });
      }

      // Check access
      if (user.role === "client" && request.createdBy !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (user.role === "consultant") {
        const canAccess = await canUserAccessSite(user, request.siteId);
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      res.json(request);
    } catch (error) {
      console.error("Get support request error:", error);
      res.status(500).json({ error: "Failed to fetch support request" });
    }
  });

  // Clear all support requests (admin only - for testing)
  app.delete("/api/support-requests", async (req, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can clear all support requests" });
      }

      await storage.clearSupportRequests();
      res.json({ message: "All support requests cleared" });
    } catch (error) {
      console.error("Clear support requests error:", error);
      res.status(500).json({ error: "Failed to clear support requests" });
    }
  });

  // Get messages for a support request
  app.get("/api/support-requests/:id/messages", async (req, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const request = await storage.getSupportRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Support request not found" });
      }

      // Check access
      if (user.role === "client" && request.createdBy !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (user.role === "consultant") {
        const canAccess = await canUserAccessSite(user, request.siteId);
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const messages = await storage.getSupportMessages(req.params.id);
      
      // Mark this request as read by this user
      await storage.markSupportRequestRead(req.params.id, user.id);
      
      // Enrich with sender names
      const enrichedMessages = await Promise.all(messages.map(async (msg) => {
        const sender = await storage.getUser(msg.senderId);
        return {
          ...msg,
          senderName: sender?.fullName || sender?.username || "Unknown",
          senderRole: sender?.role || "unknown",
        };
      }));

      res.json(enrichedMessages);
    } catch (error) {
      console.error("Get support messages error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Post a message to a support request
  app.post("/api/support-requests/:id/messages", async (req, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const request = await storage.getSupportRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Support request not found" });
      }

      // Check access - clients can only post to their own requests
      if (user.role === "client" && request.createdBy !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (user.role === "consultant") {
        const canAccess = await canUserAccessSite(user, request.siteId);
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const { message } = req.body;
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required" });
      }

      const newMessage = await storage.createSupportMessage({
        requestId: req.params.id,
        senderId: user.id,
        message: message.trim(),
      });

      // Update request status to in_progress if it's open and a consultant/admin responds
      if (request.status === "open" && (user.role === "developer" || user.role === "consultant" || user.role === "administrator")) {
        await storage.updateSupportRequest(req.params.id, { 
          status: "in_progress",
          updatedAt: new Date(),
        });
      }

      // Enrich with sender info
      const sender = await storage.getUser(user.id);
      const enrichedMessage = {
        ...newMessage,
        senderName: sender?.fullName || sender?.username || "Unknown",
        senderRole: sender?.role || "unknown",
      };

      res.status(201).json(enrichedMessage);
    } catch (error) {
      console.error("Create support message error:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // Document Types (Admin-managed master list)
  app.get("/api/document-types", async (req, res) => {
    try {
      const module = req.query.module as ModuleType | undefined;
      const documentTypes = await storage.getDocumentTypes(module);
      res.json(documentTypes);
    } catch (error) {
      console.error("Get document types error:", error);
      res.status(500).json({ error: "Failed to fetch document types" });
    }
  });

  app.get("/api/document-types/:id", async (req, res) => {
    try {
      const documentType = await storage.getDocumentType(req.params.id);
      if (!documentType) {
        return res.status(404).json({ error: "Document type not found" });
      }
      res.json(documentType);
    } catch (error) {
      console.error("Get document type error:", error);
      res.status(500).json({ error: "Failed to fetch document type" });
    }
  });

  app.post("/api/document-types", async (req, res) => {
    try {
      // Check admin role
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Developer access required" });
      }

      const parseResult = createDocumentTypeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
      }

      const body = parseResult.data;
      // Code is auto-generated in the storage layer as TPL-XXXXX
      const documentType = await storage.createDocumentType({
        name: body.name,
        module: body.module,
        description: body.description || null,
        isMandatory: body.isMandatory ?? false,
        renewalPeriodMonths: body.renewalPeriodMonths ?? null,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
        createdBy: userId,
      });

      res.status(201).json(documentType);
    } catch (error) {
      console.error("Create document type error:", error);
      res.status(500).json({ error: "Failed to create document type" });
    }
  });

  app.patch("/api/document-types/:id", async (req, res) => {
    try {
      // Check admin role
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Developer access required" });
      }

      const parseResult = updateDocumentTypeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
      }

      const updated = await storage.updateDocumentType(req.params.id, parseResult.data);
      if (!updated) {
        return res.status(404).json({ error: "Document type not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update document type error:", error);
      res.status(500).json({ error: "Failed to update document type" });
    }
  });

  app.delete("/api/document-types/:id", async (req, res) => {
    try {
      // Check admin role
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Developer access required" });
      }

      const deleted = await storage.deleteDocumentType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Document type not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Delete document type error:", error);
      res.status(500).json({ error: "Failed to delete document type" });
    }
  });

  // Reports
  app.get("/api/reports", async (req, res) => {
    try {
      const companyId = req.query.companyId as string | undefined;
      const siteId = req.query.siteId as string | undefined;
      
      const summary = await storage.getComplianceSummary(companyId, siteId);
      const moduleSummaries = await storage.getModuleSummaries(companyId, siteId);
      const allSites = await storage.getSitesWithDetails();
      
      // Filter sites based on company/site filter
      let filteredSites = allSites;
      if (siteId) {
        filteredSites = allSites.filter(s => s.id === siteId);
      } else if (companyId) {
        filteredSites = allSites.filter(s => s.companyId === companyId);
      }
      
      const monthlyTrend = [
        { month: "Jul", score: 72 },
        { month: "Aug", score: 78 },
        { month: "Sep", score: 75 },
        { month: "Oct", score: 82 },
        { month: "Nov", score: 88 },
        { month: "Dec", score: summary.complianceScore },
      ];

      res.json({
        summary,
        moduleSummaries,
        sites: filteredSites.map(e => ({ id: e.id, name: e.name })),
        monthlyTrend,
      });
    } catch (error) {
      console.error("Reports error:", error);
      res.status(500).json({ error: "Failed to fetch reports data" });
    }
  });

  // ─── Report helpers ───────────────────────────────────────────────────────
  async function getAllowedSiteIds(user: any): Promise<Set<string>> {
    // Developer: unrestricted
    if (user.role === "developer") {
      const sites = await storage.getSites();
      return new Set(sites.map((s: any) => s.id));
    }
    const isProConsultantUser = user.role === "consultant" && user.consultantTier === "pro";
    // Administrator and Pro Consultant: source-scoped (same logic as /api/sites)
    if (user.role === "administrator" || isProConsultantUser) {
      const mySources: string[] = user.sources ?? [];
      const [allSites, allCompanies] = await Promise.all([
        storage.getSites(),
        storage.getCompanies(),
      ]);
      // Directly visible companies via source overlap
      const visibleCompanyIds = new Set<string>(
        allCompanies.filter((c: any) => sourcesOverlap(mySources, c.sources ?? [])).map((c: any) => c.id)
      );
      // GO expansion: GO companies whose effective sources (own + members) overlap
      for (const c of allCompanies) {
        if (!visibleCompanyIds.has(c.id)) {
          const effective = await getEffectiveGoSources(c.id);
          if (sourcesOverlap(mySources, effective)) visibleCompanyIds.add(c.id);
        }
      }
      // Member expansion: for each visible GO, only include members that share a source with this user
      const goExpandedIds = new Set<string>(visibleCompanyIds);
      for (const cId of visibleCompanyIds) {
        const members = await storage.getGroupMembers(cId);
        for (const m of members) {
          if (sourcesOverlap(mySources, m.sources ?? [])) goExpandedIds.add(m.id);
        }
      }
      return new Set(allSites.filter((s: any) => goExpandedIds.has(s.companyId)).map((s: any) => s.id));
    }
    if (user.role === "consultant") {
      const assignments = await storage.getConsultantSites(user.id);
      return new Set(assignments.map((a: any) => a.entityId));
    }
    // client
    if (!user.companyId) return new Set();
    const companySites = await storage.getSitesByCompanyId(user.companyId);
    const clientAssignments = await storage.getClientSites(user.id);
    const clientSiteIds = new Set(clientAssignments.map((a: any) => a.siteId));
    return new Set(companySites.filter((s: any) => clientSiteIds.has(s.id)).map((s: any) => s.id));
  }

  // Admin Report: Private Templates
  app.get("/api/developer/private-templates", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const isProConsultant = user.role === "consultant" && user.consultantTier === "pro";
      if (user.role !== "developer" && !isProConsultant && user.role !== "administrator") {
        return res.status(403).json({ error: "Not authorised" });
      }

      const [allTemplates, allFolders, allSources] = await Promise.all([
        storage.getDocumentTemplates(),
        storage.getFolderTemplates(),
        storage.getSources(false),
      ]);

      const privateTemplates = allTemplates.filter(t => t.sources && t.sources.length > 0);
      const folderMap = new Map(allFolders.map((f: any) => [f.id, f]));
      const sourceMap = new Map(allSources.map((s: any) => [s.code, s.label]));

      const result = privateTemplates.map(t => {
        const folder = t.folderTemplateId ? folderMap.get(t.folderTemplateId) : null;
        const parentFolder = folder?.parentId ? folderMap.get(folder.parentId) : null;
        const folderPath = folder
          ? parentFolder
            ? `${parentFolder.name} / ${folder.name}`
            : folder.name
          : null;
        return {
          id: t.id,
          name: t.name,
          module: t.module,
          folderName: folderPath,
          isMandatory: t.isMandatory,
          requiresApproval: t.requiresApproval,
          sources: t.sources,
          sourceLabels: (t.sources as string[]).map((code: string) => (sourceMap.get(code) as string) ?? code),
        };
      });

      result.sort((a, b) => {
        const aSource = a.sourceLabels[0] ?? "";
        const bSource = b.sourceLabels[0] ?? "";
        if (aSource !== bSource) return aSource.localeCompare(bSource);
        return a.name.localeCompare(b.name);
      });

      return res.json({ templates: result, total: result.length });
    } catch (err) {
      console.error("Private templates report error:", err);
      return res.status(500).json({ error: "Failed to load private templates report" });
    }
  });

  // Report: Compliance Gap Report
  app.get("/api/reports/gaps", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const allowedSiteIds = await getAllowedSiteIds(user);
      const allSites = await storage.getSites();
      const companyId = req.query.companyId as string | undefined;
      const siteId = req.query.siteId as string | undefined;

      let sites = allSites.filter((s: any) => allowedSiteIds.has(s.id));
      if (siteId) {
        sites = sites.filter((s: any) => s.id === siteId);
      } else if (companyId) {
        sites = sites.filter((s: any) => s.companyId === companyId);
      }

      const [allDocs, allTemplates, allCompanyReqsGaps, allSiteOverridesGaps] = await Promise.all([
        storage.getDocuments(undefined, false),
        storage.getDocumentTemplates(),
        storage.getAllCompanyRequiredTemplatesRaw(),
        storage.getAllSiteTemplateOverridesRaw(),
      ]);
      const templateMap = new Map(allTemplates.map((t: any) => [t.id, t]));

      // Build in-memory lookup maps from bulk data.
      const companyReqsByCompanyGaps = new Map<string, Set<string>>();
      for (const req of allCompanyReqsGaps) {
        if (req.removedAt) continue;
        if (!companyReqsByCompanyGaps.has(req.companyId)) companyReqsByCompanyGaps.set(req.companyId, new Set());
        companyReqsByCompanyGaps.get(req.companyId)!.add(req.templateId);
      }
      const overridesBySiteGaps = new Map<string, { excludedIds: Set<string>; includedIds: Set<string> }>();
      for (const override of allSiteOverridesGaps) {
        if (!overridesBySiteGaps.has(override.siteId)) overridesBySiteGaps.set(override.siteId, { excludedIds: new Set(), includedIds: new Set() });
        const entry = overridesBySiteGaps.get(override.siteId)!;
        if (override.action === "exclude") entry.excludedIds.add(override.templateId);
        else entry.includedIds.add(override.templateId);
      }

      const result: any[] = [];
      const now = new Date();

      for (const site of sites) {
        if (!site.companyId) continue;
        const companyRequired = companyReqsByCompanyGaps.get(site.companyId) ?? new Set<string>();
        const { excludedIds, includedIds } = overridesBySiteGaps.get(site.id) ?? { excludedIds: new Set<string>(), includedIds: new Set<string>() };
        const effectiveTemplateIds = [
          ...[...companyRequired].filter((id: string) => !excludedIds.has(id)),
          ...[...includedIds].filter((id: string) => !companyRequired.has(id)),
        ];

        const siteDocs = allDocs.filter((d: any) => d.siteId === site.id && !d.isArchived && !d.caseId);
        const missingByModule: Record<string, { templateId: string; templateName: string }[]> = {};

        for (const templateId of effectiveTemplateIds) {
          const tmpl = templateMap.get(templateId);
          if (!tmpl || tmpl.visibility !== "private" || tmpl.module === "training") continue;
          const isFulfilled = siteDocs.some((d: any) => {
            if (d.templateId !== templateId) return false;
            if (d.status !== "compliant") return false;
            if (d.expiryDate && new Date(d.expiryDate) < now) return false;
            if (d.renewalDate && new Date(d.renewalDate) < now) return false;
            if (tmpl.requiresApproval && d.approvalStatus !== "approved") return false;
            return true;
          });
          if (!isFulfilled) {
            const mod: string = tmpl.module;
            if (!missingByModule[mod]) missingByModule[mod] = [];
            missingByModule[mod].push({ templateId, templateName: tmpl.name });
          }
        }

        const gaps = Object.entries(missingByModule).map(([module, templates]) => ({
          module,
          missingTemplates: templates,
        }));

        if (gaps.length > 0) {
          result.push({ siteId: site.id, siteName: site.name, companyId: site.companyId, gaps });
        }
      }

      res.json(result);
    } catch (error) {
      console.error("Reports gaps error:", error);
      res.status(500).json({ error: "Failed to fetch compliance gaps" });
    }
  });

  // Report: Expiry & Renewal Risk
  app.get("/api/reports/expiry-risk", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const allowedSiteIds = await getAllowedSiteIds(user);
      const allSites = await storage.getSites();
      const siteMap = new Map(allSites.map((s: any) => [s.id, s]));

      const companyId = req.query.companyId as string | undefined;
      const siteId = req.query.siteId as string | undefined;
      const VALID_WINDOWS = ["30", "60", "90", "all"];
      const VALID_MODULES = ["health_safety", "human_resources", "employment_law", "training", "support"];
      const windowParam = VALID_WINDOWS.includes(req.query.window as string) ? (req.query.window as string) : "90";
      const rawModule = req.query.module as string | undefined;
      const moduleParam = rawModule && VALID_MODULES.includes(rawModule) ? rawModule : undefined;

      // window=all means overdue documents only; otherwise, within the specified days from now
      const overdueOnly = windowParam === "all";
      const windowDays = overdueOnly ? 0 : parseInt(windowParam, 10);

      let filteredSiteIds = [...allowedSiteIds];
      if (siteId && allowedSiteIds.has(siteId)) {
        filteredSiteIds = [siteId];
      } else if (companyId) {
        filteredSiteIds = allSites.filter((s: any) => allowedSiteIds.has(s.id) && s.companyId === companyId).map((s: any) => s.id);
      }
      const allowedSet = new Set(filteredSiteIds);

      const allDocs = await storage.getDocuments(moduleParam as any, false);
      const now = new Date();
      const cutoff = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

      const result: any[] = [];

      for (const doc of allDocs) {
        if (!doc.siteId || !allowedSet.has(doc.siteId)) continue;
        if (doc.isArchived || doc.caseId) continue;

        const dates: { date: Date; type: string }[] = [];
        if (doc.expiryDate) dates.push({ date: new Date(doc.expiryDate), type: "expiry" });
        if (doc.renewalDate) dates.push({ date: new Date(doc.renewalDate), type: "renewal" });

        if (dates.length === 0) continue;

        const earliest = dates.reduce((a, b) => (a.date < b.date ? a : b));
        const daysUntil = Math.ceil((earliest.date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        // For overdueOnly mode, only include overdue items; otherwise include up to cutoff
        if (overdueOnly && daysUntil >= 0) continue;
        if (!overdueOnly && earliest.date > cutoff) continue;

        let urgency: string;
        if (daysUntil < 0) urgency = "overdue";
        else if (daysUntil <= 30) urgency = "critical";
        else if (daysUntil <= 60) urgency = "warning";
        else urgency = "ok";

        const site = siteMap.get(doc.siteId);
        result.push({
          id: doc.id,
          title: doc.title,
          module: doc.module,
          siteId: doc.siteId,
          siteName: site?.name || "Unknown Site",
          dateType: earliest.type,
          date: earliest.date.toISOString(),
          daysUntil,
          urgency,
          status: doc.status,
          approvalStatus: doc.approvalStatus,
        });
      }

      result.sort((a, b) => a.daysUntil - b.daysUntil);
      res.json(result);
    } catch (error) {
      console.error("Reports expiry-risk error:", error);
      res.status(500).json({ error: "Failed to fetch expiry risk data" });
    }
  });

  // Report: Site Comparison
  app.get("/api/reports/site-comparison", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const allowedSiteIds = await getAllowedSiteIds(user);
      const allSites = await storage.getSites();
      const companyId = req.query.companyId as string | undefined;

      let sites = allSites.filter((s: any) => allowedSiteIds.has(s.id));
      if (companyId) {
        sites = sites.filter((s: any) => s.companyId === companyId);
      }

      const allDocs = await storage.getDocuments(undefined, false);
      const complianceModules = ["health_safety", "human_resources", "employment_law"] as const;

      const _cmpNow = new Date();
      // Strictly date-based overdue — status field is not authoritative
      const isCmpOverdue = (d: any): boolean =>
        !!(d.expiryDate && new Date(d.expiryDate) < _cmpNow) ||
        !!(d.renewalDate && new Date(d.renewalDate) < _cmpNow);

      const result = sites.map((site: any) => {
        const siteDocs = allDocs.filter((d: any) =>
          d.siteId === site.id &&
          !d.isArchived &&
          !d.caseId &&
          !d.incidentId &&
          d.source !== "external"
        );
        const scores: Record<string, { score: number; total: number; compliant: number; overdue: number }> = {};
        let allTotal = 0;
        let allCompliant = 0;

        for (const mod of complianceModules) {
          const modDocs = siteDocs.filter((d: any) => d.module === mod);
          const total = modDocs.length;
          const compliant = modDocs.filter((d: any) => d.status === "compliant" && !isCmpOverdue(d)).length;
          const overdue = modDocs.filter(isCmpOverdue).length;
          scores[mod] = { score: total > 0 ? Math.round((compliant / total) * 100) : 0, total, compliant, overdue };
          allTotal += total;
          allCompliant += compliant;
        }

        return {
          siteId: site.id,
          siteName: site.name,
          companyId: site.companyId,
          scores,
          overallScore: allTotal > 0 ? Math.round((allCompliant / allTotal) * 100) : 0,
          totalDocs: allTotal,
        };
      });

      result.sort((a: any, b: any) => a.overallScore - b.overallScore);
      res.json(result);
    } catch (error) {
      console.error("Reports site-comparison error:", error);
      res.status(500).json({ error: "Failed to fetch site comparison data" });
    }
  });

  // Report: Approval Pipeline
  app.get("/api/reports/approval-pipeline", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const allowedSiteIds = await getAllowedSiteIds(user);
      const allSites = await storage.getSites();
      const siteMap = new Map(allSites.map((s: any) => [s.id, s]));

      const companyId = req.query.companyId as string | undefined;
      const siteId = req.query.siteId as string | undefined;

      let filteredSiteIds = [...allowedSiteIds];
      if (siteId && allowedSiteIds.has(siteId)) {
        filteredSiteIds = [siteId];
      } else if (companyId) {
        filteredSiteIds = allSites.filter((s: any) => allowedSiteIds.has(s.id) && s.companyId === companyId).map((s: any) => s.id);
      }
      const allowedSet = new Set(filteredSiteIds);

      const allDocs = await storage.getDocuments(undefined, false);
      const pipelineDocs = allDocs.filter((d: any) =>
        !d.isArchived &&
        !d.caseId &&
        d.siteId && allowedSet.has(d.siteId) &&
        (d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off")
      );

      const userCache = new Map<string, any>();
      const getUserName = async (userId: string): Promise<string> => {
        if (userCache.has(userId)) return userCache.get(userId);
        const u = await storage.getUser(userId);
        const name = u?.fullName || "Unknown";
        userCache.set(userId, name);
        return name;
      };

      const now = new Date();
      const result = await Promise.all(pipelineDocs.map(async (doc: any) => {
        const uploaderName = doc.uploadedBy ? await getUserName(doc.uploadedBy) : "Unknown";
        const daysWaiting = Math.floor((now.getTime() - new Date(doc.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        const site = siteMap.get(doc.siteId);
        return {
          id: doc.id,
          title: doc.title,
          module: doc.module,
          approvalStatus: doc.approvalStatus,
          siteId: doc.siteId,
          siteName: site?.name || "Unknown Site",
          uploaderName,
          daysWaiting,
          createdAt: doc.createdAt,
        };
      }));

      result.sort((a, b) => b.daysWaiting - a.daysWaiting);
      res.json(result);
    } catch (error) {
      console.error("Reports approval-pipeline error:", error);
      res.status(500).json({ error: "Failed to fetch approval pipeline data" });
    }
  });

  // Report: Deadline & Milestone Risk
  app.get("/api/reports/deadline-risk", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const allowedSiteIds = await getAllowedSiteIds(user);
      const allSites = await storage.getSites();
      const siteMap = new Map(allSites.map((s: any) => [s.id, s]));

      const companyId = req.query.companyId as string | undefined;
      const siteId = req.query.siteId as string | undefined;

      let filteredSiteIds = [...allowedSiteIds];
      if (siteId && allowedSiteIds.has(siteId)) {
        filteredSiteIds = [siteId];
      } else if (companyId) {
        filteredSiteIds = allSites.filter((s: any) => allowedSiteIds.has(s.id) && s.companyId === companyId).map((s: any) => s.id);
      }
      const allowedSet = new Set(filteredSiteIds);

      const now = new Date();
      const soonThreshold = 14 * 24 * 60 * 60 * 1000; // 14 days
      const incidentResolutionDays = 30;

      // Cases with risky milestones
      const openCases = await storage.getCases({ includeArchived: false });
      const accessibleCases = openCases.filter((c: any) =>
        !c.isArchived &&
        c.status !== "closed" &&
        c.status !== "resolved" &&
        allowedSet.has(c.siteId)
      );

      const milestoneRisks: any[] = [];
      if (accessibleCases.length > 0) {
        const caseIds = accessibleCases.map((c: any) => c.id);
        const allMilestones = await storage.getCaseMilestonesForCases(caseIds);
        const caseMap = new Map(accessibleCases.map((c: any) => [c.id, c]));

        for (const milestone of allMilestones) {
          if (milestone.isCompleted || !milestone.dueDate) continue;
          const due = new Date(milestone.dueDate);
          const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          const isOverdue = daysUntil < 0;
          const isSoon = !isOverdue && due.getTime() - now.getTime() <= soonThreshold;
          if (!isOverdue && !isSoon) continue;

          const c = caseMap.get(milestone.caseId);
          if (!c) continue;
          const site = siteMap.get(c.siteId);
          milestoneRisks.push({
            caseId: c.id,
            caseReference: c.caseReference,
            employeeName: c.employeeName,
            siteId: c.siteId,
            siteName: site?.name || "Unknown Site",
            milestoneId: milestone.id,
            milestoneTitle: milestone.title,
            dueDate: milestone.dueDate,
            daysUntil,
            isOverdue,
            urgency: isOverdue ? "overdue" : "critical",
          });
        }
        milestoneRisks.sort((a, b) => a.daysUntil - b.daysUntil);
      }

      // Open incidents past resolution window
      const openIncidents = await storage.getIncidents({ includeArchived: false });
      const incidentRisks = openIncidents
        .filter((inc: any) =>
          !inc.isArchived &&
          inc.status !== "resolved" &&
          inc.status !== "closed" &&
          allowedSet.has(inc.siteId)
        )
        .map((inc: any) => {
          const daysSince = Math.floor((now.getTime() - new Date(inc.incidentDate).getTime()) / (24 * 60 * 60 * 1000));
          const site = siteMap.get(inc.siteId);
          return {
            id: inc.id,
            reference: inc.incidentReference,
            title: inc.title,
            siteId: inc.siteId,
            siteName: site?.name || "Unknown Site",
            severity: inc.severity,
            status: inc.status,
            incidentDate: inc.incidentDate,
            daysSinceReported: daysSince,
            urgency: daysSince > incidentResolutionDays ? "overdue" : "warning",
          };
        })
        .filter((inc: any) => inc.daysSinceReported >= 7)
        .sort((a: any, b: any) => b.daysSinceReported - a.daysSinceReported);

      res.json({ milestoneRisks, incidentRisks });
    } catch (error) {
      console.error("Reports deadline-risk error:", error);
      res.status(500).json({ error: "Failed to fetch deadline risk data" });
    }
  });

  // Report: EL Case Status (advocate + admin only)
  app.get("/api/reports/el-cases", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const isDeveloper = user.role === "developer";
      const perms = user.consultantPermissions as { caseAdvocate?: boolean } | null;
      const isAdvocate = (user.role === "consultant" || user.role === "administrator") && perms?.caseAdvocate === true;
      if (!isDeveloper && !isAdvocate) {
        return res.status(403).json({ error: "Not authorised" });
      }

      const allowedSiteIds = await getAllowedSiteIds(user);
      const allSites = await storage.getSites();
      const siteMap = new Map(allSites.map((s: any) => [s.id, s]));

      const allCompanies = await storage.getCompanies();
      const companyMap = new Map(allCompanies.map((c: any) => [c.id, c.name]));

      const companyId = req.query.companyId as string | undefined;
      const siteId = req.query.siteId as string | undefined;

      let filteredSiteIds = [...allowedSiteIds];
      if (siteId && allowedSiteIds.has(siteId)) {
        filteredSiteIds = [siteId];
      } else if (companyId) {
        filteredSiteIds = allSites
          .filter((s: any) => allowedSiteIds.has(s.id) && s.companyId === companyId)
          .map((s: any) => s.id);
      }
      const allowedSet = new Set(filteredSiteIds);

      const now = new Date();
      const upcomingThresholdMs = 14 * 24 * 60 * 60 * 1000;

      const allCases = await storage.getCases({ includeArchived: false });
      const liveCases = allCases.filter(
        (c: any) =>
          !c.isArchived &&
          c.status !== "closed" &&
          c.status !== "resolved" &&
          allowedSet.has(c.siteId)
      );

      if (liveCases.length === 0) {
        return res.json({ cases: [], metrics: { total: 0, overdue: 0, upcoming: 0, responseOverdue: 0 } });
      }

      const caseIds = liveCases.map((c: any) => c.id);
      const allMilestones = await storage.getCaseMilestonesForCases(caseIds);
      const milestonesByCaseId = new Map<string, any[]>();
      for (const m of allMilestones) {
        if (!milestonesByCaseId.has(m.caseId)) milestonesByCaseId.set(m.caseId, []);
        milestonesByCaseId.get(m.caseId)!.push(m);
      }

      // Fetch checklists per case
      const checklistsByCaseId = new Map<string, any[]>();
      for (const c of liveCases) {
        const items = await storage.getCaseDocumentChecklist(c.id);
        checklistsByCaseId.set(c.id, items);
      }

      let totalOverdue = 0;
      let totalUpcoming = 0;
      let totalResponseOverdue = 0;

      const caseRows = liveCases.map((c: any) => {
        const site = siteMap.get(c.siteId);
        const milestones = milestonesByCaseId.get(c.id) ?? [];
        const checklist = checklistsByCaseId.get(c.id) ?? [];

        let overdueCount = 0;
        let upcomingCount = 0;

        for (const m of milestones) {
          if (m.isCompleted || !m.dueDate) continue;
          const msUntil = new Date(m.dueDate).getTime() - now.getTime();
          if (msUntil < 0) overdueCount++;
          else if (msUntil <= upcomingThresholdMs) upcomingCount++;
        }

        // Also count overdue submission dates on checklist
        for (const item of checklist) {
          if (item.isCompleted || !item.submissionDate) continue;
          const msUntil = new Date(item.submissionDate).getTime() - now.getTime();
          if (msUntil < 0) overdueCount++;
          else if (msUntil <= upcomingThresholdMs) upcomingCount++;
        }

        const checklistCompleted = checklist.filter((i: any) => i.isCompleted).length;
        const responseDeadlineOverdue =
          c.responseDeadline && new Date(c.responseDeadline).getTime() < now.getTime();

        totalOverdue += overdueCount;
        totalUpcoming += upcomingCount;
        if (responseDeadlineOverdue) totalResponseOverdue++;

        return {
          id: c.id,
          caseReference: c.caseReference,
          caseName: c.caseName || c.caseReference,
          caseType: c.caseType,
          status: c.status,
          sources: c.sources ?? [],
          siteId: c.siteId,
          siteName: site?.name || "Unknown Site",
          companyName: companyMap.get(site?.companyId) || "Unknown Company",
          responseDeadline: c.responseDeadline,
          responseDeadlineOverdue,
          hearingDate: c.hearingDate,
          overdueCount,
          upcomingCount,
          checklistTotal: checklist.length,
          checklistCompleted,
          createdAt: c.createdAt,
        };
      });

      caseRows.sort((a: any, b: any) => {
        if (a.overdueCount !== b.overdueCount) return b.overdueCount - a.overdueCount;
        if (a.responseDeadlineOverdue !== b.responseDeadlineOverdue)
          return a.responseDeadlineOverdue ? -1 : 1;
        return 0;
      });

      res.json({
        cases: caseRows,
        metrics: {
          total: liveCases.length,
          overdue: totalOverdue,
          upcoming: totalUpcoming,
          responseOverdue: totalResponseOverdue,
        },
      });
    } catch (error) {
      console.error("Reports el-cases error:", error);
      res.status(500).json({ error: "Failed to fetch EL case status data" });
    }
  });

  // Assessments
  app.get("/api/assessments", async (req, res) => {
    try {
      const module = req.query.module as ModuleType | undefined;
      const now = new Date();
      
      let assessments = [
        {
          id: "assess-1",
          title: "Annual Fire Safety Assessment",
          type: "Fire Safety",
          module: "health_safety" as ModuleType,
          companyId: "company-1",
          companyName: "Acme Manufacturing Ltd",
          siteId: "site-1",
          siteName: "Main Factory",
          assignedTo: "user-1",
          assignedToName: "John Doe",
          status: "in_progress",
          progress: 65,
          dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "assess-2",
          title: "Workplace Ergonomics Review",
          type: "Ergonomics",
          module: "health_safety" as ModuleType,
          companyId: "company-2",
          companyName: "TechCorp Solutions",
          siteId: "site-3",
          siteName: "London Office",
          assignedTo: "user-1",
          assignedToName: "John Doe",
          status: "pending",
          progress: 0,
          dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "assess-3",
          title: "Employee Training Compliance Audit",
          type: "Training Audit",
          module: "human_resources" as ModuleType,
          companyId: "company-1",
          companyName: "Acme Manufacturing Ltd",
          siteId: null,
          siteName: null,
          assignedTo: "user-1",
          assignedToName: "John Doe",
          status: "completed",
          progress: 100,
          dueDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          completedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];
      
      if (module) {
        assessments = assessments.filter(a => a.module === module);
      }
      
      res.json(assessments);
    } catch (error) {
      console.error("Assessments error:", error);
      res.status(500).json({ error: "Failed to fetch assessments" });
    }
  });

  // Document Type Access routes (protected by auth)
  app.get("/api/document-types/:module/:siteId", requireAuth, async (req, res) => {
    try {
      const { module, siteId } = req.params;
      if (module !== "health_safety" && module !== "human_resources" && module !== "employment_law" && module !== "training" && module !== "support") {
        return res.status(400).json({ error: "Invalid module" });
      }
      
      // Authorization: clients can only view their own entity, consultants/admins can view any
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const canAccess = await canUserAccessSite(user, siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Not authorized to view this entity's access" });
      }
      
      const documentTypes = await storage.getDocumentTypesWithAccess(siteId, module as ModuleType);
      res.json(documentTypes);
    } catch (error) {
      console.error("Document types error:", error);
      res.status(500).json({ error: "Failed to fetch document types" });
    }
  });

  app.get("/api/entity-access/:siteId", requireAuth, async (req, res) => {
    try {
      const { siteId } = req.params;
      const module = req.query.module as ModuleType | undefined;
      
      // Authorization check
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const canAccess = await canUserAccessSite(user, siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Not authorized to view this entity's access" });
      }
      
      const access = await storage.getSiteDocumentTypeAccess(siteId, module);
      res.json(access);
    } catch (error) {
      console.error("Entity access error:", error);
      res.status(500).json({ error: "Failed to fetch entity access" });
    }
  });

  app.post("/api/entity-access", requireAuth, async (req, res) => {
    try {
      // Only developers can grant access
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can grant document type access" });
      }
      
      const { siteId, documentTypeId, module, grantedBy } = req.body;
      if (!siteId || !documentTypeId || !module) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const access = await storage.grantDocumentTypeAccess({
        siteId,
        documentTypeId,
        module,
        grantedBy: grantedBy || user.id,
      });
      res.json(access);
    } catch (error) {
      console.error("Grant access error:", error);
      res.status(500).json({ error: "Failed to grant access" });
    }
  });

  app.delete("/api/entity-access/:siteId/:documentTypeId", requireAuth, async (req, res) => {
    try {
      // Only developers can revoke access
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can revoke document type access" });
      }
      
      const { siteId, documentTypeId } = req.params;
      const success = await storage.revokeDocumentTypeAccess(siteId, documentTypeId);
      if (success) {
        res.json({ message: "Access revoked successfully" });
      } else {
        res.status(404).json({ error: "Access not found" });
      }
    } catch (error) {
      console.error("Revoke access error:", error);
      res.status(500).json({ error: "Failed to revoke access" });
    }
  });

  // ============ CASE ROUTES (Employment Law) ============

  // Get all cases (with optional filters)
  app.get("/api/cases", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Consultants/Admins must have the Case Advocate permission to access cases
      if (user.role === "consultant" || user.role === "administrator") {
        const perms = user.consultantPermissions as { caseAdvocate?: boolean } | null;
        if (!perms?.caseAdvocate) {
          return res.json([]);
        }
      }

      const siteId = req.query.siteId as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const status = req.query.status as any;
      const includeArchived = req.query.includeArchived === "true";

      // Clients can only see cases for their company's sites
      if (user.role === "client" && siteId) {
        const canAccess = await canUserAccessSite(user, siteId);
        if (!canAccess) {
          return res.status(403).json({ error: "Not authorized to view these cases" });
        }
      }

      // Build filters based on user role and query params
      const filters: { siteId?: string; entityId?: string; status?: any; includeArchived?: boolean } = {};
      
      // Only developers and consultants can view archived cases
      if (includeArchived && (user.role === "developer" || user.role === "consultant" || user.role === "administrator")) {
        filters.includeArchived = true;
      }
      
      if (user.role === "client" && user.companyId) {
        // Clients can only see cases from their own company
        filters.entityId = user.companyId;
      } else if (entityId) {
        // Admins/consultants can filter by company
        filters.entityId = entityId;
      }
      
      if (siteId) {
        filters.siteId = siteId;
      }
      
      if (status) {
        filters.status = status;
      }

      const cases = await storage.getCases(filters);

      // Source-based filtering for consultants: only show cases from companies whose
      // sources overlap with the consultant's own sources. Standard consultants must
      // additionally be assigned to the case's site.
      let sourceScopedCases = cases;
      if (user.role === "consultant" || user.role === "administrator") {
        const mySources = user.sources ?? [];
        let assignedSiteIds: Set<string> | null = null;
        if (!hasProPrivileges(user) && user.id) {
          const assignments = await storage.getConsultantSites(user.id);
          assignedSiteIds = new Set(assignments.map(a => a.entityId));
        }
        // Build a map of companyId -> company for the entity IDs in these cases
        const uniqueEntityIds = [...new Set(cases.map(c => c.entityId))];
        const companyMap: Record<string, { sources?: string[] | null }> = {};
        await Promise.all(uniqueEntityIds.map(async (eid) => {
          const company = await storage.getCompany(eid);
          if (company) companyMap[eid] = company;
        }));
        sourceScopedCases = cases.filter(c => {
          const company = companyMap[c.entityId];
          if (!sourcesOverlap(mySources, company?.sources ?? [])) return false;
          if (assignedSiteIds && !assignedSiteIds.has(c.siteId)) return false;
          return true;
        });
      }
      
      // Filter out confidential cases for non-privileged users
      // Consultants with site access can see all cases (including confidential) at their assigned sites
      const filteredCases = sourceScopedCases.filter(c => {
        if (!c.isConfidential) return true;
        if (user.role === "developer") return true;
        if (user.role === "consultant" || user.role === "administrator") return true; // Consultants/Admins can see all confidential cases at their assigned sites
        if (c.createdBy === user.id) return true;
        if (c.assignedConsultant === user.id) return true;
        if (c.restrictedToUsers && c.restrictedToUsers.includes(user.id)) return true;
        return false;
      });

      // Attach milestone deadline info to each case (split: overdue vs upcoming)
      const caseIds = filteredCases.map(c => c.id);
      const allMilestones = await storage.getCaseMilestonesForCases(caseIds);
      const now = new Date();
      const overdueByCase: Record<string, Date | null> = {};
      const upcomingByCase: Record<string, Date | null> = {};
      for (const m of allMilestones) {
        if (!m.isCompleted && m.dueDate && !m.isResponseDeadline) {
          const mDate = new Date(m.dueDate);
          if (mDate < now) {
            // Overdue: keep the earliest (most overdue)
            const ex = overdueByCase[m.caseId];
            if (!ex || mDate < ex) overdueByCase[m.caseId] = mDate;
          } else {
            // Upcoming: keep the earliest (soonest)
            const ex = upcomingByCase[m.caseId];
            if (!ex || mDate < ex) upcomingByCase[m.caseId] = mDate;
          }
        }
      }
      const casesWithMilestones = filteredCases.map(c => ({
        ...c,
        overduesMilestoneDueDate: overdueByCase[c.id] ?? null,
        upcomingMilestoneDueDate: upcomingByCase[c.id] ?? null,
      }));

      res.json(casesWithMilestones);
    } catch (error) {
      console.error("Get cases error:", error);
      res.status(500).json({ error: "Failed to fetch cases" });
    }
  });

  // Get single case
  app.get("/api/cases/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Consultants/Admins must have the Case Advocate permission to access any case
      if (user.role === "consultant" || user.role === "administrator") {
        const perms = user.consultantPermissions as { caseAdvocate?: boolean } | null;
        if (!perms?.caseAdvocate) {
          return res.status(403).json({ error: "Case Advocate permission required to view cases" });
        }
      }

      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Authorization check - clients can only access cases for their company's sites
      const canAccessCase = await canUserAccessSite(user, caseData.siteId);
      if (!canAccessCase) {
        return res.status(403).json({ error: "Not authorized to view this case" });
      }

      // Check confidentiality - consultants with site access can see all confidential cases
      if (caseData.isConfidential) {
        const canAccess = user.role === "developer" || 
          user.role === "consultant" || user.role === "administrator" || // Consultants/Admins can see all confidential cases at their assigned sites
          caseData.createdBy === user.id || 
          caseData.assignedConsultant === user.id ||
          (caseData.restrictedToUsers && caseData.restrictedToUsers.includes(user.id));
        
        if (!canAccess) {
          return res.status(403).json({ error: "Not authorized to view this confidential case" });
        }
      }

      res.json(caseData);
    } catch (error) {
      console.error("Get case error:", error);
      res.status(500).json({ error: "Failed to fetch case" });
    }
  });

  // Create case
  app.post("/api/cases", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Only developers and consultants can create cases
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot create employment law cases" });
      }

      // Consultants/Admins must have the Case Advocate permission to create cases
      if (user.role === "consultant" || user.role === "administrator") {
        const perms = user.consultantPermissions as { caseAdvocate?: boolean } | null;
        if (!perms?.caseAdvocate) {
          return res.status(403).json({ error: "Case Advocate permission required to create cases" });
        }
      }

      const parseResult = createCaseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid case data", details: parseResult.error.format() });
      }

      // Check for duplicate case number
      const existingByNumber = await storage.getCaseByCaseNumber(parseResult.data.caseNumber);
      if (existingByNumber) {
        return res.status(409).json({ error: "A case with this case number already exists" });
      }

      const { restrictedToUsers, ...restData } = parseResult.data;
      const caseData = await storage.createCase({
        ...restData,
        hearingDate: parseResult.data.hearingDate ? new Date(parseResult.data.hearingDate) : undefined,
        responseDeadline: parseResult.data.responseDeadline ? new Date(parseResult.data.responseDeadline) : undefined,
        createdBy: user.id,
        assignedConsultant: (user.role === "consultant" || user.role === "administrator") ? user.id : undefined,
        restrictedToUsers: restrictedToUsers ? JSON.stringify(restrictedToUsers) : null,
      });

      // Auto-create the mandatory Response Deadline milestone
      if (parseResult.data.responseDeadline) {
        await storage.createCaseMilestone({
          caseId: caseData.id,
          title: "Response Deadline",
          description: "Mandatory response deadline for this case",
          dueDate: new Date(parseResult.data.responseDeadline),
          isCompleted: false,
          isResponseDeadline: true,
          createdBy: user.id,
        });
      }

      // Create audit log
      await storage.createAuditLog({
        action: "case_created",
        userId: user.id,
        userName: user.fullName,
        entityId: caseData.siteId,
        caseId: caseData.id,
        module: "employment_law",
        details: `Case ${caseData.caseReference} created for ${caseData.employeeName}`,
      });

      // Emit case-updated to admins/consultants AND the owning client company
      // (and any cross-company clients assigned to the site) in real time
      await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });

      res.status(201).json(caseData);
    } catch (error) {
      console.error("Create case error:", error);
      res.status(500).json({ error: "Failed to create case" });
    }
  });

  // Update case
  app.patch("/api/cases/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const existingCase = await storage.getCase(req.params.id);
      if (!existingCase) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Only admins and assigned consultants can update cases
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot update employment law cases" });
      }

      const parseResult = updateCaseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid update data", details: parseResult.error.format() });
      }

      // Check for duplicate case number when updating
      if (parseResult.data.caseNumber) {
        const existingByNumber = await storage.getCaseByCaseNumber(parseResult.data.caseNumber, req.params.id);
        if (existingByNumber) {
          return res.status(409).json({ error: "A case with this case number already exists" });
        }
      }

      const updates: any = { ...parseResult.data };
      if (updates.hearingDate) updates.hearingDate = new Date(updates.hearingDate);
      if (updates.responseDeadline) updates.responseDeadline = new Date(updates.responseDeadline);
      if (updates.resolutionDate) updates.resolutionDate = new Date(updates.resolutionDate);
      if (updates.restrictedToUsers !== undefined) {
        updates.restrictedToUsers = JSON.stringify(updates.restrictedToUsers);
      }

      const updatedCase = await storage.updateCase(req.params.id, updates);

      // Create audit log for status changes
      if (parseResult.data.status && parseResult.data.status !== existingCase.status) {
        await storage.createAuditLog({
          action: "case_status_changed",
          userId: user.id,
          userName: user.fullName,
          entityId: existingCase.siteId,
          caseId: existingCase.id,
          module: "employment_law",
          details: `Case status changed from ${existingCase.status} to ${parseResult.data.status}`,
        });
      }

      // Create audit log for access changes
      if (parseResult.data.restrictedToUsers !== undefined) {
        await storage.createAuditLog({
          action: "case_access_updated",
          userId: user.id,
          userName: user.fullName,
          entityId: existingCase.siteId,
          caseId: existingCase.id,
          module: "employment_law",
          details: `Case access list updated`,
        });
      }

      // Emit case-updated to admins/consultants AND the owning client company
      await emitSiteScoped("case-updated", existingCase.siteId, existingCase.entityId, { caseId: req.params.id });

      res.json(updatedCase);
    } catch (error) {
      console.error("Update case error:", error);
      res.status(500).json({ error: "Failed to update case" });
    }
  });

  // Archive a case
  app.post("/api/cases/:id/archive", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Only developers and consultants can archive cases
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot archive cases" });
      }

      const existingCase = await storage.getCase(req.params.id);
      if (!existingCase) {
        return res.status(404).json({ error: "Case not found" });
      }

      const archivedCase = await storage.archiveCase(req.params.id);
      
      await storage.createAuditLog({
        action: "case_archived",
        userId: user.id,
        userName: user.fullName,
        entityId: existingCase.siteId,
        caseId: existingCase.id,
        module: "employment_law",
        details: `Case ${existingCase.caseReference} archived`,
      });

      await emitSiteScoped("case-updated", existingCase.siteId, existingCase.entityId, { caseId: existingCase.id });

      res.json(archivedCase);
    } catch (error) {
      console.error("Archive case error:", error);
      res.status(500).json({ error: "Failed to archive case" });
    }
  });

  // Unarchive a case
  app.post("/api/cases/:id/unarchive", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Only developers and consultants can unarchive cases
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot unarchive cases" });
      }

      const existingCase = await storage.getCase(req.params.id);
      if (!existingCase) {
        return res.status(404).json({ error: "Case not found" });
      }

      const unarchivedCase = await storage.unarchiveCase(req.params.id);
      
      await storage.createAuditLog({
        action: "case_unarchived",
        userId: user.id,
        userName: user.fullName,
        entityId: existingCase.siteId,
        caseId: existingCase.id,
        module: "employment_law",
        details: `Case ${existingCase.caseReference} restored from archive`,
      });

      await emitSiteScoped("case-updated", existingCase.siteId, existingCase.entityId, { caseId: existingCase.id });

      res.json(unarchivedCase);
    } catch (error) {
      console.error("Unarchive case error:", error);
      res.status(500).json({ error: "Failed to unarchive case" });
    }
  });

  // Delete a case (admin only) — cascades all related data
  app.delete("/api/cases/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      if (user.role !== "developer") return res.status(403).json({ error: "Only developers can delete cases" });

      const existingCase = await storage.getCase(req.params.id);
      if (!existingCase) return res.status(404).json({ error: "Case not found" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const caseId = req.params.id;
        await client.query(`DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE case_id = $1)`, [caseId]);
        await client.query(`DELETE FROM documents WHERE case_id = $1`, [caseId]);
        await client.query(`DELETE FROM case_milestones WHERE case_id = $1`, [caseId]);
        await client.query(`DELETE FROM case_document_checklist WHERE case_id = $1`, [caseId]);
        await client.query(`DELETE FROM case_notes WHERE case_id = $1`, [caseId]);
        await client.query(`DELETE FROM cases WHERE id = $1`, [caseId]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      await storage.createAuditLog({
        action: "case_deleted",
        userId: user.id,
        userName: user.fullName,
        entityId: existingCase.siteId,
        caseId: existingCase.id,
        module: "employment_law",
        details: `Case ${existingCase.caseReference} (${existingCase.employeeName}) permanently deleted by ${user.fullName}`,
      });

      await emitSiteScoped("case-updated", existingCase.siteId, existingCase.entityId, { caseId: existingCase.id, deleted: true });

      res.status(204).end();
    } catch (error) {
      console.error("Delete case error:", error);
      res.status(500).json({ error: "Failed to delete case" });
    }
  });

  // Helper function to check case confidentiality access
  // Consultants with site access can see all confidential cases at their assigned sites
  const canAccessConfidentialCase = (caseData: any, user: any): boolean => {
    if (!caseData.isConfidential) return true;
    if (user.role === "developer") return true;
    if (user.role === "consultant" || user.role === "administrator") return true; // Consultants/Admins can access all confidential cases at their assigned sites
    if (caseData.createdBy === user.id) return true;
    if (caseData.assignedConsultant === user.id) return true;
    if (caseData.restrictedToUsers) {
      const restrictedUsers = typeof caseData.restrictedToUsers === 'string' 
        ? JSON.parse(caseData.restrictedToUsers) 
        : caseData.restrictedToUsers;
      if (Array.isArray(restrictedUsers) && restrictedUsers.includes(user.id)) return true;
    }
    return false;
  };

  // Get case documents
  app.get("/api/cases/:id/documents", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Authorization check - clients can only access cases for their company's sites
      const canAccessCase = await canUserAccessSite(user, caseData.siteId);
      if (!canAccessCase) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Check confidentiality access
      if (!canAccessConfidentialCase(caseData, user)) {
        return res.status(403).json({ error: "Not authorized to access confidential case documents" });
      }

      const documents = await storage.getCaseDocuments(req.params.id);
      res.json(documents);
    } catch (error) {
      console.error("Get case documents error:", error);
      res.status(500).json({ error: "Failed to fetch case documents" });
    }
  });

  // Upload case document (admin/consultant only)
  app.post("/api/cases/:id/documents", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Only admin/consultant can upload case documents
      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
        return res.status(403).json({ error: "Only developers and consultants can upload case documents" });
      }

      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const { title, fileName, fileUrl, fileSize, mimeType } = req.body;

      if (!title || !fileName || !fileUrl) {
        return res.status(400).json({ error: "Missing required fields: title, fileName, fileUrl" });
      }

      // Create the document linked to the case
      const document = await storage.createDocument({
        title,
        comments: `Case document for ${caseData.caseReference}`,
        module: "employment_law",
        type: "case_document",
        entityId: caseData.entityId,
        siteId: caseData.siteId,
        caseId: caseData.id,
        folderId: caseData.folderId,
        fileName,
        fileUrl,
        fileSize: fileSize || 0,
        mimeType: mimeType || "application/octet-stream",
        uploadedBy: user.id,
        status: "compliant",
        approvalStatus: "approved",
        source: "upload",
      });

      // Log the upload
      await storage.createAuditLog({
        action: "document_uploaded",
        userId: user.id,
        userName: user.fullName,
        entityId: caseData.siteId,
        caseId: caseData.id,
        module: "employment_law",
        details: `Document "${title}" uploaded to case ${caseData.caseReference}`,
      });

      await emitDocumentUpdated(document, { documentId: document.id, caseId: caseData.id });
      await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });

      res.status(201).json(document);
    } catch (error) {
      console.error("Upload case document error:", error);
      res.status(500).json({ error: "Failed to upload case document" });
    }
  });

  // Delete case document (admin/consultant only)
  app.delete("/api/cases/:caseId/documents/:docId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Only admin/consultant can delete case documents
      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
        return res.status(403).json({ error: "Only developers and consultants can delete case documents" });
      }

      const caseData = await storage.getCase(req.params.caseId);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const document = await storage.getDocument(req.params.docId);
      if (!document || document.caseId !== caseData.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      await storage.deleteDocument(req.params.docId);

      // Log the deletion
      await storage.createAuditLog({
        action: "document_deleted",
        userId: user.id,
        userName: user.fullName,
        entityId: caseData.siteId,
        caseId: caseData.id,
        module: "employment_law",
        details: `Document "${document.title}" deleted from case ${caseData.caseReference}`,
      });

      await emitDocumentUpdated(document, { documentId: document.id, caseId: caseData.id, deleted: true });
      await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete case document error:", error);
      res.status(500).json({ error: "Failed to delete case document" });
    }
  });

  // Get case milestones
  app.get("/api/cases/:id/milestones", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Check confidentiality access
      if (!canAccessConfidentialCase(caseData, user)) {
        return res.status(403).json({ error: "Not authorized to access confidential case milestones" });
      }

      const milestones = await storage.getCaseMilestones(req.params.id);
      res.json(milestones);
    } catch (error) {
      console.error("Get milestones error:", error);
      res.status(500).json({ error: "Failed to fetch milestones" });
    }
  });

  // Create milestone
  app.post("/api/milestones", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot create milestones" });
      }

      const parseResult = createMilestoneSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid milestone data", details: parseResult.error.format() });
      }

      const caseData = await storage.getCase(parseResult.data.caseId);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const milestone = await storage.createCaseMilestone({
        ...parseResult.data,
        dueDate: parseResult.data.dueDate ? new Date(parseResult.data.dueDate) : undefined,
        createdBy: user.id,
      });

      // Create audit log
      await storage.createAuditLog({
        action: "milestone_added",
        userId: user.id,
        userName: user.fullName,
        entityId: caseData.siteId,
        caseId: caseData.id,
        module: "employment_law",
        details: `Milestone "${milestone.title}" added to case ${caseData.caseReference}`,
      });

      await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });

      res.status(201).json(milestone);
    } catch (error) {
      console.error("Create milestone error:", error);
      res.status(500).json({ error: "Failed to create milestone" });
    }
  });

  // Update milestone (mark complete)
  app.patch("/api/milestones/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const { isCompleted, title, description, dueDate, completedDate, completionNotes } = req.body;
      const updates: any = {};
      
      if (typeof isCompleted === "boolean") {
        updates.isCompleted = isCompleted;
        if (isCompleted) {
          updates.completedDate = completedDate ? new Date(completedDate) : new Date();
          updates.completionNotes = completionNotes ?? null;
        } else {
          updates.completedDate = null;
          updates.completionNotes = null;
        }
      }
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description || null;
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;

      const existing = await storage.getCaseMilestone(req.params.id);
      const milestone = await storage.updateCaseMilestone(req.params.id, updates);
      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      // If this is the Response Deadline milestone and due date changed, sync case field
      if (dueDate !== undefined && milestone.isResponseDeadline) {
        await storage.updateCase(milestone.caseId, {
          responseDeadline: dueDate ? new Date(dueDate) : null,
        } as any);
      }

      // If this milestone is linked to a checklist item, sync back
      if (milestone.checklistItemId) {
        const checklistUpdates: any = {};
        if (dueDate !== undefined) {
          checklistUpdates.submissionDate = dueDate ? new Date(dueDate) : null;
        }
        if (typeof isCompleted === "boolean") {
          checklistUpdates.isCompleted = isCompleted;
          checklistUpdates.completedAt = isCompleted ? (completedDate ? new Date(completedDate) : new Date()) : null;
          checklistUpdates.completedBy = isCompleted ? user.id : null;
        }
        if (Object.keys(checklistUpdates).length > 0) {
          await storage.updateCaseDocumentChecklistItem(milestone.checklistItemId, checklistUpdates);
        }
      }

      const caseData = await storage.getCase(milestone.caseId);

      // Create audit log if completing (with case context)
      if (isCompleted) {
        await storage.createAuditLog({
          action: "milestone_completed",
          userId: user.id,
          userName: user.fullName,
          entityId: caseData?.siteId,
          caseId: milestone.caseId,
          module: "employment_law",
          details: `Milestone "${milestone.title}" marked as completed`,
        });
      }

      if (caseData) await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });

      res.json(milestone);
    } catch (error) {
      console.error("Update milestone error:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  // Delete milestone
  app.delete("/api/milestones/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Only developers and consultants can delete milestones
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot delete milestones" });
      }

      const milestone = await storage.getCaseMilestone(req.params.id);
      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      // Response Deadline milestone cannot be deleted
      if (milestone.isResponseDeadline) {
        return res.status(400).json({ error: "The Response Deadline milestone cannot be deleted. Edit the date instead." });
      }

      const caseData = await storage.getCase(milestone.caseId);
      await storage.deleteCaseMilestone(req.params.id);

      // Create audit log
      if (caseData) {
        await storage.createAuditLog({
          action: "milestone_deleted",
          userId: user.id,
          userName: user.fullName,
          entityId: caseData.siteId,
          caseId: milestone.caseId,
          module: "employment_law",
          details: `Milestone "${milestone.title}" deleted from case ${caseData.caseReference}`,
        });
      }

      if (caseData) await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete milestone error:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

  // ── Case Document Checklist ────────────────────────────────────────────────

  // Get checklist items for a case
  app.get("/api/cases/:id/checklist", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const caseData = await storage.getCase(req.params.id);
      if (!caseData) return res.status(404).json({ error: "Case not found" });

      if (!canAccessConfidentialCase(caseData, user)) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const items = await storage.getCaseDocumentChecklist(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Get checklist error:", error);
      res.status(500).json({ error: "Failed to fetch checklist" });
    }
  });

  // Create checklist item
  app.post("/api/checklist", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot manage the document checklist" });
      }

      const parseResult = createChecklistItemSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid data", details: parseResult.error.format() });
      }

      const caseData = await storage.getCase(parseResult.data.caseId);
      if (!caseData) return res.status(404).json({ error: "Case not found" });

      const { submissionDate, ...rest } = parseResult.data;
      const item = await storage.createCaseDocumentChecklistItem({
        ...rest,
        submissionDate: submissionDate ? new Date(submissionDate) : null,
        createdBy: user.id,
      });

      // Auto-create a linked milestone if a submission date was provided
      let finalItem = item;
      if (submissionDate) {
        const milestone = await storage.createCaseMilestone({
          caseId: item.caseId,
          title: `Submit: ${item.title}`,
          dueDate: new Date(submissionDate),
          checklistItemId: item.id,
          createdBy: user.id,
        });
        finalItem = await storage.updateCaseDocumentChecklistItem(item.id, { linkedMilestoneId: milestone.id }) ?? item;
      }

      await storage.createAuditLog({
        action: "checklist_item_added",
        userId: user.id,
        userName: user.fullName,
        entityId: caseData.siteId,
        caseId: caseData.id,
        module: "employment_law",
        details: `Document checklist item "${item.title}" added to case ${caseData.caseReference}`,
      });

      await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });

      res.status(201).json(finalItem);
    } catch (error) {
      console.error("Create checklist item error:", error);
      res.status(500).json({ error: "Failed to create checklist item" });
    }
  });

  // Update checklist item (mark complete / edit)
  app.patch("/api/checklist/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const existing = await storage.getCaseDocumentChecklistItem(req.params.id);
      if (!existing) return res.status(404).json({ error: "Checklist item not found" });

      const updates: any = { ...req.body };
      if (typeof updates.isCompleted === "boolean") {
        updates.completedAt = updates.isCompleted ? new Date() : null;
        updates.completedBy = updates.isCompleted ? user.id : null;
      }
      if ("submissionDate" in updates) {
        updates.submissionDate = updates.submissionDate ? new Date(updates.submissionDate) : null;
      }

      const item = await storage.updateCaseDocumentChecklistItem(req.params.id, updates);

      // Sync submissionDate / title changes to linked milestone
      if ("submissionDate" in req.body || req.body.title) {
        if (existing.linkedMilestoneId) {
          const milestoneUpdates: any = {};
          if ("submissionDate" in req.body) milestoneUpdates.dueDate = updates.submissionDate ?? null;
          if (req.body.title) milestoneUpdates.title = `Submit: ${req.body.title}`;
          await storage.updateCaseMilestone(existing.linkedMilestoneId, milestoneUpdates);
        } else if ("submissionDate" in req.body && updates.submissionDate) {
          // First time a submission date is being added — create the milestone
          const caseData2 = await storage.getCase(existing.caseId);
          if (caseData2) {
            const milestone = await storage.createCaseMilestone({
              caseId: existing.caseId,
              title: `Submit: ${req.body.title ?? existing.title}`,
              dueDate: updates.submissionDate,
              checklistItemId: existing.id,
              createdBy: user.id,
            });
            await storage.updateCaseDocumentChecklistItem(existing.id, { linkedMilestoneId: milestone.id });
          }
        }
      }

      if (typeof req.body.isCompleted === "boolean") {
        const caseData = await storage.getCase(existing.caseId);
        await storage.createAuditLog({
          action: req.body.isCompleted ? "checklist_item_completed" : "checklist_item_reopened",
          userId: user.id,
          userName: user.fullName,
          entityId: caseData?.siteId,
          caseId: existing.caseId,
          module: "employment_law",
          details: `Document checklist item "${existing.title}" ${req.body.isCompleted ? "marked complete" : "reopened"}`,
        });
      }

      const caseForEmit = await storage.getCase(existing.caseId);
      if (caseForEmit) await emitSiteScoped("case-updated", caseForEmit.siteId, caseForEmit.entityId, { caseId: caseForEmit.id });

      res.json(item);
    } catch (error) {
      console.error("Update checklist item error:", error);
      res.status(500).json({ error: "Failed to update checklist item" });
    }
  });

  // Delete checklist item
  app.delete("/api/checklist/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot delete checklist items" });
      }

      const existing = await storage.getCaseDocumentChecklistItem(req.params.id);
      if (!existing) return res.status(404).json({ error: "Checklist item not found" });

      const caseData = await storage.getCase(existing.caseId);
      await storage.deleteCaseDocumentChecklistItem(req.params.id);

      if (caseData) {
        await storage.createAuditLog({
          action: "checklist_item_deleted",
          userId: user.id,
          userName: user.fullName,
          entityId: caseData.siteId,
          caseId: existing.caseId,
          module: "employment_law",
          details: `Document checklist item "${existing.title}" deleted from case ${caseData.caseReference}`,
        });
      }

      if (caseData) await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete checklist item error:", error);
      res.status(500).json({ error: "Failed to delete checklist item" });
    }
  });

  // ── Case Document Bundles ─────────────────────────────────────────────────

  // List bundles for a case
  app.get("/api/cases/:id/bundles", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (!canAccessConfidentialCase(caseData, user)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const bundles = await storage.getCaseBundles(req.params.id);
      res.json(bundles);
    } catch (error) {
      console.error("List bundles error:", error);
      res.status(500).json({ error: "Failed to fetch bundles" });
    }
  });

  // Create bundle
  app.post("/api/cases/:id/bundles", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role === "client") return res.status(403).json({ error: "Clients cannot create bundles" });
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (!canAccessConfidentialCase(caseData, user)) return res.status(403).json({ error: "Not authorized" });

      const { name, checklistItemIds } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Bundle name is required" });
      }
      if (!Array.isArray(checklistItemIds)) {
        return res.status(400).json({ error: "checklistItemIds must be an array" });
      }

      const bundle = await storage.createCaseBundle({
        caseId: req.params.id,
        name: name.trim(),
        checklistItemIds,
        createdBy: user.id,
      });
      await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });
      res.status(201).json(bundle);
    } catch (error) {
      console.error("Create bundle error:", error);
      res.status(500).json({ error: "Failed to create bundle" });
    }
  });

  // Update bundle (rename or change items — also clears cache)
  app.patch("/api/cases/:caseId/bundles/:bundleId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role === "client") return res.status(403).json({ error: "Clients cannot edit bundles" });

      const bundle = await storage.getCaseBundle(req.params.bundleId);
      if (!bundle || bundle.caseId !== req.params.caseId) return res.status(404).json({ error: "Bundle not found" });

      const caseData = await storage.getCase(req.params.caseId);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (!canAccessConfidentialCase(caseData, user)) return res.status(403).json({ error: "Not authorized" });

      const updates: Record<string, unknown> = {};
      if (req.body.name && typeof req.body.name === "string") updates.name = req.body.name.trim();
      if (Array.isArray(req.body.checklistItemIds)) {
        updates.checklistItemIds = req.body.checklistItemIds;
      }

      // Invalidate + delete cached PDF on any change
      if (bundle.cachedFileUrl) {
        const objectStorageService = new ObjectStorageService();
        await objectStorageService.deleteObjectEntityFile(bundle.cachedFileUrl).catch(() => {});
      }
      updates.cachedFileUrl = null;
      updates.cachedAt = null;

      const updated = await storage.updateCaseBundle(req.params.bundleId, updates);
      await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });
      res.json(updated);
    } catch (error) {
      console.error("Update bundle error:", error);
      res.status(500).json({ error: "Failed to update bundle" });
    }
  });

  // Delete bundle
  app.delete("/api/cases/:caseId/bundles/:bundleId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role === "client") return res.status(403).json({ error: "Clients cannot delete bundles" });

      const bundle = await storage.getCaseBundle(req.params.bundleId);
      if (!bundle || bundle.caseId !== req.params.caseId) return res.status(404).json({ error: "Bundle not found" });

      const caseData = await storage.getCase(req.params.caseId);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (!canAccessConfidentialCase(caseData, user)) return res.status(403).json({ error: "Not authorized" });

      // Clean up cached file if present
      if (bundle.cachedFileUrl) {
        const objectStorageService = new ObjectStorageService();
        await objectStorageService.deleteObjectEntityFile(bundle.cachedFileUrl).catch(() => {});
      }

      await storage.deleteCaseBundle(req.params.bundleId);
      await emitSiteScoped("case-updated", caseData.siteId, caseData.entityId, { caseId: caseData.id });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete bundle error:", error);
      res.status(500).json({ error: "Failed to delete bundle" });
    }
  });

  // Download (or generate) a bundle PDF
  app.post("/api/cases/:caseId/bundles/:bundleId/download", requireAuth, async (req, res) => {
    // Allow up to 5 minutes for generation
    req.setTimeout(300_000);

    let tempDir: string | null = null;
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const bundle = await storage.getCaseBundle(req.params.bundleId);
      if (!bundle || bundle.caseId !== req.params.caseId) return res.status(404).json({ error: "Bundle not found" });

      const caseData = await storage.getCase(req.params.caseId);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (!canAccessConfidentialCase(caseData, user)) return res.status(403).json({ error: "Not authorized" });

      const objectStorageService = new ObjectStorageService();

      // Build filename: {caseRef}-{bundle-name-slug}.pdf
      const bundleSlug = bundle.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const downloadFilename = `${caseData.caseReference}-${bundleSlug}.pdf`;

      // Serve from cache if available
      if (bundle.cachedFileUrl) {
        try {
          const cachedFile = await objectStorageService.getObjectEntityFile(bundle.cachedFileUrl);
          await objectStorageService.downloadObject(cachedFile, res, 0, downloadFilename);
          return;
        } catch {
          // Cache miss — regenerate
          await storage.updateCaseBundle(bundle.id, { cachedFileUrl: null, cachedAt: null });
        }
      }

      if (bundle.checklistItemIds.length === 0) {
        return res.status(400).json({ error: "Bundle has no documents" });
      }

      // Serialize the entire generation pipeline so only one bundle is generated at a time
      const finalBuffer = await withBundleGeneration(async () => {
        // Load checklist items — preserve bundle's custom ordering via checklistItemIds
        const allChecklist = await storage.getCaseDocumentChecklist(req.params.caseId);
        const checklistMap = new Map(allChecklist.map(item => [item.id, item]));
        const selectedItems = bundle.checklistItemIds
          .map(id => checklistMap.get(id))
          .filter((item): item is (typeof allChecklist)[number] => !!item);

        if (selectedItems.length === 0) {
          throw new Error("No matching checklist items found");
        }

        // Create temp dir
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bundle_"));

        const pdfPaths: string[] = [];

        for (let i = 0; i < selectedItems.length; i++) {
          const item = selectedItems[i];
          if (!item.linkedDocumentId) continue;

          const doc = await storage.getDocument(item.linkedDocumentId);
          if (!doc || !doc.fileUrl) continue;

          try {
            const objectFile = await objectStorageService.getObjectEntityFile(doc.fileUrl);
            const [fileBuffer] = await objectFile.download();
            const mimeType = doc.mimeType || "application/octet-stream";
            const pdfPath = await convertFileToPdf(Buffer.from(fileBuffer), mimeType, tempDir, i, doc.fileName);
            pdfPaths.push(pdfPath);
          } catch (fileError) {
            console.warn(`Bundle: skipping item ${item.id} due to error:`, fileError);
          }
        }

        if (pdfPaths.length === 0) {
          throw new Error("No documents could be converted to PDF");
        }

        // Merge all PDFs
        const mergedPath = path.join(tempDir, "merged.pdf");
        await mergePdfs(pdfPaths, mergedPath);

        // Add page numbers
        const numberedPath = path.join(tempDir, "final.pdf");
        await addPageNumbers(mergedPath, numberedPath);

        // Read the final PDF
        const buf = await fs.readFile(numberedPath);

        // Count pages in the generated PDF
        const pageCount = await countPdfPages(numberedPath);

        // Upload to GCS for caching
        try {
          const cachedUrl = await objectStorageService.saveBundle(buf, bundle.id);
          await storage.updateCaseBundle(bundle.id, {
            cachedFileUrl: cachedUrl,
            cachedAt: new Date(),
            fileSizeBytes: buf.length,
            pageCount: pageCount || null,
          });
        } catch (cacheErr) {
          console.warn("Bundle: failed to cache PDF in GCS:", cacheErr);
        }

        return buf;
      });

      // Stream the PDF to the client
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFilename}"`,
        "Content-Length": finalBuffer.length,
      });
      res.send(finalBuffer);
    } catch (error) {
      console.error("Bundle download error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate bundle PDF" });
      }
    } finally {
      if (tempDir) {
        fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  });

  // Case Notes
  app.get("/api/cases/:id/notes", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const notes = await storage.getCaseNotes(req.params.id);
      const allUsers = await storage.getAllUsers();
      const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.fullName]));
      const enriched = notes.map(n => ({ ...n, createdByName: userMap[n.createdBy] ?? "Unknown" }));
      res.json(enriched);
    } catch (error) {
      console.error("Get case notes error:", error);
      res.status(500).json({ error: "Failed to get case notes" });
    }
  });

  app.post("/api/cases/:id/notes", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role === "client") return res.status(403).json({ error: "Clients cannot add case notes" });

      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Content is required" });

      const note = await storage.createCaseNote({
        caseId: req.params.id,
        content: content.trim(),
        createdBy: user.id,
      });
      const noteCase = await storage.getCase(req.params.id).catch(() => null);
      if (noteCase) await emitSiteScoped("case-updated", noteCase.siteId, noteCase.entityId, { caseId: req.params.id });
      res.json(note);
    } catch (error) {
      console.error("Create case note error:", error);
      res.status(500).json({ error: "Failed to create case note" });
    }
  });

  app.patch("/api/notes/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role === "client") return res.status(403).json({ error: "Clients cannot edit case notes" });

      const existing = await storage.getCaseNote(req.params.id);
      if (!existing) return res.status(404).json({ error: "Note not found" });
      if (existing.createdBy !== user.id && user.role !== "developer") {
        return res.status(403).json({ error: "You can only edit your own notes" });
      }

      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Content is required" });

      const note = await storage.updateCaseNote(req.params.id, { content: content.trim() });
      res.json(note);
    } catch (error) {
      console.error("Update case note error:", error);
      res.status(500).json({ error: "Failed to update case note" });
    }
  });

  app.delete("/api/notes/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role === "client") return res.status(403).json({ error: "Clients cannot delete case notes" });

      const existing = await storage.getCaseNote(req.params.id);
      if (!existing) return res.status(404).json({ error: "Note not found" });
      if (existing.createdBy !== user.id && user.role !== "developer") {
        return res.status(403).json({ error: "You can only delete your own notes" });
      }

      await storage.deleteCaseNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete case note error:", error);
      res.status(500).json({ error: "Failed to delete case note" });
    }
  });

  // Get case audit logs
  app.get("/api/cases/:id/audit", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Check confidentiality access
      if (!canAccessConfidentialCase(caseData, user)) {
        return res.status(403).json({ error: "Not authorized to access confidential case audit logs" });
      }

      // Get all audit logs for this case
      const allLogs = await storage.getAuditLogs(undefined, "employment_law");
      const caseLogs = allLogs.filter(log => log.caseId === req.params.id);
      
      res.json(caseLogs);
    } catch (error) {
      console.error("Get case audit error:", error);
      res.status(500).json({ error: "Failed to fetch case audit logs" });
    }
  });

  // Entity Module Access Routes
  
  // Get module access for current user (based on their company's module access)
  app.get("/api/user/module-access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Admin/consultants have active access to all modules
      if (user.role === "developer" || user.role === "consultant" || user.role === "administrator") {
        return res.json({
          health_safety: "active",
          human_resources: "active",
          employment_law: "active",
          training: "active",
          toolkit: "active",
          support: "active",
          reports: "active",
        });
      }
      
      // For clients, use company-level module access
      // If company has module access, it's "active", otherwise "hidden"
      if (!user.companyId) {
        return res.json({
          health_safety: "hidden",
          human_resources: "hidden",
          employment_law: "hidden",
          training: "hidden",
          toolkit: "hidden",
          support: "hidden",
          reports: "hidden",
        });
      }
      
      const companyAccess = await storage.getCompanyModuleAccess(user.companyId);
      
      if (!companyAccess) {
        return res.json({
          health_safety: "hidden",
          human_resources: "hidden",
          employment_law: "hidden",
          training: "hidden",
          toolkit: "hidden",
          support: "hidden",
          reports: "hidden",
        });
      }
      
      // Merge in inherited access for Group Owner companies
      const inherited = await storage.getGroupOwnerInheritedAccess(user.companyId);
      
      // Convert company boolean access to status format for frontend compatibility
      res.json({
        health_safety: (companyAccess.healthSafety || inherited.healthSafety) ? "active" : "hidden",
        human_resources: (companyAccess.humanResources || inherited.humanResources) ? "active" : "hidden",
        employment_law: (companyAccess.employmentLaw || inherited.employmentLaw) ? "active" : "hidden",
        training: (companyAccess.training || inherited.training) ? "active" : "hidden",
        toolkit: (companyAccess.toolkit || inherited.toolkit) ? "active" : "hidden",
        support: (companyAccess.support || inherited.support) ? "active" : "hidden",
        reports: (companyAccess.reports || inherited.reports) ? "active" : "hidden",
      });
    } catch (error) {
      console.error("Get user module access error:", error);
      res.status(500).json({ error: "Failed to fetch module access" });
    }
  });
  
  // Get module access for an entity
  app.get("/api/sites/:siteId/module-access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Authorization: clients can only view their own company's sites' access
      const canAccess = await canUserAccessSite(user, req.params.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Not authorized to view this entity's module access" });
      }
      
      const access = await storage.getSiteModuleAccess(req.params.siteId);
      res.json(access);
    } catch (error) {
      console.error("Get entity module access error:", error);
      res.status(500).json({ error: "Failed to fetch module access" });
    }
  });

  // Set module access for an entity (admin/consultant only)
  app.post("/api/sites/:siteId/module-access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Developers, administrators, and all consultants can set module access
      if (user.role !== "developer" && user.role !== "administrator" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only staff can manage module access" });
      }
      
      // Consultants must be assigned to this site
      if (user.role === "consultant") {
        const assignments = await storage.getConsultantAssignments(user.id);
        const siteAssignment = assignments.find(a => a.siteId === req.params.siteId);
        if (!siteAssignment) {
          return res.status(403).json({ error: "You are not assigned to this site" });
        }
      }
      
      const { module, status, notes } = req.body;
      if (!module || !status) {
        return res.status(400).json({ error: "Module and status are required" });
      }
      
      // Validate module and status against allowed values
      const validModules = ["health_safety", "human_resources", "employment_law", "training", "support", "reports"];
      const validStatuses = ["active", "visible", "hidden"];
      
      if (!validModules.includes(module)) {
        return res.status(400).json({ error: `Invalid module. Must be one of: ${validModules.join(", ")}` });
      }
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }
      
      const access = await storage.setSiteModuleAccess(
        req.params.siteId,
        module,
        status,
        user.id,
        notes
      );
      
      // Emit module-access-changed to all users assigned to this site
      try {
        const siteUsers = await storage.getUsersBySite(req.params.siteId);
        for (const u of siteUsers) {
          emitToUser(u.id, "module-access-changed", { siteId: req.params.siteId, module, status });
        }
      } catch { /* non-fatal */ }

      res.status(201).json(access);
    } catch (error) {
      console.error("Set entity module access error:", error);
      res.status(500).json({ error: "Failed to set module access" });
    }
  });

  // Company Module Access Routes (NEW - company-level module access)
  
  // Get module access for a company
  app.get("/api/companies/:companyId/module-access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Clients can only view their own company's access
      if (user.role === "client" && user.companyId !== req.params.companyId) {
        return res.status(403).json({ error: "Not authorized to view this company's module access" });
      }
      
      const access = await storage.getCompanyModuleAccess(req.params.companyId);
      if (!access) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      const inherited = await storage.getGroupOwnerInheritedAccess(req.params.companyId);
      res.json({ ...access, inherited });
    } catch (error) {
      console.error("Get company module access error:", error);
      res.status(500).json({ error: "Failed to fetch module access" });
    }
  });

  // Set module access for a company (admin only)
  app.post("/api/companies/:companyId/module-access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Developers, administrators, and all consultants can set company module access
      if (user.role !== "developer" && user.role !== "administrator" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only staff can manage company module access" });
      }
      
      // Consultants must be assigned to at least one site in this company
      if (user.role === "consultant") {
        const consultantSites = await storage.getConsultantSites(user.id);
        const companySites = await storage.getSitesByCompanyId(req.params.companyId);
        const companySiteIds = new Set(companySites.map(s => s.id));
        const hasAccess = consultantSites.some(a => companySiteIds.has(a.entityId));
        if (!hasAccess) {
          return res.status(403).json({ error: "You are not assigned to any site in this company" });
        }
      }
      
      const { healthSafety, humanResources, employmentLaw, training, toolkit, support, reports } = req.body;
      
      // At least one module should be specified
      if (healthSafety === undefined && humanResources === undefined && 
          employmentLaw === undefined && training === undefined && toolkit === undefined &&
          support === undefined && reports === undefined) {
        return res.status(400).json({ error: "At least one module access setting is required" });
      }
      
      // Check inherited modules — cannot disable what's inherited from member companies
      const inherited = await storage.getGroupOwnerInheritedAccess(req.params.companyId);
      const modulesToCheck: Array<[string | undefined, boolean]> = [
        [healthSafety, inherited.healthSafety],
        [humanResources, inherited.humanResources],
        [employmentLaw, inherited.employmentLaw],
        [training, inherited.training],
        [toolkit, inherited.toolkit],
        [support, inherited.support],
        [reports, inherited.reports],
      ];
      const tryingToDisableInherited = modulesToCheck.some(([val, inh]) => val === false && inh);
      if (tryingToDisableInherited) {
        return res.status(400).json({ error: "Cannot disable a module that is inherited from a member company" });
      }
      
      const company = await storage.setCompanyModuleAccess(req.params.companyId, {
        healthSafety,
        humanResources,
        employmentLaw,
        training,
        toolkit,
        support,
        reports,
      });
      
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Emit module-access-changed to all users in this company
      try {
        emitToCompany(req.params.companyId, "module-access-changed", { companyId: req.params.companyId });
      } catch { /* non-fatal */ }

      res.json({
        healthSafety: company.healthSafetyAccess,
        humanResources: company.humanResourcesAccess,
        employmentLaw: company.employmentLawAccess,
        training: company.trainingAccess,
        toolkit: company.toolkitAccess,
        support: company.supportAccess,
        reports: company.reportsAccess,
      });
    } catch (error) {
      console.error("Set company module access error:", error);
      res.status(500).json({ error: "Failed to set module access" });
    }
  });

  // Company Required Templates Routes
  app.get("/api/companies/:companyId/required-templates", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { companyId } = req.params;
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      if (user.role === "consultant" && !isProConsultant(user)) {
        const sites = await storage.getSites();
        const companySites = sites.filter(s => s.companyId === companyId);
        const assignments = await storage.getConsultantSites(user.id);
        const assignedSiteIds = new Set(assignments.map(a => a.siteId));
        if (!companySites.some(s => assignedSiteIds.has(s.id))) {
          return res.status(403).json({ error: "Not authorized for this company" });
        }
      }
      const requiredTemplates = await storage.getCompanyRequiredTemplates(companyId);
      res.json(requiredTemplates);
    } catch (error) {
      console.error("Get company required templates error:", error);
      res.status(500).json({ error: "Failed to fetch required templates" });
    }
  });

  app.put("/api/companies/:companyId/required-templates", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { companyId } = req.params;
      const { templateIds } = req.body as { templateIds: string[] };
      if (!Array.isArray(templateIds) || !templateIds.every(id => typeof id === "string")) {
        return res.status(400).json({ error: "templateIds must be an array of strings" });
      }
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      if (user.role === "consultant" && !isProConsultant(user)) {
        const sites = await storage.getSites();
        const companySites = sites.filter(s => s.companyId === companyId);
        const assignments = await storage.getConsultantSites(user.id);
        const assignedSiteIds = new Set(assignments.map(a => a.siteId));
        if (!companySites.some(s => assignedSiteIds.has(s.id))) {
          return res.status(403).json({ error: "Not authorized for this company" });
        }
      }
      const uniqueIds = [...new Set(templateIds)];
      const allTemplates = await storage.getDocumentTemplates();
      const validIds = new Set(allTemplates.filter(t => t.isActive && t.visibility === "private").map(t => t.id));
      const filteredIds = uniqueIds.filter(id => validIds.has(id));
      const result = await storage.setCompanyRequiredTemplates(companyId, filteredIds, user.id);
      emitToCompany(companyId, "company-mandatory-templates-updated", { companyId });
      emitToRole("developer", "company-mandatory-templates-updated", { companyId });
      emitToRole("consultant", "company-mandatory-templates-updated", { companyId });
      res.json(result);
    } catch (error) {
      console.error("Set company required templates error:", error);
      res.status(500).json({ error: "Failed to set required templates" });
    }
  });

  app.post("/api/companies/:companyId/required-templates", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { companyId } = req.params;
      const { templateId } = req.body as { templateId: string };
      if (!templateId || typeof templateId !== "string") {
        return res.status(400).json({ error: "templateId is required" });
      }
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const allTemplates = await storage.getDocumentTemplates();
      const template = allTemplates.find(t => t.id === templateId && t.isActive && t.visibility === "private");
      if (!template) return res.status(400).json({ error: "Template not found or not available" });
      const result = await storage.addCompanyRequiredTemplate(companyId, templateId, user.id);
      emitToCompany(companyId, "company-mandatory-templates-updated", { companyId });
      emitToRole("developer", "company-mandatory-templates-updated", { companyId });
      emitToRole("consultant", "company-mandatory-templates-updated", { companyId });
      res.status(201).json(result);
    } catch (error) {
      console.error("Add company required template error:", error);
      res.status(500).json({ error: "Failed to add required template" });
    }
  });

  app.delete("/api/companies/:companyId/required-templates/:templateId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { companyId, templateId } = req.params;
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });
      // Member-level removal of an inherited row is allowed: storage will
      // soft-remove (mark removed_at) on first call so the row stays visible
      // as a struck-through "was required, not anymore" entry, and hard-
      // delete on a subsequent call against an already-soft-removed row.
      await storage.removeCompanyRequiredTemplate(companyId, templateId);
      emitToCompany(companyId, "company-mandatory-templates-updated", { companyId });
      emitToRole("developer", "company-mandatory-templates-updated", { companyId });
      emitToRole("consultant", "company-mandatory-templates-updated", { companyId });
      res.status(204).end();
    } catch (error) {
      console.error("Remove company required template error:", error);
      res.status(500).json({ error: "Failed to remove required template" });
    }
  });

  // Site Template Overrides — per-site required document additions/exclusions
  app.get("/api/sites/:siteId/template-overrides", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { siteId } = req.params;
      const overrides = await storage.getSiteTemplateOverrides(siteId);
      res.json(overrides);
    } catch (error) {
      console.error("Get site template overrides error:", error);
      res.status(500).json({ error: "Failed to fetch site template overrides" });
    }
  });

  app.post("/api/sites/:siteId/template-overrides", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { siteId } = req.params;
      const { templateId, action } = req.body;
      if (!templateId || !action || (action !== "include" && action !== "exclude")) {
        return res.status(400).json({ error: "templateId and action ('include'|'exclude') are required" });
      }
      const result = await storage.setSiteTemplateOverride(siteId, templateId, action, user.id);
      await emitSiteScoped("site-updated", siteId, null, { siteId });
      res.json(result);
    } catch (error) {
      console.error("Set site template override error:", error);
      res.status(500).json({ error: "Failed to set site template override" });
    }
  });

  app.delete("/api/sites/:siteId/template-overrides/:templateId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { siteId, templateId } = req.params;
      const removed = await storage.removeSiteTemplateOverride(siteId, templateId);
      if (!removed) return res.status(404).json({ error: "Override not found" });
      await emitSiteScoped("site-updated", siteId, null, { siteId });
      res.json({ success: true });
    } catch (error) {
      console.error("Remove site template override error:", error);
      res.status(500).json({ error: "Failed to remove site template override" });
    }
  });

  // Get documents hierarchy for a site module (folder-based view with compliance stats)
  app.get("/api/sites/:siteId/modules/:module/documents-hierarchy", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const { siteId, module } = req.params;
      const requestedCompanyId = req.query.companyId as string | undefined;
      const requestedGroupOwnerId = req.query.groupOwnerId as string | undefined;
      
      // Handle "all" siteId - aggregate across multiple sites
      const isAllSites = siteId === "all";
      
      // Authorization: check site access (or skip for "all" since we filter below)
      if (!isAllSites) {
        const canAccess = await canUserAccessSite(user, siteId);
        if (!canAccess) {
          return res.status(403).json({ error: "Not authorized to view this site's documents" });
        }
      }
      
      // Validate module type (using ModuleType values from schema)
      const validModules = ["health_safety", "human_resources", "employment_law", "training", "support"];
      if (!validModules.includes(module)) {
        return res.status(400).json({ error: "Invalid module type" });
      }
      
      // Get folder templates for this module (exclude locked Toolkit folders and their mirrored subfolders)
      const folderTemplates = (await storage.getFolderTemplates(module as any))
        .filter(ft => !(ft as any).isLocked && !(ft as any).toolkitFolderId);
      
      // Get document templates for this module (to check required templates)
      const allDocTemplates = await storage.getDocumentTemplates();
      const moduleDocTemplates = allDocTemplates.filter(dt => dt.module === module && dt.isActive);
      
      // Determine which sites to include
      let targetSiteIds: string[] = [];
      let allSitesHierarchyEarly: Awaited<ReturnType<typeof storage.getSites>> = [];
      if (isAllSites) {
        // Pre-build group member company ID set when filtering by group scope.
        let groupMemberCompanyIds: Set<string> | null = null;
        if (requestedGroupOwnerId) {
          const groupMembers = await storage.getGroupMembers(requestedGroupOwnerId);
          groupMemberCompanyIds = new Set([requestedGroupOwnerId, ...groupMembers.map(c => c.id)]);
        }

        // Batch access checks (admins short-circuit immediately).
        const allSitesForAccess = await storage.getSites();
        allSitesHierarchyEarly = allSitesForAccess;
        const accessChecks = await Promise.all(allSitesForAccess.map(s => canUserAccessSite(user, s.id)));
        for (let i = 0; i < allSitesForAccess.length; i++) {
          if (!accessChecks[i]) continue;
          const site = allSitesForAccess[i];
          if (groupMemberCompanyIds) {
            if (site.companyId && groupMemberCompanyIds.has(site.companyId)) targetSiteIds.push(site.id);
          } else if (requestedCompanyId) {
            if (site.companyId === requestedCompanyId) targetSiteIds.push(site.id);
          } else {
            targetSiteIds.push(site.id);
          }
        }
      } else {
        targetSiteIds = [siteId];
      }

      // Get all documents for target sites in this module
      const includeArchived = req.query.includeArchived === "true";

      // Fetch document folders, documents, and bulk lookup data in parallel.
      const [siteFolderArrays, allDocuments, allSharesHierarchy, allCompanyReqsHierarchy, allSiteOverridesHierarchy, allCompaniesHierarchy] = await Promise.all([
        Promise.all(targetSiteIds.map(id => storage.getDocumentFolders(id, module as any))),
        storage.getDocuments(module as any, includeArchived),
        storage.getAllDocumentSharesRaw(),
        storage.getAllCompanyRequiredTemplatesRaw(),
        storage.getAllSiteTemplateOverridesRaw(),
        storage.getCompanies(),
      ]);
      const siteFolders = siteFolderArrays.flat();
      // Exclude case docs, incident docs, and cloud share (source "external") — same as table view and dashboard
      const siteDocuments = allDocuments.filter(d =>
        targetSiteIds.includes(d.siteId) &&
        !d.caseId &&
        !d.incidentId &&
        d.source !== "external"
      );

      // Build in-memory lookup maps from bulk data fetched above — no per-site DB calls.
      const companyMapHierarchy = new Map(allCompaniesHierarchy.map(c => [c.id, c]));
      const sharesByDocIdHierarchy = new Map<string, typeof allSharesHierarchy>();
      for (const share of allSharesHierarchy) {
        if (!sharesByDocIdHierarchy.has(share.documentId)) sharesByDocIdHierarchy.set(share.documentId, []);
        sharesByDocIdHierarchy.get(share.documentId)!.push(share);
      }
      const companyReqCacheHierarchy = new Map<string, Set<string>>();
      for (const req of allCompanyReqsHierarchy) {
        if (req.removedAt) continue;
        if (!companyReqCacheHierarchy.has(req.companyId)) companyReqCacheHierarchy.set(req.companyId, new Set());
        companyReqCacheHierarchy.get(req.companyId)!.add(req.templateId);
      }
      const siteOverridesCache = new Map<string, { excludedIds: Set<string>; includedIds: Set<string> }>();
      for (const override of allSiteOverridesHierarchy) {
        if (!siteOverridesCache.has(override.siteId)) siteOverridesCache.set(override.siteId, { excludedIds: new Set(), includedIds: new Set() });
        const entry = siteOverridesCache.get(override.siteId)!;
        if (override.action === "exclude") entry.excludedIds.add(override.templateId);
        else entry.includedIds.add(override.templateId);
      }

      // Reuse already-fetched sites list (from the isAllSites branch or fetch once).
      const allSitesHierarchy = allSitesHierarchyEarly.length > 0
        ? allSitesHierarchyEarly
        : await storage.getSites();
      // Site name lookup for per-site missing slot rendering
      const siteNameById = new Map<string, string>(allSitesHierarchy.map(s => [s.id, s.name]));
      const siteToCompanyHierarchy = new Map(allSitesHierarchy.map(s => [s.id, s.companyId]));

      // All scoped docs (non-site) for in-memory shared-doc computation.
      const allScopedDocsHierarchy = allDocuments.filter(d => !d.siteId && (d.scope === "company" || d.scope === "group"));

      // In-memory equivalent of getSharedDocumentsForSite — no DB calls per site.
      function computeSharedDocsForSiteH(siteId: string) {
        const companyId = siteToCompanyHierarchy.get(siteId) ?? null;
        if (!companyId) return [];
        const company = companyMapHierarchy.get(companyId);
        if (!company) return [];
        const seenIds = new Set<string>();
        const results: any[] = [];
        for (const doc of allScopedDocsHierarchy) {
          if (seenIds.has(doc.id)) continue;
          if (!includeArchived && doc.isArchived) continue;
          if (module && doc.module !== module) continue;
          const shares = sharesByDocIdHierarchy.get(doc.id) ?? [];
          if (doc.scope === "company" && doc.entityId === companyId) {
            // Company-scope docs owned by this company always appear at this company's
            // own sites — no explicit share record required. Share records are only used
            // to share a doc to a different company/site (cross-company visibility).
            seenIds.add(doc.id);
            results.push({ ...doc, sharedScope: "company", sharedFromEntityName: company.name });
          } else if (doc.scope === "group" && doc.entityId === companyId) {
            // Own group doc: appears at own sites only if at least one share record exists
            if (shares.length > 0) {
              seenIds.add(doc.id);
              results.push({ ...doc, sharedScope: "group", sharedFromEntityName: company.name });
            }
          } else if (doc.scope === "group" && (company as any).groupOwnerId && doc.entityId === (company as any).groupOwnerId) {
            if (shares.some((s: any) => s.entityType === "company" && s.entityId === companyId)) {
              const goCompany = companyMapHierarchy.get((company as any).groupOwnerId);
              seenIds.add(doc.id);
              results.push({ ...doc, sharedScope: "group", sharedFromEntityName: goCompany?.name ?? null });
            }
          }
        }
        return results;
      }

      // Build shared-doc maps using in-memory computation.
      const sharedDocsByFolderTemplateId = new Map<string, any[]>();
      const sharedFulfillmentBySiteAndTemplate = new Map<string, Set<string>>(); // siteId -> Set<templateId>
      {
        const sharedFolderIdsCollected = new Set<string>();
        const perSiteShared: { siteId: string; docs: any[] }[] = [];
        for (const sId of targetSiteIds) {
          const sharedForSite = computeSharedDocsForSiteH(sId);
          perSiteShared.push({ siteId: sId, docs: sharedForSite });
          for (const d of sharedForSite) {
            if (d.folderId) sharedFolderIdsCollected.add(d.folderId);
          }
        }
        const folderTplLookup = new Map<string, string | null>();
        if (sharedFolderIdsCollected.size > 0) {
          const folderRows = await Promise.all(
            Array.from(sharedFolderIdsCollected).map(fid => storage.getDocumentFolder(fid))
          );
          for (const f of folderRows) {
            if (f) folderTplLookup.set(f.id, f.templateId ?? null);
          }
        }
        const seenSharedDocByFolderTpl = new Map<string, Set<string>>();
        for (const { siteId: sId, docs } of perSiteShared) {
          for (const d of docs) {
            if (d.templateId) {
              const set = sharedFulfillmentBySiteAndTemplate.get(sId) ?? new Set<string>();
              set.add(d.templateId);
              sharedFulfillmentBySiteAndTemplate.set(sId, set);
            }
            const ftId = d.folderId ? folderTplLookup.get(d.folderId) : null;
            if (!ftId) continue;
            const seen = seenSharedDocByFolderTpl.get(ftId) ?? new Set<string>();
            if (seen.has(d.id)) continue;
            seen.add(d.id);
            seenSharedDocByFolderTpl.set(ftId, seen);
            const arr = sharedDocsByFolderTemplateId.get(ftId) ?? [];
            arr.push(d);
            sharedDocsByFolderTemplateId.set(ftId, arr);
          }
        }
      }

      const getEffectiveIsRequired = (doc: { isMandatory: boolean; templateId?: string | null; siteId: string }, docTmpl?: { isMandatory?: boolean } | null) => {
        const companyId = siteToCompanyHierarchy.get(doc.siteId);
        const isRequiredViaCompanyTemplate = companyId && doc.templateId
          ? (companyReqCacheHierarchy.get(companyId)?.has(doc.templateId) ?? false)
          : false;
        return doc.isMandatory || docTmpl?.isMandatory || isRequiredViaCompanyTemplate;
      };

      // Flat set of required template IDs that count as mandatory slots for the
      // CURRENT scope. Mandatory documents only filter DOWN the hierarchy
      // (Group > Company > Site), never up or sideways:
      //  - Group view: only the group OWNER's own required templates. Member
      //    companies' requirements must NOT bubble up to the group level.
      //  - Company view: only that company's own required templates (which already
      //    include any group-level requirements cascaded down to it).
      //  - All-companies (admin) view: union across every company.
      const allCompanyRequiredTemplateIds = new Set<string>();
      if (requestedGroupOwnerId) {
        const ownerReqs = companyReqCacheHierarchy.get(requestedGroupOwnerId);
        if (ownerReqs) for (const id of ownerReqs) allCompanyRequiredTemplateIds.add(id);
      } else if (requestedCompanyId) {
        const companyReqs = companyReqCacheHierarchy.get(requestedCompanyId);
        if (companyReqs) for (const id of companyReqs) allCompanyRequiredTemplateIds.add(id);
      } else {
        for (const reqSet of companyReqCacheHierarchy.values()) {
          for (const id of reqSet) allCompanyRequiredTemplateIds.add(id);
        }
      }

      // For a single-site view, pre-compute the effective required set that
      // respects the site's exclude/include overrides so the folder Required/Missing
      // badges match exactly what is shown in the site's Required Documents panel.
      const singleSiteEffectiveRequired = (!isAllSites && targetSiteIds.length === 1)
        ? (() => {
            const sid = targetSiteIds[0];
            const companyId = siteToCompanyHierarchy.get(sid);
            const companyReq = companyId
              ? (companyReqCacheHierarchy.get(companyId) ?? new Set<string>())
              : new Set<string>();
            const { excludedIds, includedIds } = siteOverridesCache.get(sid) ?? { excludedIds: new Set<string>(), includedIds: new Set<string>() };
            const effective = new Set<string>();
            for (const id of companyReq) {
              if (!excludedIds.has(id)) effective.add(id);
            }
            for (const id of includedIds) effective.add(id);
            return effective;
          })()
        : null;

      const getEffectiveTemplateIsRequired = (dt: { id: string; isMandatory: boolean }) => {
        if (singleSiteEffectiveRequired !== null) {
          return dt.isMandatory || singleSiteEffectiveRequired.has(dt.id);
        }
        return dt.isMandatory || allCompanyRequiredTemplateIds.has(dt.id);
      };

      // Build the hierarchy: for each folder template, find matching site folders and their documents
      const hierarchy = folderTemplates
        .filter(ft => !ft.parentId) // Only top-level folders
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(folderTemplate => {
          // Find ALL provisioned folders matching this template (can be multiple across sites)
          const matchingSiteFolders = siteFolders.filter(sf => sf.templateId === folderTemplate.id);
          const siteFolder = matchingSiteFolders[0]; // For display purposes, use first one
          
          // Get document templates in this folder template
          const folderDocTemplates = moduleDocTemplates.filter(dt => dt.folderTemplateId === folderTemplate.id);
          // Use getEffectiveTemplateIsRequired so company-required templates (from company_required_templates)
          // are counted as required slots, not just templates with dt.isMandatory=true on the template itself.
          const requiredTemplates = folderDocTemplates.filter(dt => getEffectiveTemplateIsRequired(dt));
          
          // Get documents from ALL matching folders across all sites
          const matchingFolderIds = matchingSiteFolders.map(sf => sf.id);
          const folderDocuments = matchingFolderIds.length > 0
            ? siteDocuments.filter(d => matchingFolderIds.includes(d.folderId))
            : [];
          
          // Calculate compliance stats — only required documents count toward compliance
          const requiredFolderDocuments = folderDocuments.filter(d => {
            const docTmpl = moduleDocTemplates.find(dt => dt.id === d.templateId);
            return getEffectiveIsRequired(d, docTmpl);
          });
          const nonArchivedRequired = requiredFolderDocuments.filter(d => !d.isArchived);
          const compliantCount = nonArchivedRequired.filter(d => d.status === "compliant").length;
          const reviewRequiredCount = nonArchivedRequired.filter(d => d.status === "approval_required").length;
          const overdueCount = nonArchivedRequired.filter(d => d.status === "overdue").length;
          const pendingApprovalCount = folderDocuments.filter(d => !d.isArchived && (d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off")).length;
          
          // Shared (company/group-scoped) docs that target this folder template
          const sharedForThisFolder = sharedDocsByFolderTemplateId.get(folderTemplate.id) ?? [];

          // Check if required templates have been fulfilled (site-scoped OR shared scoped)
          const fulfilledRequiredCount = requiredTemplates.filter(rt =>
            folderDocuments.some(d => d.templateId === rt.id) ||
            sharedForThisFolder.some(d => d.templateId === rt.id)
          ).length;
          
          // Determine folder compliance status
          let folderStatus: "compliant" | "incomplete" | "attention_needed" = "compliant";
          if (requiredTemplates.length > 0 && fulfilledRequiredCount < requiredTemplates.length) {
            folderStatus = "incomplete";
          } else if (overdueCount > 0 || reviewRequiredCount > 0) {
            folderStatus = "attention_needed";
          }
          
          // Get child folders (sub-folders) if any - both from templates and dynamically created folders
          const childFolderTemplates = folderTemplates.filter(ft => ft.parentId === folderTemplate.id);
          const childFoldersFromTemplates = childFolderTemplates.map(childTemplate => {
            const matchingChildFolders = siteFolders.filter(sf => sf.templateId === childTemplate.id);
            const childSiteFolder = matchingChildFolders[0]; // For display purposes
            const childFolderIds = matchingChildFolders.map(sf => sf.id);
            const childFolderDocs = childFolderIds.length > 0
              ? siteDocuments.filter(d => childFolderIds.includes(d.folderId))
              : [];
            
            const childDocTemplates = moduleDocTemplates.filter(dt => dt.folderTemplateId === childTemplate.id);
            const childRequiredTemplates = childDocTemplates.filter(dt => getEffectiveTemplateIsRequired(dt));
            const sharedForChildFolder = sharedDocsByFolderTemplateId.get(childTemplate.id) ?? [];
            const childFulfilledCount = childRequiredTemplates.filter(rt =>
              childFolderDocs.some(d => d.templateId === rt.id) ||
              sharedForChildFolder.some(d => d.templateId === rt.id)
            ).length;
            
            return {
              id: childTemplate.id,
              name: childTemplate.name,
              description: childTemplate.description,
              isMandatory: childTemplate.isMandatory,
              isDynamic: false,
              siteFolder: childSiteFolder ? {
                id: childSiteFolder.id,
                name: childSiteFolder.name,
              } : null,
              documents: childFolderDocs.map(d => {
                const docTemplate = moduleDocTemplates.find(dt => dt.id === d.templateId);
                return {
                  id: d.id,
                  title: d.title,
                  fileName: d.fileName,
                  version: d.version ?? 1,
                  fileSize: d.fileSize ?? null,
                  siteId: d.siteId ?? null,
                  status: d.status,
                  approvalStatus: d.approvalStatus,
                  source: d.source,
                  templateId: d.templateId,
                  expiryDate: d.expiryDate,
                  updatedAt: d.updatedAt,
                  isArchived: d.isArchived,
                  isMandatory: getEffectiveIsRequired(d, docTemplate),
                  renewalPeriodMonths: d.renewalPeriodMonths ?? docTemplate?.renewalPeriodMonths ?? null,
                };
              }),
              stats: {
                totalDocuments: childFolderDocs.length + sharedForChildFolder.length,
                compliant: childFolderDocs.filter(d => !d.isArchived && d.status === "compliant" && getEffectiveIsRequired(d, moduleDocTemplates.find(dt => dt.id === d.templateId))).length,
                approvalRequired: childFolderDocs.filter(d => !d.isArchived && d.status === "approval_required" && getEffectiveIsRequired(d, moduleDocTemplates.find(dt => dt.id === d.templateId))).length,
                overdue: childFolderDocs.filter(d => !d.isArchived && d.status === "overdue" && getEffectiveIsRequired(d, moduleDocTemplates.find(dt => dt.id === d.templateId))).length,
                requiredTemplates: childRequiredTemplates.length,
                fulfilledRequired: childFulfilledCount,
              },
              templateInfo: childDocTemplates.map(dt => {
                const isReq = getEffectiveTemplateIsRequired(dt);
                const missingSites = isAllSites && isReq
                  ? targetSiteIds
                      .filter(sId => {
                        // Only flag as missing for sites whose company actually requires this template
                        const siteCompanyId = siteToCompanyHierarchy.get(sId);
                        const siteCompanyReq = siteCompanyId ? companyReqCacheHierarchy.get(siteCompanyId) : null;
                        const isRequiredForSite = dt.isMandatory || (siteCompanyReq?.has(dt.id) ?? false);
                        if (!isRequiredForSite) return false;
                        const siteOvr = siteOverridesCache.get(sId);
                        if (siteOvr?.excludedIds.has(dt.id)) return false;
                        const siteHasDoc = childFolderDocs.some(d => d.siteId === sId && d.templateId === dt.id);
                        const sharedHas = sharedFulfillmentBySiteAndTemplate.get(sId)?.has(dt.id) ?? false;
                        return !siteHasDoc && !sharedHas;
                      })
                      .map(sId => ({ siteId: sId, siteName: siteNameById.get(sId) ?? "Unknown" }))
                  : [];
                return {
                  id: dt.id,
                  name: dt.name,
                  isMandatory: isReq,
                  renewalPeriodMonths: dt.renewalPeriodMonths,
                  hasFulfilledDocument:
                    childFolderDocs.some(d => d.templateId === dt.id) ||
                    sharedForChildFolder.some(d => d.templateId === dt.id),
                  missingSites,
                };
              }),
            };
          });

          // Also get dynamically created child folders (like case folders)
          // These are folders with parentId pointing to one of the site folders for this template
          // Exclude folders that already have a templateId (they're already covered by childFoldersFromTemplates)
          const templateChildFolderIds = childFolderTemplates.map(cf => cf.id);
          const dynamicChildFolders = siteFolders
            .filter(sf => sf.parentId && matchingFolderIds.includes(sf.parentId) && !sf.templateId)
            .map(dynamicFolder => {
              const dynamicFolderDocs = siteDocuments.filter(d => d.folderId === dynamicFolder.id);
              return {
                id: dynamicFolder.id,
                name: dynamicFolder.name,
                description: dynamicFolder.description || "",
                isMandatory: false,
                isDynamic: true, // Flag to indicate this is a dynamically created folder (like case folder)
                siteFolder: {
                  id: dynamicFolder.id,
                  name: dynamicFolder.name,
                },
                documents: dynamicFolderDocs.map(d => {
                  const docTemplate = moduleDocTemplates.find(dt => dt.id === d.templateId);
                  return {
                    id: d.id,
                    title: d.title,
                    fileName: d.fileName,
                    version: d.version ?? 1,
                    fileSize: d.fileSize ?? null,
                    siteId: d.siteId ?? null,
                    status: d.status,
                    approvalStatus: d.approvalStatus,
                    source: d.source,
                    templateId: d.templateId,
                    expiryDate: d.expiryDate,
                    updatedAt: d.updatedAt,
                    isArchived: d.isArchived,
                    isMandatory: getEffectiveIsRequired(d, docTemplate),
                    renewalPeriodMonths: d.renewalPeriodMonths ?? docTemplate?.renewalPeriodMonths ?? null,
                  };
                }),
                stats: {
                  totalDocuments: dynamicFolderDocs.length,
                  compliant: dynamicFolderDocs.filter(d => d.status === "compliant").length,
                  approvalRequired: dynamicFolderDocs.filter(d => d.status === "approval_required").length,
                  overdue: dynamicFolderDocs.filter(d => d.status === "overdue").length,
                  requiredTemplates: 0,
                  fulfilledRequired: 0,
                },
              };
            });

          const childFolders = [...childFoldersFromTemplates, ...dynamicChildFolders];
          
          // Calculate aggregate stats including child folder documents
          const childDocsTotal = childFolders.reduce((sum, cf) => sum + (cf.stats?.totalDocuments || 0), 0);
          const childCompliant = childFolders.reduce((sum, cf) => sum + (cf.stats?.compliant || 0), 0);
          const childReviewRequired = childFolders.reduce((sum, cf) => sum + (cf.stats?.approvalRequired || 0), 0);
          const childOverdue = childFolders.reduce((sum, cf) => sum + (cf.stats?.overdue || 0), 0);
          
          return {
            id: folderTemplate.id,
            name: folderTemplate.name,
            description: folderTemplate.description,
            isMandatory: folderTemplate.isMandatory,
            sortOrder: folderTemplate.sortOrder,
            siteFolder: siteFolder ? {
              id: siteFolder.id,
              name: siteFolder.name,
            } : null,
            documents: folderDocuments.map(d => {
              const docTemplate = moduleDocTemplates.find(dt => dt.id === d.templateId);
              return {
                id: d.id,
                title: d.title,
                fileName: d.fileName,
                version: d.version ?? 1,
                fileSize: d.fileSize ?? null,
                siteId: d.siteId ?? null,
                status: d.status,
                approvalStatus: d.approvalStatus,
                source: d.source,
                templateId: d.templateId,
                expiryDate: d.expiryDate,
                updatedAt: d.updatedAt,
                isArchived: d.isArchived,
                isMandatory: getEffectiveIsRequired(d, docTemplate),
                renewalPeriodMonths: d.renewalPeriodMonths ?? docTemplate?.renewalPeriodMonths ?? null,
              };
            }),
            childFolders,
            stats: {
              totalDocuments: folderDocuments.length + childDocsTotal + sharedForThisFolder.length,
              compliant: compliantCount + childCompliant,
              approvalRequired: reviewRequiredCount + childReviewRequired,
              overdue: overdueCount + childOverdue,
              pendingApproval: pendingApprovalCount,
              requiredTemplates: requiredTemplates.length,
              fulfilledRequired: fulfilledRequiredCount,
              folderStatus,
            },
            templateInfo: folderDocTemplates.map(dt => {
              const isReq = getEffectiveTemplateIsRequired(dt);
              const missingSites = isAllSites && isReq
                ? targetSiteIds
                    .filter(sId => {
                      // Only flag as missing for sites whose company actually requires this template
                      const siteCompanyId = siteToCompanyHierarchy.get(sId);
                      const siteCompanyReq = siteCompanyId ? companyReqCacheHierarchy.get(siteCompanyId) : null;
                      const isRequiredForSite = dt.isMandatory || (siteCompanyReq?.has(dt.id) ?? false);
                      if (!isRequiredForSite) return false;
                      const siteOvr = siteOverridesCache.get(sId);
                      if (siteOvr?.excludedIds.has(dt.id)) return false;
                      const siteHasDoc = folderDocuments.some(d => d.siteId === sId && d.templateId === dt.id);
                      const sharedHas = sharedFulfillmentBySiteAndTemplate.get(sId)?.has(dt.id) ?? false;
                      return !siteHasDoc && !sharedHas;
                    })
                    .map(sId => ({ siteId: sId, siteName: siteNameById.get(sId) ?? "Unknown" }))
                : [];
              return {
                id: dt.id,
                name: dt.name,
                isMandatory: isReq,
                renewalPeriodMonths: dt.renewalPeriodMonths,
                hasFulfilledDocument:
                  folderDocuments.some(d => d.templateId === dt.id) ||
                  sharedForThisFolder.some(d => d.templateId === dt.id),
                missingSites,
              };
            }),
          };
        });
      
      // Also include unfiled documents (documents not in any known site folder)
      // This catches both documents with no folderId AND documents whose folderId
      // points to a folder that doesn't exist in the current target sites
      // (e.g. a document whose folder was provisioned for a different site).
      const allKnownFolderIds = new Set(siteFolders.map(sf => sf.id));
      const unfiledDocuments = siteDocuments.filter(d => !d.folderId || !allKnownFolderIds.has(d.folderId));

      // Fetch company/group scoped documents visible to target sites. For all-sites
      // view we union shared docs across all target sites and dedupe by doc id so a
      // single shared doc shared with N sites is shown once per folder.
      let sharedDocuments: any[] = [];
      {
        const collected = new Map<string, any>(); // docId -> raw doc
        for (const sId of targetSiteIds) {
          const sharedForSite = computeSharedDocsForSiteH(sId); // in-memory, no DB call
          for (const d of sharedForSite) {
            if (!collected.has(d.id)) collected.set(d.id, d);
          }
        }
        const sharedList = Array.from(collected.values());
        // Resolve folderTemplateId for each shared doc by looking up its source folder
        const sharedFolderIds = Array.from(new Set(sharedList.map(d => d.folderId).filter((v): v is string => !!v)));
        const folderTemplateMap = new Map<string, string | null>();
        if (sharedFolderIds.length > 0) {
          const folderRows = await Promise.all(sharedFolderIds.map(fid => storage.getDocumentFolder(fid)));
          for (const f of folderRows) {
            if (f) folderTemplateMap.set(f.id, f.templateId ?? null);
          }
        }
        sharedDocuments = sharedList.map(d => {
          const docTemplate = moduleDocTemplates.find(dt => dt.id === d.templateId);
          // Effective isMandatory across any target site's company config
          const isRequiredViaCompanyTemplate = d.templateId
            ? targetSiteIds.some(sId => {
                const cId = siteToCompanyHierarchy.get(sId);
                return cId ? (companyReqCacheHierarchy.get(cId)?.has(d.templateId!) ?? false) : false;
              })
            : false;
          const effectiveIsRequired = d.isMandatory || docTemplate?.isMandatory || isRequiredViaCompanyTemplate;
          return {
            id: d.id,
            title: d.title,
            fileName: d.fileName,
            version: d.version ?? 1,
            fileSize: d.fileSize ?? null,
            siteId: d.siteId ?? null,
            entityId: d.entityId,
            scope: d.scope,
            status: d.status,
            approvalStatus: d.approvalStatus,
            source: d.source,
            templateId: d.templateId,
            folderId: d.folderId ?? null,
            folderTemplateId: d.folderId ? (folderTemplateMap.get(d.folderId) ?? null) : null,
            expiryDate: d.expiryDate,
            updatedAt: d.updatedAt,
            isMandatory: effectiveIsRequired,
            renewalPeriodMonths: d.renewalPeriodMonths ?? docTemplate?.renewalPeriodMonths ?? null,
            sharedScope: d.sharedScope,
            sharedFromEntityName: d.sharedFromEntityName,
          };
        });
      }

      // Summary stats: count ALL non-archived docs from BOTH site-scoped and shared (company/group) docs
      const allNonArchivedSiteDocs = siteDocuments.filter(d => !d.isArchived);
      const allNonArchivedSharedDocs = sharedDocuments.filter((d: any) => !d.isArchived);
      const allNonArchivedDocs = [...allNonArchivedSiteDocs, ...allNonArchivedSharedDocs];
      
      res.json({
        siteId,
        module,
        folders: hierarchy,
        unfiledDocuments: unfiledDocuments.map(d => {
          const docTemplate = moduleDocTemplates.find(dt => dt.id === d.templateId);
          return {
            id: d.id,
            title: d.title,
            fileName: d.fileName,
            version: d.version ?? 1,
            fileSize: d.fileSize ?? null,
            siteId: d.siteId ?? null,
            status: d.status,
            approvalStatus: d.approvalStatus,
            source: d.source,
            templateId: d.templateId,
            expiryDate: d.expiryDate,
            updatedAt: d.updatedAt,
            isMandatory: docTemplate ? getEffectiveIsRequired(d, docTemplate) : false,
            renewalPeriodMonths: d.renewalPeriodMonths ?? docTemplate?.renewalPeriodMonths ?? null,
          };
        }),
        sharedDocuments,
        summary: (() => {
          return {
            totalFolders: hierarchy.length,
            totalDocuments: allNonArchivedSiteDocs.length + allNonArchivedSharedDocs.length,
            compliant: allNonArchivedDocs.filter((d: any) => d.status === "compliant").length,
            approved: allNonArchivedDocs.filter((d: any) => d.status === "approved").length,
            approvalRequired: allNonArchivedDocs.filter((d: any) => d.status === "approval_required").length,
            overdue: allNonArchivedDocs.filter((d: any) => d.status === "overdue").length,
          };
        })(),
      });
    } catch (error) {
      console.error("Get documents hierarchy error:", error);
      res.status(500).json({ error: "Failed to fetch documents hierarchy" });
    }
  });

  // All Users Routes
  
  // Get all users (admin only)
  // Consultants eligible to own document sign-off for a given target scope. Used by Admins to
  // pick an "approval on behalf of" consultant. Eligibility mirrors document access exactly:
  // assigned to the site (or pro-by-source) for site scope; pro-by-source / assigned to the
  // entity company for company/group scope. Same rule is enforced again on upload.
  app.get("/api/eligible-sign-off-consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      // Only Admins (who must nominate an on-behalf consultant) and Developers need this.
      if (user.role !== "developer" && user.role !== "administrator") {
        return res.status(403).json({ error: "Access denied" });
      }

      const siteIdsParam = (req.query.siteIds as string | undefined)?.trim();
      const scope = (req.query.scope as string | undefined)?.trim();
      const entityId = (req.query.entityId as string | undefined)?.trim();
      const siteIds = siteIdsParam
        ? siteIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      // Enforce that the CALLER can access the requested target before enumerating any
      // consultants — prevents probing arbitrary sites/companies outside their scope.
      // Developers have unrestricted access.
      if (siteIds.length > 0) {
        for (const sid of siteIds) {
          if (user.role !== "developer" && !(await canUserAccessSite(user, sid))) {
            return res.status(403).json({ error: "You do not have access to one of the selected sites." });
          }
        }
      } else if ((scope === "company" || scope === "group") && entityId) {
        if (user.role !== "developer" && !(await isDocumentOriginUser(user, { scope, entityId, siteId: null }))) {
          return res.status(403).json({ error: "You do not have access to the selected company." });
        }
      } else {
        return res.status(400).json({ error: "A target site or company is required." });
      }

      const allUsers = await storage.getAllUsers();
      const consultants = allUsers.filter((u) => u.role === "consultant" && u.status === "active");

      // Minimal, sanitized DTO — NEVER return full user rows (they contain password hashes).
      const eligible: Array<{ id: string; fullName: string; role: string | null; status: string | null }> = [];
      for (const c of consultants) {
        let ok = false;
        if (siteIds.length > 0) {
          // Admin uploads one document per selected site, so the consultant must be
          // eligible for EVERY selected site.
          ok = true;
          for (const sid of siteIds) {
            if (!(await canUserAccessSite(c, sid))) {
              ok = false;
              break;
            }
          }
        } else if ((scope === "company" || scope === "group") && entityId) {
          ok = await isDocumentOriginUser(c, { scope, entityId, siteId: null });
        }
        if (ok) eligible.push({ id: c.id, fullName: c.fullName, role: c.role, status: c.status });
      }

      res.json(eligible);
    } catch (error) {
      console.error("Error fetching eligible sign-off consultants:", error);
      res.status(500).json({ error: "Failed to fetch eligible consultants" });
    }
  });

  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin and consultant can access user management
      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const allUsers = await storage.getAllUsers();
      const allSites = await storage.getSites();
      const allCompanies = await storage.getCompanies();

      const mySources = user.sources ?? [];

      // Standard (non-pro) consultants: only see clients for companies they are assigned to
      // that also share at least one source. They never see other consultants or admins.
      // GO expansion: also includes clients from member companies of any GO they're assigned to.
      // Coverage expansion: also includes clients from sites/companies of consultants being covered.
      const isStandardConsultant = user.role === "consultant" && !isProConsultant(user);
      let allowedClientIds: Set<string> | null = null;
      if (isStandardConsultant) {
        const myAssignments = await storage.getConsultantSites(user.id);
        const mySiteIds = new Set(myAssignments.map(a => a.siteId));
        // Coverage expansion: also include sites of consultants being covered right now
        const coveringForEntries = await storage.getActiveCoverageForCovering(user.id);
        const coverageSiteIds: string[] = [];
        for (const c of coveringForEntries) {
          const absentAssignments = await storage.getConsultantSites(c.absentConsultantId);
          for (const a of absentAssignments) coverageSiteIds.push(a.siteId);
        }
        const allEffectiveSiteIds = new Set([...mySiteIds, ...coverageSiteIds]);
        // Only keep sites (direct assignments) whose parent company shares at least one source
        const mySourceCompanyIds = new Set(
          allSites
            .filter(s => mySiteIds.has(s.id) && sourcesOverlap(mySources, allCompanies.find(c => c.id === s.companyId)?.sources ?? []))
            .map(s => s.companyId)
        );
        // Also track coverage company IDs (no source check needed)
        const coverageCompanyIds = new Set(
          allSites.filter(s => coverageSiteIds.includes(s.id)).map(s => s.companyId)
        );
        allowedClientIds = new Set<string>();
        // Include clients explicitly assigned to one of the consultant's effective sites
        for (const siteId of allEffectiveSiteIds) {
          const site = allSites.find(s => s.id === siteId);
          if (!site) continue;
          // For direct assignments: require source overlap; for coverage sites: no source check
          if (mySiteIds.has(siteId)) {
            const company = allCompanies.find(c => c.id === site.companyId);
            if (!sourcesOverlap(mySources, company?.sources ?? [])) continue;
          }
          const siteClients = await storage.getClientSiteAssignments(siteId);
          siteClients.forEach(a => allowedClientIds!.add(a.clientId));
        }
        // Also include clients who belong to an allowed company but have no site yet
        allUsers
          .filter(u => u.role === "client" && u.companyId && (mySourceCompanyIds.has(u.companyId) || coverageCompanyIds.has(u.companyId)))
          .forEach(u => allowedClientIds!.add(u.id));
        // GO expansion: for each source-overlapping company that is a GO, also see clients in member companies
        const allAllowedCompanyIds = new Set([...mySourceCompanyIds, ...coverageCompanyIds]);
        for (const cId of allAllowedCompanyIds) {
          const members = await storage.getGroupMembers(cId);
          for (const m of members) {
            allUsers
              .filter(u => u.role === "client" && u.companyId === m.id)
              .forEach(u => allowedClientIds!.add(u.id));
          }
        }
      }

      // Apply filters:
      // - Standard consultant: only their assigned clients from source-overlapping companies (no admins, no other consultants)
      // - Pro consultant / Admin (hasProPrivileges): staff (consultants + admins) + clients that
      //                       share at least one source (never developers)
      //                       + GO expansion: clients from member companies of any GO they can see
      // - Developer:          everyone
      let visibleUsers: typeof allUsers;
      if (isStandardConsultant) {
        visibleUsers = allUsers.filter(u => u.role === "client" && allowedClientIds!.has(u.id));
      } else if (hasProPrivileges(user)) {
        // Administrators with no sources configured: see all non-developer users (same as developer)
        if (user.role === "administrator" && mySources.length === 0) {
          visibleUsers = allUsers.filter(u => u.role !== "developer");
        } else {
          visibleUsers = allUsers.filter(u => {
            if (u.role === "developer") return false;
            if (u.role === "consultant" || u.role === "administrator") {
              // See other staff (consultants / admins) that share at least one source
              return sourcesOverlap(mySources, u.sources ?? []);
            }
            if (u.role === "client") {
              // See clients whose company shares at least one source
              if (!u.companyId) return false;
              const clientCompany = allCompanies.find(c => c.id === u.companyId);
              if (sourcesOverlap(mySources, clientCompany?.sources ?? [])) return true;
              // GO expansion: if client's company is a GO member of a company the consultant can see
              if (clientCompany?.groupOwnerId) {
                const goCompany = allCompanies.find(c => c.id === clientCompany.groupOwnerId);
                return sourcesOverlap(mySources, goCompany?.sources ?? []);
              }
              return false;
            }
            return false;
          });
        }
      } else {
        visibleUsers = allUsers;
      }

      // Fetch all key contacts once for enrichment
      const allKeyContacts = await storage.getAllKeyContacts();
      // Build a map: userId -> KeyContact[]
      const keyContactsByUser = new Map<string, typeof allKeyContacts>();
      for (const kc of allKeyContacts) {
        if (!keyContactsByUser.has(kc.userId)) keyContactsByUser.set(kc.userId, []);
        keyContactsByUser.get(kc.userId)!.push(kc);
      }

      // Enrich users with site assignments
      const usersWithAssignments = await Promise.all(visibleUsers.map(async (u) => {
        const { password, ...safeUser } = u;

        // Determine key contact designations for this user
        const userKCs = keyContactsByUser.get(u.id) ?? [];
        const keyContactCompanies = userKCs
          .filter(kc => kc.entityType === "company")
          .map(kc => allCompanies.find(c => c.id === kc.entityId)?.name || kc.entityId);
        const keyContactSites = userKCs
          .filter(kc => kc.entityType === "site")
          .map(kc => allSites.find(s => s.id === kc.entityId)?.name || kc.entityId);

        if (u.role === "consultant") {
          const assignments: { siteId: string; siteName: string; companyName: string; isPrimary: boolean }[] = [];
          for (const site of allSites) {
            const siteAssignments = await storage.getConsultantAssignments(site.id);
            const userAssignment = siteAssignments.find(a => a.consultantId === u.id);
            if (userAssignment) {
              const company = allCompanies.find(c => c.id === site.companyId);
              assignments.push({ siteId: site.id, siteName: site.name, companyName: company?.name || "Unknown", isPrimary: !!userAssignment.isPrimary });
            }
          }
          return { ...safeUser, siteAssignments: assignments, keyContactCompanies, keyContactSites };
        } else if (u.role === "client") {
          const clientAssignments = await storage.getClientSites(u.id);
          const assignments = clientAssignments.map(a => {
            const site = allSites.find(s => s.id === a.siteId);
            const company = site ? allCompanies.find(c => c.id === site.companyId) : null;
            return { siteId: a.siteId, siteName: site?.name || "Unknown", companyName: company?.name || "Unknown", isPrimary: false };
          });
          const isGroupOwnerCompany = u.companyId != null && allCompanies.some(c => c.groupOwnerId === u.companyId);
          return { ...safeUser, siteAssignments: assignments, keyContactCompanies, keyContactSites, isGroupOwnerCompany };
        }
        
        return { ...safeUser, keyContactCompanies, keyContactSites };
      }));
      
      res.json(usersWithAssignments);
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Check if email is already in use
  app.get("/api/users/check-email", requireAuth, async (req, res) => {
    try {
      const { email } = req.query;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (user) {
        return res.status(400).json({ error: "This email address is already in use" });
      }

      res.json({ available: true });
    } catch (error) {
      console.error("Check email error:", error);
      res.status(500).json({ error: "Failed to check email" });
    }
  });

  // Create user (admin only) - creates with invited status and generates invite token
  app.post("/api/users", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const isStandardConsultant = currentUser.role === "consultant" && !isProConsultant(currentUser);

      if (currentUser.role !== "developer" && !hasProPrivileges(currentUser) && !isStandardConsultant) {
        return res.status(403).json({ error: "Only developers and consultants can create users" });
      }
      
      const { 
        username, email, fullName, role, companyId, 
        consultantTier, clientPermissionRole,
        title, firstName, lastName, jobTitle, department, phone, mobile,
        preferredContactMethod, notes, sources, consultantPermissions
      } = req.body;
      
      // Consultants (pro, standard) and Admins can only create client users
      if ((hasProPrivileges(currentUser) || isStandardConsultant) && currentUser.role !== "developer" && role && role !== "client") {
        return res.status(403).json({ error: "Consultants and admins can only create client users" });
      }

      // Standard consultants can only create users for companies they are assigned to
      if (isStandardConsultant && companyId) {
        const consultantSiteAssignments = await storage.getConsultantSites(currentUser.id);
        const assignedSiteIds = new Set(consultantSiteAssignments.map(a => a.entityId));
        const allSites = await storage.getSites();
        const assignedCompanyIds = new Set(
          allSites.filter(s => assignedSiteIds.has(s.id)).map(s => s.companyId)
        );
        if (!assignedCompanyIds.has(companyId)) {
          return res.status(403).json({ error: "You can only create users for companies you are assigned to" });
        }
      }
      
      if (!username || !email) {
        return res.status(400).json({ error: "Username and email are required" });
      }
      
      // Clients must be assigned to a company
      if ((role === "client" || !role) && !companyId) {
        return res.status(400).json({ error: "Company is required for client users" });
      }

      // Guard: only admins may assign sources for consultant/admin users.
      // Pro consultants cannot set sources even if they somehow submit a sources payload.
      const userRoleForValidation = role || "client";
      const sourcesForCreate: string[] | null | undefined =
        (currentUser.role !== "developer" && (userRoleForValidation === "consultant" || userRoleForValidation === "developer" || userRoleForValidation === "administrator"))
          ? undefined  // strip — admin must assign sources separately
          : sources;

      // Consultants, admins (staff) and developers must have at least one source (developer-created only)
      if (currentUser.role === "developer" && (userRoleForValidation === "consultant" || userRoleForValidation === "developer" || userRoleForValidation === "administrator") && (!Array.isArray(sourcesForCreate) || sourcesForCreate.length === 0)) {
        return res.status(400).json({ error: "At least one source is required for consultant and developer users" });
      }
      
      // Check if username or email already exists
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      // Auto-generate fullName if not provided
      const computedFullName = fullName || 
        `${firstName || ""} ${lastName || ""}`.trim() || 
        username;
      
      // Create user with status 'invited' and a placeholder password
      // The real password will be set when the user accepts the invitation
      const placeholderPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_SALT_ROUNDS);
      
      const userRole = role || "client";
      const newUser = await storage.createUser({
        username,
        email,
        fullName: computedFullName,
        password: placeholderPassword,
        role: userRole,
        companyId: companyId || null,
        status: userRole === "client" ? "site_required" : "invited",
        consultantTier: consultantTier || null,
        consultantPermissions: ((userRole === "consultant" || userRole === "administrator") && consultantPermissions && typeof consultantPermissions === "object") ? consultantPermissions : null,
        clientPermissionRole: "full",
        title: title || null,
        firstName: firstName || null,
        lastName: lastName || null,
        jobTitle: jobTitle || null,
        department: department || null,
        phone: phone || null,
        mobile: mobile || null,
        preferredContactMethod: preferredContactMethod || "email",
        notes: notes || null,
        sources: Array.isArray(sourcesForCreate) ? sourcesForCreate : null,
      });
      
      const { password: _, ...safeUser } = newUser;

      // Emit user-updated so admins/consultants see new users in real time
      try {
        emitToRole("developer", "user-updated", { userId: newUser.id });
        emitToRole("consultant", "user-updated", { userId: newUser.id });
      } catch { /* non-fatal */ }

      // For client users, don't generate invite yet - they need site assignment or primary contact status first
      if (userRole === "client") {
        res.status(201).json({ 
          ...safeUser, 
          requiresSiteAssignment: true,
        });
      } else {
        // For admin/consultant users, generate invitation token.
        // sendEmailNow defaults to true; pass false to defer the welcome email.
        const sendEmailNow = req.body.sendEmailNow !== false;

        const token = generateSecureToken();
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
        
        await storage.createUserInvitation({
          userId: newUser.id,
          email: newUser.email,
          tokenHash,
          purpose: "invite",
          expiresAt,
          createdBy: currentUser.id,
        });

        // If email is deferred, downgrade status so bulk-send can pick it up later
        if (!sendEmailNow) {
          await storage.updateUser(newUser.id, { status: "invite_required" });
        }
        
        const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
        const inviteUrl = `${baseUrl}/set-password?token=${token}`;
        
        let emailSent = false;
        if (sendEmailNow) {
          try {
            await sendInvitationEmail({
              to: newUser.email,
              fullName: newUser.fullName,
              inviteUrl,
              expiresAt,
              role: newUser.role,
            });
            emailSent = true;
            await storage.createAuditLog({
              action: "email_sent",
              userId: currentUser.id,
              userName: currentUser.fullName,
              entityId: newUser.id,
              details: `Invitation email sent to new ${userRole} user ${newUser.fullName} (${newUser.email})`,
              metadata: null,
            });
          } catch (emailError) {
            console.error("Failed to send invitation email for new user:", emailError);
          }
        }
        
        res.status(201).json({ 
          ...safeUser,
          status: sendEmailNow ? "invited" : "invite_required",
          inviteUrl,
          inviteExpiresAt: expiresAt.toISOString(),
          emailSent,
        });
      }
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Entity Users Routes
  
  // Create user for an entity (site) - with invitation flow
  app.post("/api/sites/:siteId/users", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin can create users
      if (currentUser.role !== "developer") {
        return res.status(403).json({ error: "Only developers can create users" });
      }
      
      const { 
        username, email, fullName, clientPermissionRole,
        title, firstName, lastName, jobTitle, department, phone, mobile,
        preferredContactMethod, notes
      } = req.body;
      
      if (!username || !email) {
        return res.status(400).json({ error: "Username and email are required" });
      }
      
      // Check if username or email already exists
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      // Get the site to find its companyId
      const targetSite = await storage.getSite(req.params.siteId);
      if (!targetSite) {
        return res.status(404).json({ error: "Site not found" });
      }
      
      // Auto-generate fullName if not provided
      const computedFullName = fullName || 
        `${firstName || ""} ${lastName || ""}`.trim() || 
        username;
      
      // Create user with status 'invited' and a placeholder password
      const placeholderPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_SALT_ROUNDS);
      
      const newUser = await storage.createUser({
        username,
        email,
        fullName: computedFullName,
        password: placeholderPassword,
        role: "client",
        companyId: targetSite.companyId,
        status: "invited",
        clientPermissionRole: "full",
        title: title || null,
        firstName: firstName || null,
        lastName: lastName || null,
        jobTitle: jobTitle || null,
        department: department || null,
        phone: phone || null,
        mobile: mobile || null,
        preferredContactMethod: preferredContactMethod || "email",
        notes: notes || null,
      });
      
      // Generate invitation token
      const token = generateSecureToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
      
      await storage.createUserInvitation({
        userId: newUser.id,
        email: newUser.email,
        tokenHash,
        purpose: "invite",
        expiresAt,
        createdBy: currentUser.id,
      });
      
      // Build the invite URL
      const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const inviteUrl = `${baseUrl}/set-password?token=${token}`;
      
      emitUserUpdated(newUser.id);
      await emitSiteScoped("site-updated", req.params.siteId, targetSite.companyId, { siteId: req.params.siteId });

      const { password: _, ...safeUser } = newUser;
      res.status(201).json({ 
        ...safeUser, 
        inviteUrl,
        inviteExpiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      console.error("Create entity user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Get users for an entity
  app.get("/api/sites/:siteId/users", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Clients can only see users from their own company's sites
      const canAccess = await canUserAccessSite(user, req.params.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const users = await storage.getUsersBySite(req.params.siteId);
      // Remove passwords from response
      const safeUsers = users.map(({ password, ...u }) => u);
      res.json(safeUsers);
    } catch (error) {
      console.error("Get entity users error:", error);
      res.status(500).json({ error: "Failed to fetch entity users" });
    }
  });

  // Get all client users belonging to a company (used for scoped/group documents)
  app.get("/api/companies/:companyId/users", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
        return res.status(403).json({ error: "Access denied" });
      }
      const users = await storage.getUsersByCompany(req.params.companyId);
      const safeUsers = users.map(({ password, ...u }) => u);
      res.json(safeUsers);
    } catch (error) {
      console.error("Get company users error:", error);
      res.status(500).json({ error: "Failed to fetch company users" });
    }
  });

  // Consultant Assignment Routes
  
  // Get all consultants with entity assignments
  app.get("/api/consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin can see all consultants
      if (user.role !== "developer") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const consultants = await storage.getConsultants();
      const entities = await storage.getSitesWithDetails();
      
      // Enhance each consultant with their entity assignments
      const enhancedConsultants = await Promise.all(
        consultants.map(async (consultant) => {
          const { password, ...safeConsultant } = consultant;
          const assignments = await storage.getConsultantSites(consultant.id);
          const entityAssignments = assignments.map((a) => {
            const entity = entities.find((e) => e.id === a.siteId);
            return {
              siteId: a.siteId,
              entityName: entity?.name || "Unknown",
              isPrimary: a.isPrimary,
            };
          });
          return {
            ...safeConsultant,
            entityAssignments,
          };
        })
      );
      
      res.json(enhancedConsultants);
    } catch (error) {
      console.error("Get consultants error:", error);
      res.status(500).json({ error: "Failed to fetch consultants" });
    }
  });

  // Get consultants managed by the current pro consultant
  app.get("/api/consultants/my-staff", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isProConsultant(user) && user.role !== "developer") {
        return res.status(403).json({ error: "Access denied" });
      }
      const staff = await storage.getConsultantsByManager(user.id);
      const safeStaff = staff.map(({ password, ...s }) => s);
      res.json(safeStaff);
    } catch (error) {
      console.error("Get my-staff error:", error);
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  // Create a new consultant
  app.post("/api/consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin can create consultants
      if (user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can create consultants" });
      }
      
      const { username, email, fullName, password, consultantTier } = req.body;
      
      if (!username || !email || !fullName || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const newConsultant = await storage.createUser({
        username,
        email,
        fullName,
        password, // In production, this should be hashed
        role: "consultant",
        consultantTier: consultantTier || "standard",
        status: "active",
      });
      
      const { password: _, ...safeConsultant } = newConsultant;
      res.status(201).json({
        ...safeConsultant,
        entityAssignments: [],
      });
    } catch (error) {
      console.error("Create consultant error:", error);
      res.status(500).json({ error: "Failed to create consultant" });
    }
  });

  // Get consultant assignments for an entity
  app.get("/api/sites/:siteId/consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Clients can only access their own company's sites' consultants
      const canAccess = await canUserAccessSite(user, req.params.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const assignments = await storage.getConsultantAssignments(req.params.siteId);
      
      // Enhance with consultant details
      const enhancedAssignments = await Promise.all(
        assignments.map(async (a) => {
          const consultant = await storage.getUser(a.consultantId);
          return {
            ...a,
            consultantName: consultant?.fullName || "Unknown",
            consultantEmail: consultant?.email || "",
            consultantTier: consultant?.consultantTier || null,
          };
        })
      );
      
      res.json(enhancedAssignments);
    } catch (error) {
      console.error("Get entity consultants error:", error);
      res.status(500).json({ error: "Failed to fetch entity consultants" });
    }
  });

  // Assign consultant to entity
  app.post("/api/sites/:siteId/consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin or pro consultant can assign consultants
      if (user.role !== "developer" && !hasProPrivileges(user)) {
        return res.status(403).json({ error: "Only developers and pro consultants can assign consultants" });
      }
      
      const { consultantId, isPrimary } = req.body;
      if (!consultantId) {
        return res.status(400).json({ error: "Consultant ID is required" });
      }
      
      // Verify consultant exists
      const consultant = await storage.getUser(consultantId);
      if (!consultant || consultant.role !== "consultant") {
        return res.status(400).json({ error: "Invalid consultant" });
      }
      
      const assignment = await storage.assignConsultant({
        consultantId,
        entityId: req.params.siteId,
        siteId: req.params.siteId,
        isPrimary: isPrimary || false,
      });

      // Emit site-updated so affected clients' home pages refresh in real time
      try {
        const site = await storage.getSite(req.params.siteId);
        emitToRole("developer", "site-updated", { siteId: req.params.siteId, companyId: site?.companyId });
        emitToRole("consultant", "site-updated", { siteId: req.params.siteId, companyId: site?.companyId });
        if (site?.companyId) emitToCompany(site.companyId, "site-updated", { siteId: req.params.siteId, companyId: site.companyId });
      } catch { /* non-fatal */ }

      res.status(201).json({
        ...assignment,
        consultantName: consultant.fullName,
        consultantEmail: consultant.email,
        consultantTier: consultant.consultantTier,
      });
    } catch (error) {
      console.error("Assign consultant error:", error);
      res.status(500).json({ error: "Failed to assign consultant" });
    }
  });

  // Remove consultant assignment
  app.delete("/api/sites/:siteId/consultants/:consultantId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin or pro consultant can remove consultant assignments
      if (user.role !== "developer" && !hasProPrivileges(user)) {
        return res.status(403).json({ error: "Only developers and pro consultants can remove consultant assignments" });
      }
      
      const removed = await storage.removeConsultantAssignment(
        req.params.consultantId,
        req.params.siteId
      );
      
      if (!removed) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      // Emit site-updated so affected clients' home pages refresh in real time
      try {
        const site = await storage.getSite(req.params.siteId);
        emitToRole("developer", "site-updated", { siteId: req.params.siteId, companyId: site?.companyId });
        emitToRole("consultant", "site-updated", { siteId: req.params.siteId, companyId: site?.companyId });
        if (site?.companyId) emitToCompany(site.companyId, "site-updated", { siteId: req.params.siteId, companyId: site.companyId });
      } catch { /* non-fatal */ }

      res.json({ success: true });
    } catch (error) {
      console.error("Remove consultant assignment error:", error);
      res.status(500).json({ error: "Failed to remove consultant assignment" });
    }
  });

  // Update consultant assignment (set primary)
  app.patch("/api/sites/:siteId/consultants/:consultantId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin or pro consultant can update consultant assignments
      if (user.role !== "developer" && !hasProPrivileges(user)) {
        return res.status(403).json({ error: "Only developers and pro consultants can update consultant assignments" });
      }
      
      const { isPrimary, canManageModules } = req.body;
      
      const updated = await storage.updateConsultantAssignment(
        req.params.consultantId,
        req.params.siteId,
        { isPrimary, canManageModules }
      );
      
      if (!updated) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      // Emit site-updated so affected clients' home pages refresh in real time
      try {
        const site = await storage.getSite(req.params.siteId);
        emitToRole("developer", "site-updated", { siteId: req.params.siteId, companyId: site?.companyId });
        emitToRole("consultant", "site-updated", { siteId: req.params.siteId, companyId: site?.companyId });
        if (site?.companyId) emitToCompany(site.companyId, "site-updated", { siteId: req.params.siteId, companyId: site.companyId });
      } catch { /* non-fatal */ }

      // Get consultant details for response
      const consultant = await storage.getUser(req.params.consultantId);
      res.json({
        ...updated,
        consultantName: consultant?.fullName || "Unknown",
        consultantEmail: consultant?.email || "",
        consultantTier: consultant?.consultantTier || null,
      });
    } catch (error) {
      console.error("Update consultant assignment error:", error);
      res.status(500).json({ error: "Failed to update consultant assignment" });
    }
  });

  // Get client site assignments for a site
  app.get("/api/sites/:siteId/client-assignments", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin and consultants can view client assignments
      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const canAccess = await canUserAccessSite(user, req.params.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const assignments = await storage.getClientSiteAssignments(req.params.siteId);
      
      // Enhance with client details, filtering out orphaned assignments
      const enhancedAssignments = (
        await Promise.all(
          assignments.map(async (a) => {
            const client = await storage.getUser(a.clientId);
            if (!client) return null;
            const displayName =
              client.fullName ||
              [client.firstName, client.lastName].filter(Boolean).join(" ") ||
              client.username ||
              client.email ||
              "Unknown";
            return {
              ...a,
              clientName: displayName,
              clientEmail: client.email || "",
            };
          })
        )
      ).filter(Boolean);
      
      res.json(enhancedAssignments);
    } catch (error) {
      console.error("Get site client assignments error:", error);
      res.status(500).json({ error: "Failed to fetch client assignments" });
    }
  });

  // Assign client to site
  app.post("/api/sites/:siteId/client-assignments", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin and consultants can assign clients to sites
      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
        return res.status(403).json({ error: "Only developers and consultants can assign clients to sites" });
      }
      
      const { clientId } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: "Client ID is required" });
      }
      
      // Verify client exists and is a client
      const client = await storage.getUser(clientId);
      if (!client || client.role !== "client") {
        return res.status(400).json({ error: "Invalid client" });
      }
      
      // Verify site exists
      const site = await storage.getSite(req.params.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      
      // Verify client belongs to the same company as the site
      if (client.companyId !== site.companyId) {
        return res.status(400).json({ error: "Client must belong to the same company as the site" });
      }
      
      const assignment = await storage.assignClientToSite({
        clientId,
        siteId: req.params.siteId,
        assignedBy: user.id,
      });
      
      // Auto-transition client from site_required to invite_required
      if (client.status === "site_required") {
        await storage.updateUser(clientId, { status: "invite_required" });
      }

      // Real-time: the assigned client sees the new site immediately, and
      // admins/consultants/company see the updated assignment list.
      emitToUser(clientId, "site-updated", { siteId: req.params.siteId });
      emitUserUpdated(clientId);
      await emitSiteScoped("site-updated", req.params.siteId, site.companyId, { siteId: req.params.siteId });

      res.status(201).json({
        ...assignment,
        clientName: client.fullName,
        clientEmail: client.email,
      });
    } catch (error) {
      console.error("Assign client to site error:", error);
      res.status(500).json({ error: "Failed to assign client to site" });
    }
  });

  // Remove client site assignment
  app.delete("/api/sites/:siteId/client-assignments/:clientId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin and consultants can remove client site assignments
      if (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator") {
        return res.status(403).json({ error: "Only developers and consultants can remove client site assignments" });
      }
      
      const clientUser = await storage.getUser(req.params.clientId);
      if (clientUser && clientUser.role === "client") {
        // Block removal if this user is the primary contact — they must always have full site access
        if (clientUser.companyId) {
          const company = await storage.getCompany(clientUser.companyId);
          if (company && company.contactUserId === clientUser.id) {
            return res.status(400).json({ error: "Cannot remove a primary contact from site access. Change the primary contact first." });
          }
        }
        const allAssignments = await storage.getClientSites(req.params.clientId);
        if (allAssignments.length <= 1) {
          return res.status(400).json({ error: "Cannot remove the last site assignment from a client user. Assign another site first." });
        }
      }

      const removed = await storage.removeClientSiteAssignment(
        req.params.clientId,
        req.params.siteId
      );
      
      if (!removed) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      // Real-time: the unassigned client refreshes their accessible sites.
      emitToUser(req.params.clientId, "site-updated", { siteId: req.params.siteId });
      emitUserUpdated(req.params.clientId);
      await emitSiteScoped("site-updated", req.params.siteId, null, { siteId: req.params.siteId });

      res.json({ success: true });
    } catch (error) {
      console.error("Remove client site assignment error:", error);
      res.status(500).json({ error: "Failed to remove client site assignment" });
    }
  });

  // Get sites assigned to a specific client
  app.get("/api/users/:clientId/site-assignments", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin/consultant can view other users' assignments, clients can view their own
      const targetClient = await storage.getUser(req.params.clientId);
      if (!targetClient) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      if (user.role === "client" && user.id !== req.params.clientId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const assignments = await storage.getClientSites(req.params.clientId);
      
      // Enhance with site details
      const enhancedAssignments = await Promise.all(
        assignments.map(async (a) => {
          const site = await storage.getSite(a.siteId);
          return {
            ...a,
            siteName: site?.name || "Unknown",
          };
        })
      );

      // For Group Owner clients, also include sites from member companies that
      // they aren't explicitly assigned to (GO primary contacts have group-wide visibility)
      const assignedSiteIds = new Set(enhancedAssignments.map((a) => a.siteId));
      const effectiveIds = targetClient.companyId
        ? await getEffectiveCompanyIds(targetClient.companyId)
        : new Set<string>();
      const memberCompanyIds = [...effectiveIds].filter((id) => id !== targetClient.companyId);
      if (memberCompanyIds.length > 0) {
        const allSites = await storage.getSites();
        const memberSites = allSites
          .filter((s) => memberCompanyIds.includes(s.companyId) && !assignedSiteIds.has(s.id))
          .map((s) => ({ siteId: s.id, siteName: s.name }));
        enhancedAssignments.push(...memberSites as any[]);
      }
      
      res.json(enhancedAssignments);
    } catch (error) {
      console.error("Get client site assignments error:", error);
      res.status(500).json({ error: "Failed to fetch client site assignments" });
    }
  });

  // Get all site assignments for any user (consultants or clients)
  app.get("/api/users/:userId/all-site-assignments", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Admin or consultant can view user site assignments
      if (currentUser.role !== "developer" && currentUser.role !== "consultant" && currentUser.role !== "administrator") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const allSites = await storage.getSites();
      const companies = await storage.getCompanies();
      
      if (targetUser.role === "consultant") {
        // Get all consultant assignments
        const assignments: { siteId: string; siteName: string; companyId: string; companyName: string; isPrimary: boolean }[] = [];
        
        for (const site of allSites) {
          const siteAssignments = await storage.getConsultantAssignments(site.id);
          const userAssignment = siteAssignments.find(a => a.consultantId === targetUser.id);
          if (userAssignment) {
            const company = companies.find(c => c.id === site.companyId);
            assignments.push({
              siteId: site.id,
              siteName: site.name,
              companyId: site.companyId,
              companyName: company?.name || "Unknown",
              isPrimary: userAssignment.isPrimary || false,
            });
          }
        }
        
        res.json(assignments);
      } else if (targetUser.role === "client") {
        // Get all client site assignments
        const clientSites = await storage.getClientSites(targetUser.id);
        
        const assignments = clientSites.map(a => {
          const site = allSites.find(s => s.id === a.siteId);
          const company = companies.find(c => c.id === site?.companyId);
          return {
            siteId: a.siteId,
            siteName: site?.name || "Unknown",
            companyId: site?.companyId || "",
            companyName: company?.name || "Unknown",
            isPrimary: a.isPrimary || false,
          };
        });
        
        res.json(assignments);
      } else {
        // Admins don't have site assignments (they have full access)
        res.json([]);
      }
    } catch (error) {
      console.error("Get user site assignments error:", error);
      res.status(500).json({ error: "Failed to fetch user site assignments" });
    }
  });

  // Add site assignment to user (admin only)
  app.post("/api/users/:userId/site-assignments/:siteId", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const isStdCon = currentUser.role === "consultant" && !isProConsultant(currentUser);
      if (currentUser.role !== "developer" && !hasProPrivileges(currentUser) && !isStdCon) {
        return res.status(403).json({ error: "Only developers and consultants can manage site assignments" });
      }

      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const site = await storage.getSite(req.params.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }

      // Standard consultants: only manage client users at their assigned companies
      if (isStdCon) {
        if (targetUser.role !== "client") {
          return res.status(403).json({ error: "Standard consultants can only manage client site assignments" });
        }
        const myAssignments = await storage.getConsultantSites(currentUser.id);
        const mySiteIds = new Set(myAssignments.map(a => a.entityId));
        const allSites = await storage.getSites();
        const myCompanyIds = new Set(allSites.filter(s => mySiteIds.has(s.id)).map(s => s.companyId));
        if (!myCompanyIds.has(site.companyId)) {
          return res.status(403).json({ error: "You can only assign users to sites within your assigned companies" });
        }
      }

      const { isPrimary } = req.body;

      if (targetUser.role === "consultant") {
        // Assign consultant to site
        const assignment = await storage.assignConsultant({
          consultantId: targetUser.id,
          entityId: site.id,
          siteId: site.id,
          isPrimary: isPrimary || false,
        });
        
        // Create audit log
        await storage.createAuditLog({
          action: "consultant_assigned",
          entityType: "site",
          entityId: site.id,
          userId: currentUser.id,
          userName: currentUser.fullName,
          details: `Assigned consultant ${targetUser.fullName} to site ${site.name}`,
          metadata: { consultantId: targetUser.id, siteId: site.id },
        });

        emitToUser(targetUser.id, "site-updated", { siteId: site.id });
        emitUserUpdated(targetUser.id);
        await emitSiteScoped("site-updated", site.id, site.companyId, { siteId: site.id });

        res.json(assignment);
      } else if (targetUser.role === "client") {
        // Validate client belongs to the site's company
        if (targetUser.companyId !== site.companyId) {
          return res.status(400).json({ 
            error: "Client can only be assigned to sites within their company" 
          });
        }
        
        // Assign client to site
        const assignment = await storage.assignClientToSite({
          clientId: targetUser.id,
          siteId: site.id,
        });
        
        // Auto-transition client from site_required to invite_required
        if (targetUser.status === "site_required") {
          await storage.updateUser(targetUser.id, { status: "invite_required" });
        }
        
        // Create audit log
        await storage.createAuditLog({
          action: "client_site_assigned",
          entityType: "site",
          entityId: site.id,
          userId: currentUser.id,
          userName: currentUser.fullName,
          details: `Assigned client ${targetUser.fullName} to site ${site.name}`,
          metadata: { clientId: targetUser.id, siteId: site.id },
        });

        emitToUser(targetUser.id, "site-updated", { siteId: site.id });
        emitUserUpdated(targetUser.id);
        await emitSiteScoped("site-updated", site.id, site.companyId, { siteId: site.id });

        res.json(assignment);
      } else {
        res.status(400).json({ error: "Developers do not need site assignments" });
      }
    } catch (error) {
      console.error("Add site assignment error:", error);
      res.status(500).json({ error: "Failed to add site assignment" });
    }
  });

  // Remove site assignment from user (admin, pro consultant, or standard consultant for their assigned companies)
  app.delete("/api/users/:userId/site-assignments", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
      const isStdConsultant = currentUser.role === "consultant" && !isProConsultant(currentUser);
      if (currentUser.role !== "developer" && !hasProPrivileges(currentUser) && !isStdConsultant) {
        return res.status(403).json({ error: "Only developers and consultants can manage site assignments" });
      }
      const targetUser = await storage.getUser(req.params.userId);
      // Standard consultants may only clear assignments for users in companies they are assigned to
      if (isStdConsultant && targetUser?.companyId) {
        const consultantSiteAssignments = await storage.getConsultantSites(currentUser.id);
        const assignedSiteIds = new Set(consultantSiteAssignments.map(a => a.entityId));
        const allSites = await storage.getSites();
        const assignedCompanyIds = new Set(allSites.filter(s => assignedSiteIds.has(s.id)).map(s => s.companyId));
        if (!assignedCompanyIds.has(targetUser.companyId)) {
          return res.status(403).json({ error: "You can only manage users in companies you are assigned to" });
        }
      }
      if (!targetUser) return res.status(404).json({ error: "User not found" });
      if (targetUser.role === "client") {
        await storage.clearClientSiteAssignments(targetUser.id);
        await storage.createAuditLog({
          action: "client_all_sites_removed",
          entityType: "user",
          entityId: targetUser.id,
          userId: currentUser.id,
          userName: currentUser.fullName,
          details: `Removed all site assignments from client ${targetUser.fullName}`,
          metadata: { clientId: targetUser.id },
        });
        emitToUser(targetUser.id, "site-updated", {});
        emitUserUpdated(targetUser.id);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Clear all site assignments error:", error);
      res.status(500).json({ error: "Failed to clear site assignments" });
    }
  });

  app.delete("/api/users/:userId/site-assignments/:siteId", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const isStdCon = currentUser.role === "consultant" && !isProConsultant(currentUser);
      if (currentUser.role !== "developer" && !hasProPrivileges(currentUser) && !isStdCon) {
        return res.status(403).json({ error: "Only developers and consultants can manage site assignments" });
      }

      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const site = await storage.getSite(req.params.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }

      // Standard consultants: only manage client users at their assigned companies
      if (isStdCon) {
        if (targetUser.role !== "client") {
          return res.status(403).json({ error: "Standard consultants can only manage client site assignments" });
        }
        const myAssignments = await storage.getConsultantSites(currentUser.id);
        const mySiteIds = new Set(myAssignments.map(a => a.entityId));
        const allSites = await storage.getSites();
        const myCompanyIds = new Set(allSites.filter(s => mySiteIds.has(s.id)).map(s => s.companyId));
        if (!myCompanyIds.has(site.companyId)) {
          return res.status(403).json({ error: "You can only manage users in sites within your assigned companies" });
        }
      }

      let removed = false;
      
      if (targetUser.role === "consultant") {
        removed = await storage.removeConsultantAssignment(targetUser.id, site.id);
        
        if (removed) {
          await storage.createAuditLog({
            action: "consultant_unassigned",
            entityType: "site",
            entityId: site.id,
            userId: currentUser.id,
            userName: currentUser.fullName,
            details: `Removed consultant ${targetUser.fullName} from site ${site.name}`,
            metadata: { consultantId: targetUser.id, siteId: site.id },
          });
        }
      } else if (targetUser.role === "client") {
        // Block removal if this user is the primary contact — they must always have full site access
        if (targetUser.companyId) {
          const company = await storage.getCompany(targetUser.companyId);
          if (company && company.contactUserId === targetUser.id) {
            return res.status(400).json({ error: "Cannot remove a primary contact from site access. Change the primary contact first." });
          }
        }
        const allAssignments = await storage.getClientSites(targetUser.id);
        if (allAssignments.length <= 1) {
          return res.status(400).json({ error: "Cannot remove the last site assignment from a client user. Assign another site first." });
        }

        removed = await storage.removeClientSiteAssignment(targetUser.id, site.id);
        
        if (removed) {
          await storage.createAuditLog({
            action: "client_site_unassigned",
            entityType: "site",
            entityId: site.id,
            userId: currentUser.id,
            userName: currentUser.fullName,
            details: `Removed client ${targetUser.fullName} from site ${site.name}`,
            metadata: { clientId: targetUser.id, siteId: site.id },
          });
        }
      }
      
      if (!removed) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      emitToUser(targetUser.id, "site-updated", { siteId: site.id });
      emitUserUpdated(targetUser.id);
      await emitSiteScoped("site-updated", site.id, site.companyId, { siteId: site.id });

      res.json({ success: true });
    } catch (error) {
      console.error("Remove site assignment error:", error);
      res.status(500).json({ error: "Failed to remove site assignment" });
    }
  });

  // Delete user (admin only) - keeps audit logs
  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser || (currentUser.role !== "developer" && !hasProPrivileges(currentUser))) {
        return res.status(403).json({ error: "Only developers and pro consultants can delete users" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (targetUser.id === currentUser.id) {
        return res.status(400).json({ error: "You cannot delete your own account" });
      }

      if (targetUser.role === "developer") {
        return res.status(400).json({ error: "Developer users cannot be deleted" });
      }
      
      // Pro consultants and Admins cannot delete other consultant or admin accounts
      if (hasProPrivileges(currentUser) && currentUser.role !== "developer" && (targetUser.role === "consultant" || targetUser.role === "administrator")) {
        return res.status(403).json({ error: "You cannot delete consultant or admin accounts" });
      }

      // Remove related records but keep audit logs
      // Remove consultant assignments
      if (targetUser.role === "consultant") {
        const assignments = await storage.getConsultantSites(targetUser.id);
        for (const assignment of assignments) {
          await storage.removeConsultantAssignment(targetUser.id, assignment.siteId);
        }
      }

      // Remove client site assignments
      if (targetUser.role === "client") {
        const assignments = await storage.getClientSites(targetUser.id);
        for (const assignment of assignments) {
          await storage.removeClientSiteAssignment(targetUser.id, assignment.siteId);
        }
      }

      // Remove user invitations
      const invitations = await storage.getUserInvitationsByUser(targetUser.id);
      for (const invitation of invitations) {
        await storage.deleteUserInvitation(invitation.id);
      }

      // Remove sessions for this user
      await pool.query(`DELETE FROM session WHERE sess::text LIKE '%' || $1 || '%'`, [targetUser.id]);

      // Delete the user
      await pool.query(`DELETE FROM users WHERE id = $1`, [targetUser.id]);

      // Log the deletion
      await storage.createAuditLog({
        action: "user_deleted",
        entityType: "user",
        entityId: targetUser.id,
        userId: currentUser.id,
        userName: currentUser.fullName,
        details: `Deleted user ${targetUser.fullName} (${targetUser.username}, ${targetUser.role}, ref: ${targetUser.referenceNumber || 'N/A'})`,
        metadata: {
          deletedUserId: targetUser.id,
          deletedUsername: targetUser.username,
          deletedUserRole: targetUser.role,
          deletedUserEmail: targetUser.email,
          deletedUserRef: targetUser.referenceNumber,
        },
      });

      emitUserUpdated(targetUser.id, { deleted: true });
      if (targetUser.companyId) await emitCompanyScoped("company-updated", targetUser.companyId, { companyId: targetUser.companyId });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Update user
  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin can update users, or consultants for their assigned entities
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const isSelfEdit = currentUser.id === targetUser.id;
      const isRestrictedRole = currentUser.role === "client" || (currentUser.role === "consultant" && !isProConsultant(currentUser));

      if (currentUser.role !== "developer") {
        if (hasProPrivileges(currentUser)) {
          // Pro consultants and Admins have full access to update users
        } else if (isSelfEdit && isRestrictedRole) {
          // Standard consultants and clients may update their own profile,
          // but only a limited set of fields (enforced below)
        } else if (currentUser.role === "consultant" && targetUser.companyId) {
          // Standard consultants can only update users in their assigned companies
          const companySites = await storage.getSitesByCompanyId(targetUser.companyId);
          let hasAccess = false;
          for (const site of companySites) {
            const assignments = await storage.getConsultantAssignments(site.id);
            if (assignments.some(a => a.consultantId === currentUser.id)) {
              hasAccess = true;
              break;
            }
          }
          if (!hasAccess) {
            return res.status(403).json({ error: "Access denied" });
          }
        } else {
          return res.status(403).json({ error: "Only developers and pro consultants can update users" });
        }
      }
      
      const { 
        status, 
        clientPermissionRole, 
        email, 
        fullName, 
        title, 
        firstName, 
        lastName, 
        jobTitle, 
        department, 
        phone, 
        mobile, 
        preferredContactMethod, 
        notes,
        role,
        companyId,
        consultantTier,
        sources,
        managerId
      } = req.body;

      // Standard consultants and clients editing their own profile may only update
      // a limited set of contact/preference fields. This flag gates those fields below.
      const allowFullFieldEdit = !(isSelfEdit && isRestrictedRole);

      // Guard: only admins may assign/edit sources for consultant and admin users.
      // Use the effective target role (post-update) so that a role change from client
      // to consultant/admin is also covered.
      const effectiveTargetRole = (role ?? targetUser.role) as string;
      const targetIsConsultantOrAdmin = effectiveTargetRole === "consultant" || effectiveTargetRole === "developer" || effectiveTargetRole === "administrator";
      const sourcesPayload: string[] | undefined =
        (currentUser.role !== "developer" && targetIsConsultantOrAdmin)
          ? undefined  // strip sources from update; preserve existing value
          : sources;
      
      // Validate sources for consultant/admin roles — only when sources will actually be written
      if (targetIsConsultantOrAdmin && sourcesPayload !== undefined) {
        if (!Array.isArray(sourcesPayload) || sourcesPayload.length === 0) {
          return res.status(400).json({ error: "At least one source is required for consultant and developer users" });
        }
      }

      const updated = await storage.updateUser(req.params.id, {
        // Admin-only / privileged fields — blocked for restricted self-edits
        ...(allowFullFieldEdit && status !== undefined && { status }),
        ...(allowFullFieldEdit && clientPermissionRole !== undefined && { clientPermissionRole: "full" as const }),
        ...(allowFullFieldEdit && email !== undefined && { email }),
        ...(allowFullFieldEdit && fullName !== undefined && { fullName }),
        ...(allowFullFieldEdit && firstName !== undefined && { firstName }),
        ...(allowFullFieldEdit && lastName !== undefined && { lastName }),
        ...(allowFullFieldEdit && notes !== undefined && { notes }),
        ...(allowFullFieldEdit && role !== undefined && { role }),
        ...(allowFullFieldEdit && companyId !== undefined && { companyId }),
        ...(allowFullFieldEdit && consultantTier !== undefined && { consultantTier }),
        ...(allowFullFieldEdit && sourcesPayload !== undefined && { sources: Array.isArray(sourcesPayload) ? sourcesPayload : null }),
        // Manager allocation: only privileged users (developer / pro consultant) may set it.
        // Administrators never have a manager, so when the (effective) role is administrator we
        // force-clear any existing managerId on update — this also covers converting an existing
        // consultant into an administrator.
        ...((currentUser.role === "developer" || (currentUser.role === "consultant" && currentUser.consultantTier === "pro")) && (
          effectiveTargetRole === "administrator"
            ? { managerId: null }
            : (managerId !== undefined ? { managerId: managerId || null } : false)
        )),
        // Fields everyone can update on their own profile
        ...(title !== undefined && { title }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(department !== undefined && { department }),
        ...(phone !== undefined && { phone }),
        ...(mobile !== undefined && { mobile }),
        ...(preferredContactMethod !== undefined && { preferredContactMethod }),
      });
      
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // If account was deactivated or locked, revoke their active SSE session
      if (status === "inactive" || status === "locked") {
        try {
          emitToUser(req.params.id, "session-revoked", { reason: "account_deactivated" });
        } catch { /* non-fatal */ }
      }

      // Emit user-updated so admins/consultants see user changes in real time
      try {
        emitToRole("developer", "user-updated", { userId: req.params.id });
        emitToRole("consultant", "user-updated", { userId: req.params.id });
      } catch { /* non-fatal */ }

      // Remove password from response
      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Update consultant permissions (admin-only)
  app.patch("/api/users/:id/permissions", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser || currentUser.role !== "developer") {
        return res.status(403).json({ error: "Developer access required" });
      }
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      if (targetUser.role !== "consultant" && targetUser.role !== "administrator") {
        return res.status(400).json({ error: "Permissions can only be set for consultant or admin users" });
      }
      const permissionsSchema = z.object({
        caseAdvocate: z.boolean(),
        trainingLibrary: z.boolean().optional(),
        templateLibrary: z.boolean().optional(),
        services: z.boolean().optional(),
        reportIncident: z.boolean().optional(),
      });
      const parsed = permissionsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid permissions data", details: parsed.error.format() });
      }
      const existing = (targetUser.consultantPermissions as Record<string, unknown> | null) ?? {};
      const updated = await storage.updateUser(req.params.id, {
        consultantPermissions: { ...existing, ...parsed.data },
      });
      // Emit user-updated so admins see permission changes in real time
      try {
        emitToRole("developer", "user-updated", { userId: req.params.id });
        emitToRole("consultant", "user-updated", { userId: req.params.id });
      } catch { /* non-fatal */ }

      const { password: _pw, ...safeUser } = updated as Record<string, unknown>;
      res.json(safeUser);
    } catch (error) {
      console.error("Update permissions error:", error);
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  // ==================== ROADMAP ROUTES (Admin Only) ====================

  const roadmapModuleEnum = z.enum(["OVERVIEW", "ADMIN", "HR", "H&S", "EL", "TRAINING", "TOOLKIT", "REPORTS"]);

  const createRoadmapItemSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().nullable(),
    category: z.enum(["feature", "improvement", "bug", "enhancement", "ai"]).optional().default("feature"),
    status: z.enum(["idea", "planned", "in_progress", "completed"]).optional().default("idea"),
    priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
    module: roadmapModuleEnum.optional().nullable(),
    sortOrder: z.number().optional().default(0),
    assignedUserId: z.string().optional().nullable(),
  });

  const updateRoadmapItemSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    category: z.enum(["feature", "improvement", "bug", "enhancement", "ai"]).optional(),
    status: z.enum(["idea", "planned", "in_progress", "completed"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    module: roadmapModuleEnum.optional().nullable(),
    sortOrder: z.number().optional(),
    developerNotes: z.string().optional().nullable(),
    assignedUserId: z.string().optional().nullable(),
  });

  // Get all roadmap items
  app.get("/api/roadmap", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Developer access required" });
      }
      
      const items = await storage.getRoadmapItems();
      res.json(items);
    } catch (error) {
      console.error("Get roadmap items error:", error);
      res.status(500).json({ error: "Failed to fetch roadmap items" });
    }
  });

  // Create roadmap item
  app.post("/api/roadmap", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Developer access required" });
      }
      
      const parsed = createRoadmapItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
      }
      
      const item = await storage.createRoadmapItem({
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        category: parsed.data.category,
        status: parsed.data.status,
        priority: parsed.data.priority,
        module: parsed.data.module ?? null,
        sortOrder: parsed.data.sortOrder,
        assignedUserId: parsed.data.assignedUserId ?? null,
      });
      
      emitToRole("developer", "roadmap-updated", {});
      res.status(201).json(item);
    } catch (error) {
      console.error("Create roadmap item error:", error);
      res.status(500).json({ error: "Failed to create roadmap item" });
    }
  });

  // Update roadmap item
  app.patch("/api/roadmap/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Developer access required" });
      }
      
      const parsed = updateRoadmapItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
      }
      
      // Only allow whitelisted fields to be updated
      const updateData: Record<string, unknown> = {};
      if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
      if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
      if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
      if (parsed.data.status !== undefined) {
        updateData.status = parsed.data.status;
        if (parsed.data.status === "completed") {
          updateData.completedAt = new Date();
        } else {
          updateData.completedAt = null;
        }
      }
      if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
      if (parsed.data.module !== undefined) updateData.module = parsed.data.module;
      if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
      if (parsed.data.developerNotes !== undefined) updateData.developerNotes = parsed.data.developerNotes;
      if (parsed.data.assignedUserId !== undefined) updateData.assignedUserId = parsed.data.assignedUserId;
      
      const updated = await storage.updateRoadmapItem(req.params.id, updateData);
      
      if (!updated) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      
      emitToRole("developer", "roadmap-updated", {});
      res.json(updated);
    } catch (error) {
      console.error("Update roadmap item error:", error);
      res.status(500).json({ error: "Failed to update roadmap item" });
    }
  });

  // Delete roadmap item
  app.delete("/api/roadmap/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Developer access required" });
      }
      
      const deleted = await storage.deleteRoadmapItem(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      
      emitToRole("developer", "roadmap-updated", {});
      res.json({ success: true });
    } catch (error) {
      console.error("Delete roadmap item error:", error);
      res.status(500).json({ error: "Failed to delete roadmap item" });
    }
  });

  // Helper: get the latest revision date of legal documents
  async function getLatestLegalRevisionDate(): Promise<Date | null> {
    try {
      const objectStorageService = new ObjectStorageService();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();

      const getRevDate = async (type: string): Promise<Date | null> => {
        try {
          const fullPath = `${privateObjectDir}/legal/${type}`;
          const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = pathParts[0];
          const objectName = pathParts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          const [exists] = await file.exists();
          if (!exists) return null;
          const [metadata] = await file.getMetadata();
          const revDate = metadata.metadata?.revisionDate || metadata.metadata?.uploadedAt || metadata.timeCreated;
          return revDate ? new Date(revDate) : null;
        } catch {
          return null;
        }
      };

      const [termsRev, privacyRev] = await Promise.all([
        getRevDate("terms"),
        getRevDate("privacy"),
      ]);

      if (!termsRev && !privacyRev) return null;
      if (!termsRev) return privacyRev;
      if (!privacyRev) return termsRev;
      return termsRev > privacyRev ? termsRev : privacyRev;
    } catch {
      return null;
    }
  }

  // Accept/re-accept legal documents (authenticated)
  app.post("/api/legal-documents/accept", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const currentUser = await storage.getUser(sessionUserId);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const now = new Date();
      await storage.updateUser(sessionUserId, { legalAcceptedAt: now });

      await storage.createAuditLog({
        action: "legal_documents_accepted",
        userId: currentUser.id,
        userName: currentUser.fullName,
        details: `User accepted legal documents (T&C and Privacy Policy)`,
      });

      res.json({ success: true, legalAcceptedAt: now.toISOString() });
    } catch (error) {
      console.error("Error accepting legal documents:", error);
      res.status(500).json({ error: "Failed to accept legal documents" });
    }
  });

  // ==========================================
  // Legal Documents (T&C and Privacy Policy)
  // ==========================================

  // Upload/replace a legal document (admin only)
  app.post("/api/legal-documents/:type", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const currentUser = await storage.getUser(sessionUserId);
      if (!currentUser || currentUser.role !== "developer") {
        return res.status(403).json({ error: "Only developers can manage legal documents" });
      }

      const docType = req.params.type;
      if (docType !== "terms" && docType !== "privacy") {
        return res.status(400).json({ error: "Invalid document type. Must be 'terms' or 'privacy'" });
      }

      const rawFileName = req.headers["x-file-name"] as string;
      const contentType = req.headers["content-type"] || "application/octet-stream";
      if (!rawFileName) {
        return res.status(400).json({ error: "Missing x-file-name header" });
      }

      const fileName = decodeURIComponent(rawFileName);
      const objectStorageService = new ObjectStorageService();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/legal/${docType}`;

      const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Determine revision number: increment if document already exists
      let revisionNumber = 1;
      const [alreadyExists] = await file.exists();
      if (alreadyExists) {
        const [existingMeta] = await file.getMetadata();
        const existing = parseInt(existingMeta.metadata?.revisionNumber || "0", 10);
        revisionNumber = existing + 1;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const revisionDate = new Date().toISOString();
      const revisionDateShort = revisionDate.slice(0, 10); // YYYY-MM-DD

      // Build a versioned filename: base_v{N}_{YYYY-MM-DD}.ext
      const lastDot = fileName.lastIndexOf(".");
      const baseName = lastDot !== -1 ? fileName.slice(0, lastDot) : fileName;
      const ext = lastDot !== -1 ? fileName.slice(lastDot) : "";
      const versionedFileName = `${baseName}_v${revisionNumber}_${revisionDateShort}${ext}`;

      await file.save(buffer, {
        contentType: contentType,
        metadata: {
          originalName: versionedFileName,
          uploadedBy: currentUser.username,
          uploadedAt: revisionDate,
          revisionDate: revisionDate,
          revisionNumber: String(revisionNumber),
        },
      });

      res.json({
        success: true,
        type: docType,
        fileName: versionedFileName,
        fileSize: buffer.length,
        mimeType: contentType,
        revisionDate,
        revisionNumber,
      });
    } catch (error) {
      console.error("Error uploading legal document:", error);
      res.status(500).json({ error: "Failed to upload legal document" });
    }
  });

  // Get legal document info (public - no auth needed for invitation page)
  app.get("/api/legal-documents/:type/info", async (req, res) => {
    try {
      const docType = req.params.type;
      if (docType !== "terms" && docType !== "privacy") {
        return res.status(400).json({ error: "Invalid document type" });
      }

      const objectStorageService = new ObjectStorageService();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/legal/${docType}`;

      const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (!exists) {
        return res.json({ exists: false, type: docType });
      }

      const [metadata] = await file.getMetadata();
      res.json({
        exists: true,
        type: docType,
        fileName: metadata.metadata?.originalName || `${docType}.pdf`,
        fileSize: parseInt(metadata.size as string) || 0,
        mimeType: metadata.contentType || "application/pdf",
        uploadedAt: metadata.metadata?.uploadedAt || null,
        uploadedBy: metadata.metadata?.uploadedBy || null,
        revisionDate: metadata.metadata?.revisionDate || metadata.metadata?.uploadedAt || metadata.timeCreated || null,
        revisionNumber: metadata.metadata?.revisionNumber ? parseInt(metadata.metadata.revisionNumber, 10) : null,
      });
    } catch (error) {
      console.error("Error getting legal document info:", error);
      res.status(500).json({ error: "Failed to get legal document info" });
    }
  });

  // Serve legal document (public - no auth needed for invitation page)
  app.get("/api/legal-documents/:type/view", async (req, res) => {
    try {
      const docType = req.params.type;
      if (docType !== "terms" && docType !== "privacy") {
        return res.status(400).json({ error: "Invalid document type" });
      }

      const objectStorageService = new ObjectStorageService();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/legal/${docType}`;

      const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: "Document not found" });
      }

      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || "application/pdf";
      const fileName = metadata.metadata?.originalName || `${docType}.pdf`;

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");

      const stream = file.createReadStream();
      stream.pipe(res);
    } catch (error) {
      console.error("Error serving legal document:", error);
      res.status(500).json({ error: "Failed to serve legal document" });
    }
  });

  app.get("/api/legal-documents/:type/download", async (req, res) => {
    try {
      const docType = req.params.type;
      if (docType !== "terms" && docType !== "privacy") {
        return res.status(400).json({ error: "Invalid document type" });
      }

      const objectStorageService = new ObjectStorageService();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/legal/${docType}`;

      const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: "Document not found" });
      }

      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || "application/pdf";
      const fileName = metadata.metadata?.originalName || `${docType}.pdf`;

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

      const stream = file.createReadStream();
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading legal document:", error);
      res.status(500).json({ error: "Failed to download legal document" });
    }
  });

  // ==================== FEEDBACK ENDPOINTS ====================
  // All feedback endpoints are for admin/consultant only
  const requirePrivileged = (req: any, res: any, next: any) => {
    const user = (req.session as any)?.user;
    if (user?.role !== "developer" && user?.role !== "consultant" && user?.role !== "administrator") {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };

  app.get("/api/feedback", requireAuth, requirePrivileged, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const feedback = await storage.getFeedbackWithMetadata(user.id);
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.post("/api/feedback/:id/read", requireAuth, requirePrivileged, async (req, res) => {
    try {
      const user = (req.session as any).user;
      await storage.markFeedbackRead(req.params.id, user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking feedback as read:", error);
      res.status(500).json({ error: "Failed to mark as read" });
    }
  });

  app.post("/api/feedback", requireAuth, requirePrivileged, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const parseResult = createFeedbackSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid feedback data" });
      }

      const feedback = await storage.createFeedback({
        userId: user.id,
        userName: user.fullName,
        message: parseResult.data.message,
      });

      await storage.createAuditLog({
        action: "create_feedback",
        userId: user.id,
        userName: user.fullName,
        details: `Submitted feedback: ${feedback.message.substring(0, 50)}...`,
      });

      res.status(201).json(feedback);
    } catch (error) {
      console.error("Error creating feedback:", error);
      res.status(500).json({ error: "Failed to create feedback" });
    }
  });

  const updateFeedbackSchema = z.object({
    message: z.string().optional(),
    status: z.enum(["open", "resolved"]).optional(),
  });

  app.patch("/api/feedback/:id", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;

      const parseResult = updateFeedbackSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid update data" });
      }

      const existing = await storage.getFeedbackItem(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Feedback not found" });
      }

      const isDeveloper = user.role === "developer";
      const isOwner = existing.userId === user.id;

      // Status changes are admin-only
      if (parseResult.data.status !== undefined && !isDeveloper) {
        return res.status(403).json({ error: "Only developers can change feedback status" });
      }

      // Message edits are owner-only and only when no engagement yet
      if (parseResult.data.message !== undefined) {
        if (!isOwner) {
          return res.status(403).json({ error: "You can only edit your own feedback" });
        }
        // Check no upvotes or comments exist
        const upvoteCount = (existing.upvotes || []).length;
        const comments = await storage.getFeedbackComments(req.params.id);
        if (upvoteCount > 0 || comments.length > 0) {
          return res.status(409).json({ error: "Cannot edit feedback that has upvotes or comments" });
        }
      }

      const updated = await storage.updateFeedback(req.params.id, parseResult.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating feedback:", error);
      res.status(500).json({ error: "Failed to update feedback" });
    }
  });

  app.patch("/api/feedback/comments/:id", requireAuth, requirePrivileged, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const { content } = req.body;
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Comment content is required" });
      }

      // Verify ownership via a targeted query on the comment row
      const { rows } = await pool.query<{ user_id: string }>(
        "SELECT user_id FROM feedback_comments WHERE id = $1",
        [req.params.id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Comment not found" });
      }
      if (rows[0].user_id !== user.id) {
        return res.status(403).json({ error: "You can only edit your own comments" });
      }

      const updated = await storage.updateFeedbackComment(req.params.id, content.trim());
      res.json(updated);
    } catch (error) {
      console.error("Error updating comment:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  app.post("/api/feedback/:id/upvote", requireAuth, requirePrivileged, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const updated = await storage.toggleFeedbackUpvote(req.params.id, user.id);
      if (!updated) {
        return res.status(404).json({ error: "Feedback not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error toggling upvote:", error);
      res.status(500).json({ error: "Failed to toggle upvote" });
    }
  });

  app.get("/api/feedback/:id/comments", requireAuth, requirePrivileged, async (req, res) => {
    try {
      const comments = await storage.getFeedbackComments(req.params.id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/feedback/:id/comments", requireAuth, requirePrivileged, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Comment content is required" });
      }

      const comment = await storage.createFeedbackComment({
        feedbackId: req.params.id,
        userId: user.id,
        userName: user.fullName,
        content,
      });

      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.post("/api/feedback/comments/:id/like", requireAuth, requirePrivileged, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const updated = await storage.toggleCommentLike(req.params.id, user.id);
      if (!updated) {
        return res.status(404).json({ error: "Comment not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ error: "Failed to toggle like" });
    }
  });

  app.delete("/api/feedback/:id", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      if (user.role !== "developer") {
        return res.status(403).json({ error: "Only developers can delete feedback" });
      }

      const success = await storage.deleteFeedback(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Feedback not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting feedback:", error);
      res.status(500).json({ error: "Failed to delete feedback" });
    }
  });

  // ===================== INCIDENTS =====================

  /**
   * GDPR name redaction – applied to any viewer who is not a client.
   * Personal names on incident reports (affected person, reporting person,
   * declaration, submitted-by, witnesses, investigation completed-by, RIDDOR
   * responsible person, and structured witness entries in the investigation
   * JSON) are replaced with "[Redacted]" before the data leaves the server.
   * Clients who submitted the report can see full details; consultants and
   * admins see anonymised data.
   */
  function redactIncidentNamesForNonClient(incident: any): any {
    const REDACTED = "[Redacted]";
    let redactedInvWitnesses = incident.invWitnesses;
    if (incident.invWitnesses) {
      try {
        const parsed: any[] = JSON.parse(incident.invWitnesses);
        redactedInvWitnesses = JSON.stringify(parsed.map((w: any) => ({ ...w, name: REDACTED })));
      } catch { /* leave as-is if unparseable */ }
    }
    return {
      ...incident,
      affectedPersonName: incident.affectedPersonName != null ? REDACTED : incident.affectedPersonName,
      affectedPersonAddress: incident.affectedPersonAddress != null ? REDACTED : incident.affectedPersonAddress,
      reportingPersonName: incident.reportingPersonName != null ? REDACTED : incident.reportingPersonName,
      reportingPersonAddress: incident.reportingPersonAddress != null ? REDACTED : incident.reportingPersonAddress,
      declarationName: incident.declarationName != null ? REDACTED : incident.declarationName,
      declarationSignature: incident.declarationSignature != null ? REDACTED : incident.declarationSignature,
      reportedByName: incident.reportedByName != null ? REDACTED : incident.reportedByName,
      witnesses: (() => {
        if (!incident.witnesses) return incident.witnesses;
        try {
          const parsed: any[] = JSON.parse(incident.witnesses);
          return JSON.stringify(parsed.map((w: any) => ({ ...w, name: w.name != null ? REDACTED : w.name })));
        } catch { return REDACTED; }
      })(),
      invCompletedBy: incident.invCompletedBy != null ? REDACTED : incident.invCompletedBy,
      riddorResponsiblePerson: incident.riddorResponsiblePerson != null ? REDACTED : incident.riddorResponsiblePerson,
      invWitnesses: redactedInvWitnesses,
    };
  }

  app.get("/api/incidents", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const { siteId, entityId, status, includeArchived } = req.query;
      const filters: any = {};
      if (siteId) filters.siteId = siteId as string;
      if (entityId) filters.entityId = entityId as string;
      if (status) filters.status = status as string;
      if (includeArchived === "true") filters.includeArchived = true;

      let incidents = await storage.getIncidents(filters);

      if (user.role === "client") {
        const userSites = await storage.getClientSites(user.id);
        const siteIds = userSites.map((a: any) => a.siteId);
        incidents = incidents.filter((i: any) => siteIds.includes(i.siteId));
      } else if (user.role === "consultant" && user.consultantTier !== "pro") {
        const assignments = await storage.getConsultantSites(user.id);
        const siteIds = assignments.map((a: any) => a.siteId);
        incidents = incidents.filter((i: any) => siteIds.includes(i.siteId));
      }

      // Redact personal names for non-client users unless the client has granted full access
      if (user.role !== "client") {
        incidents = incidents.map((inc: any) =>
          inc.consultantFullAccess ? inc : redactIncidentNamesForNonClient(inc)
        );
      }

      res.json(incidents);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });


  // Upload a file (photo or document) attached to an incident
  app.post("/api/incidents/:id/upload", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      const incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });

      const canAccess = await canUserAccessSite(user, incident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const rawFileName = req.headers["x-file-name"] as string | undefined;
      if (!rawFileName) return res.status(400).json({ error: "Missing x-file-name header" });
      const fileName = decodeURIComponent(rawFileName);
      const rawTitle = req.headers["x-file-title"] as string | undefined;
      const title = rawTitle ? decodeURIComponent(rawTitle) : fileName.replace(/\.[^/.]+$/, "");
      const rawComments = req.headers["x-file-comments"] as string | undefined;
      const comments = rawComments ? decodeURIComponent(rawComments) : null;
      const contentType = (req.headers["content-type"] || "application/octet-stream").split(";")[0].trim();

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) return res.status(400).json({ error: "Empty file body" });

      const objectStorageService = new ObjectStorageService();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const objectId = crypto.randomUUID();
      const fullPath = `${privateObjectDir}/uploads/${objectId}`;
      const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      await file.save(buffer, { contentType, metadata: { originalName: fileName } });
      const objectPath = `/objects/uploads/${objectId}`;

      const doc = await storage.createDocument({
        title,
        comments,
        module: "health_safety",
        type: "incident_report",
        entityId: incident.entityId,
        siteId: incident.siteId,
        incidentId: incident.id,
        folderId: incident.folderId || null,
        fileName,
        fileUrl: objectPath,
        fileSize: buffer.length,
        mimeType: contentType,
        uploadedBy: user.id,
        status: "compliant",
        approvalStatus: "approved",
        source: "upload",
      });

      await storage.createAuditLog({
        action: "document_uploaded",
        userId: user.id,
        userName: user.fullName,
        entityId: incident.entityId,
        documentId: doc.id,
        module: "health_safety",
        details: `"${title}" uploaded to ${incident.incidentReference}`,
        incidentId: incident.id,
      } as any);

      await emitDocumentUpdated(doc, { documentId: doc.id, incidentId: incident.id });
      await emitSiteScoped("incident-updated", incident.siteId, incident.entityId, { incidentId: incident.id });

      res.json(doc);
    } catch (error) {
      console.error("Error uploading incident file:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  app.get("/api/incidents/overdue-actions-count", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const isPrivileged = user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator";
      const allIncidents = await storage.getIncidents(isPrivileged ? undefined : { entityId: user.entityId });
      let openCount = 0;
      for (const incident of allIncidents) {
        const milestones = await storage.getIncidentMilestones(incident.id);
        openCount += milestones.filter(m => !m.isCompleted).length;
      }
      res.json({ count: openCount });
    } catch (error) {
      console.error("Error fetching open actions count:", error);
      res.status(500).json({ error: "Failed to fetch open actions count" });
    }
  });

  app.get("/api/incidents/open-actions-breakdown", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const isPrivileged = user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator";
      const allIncidents = await storage.getIncidents(isPrivileged ? undefined : { entityId: user.entityId });
      const breakdown: { incidentId: string; incidentReference: string; title: string; openCount: number }[] = [];
      for (const incident of allIncidents) {
        const milestones = await storage.getIncidentMilestones(incident.id);
        const openCount = milestones.filter(m => !m.isCompleted).length;
        if (openCount > 0) {
          breakdown.push({ incidentId: incident.id, incidentReference: incident.incidentReference, title: incident.title, openCount });
        }
      }
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching open actions breakdown:", error);
      res.status(500).json({ error: "Failed to fetch open actions breakdown" });
    }
  });

  app.get("/api/incidents/:id", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      let incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });
      const canAccess = await canUserAccessSite(user, incident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      // Redact personal names for non-client users unless client has granted full access
      if (user.role !== "client" && !incident.consultantFullAccess) {
        incident = redactIncidentNamesForNonClient(incident);
      }
      res.json(incident);
    } catch (error) {
      console.error("Error fetching incident:", error);
      res.status(500).json({ error: "Failed to fetch incident" });
    }
  });

  // ─── Toggle consultant full access (client only) ──────────────────────────
  app.patch("/api/incidents/:id/consultant-access", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      if (user.role !== "client") return res.status(403).json({ error: "Only clients can change consultant access" });
      const existing = await storage.getIncident(req.params.id);
      if (!existing) return res.status(404).json({ error: "Incident not found" });
      const canAccess = await canUserAccessSite(user, existing.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const { consultantFullAccess } = req.body;
      if (typeof consultantFullAccess !== "boolean") return res.status(400).json({ error: "consultantFullAccess must be boolean" });
      const updated = await storage.updateIncident(req.params.id, { consultantFullAccess });
      await storage.createAuditLog({
        action: consultantFullAccess ? "consultant_access_granted" : "consultant_access_revoked",
        userId: user.id,
        userName: user.fullName,
        entityId: existing.entityId,
        module: "health_safety",
        details: `Consultant full access ${consultantFullAccess ? "granted" : "revoked"} on ${existing.incidentReference}`,
        incidentId: existing.id,
      } as any);
      await emitSiteScoped("incident-updated", existing.siteId, existing.entityId, { incidentId: existing.id });
      res.json(updated);
    } catch (error) {
      console.error("Error toggling consultant access:", error);
      res.status(500).json({ error: "Failed to update consultant access" });
    }
  });

  app.post("/api/incidents", requireAuth, async (req, res) => {
    try {
      const freshUser = await storage.getUser((req.session as any).userId);
      if (!freshUser) return res.status(401).json({ error: "User not found" });
      const user = freshUser;
      const body = req.body;

      if (!body.title || !body.description || !body.incidentType || !body.severity || !body.siteId || !body.entityId || !body.incidentDate) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (user.role === "consultant" || user.role === "administrator") {
        const perms = user.consultantPermissions as { reportIncident?: boolean } | null;
        if (!perms?.reportIncident) return res.status(403).json({ error: "You do not have permission to report incidents" });
      }

      const canAccess = await canUserAccessSite(user, body.siteId);
      if (!canAccess) return res.status(403).json({ error: "You do not have access to report incidents for this site" });

      const incident = await storage.createIncident({
        ...body,
        reportedBy: user.id,
        reportedByName: user.fullName,
        incidentDate: new Date(body.incidentDate),
      });

      await storage.createAuditLog({
        action: "incident_created",
        userId: user.id,
        userName: user.fullName,
        entityId: body.entityId,
        module: "health_safety",
        details: `Incident ${incident.incidentReference} reported: ${incident.title}`,
        incidentId: incident.id,
      } as any);

      const [site, company] = await Promise.all([
        storage.getSite(incident.siteId).catch(() => null),
        storage.getCompany(incident.entityId).catch(() => null),
      ]);

      // Look up consultants synchronously (fast DB queries) so we can include names in the response,
      // then fire emails asynchronously so the response is never delayed by network I/O.
      let notifiedConsultants: { id: string; name: string }[] = [];
      if (user.role === "client") {
        const assignments = await storage.getConsultantAssignments(incident.siteId).catch(() => []);
        const consultantUsers = await Promise.all(
          assignments.map((a: any) => storage.getUser(a.consultantId).catch(() => null))
        );
        notifiedConsultants = consultantUsers
          .filter((c): c is NonNullable<typeof c> => c != null)
          .map((c: any) => ({ id: c.id, name: c.fullName || c.email }));

        // Fire email notifications — not awaited so response is returned immediately
        const portalUrl = process.env.APP_BASE_URL ||
          (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}` : "https://portal.guardiangroup.co.uk");
        Promise.resolve().then(async () => {
          for (let i = 0; i < assignments.length; i++) {
            const consultant = consultantUsers[i];
            if (consultant?.email) {
              try {
                await sendIncidentNotificationEmail({
                  to: consultant.email,
                  fullName: (consultant as any).fullName || consultant.email,
                  companyName: company?.name || "Unknown Company",
                  siteName: site?.name || "Unknown Site",
                  incidentReference: incident.incidentReference,
                  incidentType: incident.incidentType,
                  severity: incident.severity,
                  incidentDate: incident.incidentDate,
                  portalUrl,
                  role: "consultant",
                });
              } catch (emailErr) {
                console.error(`Failed to send incident notification to consultant ${assignments[i].consultantId}:`, emailErr);
              }
            }
          }
        });
      }

      // Create default "Close the incident" action item for every new incident
      await storage.createIncidentMilestone({
        incidentId: incident.id,
        title: "Close the incident (Default Action)",
        description: "This is a default action item. Completing it will automatically update this incident's status to 'Closed'.",
        createdBy: user.id,
      });

      // Emit incident-updated so relevant users see new incidents in real time
      try {
        const incPayload = { incidentId: incident.id, siteId: incident.siteId };
        emitToCompany(incident.entityId, "incident-updated", incPayload);
        emitToRole("developer", "incident-updated", incPayload);
        emitToRole("consultant", "incident-updated", incPayload);
      } catch { /* non-fatal */ }

      res.status(201).json({ ...incident, notifiedConsultants });
    } catch (error) {
      console.error("Error creating incident:", error);
      res.status(500).json({ error: "Failed to create incident" });
    }
  });


  app.patch("/api/incidents/:id", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const { id } = req.params;
      const updates = req.body;

      const existing = await storage.getIncident(id);
      if (!existing) return res.status(404).json({ error: "Incident not found" });

      const canAccess = await canUserAccessSite(user, existing.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      if (updates.resolvedAt) updates.resolvedAt = new Date(updates.resolvedAt);
      if (updates.incidentDate) updates.incidentDate = new Date(updates.incidentDate);
      if (updates.invCompletedAt) updates.invCompletedAt = new Date(updates.invCompletedAt);

      // Auto-advance status to "under_review" when investigation data is first saved
      const invFields = ["invCompletedAt","invContributingFactors","invConclusion","invPrimaryCause","invRootCause","invWitnesses","invActions","invRecommendations","invAbsentFromWork","invEquipmentInvolved","invDocumentsReviewed","invOperators","invAmendments"];
      const hasInvData = invFields.some(f => f in updates);
      if (hasInvData && existing.status === "reported" && !updates.status) {
        updates.status = "under_review";
      }

      const incident = await storage.updateIncident(id, updates);

      const isStatusChange = updates.status && updates.status !== existing.status;
      await storage.createAuditLog({
        action: isStatusChange ? "incident_status_changed" : "incident_updated",
        userId: user.id,
        userName: user.fullName,
        entityId: existing.entityId,
        module: "health_safety",
        details: isStatusChange
          ? `Status changed from "${existing.status}" to "${updates.status}" on ${existing.incidentReference}`
          : `Details updated on ${existing.incidentReference}`,
        incidentId: id,
      } as any);

      // Emit incident-updated so relevant users see incident changes in real time
      try {
        const incUpdatePayload = { incidentId: id, siteId: existing.siteId };
        emitToCompany(existing.entityId, "incident-updated", incUpdatePayload);
        emitToRole("developer", "incident-updated", incUpdatePayload);
        emitToRole("consultant", "incident-updated", incUpdatePayload);
      } catch { /* non-fatal */ }

      res.json(incident);
    } catch (error) {
      console.error("Error updating incident:", error);
      res.status(500).json({ error: "Failed to update incident" });
    }
  });

  // ─── Investigation Report Download ────────────────────────────────────────────
  app.get("/api/incidents/:id/initial-report", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      let incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });

      const canAccess = await canUserAccessSite(user, incident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      if (user.role !== "client" && !incident.consultantFullAccess) {
        incident = redactIncidentNamesForNonClient(incident);
      }

      const site = incident.siteId ? await storage.getSite(incident.siteId) : null;
      const company = incident.entityId ? await storage.getCompany(incident.entityId) : null;
      const siteName = site?.name ?? "—";
      const companyName = company?.name ?? "—";

      const fmt = (d: string | Date | null | undefined) =>
        d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
      const boolVal = (v: boolean | null | undefined) =>
        v === null || v === undefined ? '<span class="empty">Not recorded</span>' : v ? "Yes" : "No";
      const textVal = (v: string | null | undefined) =>
        v === "[Redacted]" ? '<span class="redacted">[Redacted]</span>' :
        v && v.trim() ? v.replace(/\n/g, "<br>") : '<span class="empty">Not recorded</span>';
      const field = (label: string, value: string) =>
        `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`;
      const nameCell = (n: string | null | undefined) =>
        n === "[Redacted]" ? '<span class="redacted">[Redacted]</span>' : (n || "—");

      let initialWitnesses: { name: string; jobRole: string; company: string }[] = [];
      try {
        if (incident.witnesses) {
          const parsed = JSON.parse(incident.witnesses);
          if (Array.isArray(parsed)) initialWitnesses = parsed;
          else initialWitnesses = [{ name: String(incident.witnesses), jobRole: "", company: "" }];
        }
      } catch { if (incident.witnesses) initialWitnesses = [{ name: String(incident.witnesses), jobRole: "", company: "" }]; }

      let bodyZones: string[] = [];
      try { if (incident.bodyDiagramMarkers) bodyZones = JSON.parse(incident.bodyDiagramMarkers); } catch {}

      const causePills = Array.isArray(incident.incidentCause) && incident.incidentCause.length > 0
        ? incident.incidentCause.map((c: string) => `<span class="pill">${c}</span>`).join("")
        : '<span class="empty">None recorded</span>';
      const effectPills = Array.isArray(incident.incidentEffect) && incident.incidentEffect.length > 0
        ? incident.incidentEffect.map((e: string) => `<span class="pill">${e}</span>`).join("")
        : '<span class="empty">None recorded</span>';

      const immediateActionsHtml = incident.immediateActions?.trim()
        ? incident.immediateActions.split("\n").filter(Boolean).map((line: string) => `<li style="font-size:13px;line-height:1.7;margin-bottom:3px;color:#111827">${line.trim()}</li>`).join("")
        : null;

      const initialWitnessRows = initialWitnesses.length > 0
        ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">
            <thead><tr>
              <th class="th">Name</th><th class="th">Job Role</th><th class="th">Company</th>
            </tr></thead>
            <tbody>${initialWitnesses.map(w => `<tr>
              <td class="td">${nameCell(w.name)}</td>
              <td class="td">${w.jobRole || "—"}</td>
              <td class="td">${w.company || "—"}</td>
            </tr>`).join("")}</tbody>
          </table>`
        : '<p class="empty" style="margin-top:6px">No witnesses recorded</p>';

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Incident Report – ${incident.incidentReference}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#111827;background:#f9fafb;padding:24px}
  .page{max-width:820px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
  .header{background:#1e293b;color:#fff;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start}
  .header h1{font-size:20px;font-weight:700;letter-spacing:-.3px}
  .header .meta{text-align:right;font-size:12px;opacity:.85;line-height:1.6}
  .ref-badge{display:inline-block;background:#fff;color:#1e293b;font-weight:700;font-size:13px;padding:4px 12px;border-radius:4px;margin-top:6px}
  .accent-banner{padding:10px 32px;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#fff;background:#16a34a}
  .body{padding:24px 32px}
  section{margin-bottom:24px}
  section h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  td{padding:7px 0;vertical-align:top;border-bottom:1px solid #f3f4f6;font-size:13px}
  td.label{width:210px;color:#6b7280;font-weight:500;padding-right:16px;white-space:nowrap}
  td.value{color:#111827;line-height:1.5}
  .empty{color:#9ca3af;font-style:italic}
  .redacted{color:#b91c1c;font-style:italic;background:#fef2f2;border-radius:3px;padding:0 5px;font-size:12px}
  .pill{display:inline-block;background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;border-radius:99px;padding:2px 10px;font-size:12px;margin:2px 3px 2px 0}
  .th{text-align:left;font-size:11px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;padding:6px 8px;background:#f9fafb}
  .td{padding:6px 8px;font-size:12px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  .footer{border-top:1px solid #e5e7eb;padding:14px 32px;background:#f9fafb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{background:#fff;padding:0}
    .page{border:none;border-radius:0;max-width:100%}
    .header{background:#1e293b !important;color:#fff !important}
    .accent-banner{background:#16a34a !important;color:#fff !important}
  }
</style>
</head>
<body>
<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 400);
  });
</script>
<div class="page">
  <div class="header">
    <div>
      <div style="font-size:11px;opacity:.7;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Guardian Group</div>
      <h1>Incident Report</h1>
      <div class="ref-badge">${incident.incidentReference}</div>
    </div>
    <div class="meta">
      <div>${companyName}</div>
      <div>${siteName}</div>
      <div>Reported: <strong>${fmt(incident.incidentDate)}</strong></div>
      <div style="margin-top:4px;font-size:11px;opacity:.65">Generated ${new Date().toLocaleString("en-GB")}</div>
    </div>
  </div>
  <div class="accent-banner">Initial Incident Report – ${incident.title}</div>
  <div class="body">

    <section>
      <h2>Incident Overview</h2>
      <table>
        ${field("Incident Type", incident.incidentType || "—")}
        ${incident.incidentNature ? field("Nature of Incident", incident.incidentNature) : ""}
        ${field("Date of Incident", fmt(incident.incidentDate))}
        ${incident.incidentTime ? field("Time of Incident", incident.incidentTime) : ""}
        ${field("Location", textVal(incident.locationDetails))}
      </table>
    </section>

    <section>
      <h2>Description of Incident</h2>
      <p style="font-size:13px;line-height:1.7;color:#111827">${incident.description ? incident.description.replace(/\n/g, "<br>") : '<span class="empty">Not provided</span>'}</p>
    </section>

    <section>
      <h2>Cause, Effect &amp; Equipment</h2>
      <table>
        <tr><td class="label">Cause(s)</td><td class="value">${causePills}</td></tr>
        <tr><td class="label">Effect / Affect</td><td class="value">${effectPills}</td></tr>
        ${field("Machinery / Equipment", textVal(incident.machineryInvolved))}
      </table>
    </section>

    <section>
      <h2>Injured / Affected Person</h2>
      <table>
        ${field("Injuries Reported", boolVal(incident.injuriesReported))}
        ${incident.injuryDetails ? field("Injury Details", textVal(incident.injuryDetails)) : ""}
        ${bodyZones.length > 0 ? field("Body Areas Affected", bodyZones.join(", ")) : ""}
        ${field("Name", textVal(incident.affectedPersonName))}
        ${incident.affectedPersonJobTitle ? field(incident.affectedPersonIsPublic ? "Role / Occupation" : "Job Title", incident.affectedPersonJobTitle) : ""}
        ${incident.affectedPersonAddress ? field("Address", textVal(incident.affectedPersonAddress)) : ""}
      </table>
    </section>

    ${immediateActionsHtml ? `<section>
      <h2>Immediate Actions Taken</h2>
      <ul style="margin:0;padding-left:20px">${immediateActionsHtml}</ul>
    </section>` : ""}

    <section>
      <h2>Witnesses</h2>
      ${initialWitnessRows}
    </section>

    <section>
      <h2>Reporting Person</h2>
      <table>
        ${field("Name", textVal(incident.reportingPersonName))}
        ${incident.reportingPersonJobTitle ? field("Job Title", textVal(incident.reportingPersonJobTitle)) : ""}
        ${incident.reportingPersonAddress ? field("Address", textVal(incident.reportingPersonAddress)) : ""}
      </table>
    </section>

  </div>
  <div class="footer">
    <span>${incident.incidentReference} — Initial Incident Report</span>
    <span>Generated ${new Date().toLocaleString("en-GB")}</span>
  </div>
</div>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error) {
      console.error("Error generating initial incident report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/incidents/:id/investigation-report", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      let incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });
      // Redact personal names for non-client users unless client has granted full access
      if (user.role !== "client" && !incident.consultantFullAccess) {
        incident = redactIncidentNamesForNonClient(incident);
      }

      const site = incident.siteId ? await storage.getSite(incident.siteId) : null;
      const company = incident.entityId ? await storage.getCompany(incident.entityId) : null;
      const siteName = site?.name ?? "—";
      const companyName = company?.name ?? "—";

      const fmt = (d: string | Date | null | undefined) =>
        d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
      const boolVal = (v: boolean | null | undefined) =>
        v === null || v === undefined ? '<span class="empty">Not recorded</span>' : v ? "Yes" : "No";
      const textVal = (v: string | null | undefined) =>
        v === "[Redacted]" ? '<span class="redacted">[Redacted]</span>' :
        v && v.trim() ? v.replace(/\n/g, "<br>") : '<span class="empty">Not recorded</span>';
      const field = (label: string, value: string) =>
        `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`;
      const nameCell = (n: string | null | undefined) =>
        n === "[Redacted]" ? '<span class="redacted">[Redacted]</span>' : (n || "—");

      let invWitnesses: { name: string; jobRole: string; company: string; statementAttached?: boolean | null }[] = [];
      try { if (incident.invWitnesses) invWitnesses = JSON.parse(incident.invWitnesses); } catch {}

      let invEquipment: { type: string; makeModel: string; serialNo: string; lastInspection: string }[] = [];
      try { if (incident.invEquipment) invEquipment = JSON.parse(incident.invEquipment); } catch {}

      // Parse initial report witnesses
      let initialWitnesses: { name: string; jobRole: string; company: string }[] = [];
      try {
        if (incident.witnesses) {
          const parsed = JSON.parse(incident.witnesses);
          if (Array.isArray(parsed)) initialWitnesses = parsed;
          else initialWitnesses = [{ name: String(incident.witnesses), jobRole: "", company: "" }];
        }
      } catch { if (incident.witnesses) initialWitnesses = [{ name: String(incident.witnesses), jobRole: "", company: "" }]; }

      // Parse initial body diagram zones
      let bodyZones: string[] = [];
      try { if (incident.bodyDiagramMarkers) bodyZones = JSON.parse(incident.bodyDiagramMarkers); } catch {}

      const witnessRows = invWitnesses.length > 0
        ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">
            <thead><tr>
              <th class="th">Name</th><th class="th">Job Role</th><th class="th">Company</th><th class="th">Statement</th>
            </tr></thead>
            <tbody>${invWitnesses.map(w => `<tr>
              <td class="td">${nameCell(w.name)}</td>
              <td class="td">${w.jobRole || "—"}</td>
              <td class="td">${w.company || "—"}</td>
              <td class="td">${w.statementAttached === null || w.statementAttached === undefined ? "—" : w.statementAttached ? "Yes" : "No"}</td>
            </tr>`).join("")}</tbody>
          </table>`
        : '<p class="empty">No witnesses recorded</p>';

      const initialWitnessRows = initialWitnesses.length > 0
        ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">
            <thead><tr>
              <th class="th">Name</th><th class="th">Job Role</th><th class="th">Company</th>
            </tr></thead>
            <tbody>${initialWitnesses.map(w => `<tr>
              <td class="td">${nameCell(w.name)}</td>
              <td class="td">${w.jobRole || "—"}</td>
              <td class="td">${w.company || "—"}</td>
            </tr>`).join("")}</tbody>
          </table>`
        : '<p class="empty">No witnesses recorded</p>';

      const equipRows = invEquipment.filter(e => e.type || e.makeModel || e.serialNo || e.lastInspection).length > 0
        ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">
            <thead><tr>
              <th class="th">Type</th><th class="th">Make / Model</th><th class="th">Serial / Reg. No.</th><th class="th">Last Inspection</th>
            </tr></thead>
            <tbody>${invEquipment.filter(e => e.type || e.makeModel || e.serialNo || e.lastInspection).map(e => `<tr>
              <td class="td">${e.type || "—"}</td>
              <td class="td">${e.makeModel || "—"}</td>
              <td class="td">${e.serialNo || "—"}</td>
              <td class="td">${e.lastInspection || "—"}</td>
            </tr>`).join("")}</tbody>
          </table>`
        : "";

      const docsReviewed = Array.isArray(incident.invDocumentsReviewed) && incident.invDocumentsReviewed.length > 0
        ? incident.invDocumentsReviewed.map((d: string) => `<span class="pill">${d}</span>`).join("")
        : '<span class="empty">None recorded</span>';

      const causePills = Array.isArray(incident.incidentCause) && incident.incidentCause.length > 0
        ? incident.incidentCause.map((c: string) => `<span class="pill">${c}</span>`).join("")
        : '<span class="empty">None recorded</span>';

      const effectPills = Array.isArray(incident.incidentEffect) && incident.incidentEffect.length > 0
        ? incident.incidentEffect.map((e: string) => `<span class="pill">${e}</span>`).join("")
        : '<span class="empty">None recorded</span>';

      const immediateActionsHtml = incident.immediateActions?.trim()
        ? incident.immediateActions.split("\n").filter(Boolean).map((line: string) => `<li style="font-size:13px;line-height:1.7;margin-bottom:3px;color:#111827">${line.trim()}</li>`).join("")
        : null;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Investigation Report – ${incident.incidentReference}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#111827;background:#f9fafb;padding:24px}
  .page{max-width:820px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
  .header{background:#1e293b;color:#fff;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start}
  .header h1{font-size:20px;font-weight:700;letter-spacing:-.3px}
  .header .meta{text-align:right;font-size:12px;opacity:.85;line-height:1.6}
  .ref-badge{display:inline-block;background:#fff;color:#1e293b;font-weight:700;font-size:13px;padding:4px 12px;border-radius:4px;margin-top:6px}
  .accent-banner{padding:10px 32px;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#fff;background:#16a34a}
  .body{padding:24px 32px}
  section{margin-bottom:24px}
  section h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  td{padding:7px 0;vertical-align:top;border-bottom:1px solid #f3f4f6;font-size:13px}
  td.label{width:210px;color:#6b7280;font-weight:500;padding-right:16px;white-space:nowrap}
  td.value{color:#111827;line-height:1.5}
  .empty{color:#9ca3af;font-style:italic}
  .redacted{color:#b91c1c;font-style:italic;background:#fef2f2;border-radius:3px;padding:0 5px;font-size:12px}
  .pill{display:inline-block;background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;border-radius:99px;padding:2px 10px;font-size:12px;margin:2px 3px 2px 0}
  .th{text-align:left;font-size:11px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;padding:6px 8px;background:#f9fafb}
  .td{padding:6px 8px;font-size:12px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:0 32px}
  .footer{border-top:1px solid #e5e7eb;padding:14px 32px;background:#f9fafb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
  .part-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#fff;background:#334155;padding:5px 12px;border-radius:4px;display:inline-block;margin-bottom:16px}
  @media print{
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{background:#fff;padding:0}
    .page{border:none;border-radius:0;max-width:100%}
    .header{background:#1e293b !important;color:#fff !important}
    .accent-banner{background:#16a34a !important;color:#fff !important}
  }
</style>
</head>
<body>
<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 400);
  });
</script>
<div class="page">
  <div class="header">
    <div>
      <div style="font-size:11px;opacity:.7;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Guardian Group</div>
      <h1>Follow Up Investigation Report</h1>
      <div class="ref-badge">${incident.incidentReference}</div>
    </div>
    <div class="meta">
      <div>${companyName}</div>
      <div>${siteName}</div>
      ${incident.invCompletedAt ? `<div>Completed: <strong>${fmt(incident.invCompletedAt)}</strong></div>` : ""}
      ${incident.invCompletedBy ? `<div>Completed by: <strong>${incident.invCompletedBy}</strong></div>` : ""}
      <div style="margin-top:4px;font-size:11px;opacity:.65">Generated ${new Date().toLocaleString("en-GB")}</div>
    </div>
  </div>
  <div class="accent-banner">Follow Up Investigation – ${incident.title}</div>
  <div class="body">

    <div class="part-label">Part 1 — Initial Incident Report</div>

    <section>
      <h2>Incident Overview</h2>
      <table>
        ${field("Incident Type", incident.incidentType || "—")}
        ${incident.incidentNature ? field("Nature of Incident", incident.incidentNature) : ""}
        ${field("Date of Incident", fmt(incident.incidentDate))}
        ${incident.incidentTime ? field("Time of Incident", incident.incidentTime) : ""}
        ${field("Location", textVal(incident.locationDetails))}
      </table>
    </section>

    <section>
      <h2>Description of Incident</h2>
      <p style="font-size:13px;line-height:1.7;color:#111827">${incident.description ? incident.description.replace(/\n/g, "<br>") : '<span class="empty">Not provided</span>'}</p>
    </section>

    <section>
      <h2>Cause, Effect &amp; Equipment</h2>
      <table>
        <tr><td class="label">Cause(s)</td><td class="value">${causePills}</td></tr>
        <tr><td class="label">Effect / Affect</td><td class="value">${effectPills}</td></tr>
        ${field("Machinery / Equipment", textVal(incident.machineryInvolved))}
      </table>
    </section>

    <section>
      <h2>Injured / Affected Person</h2>
      <table>
        ${field("First Aid Given", boolVal(incident.invFirstAidGiven))}
        ${field("Hospital Visit Required", boolVal(incident.invHospitalVisit))}
        ${field("Injuries Reported", boolVal(incident.injuriesReported))}
        ${incident.injuryDetails ? field("Injury Details", textVal(incident.injuryDetails)) : ""}
        ${bodyZones.length > 0 ? field("Body Areas Affected", bodyZones.join(", ")) : ""}
        ${field("Name", textVal(incident.affectedPersonName))}
        ${incident.affectedPersonJobTitle ? field(incident.affectedPersonIsPublic ? "Role / Occupation" : "Job Title", incident.affectedPersonJobTitle) : ""}
        ${incident.affectedPersonAddress ? field("Address", textVal(incident.affectedPersonAddress)) : ""}
      </table>
    </section>

    ${immediateActionsHtml ? `<section>
      <h2>Immediate Actions Taken</h2>
      <ul style="margin:0;padding-left:20px">${immediateActionsHtml}</ul>
    </section>` : ""}

    <section>
      <h2>Witnesses (Initial Report)</h2>
      ${initialWitnessRows}
    </section>

    <div class="part-label" style="margin-top:24px">Part 2 — Follow Up Investigation</div>
    ${incident.invCompletedAt ? `<p style="font-size:12px;color:#6b7280;margin-bottom:16px">Completed ${fmt(incident.invCompletedAt)}${incident.invCompletedBy ? ` by ${incident.invCompletedBy}` : ""}</p>` : ""}

    <section>
      <h2>About the Injured Person</h2>
      <table>
        ${field("First Aid Given", boolVal(incident.invFirstAidGiven))}
        ${field("Hospital Visit Required", boolVal(incident.invHospitalVisit))}
        ${field("Absent from Work", boolVal(incident.invAbsentFromWork))}
        ${incident.invAbsentFromWork ? field("Absence Timeframe", textVal(incident.invAbsentTimeframe)) : ""}
      </table>
      ${(incident.incidentNature || incident.injuriesReported !== null || incident.injuryDetails) ? `
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin:10px 0 4px">From Initial Report</p>
      <table>
        ${incident.incidentNature ? field("Nature of Incident", incident.incidentNature) : ""}
        ${field("Injuries Reported", boolVal(incident.injuriesReported))}
        ${incident.injuryDetails ? field("Injury Details", textVal(incident.injuryDetails)) : ""}
      </table>` : ""}
    </section>

    <section>
      <h2>Witnesses (Investigation)</h2>
      <table>
        ${field("Witnesses Present", boolVal(incident.invWitnessesPresent))}
      </table>
      ${incident.invWitnessesPresent ? witnessRows : ""}
    </section>

    <section>
      <h2>Equipment Involved (Investigation)</h2>
      <table>
        ${field("Equipment Involved", boolVal(incident.invEquipmentInvolved))}
        ${incident.invEquipmentInvolved ? field("Operators", textVal(incident.invOperators)) : ""}
        ${incident.invEquipmentInvolved ? field("Operators Qualified", boolVal(incident.invOperatorsQualified)) : ""}
        ${incident.invEquipmentInvolved === null && incident.machineryInvolved ? field("Equipment (from initial report)", incident.machineryInvolved) : ""}
      </table>
      ${incident.invEquipmentInvolved ? equipRows : ""}
    </section>

    <section>
      <h2>Documents Used / Reviewed</h2>
      <div style="margin-bottom:8px">${docsReviewed}</div>
      <table>
        ${incident.invDocumentsOther ? field("Other Documents", textVal(incident.invDocumentsOther)) : ""}
        ${incident.invDocumentsComments ? field("Comments", textVal(incident.invDocumentsComments)) : ""}
      </table>
    </section>

    <section>
      <h2>Investigation Findings</h2>
      <table>
        ${field("Contributing Factors &amp; Timeline", textVal(incident.invContributingFactors))}
        ${field("Primary Cause", textVal(incident.invPrimaryCause))}
        ${field("Root Cause Analysis", textVal(incident.invRootCause))}
      </table>
    </section>

    <section>
      <h2>Actions</h2>
      ${(() => {
        let acts: string[] = [];
        try { if (incident.invActions) acts = JSON.parse(incident.invActions); } catch {}
        return acts.length > 0
          ? `<ol style="margin:0;padding-left:20px">${acts.map((a: string) => `<li style="font-size:13px;line-height:1.7;margin-bottom:4px;color:#111827">${a}</li>`).join("")}</ol>`
          : `<p style="font-size:13px;color:#9ca3af;font-style:italic">None recorded</p>`;
      })()}
    </section>

    <section>
      <h2>Recommendations</h2>
      ${(() => {
        let recs: string[] = [];
        try { if (incident.invRecommendations) recs = JSON.parse(incident.invRecommendations); } catch {}
        return recs.length > 0
          ? `<ol style="margin:0;padding-left:20px">${recs.map((r: string) => `<li style="font-size:13px;line-height:1.7;margin-bottom:4px;color:#111827">${r}</li>`).join("")}</ol>`
          : `<p style="font-size:13px;color:#9ca3af;font-style:italic">None recorded</p>`;
      })()}
    </section>

    <section>
      <h2>Conclusion</h2>
      <p style="font-size:13px;line-height:1.7;color:#111827">${textVal(incident.invConclusion)}</p>
    </section>

    <section>
      <h2>Amendments / Corrections to Initial Report</h2>
      ${incident.invAmendments
        ? `<p style="font-size:13px;line-height:1.7;color:#111827;white-space:pre-wrap">${incident.invAmendments}</p>`
        : `<p style="font-size:13px;color:#9ca3af;font-style:italic">None recorded</p>`}
    </section>

    <section>
      <h2>RIDDOR</h2>
      <table>
        ${field("RIDDOR Reportable", incident.riddorReportable ? '<span style="color:#dc2626;font-weight:600">Yes</span>' : "No")}
        ${field("Responsible Person", textVal(incident.riddorResponsiblePerson))}
        ${field("RIDDOR Reference", textVal(incident.riddorReference))}
        ${incident.riddorNotes ? field("RIDDOR Notes", textVal(incident.riddorNotes)) : ""}
      </table>
    </section>

  </div>
  <div class="footer">
    <span>Follow-up investigation report. Generated ${new Date().toLocaleString("en-GB")}.</span>
    <span>${incident.incidentReference} &bull; Confidential</span>
  </div>
</div>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="Investigation_Report_${incident.incidentReference}.pdf"`);
      res.send(html);
    } catch (error) {
      console.error("Error generating investigation report:", error);
      res.status(500).json({ error: "Failed to generate investigation report" });
    }
  });

  app.get("/api/incidents/:id/milestones", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });
      const canAccess = await canUserAccessSite(user, incident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const milestones = await storage.getIncidentMilestones(req.params.id);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching incident milestones:", error);
      res.status(500).json({ error: "Failed to fetch milestones" });
    }
  });

  app.post("/api/incidents/:id/milestones", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const { title, description, dueDate } = req.body;
      if (!title) return res.status(400).json({ error: "Title is required" });

      const incident = await storage.getIncident(req.params.id);

      const milestone = await storage.createIncidentMilestone({
        incidentId: req.params.id,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        isCompleted: false,
        createdBy: user.id,
      });

      if (incident) {
        await storage.createAuditLog({
          action: "milestone_added",
          userId: user.id,
          userName: user.fullName,
          entityId: incident.entityId,
          module: "health_safety",
          details: `Action item "${title}" added to ${incident.incidentReference}`,
          incidentId: incident.id,
        } as any);
        await emitSiteScoped("incident-updated", incident.siteId, incident.entityId, { incidentId: incident.id });
      }

      res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(500).json({ error: "Failed to create milestone" });
    }
  });

  app.patch("/api/milestones/incident/:id", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const existing = await storage.getIncidentMilestone(req.params.id);
      if (!existing) return res.status(404).json({ error: "Milestone not found" });
      const parentIncident = await storage.getIncident(existing.incidentId);
      if (!parentIncident) return res.status(404).json({ error: "Incident not found" });
      const canAccess = await canUserAccessSite(user, parentIncident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const updates = req.body;
      if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);
      if (updates.completedDate) updates.completedDate = new Date(updates.completedDate);
      const milestone = await storage.updateIncidentMilestone(req.params.id, updates);
      if (!milestone) return res.status(404).json({ error: "Milestone not found" });

      if (updates.isCompleted && milestone.incidentId) {
        const incident = await storage.getIncident(milestone.incidentId);
        if (incident) {
          // Auto-close the incident when the "Close the incident" action item is completed
          const isClosingAction = milestone.title.trim().toLowerCase().startsWith("close the incident");
          if (isClosingAction && incident.status !== "closed") {
            await storage.updateIncident(incident.id, { status: "closed" });
            await storage.createAuditLog({
              action: "incident_status_changed",
              userId: user.id,
              userName: user.fullName,
              entityId: incident.entityId,
              module: "health_safety",
              details: `Status changed from "${incident.status}" to "closed" on ${incident.incidentReference} (Close the incident action completed)`,
              incidentId: incident.id,
            } as any);
          }
          await storage.createAuditLog({
            action: "milestone_completed",
            userId: user.id,
            userName: user.fullName,
            entityId: incident.entityId,
            module: "health_safety",
            details: `Action item "${milestone.title}" marked as completed on ${incident.incidentReference}`,
            incidentId: incident.id,
          } as any);
        }
      }

      // Emit after all downstream mutations (incl. any auto-close status change)
      // so listeners refetch the final incident state.
      await emitSiteScoped("incident-updated", parentIncident.siteId, parentIncident.entityId, { incidentId: parentIncident.id });

      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  app.delete("/api/milestones/incident/:id", requireAuth, async (req, res) => {
    try {
      const existingMilestone = await storage.getIncidentMilestone(req.params.id);
      await storage.deleteIncidentMilestone(req.params.id);
      if (existingMilestone?.incidentId) {
        const parentIncident = await storage.getIncident(existingMilestone.incidentId).catch(() => null);
        if (parentIncident) await emitSiteScoped("incident-updated", parentIncident.siteId, parentIncident.entityId, { incidentId: parentIncident.id });
      }
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

  // Delete an incident (admin only) — cascades all related data
  app.delete("/api/incidents/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      if (user.role !== "developer") return res.status(403).json({ error: "Only developers can delete incidents" });

      const incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const incidentId = req.params.id;
        await client.query(`DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE incident_id = $1)`, [incidentId]);
        await client.query(`DELETE FROM documents WHERE incident_id = $1`, [incidentId]);
        await client.query(`DELETE FROM incident_milestones WHERE incident_id = $1`, [incidentId]);
        await client.query(`DELETE FROM incidents WHERE id = $1`, [incidentId]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      await storage.createAuditLog({
        action: "incident_deleted",
        userId: user.id,
        userName: user.fullName,
        entityId: incident.siteId,
        incidentId: incident.id,
        module: "health_safety",
        details: `Incident ${incident.incidentReference} ("${incident.title}") permanently deleted by ${user.fullName}`,
      });

      await emitSiteScoped("incident-updated", incident.siteId, incident.entityId, { incidentId: incident.id, deleted: true });

      res.status(204).end();
    } catch (error) {
      console.error("Delete incident error:", error);
      res.status(500).json({ error: "Failed to delete incident" });
    }
  });

  app.get("/api/incidents/:id/audit", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });

      const canAccess = await canUserAccessSite(user, incident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const allLogs = await storage.getAuditLogs(undefined, "health_safety");
      const logs = allLogs.filter((log: any) => log.incidentId === req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Get incident audit error:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/incidents/:id/documents", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });
      const canAccess = await canUserAccessSite(user, incident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const docs = await storage.getIncidentDocuments(req.params.id);
      const enriched = await Promise.all(docs.map(async (doc) => {
        const uploader = await storage.getUser(doc.uploadedBy);
        return { ...doc, uploadedByName: uploader?.fullName || "Unknown" };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching incident documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.post("/api/incidents/:id/documents", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      const incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });
      const canAccess = await canUserAccessSite(user, incident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const { title, fileName, fileUrl, fileSize, mimeType } = req.body;
      if (!title || !fileName || !fileUrl) {
        return res.status(400).json({ error: "Missing required fields: title, fileName, fileUrl" });
      }

      const document = await storage.createDocument({
        title,
        comments: req.body.comments ?? null,
        module: "health_safety",
        type: "incident_report",
        entityId: incident.entityId,
        siteId: incident.siteId,
        incidentId: incident.id,
        folderId: incident.folderId,
        fileName,
        fileUrl,
        fileSize: fileSize || 0,
        mimeType: mimeType || "application/octet-stream",
        uploadedBy: user.id,
        status: "compliant",
        approvalStatus: "approved",
        source: "upload",
      });

      await storage.createAuditLog({
        action: "document_uploaded",
        userId: user.id,
        userName: user.fullName,
        entityId: incident.entityId,
        documentId: document.id,
        module: "health_safety",
        details: `"${title}" uploaded to ${incident.incidentReference}`,
        incidentId: incident.id,
      } as any);

      await emitDocumentUpdated(document, { documentId: document.id, incidentId: incident.id });
      await emitSiteScoped("incident-updated", incident.siteId, incident.entityId, { incidentId: incident.id });

      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading incident document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // ─── Incident document PATCH & DELETE (all roles with site access) ───────────

  app.patch("/api/incidents/:incidentId/documents/:docId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      const incident = await storage.getIncident(req.params.incidentId);
      if (!incident) return res.status(404).json({ error: "Incident not found" });
      const canAccess = await canUserAccessSite(user, incident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const doc = await storage.getDocument(req.params.docId);
      if (!doc || doc.incidentId !== incident.id) return res.status(404).json({ error: "Document not found" });
      const { title, comments } = req.body;
      const updated = await storage.updateDocument(req.params.docId, { title, comments });
      await emitDocumentUpdated(doc, { documentId: doc.id, incidentId: incident.id });
      await emitSiteScoped("incident-updated", incident.siteId, incident.entityId, { incidentId: incident.id });
      res.json(updated);
    } catch (error) {
      console.error("Error updating incident document:", error);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  app.delete("/api/incidents/:incidentId/documents/:docId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      const incident = await storage.getIncident(req.params.incidentId);
      if (!incident) return res.status(404).json({ error: "Incident not found" });
      const canAccess = await canUserAccessSite(user, incident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const doc = await storage.getDocument(req.params.docId);
      if (!doc || doc.incidentId !== incident.id) return res.status(404).json({ error: "Document not found" });
      await storage.deleteDocument(req.params.docId);
      await storage.createAuditLog({
        action: "document_deleted",
        userId: user.id,
        userName: user.fullName,
        entityId: incident.entityId,
        documentId: null,
        module: "health_safety",
        details: `"${doc.title}" deleted from ${incident.incidentReference}`,
        incidentId: incident.id,
      } as any);
      await emitDocumentUpdated(doc, { documentId: doc.id, incidentId: incident.id, deleted: true });
      await emitSiteScoped("incident-updated", incident.siteId, incident.entityId, { incidentId: incident.id });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting incident document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // ─── Calendar Events ──────────────────────────────────────────────────────────

  app.get("/api/calendar/events", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const { start, end, siteId: siteFilter, companyId: companyFilter, module: moduleFilter } = req.query as Record<string, string>;

      const startDate = start ? new Date(start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endDate = end ? new Date(end) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

      // Determine allowed site IDs based on role
      let allowedSiteIds: string[] | null = null;
      if (user.role === "client") {
        const clientSites = await storage.getClientSites(user.id);
        allowedSiteIds = clientSites.map((a: any) => a.siteId);
      } else if (user.role === "consultant" && user.consultantTier !== "pro") {
        const consultantSites = await storage.getConsultantSites(user.id);
        allowedSiteIds = consultantSites.map((a: any) => a.siteId);
      }

      const canAccess = (siteId: string | null | undefined): boolean => {
        if (!siteId) return false;
        if (allowedSiteIds !== null && !allowedSiteIds.includes(siteId)) return false;
        if (siteFilter && siteId !== siteFilter) return false;
        return true;
      };

      // Load company→site map for companyFilter
      let companySiteIds: string[] | null = null;
      if (companyFilter) {
        const companySites = await storage.getSitesByCompanyId(companyFilter);
        companySiteIds = companySites.map((s: any) => s.id);
      }

      const inDateRange = (d: Date | null | undefined): boolean => {
        if (!d) return false;
        return d >= startDate && d <= endDate;
      };

      const events: any[] = [];
      const now = new Date();

      // ── Documents ──────────────────────────────────────────────────────────
      if (!moduleFilter || ["health_safety", "human_resources", "employment_law", "training"].includes(moduleFilter)) {
        const allDocs = await storage.getDocuments(undefined, false);

        // Helper: can we include this document on the calendar?
        // Site-scoped docs use the standard canAccess check.
        // Company-scoped docs (siteId = null) are shown to admins when no site/company filter is active.
        const canAccessDoc = (doc: any): boolean => {
          if (doc.siteId) {
            if (!canAccess(doc.siteId)) return false;
            if (companySiteIds && !companySiteIds.includes(doc.siteId)) return false;
            return true;
          }
          // Company-scoped document
          if (siteFilter) return false; // specific site requested — skip
          if (companySiteIds) return false; // company filter works through sites — skip
          return allowedSiteIds === null; // admins only
        };

        const moduleDocUrlBase: Record<string, string> = {
          health_safety: "/health-safety/documents",
          human_resources: "/human-resources/documents",
          employment_law: "/employment-law/documents",
        };

        for (const doc of allDocs) {
          if (!canAccessDoc(doc)) continue;
          if (moduleFilter && doc.module !== moduleFilter) continue;

          // training has no /training/documents/:id route, so fall back to /training
          const docUrl = moduleDocUrlBase[doc.module]
            ? `${moduleDocUrlBase[doc.module]}/${doc.id}${doc.siteId ? `?siteId=${doc.siteId}` : ""}`
            : "/training";

          if (doc.expiryDate && inDateRange(new Date(doc.expiryDate))) {
            events.push({ id: `doc-expiry-${doc.id}`, title: `Expiry: ${doc.title}`, date: doc.expiryDate, type: "expiry", module: doc.module, siteId: doc.siteId, url: docUrl, isOverdue: new Date(doc.expiryDate) < now });
          }
          if (doc.renewalDate && inDateRange(new Date(doc.renewalDate))) {
            events.push({ id: `doc-renewal-${doc.id}`, title: `Renewal: ${doc.title}`, date: doc.renewalDate, type: "renewal_due", module: doc.module, siteId: doc.siteId, url: docUrl, isOverdue: new Date(doc.renewalDate) < now });
          }
        }
      }

      // ── Case deadlines ─────────────────────────────────────────────────────
      // Consultants must have caseAdvocate permission to see EL case events.
      // Clients see events only for their allowed sites (enforced by canAccess).
      // Admins see all.
      const canSeeELCases =
        user.role === "developer" ||
        user.role === "client" ||
        ((user.role === "consultant" || user.role === "administrator") &&
          !!(user.consultantPermissions as { caseAdvocate?: boolean } | null)?.caseAdvocate);

      if (canSeeELCases && (!moduleFilter || moduleFilter === "employment_law")) {
        const allCases = await storage.getCases({ includeArchived: false });
        for (const c of allCases) {
          if (!canAccess(c.siteId)) continue;
          if (companySiteIds && (!c.siteId || !companySiteIds.includes(c.siteId))) continue;
          if (c.responseDeadline && inDateRange(new Date(c.responseDeadline))) {
            events.push({ id: `case-deadline-${c.id}`, title: `Deadline: ${c.caseReference} – ${c.employeeName}`, date: c.responseDeadline, type: "case_deadline", module: "employment_law", siteId: c.siteId, url: `/employment-law/cases/${c.id}`, isOverdue: new Date(c.responseDeadline) < now });
          }
          if (c.hearingDate && inDateRange(new Date(c.hearingDate))) {
            events.push({ id: `case-hearing-${c.id}`, title: `Hearing: ${c.caseReference} – ${c.employeeName}`, date: c.hearingDate, type: "case_deadline", module: "employment_law", siteId: c.siteId, url: `/employment-law/cases/${c.id}`, isOverdue: new Date(c.hearingDate) < now });
          }
        }

        // Case milestones — load all cases first, then their milestones
        for (const c of allCases) {
          if (!canAccess(c.siteId)) continue;
          if (companySiteIds && (!c.siteId || !companySiteIds.includes(c.siteId))) continue;
          const milestones = await storage.getCaseMilestones(c.id);
          for (const m of milestones) {
            if (m.isCompleted) continue;
            if (m.dueDate && inDateRange(new Date(m.dueDate))) {
              events.push({ id: `case-milestone-${m.id}`, title: `Milestone: ${m.title} (${c.caseReference})`, date: m.dueDate, type: "milestone_due", module: "employment_law", siteId: c.siteId, url: `/employment-law/cases/${c.id}`, isOverdue: new Date(m.dueDate) < now });
            }
          }
        }
      }

      // ── Incident action milestones ─────────────────────────────────────────
      if (!moduleFilter || moduleFilter === "health_safety") {
        const allIncidents = await storage.getIncidents({});
        for (const inc of allIncidents) {
          if (!canAccess(inc.siteId)) continue;
          if (companySiteIds && !companySiteIds.includes(inc.siteId)) continue;
          const milestones = await storage.getIncidentMilestones(inc.id);
          for (const m of milestones) {
            if (m.isCompleted) continue;
            if (m.dueDate && inDateRange(new Date(m.dueDate))) {
              events.push({ id: `incident-action-${m.id}`, title: `Action: ${m.title} (${inc.incidentReference})`, date: m.dueDate, type: "action_due", module: "health_safety", siteId: inc.siteId, url: `/health-safety/incidents/${inc.id}`, isOverdue: new Date(m.dueDate) < now });
            }
          }
        }
      }

      // ── Training bookings & requests ───────────────────────────────────────
      if (!moduleFilter || moduleFilter === "training") {
        // Batch-load course names to avoid N+1
        const courseCache: Record<string, string> = {};
        const resolveCourse = async (courseId: string): Promise<string> => {
          if (courseCache[courseId] === undefined) {
            const course = await storage.getTrainingCourse(courseId);
            courseCache[courseId] = course?.title ?? "Training Session";
          }
          return courseCache[courseId];
        };

        // New booking system: show scheduled date for active bookings
        const allBookings = await storage.getTrainingBookings({ status: "booked" });
        for (const booking of allBookings) {
          if (!canAccess(booking.siteId)) continue;
          if (companySiteIds && !companySiteIds.includes(booking.siteId)) continue;
          if (!booking.scheduledDate) continue;
          if (!inDateRange(new Date(booking.scheduledDate))) continue;
          const courseName = await resolveCourse(booking.trainingCourseId);
          events.push({
            id: `training-booking-${booking.id}`,
            title: `Training: ${courseName}`,
            date: booking.scheduledDate,
            type: "training_renewal",
            module: "training",
            siteId: booking.siteId,
            url: `/training`,
            isOverdue: new Date(booking.scheduledDate) < now,
          });
        }

        // Legacy training requests: show scheduled date (booked) and renewal due date (all statuses)
        const allRequests = await storage.getTrainingRequests();
        for (const req of allRequests) {
          if (!canAccess(req.siteId)) continue;
          if (companySiteIds && !companySiteIds.includes(req.siteId)) continue;
          const courseName = await resolveCourse(req.trainingCourseId);
          if (req.status === "booked" && req.scheduledDate && inDateRange(new Date(req.scheduledDate))) {
            events.push({
              id: `training-request-scheduled-${req.id}`,
              title: `Training: ${courseName}`,
              date: req.scheduledDate,
              type: "training_renewal",
              module: "training",
              siteId: req.siteId,
              url: `/training`,
              isOverdue: new Date(req.scheduledDate) < now,
            });
          }
          if (req.renewalDate && inDateRange(new Date(req.renewalDate))) {
            events.push({
              id: `training-request-renewal-${req.id}`,
              title: `Re-training Due: ${courseName}`,
              date: req.renewalDate,
              type: "renewal_due",
              module: "training",
              siteId: req.siteId,
              url: `/training`,
              isOverdue: new Date(req.renewalDate) < now,
            });
          }
        }
      }

      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });

  // ==================== CLIENT UPLOADS ====================

  app.get("/api/client-upload-folders", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const { module, siteId } = req.query as { module?: string; siteId?: string };
      if (!module) return res.status(400).json({ error: "module is required" });

      await storage.cleanupExpiredFolders();

      const effectiveCompanyIds = user.role === "client" && user.companyId
        ? [...(await getEffectiveCompanyIds(user.companyId))]
        : undefined;

      const folders = await storage.getClientUploadFolders({
        module,
        siteId,
        userId: user.id,
        userRole: user.role,
        userCompanyId: user.companyId,
        effectiveCompanyIds,
      });
      res.json(folders);
    } catch (error) {
      console.error("Error fetching client upload folders:", error);
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  app.post("/api/client-upload-folders", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const body = req.body;
      const { name, description, module, siteId, allocatedClientId } = body;

      if (!name || !module || !siteId) {
        return res.status(400).json({ error: "name, module, and siteId are required" });
      }

      const canAccess = await canUserAccessSite(user, siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied to this site" });

      // Folder expiry is a long-running safety-net; actual deletion is driven by file-level expiry
      const expiresAt = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000);

      const effectiveAllocatedClientId =
        user.role === "client" ? user.id : allocatedClientId ?? null;

      const folder = await storage.createClientUploadFolder({
        name,
        description: description ?? null,
        module,
        siteId,
        createdByUserId: user.id,
        allocatedClientId: effectiveAllocatedClientId,
        expiresAt,
      });

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "client_folder_created",
        resourceType: "client_upload_folder",
        resourceId: folder.id,
        details: `Created upload folder "${name}" in module ${module}`,
        siteId,
      });

      // Notify client(s) when a consultant/admin creates a folder — per-site cooldown
      if (user.role !== "client") {
        try {
          const lastNotified = cloudUploadNotifiedAt.get(siteId);
          const cooldownExpired = !lastNotified || (Date.now() - lastNotified.getTime()) > CLOUD_UPLOAD_NOTIFY_COOLDOWN_MS;
          if (cooldownExpired) {
            const site = await storage.getSite(siteId);
            const baseUrl = req.headers.origin || `${req.protocol}://${req.get("host")}`;
            const modulePath = module === "health_safety" ? "health-safety"
              : module === "human_resources" ? "human-resources"
              : module === "employment_law" ? "employment-law"
              : "cloud-share";
            const portalUrl = `${baseUrl}/${modulePath}/cloud-share`;

            const recipients: { id: string; email: string; fullName: string; role: string | null }[] = [];
            if (effectiveAllocatedClientId) {
              const allocatedClient = await storage.getUser(effectiveAllocatedClientId);
              if (allocatedClient && allocatedClient.email && allocatedClient.status === "active") {
                recipients.push({ id: allocatedClient.id, email: allocatedClient.email, fullName: allocatedClient.fullName, role: allocatedClient.role });
              }
            } else {
              const siteUsers = await storage.getUsersBySite(siteId);
              for (const u of siteUsers.filter(u => u.role === "client" && u.email && u.status === "active")) {
                recipients.push({ id: u.id, email: u.email!, fullName: u.fullName, role: u.role });
              }
            }

            for (const recipient of recipients) {
              try {
                await sendCloudUploadNotificationEmail({
                  to: recipient.email,
                  fullName: recipient.fullName,
                  uploaderName: user.fullName,
                  folderName: name,
                  siteName: site?.name || "Unknown Site",
                  portalUrl,
                  role: "client",
                  isNewFolder: true,
                });
                await storage.createAuditLog({
                  action: "email_sent", userId: user.id, userName: user.fullName,
                  entityId: siteId, module,
                  details: `Cloud share folder creation notification sent to ${recipient.fullName} (${recipient.email})`,
                  metadata: JSON.stringify({ targetUserId: recipient.id, emailType: "cloud_upload_folder_notification" }),
                });
              } catch (e) { console.error(`Failed to send folder creation notification to ${recipient.id}:`, e); }
            }

            if (recipients.length > 0) cloudUploadNotifiedAt.set(siteId, new Date());
          }
        } catch (err) {
          console.error("Failed to send folder creation notifications:", err);
        }
      }

      // Notify relevant users in real time so the folder list updates without a refresh
      try {
        const csPayload = { folderId: folder.id };
        if (folder.allocatedClientId) {
          emitToUser(folder.allocatedClientId, "cloud-share-updated", csPayload);
        }
        emitToRole("developer", "cloud-share-updated", csPayload);
        emitToRole("consultant", "cloud-share-updated", csPayload);
        emitToRole("administrator", "cloud-share-updated", csPayload);
      } catch { /* non-fatal */ }

      res.status(201).json(folder);
    } catch (error) {
      console.error("Error creating client upload folder:", error);
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  app.delete("/api/client-upload-folders/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const folder = await storage.getClientUploadFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });

      if (user.role === "client") {
        // Clients may only delete folders they own (allocated to them)
        if (folder.allocatedClientId !== user.id) {
          return res.status(403).json({ error: "You can only delete folders that belong to you" });
        }
      } else {
        const canAccess = await canUserAccessFolder(user, folder);
        if (!canAccess) return res.status(403).json({ error: "Access denied" });
      }

      const files = await storage.getClientUploads(folder.id);
      const objectStorageService = new ObjectStorageService();
      for (const file of files) {
        try {
          await objectStorageService.deleteObjectEntityFile(file.fileUrl);
        } catch {}
      }

      // Capture access grants before deletion so we can still notify those users
      const folderAccessGrants = await storage.getClientUploadFolderAccess(folder.id);

      await storage.deleteClientUploadFolder(folder.id);

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "client_folder_deleted",
        resourceType: "client_upload_folder",
        resourceId: folder.id,
        details: `Deleted upload folder "${folder.name}" and ${files.length} file(s)`,
        siteId: folder.siteId,
      });

      try {
        const csPayload = { folderId: folder.id };
        for (const access of folderAccessGrants) {
          emitToUser(access.userId, "cloud-share-updated", csPayload);
        }
        if (folder.allocatedClientId) {
          emitToUser(folder.allocatedClientId, "cloud-share-updated", csPayload);
        }
        emitToRole("developer", "cloud-share-updated", csPayload);
        emitToRole("consultant", "cloud-share-updated", csPayload);
        emitToRole("administrator", "cloud-share-updated", csPayload);
      } catch { /* non-fatal */ }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client upload folder:", error);
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  app.get("/api/client-upload-folders/:id/access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const folder = await storage.getClientUploadFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const grants = await storage.getClientUploadFolderAccess(folder.id);
      res.json(grants);
    } catch (error) {
      console.error("Error fetching folder access:", error);
      res.status(500).json({ error: "Failed to fetch access" });
    }
  });

  app.post("/api/client-upload-folders/:id/access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const folder = await storage.getClientUploadFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });

      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });
      if (targetUser.role !== "client") return res.status(400).json({ error: "Can only grant access to client users" });

      const site = await storage.getSite(folder.siteId);
      if (!site || targetUser.companyId !== site.companyId) {
        return res.status(400).json({ error: "User must be from the same company as the folder's site" });
      }

      await storage.grantClientUploadFolderAccess(folder.id, userId, user.id);

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "client_folder_access_granted",
        resourceType: "client_upload_folder",
        resourceId: folder.id,
        details: `Granted access to "${targetUser.fullName}" for folder "${folder.name}"`,
        siteId: folder.siteId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error granting folder access:", error);
      res.status(500).json({ error: "Failed to grant access" });
    }
  });

  app.delete("/api/client-upload-folders/:id/access/:userId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const folder = await storage.getClientUploadFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const { userId } = req.params;
      if (folder.allocatedClientId === userId) {
        return res.status(400).json({ error: "Cannot revoke access from the allocated client" });
      }

      const targetUser = await storage.getUser(userId);
      await storage.revokeClientUploadFolderAccess(folder.id, userId);

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "client_folder_access_revoked",
        resourceType: "client_upload_folder",
        resourceId: folder.id,
        details: `Revoked access from "${targetUser?.fullName ?? userId}" for folder "${folder.name}"`,
        siteId: folder.siteId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking folder access:", error);
      res.status(500).json({ error: "Failed to revoke access" });
    }
  });

  app.get("/api/client-upload-folders/:id/grantable-users", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const folder = await storage.getClientUploadFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const users = await storage.getGrantableUsers(folder.id);
      res.json(users);
    } catch (error) {
      console.error("Error fetching grantable users:", error);
      res.status(500).json({ error: "Failed to fetch grantable users" });
    }
  });

  app.get("/api/client-upload-folders/:folderId/files", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const folder = await storage.getClientUploadFolder(req.params.folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const files = await storage.getClientUploads(folder.id);
      res.json(files);
    } catch (error) {
      console.error("Error fetching folder files:", error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.post("/api/client-uploads", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const { folderId, fileName, fileSize, fileUrl, description } = req.body;
      if (!folderId || !fileName || !fileSize || !fileUrl) {
        return res.status(400).json({ error: "folderId, fileName, fileSize, and fileUrl are required" });
      }
      const folder = await storage.getClientUploadFolder(folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });

      const now = new Date();
      if (folder.expiresAt < now) {
        return res.status(400).json({ error: "This folder has expired" });
      }

      const canAccess = await canUserAccessFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const fileExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const upload = await storage.createClientUpload({
        folderId,
        module: folder.module,
        siteId: folder.siteId,
        uploadedByUserId: user.id,
        fileName,
        fileSize,
        fileUrl,
        description: description ?? null,
        expiresAt: fileExpiresAt,
      });

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "client_upload_uploaded",
        resourceType: "client_upload",
        resourceId: upload.id,
        details: `Uploaded file "${fileName}" to folder "${folder.name}"`,
        siteId: folder.siteId,
      });

      // Emit cloud-share-updated so all folder-access users see new files in real time
      try {
        const folderAccess = await storage.getClientUploadFolderAccess(folderId);
        const csPayload = { folderId, uploadId: upload.id };
        for (const access of folderAccess) {
          emitToUser(access.userId, "cloud-share-updated", csPayload);
        }
        if (folder.allocatedClientId) {
          emitToUser(folder.allocatedClientId, "cloud-share-updated", csPayload);
        }
        emitToRole("developer", "cloud-share-updated", csPayload);
        emitToRole("consultant", "cloud-share-updated", csPayload);
        emitToRole("administrator", "cloud-share-updated", csPayload);
      } catch { /* non-fatal */ }

      // Send cloud upload notification email — one per site per hour
      try {
        const siteId = folder.siteId;
        const lastNotified = cloudUploadNotifiedAt.get(siteId);
        const cooldownExpired = !lastNotified || (Date.now() - lastNotified.getTime()) > CLOUD_UPLOAD_NOTIFY_COOLDOWN_MS;

        if (cooldownExpired) {
          const site = await storage.getSite(siteId);
          const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
          const modulePath = folder.module === "health_safety" ? "health-safety"
            : folder.module === "human_resources" ? "human-resources"
            : folder.module === "employment_law" ? "employment-law"
            : "cloud-share";
          const portalUrl = `${baseUrl}/${modulePath}/cloud-share`;

          if (user.role === "client") {
            // Client uploaded → notify consultant (uploader → assigned pro → admin fallback)
            const notifiedIds = new Set<string>();
            const sendToConsultant = async (target: { id: string; email: string | null; fullName: string; role: string | null }) => {
              if (!target.email || notifiedIds.has(target.id)) return false;
              try {
                await sendCloudUploadNotificationEmail({
                  to: target.email,
                  fullName: target.fullName,
                  uploaderName: user.fullName,
                  folderName: folder.name,
                  siteName: site?.name || "Unknown Site",
                  fileName,
                  portalUrl,
                  role: target.role || "consultant",
                });
                notifiedIds.add(target.id);
                await storage.createAuditLog({
                  action: "email_sent", userId: user.id, userName: user.fullName,
                  entityId: siteId, documentId: null, supportRequestId: null,
                  module: folder.module,
                  details: `Cloud upload notification sent to ${target.fullName} (${target.email})`,
                  metadata: JSON.stringify({ targetUserId: target.id, emailType: "cloud_upload_notification" }),
                });
                return true;
              } catch (e) { console.error("Failed to send cloud upload notification:", e); return false; }
            };

            // Step 1: assigned pro consultants
            try {
              const assignments = await storage.getConsultantAssignments(siteId);
              const assignedUsers = await Promise.all(assignments.map(a => storage.getUser(a.consultantId)));
              const proConsultants = assignedUsers.filter(
                (u): u is NonNullable<typeof u> =>
                  !!u && u.role === "consultant" && u.consultantTier === "pro" && !!u.email && u.status === "active"
              );
              for (const pc of proConsultants) await sendToConsultant(pc);
            } catch (e) { console.error("Failed to look up consultants for cloud upload notification:", e); }

            // Step 2: admin fallback
            if (notifiedIds.size === 0) {
              const allUsers = await storage.getAllUsers();
              for (const admin of allUsers.filter(u => u.role === "developer" && u.email && u.status === "active")) {
                await sendToConsultant(admin);
              }
            }
          } else {
            // Consultant/admin uploaded → notify allocated client, or all active clients on site
            const recipients: { id: string; email: string; fullName: string; role: string | null }[] = [];
            if (folder.allocatedClientId) {
              const allocatedClient = await storage.getUser(folder.allocatedClientId);
              if (allocatedClient && allocatedClient.email && allocatedClient.status === "active") {
                recipients.push({ id: allocatedClient.id, email: allocatedClient.email, fullName: allocatedClient.fullName, role: allocatedClient.role });
              }
            } else {
              const siteUsers = await storage.getUsersBySite(siteId);
              for (const u of siteUsers.filter(u => u.role === "client" && u.email && u.status === "active")) {
                recipients.push({ id: u.id, email: u.email!, fullName: u.fullName, role: u.role });
              }
            }
            for (const recipient of recipients) {
              try {
                await sendCloudUploadNotificationEmail({
                  to: recipient.email,
                  fullName: recipient.fullName,
                  uploaderName: user.fullName,
                  folderName: folder.name,
                  siteName: site?.name || "Unknown Site",
                  fileName,
                  portalUrl,
                  role: "client",
                });
                await storage.createAuditLog({
                  action: "email_sent", userId: user.id, userName: user.fullName,
                  entityId: siteId, documentId: null, supportRequestId: null,
                  module: folder.module,
                  details: `Cloud upload notification sent to client ${recipient.fullName} (${recipient.email})`,
                  metadata: JSON.stringify({ targetUserId: recipient.id, emailType: "cloud_upload_notification" }),
                });
              } catch (e) { console.error(`Failed to send cloud upload notification to client ${recipient.id}:`, e); }
            }
          }

          cloudUploadNotifiedAt.set(siteId, new Date());
        }
      } catch (err) {
        console.error("Failed to send cloud upload notifications:", err);
      }

      res.status(201).json(upload);
    } catch (error) {
      console.error("Error creating client upload:", error);
      res.status(500).json({ error: "Failed to create upload" });
    }
  });

  app.get("/api/client-uploads/:id/download", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const upload = await storage.getClientUpload(req.params.id);
      if (!upload) return res.status(404).json({ error: "File not found" });

      const folder = await storage.getClientUploadFolder(upload.folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(upload.fileUrl);

      await storage.createAuditLog({
        userId: user.id,
        action: "client_upload_downloaded",
        resourceType: "client_upload",
        resourceId: upload.id,
        userName: user.fullName,
        details: `Downloaded file "${upload.fileName}" from folder "${folder.name}"`,
        siteId: folder.siteId,
      });

      res.setHeader("Content-Disposition", `attachment; filename="${upload.fileName}"`);
      await objectStorageService.downloadObject(objectFile, res, 0, upload.fileName);
    } catch (error) {
      console.error("Error downloading client upload:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  app.delete("/api/client-uploads/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const upload = await storage.getClientUpload(req.params.id);
      if (!upload) return res.status(404).json({ error: "File not found" });

      const folder = await storage.getClientUploadFolder(upload.folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });

      if (
        user.role === "client" &&
        upload.uploadedByUserId !== user.id
      ) {
        return res.status(403).json({ error: "You can only delete files you uploaded" });
      }
      const canAccess = await canUserAccessFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const objectStorageService = new ObjectStorageService();
      try {
        await objectStorageService.deleteObjectEntityFile(upload.fileUrl);
      } catch {}
      await storage.deleteClientUpload(upload.id);

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "client_upload_deleted",
        resourceType: "client_upload",
        resourceId: upload.id,
        details: `Deleted file "${upload.fileName}" from folder "${folder.name}"`,
        siteId: folder.siteId,
      });

      try {
        const csPayload = { folderId: folder.id };
        const folderAccess = await storage.getClientUploadFolderAccess(folder.id);
        for (const access of folderAccess) {
          emitToUser(access.userId, "cloud-share-updated", csPayload);
        }
        if (folder.allocatedClientId) {
          emitToUser(folder.allocatedClientId, "cloud-share-updated", csPayload);
        }
        emitToRole("developer", "cloud-share-updated", csPayload);
        emitToRole("consultant", "cloud-share-updated", csPayload);
        emitToRole("administrator", "cloud-share-updated", csPayload);
      } catch { /* non-fatal */ }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client upload:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  app.post("/api/client-upload-folders/:folderId/download", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const folder = await storage.getClientUploadFolder(req.params.folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const { fileIds } = req.body as { fileIds?: string[] };
      const allFiles = await storage.getClientUploads(folder.id);
      const filesToDownload = fileIds
        ? allFiles.filter((f) => fileIds.includes(f.id))
        : allFiles;

      if (filesToDownload.length === 0) {
        return res.status(400).json({ error: "No files to download" });
      }

      const objectStorageService = new ObjectStorageService();

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${folder.name.replace(/[^a-zA-Z0-9]/g, "_")}_files.zip"`
      );

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.pipe(res);

      for (const file of filesToDownload) {
        try {
          const objectFile = await objectStorageService.getObjectEntityFile(file.fileUrl);
          const stream = objectFile.createReadStream();
          archive.append(stream, { name: file.fileName });

          await storage.createAuditLog({
            userId: user.id,
            action: "client_upload_downloaded",
            resourceType: "client_upload",
            resourceId: file.id,
            userName: user.fullName,
            details: `Bulk downloaded file "${file.fileName}" from folder "${folder.name}"`,
            siteId: folder.siteId,
          });
        } catch {}
      }

      await archive.finalize();
    } catch (error) {
      console.error("Error creating ZIP download:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create ZIP download" });
      }
    }
  });

  // ─── Generic file upload to object storage (returns objectPath) ─────────────
  app.post("/api/uploads/file", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Authentication required" });

      const rawFileName = req.headers["x-file-name"] as string | undefined;
      if (!rawFileName) return res.status(400).json({ error: "Missing X-File-Name header" });
      const fileName = decodeURIComponent(rawFileName);
      const contentType = (req.headers["content-type"] || "application/octet-stream").split(";")[0].trim();

      console.log(`[uploads/file] receiving: fileName=${fileName} contentType=${contentType} bodyConsumed=${(req as any)._body !== undefined}`);

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      console.log(`[uploads/file] buffer size: ${buffer.length} bytes`);
      if (buffer.length === 0) return res.status(400).json({ error: "Empty file body" });

      const objectStorageService = new ObjectStorageService();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const objectId = crypto.randomUUID();
      const fullPath = `${privateObjectDir}/uploads/${objectId}`;
      const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      await file.save(buffer, { contentType, metadata: { originalName: fileName } });
      const objectPath = `/objects/uploads/${objectId}`;

      res.json({ objectPath });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // ─── iShare (consultant-to-consultant file transfer) ────────────────────────
  // Fully data-isolated from Cloud Share. Non-client users only. No site scoping.
  const isNonClient = (role: string | null | undefined) =>
    role === "developer" || role === "consultant" || role === "administrator";

  const canUserAccessIshareFolder = async (
    user: { id: string; role: string },
    folder: { id: string; createdByUserId: string; recipientUserId: string }
  ): Promise<boolean> => {
    if (user.role === "developer" || user.role === "administrator") return true;
    if (folder.createdByUserId === user.id) return true;
    if (folder.recipientUserId === user.id) return true;
    const grants = await storage.getIshareFolderAccess(folder.id);
    return grants.some((g) => g.userId === user.id);
  };

  // Recipient picker — consultants only
  app.get("/api/ishare/consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });
      const consultants = await storage.getIshareRecipients();
      res.json(consultants);
    } catch (error) {
      console.error("Error fetching iShare consultants:", error);
      res.status(500).json({ error: "Failed to fetch consultants" });
    }
  });

  app.get("/api/ishare-folders", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });

      await storage.cleanupExpiredIshares();

      const folders = await storage.getIshareFolders({ userId: user.id, userRole: user.role });
      res.json(folders);
    } catch (error) {
      console.error("Error fetching iShare folders:", error);
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  app.post("/api/ishare-folders", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });

      const { name, description, recipientUserId } = req.body;
      if (!name || !recipientUserId) {
        return res.status(400).json({ error: "name and recipientUserId are required" });
      }

      const recipient = await storage.getUser(recipientUserId);
      if (!recipient || !["consultant", "developer"].includes(recipient.role)) {
        return res.status(400).json({ error: "Recipient must be a consultant or developer" });
      }

      // Folder expiry is a long-running safety-net; file-level expiry drives deletion
      const expiresAt = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000);

      const folder = await storage.createIshareFolder({
        name,
        description: description ?? null,
        createdByUserId: user.id,
        recipientUserId,
        expiresAt,
      });

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "ishare_folder_created",
        resourceType: "ishare_folder",
        resourceId: folder.id,
        details: `Created iShare folder "${name}" for ${recipient.fullName}`,
      });

      // Notify the recipient consultant — per-folder cooldown
      try {
        const lastNotified = ishareNotifiedAt.get(folder.id);
        const cooldownExpired = !lastNotified || (Date.now() - lastNotified.getTime()) > CLOUD_UPLOAD_NOTIFY_COOLDOWN_MS;
        if (cooldownExpired && recipient.email && recipient.status === "active") {
          const baseUrl = req.headers.origin || `${req.protocol}://${req.get("host")}`;
          const portalUrl = `${baseUrl}/ishare`;
          await sendIShareNotificationEmail({
            to: recipient.email,
            fullName: recipient.fullName,
            senderName: user.fullName,
            folderName: name,
            portalUrl,
            role: recipient.role,
            isNewFolder: true,
          });
          await storage.createAuditLog({
            action: "email_sent", userId: user.id, userName: user.fullName,
            details: `iShare folder creation notification sent to ${recipient.fullName} (${recipient.email})`,
            metadata: JSON.stringify({ targetUserId: recipient.id, emailType: "ishare_folder_notification" }),
          });
          ishareNotifiedAt.set(folder.id, new Date());
        }
      } catch (err) {
        console.error("Failed to send iShare folder creation notification:", err);
      }

      try {
        const payload = { folderId: folder.id };
        emitToUser(folder.recipientUserId, "ishare-updated", payload);
        emitToRole("developer", "ishare-updated", payload);
        emitToRole("consultant", "ishare-updated", payload);
        emitToRole("administrator", "ishare-updated", payload);
      } catch { /* non-fatal */ }

      res.status(201).json(folder);
    } catch (error) {
      console.error("Error creating iShare folder:", error);
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  app.delete("/api/ishare-folders/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });

      const folder = await storage.getIshareFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessIshareFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const files = await storage.getIshares(folder.id);
      const objectStorageService = new ObjectStorageService();
      for (const file of files) {
        try {
          await objectStorageService.deleteObjectEntityFile(file.fileUrl);
        } catch {}
      }

      const folderAccessGrants = await storage.getIshareFolderAccess(folder.id);

      await storage.deleteIshareFolder(folder.id);

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "ishare_folder_deleted",
        resourceType: "ishare_folder",
        resourceId: folder.id,
        details: `Deleted iShare folder "${folder.name}" and ${files.length} file(s)`,
      });

      try {
        const payload = { folderId: folder.id };
        for (const access of folderAccessGrants) {
          emitToUser(access.userId, "ishare-updated", payload);
        }
        emitToUser(folder.recipientUserId, "ishare-updated", payload);
        emitToUser(folder.createdByUserId, "ishare-updated", payload);
        emitToRole("developer", "ishare-updated", payload);
        emitToRole("consultant", "ishare-updated", payload);
        emitToRole("administrator", "ishare-updated", payload);
      } catch { /* non-fatal */ }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting iShare folder:", error);
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  app.get("/api/ishare-folders/:id/access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });
      const folder = await storage.getIshareFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessIshareFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const grants = await storage.getIshareFolderAccess(folder.id);
      res.json(grants);
    } catch (error) {
      console.error("Error fetching iShare folder access:", error);
      res.status(500).json({ error: "Failed to fetch access" });
    }
  });

  app.post("/api/ishare-folders/:id/access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });
      const folder = await storage.getIshareFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessIshareFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });

      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });
      if (!isNonClient(targetUser.role)) {
        return res.status(400).json({ error: "Can only grant access to non-client users" });
      }

      await storage.grantIshareFolderAccess(folder.id, userId, user.id);

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "ishare_folder_access_granted",
        resourceType: "ishare_folder",
        resourceId: folder.id,
        details: `Granted access to "${targetUser.fullName}" for iShare folder "${folder.name}"`,
      });

      try {
        emitToUser(userId, "ishare-updated", { folderId: folder.id });
      } catch { /* non-fatal */ }

      res.json({ success: true });
    } catch (error) {
      console.error("Error granting iShare folder access:", error);
      res.status(500).json({ error: "Failed to grant access" });
    }
  });

  app.delete("/api/ishare-folders/:id/access/:userId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });
      const folder = await storage.getIshareFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessIshareFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const { userId } = req.params;
      if (folder.recipientUserId === userId) {
        return res.status(400).json({ error: "Cannot revoke access from the recipient" });
      }

      const targetUser = await storage.getUser(userId);
      await storage.revokeIshareFolderAccess(folder.id, userId);

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "ishare_folder_access_revoked",
        resourceType: "ishare_folder",
        resourceId: folder.id,
        details: `Revoked access from "${targetUser?.fullName ?? userId}" for iShare folder "${folder.name}"`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking iShare folder access:", error);
      res.status(500).json({ error: "Failed to revoke access" });
    }
  });

  app.get("/api/ishare-folders/:id/grantable-users", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });
      const folder = await storage.getIshareFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessIshareFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const users = await storage.getIshareGrantableUsers(folder.id);
      res.json(users);
    } catch (error) {
      console.error("Error fetching iShare grantable users:", error);
      res.status(500).json({ error: "Failed to fetch grantable users" });
    }
  });

  app.get("/api/ishare-folders/:folderId/files", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });
      const folder = await storage.getIshareFolder(req.params.folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessIshareFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      const files = await storage.getIshares(folder.id);
      res.json(files);
    } catch (error) {
      console.error("Error fetching iShare folder files:", error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.post("/api/ishares", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });
      const { folderId, fileName, fileSize, fileUrl, description } = req.body;
      if (!folderId || !fileName || !fileSize || !fileUrl) {
        return res.status(400).json({ error: "folderId, fileName, fileSize, and fileUrl are required" });
      }
      const folder = await storage.getIshareFolder(folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });

      const now = new Date();
      if (folder.expiresAt < now) {
        return res.status(400).json({ error: "This folder has expired" });
      }

      const canAccess = await canUserAccessIshareFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const fileExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const upload = await storage.createIshare({
        folderId,
        uploadedByUserId: user.id,
        fileName,
        fileSize,
        fileUrl,
        description: description ?? null,
        expiresAt: fileExpiresAt,
      });

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "ishare_uploaded",
        resourceType: "ishare",
        resourceId: upload.id,
        details: `Uploaded file "${fileName}" to iShare folder "${folder.name}"`,
      });

      try {
        const folderAccess = await storage.getIshareFolderAccess(folderId);
        const payload = { folderId, uploadId: upload.id };
        for (const access of folderAccess) {
          emitToUser(access.userId, "ishare-updated", payload);
        }
        emitToUser(folder.recipientUserId, "ishare-updated", payload);
        emitToUser(folder.createdByUserId, "ishare-updated", payload);
        emitToRole("developer", "ishare-updated", payload);
        emitToRole("consultant", "ishare-updated", payload);
        emitToRole("administrator", "ishare-updated", payload);
      } catch { /* non-fatal */ }

      // Notify the other party (recipient + creator + grantees, excluding uploader)
      try {
        const lastNotified = ishareNotifiedAt.get(folder.id);
        const cooldownExpired = !lastNotified || (Date.now() - lastNotified.getTime()) > CLOUD_UPLOAD_NOTIFY_COOLDOWN_MS;
        if (cooldownExpired) {
          const baseUrl = req.headers.origin || `${req.protocol}://${req.get("host")}`;
          const portalUrl = `${baseUrl}/ishare`;

          const recipientIds = new Set<string>();
          recipientIds.add(folder.recipientUserId);
          recipientIds.add(folder.createdByUserId);
          const grants = await storage.getIshareFolderAccess(folder.id);
          for (const g of grants) recipientIds.add(g.userId);
          recipientIds.delete(user.id);

          let sentAny = false;
          for (const rid of recipientIds) {
            const target = await storage.getUser(rid);
            if (!target || !target.email || target.status !== "active") continue;
            try {
              await sendIShareNotificationEmail({
                to: target.email,
                fullName: target.fullName,
                senderName: user.fullName,
                folderName: folder.name,
                fileName,
                portalUrl,
                role: target.role,
              });
              sentAny = true;
              await storage.createAuditLog({
                action: "email_sent", userId: user.id, userName: user.fullName,
                details: `iShare upload notification sent to ${target.fullName} (${target.email})`,
                metadata: JSON.stringify({ targetUserId: target.id, emailType: "ishare_upload_notification" }),
              });
            } catch (e) { console.error(`Failed to send iShare upload notification to ${rid}:`, e); }
          }
          if (sentAny) ishareNotifiedAt.set(folder.id, new Date());
        }
      } catch (err) {
        console.error("Failed to send iShare upload notifications:", err);
      }

      res.status(201).json(upload);
    } catch (error) {
      console.error("Error creating iShare upload:", error);
      res.status(500).json({ error: "Failed to create upload" });
    }
  });

  app.get("/api/ishares/:id/download", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });
      const upload = await storage.getIshare(req.params.id);
      if (!upload) return res.status(404).json({ error: "File not found" });

      const folder = await storage.getIshareFolder(upload.folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessIshareFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(upload.fileUrl);

      await storage.createAuditLog({
        userId: user.id,
        action: "ishare_downloaded",
        resourceType: "ishare",
        resourceId: upload.id,
        userName: user.fullName,
        details: `Downloaded file "${upload.fileName}" from iShare folder "${folder.name}"`,
      });

      res.setHeader("Content-Disposition", `attachment; filename="${upload.fileName}"`);
      await objectStorageService.downloadObject(objectFile, res, 0, upload.fileName);
    } catch (error) {
      console.error("Error downloading iShare file:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  app.delete("/api/ishares/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });
      const upload = await storage.getIshare(req.params.id);
      if (!upload) return res.status(404).json({ error: "File not found" });

      const folder = await storage.getIshareFolder(upload.folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });

      // Consultants may only delete files they uploaded; admins/developers any.
      if (
        user.role === "consultant" &&
        upload.uploadedByUserId !== user.id
      ) {
        return res.status(403).json({ error: "You can only delete files you uploaded" });
      }
      const canAccess = await canUserAccessIshareFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const objectStorageService = new ObjectStorageService();
      try {
        await objectStorageService.deleteObjectEntityFile(upload.fileUrl);
      } catch {}
      await storage.deleteIshare(upload.id);

      await storage.createAuditLog({
        userId: user.id,
        userName: user.fullName,
        action: "ishare_deleted",
        resourceType: "ishare",
        resourceId: upload.id,
        details: `Deleted file "${upload.fileName}" from iShare folder "${folder.name}"`,
      });

      try {
        const payload = { folderId: folder.id };
        const folderAccess = await storage.getIshareFolderAccess(folder.id);
        for (const access of folderAccess) {
          emitToUser(access.userId, "ishare-updated", payload);
        }
        emitToUser(folder.recipientUserId, "ishare-updated", payload);
        emitToUser(folder.createdByUserId, "ishare-updated", payload);
        emitToRole("developer", "ishare-updated", payload);
        emitToRole("consultant", "ishare-updated", payload);
        emitToRole("administrator", "ishare-updated", payload);
      } catch { /* non-fatal */ }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting iShare file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  app.post("/api/ishare-folders/:folderId/download", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!isNonClient(user.role)) return res.status(403).json({ error: "Access denied" });
      const folder = await storage.getIshareFolder(req.params.folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const canAccess = await canUserAccessIshareFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const { fileIds } = req.body as { fileIds?: string[] };
      const allFiles = await storage.getIshares(folder.id);
      const filesToDownload = fileIds
        ? allFiles.filter((f) => fileIds.includes(f.id))
        : allFiles;

      if (filesToDownload.length === 0) {
        return res.status(400).json({ error: "No files to download" });
      }

      const objectStorageService = new ObjectStorageService();

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${folder.name.replace(/[^a-zA-Z0-9]/g, "_")}_files.zip"`
      );

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.pipe(res);

      for (const file of filesToDownload) {
        try {
          const objectFile = await objectStorageService.getObjectEntityFile(file.fileUrl);
          const stream = objectFile.createReadStream();
          archive.append(stream, { name: file.fileName });

          await storage.createAuditLog({
            userId: user.id,
            action: "ishare_downloaded",
            resourceType: "ishare",
            resourceId: file.id,
            userName: user.fullName,
            details: `Bulk downloaded file "${file.fileName}" from iShare folder "${folder.name}"`,
          });
        } catch {}
      }

      await archive.finalize();
    } catch (error) {
      console.error("Error creating iShare ZIP download:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create ZIP download" });
      }
    }
  });

  // Toolkit download tracking
  app.post("/api/toolkit/download", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      
      const { templateId, siteId } = req.body;
      if (!templateId) return res.status(400).json({ error: "Missing templateId" });

      // Look up company and site info for tracking
      let companyId: string | null = user.companyId ?? null;
      let companyName: string | null = null;
      let siteName: string | null = null;
      let resolvedSiteId: string | null = siteId ?? null;

      if (siteId) {
        const site = await storage.getSite(siteId);
        if (site) {
          companyId = site.companyId;
          siteName = site.name;
          // Get company name from company record
          const company = await storage.getCompany(site.companyId);
          if (company) companyName = company.name;
        }
      } else if (companyId) {
        const company = await storage.getCompany(companyId);
        if (company) companyName = company.name;
      }

      await storage.trackTemplateDownload(templateId, user.id, user.fullName, companyId, companyName, resolvedSiteId, siteName);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking download:", error);
      res.status(500).json({ error: "Failed to track download" });
    }
  });

  // Toolkit stats
  app.get("/api/toolkit/stats", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { companyName } = req.query;
      const filter: { companyName?: string; userId?: string } = {};

      // Clients only see their own downloads
      if (user.role === "client") {
        filter.userId = user.id;
      } else if (typeof companyName === "string" && companyName) {
        filter.companyName = companyName;
      }

      const stats = await storage.getToolkitStats(Object.keys(filter).length > 0 ? filter : undefined);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching toolkit stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Document Pathways (Guided Document Finder)
  app.get("/api/toolkit/pathways", requireAuth, async (req, res) => {
    try {
      const { module } = req.query;
      const pathways = await storage.getDocumentPathways(typeof module === "string" ? module : undefined);
      res.json(pathways);
    } catch (error) {
      console.error("Error fetching pathways:", error);
      res.status(500).json({ error: "Failed to fetch pathways" });
    }
  });

  app.get("/api/toolkit/pathways/:id", requireAuth, async (req, res) => {
    try {
      const pathway = await storage.getDocumentPathway(req.params.id);
      if (!pathway) return res.status(404).json({ error: "Pathway not found" });

      // Resolve leaf templateIds to template objects
      const collectIds = (node: any): string[] => {
        if (!node) return [];
        const ids: string[] = [];
        if (Array.isArray(node.answers)) {
          for (const a of node.answers) {
            if (Array.isArray(a.templateIds)) ids.push(...a.templateIds);
            if (a.next) ids.push(...collectIds(a.next));
          }
        }
        return ids;
      };
      const allIds = [...new Set(collectIds(pathway.tree))];
      const templates = allIds.length > 0 ? await storage.getDocumentTemplatesByIds(allIds) : [];
      res.json({ ...pathway, resolvedTemplates: templates });
    } catch (error) {
      console.error("Error fetching pathway:", error);
      res.status(500).json({ error: "Failed to fetch pathway" });
    }
  });

  app.post("/api/toolkit/pathways", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const { title, description, module, tree, isActive, sortOrder } = req.body;
      if (!title || !tree) return res.status(400).json({ error: "title and tree are required" });
      const pathway = await storage.createDocumentPathway({ title, description: description ?? null, module: module ?? null, tree, isActive: isActive !== false, sortOrder: sortOrder ?? 0, createdBy: user.id });
      res.status(201).json(pathway);
    } catch (error) {
      console.error("Error creating pathway:", error);
      res.status(500).json({ error: "Failed to create pathway" });
    }
  });

  app.patch("/api/toolkit/pathways/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      // Whitelist only mutable fields to prevent unintended overwrites
      const { title, description, module, tree, isActive, sortOrder } = req.body;
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (module !== undefined) updates.module = module;
      if (tree !== undefined) updates.tree = tree;
      if (isActive !== undefined) updates.isActive = isActive;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      const pathway = await storage.updateDocumentPathway(req.params.id, updates);
      if (!pathway) return res.status(404).json({ error: "Pathway not found" });
      res.json(pathway);
    } catch (error) {
      console.error("Error updating pathway:", error);
      res.status(500).json({ error: "Failed to update pathway" });
    }
  });

  app.delete("/api/toolkit/pathways/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const ok = await storage.deleteDocumentPathway(req.params.id);
      if (!ok) return res.status(404).json({ error: "Pathway not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting pathway:", error);
      res.status(500).json({ error: "Failed to delete pathway" });
    }
  });

  // ─── Training Pathways (Guided Training Finder) ──────────────────────────────

  app.get("/api/training/pathways", requireAuth, async (req, res) => {
    try {
      const { module } = req.query;
      const pathways = await storage.getTrainingPathways(typeof module === "string" ? module : undefined);
      res.json(pathways);
    } catch (error) {
      console.error("Error fetching training pathways:", error);
      res.status(500).json({ error: "Failed to fetch training pathways" });
    }
  });

  app.post("/api/training/pathways", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const { title, description, module, tree, isActive, sortOrder } = req.body;
      if (!title || !tree) return res.status(400).json({ error: "title and tree are required" });
      const pathway = await storage.createTrainingPathway({ title, description: description ?? null, module: module ?? null, tree, isActive: isActive !== false, sortOrder: sortOrder ?? 0, createdBy: user.id });
      res.status(201).json(pathway);
    } catch (error) {
      console.error("Error creating training pathway:", error);
      res.status(500).json({ error: "Failed to create training pathway" });
    }
  });

  app.patch("/api/training/pathways/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const { title, description, module, tree, isActive, sortOrder } = req.body;
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (module !== undefined) updates.module = module;
      if (tree !== undefined) updates.tree = tree;
      if (isActive !== undefined) updates.isActive = isActive;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      const pathway = await storage.updateTrainingPathway(req.params.id, updates);
      if (!pathway) return res.status(404).json({ error: "Pathway not found" });
      res.json(pathway);
    } catch (error) {
      console.error("Error updating training pathway:", error);
      res.status(500).json({ error: "Failed to update training pathway" });
    }
  });

  app.delete("/api/training/pathways/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const ok = await storage.deleteTrainingPathway(req.params.id);
      if (!ok) return res.status(404).json({ error: "Pathway not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting training pathway:", error);
      res.status(500).json({ error: "Failed to delete training pathway" });
    }
  });

  // ─── Testing Task Lists ──────────────────────────────────────────────────────

  const taskListSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    module: z.enum(["health_safety", "human_resources", "employment_law", "training", "general"]).optional(),
    tasks: z.array(z.object({
      id: z.string(),
      label: z.string().min(1),
      description: z.string().optional(),
    })).optional(),
    isArchived: z.boolean().optional(),
  });

  app.get("/api/testing-task-lists", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Access denied" });
      }
      const includeArchived = req.query.includeArchived === "true";
      const lists = await storage.getTestingTaskLists(includeArchived);
      res.json(lists);
    } catch (error) {
      console.error("Error fetching testing task lists:", error);
      res.status(500).json({ error: "Failed to fetch task lists" });
    }
  });

  app.post("/api/testing-task-lists", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const parsed = taskListSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      const list = await storage.createTestingTaskList({
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        module: parsed.data.module ?? "general",
        tasks: parsed.data.tasks ?? [],
        createdBy: user.id,
      });
      res.status(201).json(list);
    } catch (error) {
      console.error("Error creating testing task list:", error);
      res.status(500).json({ error: "Failed to create task list" });
    }
  });

  app.patch("/api/testing-task-lists/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const parsed = taskListSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      const { title, description, module, tasks, isArchived } = parsed.data;
      const updatePayload: Record<string, unknown> = {};
      if (title !== undefined) updatePayload.title = title;
      if (description !== undefined) updatePayload.description = description;
      if (module !== undefined) updatePayload.module = module;
      if (tasks !== undefined) updatePayload.tasks = tasks;
      if (isArchived !== undefined) updatePayload.isArchived = isArchived;
      const list = await storage.updateTestingTaskList(req.params.id, updatePayload as Partial<import("@shared/schema").TestingTaskList>);
      if (!list) return res.status(404).json({ error: "Task list not found" });
      res.json(list);
    } catch (error) {
      console.error("Error updating testing task list:", error);
      res.status(500).json({ error: "Failed to update task list" });
    }
  });

  app.delete("/api/testing-task-lists/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const ok = await storage.deleteTestingTaskList(req.params.id);
      if (!ok) return res.status(404).json({ error: "Task list not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting testing task list:", error);
      res.status(500).json({ error: "Failed to delete task list" });
    }
  });

  // Testing Task Assignments

  app.get("/api/testing-task-assignments/my", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Access denied" });
      }
      const assignments = await storage.getMyTestingTaskAssignments(user.id);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching my testing assignments:", error);
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  app.get("/api/testing-task-assignments", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const taskListId = typeof req.query.taskListId === "string" ? req.query.taskListId : undefined;
      const assignments = await storage.getTestingTaskAssignments(taskListId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching testing assignments:", error);
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  app.post("/api/testing-task-assignments", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const parsed = z.object({ taskListId: z.string(), assignedTo: z.string() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      const { taskListId, assignedTo } = parsed.data;
      const taskList = await storage.getTestingTaskList(taskListId);
      if (!taskList) return res.status(404).json({ error: "Task list not found" });
      const assignee = await storage.getUser(assignedTo);
      if (!assignee || (assignee.role !== "consultant" && assignee.role !== "developer")) {
        return res.status(400).json({ error: "Assignee must be a consultant or developer" });
      }
      const assignment = await storage.createTestingTaskAssignment({
        taskListId,
        assignedTo,
        assignedBy: user.id,
        completedTaskIds: [],
      });
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating testing assignment:", error);
      res.status(500).json({ error: "Failed to create assignment" });
    }
  });

  app.patch("/api/testing-task-assignments/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "developer" && user.role !== "consultant" && user.role !== "administrator")) {
        return res.status(403).json({ error: "Access denied" });
      }
      const existing = await storage.getTestingTaskAssignment(req.params.id);
      if (!existing) return res.status(404).json({ error: "Assignment not found" });
      if (user.role === "consultant" && existing.assignedTo !== user.id) {
        return res.status(403).json({ error: "You can only update your own assignments" });
      }
      const bodyParsed = z.object({ completedTaskIds: z.array(z.string()) }).safeParse(req.body);
      if (!bodyParsed.success) return res.status(400).json({ error: "Invalid data", details: bodyParsed.error.issues });
      const { completedTaskIds } = bodyParsed.data;
      const assignment = await storage.updateTestingTaskAssignment(req.params.id, { completedTaskIds });
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      res.json(assignment);
    } catch (error) {
      console.error("Error updating testing assignment:", error);
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  app.delete("/api/testing-task-assignments/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const ok = await storage.deleteTestingTaskAssignment(req.params.id);
      if (!ok) return res.status(404).json({ error: "Assignment not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting testing assignment:", error);
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  });

  // ==================== SOURCES ====================

  const createSourceSchema = z.object({
    code: z.string().min(1).max(20).toUpperCase(),
    label: z.string().min(1),
    isActive: z.boolean().optional(),
  });

  app.get("/api/sources", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      const includeInactive = req.query.includeInactive === "true" && user?.role === "developer";
      const sources = await storage.getSources(!includeInactive);
      res.json(sources);
    } catch (error) {
      console.error("Error fetching sources:", error);
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.post("/api/sources", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const parsed = createSourceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      const source = await storage.createSource({
        code: parsed.data.code,
        label: parsed.data.label,
        isActive: parsed.data.isActive ?? true,
      });

      // Auto-assign new source to all existing admin users
      try {
        const allUsers = await storage.getAllUsers();
        const adminUsers = allUsers.filter(u => u.role === "developer");
        await Promise.all(
          adminUsers.map(async (adminUser) => {
            const currentSources: string[] = adminUser.sources ?? [];
            if (!currentSources.includes(source.code)) {
              await storage.updateUser(adminUser.id, {
                sources: [...currentSources, source.code],
              });
            }
          })
        );
      } catch (err) {
        console.error("Failed to auto-assign new source to admin users:", err);
      }

      res.status(201).json(source);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "A source with that code already exists" });
      }
      console.error("Error creating source:", error);
      res.status(500).json({ error: "Failed to create source" });
    }
  });

  app.patch("/api/sources/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      const source = await storage.updateSource(req.params.id, { isActive: parsed.data.isActive });
      if (!source) return res.status(404).json({ error: "Source not found" });
      res.json(source);
    } catch (error) {
      console.error("Error updating source:", error);
      res.status(500).json({ error: "Failed to update source" });
    }
  });

  // ==================== BADGE TYPES ====================

  app.get("/api/badge-types", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role === "client") return res.status(403).json({ error: "Access denied" });
      const activeOnly = req.query.activeOnly === "true";
      const types = await storage.getBadgeTypes(activeOnly);
      res.json(types);
    } catch (error) {
      console.error("Error fetching badge types:", error);
      res.status(500).json({ error: "Failed to fetch badge types" });
    }
  });

  app.post("/api/badge-types", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const parsed = z.object({ label: z.string().min(1), sortOrder: z.number().int().min(0).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      const bt = await storage.createBadgeType({ label: parsed.data.label, sortOrder: parsed.data.sortOrder ?? 0, isActive: parsed.data.isActive ?? true });
      res.status(201).json(bt);
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ error: "A badge type with that label already exists" });
      console.error("Error creating badge type:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      res.status(500).json({ error: "Failed to create badge type" });
    }
  });

  app.patch("/api/badge-types/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const parsed = z.object({ label: z.string().min(1).optional(), sortOrder: z.number().int().min(0).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      const bt = await storage.updateBadgeType(req.params.id, parsed.data);
      if (!bt) return res.status(404).json({ error: "Badge type not found" });
      res.json(bt);
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ error: "A badge type with that label already exists" });
      console.error("Error updating badge type:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      res.status(500).json({ error: "Failed to update badge type" });
    }
  });

  app.delete("/api/badge-types/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const deleted = await storage.deleteBadgeType(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Badge type not found" });
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting badge type:", error);
      res.status(500).json({ error: "Failed to delete badge type" });
    }
  });

  // ==================== SERVICES ====================

  const createServiceSchema = z.object({
    productCode: z.string().min(1).max(50),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    module: z.enum(["health_safety", "human_resources", "employment_law"]),
    sourceId: z.string().min(1),
    serviceType: z.enum(["retained", "recurring", "pay_as_you_go", "subscription", "training"]).nullable(),
    pricePeriod: z.enum(["one_off", "monthly", "annually"]).nullable(),
    badgeTypeId: z.string().optional().nullable(),
    isMultiService: z.boolean().optional(),
    priceGbp: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal amount"),
    benchmarkPriceGbp: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal amount").or(z.null()).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().optional(),
  });

  const updateServiceSchema = createServiceSchema.partial();

  app.get("/api/services", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role === "client") return res.status(403).json({ error: "Access denied" });
      const activeOnly = req.query.activeOnly === "true";
      const validModules = ["health_safety", "human_resources", "employment_law"] as const;
      const rawModule = req.query.module as string | undefined;
      const module = rawModule && (validModules as readonly string[]).includes(rawModule)
        ? rawModule as typeof validModules[number]
        : undefined;
      const companyId = req.query.companyId as string | undefined;
      const svcs = await storage.getServices({ activeOnly, module, companyId });
      res.json(svcs);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  app.post("/api/services", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      const hasServicesPermission = (user?.role === "consultant" || user?.role === "administrator") && !!(user.consultantPermissions as { services?: boolean } | null)?.services;
      if (!user || (user.role !== "developer" && !hasServicesPermission)) return res.status(403).json({ error: "Access denied" });
      const parsed = createServiceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      const svc = await storage.createService(parsed.data as InsertService);
      res.status(201).json(svc);
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ error: "A service with that product code already exists" });
      console.error("Error creating service:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  app.patch("/api/services/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      const hasServicesPermission = (user?.role === "consultant" || user?.role === "administrator") && !!(user.consultantPermissions as { services?: boolean } | null)?.services;
      if (!user || (user.role !== "developer" && !hasServicesPermission)) return res.status(403).json({ error: "Access denied" });
      const parsed = updateServiceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      const svc = await storage.updateService(req.params.id, parsed.data as Partial<InsertService>);
      if (!svc) return res.status(404).json({ error: "Service not found" });
      res.json(svc);
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ error: "A service with that product code already exists" });
      console.error("Error updating service:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      const hasServicesPermission = (user?.role === "consultant" || user?.role === "administrator") && !!(user.consultantPermissions as { services?: boolean } | null)?.services;
      if (!user || (user.role !== "developer" && !hasServicesPermission)) return res.status(403).json({ error: "Access denied" });
      const deleted = await storage.deleteService(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Service not found" });
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  app.get("/api/services/:id/components", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role === "client") return res.status(403).json({ error: "Access denied" });
      const components = await storage.getServiceComponents(req.params.id);
      res.json(components);
    } catch (error) {
      console.error("Error fetching service components:", error);
      res.status(500).json({ error: "Failed to fetch service components" });
    }
  });

  app.post("/api/services/:id/components", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      const hasServicesPermission = (user?.role === "consultant" || user?.role === "administrator") && !!(user.consultantPermissions as { services?: boolean } | null)?.services;
      if (!user || (user.role !== "developer" && !hasServicesPermission)) return res.status(403).json({ error: "Access denied" });
      const parsed = z.object({ componentServiceId: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });
      const parent = await storage.getService(req.params.id);
      const component = await storage.getService(parsed.data.componentServiceId);
      if (!parent || !component) return res.status(404).json({ error: "Service not found" });
      if (!parent.isMultiService) return res.status(400).json({ error: "Parent service is not a multi-service" });
      if (component.isMultiService) return res.status(400).json({ error: "Components must be single services" });
      if (parent.sourceId !== component.sourceId) return res.status(400).json({ error: "Component must have the same source as the parent" });
      if (parent.module !== component.module) return res.status(400).json({ error: "Component must be in the same module as the parent" });
      const link = await storage.addServiceComponent(req.params.id, parsed.data.componentServiceId);
      res.status(201).json(link);
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ error: "Component already linked" });
      console.error("Error adding service component:", error);
      res.status(500).json({ error: "Failed to add component" });
    }
  });

  app.delete("/api/services/:id/components/:componentId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      const hasServicesPermission = (user?.role === "consultant" || user?.role === "administrator") && !!(user.consultantPermissions as { services?: boolean } | null)?.services;
      if (!user || (user.role !== "developer" && !hasServicesPermission)) return res.status(403).json({ error: "Access denied" });
      const removed = await storage.removeServiceComponent(req.params.id, req.params.componentId);
      if (!removed) return res.status(404).json({ error: "Component link not found" });
      res.status(204).end();
    } catch (error) {
      console.error("Error removing service component:", error);
      res.status(500).json({ error: "Failed to remove component" });
    }
  });

  app.get("/api/companies/:id/services", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role === "client") return res.status(403).json({ error: "Access denied" });
      const assigned = await storage.getCompanyServices(req.params.id);
      res.json(assigned);
    } catch (error) {
      console.error("Error fetching company services:", error);
      res.status(500).json({ error: "Failed to fetch company services" });
    }
  });

  app.post("/api/companies/:id/services", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      const hasServicesPermission = (user?.role === "consultant" || user?.role === "administrator") && !!(user.consultantPermissions as { services?: boolean } | null)?.services;
      if (!user || (user.role !== "developer" && !hasServicesPermission)) return res.status(403).json({ error: "Access denied" });
      const parsed = z.object({ serviceId: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });
      const svc = await storage.getService(parsed.data.serviceId);
      if (!svc || !svc.isActive) return res.status(400).json({ error: "Service is not active" });

      // Ringfencing: validate source matches one of the company's configured sources
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const companySources = company.sources ?? [];
      if (companySources.length === 0) {
        return res.status(400).json({ error: "This company has no configured sources; no services can be assigned" });
      }
      const { pool: pgPool } = await import("./db");
      const { rows: srcRows } = await pgPool.query<{ code: string }>(
        "SELECT code FROM sources WHERE id = $1", [svc.sourceId]
      );
      const svcSourceCode = srcRows[0]?.code;
      if (!svcSourceCode || !companySources.includes(svcSourceCode)) {
        return res.status(400).json({ error: "This service's source does not match any of this company's configured sources" });
      }

      // Ringfencing: validate module matches an active module on the company
      const moduleMap: Record<string, keyof typeof company> = {
        health_safety: "healthSafetyAccess",
        human_resources: "humanResourcesAccess",
        employment_law: "employmentLawAccess",
      };
      const accessKey = moduleMap[svc.module];
      if (accessKey && !company[accessKey]) {
        return res.status(400).json({ error: `This company does not have ${svc.module.replace(/_/g, " ")} access enabled` });
      }

      const row = await storage.addCompanyService(req.params.id, parsed.data.serviceId, user.fullName ?? user.username);
      await emitCompanyScoped("company-updated", req.params.id, { companyId: req.params.id });
      res.status(201).json(row);
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ error: "Service already assigned" });
      console.error("Error adding company service:", error);
      res.status(500).json({ error: "Failed to add service" });
    }
  });

  app.delete("/api/companies/:id/services/:serviceId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      const hasServicesPermission = (user?.role === "consultant" || user?.role === "administrator") && !!(user.consultantPermissions as { services?: boolean } | null)?.services;
      if (!user || (user.role !== "developer" && !hasServicesPermission)) return res.status(403).json({ error: "Access denied" });
      const removed = await storage.removeCompanyService(req.params.id, req.params.serviceId);
      if (!removed) return res.status(404).json({ error: "Assignment not found" });
      await emitCompanyScoped("company-updated", req.params.id, { companyId: req.params.id });
      res.status(204).end();
    } catch (error) {
      console.error("Error removing company service:", error);
      res.status(500).json({ error: "Failed to remove service" });
    }
  });

  // ─── Changelog ────────────────────────────────────────────────────────────

  const changelogAdminGuard = async (req: any, res: any) => {
    const user = await storage.getUser((req.session as any)?.userId);
    if (!user || user.role !== "developer") {
      res.status(403).json({ error: "Developer only" });
      return null;
    }
    return user;
  };

  app.get("/api/changelog/versions", requireAuth, async (req, res) => {
    try {
      const user = await changelogAdminGuard(req, res);
      if (!user) return;
      const cl = await readChangelog();
      res.json(cl);
    } catch (err) {
      console.error("Changelog GET versions error:", err);
      res.status(500).json({ error: "Failed to read changelog" });
    }
  });

  app.get("/api/changelog/entries", requireAuth, async (req, res) => {
    try {
      const user = await changelogAdminGuard(req, res);
      if (!user) return;
      const cl = await readChangelog();
      const { versionId } = req.query as { versionId?: string };
      let entries: (ChangelogEntry & { versionId: string })[] = [];
      for (const v of cl.versions) {
        if (versionId && v.id !== versionId) continue;
        for (const e of v.entries) {
          entries.push({ ...e, versionId: v.id });
        }
      }
      res.json(entries);
    } catch (err) {
      console.error("Changelog GET entries error:", err);
      res.status(500).json({ error: "Failed to read entries" });
    }
  });

  app.post("/api/changelog/versions", requireAuth, async (req, res) => {
    try {
      const user = await changelogAdminGuard(req, res);
      if (!user) return;
      const parsed = z.object({
        bump: z.enum(["minor", "major"]),
        label: z.string().optional(),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

      const cl = await readChangelog();
      const active = cl.versions.find((v) => v.id === cl.activeVersionId);
      if (!active) return res.status(400).json({ error: "No active version" });

      active.isActive = false;

      let newMajor = active.major;
      let newMinor = active.minor;
      if (parsed.data.bump === "major") {
        newMajor += 1;
        newMinor = 0;
      } else {
        newMinor += 1;
      }

      const newVersion: import("./changelog").ChangelogVersion = {
        id: generateChangelogId(),
        major: newMajor,
        minor: newMinor,
        patch: 0,
        label: parsed.data.label || "",
        isActive: true,
        createdAt: new Date().toISOString(),
        entries: [],
      };

      cl.versions.push(newVersion);
      cl.activeVersionId = newVersion.id;
      await writeChangelog(cl);
      res.status(201).json(newVersion);
    } catch (err) {
      console.error("Changelog POST versions error:", err);
      res.status(500).json({ error: "Failed to create version" });
    }
  });

  app.patch("/api/changelog/versions/:id", requireAuth, async (req, res) => {
    try {
      const user = await changelogAdminGuard(req, res);
      if (!user) return;
      const parsed = z.object({ label: z.string() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

      const cl = await readChangelog();
      const version = cl.versions.find((v) => v.id === req.params.id);
      if (!version) return res.status(404).json({ error: "Version not found" });

      version.label = parsed.data.label;
      await writeChangelog(cl);
      res.json(version);
    } catch (err) {
      console.error("Changelog PATCH versions error:", err);
      res.status(500).json({ error: "Failed to update version" });
    }
  });

  app.delete("/api/changelog/versions/:id", requireAuth, async (req, res) => {
    try {
      const user = await changelogAdminGuard(req, res);
      if (!user) return;

      const cl = await readChangelog();
      const idx = cl.versions.findIndex((v) => v.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: "Version not found" });
      if (cl.activeVersionId === req.params.id) {
        return res.status(400).json({ error: "Cannot delete the active version" });
      }
      cl.versions.splice(idx, 1);
      await writeChangelog(cl);
      res.json({ ok: true });
    } catch (err) {
      console.error("Changelog DELETE versions error:", err);
      res.status(500).json({ error: "Failed to delete version" });
    }
  });

  app.post("/api/changelog/entries", requireAuth, async (req, res) => {
    try {
      const user = await changelogAdminGuard(req, res);
      if (!user) return;
      const parsed = z.object({
        message: z.string().min(1),
        category: z.enum(["bug", "enhancement", "feature", "other"]),
        versionId: z.string().optional(),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

      const cl = await readChangelog();
      const targetId = parsed.data.versionId || cl.activeVersionId;
      const version = cl.versions.find((v) => v.id === targetId);
      if (!version) return res.status(404).json({ error: "Version not found" });

      const entry = {
        id: generateChangelogId(),
        patch: version.patch,
        message: parsed.data.message,
        category: parsed.data.category as ChangelogCategory,
        createdAt: new Date().toISOString(),
        createdBy: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.id,
      };
      version.entries.push(entry);
      // Keep patchedEntryIds in sync so this entry never triggers a spurious patch bump
      if (!version.patchedEntryIds) version.patchedEntryIds = [];
      if (!version.patchedEntryIds.includes(entry.id)) {
        version.patchedEntryIds.push(entry.id);
      }
      await writeChangelog(cl);
      res.status(201).json(entry);
    } catch (err) {
      console.error("Changelog POST entries error:", err);
      res.status(500).json({ error: "Failed to create entry" });
    }
  });

  app.patch("/api/changelog/entries/:id", requireAuth, async (req, res) => {
    try {
      const user = await changelogAdminGuard(req, res);
      if (!user) return;
      const parsed = z.object({
        message: z.string().min(1).optional(),
        category: z.enum(["bug", "enhancement", "feature", "other"]).optional(),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

      const cl = await readChangelog();
      let found = false;
      for (const version of cl.versions) {
        const entry = version.entries.find((e) => e.id === req.params.id);
        if (entry) {
          if (parsed.data.message !== undefined) entry.message = parsed.data.message;
          if (parsed.data.category !== undefined) entry.category = parsed.data.category as ChangelogCategory;
          found = true;
          break;
        }
      }
      if (!found) return res.status(404).json({ error: "Entry not found" });
      await writeChangelog(cl);
      res.json({ ok: true });
    } catch (err) {
      console.error("Changelog PATCH entries error:", err);
      res.status(500).json({ error: "Failed to update entry" });
    }
  });

  app.delete("/api/changelog/entries/:id", requireAuth, async (req, res) => {
    try {
      const user = await changelogAdminGuard(req, res);
      if (!user) return;

      const cl = await readChangelog();
      let found = false;
      for (const version of cl.versions) {
        const idx = version.entries.findIndex((e) => e.id === req.params.id);
        if (idx !== -1) {
          version.entries.splice(idx, 1);
          found = true;
          break;
        }
      }
      if (!found) return res.status(404).json({ error: "Entry not found" });
      await writeChangelog(cl);
      res.json({ ok: true });
    } catch (err) {
      console.error("Changelog DELETE entries error:", err);
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  /**
   * POST /api/changelog/bump-after-publish
   * Called immediately after a confirmed production deploy.
   * Sets publishedPatch = current patch, increments dev patch by 1,
   * and syncs patchedEntryIds — so new entries go on the next patch number.
   */
  /**
   * GET /api/changelog/published-patch
   * Public, unauthenticated. Returns the active version's currently-shipped
   * patch number from THIS server's perspective. Dev polls the production URL
   * for this so it can auto-bump itself when prod has shipped a new patch.
   */
  app.get("/api/changelog/published-patch", async (_req, res) => {
    // Allow cross-origin fetches so the dev frontend can poll the live prod server
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const cl = await readChangelog();
      const active = cl.versions.find((v) => v.id === cl.activeVersionId);
      if (!active) return res.json({ major: 0, minor: 0, patch: 0 });
      // Return publishedPatch (what was last shipped) so dev's watcher compares
      // against the actually-deployed version, not a locally-bumped counter.
      const shippedPatch = active.publishedPatch ?? active.patch;
      res.json({ major: active.major, minor: active.minor, patch: shippedPatch });
    } catch (err) {
      console.error("Changelog published-patch error:", err);
      res.status(500).json({ error: "Failed to read changelog" });
    }
  });

  /**
   * GET /api/developer/login-report
   * Returns all successful login audit events for a date window.
   * Admin/consultant only.
   *
   * Query parameters (any of):
   *   - range: "today" | "3d" | "7d" | "30d"  (preset window, default "today")
   *   - from:  YYYY-MM-DD                      (custom start, inclusive)
   *   - to:    YYYY-MM-DD                      (custom end,   inclusive)
   * Custom from/to (when both are provided) take priority over the preset.
   * For backwards-compat, ?date=YYYY-MM-DD acts as a single-day window.
   */
  app.get("/api/developer/export/documents", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const user = userId ? await storage.getUser(userId) : null;
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const result = await pool.query(`
        SELECT
          d.id, d.title, d.module, d.type, d.status, d.approval_status,
          d.source, d.scope, d.is_mandatory, d.is_archived,
          d.version, d.file_name, d.file_size, d.mime_type,
          u.full_name AS uploaded_by,
          s.name AS site_name, c.name AS company_name,
          t.name AS template_name,
          f.name AS folder_name,
          d.expiry_date, d.renewal_date, d.renewal_period_months, d.last_approved_at,
          d.case_id, d.incident_id,
          d.training_course_title, d.training_course_code, d.training_date,
          d.comments, d.created_at, d.updated_at
        FROM documents d
        LEFT JOIN users u ON u.id = d.uploaded_by
        LEFT JOIN sites s ON s.id = d.site_id
        LEFT JOIN companies c ON c.id = d.entity_id
        LEFT JOIN document_templates t ON t.id = d.template_id
        LEFT JOIN document_folders f ON f.id = d.folder_id
        ORDER BY d.created_at DESC
      `);
      await pool.end();
      const fields = result.fields.map((f: any) => f.name);
      const escape = (v: any) => {
        if (v === null || v === undefined) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [fields.join(","), ...result.rows.map((r: any) => fields.map((f: string) => escape(r[f])).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="documents_export_${new Date().toISOString().slice(0,10)}.csv"`);
      return res.send(csv);
    } catch (err) {
      console.error("Documents export error:", err);
      return res.status(500).json({ error: "Export failed" });
    }
  });

  app.get("/api/developer/login-report", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const user = userId ? await storage.getUser(userId) : null;
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const isDateStr = (v: unknown): v is string =>
        typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
      const todayStr = new Date().toISOString().slice(0, 10);

      let fromStr: string;
      let toStr: string;
      let range: "today" | "3d" | "7d" | "30d" | "custom" = "today";

      if (isDateStr(req.query.from) && isDateStr(req.query.to)) {
        fromStr = req.query.from;
        toStr = req.query.to;
        range = "custom";
      } else if (isDateStr(req.query.date)) {
        // Backwards-compat single-day mode
        fromStr = req.query.date;
        toStr = req.query.date;
        range = "custom";
      } else {
        const requested = String(req.query.range ?? "today");
        const days =
          requested === "30d" ? 30 :
          requested === "7d" ? 7 :
          requested === "3d" ? 3 :
          1;
        range = (requested === "30d" || requested === "7d" || requested === "3d") ? requested : "today";
        toStr = todayStr;
        const start = new Date(`${todayStr}T00:00:00`);
        start.setDate(start.getDate() - (days - 1));
        fromStr = start.toISOString().slice(0, 10);
      }

      // Guard: ensure from <= to (swap if reversed)
      if (fromStr > toStr) {
        [fromStr, toStr] = [toStr, fromStr];
      }

      const windowStart = new Date(`${fromStr}T00:00:00`).getTime();
      const windowEnd = new Date(`${toStr}T23:59:59.999`).getTime();

      const allLogs = await storage.getAuditLogs();
      const logins = allLogs.filter((log) => {
        if (log.action !== "login") return false;
        const t = new Date(log.createdAt).getTime();
        return t >= windowStart && t <= windowEnd;
      });

      res.json({ from: fromStr, to: toStr, range, logins });
    } catch (err) {
      console.error("Login report error:", err);
      res.status(500).json({ error: "Failed to fetch login report" });
    }
  });

  // /api/developer/active-users removed — replaced by SSE-based presence (/api/users/online)

  app.post("/api/changelog/bump-after-publish", requireAuth, async (req, res) => {
    try {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "Patch bumping is not allowed on the production server" });
      }
      const user = await changelogAdminGuard(req, res);
      if (!user) return;
      await bumpDevPatchAfterPublish();
      const cl = await readChangelog();
      const active = cl.versions.find((v) => v.id === cl.activeVersionId);
      res.json({ patch: active?.patch, publishedPatch: active?.publishedPatch });
    } catch (err) {
      console.error("Changelog bump-after-publish error:", err);
      res.status(500).json({ error: "Failed to bump patch" });
    }
  });

  // ---------------------------------------------------------------------------
  // Email Delivery Log (admin only)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/developer/email-logs
   * Returns a paginated, filtered list of emails sent via Resend.
   * Query params: page, pageSize, dateRange (24h|7d|15d|30d), status, search
   */
  app.get("/api/developer/email-logs", requireAuth, async (req: any, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Developer access required" });
      }

      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10)));
      const dateRange = String(req.query.dateRange ?? "7d");
      const statusFilter = String(req.query.status ?? "all");
      const search = String(req.query.search ?? "").toLowerCase().trim();

      // Compute cutoff date
      const now = Date.now();
      const rangeMs: Record<string, number> = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "15d": 15 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      };
      const cutoffMs = now - (rangeMs[dateRange] ?? rangeMs["7d"]);

      // Fetch emails from Resend up to a hard cap of 500 (5 batches of 100).
      // Resend does not support native date/status/text filtering, so we pull
      // chronologically-ordered batches, stop early once we leave the date range,
      // and filter server-side.  When we hit the cap without exhausting the date
      // range we set `truncated = true` so the UI can warn the admin.
      const FETCH_CAP = 500;
      const allEmails: ResendEmailSummary[] = [];
      let exhausted = false;
      let truncated = false;
      for (let offset = 0; offset < FETCH_CAP && !exhausted; offset += 100) {
        const { data, error } = await listResendEmails({ limit: 100, offset });
        if (error) {
          return res.status(502).json({ error: `Resend API error: ${error}` });
        }
        if (data.length === 0) { exhausted = true; break; }
        // Stop fetching when emails fall outside the requested date range
        for (const email of data) {
          const ts = email.sentAt ? new Date(email.sentAt).getTime() : 0;
          if (ts < cutoffMs) { exhausted = true; break; }
          allEmails.push(email);
        }
        if (data.length < 100) exhausted = true;
      }
      // If the loop ended because we reached the fetch cap (not because we ran
      // out of data or left the date range), signal truncation to the client.
      if (!exhausted && allEmails.length >= FETCH_CAP) truncated = true;

      // Apply status and text search filters to the fetched window
      const filtered = allEmails.filter((e) => {
        if (statusFilter !== "all" && e.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
        if (search) {
          const toStr = e.to.join(" ").toLowerCase();
          const subj = e.subject.toLowerCase();
          if (!toStr.includes(search) && !subj.includes(search)) return false;
        }
        return true;
      });

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const start = (page - 1) * pageSize;
      const paginated = filtered.slice(start, start + pageSize);

      return res.json({
        emails: paginated,
        total,
        page,
        pageSize,
        totalPages,
        environment: getResendEnvironment(),
        truncated,
      });
    } catch (err) {
      console.error("Email logs error:", err);
      res.status(500).json({ error: "Failed to fetch email logs" });
    }
  });

  /**
   * GET /api/developer/email-logs/:id
   * Returns full detail + event timeline for a single email.
   */
  app.get("/api/developer/email-logs/:id", requireAuth, async (req: any, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user || user.role !== "developer") {
        return res.status(403).json({ error: "Developer access required" });
      }

      const { data, error } = await getResendEmail(req.params.id);
      if (error) {
        const isNotFound = error === "Email not found" || error.toLowerCase().includes("not_found") || error.toLowerCase().includes("not found");
        return isNotFound
          ? res.status(404).json({ error: "Email not found" })
          : res.status(502).json({ error: `Resend API error: ${error}` });
      }
      if (!data) return res.status(404).json({ error: "Email not found" });

      return res.json({ email: data, environment: getResendEnvironment() });
    } catch (err) {
      console.error("Email detail error:", err);
      res.status(500).json({ error: "Failed to fetch email detail" });
    }
  });

  // ── Home Summary ────────────────────────────────────────────────────────────
  app.get("/api/home-summary", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const isPrivileged = user.role === "developer" || user.role === "consultant" || user.role === "administrator";

      // Get all documents visible to this user
      const allDocs = await storage.getDocuments();

      // Determine site scope for this user (documents + privileged incident filtering)
      let userSiteIds: string[] | null = null;
      // directClientSiteIds — only the sites explicitly assigned to this client (used for portfolio display)
      let directClientSiteIds: string[] = [];
      if (user.role === "client") {
        const clientSites = await storage.getClientSites(user.id);
        directClientSiteIds = clientSites.map((a) => a.siteId);
        if (user.companyId) {
          const companySitesRes = await pool.query<{ id: string }>(
            "SELECT id FROM sites WHERE entity_id = $1",
            [user.companyId]
          );
          userSiteIds = [...new Set([...directClientSiteIds, ...companySitesRes.rows.map((r) => r.id)])];
        } else {
          userSiteIds = directClientSiteIds;
        }
      } else if (user.role === "consultant") {
        const consultantSites = await storage.getConsultantSites(user.id);
        userSiteIds = consultantSites.map((a) => a.entityId);
      }
      // admins see all — userSiteIds stays null

      // Apply same filters as the items drill-down: exclude case, incident, and external docs
      const filteredDocs = allDocs.filter((d) =>
        !d.isArchived &&
        !d.caseId &&
        !d.incidentId &&
        d.source !== "external"
      );

      // Count only the docs the items list will actually show (site-scoped, within accessible sites).
      // Company-scoped docs (siteId == null) are excluded for non-admins to keep counts in sync with the list.
      const countableDocs = userSiteIds
        ? filteredDocs.filter((d) => d.siteId && userSiteIds!.includes(d.siteId))
        : filteredDocs; // admins see everything, including company-scoped docs

      const overdueCount = countableDocs.filter((d) => d.status === "overdue").length;
      const reviewCount = countableDocs.filter((d) => d.status === "approval_required").length;
      const pendingCount = countableDocs.filter((d) => d.approvalStatus === "pending").length;
      // Docs awaiting THIS client's sign-off: pending status, uploaded by someone else (consultant/admin)
      const pendingSignOffs = user.role === "client"
        ? countableDocs.filter((d) =>
            d.approvalStatus === "pending" &&
            d.uploadedBy !== user.id &&
            (!d.approvalRequestedFrom || d.approvalRequestedFrom === user.id)
          ).length
        : 0;

      // Incidents — clients see only incidents they reported
      let openIncidentCount = 0;
      if (user.role === "client") {
        const clientIncidentsRes = await pool.query<{ count: string }>(
          "SELECT COUNT(*) as count FROM incidents WHERE reported_by = $1 AND status IN ('reported','under_review') AND is_archived = false",
          [user.id]
        );
        openIncidentCount = parseInt(clientIncidentsRes.rows[0].count ?? "0", 10);
      } else {
        const incidentRes = await pool.query<{ count: string }>(
          userSiteIds
            ? `SELECT COUNT(*) as count FROM incidents WHERE site_id = ANY($1::varchar[]) AND status IN ('reported','under_review') AND is_archived = false`
            : "SELECT COUNT(*) as count FROM incidents WHERE status IN ('reported','under_review') AND is_archived = false",
          userSiteIds ? [userSiteIds] : []
        );
        openIncidentCount = parseInt(incidentRes.rows[0].count ?? "0", 10);
      }

      // Portfolio
      type PortfolioPrivileged = {
        assignedCompanies: { name: string; siteCount: number }[];
        assignedSites: { id: string; name: string; companyName: string | null; isPrimary: boolean }[];
        assignedCases: { id: string; reference: string; employeeName: string; companyName: string | null; status: string }[];
        sources: string[];
      };
      type PortfolioClient = { site: { id: string; name: string } | null; primaryConsultant: { id: string; name: string } | null; consultants?: { id: string; name: string; isPrimary: boolean }[]; sites: { id: string; name: string; companyName: string | null }[]; clientCompanies: { name: string; siteCount: number }[] };
      type Portfolio = PortfolioPrivileged | PortfolioClient | null;

      let portfolio: Portfolio = null;
      if (isPrivileged) {
        const consultantAssignments = await storage.getConsultantSites(user.id);
        const assignedSiteIds: string[] | null = (user.role === "developer" || user.role === "administrator") ? null : consultantAssignments.map((a) => a.entityId);

        type SiteRow = { id: string; name: string; company_name: string | null };
        let sitesData: { id: string; name: string; companyName: string | null; isPrimary: boolean }[] = [];
        if (assignedSiteIds) {
          if (assignedSiteIds.length > 0) {
            const placeholders = assignedSiteIds.map((_, i) => `$${i + 1}`).join(",");
            const sitesRes = await pool.query<SiteRow>(
              `SELECT s.id, s.name, c.name as company_name FROM sites s LEFT JOIN companies c ON s.entity_id = c.id WHERE s.id IN (${placeholders})`,
              assignedSiteIds
            );
            sitesData = sitesRes.rows.map((row) => {
              const assignment = consultantAssignments.find((a) => a.entityId === row.id);
              return { id: row.id, name: row.name, companyName: row.company_name, isPrimary: assignment?.isPrimary ?? false };
            });
          }
        } else {
          const sitesRes = await pool.query<SiteRow>(
            "SELECT s.id, s.name, c.name as company_name FROM sites s LEFT JOIN companies c ON s.entity_id = c.id ORDER BY c.name, s.name"
          );
          sitesData = sitesRes.rows.map((row) => ({ id: row.id, name: row.name, companyName: row.company_name, isPrimary: false }));
        }

        const companyMap = new Map<string, { name: string; siteCount: number }>();
        sitesData.forEach((s) => {
          if (s.companyName) {
            const existing = companyMap.get(s.companyName) ?? { name: s.companyName, siteCount: 0 };
            existing.siteCount++;
            companyMap.set(s.companyName, existing);
          }
        });

        type CaseRow = { id: string; case_reference: string; employee_name: string; company_name: string | null; status: string };
        let casesData: CaseRow[] = [];
        if (user.role === "consultant" && assignedSiteIds && assignedSiteIds.length > 0) {
          const placeholders = assignedSiteIds.map((_, i) => `$${i + 1}`).join(",");
          const casesRes = await pool.query<CaseRow>(
            `SELECT ca.id, ca.case_reference, ca.employee_name, c.name as company_name, ca.status FROM cases ca LEFT JOIN sites s ON ca.site_id = s.id LEFT JOIN companies c ON s.entity_id = c.id WHERE ca.site_id IN (${placeholders}) AND ca.status NOT IN ('closed','withdrawn') AND ca.is_archived = false LIMIT 50`,
            assignedSiteIds
          );
          casesData = casesRes.rows;
        } else if (user.role === "developer" || user.role === "administrator") {
          const casesRes = await pool.query<CaseRow>(
            "SELECT ca.id, ca.case_reference, ca.employee_name, c.name as company_name, ca.status FROM cases ca LEFT JOIN sites s ON ca.site_id = s.id LEFT JOIN companies c ON s.entity_id = c.id WHERE ca.status NOT IN ('closed','withdrawn') AND ca.is_archived = false ORDER BY ca.created_at DESC LIMIT 50"
          );
          casesData = casesRes.rows;
        }

        let sourcesData: string[] = [];
        try {
          if (user.role === "consultant" && assignedSiteIds && assignedSiteIds.length > 0) {
            const placeholders = assignedSiteIds.map((_, i) => `$${i + 1}`).join(",");
            const sourcesRes = await pool.query<{ src: string }>(
              `SELECT DISTINCT unnest(c.sources) as src FROM companies c JOIN sites s ON s.entity_id = c.id WHERE s.id IN (${placeholders})`,
              assignedSiteIds
            );
            sourcesData = sourcesRes.rows.map((r) => r.src).filter(Boolean);
          }
        } catch { /* skip if company has no sources column populated */ }

        portfolio = {
          assignedCompanies: Array.from(companyMap.entries()).map(([name, v]) => ({ name, siteCount: v.siteCount })),
          assignedSites: sitesData,
          sources: sourcesData,
        };
      } else {
        // Client portfolio: all consultants across ALL assigned sites (deduped)
        let primaryConsultant: { id: string; name: string } | null = null;
        let allConsultantsList: { id: string; name: string; isPrimary: boolean }[] = [];
        if (userSiteIds && userSiteIds.length > 0) {
          // Collect unique consultants across every site the client can access
          // (userSiteIds already includes direct assignments + all company sites).
          const seenIds = new Set<string>();
          const aggregated: { consultantId: string; isPrimary: boolean }[] = [];
          for (const siteId of userSiteIds) {
            const assignments = await storage.getConsultantAssignments(siteId);
            for (const a of assignments) {
              if (!seenIds.has(a.consultantId)) {
                seenIds.add(a.consultantId);
                aggregated.push({ consultantId: a.consultantId, isPrimary: !!a.isPrimary });
              } else if (a.isPrimary) {
                const existing = aggregated.find(x => x.consultantId === a.consultantId);
                if (existing) existing.isPrimary = true;
              }
            }
          }
          // Resolve user records, then sort: primary first, then alphabetical
          for (const a of aggregated) {
            const consultant = await storage.getUser(a.consultantId);
            if (consultant) {
              allConsultantsList.push({ id: consultant.id, name: consultant.fullName, isPrimary: a.isPrimary });
            }
          }
          allConsultantsList.sort((a, b) =>
            (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || a.name.localeCompare(b.name)
          );
          primaryConsultant = allConsultantsList.find(c => c.isPrimary) ?? allConsultantsList[0] ?? null;
          if (primaryConsultant) primaryConsultant = { id: primaryConsultant.id, name: primaryConsultant.name };
        }
        let siteInfo: { id: string; name: string } | null = null;
        if (user.companyId) {
          const companyRes = await pool.query<{ id: string; name: string }>(
            "SELECT id, name FROM companies WHERE id = $1",
            [user.companyId]
          );
          if (companyRes.rows.length > 0) {
            siteInfo = { id: companyRes.rows[0].id, name: companyRes.rows[0].name };
          }
        }
        // Fetch only directly-assigned sites for portfolio display
        // (userSiteIds also includes all company sites for doc/incident scoping, but the
        //  portfolio should reflect the admin-managed site assignments so SSE updates are visible)
        let clientSitesList: { id: string; name: string; companyName: string | null }[] = [];
        let clientCompaniesList: { name: string; siteCount: number }[] = [];
        if (directClientSiteIds.length > 0) {
          const sPlaceholders = directClientSiteIds.map((_, i) => `$${i + 1}`).join(",");
          const sitesRes = await pool.query<{ id: string; name: string; company_name: string | null }>(
            `SELECT s.id, s.name, c.name as company_name FROM sites s LEFT JOIN companies c ON s.entity_id = c.id WHERE s.id IN (${sPlaceholders}) ORDER BY c.name, s.name`,
            directClientSiteIds
          );
          clientSitesList = sitesRes.rows.map((r) => ({ id: r.id, name: r.name, companyName: r.company_name }));
          // Build grouped company list
          const companyMap = new Map<string, number>();
          for (const row of sitesRes.rows) {
            const cn = row.company_name ?? "Unknown";
            companyMap.set(cn, (companyMap.get(cn) ?? 0) + 1);
          }
          clientCompaniesList = Array.from(companyMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([name, siteCount]) => ({ name, siteCount }));
        }
        portfolio = { site: siteInfo, primaryConsultant, consultants: allConsultantsList, sites: clientSitesList, clientCompanies: clientCompaniesList };
      }

      // Portal messages visible to this user (banners separated)
      const allMessages = await storage.getPortalMessages({ publishedOnly: true, role: user.role });
      const messages = allMessages.filter((m) => m.type !== "banner");
      const bannerMessages = allMessages.filter((m) => m.type === "banner");

      // Pending module access requests (admin only)
      let pendingAccessRequests = 0;
      if (user.role === "developer") {
        const accessRes = await pool.query<{ count: string }>(
          "SELECT COUNT(*) as count FROM module_access_requests WHERE status = 'pending'"
        );
        pendingAccessRequests = parseInt(accessRes.rows[0].count ?? "0", 10);
      }

      // Open cases count (admin/consultant only)
      let openCasesCount = 0;
      if (isPrivileged) {
        const portfolio2 = portfolio as { assignedSites?: { id: string }[] } | null;
        const siteIds2 = user.role === "consultant" && portfolio2
          ? (portfolio2.assignedSites ?? []).map((s) => s.id)
          : null;
        if (user.role === "developer" || user.role === "administrator") {
          const r = await pool.query<{ count: string }>(
            "SELECT COUNT(*) as count FROM cases WHERE status NOT IN ('closed','withdrawn') AND is_archived = false"
          );
          openCasesCount = parseInt(r.rows[0].count ?? "0", 10);
        } else if (siteIds2 && siteIds2.length > 0) {
          const placeholders = siteIds2.map((_, i) => `$${i + 1}`).join(",");
          const r = await pool.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM cases WHERE site_id IN (${placeholders}) AND status NOT IN ('closed','withdrawn') AND is_archived = false`,
            siteIds2
          );
          openCasesCount = parseInt(r.rows[0].count ?? "0", 10);
        }
      }

      // Assigned consultants — pro consultants who have others reporting to them
      let assignedConsultants: { id: string; fullName: string; consultantTier: string | null; sources: string[] | null }[] = [];
      if (user.role === "consultant" && user.consultantTier === "pro") {
        const staff = await storage.getConsultantsByManager(user.id);
        assignedConsultants = staff.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          consultantTier: c.consultantTier ?? null,
          sources: Array.isArray(c.sources) ? c.sources : null,
        }));
      }

      res.json({
        urgentActions: {
          overdueDocuments: overdueCount,
          approvalRequiredDocuments: reviewCount,
          pendingApprovals: pendingCount,
          openIncidents: openIncidentCount,
          pendingSignOffs,
          pendingAccessRequests,
          openCases: openCasesCount,
        },
        portfolio,
        portalMessages: messages,
        bannerMessages,
        assignedConsultants,
      });
    } catch (err) {
      console.error("Home summary error:", err);
      res.status(500).json({ error: "Failed to fetch home summary" });
    }
  });

  // ── Sidebar alert-count badges ───────────────────────────────────────────────
  // Returns unseen counts per surface (home, calendar, cloud-share-per-module),
  // computed as items whose "became actionable" time is after the user's last-seen
  // marker for that surface. Surfaces with no marker yet are lazily initialised to
  // "now" so a brand-new user starts at 0 and only future items are counted.
  const CLOUD_SHARE_MODULES = ["health_safety", "human_resources", "employment_law"] as const;

  app.get("/api/alert-counts", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const isPrivileged = user.role === "developer" || user.role === "consultant" || user.role === "administrator";
      const isAdminLike = user.role === "developer" || user.role === "administrator";
      const now = new Date();

      // Load existing markers.
      // home/calendar: initialise to "now" on first call so existing items don't
      //   create a huge badge on first login.
      // ishare/cloudshare: treat a missing record as epoch so files uploaded while
      //   the user was offline still show as new until they visit the page.
      const surfaces = ["home", "ishare", ...CLOUD_SHARE_MODULES.map((m) => `cloudshare:${m}`)];
      const seen = await storage.getAlertSeen(user.id);
      for (const s of surfaces) {
        if (!seen[s]) {
          if (s === "home") {
            await storage.markAlertSeen(user.id, s);
            seen[s] = now;
          } else {
            // Don't persist — page visit via markAlertSurfaceSeen will set it.
            seen[s] = new Date(0);
          }
        }
      }
      const seenHome = seen["home"];

      // ── Site scope for HOME (mirrors /api/home-summary) ──────────────────────
      let userSiteIds: string[] | null = null; // null = all (admin/developer)
      if (user.role === "client") {
        const clientSites = await storage.getClientSites(user.id);
        const directIds = clientSites.map((a) => a.siteId);
        if (user.companyId) {
          const companySitesRes = await pool.query<{ id: string }>(
            "SELECT id FROM sites WHERE entity_id = $1",
            [user.companyId]
          );
          userSiteIds = [...new Set([...directIds, ...companySitesRes.rows.map((r) => r.id)])];
        } else {
          userSiteIds = directIds;
        }
      } else if (user.role === "consultant") {
        const consultantSites = await storage.getConsultantSites(user.id);
        userSiteIds = consultantSites.map((a) => a.entityId);
      }

      // ===== HOME =====
      const allDocs = await storage.getDocuments();
      const filteredDocs = allDocs.filter(
        (d) => !d.isArchived && !d.caseId && !d.incidentId && d.source !== "external"
      );
      const countableDocs = userSiteIds
        ? filteredDocs.filter((d) => d.siteId && userSiteIds!.includes(d.siteId))
        : filteredDocs;

      const afterHome = (t: Date | string | null | undefined): boolean =>
        !!t && new Date(t).getTime() > seenHome.getTime();

      // For a doc that became overdue when a date passed, "became actionable" is the
      // due/expiry date it crossed (floored at creation), not its creation time.
      const overdueBecameActionable = (d: any): Date => {
        const created = new Date(d.createdAt);
        const candidates = [d.expiryDate, d.renewalDate]
          .filter(Boolean)
          .map((x: any) => new Date(x))
          .filter((x: Date) => x.getTime() <= now.getTime());
        let t = candidates.length
          ? new Date(Math.max(...candidates.map((x) => x.getTime())))
          : new Date(d.updatedAt ?? d.createdAt);
        if (t.getTime() < created.getTime()) t = created;
        return t;
      };

      let homeCount = 0;
      for (const d of countableDocs) {
        if (d.status === "overdue") {
          if (afterHome(overdueBecameActionable(d))) homeCount++;
        } else if (d.status === "approval_required" && user.role !== "client") {
          // Clients' sign-off tasks are already covered by the approvalStatus check
          // below; counting approval_required by updatedAt for clients causes false
          // positives when a consultant requests changes (bumping updatedAt without
          // adding any new task for the client).
          if (afterHome(d.updatedAt ?? d.createdAt)) homeCount++;
        }
        // Pending approvals (privileged) / pending sign-offs (client) — mirror the
        // role gating used by the Urgent Actions panel.
        if (d.approvalStatus === "pending") {
          if (isPrivileged) {
            if (afterHome(d.updatedAt ?? d.createdAt)) homeCount++;
          } else if (user.role === "client") {
            if (
              d.uploadedBy !== user.id &&
              (!d.approvalRequestedFrom || d.approvalRequestedFrom === user.id) &&
              afterHome(d.updatedAt ?? d.createdAt)
            ) {
              homeCount++;
            }
          }
        }
      }

      // Open incidents (all roles) — clients see only incidents they reported.
      if (user.role === "client") {
        const r = await pool.query<{ count: string }>(
          "SELECT COUNT(*) as count FROM incidents WHERE reported_by = $1 AND status IN ('reported','under_review') AND is_archived = false AND created_at > $2",
          [user.id, seenHome]
        );
        homeCount += parseInt(r.rows[0].count ?? "0", 10);
      } else {
        const r = await pool.query<{ count: string }>(
          userSiteIds
            ? "SELECT COUNT(*) as count FROM incidents WHERE site_id = ANY($1::varchar[]) AND status IN ('reported','under_review') AND is_archived = false AND created_at > $2"
            : "SELECT COUNT(*) as count FROM incidents WHERE status IN ('reported','under_review') AND is_archived = false AND created_at > $1",
          userSiteIds ? [userSiteIds, seenHome] : [seenHome]
        );
        homeCount += parseInt(r.rows[0].count ?? "0", 10);
      }

      // Open cases (privileged only).
      if (isPrivileged) {
        if (isAdminLike) {
          const r = await pool.query<{ count: string }>(
            "SELECT COUNT(*) as count FROM cases WHERE status NOT IN ('closed','withdrawn') AND is_archived = false AND created_at > $1",
            [seenHome]
          );
          homeCount += parseInt(r.rows[0].count ?? "0", 10);
        } else if (userSiteIds && userSiteIds.length > 0) {
          const r = await pool.query<{ count: string }>(
            "SELECT COUNT(*) as count FROM cases WHERE site_id = ANY($1::varchar[]) AND status NOT IN ('closed','withdrawn') AND is_archived = false AND created_at > $2",
            [userSiteIds, seenHome]
          );
          homeCount += parseInt(r.rows[0].count ?? "0", 10);
        }
      }

      // Pending module access requests (developer only).
      if (user.role === "developer") {
        const r = await pool.query<{ count: string }>(
          "SELECT COUNT(*) as count FROM module_access_requests WHERE status = 'pending' AND created_at > $1",
          [seenHome]
        );
        homeCount += parseInt(r.rows[0].count ?? "0", 10);
      }

      // ===== CLOUD SHARE (per module) =====
      const cloudshare: Record<string, number> = {
        health_safety: 0,
        human_resources: 0,
        employment_law: 0,
      };
      let effectiveCompanyIds: string[] | undefined;
      if (user.role === "client" && user.companyId) {
        effectiveCompanyIds = Array.from(await getEffectiveCompanyIds(user.companyId));
      }
      const activity = await storage.getCloudShareActivityForUser({
        userId: user.id,
        userRole: user.role,
        userCompanyId: user.companyId ?? null,
        effectiveCompanyIds,
      });
      for (const m of CLOUD_SHARE_MODULES) {
        const sinceTs = seen[`cloudshare:${m}`].getTime();
        let c = 0;
        // Only count actual file uploads — not folder creation. Folders are
        // structural and don't represent new content to review; counting them
        // causes the badge to stay elevated after files are deleted from a folder.
        for (const f of activity.files) {
          if (f.module === m && f.createdAt.getTime() > sinceTs && f.uploadedBy !== user.id) c++;
        }
        cloudshare[m] = c;
      }

      // ===== iSHARE (single surface, non-client only) =====
      let ishare = 0;
      if (isPrivileged) {
        const sinceTs = seen["ishare"].getTime();
        const ishareActivity = await storage.getIshareActivityForUser({
          userId: user.id,
          userRole: user.role,
        });
        for (const f of ishareActivity.files) {
          if (f.createdAt.getTime() > sinceTs && f.uploadedBy !== user.id) ishare++;
        }
      }

      res.json({ home: homeCount, cloudshare, ishare });
    } catch (err) {
      console.error("Alert counts error:", err);
      res.status(500).json({ error: "Failed to fetch alert counts" });
    }
  });

  // Mark a surface as seen ("now"), called when the user opens/views that surface.
  app.post("/api/alert-counts/seen", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const surface = (req.body?.surface ?? "").toString();
      const valid =
        surface === "home" ||
        surface === "ishare" ||
        CLOUD_SHARE_MODULES.some((m) => surface === `cloudshare:${m}`);
      if (!valid) return res.status(400).json({ error: "Invalid surface" });
      await storage.markAlertSeen(user.id, surface);
      res.json({ ok: true });
    } catch (err) {
      console.error("Mark alert seen error:", err);
      res.status(500).json({ error: "Failed to mark surface seen" });
    }
  });

  // ── Home Summary Items (modal drill-down) ────────────────────────────────────
  app.get("/api/home-summary/items", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const type = (req.query.type as string) ?? "";
      const isPrivileged = user.role === "developer" || user.role === "consultant" || user.role === "administrator";

      // Determine site scope
      let userSiteIds: string[] | null = null;
      if (user.role === "client") {
        const clientSites = await storage.getClientSites(user.id);
        const directSiteIds = clientSites.map((a) => a.siteId);
        if (user.companyId) {
          const companySitesRes = await pool.query<{ id: string }>(
            "SELECT id FROM sites WHERE entity_id = $1",
            [user.companyId]
          );
          userSiteIds = [...new Set([...directSiteIds, ...companySitesRes.rows.map((r) => r.id)])];
        } else {
          userSiteIds = directSiteIds;
        }
      } else if (user.role === "consultant") {
        const consultantSites = await storage.getConsultantSites(user.id);
        userSiteIds = consultantSites.map((a) => a.entityId);
      }

      type SummaryItem = { id: string; label: string; subLabel: string | null; href: string; badge: string | null; badgeColor: string | null };
      let items: SummaryItem[] = [];

      if (["overdue_documents", "approval_required", "pending_approvals", "pending_sign_offs"].includes(type)) {
        if (type === "pending_approvals" && !isPrivileged) return res.json({ type, items: [] });
        if (userSiteIds?.length === 0) return res.json({ type, items: [] });

        const filterClause =
          type === "overdue_documents" ? "d.status = 'overdue'" :
          type === "approval_required" ? "d.status = 'approval_required'" :
          "d.approval_status = 'pending'";

        const params: unknown[] = [];
        let query = `
          SELECT d.id, d.title, d.module, d.status, d.approval_status, d.uploaded_by, s.name as site_name
          FROM documents d
          LEFT JOIN sites s ON d.site_id = s.id
          WHERE d.is_archived = false
            AND d.case_id IS NULL
            AND d.incident_id IS NULL
            AND d.source != 'external'
            AND ${filterClause}
        `;

        if (userSiteIds && userSiteIds.length > 0) {
          params.push(userSiteIds);
          query += ` AND d.site_id = ANY($${params.length}::varchar[])`;
        }
        if (type === "pending_sign_offs") {
          params.push(user.id);
          query += ` AND d.uploaded_by != $${params.length}`;
          params.push(user.id);
          query += ` AND (d.approval_requested_from IS NULL OR d.approval_requested_from = $${params.length})`;
        }
        query += " ORDER BY d.title LIMIT 50";

        type DocRow = { id: string; title: string; module: string | null; status: string; site_name: string | null };
        const result = await pool.query<DocRow>(query, params);

        const modulePathMap: Record<string, string> = {
          health_safety: "/health-safety/documents",
          human_resources: "/human-resources/documents",
          employment_law: "/employment-law/documents",
        };
        const badgeColorMap: Record<string, string> = {
          overdue_documents: "red",
          approval_required: "amber",
          pending_approvals: "blue",
          pending_sign_offs: "violet",
        };
        items = result.rows.map((row) => {
          const basePath = row.module ? (modulePathMap[row.module] ?? "/documents") : "/documents";
          return {
            id: row.id,
            label: row.title,
            subLabel: row.site_name ?? null,
            href: `${basePath}/${row.id}`,
            badge: row.module ?? row.status ?? null,
            badgeColor: badgeColorMap[type] ?? null,
          };
        });

      } else if (type === "open_incidents") {
        if (userSiteIds?.length === 0 && user.role !== "client") return res.json({ type, items: [] });

        const params: unknown[] = [];
        let query = `
          SELECT i.id, i.title, i.severity, i.status, i.incident_reference, s.name as site_name
          FROM incidents i
          LEFT JOIN sites s ON i.site_id = s.id
          WHERE i.is_archived = false AND i.status IN ('reported','under_review')
        `;
        if (user.role === "client") {
          params.push(user.id);
          query += ` AND i.reported_by = $${params.length}`;
        } else if (userSiteIds && userSiteIds.length > 0) {
          params.push(userSiteIds);
          query += ` AND i.site_id = ANY($${params.length}::varchar[])`;
        }
        query += " ORDER BY i.created_at DESC LIMIT 50";

        type IncidentRow = { id: string; title: string; severity: string | null; status: string; incident_reference: string | null; site_name: string | null };
        const result = await pool.query<IncidentRow>(query, params);
        items = result.rows.map((row) => ({
          id: row.id,
          label: row.title,
          subLabel: row.site_name ?? null,
          href: `/health-safety/incidents/${row.id}`,
          badge: row.severity ?? row.status ?? null,
          badgeColor: row.severity === "high" || row.severity === "critical" ? "red" : "orange",
        }));

      } else if (type === "open_cases" && isPrivileged) {
        let userSiteIdsForCases: string[] | null = userSiteIds;
        const params: unknown[] = [];
        let query = `
          SELECT ca.id, ca.case_reference, ca.employee_name, ca.status, c.name as company_name
          FROM cases ca
          LEFT JOIN sites s ON ca.site_id = s.id
          LEFT JOIN companies c ON s.entity_id = c.id
          WHERE ca.status NOT IN ('closed','withdrawn') AND ca.is_archived = false
        `;
        if (user.role === "consultant" && userSiteIdsForCases && userSiteIdsForCases.length > 0) {
          params.push(userSiteIdsForCases);
          query += ` AND ca.site_id = ANY($${params.length}::varchar[])`;
        }
        query += " ORDER BY ca.created_at DESC LIMIT 50";
        type CaseItemRow = { id: string; case_reference: string; employee_name: string; status: string; company_name: string | null };
        const result = await pool.query<CaseItemRow>(query, params);
        items = result.rows.map((row) => ({
          id: row.id,
          label: `${row.case_reference} — ${row.employee_name}`,
          subLabel: row.company_name ?? null,
          href: `/employment-law/cases/${row.id}`,
          badge: row.status.replace(/_/g, " "),
          badgeColor: row.status === "open" || row.status === "active" ? "teal" : "amber",
        }));

      } else if (type === "access_requests" && user.role === "developer") {
        type RequestRow = { id: string; site_name: string; module: string; requested_by_name: string };
        const result = await pool.query<RequestRow>(
          "SELECT id, site_name, module, requested_by_name FROM module_access_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50"
        );
        items = result.rows.map((row) => ({
          id: row.id,
          label: `${row.module} — ${row.site_name}`,
          subLabel: `Requested by ${row.requested_by_name}`,
          href: `/companies`,
          badge: "pending",
          badgeColor: "indigo",
        }));
      }

      return res.json({ type, items });
    } catch (err) {
      console.error("Home summary items error:", err);
      res.status(500).json({ error: "Failed to fetch items" });
    }
  });

  // ── Key Contacts ──────────────────────────────────────────────────────────────
  app.get("/api/key-contacts/user-ids", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user || user.role === "client") return res.status(403).json({ error: "Forbidden" });
      const ids = await storage.getAllKeyContactUserIds();
      return res.json(ids);
    } catch (err) {
      console.error("Get key contact user IDs error:", err);
      return res.status(500).json({ error: "Failed to fetch key contact user IDs" });
    }
  });

  app.get("/api/key-contacts", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user || user.role === "client") return res.status(403).json({ error: "Forbidden" });

      const { entityType, entityId } = req.query;
      if (!entityType || !entityId || typeof entityType !== "string" || typeof entityId !== "string") {
        return res.status(400).json({ error: "entityType and entityId are required" });
      }
      if (entityType !== "company" && entityType !== "site") {
        return res.status(400).json({ error: "entityType must be 'company' or 'site'" });
      }

      const contacts = await storage.getKeyContacts(entityType as "company" | "site", entityId);
      return res.json(contacts);
    } catch (err) {
      console.error("Get key contacts error:", err);
      return res.status(500).json({ error: "Failed to fetch key contacts" });
    }
  });

  app.post("/api/key-contacts", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "developer" && !hasProPrivileges(user)) return res.status(403).json({ error: "Developer or Pro Consultant access required" });

      const schema = z.object({
        userId: z.string().min(1),
        entityType: z.enum(["company", "site"]),
        entityId: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const { userId, entityType, entityId } = parsed.data;

      // Block if the user is already the primary contact for this entity
      if (entityType === "company") {
        const company = await storage.getCompany(entityId);
        if (company?.contactUserId === userId) {
          return res.status(409).json({ error: "User is already the primary contact for this company" });
        }
      } else {
        const site = await storage.getSite(entityId);
        const company = site?.companyId ? await storage.getCompany(site.companyId) : undefined;
        if (company?.contactUserId === userId) {
          return res.status(409).json({ error: "User is already the primary contact for this site's company" });
        }
      }

      const contact = await storage.addKeyContact(userId, entityType, entityId);

      // Propagate: key contact at any level = key contact at all levels.
      // Resolve the company and all assigned sites for this user, then silently
      // add key contact entries for every related entity (ignore duplicates / primary-contact conflicts).
      const tryAdd = async (type: "company" | "site", id: string) => {
        try { await storage.addKeyContact(userId, type, id); } catch { /* already exists or not applicable */ }
      };

      const allSiteAssignments = await storage.getClientSites(userId);

      if (entityType === "site") {
        const site = await storage.getSite(entityId);
        if (site?.companyId) {
          await tryAdd("company", site.companyId);
          // Also propagate to every other site the user is assigned to for this company
          for (const sa of allSiteAssignments) {
            if (sa.siteId !== entityId) {
              const s = await storage.getSite(sa.siteId);
              if (s?.companyId === site.companyId) await tryAdd("site", sa.siteId);
            }
          }
        }
      } else {
        // entityType === "company": propagate to all assigned sites for this company
        for (const sa of allSiteAssignments) {
          const s = await storage.getSite(sa.siteId);
          if (s?.companyId === entityId) await tryAdd("site", sa.siteId);
        }
      }

      return res.status(201).json(contact);
    } catch (err: any) {
      if (err?.code === "PRIMARY_CONTACT") {
        return res.status(409).json({ error: err.message });
      }
      if (err?.code === "NOT_CLIENT") {
        return res.status(422).json({ error: err.message });
      }
      if (err?.code === "23505") {
        return res.status(409).json({ error: "User is already a key contact for this entity" });
      }
      console.error("Add key contact error:", err);
      return res.status(500).json({ error: "Failed to add key contact" });
    }
  });

  app.delete("/api/key-contacts/:userId/:entityType/:entityId", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "developer" && !hasProPrivileges(user)) return res.status(403).json({ error: "Developer or Pro Consultant access required" });

      const { userId, entityType, entityId } = req.params;
      if (entityType !== "company" && entityType !== "site") {
        return res.status(400).json({ error: "entityType must be 'company' or 'site'" });
      }

      const ok = await storage.removeKeyContact(userId, entityType as "company" | "site", entityId);
      if (!ok) return res.status(404).json({ error: "Key contact not found" });

      // Cascade remove: removing at any level removes at all levels.
      const tryRemove = async (type: "company" | "site", id: string) => {
        try { await storage.removeKeyContact(userId, type, id); } catch { /* non-fatal */ }
      };

      const allSiteAssignments = await storage.getClientSites(userId);

      if (entityType === "site") {
        const site = await storage.getSite(entityId);
        if (site?.companyId) {
          await tryRemove("company", site.companyId);
          for (const sa of allSiteAssignments) {
            if (sa.siteId !== entityId) {
              const s = await storage.getSite(sa.siteId);
              if (s?.companyId === site.companyId) await tryRemove("site", sa.siteId);
            }
          }
        }
      } else {
        // entityType === "company": remove from all assigned sites for this company
        for (const sa of allSiteAssignments) {
          const s = await storage.getSite(sa.siteId);
          if (s?.companyId === entityId) await tryRemove("site", sa.siteId);
        }
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("Remove key contact error:", err);
      return res.status(500).json({ error: "Failed to remove key contact" });
    }
  });

  // ── Portal Messages ──────────────────────────────────────────────────────────
  app.get("/api/portal-messages", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      if (user.role === "developer") {
        const messages = await storage.getPortalMessages();
        return res.json(messages);
      }
      // Other roles: published only, role-filtered
      const messages = await storage.getPortalMessages({ publishedOnly: true, role: user.role });
      return res.json(messages);
    } catch (err) {
      console.error("Portal messages error:", err);
      res.status(500).json({ error: "Failed to fetch portal messages" });
    }
  });

  app.post("/api/portal-messages", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer access required" });

      const { insertPortalMessageSchema } = await import("@shared/schema");
      // Coerce ISO string timestamps to Date objects (frontend sends strings)
      const coerced = {
        ...req.body,
        createdBy: user.id,
        publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : null,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      };
      const parsed = insertPortalMessageSchema.safeParse(coerced);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const message = await storage.createPortalMessage(parsed.data);
      return res.status(201).json(message);
    } catch (err) {
      console.error("Create portal message error:", err);
      res.status(500).json({ error: "Failed to create portal message" });
    }
  });

  app.patch("/api/portal-messages/:id", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer access required" });

      const existing = await storage.getPortalMessage(req.params.id);
      if (!existing) return res.status(404).json({ error: "Message not found" });

      const patchSchema = z.object({
        title: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        type: z.enum(["update", "feature", "training", "guidance", "news", "banner"]).optional(),
        targetRoles: z.array(z.string()).optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        pinned: z.boolean().optional(),
        // Accept ISO strings or Date objects; coerce strings to Date; preserve undefined (field not included in patch)
        publishedAt: z.preprocess(v => typeof v === "string" ? new Date(v) : v, z.date().nullable().optional()),
        expiresAt: z.preprocess(v => typeof v === "string" ? new Date(v) : v, z.date().nullable().optional()),
        ctaType: z.enum(["none", "make_enquiry", "navigate_to_link", "book_now", "contact_consultant", "download"]).optional(),
        ctaUrl: z.string().nullable().optional(),
        ctaLabel: z.string().nullable().optional(),
      });
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const updated = await storage.updatePortalMessage(req.params.id, parsed.data);
      return res.json(updated);
    } catch (err) {
      console.error("Update portal message error:", err);
      res.status(500).json({ error: "Failed to update portal message" });
    }
  });

  app.get("/api/my-actions", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const userId = user.id;
      const now = new Date();
      const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      // 1. Documents overdue or expiring within 14 days — excluding docs already in
      //    the "Awaiting My Approval" or "Changes Requested" tiles.
      let assignedDocsRows: { id: string; title: string; site_id: string | null; module: string | null; status: string; renewal_date: string | null; expiry_date: string | null; site_name: string | null; company_name: string | null }[] = [];

      if (user.role === "consultant" || user.role === "developer" || user.role === "administrator") {
        let siteFilter = "";
        const adParams: unknown[] = [in14Days];
        if (user.role === "consultant") {
          const consultantSites = await storage.getConsultantSites(userId);
          const siteIds = consultantSites.map((s) => s.entityId);
          if (siteIds.length > 0) {
            adParams.push(siteIds);
            siteFilter = `AND d.site_id = ANY($${adParams.length}::varchar[])`;
          } else {
            siteFilter = "AND false"; // consultant with no sites — nothing to show
          }
        }
        const adRes = await pool.query<{ id: string; title: string; site_id: string | null; module: string | null; status: string; renewal_date: string | null; expiry_date: string | null; site_name: string | null; company_name: string | null }>(
          `SELECT d.id, d.title, d.site_id, d.module, d.status, d.renewal_date, d.expiry_date,
                  s.name AS site_name,
                  COALESCE(sc.name, ec.name) AS company_name
           FROM documents d
           LEFT JOIN sites s ON s.id = d.site_id
           LEFT JOIN companies sc ON sc.id = s.entity_id
           LEFT JOIN companies ec ON ec.id = d.entity_id AND d.site_id IS NULL
           WHERE d.is_archived = false
             AND d.case_id IS NULL AND d.incident_id IS NULL
             AND d.approval_status NOT IN ('client_signed_off', 'changes_requested')
             AND (
               (d.renewal_date IS NOT NULL AND d.renewal_date <= $1)
               OR (d.expiry_date IS NOT NULL AND d.expiry_date <= $1)
             )
             ${siteFilter}
           ORDER BY LEAST(
             COALESCE(d.renewal_date, '9999-12-31'),
             COALESCE(d.expiry_date, '9999-12-31')
           ) ASC
           LIMIT 50`,
          adParams
        );
        assignedDocsRows = adRes.rows;
      } else if (user.role === "client") {
        const clientSites = await storage.getClientSites(userId);
        const directSiteIds = clientSites.map((s) => s.siteId);
        let allClientSiteIds = [...directSiteIds];
        if (user.companyId) {
          const companySitesRes = await pool.query<{ id: string }>(
            "SELECT id FROM sites WHERE entity_id = $1",
            [user.companyId]
          );
          allClientSiteIds = [...new Set([...directSiteIds, ...companySitesRes.rows.map((r) => r.id)])];
        }
        if (allClientSiteIds.length > 0) {
          const adRes = await pool.query<{ id: string; title: string; site_id: string | null; module: string | null; status: string; renewal_date: string | null; expiry_date: string | null; site_name: string | null; company_name: string | null }>(
            `SELECT d.id, d.title, d.site_id, d.module, d.status, d.renewal_date, d.expiry_date,
                    s.name AS site_name, c.name AS company_name
             FROM documents d
             LEFT JOIN sites s ON s.id = d.site_id
             LEFT JOIN companies c ON c.id = s.entity_id
             WHERE d.is_archived = false
               AND d.site_id = ANY($1::varchar[])
               AND NOT (
                 d.approval_status = 'pending'
                 AND (d.approval_requested_from IS NULL OR d.approval_requested_from = $2)
                 AND d.uploaded_by != $2
               )
               AND d.approval_status != 'changes_requested'
               AND (
                 (d.renewal_date IS NOT NULL AND d.renewal_date <= $3)
                 OR (d.expiry_date IS NOT NULL AND d.expiry_date <= $3)
               )
             ORDER BY LEAST(
               COALESCE(d.renewal_date, '9999-12-31'),
               COALESCE(d.expiry_date, '9999-12-31')
             ) ASC
             LIMIT 50`,
            [allClientSiteIds, userId, in14Days]
          );
          assignedDocsRows = adRes.rows;
        }
      }
      const assignedDocsRes = { rows: assignedDocsRows };

      // 2. Documents awaiting this user's approval
      let pendingApprovalsRows: { id: string; title: string; site_id: string | null; module: string | null; renewal_date: string | null; expiry_date: string | null; updated_at: string | null; site_name: string | null; company_name: string | null }[] = [];

      // Group/company-scoped docs have site_id = NULL, so site-id-based filters can
      // never match them. This helper pulls scoped pending docs for the given
      // approval_status and gates each one through the unified document access
      // check, so legitimately-accessible scoped docs appear in My actions.
      // Access is enforced per-row (not via the LIMIT), so the cap only bounds cost.
      const accessibleScopedPending = async (
        approvalStatus: string,
        applyClientFilters: boolean,
      ): Promise<{ id: string; title: string; site_id: string | null; module: string | null; renewal_date: string | null; expiry_date: string | null; updated_at: string | null; site_name: string | null; company_name: string | null }[]> => {
        const params: unknown[] = [approvalStatus];
        let extra = "";
        if (applyClientFilters) {
          params.push(userId);
          extra = `AND d.uploaded_by != $2 AND (d.approval_requested_from IS NULL OR d.approval_requested_from = $2)`;
        }
        const r = await pool.query<{ id: string; title: string; site_id: string | null; module: string | null; scope: string | null; entity_id: string | null; renewal_date: string | null; expiry_date: string | null; updated_at: string | null; company_name: string | null }>(
          `SELECT d.id, d.title, d.site_id, d.module, d.scope, d.entity_id, d.renewal_date, d.expiry_date, d.updated_at,
                  c.name AS company_name
           FROM documents d
           LEFT JOIN companies c ON c.id = d.entity_id
           WHERE d.approval_status = $1
             AND d.site_id IS NULL AND d.scope IN ('company','group') AND d.is_archived = false
             AND d.case_id IS NULL AND d.incident_id IS NULL
             ${extra}
           ORDER BY d.created_at DESC, d.id DESC LIMIT 200`,
          params
        );
        const access = await Promise.all(
          r.rows.map((d) =>
            canUserAccessDocument(user, { id: d.id, siteId: d.site_id, scope: d.scope, entityId: d.entity_id })
          )
        );
        return r.rows
          .filter((_, i) => access[i])
          .map((d) => ({ id: d.id, title: d.title, site_id: d.site_id, module: d.module, renewal_date: d.renewal_date, expiry_date: d.expiry_date, updated_at: d.updated_at, site_name: null, company_name: d.company_name }));
      };

      const mergePending = (extra: { id: string; title: string; site_id: string | null; module: string | null; renewal_date: string | null; expiry_date: string | null; updated_at: string | null; site_name: string | null; company_name: string | null }[]) => {
        const seen = new Set(pendingApprovalsRows.map((r) => r.id));
        for (const row of extra) {
          if (!seen.has(row.id)) {
            pendingApprovalsRows.push(row);
            seen.add(row.id);
          }
        }
      };

      if (user.role === "consultant" || user.role === "developer" || user.role === "administrator") {
        // Consultant/developer/admin: docs where client has signed off, awaiting their final approval.
        // Administrators can't personally approve but may still want visibility of outstanding sign-offs.
        let sitesFilter = "";
        const params: unknown[] = ["client_signed_off"];
        if (user.role === "consultant") {
          const consultantSites = await storage.getConsultantSites(userId);
          const siteIds = consultantSites.map((s) => s.entityId);
          if (siteIds.length > 0) {
            sitesFilter = "AND site_id = ANY($2::varchar[])";
            params.push(siteIds);
          }
        }
        const res2 = await pool.query<{ id: string; title: string; site_id: string | null; module: string | null; renewal_date: string | null; expiry_date: string | null; updated_at: string | null; site_name: string | null; company_name: string | null }>(
          `SELECT d.id, d.title, d.site_id, d.module, d.renewal_date, d.expiry_date, d.updated_at,
                  s.name AS site_name,
                  COALESCE(sc.name, ec.name) AS company_name
           FROM documents d
           LEFT JOIN sites s ON s.id = d.site_id
           LEFT JOIN companies sc ON sc.id = s.entity_id
           LEFT JOIN companies ec ON ec.id = d.entity_id AND d.site_id IS NULL
           WHERE d.approval_status = $1 AND d.is_archived = false ${sitesFilter} LIMIT 20`,
          params
        );
        pendingApprovalsRows = res2.rows;

        // The developer/admin query above has no site filter so it already includes scoped
        // docs. Consultants are site-filtered, so add scoped client_signed_off docs
        // they can access (gated by canUserAccessDocument).
        if (user.role === "consultant") {
          mergePending(await accessibleScopedPending("client_signed_off", false));
        }
      } else if (user.role === "client") {
        // Client: docs with approval_status = "pending" uploaded by someone else on their accessible site(s).
        // Includes both directly assigned sites (client_site_assignments) AND all sites belonging to their
        // company — mirroring the site-scope logic in /api/home-summary.
        const clientSites = await storage.getClientSites(userId);
        const directSiteIds = clientSites.map((s) => s.siteId);
        let allClientSiteIds = [...directSiteIds];
        if (user.companyId) {
          const companySitesRes = await pool.query<{ id: string }>(
            "SELECT id FROM sites WHERE entity_id = $1",
            [user.companyId]
          );
          const companySiteIds = companySitesRes.rows.map((r) => r.id);
          allClientSiteIds = [...new Set([...directSiteIds, ...companySiteIds])];
        }
        if (allClientSiteIds.length > 0) {
          const res2 = await pool.query<{ id: string; title: string; site_id: string | null; module: string | null; renewal_date: string | null; expiry_date: string | null; updated_at: string | null; site_name: string | null; company_name: string | null }>(
            `SELECT d.id, d.title, d.site_id, d.module, d.renewal_date, d.expiry_date, d.updated_at,
                    s.name AS site_name, c.name AS company_name
             FROM documents d
             LEFT JOIN sites s ON s.id = d.site_id
             LEFT JOIN companies c ON c.id = s.entity_id
             WHERE d.approval_status = 'pending' AND d.uploaded_by != $1
               AND d.site_id = ANY($2::varchar[]) AND d.is_archived = false
               AND (d.approval_requested_from IS NULL OR d.approval_requested_from = $1)
             LIMIT 20`,
            [userId, allClientSiteIds]
          );
          pendingApprovalsRows = res2.rows;
        }

        // Add group/company-scoped pending docs awaiting this client's approval.
        mergePending(await accessibleScopedPending("pending", true));
      }

      // 3. Documents where client requested changes — shown to the uploader OR the admin
      //    who initiated the upload on their behalf (initiated_by_user_id).
      let changesRequestedRows: { id: string; title: string; site_id: string | null; module: string | null; renewal_date: string | null; expiry_date: string | null; updated_at: string | null }[] = [];
      if (user.role === "consultant" || user.role === "developer" || user.role === "administrator") {
        const crRes = await pool.query<{ id: string; title: string; site_id: string | null; module: string | null; renewal_date: string | null; expiry_date: string | null; updated_at: string | null }>(
          `SELECT DISTINCT id, title, site_id, module, renewal_date, expiry_date, updated_at FROM documents
           WHERE approval_status = 'changes_requested'
             AND (uploaded_by = $1 OR initiated_by_user_id = $1)
             AND is_archived = false
           LIMIT 20`,
          [userId]
        );
        changesRequestedRows = crRes.rows;
      }

      // 4. Open incidents assigned to this user
      const myIncidentsRes = await pool.query<{
        id: string; incident_reference: string; title: string; site_id: string; severity: string; status: string;
      }>(
        `SELECT id, incident_reference, title, site_id, severity, status
         FROM incidents
         WHERE assigned_consultant = $1 AND status NOT IN ('resolved','closed') AND is_archived = false
         LIMIT 10`,
        [userId]
      );

      // 4. Open cases assigned to this user — only for admins or consultants with caseAdvocate permission
      const perms = user.consultantPermissions as { caseAdvocate?: boolean } | null;
      const canViewCases = user.role === "developer" || ((user.role === "consultant" || user.role === "administrator") && perms?.caseAdvocate === true);

      let myCasesRows: { id: string; case_reference: string; case_name: string; employee_name: string; site_id: string; status: string }[] = [];
      if (canViewCases) {
        const myCasesRes = await pool.query<{
          id: string; case_reference: string; case_name: string; employee_name: string; site_id: string; status: string;
        }>(
          `SELECT id, case_reference, case_name, employee_name, site_id, status
           FROM cases
           WHERE assigned_consultant = $1 AND status NOT IN ('resolved','closed') AND is_archived = false
           LIMIT 10`,
          [userId]
        );
        myCasesRows = myCasesRes.rows;
      }

      // 5. Support requests assigned to this user
      const mySupportRes = await pool.query<{ id: string; subject: string; status: string }>(
        `SELECT id, subject, status FROM support_requests WHERE assigned_to = $1 AND status = 'open' LIMIT 10`,
        [userId]
      );

      return res.json({
        assignedDocs: { count: assignedDocsRes.rows.length, items: assignedDocsRes.rows },
        pendingApprovals: { count: pendingApprovalsRows.length, items: pendingApprovalsRows },
        changesRequested: { count: changesRequestedRows.length, items: changesRequestedRows },
        myIncidents: { count: myIncidentsRes.rows.length, items: myIncidentsRes.rows },
        myCases: { count: myCasesRows.length, items: myCasesRows },
        canViewCases,
        mySupportRequests: { count: mySupportRes.rows.length, items: mySupportRes.rows },
      });
    } catch (err) {
      console.error("My actions error:", err);
      res.status(500).json({ error: "Failed to fetch my actions" });
    }
  });

  app.delete("/api/portal-messages/:id", async (req, res) => {
    try {
      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer access required" });

      const ok = await storage.deletePortalMessage(req.params.id);
      if (!ok) return res.status(404).json({ error: "Message not found" });
      return res.json({ ok: true });
    } catch (err) {
      console.error("Delete portal message error:", err);
      res.status(500).json({ error: "Failed to delete portal message" });
    }
  });

  // ── Accelo Integration ────────────────────────────────────────────────────────

  // Helper: check if a user can access a given Accelo source
  function canAccessAcceloSource(user: any, sourceCode: string): boolean {
    if (user.role === "developer") return true;
    if (user.role === "consultant" && user.consultantTier === "pro") {
      const userSources: string[] = Array.isArray(user.sources) ? user.sources : [];
      return userSources.includes(sourceCode);
    }
    return false;
  }

  // Helper: get the Accelo source codes this user may access (empty array = none)
  function allowedAcceloSources(user: any): string[] | "all" {
    if (user.role === "developer") return "all";
    if (user.role === "consultant" && user.consultantTier === "pro") {
      return Array.isArray(user.sources) ? user.sources : [];
    }
    return [];
  }

  // GET /api/integrations/accelo/status — per-source connection status
  // Accessible to: admin (all sources), pro consultant (their sources only)
  app.get("/api/integrations/accelo/status", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(403).json({ error: "Forbidden" });
      const allowed = allowedAcceloSources(user);
      if (allowed !== "all" && allowed.length === 0) return res.status(403).json({ error: "Forbidden" });

      const [integrations, sourceLabelMap] = await Promise.all([listIntegrations(), getSourceLabels()]);
      const filtered = allowed === "all"
        ? integrations
        : integrations.filter(i => allowed.includes(i.sourceCode));

      const result = filtered.map(i => ({
        sourceCode: i.sourceCode,
        sourceLabel: sourceLabelMap[i.sourceCode] ?? i.sourceCode,
        deployment: i.deployment,
        connected: !!i.accessToken,
        expiresAt: i.expiresAt ?? null,
        isActive: i.isActive,
      }));
      res.json(result);
    } catch (err) {
      console.error("Accelo status error:", err);
      res.status(500).json({ error: "Failed to get Accelo status" });
    }
  });

  // GET /api/integrations/accelo/connect?source=GS — start OAuth flow (admin only)
  app.get("/api/integrations/accelo/connect", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const sourceCode = ((req.query.source as string) ?? "GS").toUpperCase();
      const integration = await getIntegration(sourceCode);
      if (!integration) return res.status(404).json({ error: `No Accelo integration configured for source: ${sourceCode}` });
      const nonce = crypto.randomBytes(16).toString("hex");
      const statePayload = Buffer.from(JSON.stringify({ nonce, sourceCode })).toString("base64url");
      (req.session as any)[`acceloOAuthState_${sourceCode}`] = nonce;
      const url = buildAuthUrlFromIntegration(integration, statePayload);
      res.json({ url });
    } catch (err) {
      console.error("Accelo connect error:", err);
      res.status(500).json({ error: "Failed to start Accelo OAuth" });
    }
  });

  // GET /auth/accelo/callback — OAuth callback (public, browser redirect)
  app.get("/auth/accelo/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query as Record<string, string>;
      if (error) {
        return res.redirect(`/admin/integrations/accelo?error=${encodeURIComponent(error)}`);
      }
      const decoded = decodeOAuthState(state ?? "");
      if (!decoded) return res.redirect("/admin/integrations/accelo?error=invalid_state");
      const { nonce, sourceCode } = decoded;
      const expectedNonce = (req.session as any)[`acceloOAuthState_${sourceCode}`];
      if (!nonce || nonce !== expectedNonce) {
        return res.redirect("/admin/integrations/accelo?error=invalid_state");
      }
      delete (req.session as any)[`acceloOAuthState_${sourceCode}`];
      const tokens = await exchangeCode(sourceCode, code);
      await saveTokens(sourceCode, tokens);
      res.redirect(`/admin/integrations/accelo?connected=1&source=${encodeURIComponent(sourceCode)}`);
    } catch (err) {
      console.error("Accelo OAuth callback error:", err);
      res.redirect("/admin/integrations/accelo?error=token_exchange_failed");
    }
  });

  // GET /api/integrations/accelo/webhook-secret?source=GS — webhook secret for display (admin only)
  app.get("/api/integrations/accelo/webhook-secret", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const sourceCode = ((req.query.source as string) ?? "GS").toUpperCase();
      // Per-source secret env var (ACCELO_WEBHOOK_SECRET_GS) or fallback to generic
      const secret = process.env[`ACCELO_WEBHOOK_SECRET_${sourceCode}`]
        ?? process.env.ACCELO_WEBHOOK_SECRET
        ?? null;
      res.json({ secret });
    } catch (err) {
      res.status(500).json({ error: "Failed to retrieve webhook secret" });
    }
  });

  // DELETE /api/integrations/accelo/disconnect?source=GS — remove stored tokens (admin only)
  app.delete("/api/integrations/accelo/disconnect", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const sourceCode = ((req.query.source as string) ?? "GS").toUpperCase();
      await clearTokens(sourceCode);
      res.json({ ok: true });
    } catch (err) {
      console.error("Accelo disconnect error:", err);
      res.status(500).json({ error: "Failed to disconnect Accelo" });
    }
  });

  // GET /api/integrations/accelo/push — verification (backward-compat, defaults to GS)
  app.get("/api/integrations/accelo/push", (_req, res) => {
    console.log("[Accelo push] GET verification hit (legacy)");
    res.json({ ok: true, endpoint: "accelo-push" });
  });

  // GET /api/integrations/accelo/push/:sourceCode — source-scoped verification
  app.get("/api/integrations/accelo/push/:sourceCode", (req, res) => {
    console.log(`[Accelo push] GET verification hit (source: ${req.params.sourceCode})`);
    res.json({ ok: true, endpoint: "accelo-push", sourceCode: req.params.sourceCode });
  });

  // Validate per-source (or global fallback) webhook secret using constant-time compare.
  // Returns true when auth passes, false otherwise.
  // If no secret is configured for the source the endpoint is considered open (no auth).
  function validatePushSecret(req: any, sourceCode: string): boolean {
    const secret =
      process.env[`ACCELO_WEBHOOK_SECRET_${sourceCode.toUpperCase()}`] ??
      process.env.ACCELO_WEBHOOK_SECRET;
    if (!secret) return true; // no secret configured — open endpoint
    const provided =
      (req.query.secret as string | undefined) ??
      (req.headers["x-accelo-secret"] as string | undefined);
    if (!provided) return false;
    try {
      const a = Buffer.from(provided.padEnd(secret.length, "\0"));
      const b = Buffer.from(secret.padEnd(provided.length, "\0"));
      return (
        a.length === b.length &&
        crypto.timingSafeEqual(a, b) &&
        provided === secret
      );
    } catch {
      return false;
    }
  }

  // Shared push execution: fetches the Accelo company, creates/updates local record + site,
  // writes an audit log, and returns { status, body } — identical for all sources.
  async function executeAcceloPush(
    sourceCode: string,
    acceloCompanyId: string
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    // County code → { county, country } lookup (Chapman codes used by Accelo)
    const ACCELO_COUNTY_LOOKUP: Record<string, { county: string; country: string }> = {
      BKM: { county: "Buckinghamshire",    country: "England"  },
      CRF: { county: "Cardiff",            country: "Wales"    },
      DEV: { county: "Devon",              country: "England"  },
      ESX: { county: "Essex",              country: "England"  },
      GLS: { county: "Gloucestershire",    country: "England"  },
      HAM: { county: "Hampshire",          country: "England"  },
      KEN: { county: "Kent",               country: "England"  },
      LAN: { county: "Lancashire",         country: "England"  },
      LEC: { county: "Leicestershire",     country: "England"  },
      LIN: { county: "Lincolnshire",       country: "England"  },
      LND: { county: "Greater London",     country: "England"  },
      MAN: { county: "Greater Manchester", country: "England"  },
      NTT: { county: "Nottinghamshire",    country: "England"  },
      RFW: { county: "Renfrewshire",       country: "Scotland" },
      SHR: { county: "Shropshire",         country: "England"  },
      SOM: { county: "Somerset",           country: "England"  },
      SRY: { county: "Surrey",             country: "England"  },
      STS: { county: "Staffordshire",      country: "England"  },
      WAR: { county: "Warwickshire",       country: "England"  },
      WOR: { county: "Worcestershire",     country: "England"  },
      WSX: { county: "West Sussex",        country: "England"  },
    };

    // Parse address lines, postcode, county, and country from postal_address.full.
    // Accelo addresses come in two formats:
    //   WITH county code:    "Street, City, postcode, GLS, United Kingdom"
    //   WITHOUT county code: "Street, City, postcode, United Kingdom"
    function parseAcceloAddressFull(full: string | null | undefined, city: string | null | undefined) {
      const empty = { addressLine1: null as string | null, addressLine2: null as string | null, postcode: null as string | null, county: null as string | null, country: null as string | null };
      if (!full) return empty;
      const cityStr   = (city || "").trim();
      const cityIdx   = cityStr ? full.indexOf(cityStr) : -1;
      const beforeCity = cityIdx > 0 ? full.substring(0, cityIdx) : full;
      const afterCity  = cityIdx > 0 ? full.substring(cityIdx + cityStr.length) : "";
      const addrParts  = beforeCity.split(",").map((p) => p.trim()).filter(Boolean);
      const addressLine1 = addrParts[0] || null;
      const addressLine2 = addrParts.slice(1).join(", ") || null;
      const afterParts   = afterCity.split(",").map((p) => p.trim()).filter(Boolean);
      const postcode     = afterParts[0] || null;
      const secondPart   = afterParts[1] || "";
      const isChapman    = /^[A-Z]{2,4}$/.test(secondPart) && secondPart === secondPart.toUpperCase();
      const lookup       = isChapman ? ACCELO_COUNTY_LOOKUP[secondPart] : undefined;
      const rawCountry   = afterParts[afterParts.length - 1] || null;
      return {
        addressLine1,
        addressLine2,
        postcode,
        county:  lookup?.county  ?? null,
        country: lookup?.country ?? rawCountry,
      };
    }

    // Fetch company + primary contact from Accelo in parallel
    let acceloCompany: any;
    let primaryContact: any = null;
    const [companyData, contactsData] = await Promise.all([
      acceloGet(sourceCode, `/companies/${acceloCompanyId}?_fields=id,name,phone,website,custom_id,postal_address(city,state,full),standing,company_status(id,title,color)`),
      acceloGet(sourceCode, `/contacts?_filters=company_id(${acceloCompanyId})&_fields=id,firstname,surname,email,phone,mobile&_limit=1`),
    ]);
    acceloCompany  = companyData?.response;
    primaryContact = Array.isArray(contactsData?.response) ? contactsData.response[0] ?? null : null;

    if (!acceloCompany || !acceloCompany.name) {
      return { status: 404, body: { error: "Company not found in Accelo" } };
    }

    const companyName     = acceloCompany.name.trim();
    const addrParsed      = parseAcceloAddressFull(acceloCompany.postal_address?.full, acceloCompany.postal_address?.city);
    const contactFullName = primaryContact
      ? [primaryContact.firstname, primaryContact.surname].filter(Boolean).join(" ") || null
      : null;
    const contactEmail = primaryContact?.email || null;
    const contactPhone = acceloCompany.phone || primaryContact?.phone || primaryContact?.mobile || null;

    const existingCompanies = await storage.getCompanies();
    const existing = existingCompanies.find(
      (c) => c.name.trim().toLowerCase() === companyName.toLowerCase()
    );

    let company: any;
    let action: "created" | "updated";

    if (existing) {
      company = await storage.updateCompany(existing.id, {
        website:               acceloCompany.website            || existing.website,
        contactPhone:          contactPhone                      || existing.contactPhone,
        contactEmail:          contactEmail                      || existing.contactEmail,
        contactName:           contactFullName                   || existing.contactName,
        city:                  acceloCompany.postal_address?.city || existing.city,
        county:                addrParsed.county                 || existing.county,
        country:               addrParsed.country                || existing.country,
        postalCode:            addrParsed.postcode               || existing.postalCode,
        addressLine1:          addrParsed.addressLine1           || existing.addressLine1,
        addressLine2:          addrParsed.addressLine2           || existing.addressLine2,
        internalCompanyNumber: acceloCompany.custom_id          || existing.internalCompanyNumber,
      });
      action = "updated";
    } else {
      company = await storage.createCompany({
        name:                  companyName,
        website:               acceloCompany.website || null,
        contactPhone,
        contactEmail,
        contactName:           contactFullName,
        city:                  acceloCompany.postal_address?.city || null,
        county:                addrParsed.county,
        country:               addrParsed.country,
        postalCode:            addrParsed.postcode,
        addressLine1:          addrParsed.addressLine1,
        addressLine2:          addrParsed.addressLine2,
        industry:              "General",
        status:                "pending" as const,
        sources:               [],
        companyNumber:         null,
        internalCompanyNumber: acceloCompany.custom_id || null,
        contactPosition:       null,
        contactUserId:         null,
        searchTag:             null,
        employeeRange:         null,
        groupOwnerId:          null,
        healthSafetyAccess:    false,
        humanResourcesAccess:  false,
        employmentLawAccess:   false,
        trainingAccess:        false,
        toolkitAccess:         false,
        supportAccess:         false,
        reportsAccess:         false,
      });

      // Create a default primary site
      await storage.createSite({
        name:          "Head Office",
        companyId:     company!.id,
        addressLine1:  addrParsed.addressLine1,
        addressLine2:  addrParsed.addressLine2,
        city:          acceloCompany.postal_address?.city || null,
        county:        addrParsed.county,
        postalCode:    addrParsed.postcode,
        country:       addrParsed.country,
        contactName:   contactFullName,
        contactPosition: null,
        contactPhone,
        contactEmail,
      });

      action = "created";
    }

    // Persist / update the Accelo link with standing
    if (company?.id) {
      try {
        const rawStatus = acceloCompany.company_status;
        const acceloTypeVal = rawStatus
          ? (typeof rawStatus === "string" ? rawStatus : (rawStatus?.title ?? null))
          : null;
        const acceloColorVal = rawStatus && typeof rawStatus === "object" ? (rawStatus?.color ?? null) : null;
        await storage.upsertAcceloLink(company.id, sourceCode, String(acceloCompanyId), acceloCompany.standing ?? null, acceloTypeVal, acceloColorVal);
      } catch (linkErr: any) {
        console.warn(`[Accelo push] Failed to upsert accelo link for company ${company.id}:`, linkErr.message);
      }
    }

    await storage.createAuditLog({
      action:   `accelo_company_${action}`,
      userId:   "system",
      userName: "Accelo Integration",
      details:  `Company "${companyName}" ${action} via Accelo push (source: ${sourceCode}, Accelo ID: ${acceloCompanyId})`,
      metadata: JSON.stringify({ acceloCompanyId, companyId: company?.id, sourceCode }),
    });

    console.log(`[Accelo push] Company "${companyName}" ${action} (source: ${sourceCode}, Accelo ID: ${acceloCompanyId})`);
    return { status: action === "created" ? 201 : 200, body: { ok: true, action, companyId: company?.id } };
  }

  // POST /api/integrations/accelo/push — legacy/default webhook (source = GS)
  // Expects body: { id: string } and optional ?secret= or X-Accelo-Secret header
  app.post("/api/integrations/accelo/push", async (req, res) => {
    console.log("[Accelo push] HIT — body:", JSON.stringify(req.body), "query:", JSON.stringify(req.query));
    if (!validatePushSecret(req, "GS")) {
      return res.status(401).json({ error: "Invalid or missing webhook secret" });
    }
    const parsed = z.object({ id: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "id is required", details: parsed.error.issues });
    }
    try {
      const result = await executeAcceloPush("GS", parsed.data.id);
      res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error("Accelo push error:", err);
      const isAcceloErr = err.message?.includes("Failed to fetch") || err.message?.includes("Accelo");
      res.status(isAcceloErr ? 502 : 500).json({ error: isAcceloErr ? "Failed to fetch company from Accelo" : "Failed to process Accelo push", detail: err.message });
    }
  });

  // POST /api/integrations/accelo/push/:sourceCode — source-scoped webhook (same logic, different source)
  app.post("/api/integrations/accelo/push/:sourceCode", async (req, res) => {
    const sourceCode = req.params.sourceCode.toUpperCase();
    console.log(`[Accelo push/:sourceCode] HIT — source=${sourceCode} body:`, JSON.stringify(req.body));
    if (!validatePushSecret(req, sourceCode)) {
      return res.status(401).json({ error: "Invalid or missing webhook secret" });
    }
    const parsed = z.object({ id: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "id is required", details: parsed.error.issues });
    }
    try {
      const result = await executeAcceloPush(sourceCode, parsed.data.id);
      res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error(`Accelo push/:sourceCode error:`, err);
      const isAcceloErr = err.message?.includes("Failed to fetch") || err.message?.includes("Accelo");
      res.status(isAcceloErr ? 502 : 500).json({ error: isAcceloErr ? "Failed to fetch company from Accelo" : "Failed to process Accelo push", detail: err.message });
    }
  });

  // GET /api/integrations/accelo/search?q=&source=GS — admin or pro consultant
  app.get("/api/integrations/accelo/search", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(403).json({ error: "Forbidden" });
      const sourceCode = ((req.query.source as string) ?? "GS").toUpperCase();
      if (!canAccessAcceloSource(user, sourceCode)) return res.status(403).json({ error: "Forbidden" });
      const q = ((req.query.q as string) ?? "").trim();
      if (!q) return res.json([]);
      const data = await acceloGet(sourceCode, `/companies?_search=${encodeURIComponent(q)}&_fields=id,name,phone,website,custom_id&_limit=20`);
      const results = Array.isArray(data?.response) ? data.response : [];
      res.json(results);
    } catch (err: any) {
      if (err.message?.includes("no tokens stored") || err.message?.includes("not connected")) return res.status(503).json({ error: "Accelo not connected" });
      console.error("Accelo search error:", err);
      res.status(500).json({ error: "Failed to search Accelo" });
    }
  });

  // GET /api/integrations/accelo/companies/:acceloId?source=GS — admin or pro consultant
  app.get("/api/integrations/accelo/companies/:acceloId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(403).json({ error: "Forbidden" });
      const sourceCode = ((req.query.source as string) ?? "GS").toUpperCase();
      if (!canAccessAcceloSource(user, sourceCode)) return res.status(403).json({ error: "Forbidden" });
      const { acceloId } = req.params;
      const data = await acceloGet(sourceCode, `/companies/${acceloId}?_fields=id,name,phone,website,custom_id,postal_address(city,full,state),standing,type,company_status(id,title,color)`);
      const company = data?.response ?? null;
      if (company?.postal_address?.state && /^\d+$/.test(String(company.postal_address.state))) {
        try {
          const stateData = await acceloGet(sourceCode, `/states/${company.postal_address.state}`);
          company.postal_address.county = stateData?.response?.title ?? null;
        } catch { /* non-fatal */ }
      }
      res.json(company);
    } catch (err: any) {
      if (err.message?.includes("no tokens stored") || err.message?.includes("not connected")) return res.status(503).json({ error: "Accelo not connected" });
      console.error("Accelo company fetch error:", err);
      res.status(500).json({ error: "Failed to fetch Accelo company" });
    }
  });

  // GET /api/integrations/accelo/companies/:acceloId/contacts?source=GS — admin or pro consultant
  app.get("/api/integrations/accelo/companies/:acceloId/contacts", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(403).json({ error: "Forbidden" });
      const sourceCode = ((req.query.source as string) ?? "GS").toUpperCase();
      if (!canAccessAcceloSource(user, sourceCode)) return res.status(403).json({ error: "Forbidden" });
      const { acceloId } = req.params;
      const data = await acceloGet(
        sourceCode,
        `/companies/${encodeURIComponent(acceloId)}/contacts?_fields=id,firstname,surname,email,phone,mobile&_limit=100`
      );
      const contacts = Array.isArray(data?.response) ? data.response : [];
      console.log(`[Accelo contacts] source=${sourceCode} acceloId=${acceloId} count=${contacts.length}`);
      const normalised = contacts.map((c: any) => ({
        ...c,
        lastname: c.surname ?? c.lastname ?? c.last_name ?? "",
      }));
      res.json(normalised);
    } catch (err: any) {
      if (err.message?.includes("no tokens stored") || err.message?.includes("not connected")) return res.status(503).json({ error: "Accelo not connected" });
      console.error("Accelo contacts error:", err);
      res.status(500).json({ error: "Failed to fetch Accelo contacts" });
    }
  });

  // POST /api/integrations/accelo/import-contacts — admin or pro consultant (source in body)
  app.post("/api/integrations/accelo/import-contacts", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser) return res.status(403).json({ error: "Forbidden" });
      const sourceCode = ((req.body.source as string) ?? "GS").toUpperCase();
      if (!canAccessAcceloSource(currentUser, sourceCode)) return res.status(403).json({ error: "Forbidden" });

      const schema = z.object({
        source: z.string().optional(),
        companyId: z.string().min(1),
        siteId: z.string().nullable().optional(),
        contacts: z.array(z.object({
          acceloId: z.string(),
          firstname: z.string().default(""),
          lastname: z.string().default(""),
          email: z.string().email(),
          phone: z.string().optional().default(""),
          mobile: z.string().optional().default(""),
          setAsPrimary: z.boolean().default(false),
          setAsKeyContact: z.boolean().default(false),
          addToSite: z.boolean().default(true),
        })),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

      const { companyId, siteId, contacts } = parsed.data;
      const results: Array<{ acceloId: string; userId?: string; success: boolean; error?: string }> = [];

      for (const contact of contacts) {
        try {
          const firstName = contact.firstname.trim();
          const lastName = contact.lastname.trim();
          const fullName = [firstName, lastName].filter(Boolean).join(" ") || contact.email.split("@")[0];
          const baseUsername = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`
            .replace(/\s+/g, "").replace(/[^a-z0-9.]/g, "") || contact.email.split("@")[0];

          // Defense-in-depth: primary and key contact are mutually exclusive; primary wins
          if (contact.setAsPrimary && contact.setAsKeyContact) {
            contact.setAsKeyContact = false;
          }

          const existingByEmail = await storage.getUserByEmail(contact.email.trim());
          if (existingByEmail) {
            results.push({ acceloId: contact.acceloId, success: false, error: "Email already registered" });
            continue;
          }

          let username = baseUsername || "user";
          let suffix = 1;
          while (await storage.getUserByUsername(username)) {
            username = `${baseUsername || "user"}${suffix++}`;
          }

          const placeholderPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), BCRYPT_SALT_ROUNDS);

          const newUser = await storage.createUser({
            username,
            email: contact.email.trim(),
            fullName,
            password: placeholderPassword,
            role: "client",
            companyId,
            status: "site_required",
            consultantTier: null,
            consultantPermissions: null,
            clientPermissionRole: "full",
            title: null,
            firstName: firstName || null,
            lastName: lastName || null,
            jobTitle: null,
            department: null,
            phone: contact.phone || null,
            mobile: contact.mobile || null,
            preferredContactMethod: "email",
            notes: null,
            sources: null,
          });

          if (contact.addToSite && siteId) {
            await storage.assignClientToSite({ clientId: newUser.id, siteId });
          }
          // Accelo-imported contacts are explicitly known; always move to invite_required
          await storage.updateUser(newUser.id, { status: "invite_required" });

          if (contact.setAsPrimary) {
            await storage.updateCompany(companyId, { contactUserId: newUser.id });
          }

          if (contact.setAsKeyContact) {
            try {
              await storage.addKeyContact(newUser.id, "company", companyId);
            } catch {
              // non-fatal: key contact may already exist or conflict
            }
            if (contact.addToSite && siteId) {
              try {
                await storage.addKeyContact(newUser.id, "site", siteId);
              } catch {
                // non-fatal
              }
            }
          }

          await storage.createAuditLog({
            action: "accelo_contact_imported",
            entityType: "user",
            entityId: newUser.id,
            userId: currentUser.id,
            userName: currentUser.fullName || currentUser.username,
            details: `Contact "${fullName}" imported from Accelo as portal user (Accelo ID: ${contact.acceloId})`,
            metadata: {
              acceloContactId: contact.acceloId,
              portalUserId: newUser.id,
              companyId,
              siteId: siteId || null,
              setAsPrimary: contact.setAsPrimary,
              setAsKeyContact: contact.setAsKeyContact,
            },
          });

          results.push({ acceloId: contact.acceloId, userId: newUser.id, success: true });
        } catch (err: any) {
          results.push({ acceloId: contact.acceloId, success: false, error: err.message || "Unexpected error" });
        }
      }

      res.json({ results });
    } catch (err) {
      console.error("Accelo import contacts error:", err);
      res.status(500).json({ error: "Failed to import contacts" });
    }
  });

  // ── Accelo Integrations CRUD (admin only) ─────────────────────────────────────

  // GET /api/developer/accelo-integrations — list all integrations
  app.get("/api/developer/accelo-integrations", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const [integrations, sourceLabelMap] = await Promise.all([listIntegrations(), getSourceLabels()]);
      res.json(integrations.map(i => ({
        id: i.id,
        sourceCode: i.sourceCode,
        sourceLabel: sourceLabelMap[i.sourceCode] ?? i.sourceCode,
        deployment: i.deployment,
        clientId: i.clientId,
        connected: !!i.accessToken,
        expiresAt: i.expiresAt ?? null,
        isActive: i.isActive,
        createdAt: i.createdAt,
      })));
    } catch (err) {
      console.error("Accelo integrations list error:", err);
      res.status(500).json({ error: "Failed to list Accelo integrations" });
    }
  });

  // POST /api/developer/accelo-integrations — create a new integration
  app.post("/api/developer/accelo-integrations", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const schema = z.object({
        sourceCode: z.string().min(1).max(8).toUpperCase(),
        deployment: z.string().min(1),
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      const integration = await createIntegration(parsed.data);
      res.status(201).json({ id: integration.id, sourceCode: integration.sourceCode, deployment: integration.deployment, isActive: integration.isActive });
    } catch (err: any) {
      if (err.message?.includes("unique") || err.code === "23505") {
        return res.status(409).json({ error: "An integration for this source already exists" });
      }
      console.error("Accelo integration create error:", err);
      res.status(500).json({ error: "Failed to create Accelo integration" });
    }
  });

  // PATCH /api/developer/accelo-integrations/:sourceCode — update an integration
  app.patch("/api/developer/accelo-integrations/:sourceCode", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const { sourceCode } = req.params;
      const schema = z.object({
        deployment: z.string().min(1).optional(),
        clientId: z.string().min(1).optional(),
        clientSecret: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      const ok = await updateIntegration(sourceCode.toUpperCase(), parsed.data);
      if (!ok) return res.status(404).json({ error: "Integration not found" });
      res.json({ ok: true });
    } catch (err) {
      console.error("Accelo integration update error:", err);
      res.status(500).json({ error: "Failed to update Accelo integration" });
    }
  });

  // DELETE /api/developer/accelo-integrations/:sourceCode — delete an integration
  // Blocked if the integration still has active tokens (must disconnect first)
  app.delete("/api/developer/accelo-integrations/:sourceCode", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "developer") return res.status(403).json({ error: "Developer only" });
      const code = req.params.sourceCode.toUpperCase();
      const integration = await getIntegration(code);
      if (!integration) return res.status(404).json({ error: "Integration not found" });
      if (integration.accessToken) {
        return res.status(409).json({ error: "Disconnect the integration before deleting it" });
      }
      const ok = await deleteIntegration(code);
      if (!ok) return res.status(404).json({ error: "Integration not found" });
      res.json({ ok: true });
    } catch (err) {
      console.error("Accelo integration delete error:", err);
      res.status(500).json({ error: "Failed to delete Accelo integration" });
    }
  });

  return httpServer;
}
