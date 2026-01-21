import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcrypt";
import type { ModuleType } from "@shared/schema";
import { SECURITY_CONFIG } from "@shared/schema";
import PDFDocument from "pdfkit";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

const BCRYPT_SALT_ROUNDS = 12;

const createDocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  module: z.enum(["health_safety", "human_resources", "employment_law", "support"]),
  type: z.string().min(1),
  documentTypeId: z.string().optional(),
  siteId: z.string().min(1),
  caseId: z.string().optional(),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
  reviewDate: z.string().optional(),
  expiryDate: z.string().optional(),
  source: z.enum(["template", "upload", "external"]).optional(),
  templateId: z.string().optional(),
  templateVersion: z.number().optional(),
});

const createCaseSchema = z.object({
  siteId: z.string().min(1),
  caseReference: z.string().min(1),
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
  code: z.string().min(1).regex(/^[a-z0-9_]+$/, "Code must be lowercase with underscores only"),
  module: z.enum(["health_safety", "human_resources", "employment_law", "support"]),
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

      const { username, password } = parseResult.data;
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.get("User-Agent") || "unknown";

      // Check if account is locked due to too many failed attempts
      const isLocked = await storage.isAccountLocked(username);
      if (isLocked) {
        await storage.recordLoginAttempt({
          username,
          ipAddress,
          userAgent,
          success: false,
          failureReason: "account_locked",
        });
        
        // Create audit log for locked account attempt
        const user = await storage.getUserByUsername(username);
        if (user) {
          await storage.createAuditLog({
            action: "account_locked",
            userId: user.id,
            userName: user.fullName,
            details: `Login attempt while account locked from IP ${ipAddress}`,
          });
        }
        
        return res.status(423).json({ 
          error: `Account temporarily locked. Please try again in ${SECURITY_CONFIG.lockoutDurationMinutes} minutes.` 
        });
      }

      const user = await storage.getUserByUsername(username);

      // Check if user exists
      if (!user) {
        await storage.recordLoginAttempt({
          username,
          ipAddress,
          userAgent,
          success: false,
          failureReason: "user_not_found",
        });
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
          username,
          ipAddress,
          userAgent,
          success: false,
          failureReason: "invalid_password",
        });
        
        // Check if this failure triggers a lockout
        const nowLocked = await storage.isAccountLocked(username);
        if (nowLocked) {
          await storage.createAuditLog({
            action: "account_locked",
            userId: user.id,
            userName: user.fullName,
            details: `Account locked after ${SECURITY_CONFIG.maxLoginAttempts} failed attempts from IP ${ipAddress}`,
          });
        }
        
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Successful login - record attempt
      await storage.recordLoginAttempt({
        username,
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

      // Set user in session
      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
      };

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const user = (req.session as any)?.user;
    const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
    
    // Create audit log for logout before destroying session
    if (user) {
      await storage.createAuditLog({
        action: "logout",
        userId: user.id,
        userName: user.fullName,
        details: `User logged out from IP ${ipAddress}`,
      });
    }
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("guardian.sid"); // Match our custom session name
      res.json({ message: "Logged out successfully" });
    });
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

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
    });
  });

  // Authentication middleware for protected routes
  const requireAuth = (req: any, res: any, next: any) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };

  // Helper to check if a client user can access a site (based on companyId)
  const canUserAccessSite = async (user: { id?: string; role: string; companyId: string | null }, siteId: string): Promise<boolean> => {
    // Admins have unrestricted access to all sites
    if (user.role === "admin") return true;
    
    // Consultants can only access sites they are assigned to
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
      
      // Check if client has specific site assignments
      const hasAssignments = await storage.hasClientSiteAssignments(user.id);
      if (hasAssignments) {
        // Client has site assignments - check if this site is assigned
        const clientSites = await storage.getClientSites(user.id);
        return clientSites.some(a => a.siteId === siteId);
      }
      
      // No site assignments - allow access to all sites in company (backward compatible)
      return true;
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

  // Module-specific dashboard
  app.get("/api/dashboard/:module", async (req, res) => {
    try {
      const module = req.params.module as ModuleType;
      const siteId = req.query.siteId as string | undefined;
      if (module !== "health_safety" && module !== "human_resources") {
        return res.status(400).json({ error: "Invalid module" });
      }
      const summary = await storage.getComplianceSummary(undefined, undefined, module);
      const documents = await storage.getDocuments(module);
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
      console.error("Module dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch module dashboard data" });
    }
  });

  // Main Dashboard (overview of all modules)
  app.get("/api/dashboard", async (req, res) => {
    try {
      const module = req.query.module as ModuleType | undefined;
      const summary = await storage.getComplianceSummary(undefined, undefined, module);
      const documents = await storage.getDocuments(module);
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
      
      // Authorization: client users can only see their own company's data
      if (user.role === "client") {
        // Client users can only access their own company's data
        if (!user.companyId) {
          return res.json([]);
        }
        // Ignore any requested companyId/siteId - use the user's company only
        const companySites = await storage.getSitesByCompanyId(user.companyId);
        if (companySites.length === 0) {
          res.json([]);
          return;
        }
        const siteIds = companySites.map(s => s.id);
        const summaries = await storage.getModuleSummariesForSites(siteIds);
        res.json(summaries);
        return;
      }
      
      // Admin can see everything without restrictions
      if (user.role === "admin") {
        if (requestedCompanyId) {
          const companySites = await storage.getSitesByCompanyId(requestedCompanyId);
          if (companySites.length === 0) {
            res.json([]);
            return;
          }
          const siteIds = companySites.map(s => s.id);
          const summaries = await storage.getModuleSummariesForSites(siteIds);
          res.json(summaries);
          return;
        }
        
        if (requestedSiteIds) {
          const siteIds = requestedSiteIds.split(",");
          const summaries = await storage.getModuleSummariesForSites(siteIds);
          res.json(summaries);
          return;
        }
        
        const summaries = await storage.getModuleSummaries(undefined, siteId);
        res.json(summaries);
        return;
      }
      
      // Consultants need authorization for any sites they access
      if (user.role === "consultant") {
        if (requestedCompanyId) {
          // Consultants can only access companies they have site assignments for
          const companySites = await storage.getSitesByCompanyId(requestedCompanyId);
          // Filter to only sites the consultant has access to
          const accessibleSites = await Promise.all(
            companySites.map(async (site) => {
              const canAccess = await canUserAccessSite(user, site.id);
              return canAccess ? site : null;
            })
          );
          const filteredSites = accessibleSites.filter((s): s is NonNullable<typeof s> => s !== null);
          if (filteredSites.length === 0) {
            res.json([]);
            return;
          }
          const siteIds = filteredSites.map(s => s.id);
          const summaries = await storage.getModuleSummariesForSites(siteIds);
          res.json(summaries);
          return;
        }
        
        if (requestedSiteIds) {
          const siteIds = requestedSiteIds.split(",");
          // Validate access to each site
          const accessibleSiteIds = await Promise.all(
            siteIds.map(async (id) => {
              const canAccess = await canUserAccessSite(user, id);
              return canAccess ? id : null;
            })
          );
          const filteredSiteIds = accessibleSiteIds.filter((id): id is string => id !== null);
          if (filteredSiteIds.length === 0) {
            res.json([]);
            return;
          }
          const summaries = await storage.getModuleSummariesForSites(filteredSiteIds);
          res.json(summaries);
          return;
        }
        
        if (siteId) {
          const canAccess = await canUserAccessSite(user, siteId);
          if (!canAccess) {
            return res.status(403).json({ error: "Access denied to this site" });
          }
          const summaries = await storage.getModuleSummaries(undefined, siteId);
          res.json(summaries);
          return;
        }
        
        // Consultant without filters - show all their assigned sites
        const assignments = await storage.getConsultantSites(user.id);
        if (assignments.length === 0) {
          res.json([]);
          return;
        }
        const assignedSiteIds = assignments.map(a => a.siteId);
        const summaries = await storage.getModuleSummariesForSites(assignedSiteIds);
        res.json(summaries);
        return;
      }
      
      // Fallback (shouldn't reach here)
      const summaries = await storage.getModuleSummaries(undefined, siteId);
      res.json(summaries);
    } catch (error) {
      console.error("Module summaries error:", error);
      res.status(500).json({ error: "Failed to fetch module summaries" });
    }
  });

  // Documents by module
  app.get("/api/documents/module/:module", async (req, res) => {
    try {
      const module = req.params.module as ModuleType;
      if (module !== "health_safety" && module !== "human_resources") {
        return res.status(400).json({ error: "Invalid module" });
      }
      const documents = await storage.getDocuments(module);
      res.json(documents);
    } catch (error) {
      console.error("Module documents error:", error);
      res.status(500).json({ error: "Failed to fetch module documents" });
    }
  });

  // Documents
  app.get("/api/documents", async (req, res) => {
    try {
      const module = req.query.module as ModuleType | undefined;
      const documents = await storage.getDocuments(module);
      res.json(documents);
    } catch (error) {
      console.error("Documents error:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Log document view (only if authenticated user)
      const user = (req as any).session?.user;
      if (user) {
        await storage.createAuditLog({
          action: "document_viewed",
          userId: user.id,
          userName: user.fullName,
          siteId: document.siteId,
          documentId: document.id,
          supportRequestId: null,
          module: document.module,
          details: `Viewed ${document.title}`,
          metadata: null,
        });
      }
      
      res.json(document);
    } catch (error) {
      console.error("Document error:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  app.get("/api/documents/:id/versions", async (req, res) => {
    try {
      const versions = await storage.getDocumentVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error("Document versions error:", error);
      res.status(500).json({ error: "Failed to fetch document versions" });
    }
  });

  app.get("/api/documents/:id/audit", async (req, res) => {
    try {
      const logs = await storage.getAuditLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Audit logs error:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Document download endpoint - generates PDF
  app.get("/api/documents/:id/download", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Log document download
      const user = (req as any).session?.user;
      if (user) {
        await storage.createAuditLog({
          action: "document_downloaded",
          userId: user.id,
          userName: user.fullName,
          siteId: document.siteId,
          documentId: document.id,
          supportRequestId: null,
          module: document.module,
          details: `Downloaded ${document.title}${req.query.version ? ` (Version ${req.query.version})` : ''}`,
          metadata: null,
        });
      }

      // Check if a specific version is requested
      const requestedVersion = req.query.version ? parseInt(req.query.version as string) : null;
      let versionInfo = null;
      let displayVersion = document.version;
      let displayFileName = document.fileName;
      let displayFileSize = document.fileSize;
      let versionDate = document.updatedAt;
      let changeNote = null;

      if (requestedVersion && requestedVersion !== document.version) {
        // Get the specific version from history
        const versions = await storage.getDocumentVersions(req.params.id);
        versionInfo = versions.find(v => v.version === requestedVersion);
        if (!versionInfo) {
          return res.status(404).json({ error: "Version not found" });
        }
        displayVersion = versionInfo.version;
        displayFileName = versionInfo.fileName;
        displayFileSize = versionInfo.fileSize;
        versionDate = versionInfo.createdAt;
        changeNote = versionInfo.changeNote;
      }

      // Get entity name for the PDF
      const entity = await storage.getSite(document.siteId);
      const entityName = entity?.name || 'Unknown Entity';

      // Generate PDF document
      const doc = new PDFDocument({ margin: 50 });

      // Set response headers for PDF download
      const fileName = displayFileName.replace(/\.[^/.]+$/, '') + '.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      // Pipe the PDF to the response
      doc.pipe(res);

      // Header with Guardian branding
      doc.fontSize(24).fillColor('#1a365d').text('Guardian Group', { align: 'center' });
      doc.fontSize(12).fillColor('#666').text('Health & Safety | Human Resources', { align: 'center' });
      doc.moveDown(2);

      // Document title with version
      doc.fontSize(20).fillColor('#000').text(document.title, { align: 'center' });
      doc.fontSize(12).fillColor('#666').text(`Version ${displayVersion}`, { align: 'center' });
      if (requestedVersion && requestedVersion !== document.version) {
        doc.fontSize(10).fillColor('#999').text('(Historical Version)', { align: 'center' });
      }
      doc.moveDown();

      // Horizontal line
      doc.strokeColor('#e2e8f0').lineWidth(1)
         .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // Document details section
      doc.fontSize(14).fillColor('#1a365d').text('Document Information');
      doc.moveDown(0.5);

      const details = [
        ['Type', document.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())],
        ['Version', `${displayVersion}${displayVersion === document.version ? ' (Current)' : ' (Historical)'}`],
        ['File Name', displayFileName],
        ['File Size', `${Math.round(displayFileSize / 1024)} KB`],
        ['Entity', entityName],
        ['Module', document.module === 'health_safety' ? 'Health & Safety' : 'Human Resources'],
      ];

      // Only show status for current version
      if (displayVersion === document.version) {
        details.push(['Status', document.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())]);
        details.push(['Approval Status', document.approvalStatus.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())]);
      }

      doc.fontSize(11);
      details.forEach(([label, value]) => {
        doc.fillColor('#666').text(`${label}: `, { continued: true });
        doc.fillColor('#000').text(value);
      });

      doc.moveDown();

      // Change note for historical versions
      if (changeNote) {
        doc.fontSize(14).fillColor('#1a365d').text('Version Notes');
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#000').text(changeNote);
        doc.moveDown();
      }

      // Description
      if (document.description) {
        doc.fontSize(14).fillColor('#1a365d').text('Description');
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#000').text(document.description);
        doc.moveDown();
      }

      // Dates section
      doc.fontSize(14).fillColor('#1a365d').text('Version Date');
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.fillColor('#666').text('Created: ', { continued: true });
      doc.fillColor('#000').text(versionDate ? new Date(versionDate).toLocaleDateString('en-GB') : 'N/A');

      if (displayVersion === document.version) {
        if (document.reviewDate) {
          doc.fillColor('#666').text('Review Date: ', { continued: true });
          doc.fillColor('#000').text(new Date(document.reviewDate).toLocaleDateString('en-GB'));
        }
        if (document.expiryDate) {
          doc.fillColor('#666').text('Expiry Date: ', { continued: true });
          doc.fillColor('#000').text(new Date(document.expiryDate).toLocaleDateString('en-GB'));
        }
      }

      // Footer
      doc.moveDown(3);
      doc.fontSize(9).fillColor('#999')
         .text('This document is generated by Guardian Group H&S Portal.', { align: 'center' })
         .text(`Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`, { align: 'center' });

      // Finalize PDF
      doc.end();
    } catch (error) {
      console.error("Document download error:", error);
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  app.post("/api/documents", async (req, res) => {
    try {
      const parseResult = createDocumentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
      }
      
      const body = parseResult.data;
      
      const document = await storage.createDocument({
        title: body.title,
        description: body.description || null,
        module: body.module,
        type: body.type as any,
        documentTypeId: body.documentTypeId || null,
        siteId: body.siteId,
        caseId: body.caseId || null,
        fileName: body.fileName,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
        version: 1,
        status: "review_required",
        approvalStatus: "pending",
        reviewDate: body.reviewDate ? new Date(body.reviewDate) : null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        source: body.source || "external",
        templateId: body.templateId || null,
        templateVersion: body.templateVersion ?? null,
      });

      await storage.createAuditLog({
        action: "document_uploaded",
        userId: "user-1",
        userName: "John Doe",
        siteId: body.siteId,
        documentId: document.id,
        supportRequestId: null,
        module: body.module,
        details: `Uploaded ${body.title}`,
        metadata: null,
      });

      res.status(201).json(document);
    } catch (error) {
      console.error("Create document error:", error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  app.post("/api/documents/:id/approval", async (req, res) => {
    try {
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

      let approvalStatus: "approved" | "rejected" | "changes_requested";
      let documentStatus: "compliant" | "review_required" | "overdue";
      let auditAction: "document_approved" | "document_rejected" | "changes_requested";

      switch (action) {
        case "approve":
          approvalStatus = "approved";
          documentStatus = "compliant";
          auditAction = "document_approved";
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

      const document = await storage.updateDocument(documentId, {
        approvalStatus,
        status: documentStatus,
      });

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      await storage.createAuditLog({
        action: auditAction,
        userId: "user-1",
        userName: "John Doe",
        siteId: document.siteId,
        documentId: document.id,
        supportRequestId: null,
        module: existingDoc.module,
        details: feedback || `Document ${action}ed`,
        metadata: null,
      });

      res.json(document);
    } catch (error) {
      console.error("Document approval error:", error);
      res.status(500).json({ error: "Failed to update document approval" });
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
      
      // Check if folders already exist for this site/module
      const existingFolders = await storage.getDocumentFolders(siteId, module);
      if (existingFolders.length > 0) {
        return res.json({ folders: existingFolders, provisioned: false });
      }
      
      // Provision new folders from templates
      const folders = await storage.provisionFoldersFromTemplates(siteId, module, user.id);
      res.status(201).json({ folders, provisioned: true });
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
        code: z.string().min(1).regex(/^[a-z0-9_]+$/, "Code must be lowercase with underscores only"),
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
      
      // Convert null parentId to undefined for storage
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
        folderTemplateId: z.string().min(1),
        documentTypeId: z.string().optional(), // Legacy - kept for backward compatibility
        fileName: z.string().min(1),
        fileUrl: z.string().min(1), // Path to the uploaded file in object storage
        fileSize: z.number().min(1),
        mimeType: z.string().min(1),
        placeholders: z.string().optional(), // JSON array of placeholder names
        sortOrder: z.number().optional(),
        isRequired: z.boolean().optional(), // Compliance: is this template required?
        renewalPeriodMonths: z.number().nullable().optional(), // Compliance: how often to renew
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      // Verify folder template exists and module matches
      const folderTemplate = await storage.getFolderTemplate(parsed.data.folderTemplateId);
      if (!folderTemplate) {
        return res.status(404).json({ error: "Folder template not found" });
      }
      if (folderTemplate.module !== parsed.data.module) {
        return res.status(400).json({ error: "Template module must match folder template module" });
      }
      
      const template = await storage.createDocumentTemplate({
        ...parsed.data,
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
  
  // Update document template (admin only)
  app.patch("/api/document-templates/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update document templates" });
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
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const updated = await storage.updateDocumentTemplate(req.params.id, parsed.data);
      
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
  
  // Delete document template (admin only)
  app.delete("/api/document-templates/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can delete document templates" });
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
      const success = await storage.deleteDocumentTemplate(req.params.id, user.id, reason.trim());
      
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
      
      const allCompanies = await storage.getCompaniesWithSiteCount();
      
      let filteredCompanies = allCompanies;
      
      // Role-based filtering
      if (user.role === "consultant") {
        const assignments = await storage.getConsultantSites(user.id);
        const siteCompanyIds = new Set<string>();
        for (const a of assignments) {
          const site = await storage.getSite(a.siteId);
          if (site) siteCompanyIds.add(site.companyId);
        }
        filteredCompanies = allCompanies.filter(c => siteCompanyIds.has(c.id));
      } else if (user.role === "client" && user.companyId) {
        filteredCompanies = allCompanies.filter(c => c.id === user.companyId);
      } else if (user.role !== "admin") {
        filteredCompanies = [];
      }
      
      // Apply search filter
      if (search) {
        filteredCompanies = filteredCompanies.filter(c => 
          c.name.toLowerCase().includes(search) ||
          c.companyNumber?.toLowerCase().includes(search)
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
        const assignments = await storage.getConsultantSites(user.id);
        const siteCompanyIds = new Set<string>();
        for (const a of assignments) {
          const site = await storage.getSite(a.siteId);
          if (site) siteCompanyIds.add(site.companyId);
        }
        if (!siteCompanyIds.has(company.id)) {
          return res.status(403).json({ error: "Access denied" });
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create companies" });
      }
      
      const { name, companyNumber, address, contactEmail, contactPhone } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Company name is required" });
      }
      
      const company = await storage.createCompany({
        name: name.trim(),
        companyNumber: companyNumber || null,
        address: address || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
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
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update companies" });
      }
      
      const { name, companyNumber, address, contactEmail, contactPhone, status } = req.body;
      
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (companyNumber !== undefined) updates.companyNumber = companyNumber || null;
      if (address !== undefined) updates.address = address || null;
      if (contactEmail !== undefined) updates.contactEmail = contactEmail || null;
      if (contactPhone !== undefined) updates.contactPhone = contactPhone || null;
      if (status !== undefined) updates.status = status;
      
      const company = await storage.updateCompany(req.params.id, updates);
      
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ error: "Failed to update company" });
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
      
      // Consultant sees only assigned sites
      if (user.role === "consultant") {
        const assignments = await storage.getConsultantSites(user.id);
        const assignedSiteIds = new Set(assignments.map(a => a.siteId));
        const filteredSites = allSites.filter(site => assignedSiteIds.has(site.id));
        res.json(filteredSites);
        return;
      }
      
      // Client sees only sites in their company
      if (user.role === "client" && user.companyId) {
        const filteredSites = allSites.filter(site => site.companyId === user.companyId);
        res.json(filteredSites);
        return;
      }
      
      // Fallback: return empty if no match
      res.json([]);
    } catch (error) {
      console.error("Entities error:", error);
      res.status(500).json({ error: "Failed to fetch entities" });
    }
  });

  // Create entity
  app.post("/api/sites", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin can create entities
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create entities" });
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
      
      // Only admin can update entities
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update entities" });
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
        // Consultants see requests from their assigned sites
        const assignments = await storage.getConsultantSites(user.id);
        const assignedSiteIds = assignments.map((a: { siteId: string }) => a.siteId);
        requests = requests.filter(r => assignedSiteIds.includes(r.siteId));
        if (siteId) {
          requests = requests.filter(r => r.siteId === siteId);
        }
      } else {
        // Clients see only their own requests from their accessible sites
        const clientSiteAssignments = await storage.getClientSiteAssignments(user.id);
        if (clientSiteAssignments.length > 0) {
          // Client has specific site assignments
          const assignedSiteIds = clientSiteAssignments.map(a => a.siteId);
          requests = requests.filter(r => r.createdBy === user.id && assignedSiteIds.includes(r.siteId));
        } else if (user.companyId) {
          // Client can access all sites in their company
          const companySites = await storage.getSites();
          const siteIds = companySites.filter(s => s.companyId === user.companyId).map(s => s.id);
          requests = requests.filter(r => r.createdBy === user.id && siteIds.includes(r.siteId));
        } else {
          requests = requests.filter(r => r.createdBy === user.id);
        }
      }
      
      // Enrich with user names
      const enrichedRequests = await Promise.all(requests.map(async (request) => {
        const createdByUser = await storage.getUser(request.createdBy);
        const respondedByUser = request.respondedBy ? await storage.getUser(request.respondedBy) : null;
        return {
          ...request,
          createdByName: createdByUser?.fullName || createdByUser?.username || "Unknown",
          respondedByName: respondedByUser?.fullName || respondedByUser?.username || null,
        };
      }));

      res.json(enrichedRequests);
    } catch (error) {
      console.error("Support requests error:", error);
      res.status(500).json({ error: "Failed to fetch support requests" });
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
        siteId: body.siteId,
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
        siteId: existingRequest.siteId,
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
      const documentType = await storage.createDocumentType({
        name: body.name,
        code: body.code,
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
      if (module !== "health_safety" && module !== "human_resources" && module !== "employment_law" && module !== "support") {
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
      const status = req.query.status as any;

      // Clients can only see cases for their company's sites
      if (user.role === "client" && siteId) {
        const canAccess = await canUserAccessSite(user, siteId);
        if (!canAccess) {
          return res.status(403).json({ error: "Not authorized to view these cases" });
        }
      }

      // For clients, get all sites in their company; for others, filter by siteId if provided
      let filterSiteIds: string[] | undefined;
      if (user.role === "client" && user.companyId) {
        const companySites = await storage.getSitesByCompanyId(user.companyId);
        filterSiteIds = companySites.map(s => s.id);
      }
      const filterEntityId = siteId;
      const cases = await storage.getCases(filterEntityId, status);
      
      // Filter out confidential cases for non-privileged users
      const filteredCases = cases.filter(c => {
        if (!c.isConfidential) return true;
        if (user.role === "admin") return true;
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

      // Check confidentiality
      if (caseData.isConfidential) {
        const canAccess = user.role === "admin" || 
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
        siteId: caseData.siteId,
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

      const updatedCase = await storage.updateCase(req.params.id, updates);

      // Create audit log for status changes
      if (parseResult.data.status && parseResult.data.status !== existingCase.status) {
        await storage.createAuditLog({
          action: "case_status_changed",
          userId: user.id,
          userName: user.fullName,
          siteId: existingCase.siteId,
          caseId: existingCase.id,
          module: "employment_law",
          details: `Case status changed from ${existingCase.status} to ${parseResult.data.status}`,
        });
      }

      res.json(updatedCase);
    } catch (error) {
      console.error("Update case error:", error);
      res.status(500).json({ error: "Failed to update case" });
    }
  });

  // Helper function to check case confidentiality access
  const canAccessConfidentialCase = (caseData: any, user: any): boolean => {
    if (!caseData.isConfidential) return true;
    if (user.role === "admin") return true;
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
        siteId: caseData.siteId,
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
          siteId: caseData?.siteId,
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
      const validModules = ["health_safety", "human_resources", "employment_law", "support", "reports"];
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

  // Get documents hierarchy for a site module (folder-based view with compliance stats)
  app.get("/api/sites/:siteId/modules/:module/documents-hierarchy", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const { siteId, module } = req.params;
      
      // Authorization: check site access
      const canAccess = await canUserAccessSite(user, siteId);
      if (!canAccess) {
        return res.status(403).json({ error: "Not authorized to view this site's documents" });
      }
      
      // Validate module type (using ModuleType values from schema)
      const validModules = ["health_safety", "human_resources", "employment_law", "support"];
      if (!validModules.includes(module)) {
        return res.status(400).json({ error: "Invalid module type" });
      }
      
      // Get folder templates for this module (the "master" folder structure)
      const folderTemplates = await storage.getFolderTemplates(module as any);
      
      // Get document templates for this module (to check required templates)
      const allDocTemplates = await storage.getDocumentTemplates();
      const moduleDocTemplates = allDocTemplates.filter(dt => dt.module === module && dt.isActive);
      
      // Get actual document folders provisioned for this site
      const siteFolders = await storage.getDocumentFolders(siteId, module as any);
      
      // Get all documents for this site in this module
      const allDocuments = await storage.getDocuments(module as any);
      const siteDocuments = allDocuments.filter(d => d.siteId === siteId && !d.isArchived);
      
      // Build the hierarchy: for each folder template, find matching site folder and its documents
      const hierarchy = folderTemplates
        .filter(ft => !ft.parentId) // Only top-level folders
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(folderTemplate => {
          // Find the provisioned folder for this template
          const siteFolder = siteFolders.find(sf => sf.templateId === folderTemplate.id);
          
          // Get document templates in this folder template
          const folderDocTemplates = moduleDocTemplates.filter(dt => dt.folderTemplateId === folderTemplate.id);
          const requiredTemplates = folderDocTemplates.filter(dt => dt.isRequired);
          
          // Get documents in this folder (if folder exists)
          const folderDocuments = siteFolder 
            ? siteDocuments.filter(d => d.folderId === siteFolder.id)
            : [];
          
          // Calculate compliance stats
          const compliantCount = folderDocuments.filter(d => d.status === "compliant").length;
          const reviewRequiredCount = folderDocuments.filter(d => d.status === "review_required").length;
          const overdueCount = folderDocuments.filter(d => d.status === "overdue").length;
          const pendingApprovalCount = folderDocuments.filter(d => d.approvalStatus === "pending").length;
          
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
          
          // Get child folders (sub-folders) if any
          const childFolderTemplates = folderTemplates.filter(ft => ft.parentId === folderTemplate.id);
          const childFolders = childFolderTemplates.map(childTemplate => {
            const childSiteFolder = siteFolders.find(sf => sf.templateId === childTemplate.id);
            const childFolderDocs = childSiteFolder
              ? siteDocuments.filter(d => d.folderId === childSiteFolder.id)
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
              siteFolder: childSiteFolder ? {
                id: childSiteFolder.id,
                name: childSiteFolder.name,
              } : null,
              documents: childFolderDocs.map(d => ({
                id: d.id,
                title: d.title,
                fileName: d.fileName,
                status: d.status,
                approvalStatus: d.approvalStatus,
                source: d.source,
                templateId: d.templateId,
                expiryDate: d.expiryDate,
                updatedAt: d.updatedAt,
              })),
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
            documents: folderDocuments.map(d => ({
              id: d.id,
              title: d.title,
              fileName: d.fileName,
              status: d.status,
              approvalStatus: d.approvalStatus,
              source: d.source,
              templateId: d.templateId,
              expiryDate: d.expiryDate,
              updatedAt: d.updatedAt,
            })),
            childFolders,
            stats: {
              totalDocuments: folderDocuments.length,
              compliant: compliantCount,
              reviewRequired: reviewRequiredCount,
              overdue: overdueCount,
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
        unfiledDocuments: unfiledDocuments.map(d => ({
          id: d.id,
          title: d.title,
          fileName: d.fileName,
          status: d.status,
          approvalStatus: d.approvalStatus,
          source: d.source,
          templateId: d.templateId,
          expiryDate: d.expiryDate,
          updatedAt: d.updatedAt,
        })),
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

  // Module Access Request Routes
  
  // Get all access requests (admin/consultant) or entity-specific (client)
  app.get("/api/module-access-requests", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      let siteId: string | undefined;
      const status = req.query.status as string | undefined;
      
      // Clients can only see their own company's sites' requests
      if (user.role === "client" && user.companyId) {
        // Get all sites in their company
        const companySites = await storage.getSitesByCompanyId(user.companyId);
        // If no specific siteId provided, we'll filter by company sites later
        if (!req.query.siteId) {
          siteId = undefined; // Will need to filter by company sites
        }
      }
      if (req.query.siteId) {
        siteId = req.query.siteId as string;
      }
      
      const requests = await storage.getModuleAccessRequests(siteId, status as any);
      res.json(requests);
    } catch (error) {
      console.error("Get module access requests error:", error);
      res.status(500).json({ error: "Failed to fetch access requests" });
    }
  });

  // Create module access request
  app.post("/api/module-access-requests", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const { siteId, module, reason } = req.body;
      
      // Validate module
      const validModules = ["health_safety", "human_resources", "employment_law", "support"];
      if (!module || !validModules.includes(module)) {
        return res.status(400).json({ error: `Invalid module. Must be one of: ${validModules.join(", ")}` });
      }
      
      // Validate entity and module access status
      const entity = await storage.getSite(siteId);
      if (!entity) {
        return res.status(404).json({ error: "Entity not found" });
      }
      
      // Check if module is visible (requestable)
      const moduleAccess = await storage.getSiteModuleAccessByModule(siteId, module);
      if (moduleAccess && moduleAccess.status === "active") {
        return res.status(400).json({ error: "Module is already active for this entity" });
      }
      if (moduleAccess && moduleAccess.status === "hidden") {
        return res.status(400).json({ error: "Module is not available for request" });
      }
      
      // Check for existing pending request
      const existingRequests = await storage.getModuleAccessRequests(siteId, "pending");
      const duplicateRequest = existingRequests.find(r => r.module === module);
      if (duplicateRequest) {
        return res.status(400).json({ error: "A pending request for this module already exists" });
      }
      
      const request = await storage.createModuleAccessRequest({
        siteId,
        siteName: entity.name,
        module,
        requestedBy: user.id,
        requestedByName: user.fullName,
        reason,
      });
      
      res.status(201).json(request);
    } catch (error) {
      console.error("Create module access request error:", error);
      res.status(500).json({ error: "Failed to create access request" });
    }
  });

  // Review module access request (admin/consultant only)
  app.patch("/api/module-access-requests/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin and consultants can review requests
      if (user.role !== "admin" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only admins and consultants can review access requests" });
      }
      
      const { status, notes } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
      }
      
      const updatedRequest = await storage.reviewModuleAccessRequest(
        req.params.id,
        user.id,
        user.fullName,
        status,
        notes
      );
      
      if (!updatedRequest) {
        return res.status(404).json({ error: "Access request not found" });
      }
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Review module access request error:", error);
      res.status(500).json({ error: "Failed to review access request" });
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
      
      // Only admin can see all users
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const allUsers = await storage.getAllUsers();
      const safeUsers = allUsers.map(({ password, ...u }) => u);
      res.json(safeUsers);
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Entity Users Routes
  
  // Create user for an entity
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
      
      const { username, email, fullName, password, clientPermissionRole } = req.body;
      
      if (!username || !email || !fullName || !password) {
        return res.status(400).json({ error: "Username, email, full name, and password are required" });
      }
      
      // Check if username or email already exists
      const existingUsers = await storage.getAllUsers();
      if (existingUsers.some(u => u.username === username)) {
        return res.status(400).json({ error: "Username already exists" });
      }
      if (existingUsers.some(u => u.email === email)) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      // Get the site to find its companyId
      const targetSite = await storage.getSite(req.params.siteId);
      if (!targetSite) {
        return res.status(404).json({ error: "Site not found" });
      }
      
      const newUser = await storage.createUser({
        username,
        email,
        fullName,
        password,
        role: "client",
        companyId: targetSite.companyId, // Users get company-level access
        status: "active",
        clientPermissionRole: clientPermissionRole || "viewer",
      });
      
      const { password: _, ...safeUser } = newUser;
      res.status(201).json(safeUser);
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
      
      // Only admin can assign consultants
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can assign consultants" });
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
      
      // Only admin can remove consultant assignments
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can remove consultant assignments" });
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
      
      // Only admin can update consultant assignments
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update consultant assignments" });
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
      
      // Enhance with client details
      const enhancedAssignments = await Promise.all(
        assignments.map(async (a) => {
          const client = await storage.getUser(a.clientId);
          return {
            ...a,
            clientName: client?.fullName || "Unknown",
            clientEmail: client?.email || "",
          };
        })
      );
      
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
        // Consultants can only update users in their assigned companies
        if (currentUser.role === "consultant" && targetUser.companyId) {
          // Get all sites in the user's company and check if consultant is assigned to any
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
          return res.status(403).json({ error: "Only admins can update users" });
        }
      }
      
      const { status, clientPermissionRole } = req.body;
      
      const updated = await storage.updateUser(req.params.id, {
        status,
        clientPermissionRole,
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

  return httpServer;
}
