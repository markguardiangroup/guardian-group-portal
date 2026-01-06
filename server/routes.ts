import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import type { ModuleType } from "@shared/schema";

const createDocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  module: z.enum(["health_safety", "human_resources"]),
  type: z.string().min(1),
  entityId: z.string().min(1),
  siteId: z.string().optional(),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
  reviewDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

const createSupportRequestSchema = z.object({
  subject: z.string().min(5),
  description: z.string().min(20),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string().min(1),
  module: z.enum(["health_safety", "human_resources"]).optional(),
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

  return httpServer;
}
