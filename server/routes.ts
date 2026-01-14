import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import type { ModuleType } from "@shared/schema";
import PDFDocument from "pdfkit";

const createDocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  module: z.enum(["health_safety", "human_resources", "employment_law"]),
  type: z.string().min(1),
  entityId: z.string().min(1),
  siteId: z.string().optional(),
  caseId: z.string().optional(),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
  reviewDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

const createCaseSchema = z.object({
  entityId: z.string().min(1),
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
  module: z.enum(["health_safety", "human_resources", "employment_law"]).optional(),
});

const approvalSchema = z.object({
  action: z.enum(["approve", "reject", "changes"]),
  feedback: z.string().optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid credentials format" });
      }

      const { username, password } = parseResult.data;
      const user = await storage.getUserByUsername(username);

      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Set user in session
      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        entityId: user.entityId,
      };

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        entityId: user.entityId,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
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
      entityId: user.entityId,
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

  // Apply auth middleware to all routes below this point
  app.use("/api/dashboard", requireAuth);
  app.use("/api/documents", requireAuth);
  app.use("/api/entities", requireAuth);
  app.use("/api/sites", requireAuth);
  app.use("/api/support", requireAuth);
  app.use("/api/audit", requireAuth);
  app.use("/api/modules", requireAuth);

  // Module-specific dashboard
  app.get("/api/dashboard/:module", async (req, res) => {
    try {
      const module = req.params.module as ModuleType;
      if (module !== "health_safety" && module !== "human_resources") {
        return res.status(400).json({ error: "Invalid module" });
      }
      const summary = await storage.getComplianceSummary(module);
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
      const summary = await storage.getComplianceSummary(module);
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
  app.get("/api/modules/summary", async (req, res) => {
    try {
      const summaries = await storage.getModuleSummaries();
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
          entityId: document.entityId,
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
          entityId: document.entityId,
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
      const entity = await storage.getEntity(document.entityId);
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
        entityId: body.entityId,
        siteId: body.siteId || null,
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
      });

      await storage.createAuditLog({
        action: "document_uploaded",
        userId: "user-1",
        userName: "John Doe",
        entityId: body.entityId,
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
        entityId: document.entityId,
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

  // Entities
  app.get("/api/entities", async (req, res) => {
    try {
      const entities = await storage.getEntities();
      res.json(entities);
    } catch (error) {
      console.error("Entities error:", error);
      res.status(500).json({ error: "Failed to fetch entities" });
    }
  });

  // Create entity
  app.post("/api/entities", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin can create entities
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create entities" });
      }
      
      const { name, companyNumber, address, contactEmail, contactPhone } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Entity name is required" });
      }
      
      const entity = await storage.createEntity({
        name: name.trim(),
        companyNumber: companyNumber || null,
        address: address || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
      });
      
      res.status(201).json(entity);
    } catch (error) {
      console.error("Create entity error:", error);
      res.status(500).json({ error: "Failed to create entity" });
    }
  });

  // Get single entity
  app.get("/api/entities/:entityId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Clients can only access their own entity
      if (user.role === "client" && user.entityId !== req.params.entityId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const entity = await storage.getEntity(req.params.entityId);
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
  app.get("/api/entities/:entityId/sites", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Clients can only access their own entity's sites
      if (user.role === "client" && user.entityId !== req.params.entityId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const sites = await storage.getSitesByEntity(req.params.entityId);
      res.json(sites);
    } catch (error) {
      console.error("Get entity sites error:", error);
      res.status(500).json({ error: "Failed to fetch entity sites" });
    }
  });

  // Sites
  app.get("/api/sites", async (req, res) => {
    try {
      const sites = await storage.getSites();
      res.json(sites);
    } catch (error) {
      console.error("Sites error:", error);
      res.status(500).json({ error: "Failed to fetch sites" });
    }
  });

  // Support Requests
  app.get("/api/support-requests", async (req, res) => {
    try {
      const module = req.query.module as ModuleType | undefined;
      const requests = await storage.getSupportRequests(module);
      res.json(requests);
    } catch (error) {
      console.error("Support requests error:", error);
      res.status(500).json({ error: "Failed to fetch support requests" });
    }
  });

  app.post("/api/support-requests", async (req, res) => {
    try {
      const parseResult = createSupportRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
      }
      
      const body = parseResult.data;
      
      const request = await storage.createSupportRequest({
        subject: body.subject,
        description: body.description,
        priority: body.priority,
        status: "open",
        category: body.category,
        module: body.module || null,
        entityId: "entity-1",
        createdBy: "user-1",
        assignedTo: null,
      });

      await storage.createAuditLog({
        action: "support_request_created",
        userId: "user-1",
        userName: "John Doe",
        entityId: "entity-1",
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

  // Reports
  app.get("/api/reports", async (req, res) => {
    try {
      const summary = await storage.getComplianceSummary();
      const moduleSummaries = await storage.getModuleSummaries();
      const entities = await storage.getEntities();
      
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
        entities: entities.map(e => ({ id: e.id, name: e.name })),
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
          entityId: "entity-1",
          entityName: "Acme Manufacturing Ltd",
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
          entityId: "entity-2",
          entityName: "TechCorp Solutions",
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
          entityId: "entity-1",
          entityName: "Acme Manufacturing Ltd",
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
  app.get("/api/document-types/:module/:entityId", requireAuth, async (req, res) => {
    try {
      const { module, entityId } = req.params;
      if (module !== "health_safety" && module !== "human_resources" && module !== "employment_law") {
        return res.status(400).json({ error: "Invalid module" });
      }
      
      // Authorization: clients can only view their own entity, consultants/admins can view any
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (user.role === "client" && user.entityId !== entityId) {
        return res.status(403).json({ error: "Not authorized to view this entity's access" });
      }
      
      const documentTypes = await storage.getDocumentTypesWithAccess(entityId, module as ModuleType);
      res.json(documentTypes);
    } catch (error) {
      console.error("Document types error:", error);
      res.status(500).json({ error: "Failed to fetch document types" });
    }
  });

  app.get("/api/entity-access/:entityId", requireAuth, async (req, res) => {
    try {
      const { entityId } = req.params;
      const module = req.query.module as ModuleType | undefined;
      
      // Authorization check
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (user.role === "client" && user.entityId !== entityId) {
        return res.status(403).json({ error: "Not authorized to view this entity's access" });
      }
      
      const access = await storage.getEntityDocumentTypeAccess(entityId, module);
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
      
      const { entityId, documentType, module, grantedBy } = req.body;
      if (!entityId || !documentType || !module) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const access = await storage.grantDocumentTypeAccess({
        entityId,
        documentType,
        module,
        grantedBy: grantedBy || user.id,
      });
      res.json(access);
    } catch (error) {
      console.error("Grant access error:", error);
      res.status(500).json({ error: "Failed to grant access" });
    }
  });

  app.delete("/api/entity-access/:entityId/:documentType", requireAuth, async (req, res) => {
    try {
      // Only admins can revoke access
      const user = await storage.getUser((req.session as any).userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can revoke document type access" });
      }
      
      const { entityId, documentType } = req.params;
      const success = await storage.revokeDocumentTypeAccess(entityId, documentType as any);
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

      const entityId = req.query.entityId as string | undefined;
      const status = req.query.status as any;

      // Clients can only see cases for their entity
      if (user.role === "client" && entityId && user.entityId !== entityId) {
        return res.status(403).json({ error: "Not authorized to view these cases" });
      }

      const filterEntityId = user.role === "client" ? user.entityId! : entityId;
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

      // Authorization check
      if (user.role === "client" && user.entityId !== caseData.entityId) {
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

      const caseData = await storage.createCase({
        ...parseResult.data,
        hearingDate: parseResult.data.hearingDate ? new Date(parseResult.data.hearingDate) : undefined,
        responseDeadline: parseResult.data.responseDeadline ? new Date(parseResult.data.responseDeadline) : undefined,
        createdBy: user.id,
        assignedConsultant: user.role === "consultant" ? user.id : undefined,
      });

      // Create audit log
      await storage.createAuditLog({
        action: "case_created",
        userId: user.id,
        userName: user.fullName,
        entityId: caseData.entityId,
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
          entityId: existingCase.entityId,
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

      // Authorization check
      if (user.role === "client" && user.entityId !== caseData.entityId) {
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
        entityId: caseData.entityId,
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
          entityId: caseData?.entityId,
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
  app.get("/api/entities/:entityId/module-access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Authorization: clients can only view their own entity's access
      if (user.role === "client" && user.entityId !== req.params.entityId) {
        return res.status(403).json({ error: "Not authorized to view this entity's module access" });
      }
      
      const access = await storage.getEntityModuleAccess(req.params.entityId);
      res.json(access);
    } catch (error) {
      console.error("Get entity module access error:", error);
      res.status(500).json({ error: "Failed to fetch module access" });
    }
  });

  // Set module access for an entity (admin/consultant only)
  app.post("/api/entities/:entityId/module-access", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin and consultants can set module access
      if (user.role !== "admin" && user.role !== "consultant") {
        return res.status(403).json({ error: "Only admins and consultants can manage module access" });
      }
      
      const { module, status, notes } = req.body;
      if (!module || !status) {
        return res.status(400).json({ error: "Module and status are required" });
      }
      
      // Validate module and status against allowed values
      const validModules = ["health_safety", "human_resources", "employment_law"];
      const validStatuses = ["active", "visible", "hidden"];
      
      if (!validModules.includes(module)) {
        return res.status(400).json({ error: `Invalid module. Must be one of: ${validModules.join(", ")}` });
      }
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }
      
      const access = await storage.setEntityModuleAccess(
        req.params.entityId,
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

  // Module Access Request Routes
  
  // Get all access requests (admin/consultant) or entity-specific (client)
  app.get("/api/module-access-requests", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      let entityId: string | undefined;
      const status = req.query.status as string | undefined;
      
      // Clients can only see their own entity's requests
      if (user.role === "client" && user.entityId) {
        entityId = user.entityId;
      } else if (req.query.entityId) {
        entityId = req.query.entityId as string;
      }
      
      const requests = await storage.getModuleAccessRequests(entityId, status as any);
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
      
      const { entityId, module, reason } = req.body;
      
      // Validate module
      const validModules = ["health_safety", "human_resources", "employment_law"];
      if (!module || !validModules.includes(module)) {
        return res.status(400).json({ error: `Invalid module. Must be one of: ${validModules.join(", ")}` });
      }
      
      // Validate entity and module access status
      const entity = await storage.getEntity(entityId);
      if (!entity) {
        return res.status(404).json({ error: "Entity not found" });
      }
      
      // Check if module is visible (requestable)
      const moduleAccess = await storage.getEntityModuleAccessByModule(entityId, module);
      if (moduleAccess && moduleAccess.status === "active") {
        return res.status(400).json({ error: "Module is already active for this entity" });
      }
      if (moduleAccess && moduleAccess.status === "hidden") {
        return res.status(400).json({ error: "Module is not available for request" });
      }
      
      // Check for existing pending request
      const existingRequests = await storage.getModuleAccessRequests(entityId, "pending");
      const duplicateRequest = existingRequests.find(r => r.module === module);
      if (duplicateRequest) {
        return res.status(400).json({ error: "A pending request for this module already exists" });
      }
      
      const request = await storage.createModuleAccessRequest({
        entityId,
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
  
  // Get users for an entity
  app.get("/api/entities/:entityId/users", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Clients can only see users from their own entity
      if (user.role === "client" && user.entityId !== req.params.entityId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const users = await storage.getUsersByEntity(req.params.entityId);
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
      const entities = await storage.getEntities();
      
      // Enhance each consultant with their entity assignments
      const enhancedConsultants = await Promise.all(
        consultants.map(async (consultant) => {
          const { password, ...safeConsultant } = consultant;
          const assignments = await storage.getConsultantEntities(consultant.id);
          const entityAssignments = assignments.map((a) => {
            const entity = entities.find((e) => e.id === a.entityId);
            return {
              entityId: a.entityId,
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
  app.get("/api/entities/:entityId/consultants", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Clients can only access their own entity's consultants
      if (user.role === "client" && user.entityId !== req.params.entityId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const assignments = await storage.getConsultantAssignments(req.params.entityId);
      
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
  app.post("/api/entities/:entityId/consultants", requireAuth, async (req, res) => {
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
        entityId: req.params.entityId,
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
  app.delete("/api/entities/:entityId/consultants/:consultantId", requireAuth, async (req, res) => {
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
        req.params.entityId
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
  app.patch("/api/entities/:entityId/consultants/:consultantId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Only admin can update consultant assignments
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can update consultant assignments" });
      }
      
      const { isPrimary } = req.body;
      
      const updated = await storage.updateConsultantAssignment(
        req.params.consultantId,
        req.params.entityId,
        { isPrimary }
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
        // Consultants can only update users in their assigned entities
        if (currentUser.role === "consultant" && targetUser.entityId) {
          const assignments = await storage.getConsultantAssignments(targetUser.entityId);
          if (!assignments.some(a => a.consultantId === currentUser.id)) {
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
