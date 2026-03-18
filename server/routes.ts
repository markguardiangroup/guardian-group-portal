import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import type { ModuleType, InvitationPurpose } from "@shared/schema";
import { pool } from "./db";
import { SECURITY_CONFIG, getClientCapabilities } from "@shared/schema";
import PDFDocument from "pdfkit";
import archiver from "archiver";
import { registerObjectStorageRoutes, ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage";
import { sendInvitationEmail, sendPasswordResetEmail, sendDocumentApprovalEmail, sendClientSignOffEmail } from "./email";

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

const createDocumentSchema = z.object({
  title: z.string().min(1),
  comments: z.string().optional().nullable(),
  module: z.enum(["health_safety", "human_resources", "employment_law", "training", "support"]),
  type: z.string().min(1),
  documentTypeId: z.string().nullable().optional(),
  siteId: z.string().min(1),
  folderId: z.string().nullable().optional(),
  caseId: z.string().nullable().optional(),
  fileName: z.string().min(1),
  fileUrl: z.string().optional(),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
  reviewDate: z.string().optional(),
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
  isRequired: z.boolean().optional(),
  notifyUserIds: z.array(z.string()).optional(),
});

const createCaseSchema = z.object({
  entityId: z.string().min(1),
  siteId: z.string().min(1),
  employeeName: z.string().min(1),
  employeeId: z.string().optional(),
  caseType: z.enum(["disciplinary", "grievance", "tupe", "redundancy", "tribunal_claim", "settlement", "appeal", "investigation"]),
  description: z.string().optional(),
  isConfidential: z.boolean().optional(),
  restrictedToUsers: z.array(z.string()).optional(),
  hearingDate: z.string().optional(),
  responseDeadline: z.string().optional(),
});

const updateCaseSchema = z.object({
  status: z.enum(["open", "under_investigation", "hearing_scheduled", "resolved", "closed"]).optional(),
  description: z.string().optional(),
  isConfidential: z.boolean().optional(),
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
  action: z.enum(["approve", "reject", "changes"]),
  feedback: z.string().optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const createDocumentTypeSchema = z.object({
  name: z.string().min(1),
  module: z.enum(["health_safety", "human_resources", "employment_law", "training", "support"]),
  description: z.string().optional(),
  isRequired: z.boolean().optional(),
  renewalPeriodMonths: z.number().positive().optional().nullable(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

const updateDocumentTypeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isRequired: z.boolean().optional(),
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

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid credentials format" });
      }

      const { username: loginIdentifier, password } = parseResult.data;
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
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
        legalAcceptedAt: user.legalAcceptedAt,
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

    let companyName: string | null = null;
    if (user.companyId) {
      const company = await storage.getCompany(user.companyId);
      if (company) {
        companyName = company.name;
      }
    }

    // Check if user needs to re-accept legal documents (applies to all roles)
    let legalAcceptanceRequired = false;
    const latestRevision = await getLatestLegalRevisionDate();
    if (latestRevision) {
      if (!user.legalAcceptedAt) {
        legalAcceptanceRequired = true;
      } else {
        legalAcceptanceRequired = new Date(user.legalAcceptedAt) < latestRevision;
      }
    }

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
      legalAcceptanceRequired,
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

  // Helper: check if a consultant user has the pro tier
  // Function definition moved to before its first usage in Companies list route

  // Helper to check if a client user can access a site (based on companyId)
  const canUserAccessSite = async (user: { id?: string; role: string; companyId: string | null; consultantTier?: string | null }, siteId: string): Promise<boolean> => {
    // Admins have unrestricted access to all sites
    if (user.role === "admin") return true;
    
    // Pro consultants have unrestricted access to all sites
    if (isProConsultant(user)) return true;
    
    // Standard consultants can only access sites they are assigned to
    if (user.role === "consultant" && user.id) {
      const assignments = await storage.getConsultantSites(user.id);
      return assignments.some(a => a.siteId === siteId);
    }
    
    // Clients access depends on whether they have site assignments
    if (user.role === "client" && user.id) {
      if (!user.companyId) return false;
      const site = await storage.getSite(siteId);
      if (!site) return false;
      
      // First check: site must be in the client's company
      if (site.companyId !== user.companyId) return false;
      
      // Client can only access sites they are explicitly assigned to
      const clientSites = await storage.getClientSites(user.id);
      return clientSites.some(a => a.siteId === siteId);
    }
    
    return false;
  };

  const canUserAccessFolder = async (
    user: { id?: string; role: string; companyId: string | null; consultantTier?: string | null },
    folder: { id: string; siteId: string; allocatedClientId: string | null }
  ): Promise<boolean> => {
    if (user.role === "admin") return true;
    if (isProConsultant(user)) return true;
    if (user.role === "consultant" && user.id) {
      const assignments = await storage.getConsultantSites(user.id);
      return assignments.some((a) => a.siteId === folder.siteId);
    }
    if (user.role === "client" && user.id) {
      if (!user.companyId) return false;
      const site = await storage.getSite(folder.siteId);
      if (!site || site.companyId !== user.companyId) return false;
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

  // ==================== AUTHENTICATED INVITATION ENDPOINTS ====================

  // Resend invitation (admin only)
  app.post("/api/users/:userId/resend-invite", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ error: "Only admins can resend invitations" });
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
        });
        emailSent = true;
      } catch (emailError) {
        console.error("Failed to send invitation email (link still generated):", emailError);
      }
      
      // Transition status to 'invited' when invite is sent/generated
      if (targetUser.status === "invite_required") {
        await storage.updateUser(targetUser.id, { status: "invited" });
      }
      
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
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ error: "Only admins can view invitation status" });
      }
      
      const invitations = await storage.getUserInvitationsByUser(req.params.userId);
      const activeInvitation = invitations.find(inv => !inv.usedAt && new Date(inv.expiresAt) > new Date());
      
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

  // Shared helper: slot-based compliance calculation
  const complianceModules: ModuleType[] = ["health_safety", "human_resources", "employment_law"];

  async function computeSlotBasedCompliance(
    user: any,
    documents: any[],
    module: ModuleType | undefined,
    siteFilter?: { siteId?: string; siteIds?: string }
  ) {
    const sites = await storage.getSites();
    const templates = await storage.getDocumentTemplates();
    const templateMap = new Map(templates.map(t => [t.id, t]));
    const companyReqCache = new Map<string, Awaited<ReturnType<typeof storage.getCompanyRequiredTemplates>>>();
    const siteExcludedCache = new Map<string, Set<string>>();

    let slotTotal = 0;
    let slotCompliant = 0;       // fulfilled slots (used for compliance score)
    let slotCompliantDocs = 0;  // individual compliant docs in required slots (used for display)
    let slotReview = 0;
    let slotOverdue = 0;
    let missingRequired = 0;
    const consumedDocIds = new Set<string>();
    const filteredSiteIds = new Set<string>();

    for (const site of sites) {
      if (!site.companyId) continue;
      const canAccess = await canUserAccessSite(user, site.id);
      if (!canAccess) continue;
      if (siteFilter?.siteId && siteFilter.siteId !== "all" && site.id !== siteFilter.siteId) continue;
      if (siteFilter?.siteIds) {
        const ids = siteFilter.siteIds.split(",");
        if (!ids.includes(site.id)) continue;
      }
      filteredSiteIds.add(site.id);
      if (!companyReqCache.has(site.companyId)) {
        companyReqCache.set(site.companyId, await storage.getCompanyRequiredTemplates(site.companyId));
      }
      const required = companyReqCache.get(site.companyId)!;
      if (!siteExcludedCache.has(site.id)) {
        const overrides = await storage.getSiteTemplateOverrides(site.id);
        siteExcludedCache.set(site.id, new Set(overrides.filter(o => o.action === "exclude").map(o => o.templateId)));
      }
      const siteExcluded = siteExcludedCache.get(site.id)!;
      const siteDocs = documents.filter(d => d.siteId === site.id && !d.isArchived && !d.caseId);

      for (const rt of required) {
        if (siteExcluded.has(rt.templateId)) continue;
        const tmpl = templateMap.get(rt.templateId);
        if (!tmpl || tmpl.visibility !== "private" || !tmpl.isActive) continue;
        if (module && tmpl.module !== module) continue;
        if (!module && !complianceModules.includes(tmpl.module as ModuleType)) continue;

        slotTotal++;
        const matchingDocs = siteDocs.filter(d => d.templateId === rt.templateId);
        matchingDocs.forEach(d => consumedDocIds.add(d.id));

        if (matchingDocs.length === 0) {
          missingRequired++;
          continue;
        }

        const isFulfilled = matchingDocs.some(d => {
          if (d.status !== "compliant") return false;
          if (d.expiryDate) {
            const expiry = new Date(d.expiryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expiry.setHours(0, 0, 0, 0);
            if (expiry < today) return false;
          }
          if (tmpl.requiresApproval && d.approvalStatus !== "approved") return false;
          return true;
        });
        if (isFulfilled) {
          slotCompliant++;
        }
        // Count individual docs in this slot by status.
        // We count per-document so the display cards match the dialog list —
        // a slot with two compliant docs shows 2 compliant, and a non-compliant
        // doc in an otherwise-fulfilled slot still surfaces in "Not Compliant".
        matchingDocs.forEach(d => {
          if (d.status === "compliant") slotCompliantDocs++;
          else if (d.status === "overdue") slotOverdue++;
          else if (d.status === "review_required") slotReview++;
        });
      }
    }

    // Manually-required docs not already consumed by a template slot
    const manualRequired = documents.filter(d => {
      if (!d.isRequired) return false;
      if (consumedDocIds.has(d.id)) return false;
      if (d.isArchived || d.caseId) return false;
      if (!filteredSiteIds.has(d.siteId)) return false;
      if (module && d.module !== module) return false;
      if (!module && !complianceModules.includes(d.module as ModuleType)) return false;
      return true;
    });

    const totalDocuments = slotTotal + manualRequired.length;
    // Per-document counts (match what the dialog list shows)
    const manualCompliant = manualRequired.filter(d => d.status === "compliant").length;
    const compliantDocuments = slotCompliantDocs + manualCompliant;
    const reviewRequired = slotReview + manualRequired.filter(d => d.status === "review_required").length;
    const overdueDocuments = slotOverdue + manualRequired.filter(d => d.status === "overdue").length;
    const missingRequiredDocuments = missingRequired;
    // Compliance score stays slot-based: fulfilled slots / total slots
    const slotCompliantForScore = slotCompliant + manualCompliant;
    const complianceScore = totalDocuments > 0 ? Math.round((slotCompliantForScore / totalDocuments) * 100) : 0;

    return { totalDocuments, compliantDocuments, reviewRequired, overdueDocuments, missingRequiredDocuments, complianceScore, consumedDocIds };
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
    documentId?: string;
    documentStatus?: string;
    kind: "template_slot" | "required_document";
  }

  async function getMissingRequiredTemplateDetails(
    user: any,
    module: ModuleType | undefined,
    siteFilter?: { siteId?: string; siteIds?: string }
  ): Promise<MissingRequiredTemplateDetail[]> {
    const results: MissingRequiredTemplateDetail[] = [];
    const sites = await storage.getSites();
    const templates = await storage.getDocumentTemplates();
    const templateMap = new Map(templates.map(t => [t.id, t]));
    const docs = await storage.getDocuments(module);
    const companyReqCache = new Map<string, Awaited<ReturnType<typeof storage.getCompanyRequiredTemplates>>>();
    const siteExcludedCache = new Map<string, Set<string>>();
    const companies = await storage.getCompanies();
    const companyMap = new Map(companies.map(c => [c.id, c]));

    for (const site of sites) {
      if (!site.companyId) continue;
      const canAccess = await canUserAccessSite(user, site.id);
      if (!canAccess) continue;
      if (siteFilter?.siteId && siteFilter.siteId !== "all" && site.id !== siteFilter.siteId) continue;
      if (siteFilter?.siteIds) {
        const ids = siteFilter.siteIds.split(",");
        if (!ids.includes(site.id)) continue;
      }
      if (!companyReqCache.has(site.companyId)) {
        companyReqCache.set(site.companyId, await storage.getCompanyRequiredTemplates(site.companyId));
      }
      const required = companyReqCache.get(site.companyId)!;
      if (!siteExcludedCache.has(site.id)) {
        const overrides = await storage.getSiteTemplateOverrides(site.id);
        siteExcludedCache.set(site.id, new Set(overrides.filter(o => o.action === "exclude").map(o => o.templateId)));
      }
      const siteExcluded = siteExcludedCache.get(site.id)!;
      const siteDocs = docs.filter(d => d.siteId === site.id && !d.isArchived && !d.caseId);
      const company = companyMap.get(site.companyId);
      for (const rt of required) {
        if (siteExcluded.has(rt.templateId)) continue;
        const tmpl = templateMap.get(rt.templateId);
        if (!tmpl || tmpl.visibility !== "private" || !tmpl.isActive) continue;
        if (module && tmpl.module !== module) continue;
        if (!module && !complianceModules.includes(tmpl.module as ModuleType)) continue;
        // Only count as "missing" when no document has been uploaded at all for this slot
        // (docs that exist but are overdue/review-required are counted in those other stats)
        const matchingDocs = siteDocs.filter(d => d.templateId === rt.templateId);
        if (matchingDocs.length === 0) {
          results.push({
            templateId: rt.templateId,
            templateName: tmpl.name,
            module: tmpl.module,
            requiresApproval: tmpl.requiresApproval || false,
            siteId: site.id,
            siteName: site.name,
            companyId: site.companyId,
            companyName: company?.name || "Unknown",
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
      const companyReqArrays = await Promise.all(
        uniqueCompanyIds.map(cid => storage.getCompanyRequiredTemplates(cid))
      );

      const requiredIds = new Set<string>();
      for (const arr of companyReqArrays) {
        for (const r of arr) requiredIds.add(r.templateId);
      }

      const allTemplates = await storage.getDocumentTemplates();
      for (const t of allTemplates) {
        if (t.isRequired) requiredIds.add(t.id);
      }

      res.json([...requiredIds]);
    } catch (error) {
      console.error("Error fetching required template IDs:", error);
      res.status(500).json({ error: "Failed to fetch required template IDs" });
    }
  });

  app.get("/api/missing-required-templates", async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const module = req.query.module as ModuleType | undefined;
      const siteId = req.query.siteId as string | undefined;
      const siteIds = req.query.siteIds as string | undefined;
      const details = await getMissingRequiredTemplateDetails(user, module, { siteId, siteIds });
      res.json(details);
    } catch (error) {
      console.error("Error fetching missing required templates:", error);
      res.status(500).json({ error: "Failed to fetch missing required templates" });
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
          const canAccess = await canUserAccessSite(user, doc.siteId);
          if (!canAccess) return null;
          
          // Apply additional site filter if specified
          if (requestedSiteId && requestedSiteId !== "all") {
            if (doc.siteId !== requestedSiteId) return null;
          } else if (requestedSiteIds) {
            const siteIdList = requestedSiteIds.split(",");
            if (!siteIdList.includes(doc.siteId)) return null;
          }
          
          return doc;
        })
      );
      const documents = accessibleDocuments.filter((d): d is NonNullable<typeof d> => d !== null);
      
      // Slot-based compliance calculation: each required template contributes exactly one slot
      const complianceResult = await computeSlotBasedCompliance(
        user, documents, module, { siteId: requestedSiteId, siteIds: requestedSiteIds }
      );
      const { totalDocuments, compliantDocuments, reviewRequired, overdueDocuments, missingRequiredDocuments, complianceScore, consumedDocIds } = complianceResult;
      // Pending approvals remain based on ALL docs (approval workflow, not compliance scope)
      const pendingApprovals = documents.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;

      // Required-document progress stats (matching compliance scope: template-slot docs + manually required)
      const nonCaseDocs = documents.filter(d => !d.isArchived && !d.caseId && (d.isRequired || consumedDocIds.has(d.id)));
      const allDocumentsCount = nonCaseDocs.length;
      const allCompliantDocuments = nonCaseDocs.filter(d => d.status === "compliant").length;
      const allReviewRequired = nonCaseDocs.filter(d => d.status === "review_required").length;
      const allOverdueDocuments = nonCaseDocs.filter(d => d.status === "overdue").length;
      
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
          if (!uploaderIsClient && doc.approvalStatus === "pending") {
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
        reviewRequired,
        overdueDocuments,
        missingRequiredDocuments,
        complianceScore,
        allDocuments: allDocumentsCount,
        allCompliantDocuments,
        allReviewRequired,
        allOverdueDocuments,
        pendingApprovals,
        awaitingYourApproval,
        awaitingOthersApproval,
      };
      
      const auditLogs = await storage.getAuditLogs(undefined, module);
      
      const recentDocuments = documents.slice(0, 5);
      
      const now = new Date();
      const upcomingReviews = documents
        .filter(doc => doc.reviewDate && new Date(doc.reviewDate) > now)
        .sort((a, b) => new Date(a.reviewDate!).getTime() - new Date(b.reviewDate!).getTime())
        .slice(0, 5);
      
      const recentActivity = auditLogs.slice(0, 10);

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
        elCases = rawCases.filter(c => {
          if (!c.isConfidential) return true;
          if (user.role === "admin") return true;
          if (user.role === "consultant") return true;
          if (c.createdBy === user.id) return true;
          if (c.assignedConsultant === user.id) return true;
          if (c.restrictedToUsers && c.restrictedToUsers.includes(user.id)) return true;
          return false;
        });
        elAllDocuments = documents;
      }

      res.json({
        summary,
        recentDocuments,
        upcomingReviews,
        recentActivity,
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
          const canAccess = await canUserAccessSite(user, doc.siteId);
          return canAccess ? doc : null;
        })
      );
      const documents = accessibleDocuments.filter((d): d is NonNullable<typeof d> => d !== null);
      
      // Slot-based compliance calculation: each required template contributes exactly one slot
      const complianceResult = await computeSlotBasedCompliance(user, documents, module);
      const { totalDocuments, compliantDocuments, reviewRequired, overdueDocuments, missingRequiredDocuments, complianceScore, consumedDocIds } = complianceResult;
      // Pending approvals remain based on ALL docs (approval workflow, not compliance scope)
      const pendingApprovals = documents.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;

      // Required-document progress stats (matching compliance scope: template-slot docs + manually required)
      const allNonCaseDocs = documents.filter(d => !d.isArchived && !d.caseId && (d.isRequired || consumedDocIds.has(d.id)));
      const allDocsProgress = allNonCaseDocs.length;
      const allCompliantProgress = allNonCaseDocs.filter(d => d.status === "compliant").length;
      const allReviewProgress = allNonCaseDocs.filter(d => d.status === "review_required").length;
      const allOverdueProgress = allNonCaseDocs.filter(d => d.status === "overdue").length;
      
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
          if (!uploaderIsClient && doc.approvalStatus === "pending") {
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
        reviewRequired,
        overdueDocuments,
        missingRequiredDocuments,
        complianceScore,
        allDocuments: allDocsProgress,
        allCompliantDocuments: allCompliantProgress,
        allReviewRequired: allReviewProgress,
        allOverdueDocuments: allOverdueProgress,
        pendingApprovals,
        awaitingYourApproval,
        awaitingOthersApproval,
      };
      
      const auditLogs = await storage.getAuditLogs(undefined, module);
      
      const recentDocuments = documents.slice(0, 5);
      
      const now = new Date();
      const upcomingReviews = documents
        .filter(doc => doc.reviewDate && new Date(doc.reviewDate) > now)
        .sort((a, b) => new Date(a.reviewDate!).getTime() - new Date(b.reviewDate!).getTime())
        .slice(0, 5);
      
      const recentActivity = auditLogs.slice(0, 10);
      
      res.json({
        summary,
        recentDocuments,
        upcomingReviews,
        recentActivity,
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
      } else if (user.role === "admin") {
        if (requestedCompanyId) {
          const companySites = await storage.getSitesByCompanyId(requestedCompanyId);
          if (companySites.length === 0) return res.json([]);
          accessibleSiteIds = companySites.map(s => s.id);
        } else if (requestedSiteIds) {
          accessibleSiteIds = requestedSiteIds.split(",");
        } else if (siteId) {
          accessibleSiteIds = [siteId];
        }
      } else if (user.role === "consultant") {
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
        } else if (!isProConsultant(user)) {
          const assignments = await storage.getConsultantSites(user.id);
          if (assignments.length === 0) return res.json([]);
          accessibleSiteIds = assignments.map(a => a.siteId);
        }
      }

      // Fetch all non-archived, non-case documents from accessible sites
      const allDocs = await storage.getDocuments();
      const filteredDocs = allDocs.filter(d =>
        !d.isArchived && !d.caseId &&
        (!accessibleSiteIds || (d.siteId && accessibleSiteIds.includes(d.siteId)))
      );

      const moduleNames: Record<string, string> = {
        health_safety: "Health & Safety",
        human_resources: "Human Resources",
        employment_law: "Employment Law",
        support: "Support",
      };

      const siteFilter = accessibleSiteIds
        ? { siteIds: accessibleSiteIds.join(",") }
        : undefined;

      const modules: ModuleType[] = ["health_safety", "human_resources", "employment_law", "support"];
      const summaries = await Promise.all(modules.map(async (mod) => {
        const moduleDocs = filteredDocs.filter(d => d.module === mod);
        const allDocs = moduleDocs.length;
        const allCompliant = moduleDocs.filter(d => d.status === "compliant").length;
        const allReview = moduleDocs.filter(d => d.status === "review_required").length;
        const allOverdue = moduleDocs.filter(d => d.status === "overdue").length;
        const pending = moduleDocs.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;

        if (complianceModules.includes(mod)) {
          const compliance = await computeSlotBasedCompliance(user, moduleDocs, mod, siteFilter);
          return {
            module: mod,
            moduleName: moduleNames[mod],
            ...compliance,
            allDocuments: allDocs,
            allCompliantDocuments: allCompliant,
            allReviewRequired: allReview,
            allOverdueDocuments: allOverdue,
            pendingApprovals: pending,
            awaitingYourApproval: 0,
            awaitingOthersApproval: 0,
          };
        }
        return {
          module: mod,
          moduleName: moduleNames[mod],
          totalDocuments: allDocs,
          compliantDocuments: allCompliant,
          reviewRequired: allReview,
          overdueDocuments: allOverdue,
          missingRequiredDocuments: 0,
          complianceScore: allDocs > 0 ? Math.round((allCompliant / allDocs) * 100) : 0,
          allDocuments: allDocs,
          allCompliantDocuments: allCompliant,
          allReviewRequired: allReview,
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
      
      // Get document templates to enrich documents with isRequired/renewalPeriodMonths
      const docTemplates = await storage.getDocumentTemplates(module);

      // Build company required-templates lookup so documents required via company
      // configuration show the correct compliance badge (not "Not Required")
      const allSitesForModule = await storage.getSites();
      const siteToCompanyModule = new Map(allSitesForModule.map(s => [s.id, s.companyId]));
      const uniqueCompanyIdsModule = [...new Set(allDocuments.map(d => siteToCompanyModule.get(d.siteId)).filter(Boolean) as string[])];
      const companyReqCacheModule = new Map<string, Set<string>>();
      await Promise.all(uniqueCompanyIdsModule.map(async (companyId) => {
        const reqs = await storage.getCompanyRequiredTemplates(companyId);
        companyReqCacheModule.set(companyId, new Set(reqs.map(r => r.templateId)));
      }));
      
      // Filter documents by sites the user can access
      const accessibleDocuments = await Promise.all(
        allDocuments.map(async (doc) => {
          
          const canAccess = await canUserAccessSite(user, doc.siteId);
          if (!canAccess) return null;
          
          // Enrich document with template properties + company required-template check
          const docTemplate = docTemplates.find(dt => dt.id === doc.templateId);
          const companyId = siteToCompanyModule.get(doc.siteId);
          const isRequiredViaCompanyTemplate = companyId && doc.templateId
            ? (companyReqCacheModule.get(companyId)?.has(doc.templateId) ?? false)
            : false;
          return {
            ...doc,
            isRequired: doc.isRequired || docTemplate?.isRequired || isRequiredViaCompanyTemplate,
            renewalPeriodMonths: docTemplate?.renewalPeriodMonths || null,
          };
        })
      );
      
      res.json(accessibleDocuments.filter((d): d is NonNullable<typeof d> => d !== null));
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
      
      const allDocuments = await storage.getDocuments(module, includeArchived);

      // Build company required-templates lookup for effective isRequired enrichment
      const allSitesForDocs = await storage.getSites();
      const siteToCompanyDocs = new Map(allSitesForDocs.map(s => [s.id, s.companyId]));
      const allDocTemplates = await storage.getDocumentTemplates();
      const docTemplateMap = new Map(allDocTemplates.map(dt => [dt.id, dt]));
      const uniqueCompanyIdsDocs = [...new Set(allDocuments.map(d => siteToCompanyDocs.get(d.siteId)).filter(Boolean) as string[])];
      const companyReqCacheDocs = new Map<string, Set<string>>();
      await Promise.all(uniqueCompanyIdsDocs.map(async (companyId) => {
        const reqs = await storage.getCompanyRequiredTemplates(companyId);
        companyReqCacheDocs.set(companyId, new Set(reqs.map(r => r.templateId)));
      }));
      
      // Filter documents by sites the user can access
      const accessibleDocuments = await Promise.all(
        allDocuments.map(async (doc) => {
          const canAccess = await canUserAccessSite(user, doc.siteId);
          if (!canAccess) return null;
          const docTemplate = doc.templateId ? docTemplateMap.get(doc.templateId) : undefined;
          const companyId = siteToCompanyDocs.get(doc.siteId);
          const isRequiredViaCompanyTemplate = companyId && doc.templateId
            ? (companyReqCacheDocs.get(companyId)?.has(doc.templateId) ?? false)
            : false;
          return {
            ...doc,
            isRequired: doc.isRequired || docTemplate?.isRequired || isRequiredViaCompanyTemplate,
          };
        })
      );
      
      let filteredDocuments = accessibleDocuments.filter((d): d is NonNullable<typeof d> => d !== null);
      
      // Apply additional siteId/siteIds filter if provided
      if (siteId) {
        filteredDocuments = filteredDocuments.filter(d => d.siteId === siteId);
      } else if (siteIds) {
        const siteIdArray = siteIds.split(",");
        filteredDocuments = filteredDocuments.filter(d => siteIdArray.includes(d.siteId));
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
      const canAccess = await canUserAccessSite(user, document.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }
      
      // Log document view
      await storage.createAuditLog({
        action: "document_viewed",
        userId: user.id,
        userName: user.fullName,
        entityId: document.siteId,
        documentId: document.id,
        supportRequestId: null,
        module: document.module,
        details: `Viewed ${document.title}`,
        metadata: null,
      });
      
      res.json(document);
    } catch (error) {
      console.error("Document error:", error);
      res.status(500).json({ error: "Failed to fetch document" });
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
      const canAccess = await canUserAccessSite(user, document.siteId);
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
      
      // Only admins and consultants can upload new versions
      if (user.role !== "admin" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only admins and consultants can upload new document versions" });
      }
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Authorization: check if user can access this document's site
      const canAccess = await canUserAccessSite(user, document.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }
      
      const { fileName, fileUrl, fileSize, mimeType, changeNote } = req.body;
      
      if (!fileName || !fileUrl || !fileSize || !mimeType) {
        return res.status(400).json({ error: "Missing required file information" });
      }
      
      const newVersionNumber = document.version + 1;
      
      // Create version record for the current document state (archiving current version)
      await storage.createDocumentVersion({
        documentId: document.id,
        version: document.version,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        uploadedBy: document.uploadedBy,
        changeNote: changeNote || `Replaced by version ${newVersionNumber}`,
      });
      
      // Check if template requires approval
      let newStatus: "review_required" | "compliant" = "review_required";
      let newApprovalStatus: "pending" | null = "pending";
      
      if (document.templateId) {
        const template = await storage.getDocumentTemplate(document.templateId);
        if (template && template.requiresApproval === false) {
          // Template doesn't require approval - auto-mark as compliant
          newStatus = "compliant";
          newApprovalStatus = null;
        }
      }
      
      // Update the main document with new file info
      const updatedDocument = await storage.updateDocument(document.id, {
        fileName,
        fileUrl,
        fileSize,
        mimeType,
        version: newVersionNumber,
        status: newStatus,
        approvalStatus: newApprovalStatus,
        updatedAt: new Date(),
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
          changeNote 
        }),
      });
      
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
      const canAccess = await canUserAccessSite(user, document.siteId);
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
      const canAccess = await canUserAccessSite(user, document.siteId);
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
      
      const canAccess = await canUserAccessSite(user, document.siteId);
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
      
      // Authorization: check if user can access this site
      const canAccess = await canUserAccessSite(user, body.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to upload documents to this site" });
      }
      
      // Check if approval is required
      let documentStatus: "review_required" | "compliant" = "review_required";
      let documentApprovalStatus: string = "pending";
      let autoRenewalDate: Date | null = null;
      
      // Training certificates are automatically compliant - they prove completion
      if (body.module === "training") {
        documentStatus = "compliant";
        documentApprovalStatus = "approved";
      } else if (body.requiresApproval === false) {
        // Uploader explicitly set no approval required
        documentStatus = "compliant";
        documentApprovalStatus = "approved";
      } else if (body.templateId) {
        const template = await storage.getDocumentTemplate(body.templateId);
        if (template && template.requiresApproval === false) {
          // Template doesn't require approval - auto-mark as compliant
          documentStatus = "compliant";
          documentApprovalStatus = "approved";
          // Also calculate renewal date from template if set
          if (template.renewalPeriodMonths) {
            autoRenewalDate = new Date();
            autoRenewalDate.setMonth(autoRenewalDate.getMonth() + template.renewalPeriodMonths);
          }
        }
      }
      
      const document = await storage.createDocument({
        title: body.title,
        comments: body.comments || null,
        module: body.module,
        type: body.type as any,
        documentTypeId: body.documentTypeId || null,
        siteId: body.siteId,
        folderId: body.folderId || null,
        caseId: body.caseId || null,
        fileName: body.fileName,
        fileUrl: body.fileUrl || null,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
        version: 1,
        status: documentStatus,
        approvalStatus: documentApprovalStatus,
        reviewDate: body.reviewDate ? new Date(body.reviewDate) : null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        uploadedBy: user.id,
        assignedTo: null,
        isArchived: false,
        isRequired: body.isRequired || false,
        source: body.source || "external",
        templateId: body.templateId || null,
        templateVersion: body.templateVersion ?? null,
        // Training certificate fields
        trainingCourseTitle: body.trainingCourseTitle || null,
        trainingCourseCode: body.trainingCourseCode || null,
        trainingDate: body.trainingDate ? new Date(body.trainingDate) : null,
        renewalDate: autoRenewalDate || (body.renewalDate ? new Date(body.renewalDate) : null),
      });

      await storage.createAuditLog({
        action: "document_uploaded",
        userId: user.id,
        userName: user.fullName,
        entityId: body.siteId,
        documentId: document.id,
        supportRequestId: null,
        module: body.module,
        details: `Uploaded ${body.title}`,
        metadata: null,
      });

      // Send approval notification emails if document requires approval
      if (documentStatus === "review_required" && body.notifyUserIds && body.notifyUserIds.length > 0) {
        const site = await storage.getSite(body.siteId);
        const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
        
        for (const notifyUserId of body.notifyUserIds) {
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
              });
              await storage.createAuditLog({
                action: "email_sent",
                userId: user.id,
                userName: user.fullName,
                entityId: body.siteId,
                documentId: document.id,
                supportRequestId: null,
                module: body.module,
                details: `Approval notification email sent to ${notifyUser.fullName} (${notifyUser.email})`,
                metadata: null,
              });
            }
          } catch (emailError) {
            console.error(`Failed to send approval notification to user ${notifyUserId}:`, emailError);
          }
        }
      }

      res.status(201).json(document);
    } catch (error) {
      console.error("Create document error:", error);
      res.status(500).json({ error: "Failed to create document" });
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
      const canAccess = await canUserAccessSite(user, existingDoc.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
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
        // Clients can only sign off on documents uploaded by consultants/admins
        if (uploaderRole === "client") {
          return res.status(403).json({ error: "Client-uploaded documents must be approved by a consultant or admin" });
        }
        
        // Document must be pending for client sign-off
        if (currentApprovalStatus !== "pending") {
          return res.status(400).json({ error: "This document is not awaiting your sign-off" });
        }
        
        // Check if client has approval permission (owner or approver role)
        if (!user.clientPermissionRole) {
          return res.status(403).json({ error: "You don't have permission to approve documents. Contact your administrator." });
        }
        const capabilities = getClientCapabilities(user.clientPermissionRole);
        if (!capabilities.canApproveDocuments) {
          return res.status(403).json({ error: "You don't have permission to approve documents. Contact your administrator." });
        }
        
        isClientSignOff = true;
      } else {
        // Consultants/admins
        if (uploaderRole === "client") {
          // Approving a client-uploaded document (direct approval)
          if (currentApprovalStatus !== "pending") {
            return res.status(400).json({ error: "This document is not awaiting approval" });
          }
          isConsultantApprovalOfClientDoc = true;
        } else {
          // This is a consultant/admin-uploaded document
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
      }

      let approvalStatus: "approved" | "rejected" | "changes_requested" | "client_signed_off";
      let documentStatus: "compliant" | "review_required" | "overdue";
      let auditAction: "document_approved" | "document_rejected" | "changes_requested" | "document_signed_off";

      switch (action) {
        case "approve":
          if (isClientSignOff) {
            // Client sign-off: move to awaiting consultant final approval
            approvalStatus = "client_signed_off";
            documentStatus = "review_required"; // Still needs final approval
            auditAction = "document_signed_off";
          } else {
            // Consultant final approval or direct approval of client doc
            approvalStatus = "approved";
            documentStatus = "compliant";
            auditAction = "document_approved";
          }
          break;
        case "reject":
          approvalStatus = "rejected";
          documentStatus = "overdue";
          auditAction = "document_rejected";
          break;
        case "changes":
          approvalStatus = "changes_requested";
          documentStatus = "review_required";
          auditAction = "changes_requested";
          break;
        default:
          return res.status(400).json({ error: "Invalid action" });
      }

      // Calculate renewal date ONLY when consultant gives final approval
      let lastApprovedAt: Date | undefined;
      let renewalDate: Date | undefined;
      
      const isFinalApproval = action === "approve" && (isConsultantFinalApproval || isConsultantApprovalOfClientDoc);
      if (isFinalApproval) {
        lastApprovedAt = new Date();
        
        // Look up renewal period from template if document has one
        if (existingDoc.templateId) {
          const template = await storage.getDocumentTemplate(existingDoc.templateId);
          if (template?.renewalPeriodMonths) {
            // renewalDate = lastApprovedAt + renewalPeriodMonths - 30 days (buffer)
            renewalDate = new Date(lastApprovedAt);
            renewalDate.setMonth(renewalDate.getMonth() + template.renewalPeriodMonths);
            renewalDate.setDate(renewalDate.getDate() - 30); // 30-day buffer
          }
        }
      }

      const document = await storage.updateDocument(documentId, {
        approvalStatus,
        status: documentStatus,
        ...(lastApprovedAt && { lastApprovedAt }),
        ...(renewalDate && { renewalDate }),
      });

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      await storage.createAuditLog({
        action: auditAction,
        userId: user.id,
        userName: user.fullName,
        entityId: document.siteId,
        documentId: document.id,
        supportRequestId: null,
        module: existingDoc.module,
        details: feedback || (action === "approve" ? "Document approved" : action === "reject" ? "Document rejected" : "Changes requested"),
        metadata: null,
      });

      if (isClientSignOff && document.siteId) {
        try {
          const assignments = await storage.getConsultantAssignments(document.siteId);
          const site = await storage.getSite(document.siteId);
          const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
          const modulePath = existingDoc.module === "health_safety" ? "health-safety" 
            : existingDoc.module === "human_resources" ? "human-resources" 
            : existingDoc.module === "employment_law" ? "employment-law" 
            : "documents";
          const documentUrl = `${baseUrl}/${modulePath}/documents/${document.id}`;

          if (assignments.length > 0) {
            for (const assignment of assignments) {
              try {
                const consultant = await storage.getUser(assignment.consultantId);
                if (consultant && consultant.email) {
                  await sendClientSignOffEmail({
                    to: consultant.email,
                    fullName: consultant.fullName,
                    documentTitle: existingDoc.title,
                    siteName: site?.name || "Unknown Site",
                    clientName: user.fullName,
                    documentUrl,
                  });
                  await storage.createAuditLog({
                    action: "email_sent",
                    userId: user.id,
                    userName: user.fullName,
                    entityId: document.siteId,
                    documentId: document.id,
                    supportRequestId: null,
                    module: existingDoc.module,
                    details: `Client sign-off notification email sent to consultant ${consultant.fullName} (${consultant.email})`,
                    metadata: null,
                  });
                }
              } catch (emailError) {
                console.error(`Failed to send sign-off notification to consultant ${assignment.consultantId}:`, emailError);
              }
            }
          } else {
            const allUsers = await storage.getAllUsers();
            const admins = allUsers.filter(u => u.role === "admin" && u.email && u.status === "active");
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
                  metadata: null,
                });
              } catch (emailError) {
                console.error(`Failed to send sign-off notification to admin ${admin.id}:`, emailError);
              }
            }
          }
        } catch (err) {
          console.error("Failed to send client sign-off notifications:", err);
        }
      }

      res.json(document);
    } catch (error) {
      console.error("Document approval error:", error);
      res.status(500).json({ error: "Failed to update document approval" });
    }
  });

  // Resend or change approver for a document approval notification
  app.post("/api/documents/:id/approval-notify", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (user.role !== "admin" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only admins and consultants can manage approval notifications" });
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
        metadata: null,
      });

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
      if (!user || (user.role !== "admin" && user.role !== "consultant")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const id = req.params.id;
      const doc = await storage.getDocument(id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      const body = { ...req.body };
      if ("expiryDate" in body) {
        body.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
      }
      if ("renewalDate" in body) {
        body.renewalDate = body.renewalDate ? new Date(body.renewalDate) : null;
      }
      if ("reviewDate" in body) {
        body.reviewDate = body.reviewDate ? new Date(body.reviewDate) : null;
      }

      // Recalculate compliance status when dates are changed
      if (("expiryDate" in body || "renewalDate" in body) && doc.approvalStatus === "approved") {
        const now = new Date();
        const newExpiryDate = "expiryDate" in body ? body.expiryDate : doc.expiryDate;
        const newRenewalDate = "renewalDate" in body ? body.renewalDate : doc.renewalDate;
        if (newExpiryDate && new Date(newExpiryDate) < now) {
          body.status = "overdue";
        } else if (newRenewalDate && new Date(newRenewalDate) < now) {
          body.status = "review_required";
        } else {
          body.status = "compliant";
        }
      }

      const updated = await storage.updateDocument(id, body);
      
      // Log the change
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
      const canAccess = await canUserAccessSite(user, existingDoc.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }

      // Only admins and consultants can archive documents
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot archive documents" });
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
      const canAccess = await canUserAccessSite(user, existingDoc.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this document" });
      }

      // Only admins and consultants can restore documents
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot restore documents" });
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

      if (user.role !== "admin" && !isProConsultant(user)) {
        return res.status(403).json({ error: "Only admins and pro consultants can delete documents" });
      }

      const documentId = req.params.id;
      const existingDoc = await storage.getDocument(documentId);
      if (!existingDoc) return res.status(404).json({ error: "Document not found" });

      // Pro consultants must have access to the document's site
      if (isProConsultant(user)) {
        const canAccess = await canUserAccessSite(user, existingDoc.siteId);
        if (!canAccess) return res.status(403).json({ error: "Access denied to this document" });
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

      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Document delete error:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Document Folders
  app.get("/api/folders", requireAuth, async (req, res) => {
    try {
      const siteId = req.query.siteId as string;
      const module = req.query.module as ModuleType | undefined;
      
      if (!siteId) {
        return res.status(400).json({ error: "siteId is required" });
      }
      
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
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
      
      const { name, description, module, siteId, parentId } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Folder name is required" });
      }
      
      if (!siteId) {
        return res.status(400).json({ error: "Site ID is required" });
      }
      
      if (!module) {
        return res.status(400).json({ error: "Module is required" });
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
        parentId: parentId || null,
        sortOrder: 0,
        createdBy: user.id,
      });
      
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
      
      const canAccess = await canUserAccessSite(user, folder.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
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
      
      const canAccess = await canUserAccessSite(user, folder.siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
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
      
      const { siteId, module } = req.body;
      
      if (!siteId) {
        return res.status(400).json({ error: "Site ID is required" });
      }
      
      if (!module) {
        return res.status(400).json({ error: "Module is required" });
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
      
      const canAccess = await canUserAccessSite(user, document.siteId);
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create folder templates" });
      }
      
      const schema = z.object({
        name: z.string().min(1),
        module: z.enum(["health_safety", "human_resources", "employment_law", "support"]),
        description: z.string().optional(),
        parentId: z.string().nullable().optional(),
        isRequired: z.boolean().optional(),
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update folder templates" });
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
        isRequired: z.boolean().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const updated = await storage.updateFolderTemplate(req.params.id, parsed.data);
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can delete folder templates" });
      }
      
      const template = await storage.getFolderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      
      await storage.deleteFolderTemplate(req.params.id);
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can add folder document type rules" });
      }
      
      const schema = z.object({
        folderTemplateId: z.string().min(1),
        documentTypeId: z.string().min(1),
        isRequired: z.boolean().optional(),
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
        isRequired: parsed.data.isRequired ?? false,
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can add folder template rules" });
      }
      
      const template = await storage.getFolderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      
      const schema = z.object({
        documentTypeId: z.string().min(1),
        isRequired: z.boolean().optional(),
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can delete folder template rules" });
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
      const module = req.query.module as ModuleType | undefined;
      const folderTemplateId = req.query.folderTemplateId as string | undefined;
      const templates = await storage.getDocumentTemplates(module, folderTemplateId);
      res.json(templates);
    } catch (error) {
      console.error("Get document templates error:", error);
      res.status(500).json({ error: "Failed to fetch document templates" });
    }
  });
  
  // Get archived document templates (admin only)
  app.get("/api/document-templates-archived", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can view archived templates" });
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
      const folderTemplate = await storage.getFolderTemplate(req.params.id);
      if (!folderTemplate) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      const templates = await storage.getDocumentTemplates(undefined, req.params.id);
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create document templates" });
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
        isRequired: z.boolean().optional(), // Compliance: is this template required?
        renewalPeriodMonths: z.number().nullable().optional(), // Compliance: how often to renew
        requiresApproval: z.boolean().optional(), // Does document need client approval workflow?
        visibility: z.enum(["public", "private"]).optional(),
        toolkitFolderId: z.string().nullable().optional(),
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
      
      res.status(201).json(template);
    } catch (error) {
      console.error("Create document template error:", error);
      res.status(500).json({ error: "Failed to create document template" });
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
        isRequired: z.boolean().optional(), // Compliance: is this template required?
        renewalPeriodMonths: z.number().nullable().optional(), // Compliance: how often to renew
        requiresApproval: z.boolean().optional(), // Does document need client approval workflow?
        visibility: z.enum(["public", "private"]).optional(),
        folderTemplateId: z.string().nullable().optional(), // Allow folder reassignment (Template Library), null = unassigned
        toolkitFolderId: z.string().nullable().optional(), // Allow toolkit folder assignment (Toolkit drag-and-drop)
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }

      // If only toolkitFolderId or folderTemplateId is being changed, consultants are also allowed
      const changedKeys = Object.keys(parsed.data);
      const isJustFolderChange = changedKeys.length === 1 && (changedKeys[0] === "toolkitFolderId" || changedKeys[0] === "folderTemplateId");
      if (!isJustFolderChange && user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update document templates" });
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can reorder templates" });
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
      const folders = await storage.getToolkitFolders(module as any);
      // Enrich each folder with its linked FolderTemplate id (for auto-assign in template library)
      const enriched = await Promise.all(folders.map(async (f) => {
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
      if (user.role !== "admin") return res.status(403).json({ error: "Only admins can create toolkit folders" });

      const schema = z.object({
        name: z.string().min(1).max(100),
        module: z.enum(["health_safety", "human_resources", "employment_law"]),
        sortOrder: z.number().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });

      const folder = await storage.createToolkitFolder({
        name: parsed.data.name,
        module: parsed.data.module,
        sortOrder: parsed.data.sortOrder ?? 0,
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
          isRequired: false,
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

  app.delete("/api/toolkit/folders/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role !== "admin") return res.status(403).json({ error: "Only admins can delete toolkit folders" });

      // Find and delete the mirrored FolderTemplate subfolder first
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
        details: `Deleted toolkit folder`,
        metadata: JSON.stringify({ folderId: req.params.id }),
      });

      res.json({ success: true });
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

      // Get all toolkit folders
      const allToolkitFolders = await storage.getToolkitFolders();

      // Get all public, active, non-deleted document templates
      const allTemplates = await storage.getDocumentTemplates();
      const publicTemplates = allTemplates.filter(
        (t) => !t.deletedAt && t.isActive && (t as any).visibility !== "private"
      );

      // Build folder map with templates, keyed by toolkit folder id
      const folderMap = new Map<string, {
        id: string; name: string; module: string; sortOrder: number; templates: typeof publicTemplates;
      }>();

      for (const folder of allToolkitFolders) {
        folderMap.set(folder.id, {
          id: folder.id,
          name: folder.name,
          module: folder.module,
          sortOrder: folder.sortOrder,
          templates: [],
        });
      }

      const unassigned: typeof publicTemplates = [];

      for (const template of publicTemplates) {
        const tkFolderId = (template as any).toolkitFolderId;
        if (tkFolderId && folderMap.has(tkFolderId)) {
          folderMap.get(tkFolderId)!.templates.push(template);
        } else {
          unassigned.push(template);
        }
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
      
      const isProConsultant = user.role === "consultant" && user.consultantTier === "pro";
      if (user.role !== "admin" && !isProConsultant) {
        return res.status(403).json({ error: "Only admins and pro consultants can delete document templates" });
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can restore document templates" });
      }
      
      const success = await storage.restoreDocumentTemplate(req.params.id, user.id);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to restore document template" });
      }
      
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

      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can permanently delete document templates" });
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create training modules" });
      }
      
      const schema = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        module: z.enum(["health_safety", "human_resources", "employment_law", "support"]),
        folderTemplateId: z.string().optional(),
        provider: z.string().optional(),
        externalLink: z.string().url(),
        duration: z.string().optional(),
        isRequired: z.boolean().optional(),
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update training modules" });
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
        isRequired: z.boolean().optional(),
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can delete training modules" });
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create training folders" });
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
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update training folders" });
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
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can delete training folders" });
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create training courses" });
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
        isRequired: z.boolean().optional(),
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
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update training courses" });
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
        isRequired: z.boolean().optional(),
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
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can delete training courses" });
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
      
      // Only admins can delete bookings
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can delete training bookings" });
      }
      
      await storage.deleteTrainingBooking(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete training booking error:", error);
      res.status(500).json({ error: "Failed to delete training booking" });
    }
  });

    const isProConsultant = (user: { role: string; consultantTier?: string | null }): boolean => {
    return user.role === "consultant" && user.consultantTier === "pro";
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
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const search = (req.query.search as string || "").toLowerCase();
      const status = req.query.status as string | undefined;
      
      const allCompanies = await storage.getCompaniesWithSiteCount();
      
      let filteredCompanies = allCompanies;
      
      // Role-based filtering
      const myAssigned = req.query.myAssigned === "true";
      if (user.role === "consultant") {
        if (isProConsultant(user) && !myAssigned) {
          // Pro consultants see all companies by default
        } else {
          // Standard consultants (or pro with myAssigned=true) see only their assigned
          const assignments = await storage.getConsultantSites(user.id);
          const siteCompanyIds = new Set<string>();
          for (const a of assignments) {
            const site = await storage.getSite(a.siteId);
            if (site) siteCompanyIds.add(site.companyId);
          }
          filteredCompanies = allCompanies.filter(c => siteCompanyIds.has(c.id));
        }
      } else if (user.role === "client" && user.companyId) {
        filteredCompanies = allCompanies.filter(c => c.id === user.companyId);
      } else if (user.role !== "admin") {
        filteredCompanies = [];
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
      if (user.role === "consultant") {
        if (isProConsultant(user)) {
          // Pro consultants have full access
        } else {
          const assignments = await storage.getConsultantSites(user.id);
          const siteCompanyIds = new Set<string>();
          for (const a of assignments) {
            const site = await storage.getSite(a.siteId);
            if (site) siteCompanyIds.add(site.companyId);
          }
          if (!siteCompanyIds.has(company.id)) {
            return res.status(403).json({ error: "Access denied" });
          }
        }
      } else if (user.role === "client") {
        if (user.companyId !== company.id) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (user.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get sites for this company (optimized - only fetches this company's sites)
      const companySites = await storage.getSitesWithDetailsByCompanyId(company.id);
      
      res.json({
        ...company,
        sites: companySites
      });
    } catch (error) {
      console.error("Company detail error:", error);
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  // Create company
  app.post("/api/companies", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role !== "admin" && !isProConsultant(user)) {
        return res.status(403).json({ error: "Only admins and pro consultants can create companies" });
      }
      
      const { name, companyNumber, website, address, contactEmail, contactPhone, site, addressLine1, addressLine2, city, county, postalCode, country, employeeRange } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Company name is required" });
      }
      
      if (!site || !site.name || !site.name.trim()) {
        return res.status(400).json({ error: "At least one site with a name is required when creating a company" });
      }
      
      const company = await storage.createCompany({
        name: name.trim(),
        companyNumber: companyNumber || null,
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
      
      if (user.role !== "admin" && !isProConsultant(user)) {
        return res.status(403).json({ error: "Only admins and pro consultants can update companies" });
      }
      
      const { name, companyNumber, website, address, contactEmail, contactPhone, contactName, contactPosition, contactUserId, status, addressLine1, addressLine2, city, county, postalCode, country, searchTag, employeeRange } = req.body;
      
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (companyNumber !== undefined) updates.companyNumber = companyNumber || null;
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
      
      const company = await storage.updateCompany(req.params.id, updates);
      
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Auto-assign primary contact user to all company sites
      if (contactUserId) {
        const contactUser = await storage.getUser(contactUserId);
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
        }
      }
      
      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (user.role !== "admin" && !isProConsultant(user)) {
        return res.status(403).json({ error: "Only admins and pro consultants can delete companies" });
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

  // Sites
  app.get("/api/sites", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const allSites = await storage.getSitesWithDetails();
      
      // Admin sees all sites
      if (user.role === "admin") {
        res.json(allSites);
        return;
      }
      
      // Consultant site visibility
      if (user.role === "consultant") {
        const myAssigned = req.query.myAssigned === "true";
        if (isProConsultant(user) && !myAssigned) {
          // Pro consultants see all sites by default
          res.json(allSites);
          return;
        }
        // Standard consultants (or pro with myAssigned=true) see only their assigned
        const assignments = await storage.getConsultantSites(user.id);
        const assignedSiteIds = new Set(assignments.map(a => a.siteId));
        const filteredSites = allSites.filter(site => assignedSiteIds.has(site.id));
        res.json(filteredSites);
        return;
      }
      
      // Client sees only their explicitly assigned sites
      if (user.role === "client" && user.companyId) {
        const clientSiteAssignments = await storage.getClientSites(user.id);
        const assignedSiteIds = new Set(clientSiteAssignments.map(a => a.siteId));
        const filteredSites = allSites.filter(site => 
          site.companyId === user.companyId && assignedSiteIds.has(site.id)
        );
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

  // Create entity
  app.post("/api/sites", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin or pro consultant can create sites
      if (user.role !== "admin" && !isProConsultant(user)) {
        return res.status(403).json({ error: "Only admins and pro consultants can create sites" });
      }
      
      const { name, companyId, address, siteManager, contactPhone } = req.body;
      
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
        siteManager: siteManager || null,
        contactPhone: contactPhone || null,
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
      if (user.role !== "admin" && !isProConsultant(user)) {
        return res.status(403).json({ error: "Only admins and pro consultants can update sites" });
      }
      
      const { name, companyNumber, address, contactEmail, contactPhone, website } = req.body;
      
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (companyNumber !== undefined) updates.companyNumber = companyNumber || null;
      if (address !== undefined) updates.address = address || null;
      if (contactEmail !== undefined) updates.contactEmail = contactEmail || null;
      if (contactPhone !== undefined) updates.contactPhone = contactPhone || null;
      if (website !== undefined) updates.website = website || null;
      
      const entity = await storage.updateSite(req.params.siteId, updates);
      if (!entity) {
        return res.status(404).json({ error: "Entity not found" });
      }
      
      res.json(entity);
    } catch (error) {
      console.error("Update entity error:", error);
      res.status(500).json({ error: "Failed to update entity" });
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
      res.json(entity);
    } catch (error) {
      console.error("Get entity error:", error);
      res.status(500).json({ error: "Failed to fetch entity" });
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
      if (user.role === "admin") {
        // Admins can see all requests, optionally filter by company/site
        if (siteId) {
          requests = requests.filter(r => r.siteId === siteId);
        } else if (companyId) {
          const companySites = await storage.getSites();
          const siteIds = companySites.filter(s => s.companyId === companyId).map(s => s.id);
          requests = requests.filter(r => siteIds.includes(r.siteId));
        }
      } else if (user.role === "consultant") {
        if (isProConsultant(user)) {
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
      
      // Enrich with user names, unread count, and latest message
      const enrichedRequests = await Promise.all(requests.map(async (request) => {
        const createdByUser = await storage.getUser(request.createdBy);
        const respondedByUser = request.respondedBy ? await storage.getUser(request.respondedBy) : null;
        const unreadCount = await storage.getUnreadMessageCount(request.id, user.id);
        const latestMessage = await storage.getLatestSupportMessage(request.id);
        const latestMessageSender = latestMessage ? await storage.getUser(latestMessage.senderId) : null;
        
        return {
          ...request,
          createdByName: createdByUser?.fullName || createdByUser?.username || "Unknown",
          respondedByName: respondedByUser?.fullName || respondedByUser?.username || null,
          unreadCount,
          latestMessage: latestMessage ? {
            message: latestMessage.message.length > 80 ? latestMessage.message.slice(0, 80) + "..." : latestMessage.message,
            senderName: latestMessageSender?.fullName || latestMessageSender?.username || "Unknown",
            createdAt: latestMessage.createdAt,
          } : null,
        };
      }));

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
      
      if (user.role === "admin" || isProConsultant(user)) {
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

      // Only admins and consultants can update requests
      if (user.role === "client") {
        return res.status(403).json({ error: "Only consultants and admins can respond to requests" });
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

      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can clear all support requests" });
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
      if (request.status === "open" && (user.role === "admin" || user.role === "consultant")) {
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
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
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
        isRequired: body.isRequired ?? false,
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
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
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
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
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
      // Only admins can grant access
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can grant document type access" });
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
      // Only admins can revoke access
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can revoke document type access" });
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
      
      // Only admins and consultants can view archived cases
      if (includeArchived && (user.role === "admin" || user.role === "consultant")) {
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
      
      // Filter out confidential cases for non-privileged users
      // Consultants with site access can see all cases (including confidential) at their assigned sites
      const filteredCases = cases.filter(c => {
        if (!c.isConfidential) return true;
        if (user.role === "admin") return true;
        if (user.role === "consultant") return true; // Consultants can see all confidential cases at their assigned sites
        if (c.createdBy === user.id) return true;
        if (c.assignedConsultant === user.id) return true;
        if (c.restrictedToUsers && c.restrictedToUsers.includes(user.id)) return true;
        return false;
      });

      res.json(filteredCases);
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
        const canAccess = user.role === "admin" || 
          user.role === "consultant" || // Consultants can see all confidential cases at their assigned sites
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

      // Only admins and consultants can create cases
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot create employment law cases" });
      }

      const parseResult = createCaseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid case data", details: parseResult.error.format() });
      }

      const { restrictedToUsers, ...restData } = parseResult.data;
      const caseData = await storage.createCase({
        ...restData,
        hearingDate: parseResult.data.hearingDate ? new Date(parseResult.data.hearingDate) : undefined,
        responseDeadline: parseResult.data.responseDeadline ? new Date(parseResult.data.responseDeadline) : undefined,
        createdBy: user.id,
        assignedConsultant: user.role === "consultant" ? user.id : undefined,
        restrictedToUsers: restrictedToUsers ? JSON.stringify(restrictedToUsers) : null,
      });

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

      // Only admins and consultants can archive cases
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

      // Only admins and consultants can unarchive cases
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

      res.json(unarchivedCase);
    } catch (error) {
      console.error("Unarchive case error:", error);
      res.status(500).json({ error: "Failed to unarchive case" });
    }
  });

  // Helper function to check case confidentiality access
  // Consultants with site access can see all confidential cases at their assigned sites
  const canAccessConfidentialCase = (caseData: any, user: any): boolean => {
    if (!caseData.isConfidential) return true;
    if (user.role === "admin") return true;
    if (user.role === "consultant") return true; // Consultants can access all confidential cases at their assigned sites
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
      if (user.role !== "admin" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only admins and consultants can upload case documents" });
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
      if (user.role !== "admin" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only admins and consultants can delete case documents" });
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

      const { isCompleted } = req.body;
      const updates: any = {};
      
      if (typeof isCompleted === "boolean") {
        updates.isCompleted = isCompleted;
        if (isCompleted) {
          updates.completedDate = new Date();
        }
      }

      const milestone = await storage.updateCaseMilestone(req.params.id, updates);
      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      // Create audit log if completing (with case context)
      if (isCompleted) {
        const caseData = await storage.getCase(milestone.caseId);
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

      // Only admins and consultants can delete milestones
      if (user.role === "client") {
        return res.status(403).json({ error: "Clients cannot delete milestones" });
      }

      const milestone = await storage.getCaseMilestone(req.params.id);
      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
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

      res.json({ success: true });
    } catch (error) {
      console.error("Delete milestone error:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
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
      if (user.role === "admin" || user.role === "consultant") {
        return res.json({
          health_safety: "active",
          human_resources: "active",
          employment_law: "active",
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
          support: "hidden",
          reports: "hidden",
        });
      }
      
      // Convert company boolean access to status format for frontend compatibility
      res.json({
        health_safety: companyAccess.healthSafety ? "active" : "hidden",
        human_resources: companyAccess.humanResources ? "active" : "hidden",
        employment_law: companyAccess.employmentLaw ? "active" : "hidden",
        support: companyAccess.support ? "active" : "hidden",
        reports: companyAccess.reports ? "active" : "hidden",
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
      
      // Only admin and consultants can set module access
      if (user.role !== "admin" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only admins and consultants can manage module access" });
      }
      
      // Consultants need canManageModules permission on this site
      if (user.role === "consultant") {
        const assignments = await storage.getConsultantAssignments(user.id);
        const siteAssignment = assignments.find(a => a.siteId === req.params.siteId);
        if (!siteAssignment) {
          return res.status(403).json({ error: "You are not assigned to this site" });
        }
        if (!siteAssignment.canManageModules) {
          return res.status(403).json({ error: "You do not have permission to manage modules for this site" });
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
      
      res.json(access);
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
      
      // Only admin can set company module access
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can manage company module access" });
      }
      
      const { healthSafety, humanResources, employmentLaw, support, reports } = req.body;
      
      // At least one module should be specified
      if (healthSafety === undefined && humanResources === undefined && 
          employmentLaw === undefined && support === undefined && reports === undefined) {
        return res.status(400).json({ error: "At least one module access setting is required" });
      }
      
      const company = await storage.setCompanyModuleAccess(req.params.companyId, {
        healthSafety,
        humanResources,
        employmentLaw,
        support,
        reports,
      });
      
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      res.json({
        healthSafety: company.healthSafetyAccess,
        humanResources: company.humanResourcesAccess,
        employmentLaw: company.employmentLawAccess,
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
      if (!user || (user.role !== "admin" && user.role !== "consultant")) {
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
      if (!user || (user.role !== "admin" && user.role !== "consultant")) {
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
      res.json(result);
    } catch (error) {
      console.error("Set company required templates error:", error);
      res.status(500).json({ error: "Failed to set required templates" });
    }
  });

  app.post("/api/companies/:companyId/required-templates", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "admin" && user.role !== "consultant")) {
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
      res.status(201).json(result);
    } catch (error) {
      console.error("Add company required template error:", error);
      res.status(500).json({ error: "Failed to add required template" });
    }
  });

  app.delete("/api/companies/:companyId/required-templates/:templateId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "admin" && user.role !== "consultant")) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { companyId, templateId } = req.params;
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });
      await storage.removeCompanyRequiredTemplate(companyId, templateId);
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
      if (!user || (user.role !== "admin" && user.role !== "consultant")) {
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
      if (!user || (user.role !== "admin" && user.role !== "consultant")) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { siteId } = req.params;
      const { templateId, action } = req.body;
      if (!templateId || !action || (action !== "include" && action !== "exclude")) {
        return res.status(400).json({ error: "templateId and action ('include'|'exclude') are required" });
      }
      const result = await storage.setSiteTemplateOverride(siteId, templateId, action, user.id);
      res.json(result);
    } catch (error) {
      console.error("Set site template override error:", error);
      res.status(500).json({ error: "Failed to set site template override" });
    }
  });

  app.delete("/api/sites/:siteId/template-overrides/:templateId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "admin" && user.role !== "consultant")) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { siteId, templateId } = req.params;
      const removed = await storage.removeSiteTemplateOverride(siteId, templateId);
      if (!removed) return res.status(404).json({ error: "Override not found" });
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
      if (isAllSites) {
        // Get all sites user can access
        const allSites = await storage.getSites();
        for (const site of allSites) {
          const canAccess = await canUserAccessSite(user, site.id);
          if (canAccess) {
            // Apply company filter if specified
            if (requestedCompanyId) {
              if (site.companyId === requestedCompanyId) {
                targetSiteIds.push(site.id);
              }
            } else {
              targetSiteIds.push(site.id);
            }
          }
        }
      } else {
        targetSiteIds = [siteId];
      }
      
      // Get actual document folders provisioned for target sites
      let siteFolders: any[] = [];
      for (const targetId of targetSiteIds) {
        const folders = await storage.getDocumentFolders(targetId, module as any);
        siteFolders = siteFolders.concat(folders);
      }
      
      // Get all documents for target sites in this module
      const includeArchived = req.query.includeArchived === "true";
      const allDocuments = await storage.getDocuments(module as any, includeArchived);
      const siteDocuments = allDocuments.filter(d => targetSiteIds.includes(d.siteId));

      // Build company required-templates lookup so hierarchy document badges reflect
      // effective compliance requirement (isRequired via company config OR per-document flag)
      const allSitesHierarchy = await storage.getSites();
      const siteToCompanyHierarchy = new Map(allSitesHierarchy.map(s => [s.id, s.companyId]));
      const uniqueCompanyIdsHierarchy = [...new Set(targetSiteIds.map(id => siteToCompanyHierarchy.get(id)).filter(Boolean) as string[])];
      const companyReqCacheHierarchy = new Map<string, Set<string>>();
      await Promise.all(uniqueCompanyIdsHierarchy.map(async (companyId) => {
        const reqs = await storage.getCompanyRequiredTemplates(companyId);
        companyReqCacheHierarchy.set(companyId, new Set(reqs.map(r => r.templateId)));
      }));
      const getEffectiveIsRequired = (doc: { isRequired: boolean; templateId?: string | null; siteId: string }, docTmpl?: { isRequired?: boolean } | null) => {
        const companyId = siteToCompanyHierarchy.get(doc.siteId);
        const isRequiredViaCompanyTemplate = companyId && doc.templateId
          ? (companyReqCacheHierarchy.get(companyId)?.has(doc.templateId) ?? false)
          : false;
        return doc.isRequired || docTmpl?.isRequired || isRequiredViaCompanyTemplate;
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
          const requiredTemplates = folderDocTemplates.filter(dt => dt.isRequired);
          
          // Get documents from ALL matching folders across all sites
          const matchingFolderIds = matchingSiteFolders.map(sf => sf.id);
          const folderDocuments = matchingFolderIds.length > 0
            ? siteDocuments.filter(d => matchingFolderIds.includes(d.folderId))
            : [];
          
          // Calculate compliance stats
          const compliantCount = folderDocuments.filter(d => d.status === "compliant").length;
          const reviewRequiredCount = folderDocuments.filter(d => d.status === "review_required").length;
          const overdueCount = folderDocuments.filter(d => d.status === "overdue").length;
          const pendingApprovalCount = folderDocuments.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;
          
          // Check if required templates have been fulfilled
          const fulfilledRequiredCount = requiredTemplates.filter(rt => 
            folderDocuments.some(d => d.templateId === rt.id)
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
            const childRequiredTemplates = childDocTemplates.filter(dt => dt.isRequired);
            const childFulfilledCount = childRequiredTemplates.filter(rt =>
              childFolderDocs.some(d => d.templateId === rt.id)
            ).length;
            
            return {
              id: childTemplate.id,
              name: childTemplate.name,
              description: childTemplate.description,
              isRequired: childTemplate.isRequired,
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
                  status: d.status,
                  approvalStatus: d.approvalStatus,
                  source: d.source,
                  templateId: d.templateId,
                  expiryDate: d.expiryDate,
                  updatedAt: d.updatedAt,
                  isArchived: d.isArchived,
                  isRequired: getEffectiveIsRequired(d, docTemplate),
                  renewalPeriodMonths: docTemplate?.renewalPeriodMonths || null,
                };
              }),
              stats: {
                totalDocuments: childFolderDocs.length,
                compliant: childFolderDocs.filter(d => d.status === "compliant").length,
                reviewRequired: childFolderDocs.filter(d => d.status === "review_required").length,
                overdue: childFolderDocs.filter(d => d.status === "overdue").length,
                requiredTemplates: childRequiredTemplates.length,
                fulfilledRequired: childFulfilledCount,
              },
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
                isRequired: false,
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
                    status: d.status,
                    approvalStatus: d.approvalStatus,
                    source: d.source,
                    templateId: d.templateId,
                    expiryDate: d.expiryDate,
                    updatedAt: d.updatedAt,
                    isArchived: d.isArchived,
                    isRequired: getEffectiveIsRequired(d, docTemplate),
                    renewalPeriodMonths: docTemplate?.renewalPeriodMonths || null,
                  };
                }),
                stats: {
                  totalDocuments: dynamicFolderDocs.length,
                  compliant: dynamicFolderDocs.filter(d => d.status === "compliant").length,
                  reviewRequired: dynamicFolderDocs.filter(d => d.status === "review_required").length,
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
          const childReviewRequired = childFolders.reduce((sum, cf) => sum + (cf.stats?.reviewRequired || 0), 0);
          const childOverdue = childFolders.reduce((sum, cf) => sum + (cf.stats?.overdue || 0), 0);
          
          return {
            id: folderTemplate.id,
            name: folderTemplate.name,
            description: folderTemplate.description,
            isRequired: folderTemplate.isRequired,
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
                status: d.status,
                approvalStatus: d.approvalStatus,
                source: d.source,
                templateId: d.templateId,
                expiryDate: d.expiryDate,
                updatedAt: d.updatedAt,
                isArchived: d.isArchived,
                isRequired: getEffectiveIsRequired(d, docTemplate),
                renewalPeriodMonths: docTemplate?.renewalPeriodMonths || null,
              };
            }),
            childFolders,
            stats: {
              totalDocuments: folderDocuments.length + childDocsTotal,
              compliant: compliantCount + childCompliant,
              reviewRequired: reviewRequiredCount + childReviewRequired,
              overdue: overdueCount + childOverdue,
              pendingApproval: pendingApprovalCount,
              requiredTemplates: requiredTemplates.length,
              fulfilledRequired: fulfilledRequiredCount,
              folderStatus,
            },
            templateInfo: folderDocTemplates.map(dt => ({
              id: dt.id,
              name: dt.name,
              isRequired: dt.isRequired,
              renewalPeriodMonths: dt.renewalPeriodMonths,
              hasFulfilledDocument: folderDocuments.some(d => d.templateId === dt.id),
            })),
          };
        });
      
      // Also include unfiled documents (documents not in any folder)
      const unfiledDocuments = siteDocuments.filter(d => !d.folderId);
      
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
            status: d.status,
            approvalStatus: d.approvalStatus,
            source: d.source,
            templateId: d.templateId,
            expiryDate: d.expiryDate,
            updatedAt: d.updatedAt,
            isRequired: docTemplate?.isRequired || false,
            renewalPeriodMonths: docTemplate?.renewalPeriodMonths || null,
          };
        }),
        summary: {
          totalFolders: hierarchy.length,
          totalDocuments: siteDocuments.length,
          compliant: siteDocuments.filter(d => d.status === "compliant").length,
          reviewRequired: siteDocuments.filter(d => d.status === "review_required").length,
          overdue: siteDocuments.filter(d => d.status === "overdue").length,
        },
      });
    } catch (error) {
      console.error("Get documents hierarchy error:", error);
      res.status(500).json({ error: "Failed to fetch documents hierarchy" });
    }
  });

  // All Users Routes
  
  // Get all users (admin only)
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin and consultant can see all users (for admin reports)
      if (user.role !== "admin" && user.role !== "consultant") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const allUsers = await storage.getAllUsers();
      const allSites = await storage.getSites();
      const allCompanies = await storage.getCompanies();
      
      // Enrich users with site assignments
      const usersWithAssignments = await Promise.all(allUsers.map(async (u) => {
        const { password, ...safeUser } = u;
        
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
          return { ...safeUser, siteAssignments: assignments };
        } else if (u.role === "client") {
          const clientAssignments = await storage.getClientSites(u.id);
          const assignments = clientAssignments.map(a => {
            const site = allSites.find(s => s.id === a.siteId);
            const company = site ? allCompanies.find(c => c.id === site.companyId) : null;
            return { siteId: a.siteId, siteName: site?.name || "Unknown", companyName: company?.name || "Unknown", isPrimary: false };
          });
          return { ...safeUser, siteAssignments: assignments };
        }
        
        return safeUser;
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
      
      if (currentUser.role !== "admin" && !isProConsultant(currentUser)) {
        return res.status(403).json({ error: "Only admins and pro consultants can create users" });
      }
      
      const { 
        username, email, fullName, role, companyId, 
        consultantTier, clientPermissionRole,
        title, firstName, lastName, jobTitle, department, phone, mobile,
        preferredContactMethod, notes
      } = req.body;
      
      // Pro consultants can only create consultant or client users (not admin)
      if (isProConsultant(currentUser) && role === "admin") {
        return res.status(403).json({ error: "Pro consultants cannot create admin users" });
      }
      
      if (!username || !email) {
        return res.status(400).json({ error: "Username and email are required" });
      }
      
      // Clients must be assigned to a company
      if ((role === "client" || !role) && !companyId) {
        return res.status(400).json({ error: "Company is required for client users" });
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
        clientPermissionRole: clientPermissionRole || "viewer",
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
      
      const { password: _, ...safeUser } = newUser;

      // For client users, don't generate invite yet - they need site assignment or primary contact status first
      if (userRole === "client") {
        res.status(201).json({ 
          ...safeUser, 
          requiresSiteAssignment: true,
        });
      } else {
        // For admin/consultant users, generate invitation token and send email immediately
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
        
        const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
        const inviteUrl = `${baseUrl}/set-password?token=${token}`;
        
        let emailSent = false;
        try {
          await sendInvitationEmail({
            to: newUser.email,
            fullName: newUser.fullName,
            inviteUrl,
            expiresAt,
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
        
        res.status(201).json({ 
          ...safeUser, 
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
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create users" });
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
        clientPermissionRole: clientPermissionRole || "viewer",
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

  // Consultant Assignment Routes
  
  // Get all consultants with entity assignments
  app.get("/api/consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin can see all consultants
      if (user.role !== "admin") {
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

  // Create a new consultant
  app.post("/api/consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin can create consultants
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create consultants" });
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
      if (user.role !== "admin" && !isProConsultant(user)) {
        return res.status(403).json({ error: "Only admins and pro consultants can assign consultants" });
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
      if (user.role !== "admin" && !isProConsultant(user)) {
        return res.status(403).json({ error: "Only admins and pro consultants can remove consultant assignments" });
      }
      
      const removed = await storage.removeConsultantAssignment(
        req.params.consultantId,
        req.params.siteId
      );
      
      if (!removed) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
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
      if (user.role !== "admin" && !isProConsultant(user)) {
        return res.status(403).json({ error: "Only admins and pro consultants can update consultant assignments" });
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
      if (user.role !== "admin" && user.role !== "consultant") {
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
      if (user.role !== "admin" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only admins and consultants can assign clients to sites" });
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
      if (user.role !== "admin" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only admins and consultants can remove client site assignments" });
      }
      
      const clientUser = await storage.getUser(req.params.clientId);
      if (clientUser && clientUser.role === "client") {
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
      
      // Only admin can view user assignments
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Only admins can view user site assignments" });
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
      
      // Only admin can add site assignments
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Only admins can manage site assignments" });
      }
      
      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const site = await storage.getSite(req.params.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
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
        
        res.json(assignment);
      } else {
        res.status(400).json({ error: "Admins do not need site assignments" });
      }
    } catch (error) {
      console.error("Add site assignment error:", error);
      res.status(500).json({ error: "Failed to add site assignment" });
    }
  });

  // Remove site assignment from user (admin only)
  app.delete("/api/users/:userId/site-assignments", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser((req.session as any).userId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ error: "Only admins can manage site assignments" });
      }
      const targetUser = await storage.getUser(req.params.userId);
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
      
      // Only admin can remove site assignments
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Only admins can manage site assignments" });
      }
      
      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const site = await storage.getSite(req.params.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
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
      if (!currentUser || (currentUser.role !== "admin" && !isProConsultant(currentUser))) {
        return res.status(403).json({ error: "Only admins and pro consultants can delete users" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (targetUser.id === currentUser.id) {
        return res.status(400).json({ error: "You cannot delete your own account" });
      }

      if (targetUser.role === "admin") {
        return res.status(400).json({ error: "Admin users cannot be deleted" });
      }
      
      // Pro consultants cannot delete other consultants or admins
      if (isProConsultant(currentUser) && targetUser.role === "consultant") {
        return res.status(403).json({ error: "Pro consultants cannot delete other consultant accounts" });
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
      
      if (currentUser.role !== "admin") {
        if (isProConsultant(currentUser)) {
          // Pro consultants have full access to update users
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
          return res.status(403).json({ error: "Only admins and pro consultants can update users" });
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
        consultantTier
      } = req.body;
      
      const updated = await storage.updateUser(req.params.id, {
        ...(status !== undefined && { status }),
        ...(clientPermissionRole !== undefined && { clientPermissionRole }),
        ...(email !== undefined && { email }),
        ...(fullName !== undefined && { fullName }),
        ...(title !== undefined && { title }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(department !== undefined && { department }),
        ...(phone !== undefined && { phone }),
        ...(mobile !== undefined && { mobile }),
        ...(preferredContactMethod !== undefined && { preferredContactMethod }),
        ...(notes !== undefined && { notes }),
        ...(role !== undefined && { role }),
        ...(companyId !== undefined && { companyId }),
        ...(consultantTier !== undefined && { consultantTier }),
      });
      
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Remove password from response
      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ==================== ROADMAP ROUTES (Admin Only) ====================

  const createRoadmapItemSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().nullable(),
    category: z.enum(["feature", "improvement", "bug", "enhancement", "ai"]).optional().default("feature"),
    status: z.enum(["idea", "planned", "in_progress", "completed"]).optional().default("idea"),
    priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
    sortOrder: z.number().optional().default(0),
  });

  const updateRoadmapItemSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    category: z.enum(["feature", "improvement", "bug", "enhancement", "ai"]).optional(),
    status: z.enum(["idea", "planned", "in_progress", "completed"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    sortOrder: z.number().optional(),
    developerNotes: z.string().optional().nullable(),
  });

  // Get all roadmap items
  app.get("/api/roadmap", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
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
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
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
        sortOrder: parsed.data.sortOrder,
      });
      
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
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
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
      if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
      if (parsed.data.developerNotes !== undefined) updateData.developerNotes = parsed.data.developerNotes;
      
      const updated = await storage.updateRoadmapItem(req.params.id, updateData);
      
      if (!updated) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      
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
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const deleted = await storage.deleteRoadmapItem(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      
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
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ error: "Only admins can manage legal documents" });
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

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const revisionDate = new Date().toISOString();

      await file.save(buffer, {
        contentType: contentType,
        metadata: {
          originalName: fileName,
          uploadedBy: currentUser.username,
          uploadedAt: revisionDate,
          revisionDate: revisionDate,
        },
      });

      res.json({
        success: true,
        type: docType,
        fileName,
        fileSize: buffer.length,
        mimeType: contentType,
        revisionDate,
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

  // ==================== FEEDBACK ENDPOINTS ====================
  // All feedback endpoints are for admin/consultant only
  const requirePrivileged = (req: any, res: any, next: any) => {
    const user = (req.session as any)?.user;
    if (user?.role !== "admin" && user?.role !== "consultant") {
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
      // Only admins can update feedback
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update feedback" });
      }

      const parseResult = updateFeedbackSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid update data" });
      }

      const updated = await storage.updateFeedback(req.params.id, parseResult.data);
      if (!updated) {
        return res.status(404).json({ error: "Feedback not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating feedback:", error);
      res.status(500).json({ error: "Failed to update feedback" });
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
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can delete feedback" });
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

      res.json(incidents);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  // ─── Incident Report HTML Generator ─────────────────────────────────────────

  function generateIncidentReportHtml(incident: any, siteName: string, companyName: string): string {
    const fmt = (d: string | Date | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
    const bool = (v: boolean) => v ? "Yes" : "No";
    const field = (label: string, value: string | null | undefined) =>
      `<tr><td class="label">${label}</td><td class="value">${value && value.trim() ? value.replace(/\n/g, "<br>") : '<span class="empty">Not provided</span>'}</td></tr>`;

    const severityColour: Record<string, string> = { minor: "#22c55e", moderate: "#f59e0b", major: "#ef4444", critical: "#7f1d1d" };
    const colour = severityColour[incident.severity] || "#374151";

    return `<!DOCTYPE html>
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
  .severity-banner{padding:10px 32px;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#fff;background:${colour}}
  .body{padding:24px 32px}
  section{margin-bottom:24px}
  section h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  td{padding:7px 0;vertical-align:top;border-bottom:1px solid #f3f4f6;font-size:13px}
  td.label{width:200px;color:#6b7280;font-weight:500;padding-right:16px;white-space:nowrap}
  td.value{color:#111827;line-height:1.5}
  .empty{color:#9ca3af;font-style:italic}
  .flag{display:inline-flex;align-items:center;gap:5px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;padding:3px 8px;font-size:12px;font-weight:600;margin-right:6px;margin-top:2px}
  .footer{border-top:1px solid #e5e7eb;padding:14px 32px;background:#f9fafb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{body{background:#fff;padding:0}.page{border:none;border-radius:0}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div style="font-size:11px;opacity:.7;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Guardian Group</div>
      <h1>Incident Report</h1>
      <div class="ref-badge">${incident.incidentReference}</div>
    </div>
    <div class="meta">
      <div>Reported by: <strong>${incident.reportedByName}</strong></div>
      <div>Date reported: <strong>${fmt(incident.createdAt)}</strong></div>
      <div>Company: <strong>${companyName}</strong></div>
      <div>Site: <strong>${siteName}</strong></div>
    </div>
  </div>
  <div class="severity-banner">Severity: ${incident.severity}&nbsp;&nbsp;|&nbsp;&nbsp;Status: ${incident.status.replace(/_/g, " ")}</div>
  <div class="body">
    <section>
      <h2>Incident Overview</h2>
      <table>
        ${field("Reference", incident.incidentReference)}
        ${field("Title", incident.title)}
        ${field("Incident Date", fmt(incident.incidentDate))}
        ${field("Incident Type", incident.incidentType?.replace(/_/g, " "))}
        ${field("Severity", incident.severity)}
        ${field("Location Details", incident.locationDetails)}
      </table>
    </section>
    <section>
      <h2>Description</h2>
      <table>
        ${field("What Happened", incident.description)}
      </table>
    </section>
    ${(incident.injuriesReported || incident.riddorReportable) ? `
    <section>
      <h2>Safety Flags</h2>
      <div style="margin-bottom:8px">
        ${incident.injuriesReported ? '<span class="flag">⚠ Injuries Reported</span>' : ""}
        ${incident.riddorReportable ? '<span class="flag">⚠ RIDDOR Reportable</span>' : ""}
      </div>
      <table>
        ${field("Injuries Reported", bool(incident.injuriesReported))}
        ${field("RIDDOR Reportable", bool(incident.riddorReportable))}
        ${field("Injury Details", incident.injuryDetails)}
      </table>
    </section>` : ""}
    <section>
      <h2>Response &amp; Investigation</h2>
      <table>
        ${field("Immediate Actions Taken", incident.immediateActions)}
        ${field("Witnesses", incident.witnesses)}
        ${field("Root Cause", incident.rootCause)}
        ${field("Corrective Actions", incident.correctiveActions)}
      </table>
    </section>
  </div>
  <div class="footer">
    <span>This is the original incident report as submitted. Generated ${new Date().toLocaleString("en-GB")}.</span>
    <span>${incident.incidentReference} &bull; Confidential</span>
  </div>
</div>
</body>
</html>`;
  }

  async function uploadIncidentReportDocument(incident: any, user: any, siteName: string, companyName: string): Promise<void> {
    try {
      const html = generateIncidentReportHtml(incident, siteName, companyName);
      const buffer = Buffer.from(html, "utf-8");
      const objectStorageService = new ObjectStorageService();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const objectId = crypto.randomUUID();
      const fullPath = `${privateObjectDir}/uploads/${objectId}`;
      const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      await file.save(buffer, { contentType: "text/html", metadata: { originalName: `Incident_Report_${incident.incidentReference}.html` } });
      const objectPath = `/objects/uploads/${objectId}`;

      const existingDocs = await storage.getIncidentDocuments(incident.id);
      const existingReport = existingDocs.find((d: any) => d.fileName === `Incident_Report_${incident.incidentReference}.html`);
      if (existingReport) {
        await storage.updateDocument(existingReport.id, { fileUrl: objectPath, fileName: `Incident_Report_${incident.incidentReference}.html`, fileSize: buffer.length });
      } else {
        const doc = await storage.createDocument({
          title: `Original Incident Report – ${incident.incidentReference}`,
          comments: `Automatically generated incident report for ${incident.incidentReference}. Contains all details as submitted.`,
          module: "health_safety",
          type: "incident_report",
          entityId: incident.entityId,
          siteId: incident.siteId,
          incidentId: incident.id,
          folderId: incident.folderId,
          fileName: `Incident_Report_${incident.incidentReference}.html`,
          fileUrl: objectPath,
          fileSize: buffer.length,
          mimeType: "text/html",
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
          details: `Original Incident Report generated for ${incident.incidentReference}`,
          incidentId: incident.id,
        } as any);
      }
    } catch (err) {
      console.error("Failed to generate incident report document:", err);
    }
  }

  app.get("/api/incidents/:id", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });
      const canAccess = await canUserAccessSite(user, incident.siteId);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });
      res.json(incident);
    } catch (error) {
      console.error("Error fetching incident:", error);
      res.status(500).json({ error: "Failed to fetch incident" });
    }
  });

  app.post("/api/incidents", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const body = req.body;

      if (!body.title || !body.description || !body.incidentType || !body.severity || !body.siteId || !body.entityId || !body.incidentDate) {
        return res.status(400).json({ error: "Missing required fields" });
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

      // Auto-generate the original incident report document
      const [site, company] = await Promise.all([
        storage.getSite(incident.siteId).catch(() => null),
        storage.getCompany(incident.entityId).catch(() => null),
      ]);
      uploadIncidentReportDocument(incident, user, site?.name || "Unknown Site", company?.name || "Unknown Company");

      res.status(201).json(incident);
    } catch (error) {
      console.error("Error creating incident:", error);
      res.status(500).json({ error: "Failed to create incident" });
    }
  });

  app.post("/api/incidents/:id/regenerate-report", requireAuth, requirePrivileged, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });

      const [site, company] = await Promise.all([
        storage.getSite(incident.siteId).catch(() => null),
        storage.getCompany(incident.entityId).catch(() => null),
      ]);

      await uploadIncidentReportDocument(incident, user, site?.name || "Unknown Site", company?.name || "Unknown Company");
      await storage.createAuditLog({
        action: "incident_updated",
        userId: user.id,
        userName: user.fullName,
        entityId: incident.entityId,
        module: "health_safety",
        details: `Incident Report document regenerated for ${incident.incidentReference}`,
        incidentId: incident.id,
      } as any);

      res.json({ success: true });
    } catch (error) {
      console.error("Error regenerating incident report:", error);
      res.status(500).json({ error: "Failed to regenerate report" });
    }
  });

  app.patch("/api/incidents/:id", requireAuth, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const { id } = req.params;
      const updates = req.body;

      const existing = await storage.getIncident(id);
      if (!existing) return res.status(404).json({ error: "Incident not found" });

      if (updates.resolvedAt) updates.resolvedAt = new Date(updates.resolvedAt);
      if (updates.incidentDate) updates.incidentDate = new Date(updates.incidentDate);

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

      res.json(incident);
    } catch (error) {
      console.error("Error updating incident:", error);
      res.status(500).json({ error: "Failed to update incident" });
    }
  });

  app.get("/api/incidents/:id/milestones", requireAuth, async (req, res) => {
    try {
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
      const updates = req.body;
      if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);
      if (updates.completedDate) updates.completedDate = new Date(updates.completedDate);
      const milestone = await storage.updateIncidentMilestone(req.params.id, updates);
      if (!milestone) return res.status(404).json({ error: "Milestone not found" });

      if (updates.isCompleted && milestone.incidentId) {
        const incident = await storage.getIncident(milestone.incidentId);
        if (incident) {
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

      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  app.delete("/api/milestones/incident/:id", requireAuth, requirePrivileged, async (req, res) => {
    try {
      await storage.deleteIncidentMilestone(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
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
      const user = (req.session as any).user;
      const incident = await storage.getIncident(req.params.id);
      if (!incident) return res.status(404).json({ error: "Incident not found" });

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

      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading incident document:", error);
      res.status(500).json({ error: "Failed to upload document" });
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
        for (const doc of allDocs) {
          if (!canAccess(doc.siteId)) continue;
          if (companySiteIds && (!doc.siteId || !companySiteIds.includes(doc.siteId))) continue;
          if (moduleFilter && doc.module !== moduleFilter) continue;

          const moduleUrl: Record<string, string> = {
            health_safety: "/health-safety/documents",
            human_resources: "/human-resources/documents",
            employment_law: "/employment-law/documents",
            training: "/training",
          };

          if (doc.reviewDate && inDateRange(new Date(doc.reviewDate))) {
            events.push({ id: `doc-review-${doc.id}`, title: `Review: ${doc.title}`, date: doc.reviewDate, type: "review_due", module: doc.module, siteId: doc.siteId, url: moduleUrl[doc.module] || "/documents", isOverdue: new Date(doc.reviewDate) < now });
          }
          if (doc.expiryDate && inDateRange(new Date(doc.expiryDate))) {
            events.push({ id: `doc-expiry-${doc.id}`, title: `Expiry: ${doc.title}`, date: doc.expiryDate, type: "expiry", module: doc.module, siteId: doc.siteId, url: moduleUrl[doc.module] || "/documents", isOverdue: new Date(doc.expiryDate) < now });
          }
          if (doc.renewalDate && inDateRange(new Date(doc.renewalDate))) {
            events.push({ id: `doc-renewal-${doc.id}`, title: `Renewal: ${doc.title}`, date: doc.renewalDate, type: "renewal_due", module: doc.module, siteId: doc.siteId, url: moduleUrl[doc.module] || "/documents", isOverdue: new Date(doc.renewalDate) < now });
          }
        }
      }

      // ── Case deadlines ─────────────────────────────────────────────────────
      if (!moduleFilter || moduleFilter === "employment_law") {
        const allCases = await storage.getCases({ includeArchived: false });
        for (const c of allCases) {
          if (!canAccess(c.siteId)) continue;
          if (companySiteIds && (!c.siteId || !companySiteIds.includes(c.siteId))) continue;
          if (c.responseDeadline && inDateRange(new Date(c.responseDeadline))) {
            events.push({ id: `case-deadline-${c.id}`, title: `Deadline: ${c.caseReference} – ${c.employeeName}`, date: c.responseDeadline, type: "case_deadline", module: "employment_law", siteId: c.siteId, url: `/employment-law/cases/${c.id}`, isOverdue: new Date(c.responseDeadline) < now });
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

      const folders = await storage.getClientUploadFolders({
        module,
        siteId,
        userId: user.id,
        userRole: user.role,
        userCompanyId: user.companyId,
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
        return res.status(403).json({ error: "Clients cannot delete folders" });
      }
      const canAccess = await canUserAccessFolder(user, folder);
      if (!canAccess) return res.status(403).json({ error: "Access denied" });

      const files = await storage.getClientUploads(folder.id);
      const objectStorageService = new ObjectStorageService();
      for (const file of files) {
        try {
          await objectStorageService.deleteObjectEntityFile(file.fileUrl);
        } catch {}
      }

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

  return httpServer;
}
