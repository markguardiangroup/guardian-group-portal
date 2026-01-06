import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Modules
export type ModuleType = "health_safety" | "human_resources";

// User roles
export type UserRole = "admin" | "consultant" | "client";

// Document status for RAG indicators
export type DocumentStatus = "compliant" | "review_required" | "overdue";

// Approval status
export type ApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").$type<UserRole>().notNull().default("client"),
  entityId: varchar("entity_id"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Entities (Client organizations)
export const entities = pgTable("entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  companyNumber: text("company_number"),
  address: text("address"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
});

export const insertEntitySchema = createInsertSchema(entities).omit({ id: true });
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entities.$inferSelect;

// Sites (Locations within entities)
export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  siteManager: text("site_manager"),
  contactPhone: text("contact_phone"),
});

export const insertSiteSchema = createInsertSchema(sites).omit({ id: true });
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sites.$inferSelect;

// Health & Safety document types
export type HSDocumentType = 
  | "hs_policy" 
  | "risk_assessment" 
  | "safety_audit" 
  | "coshh_assessment" 
  | "fire_safety" 
  | "incident_report" 
  | "method_statement" 
  | "hs_checklist";

// Human Resources document types
export type HRDocumentType = 
  | "employment_contract" 
  | "employee_handbook" 
  | "disciplinary_procedure" 
  | "grievance_procedure" 
  | "training_record" 
  | "performance_review" 
  | "hr_policy" 
  | "absence_record";

// Combined document type
export type DocumentType = HSDocumentType | HRDocumentType;

// Documents
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  type: text("type").$type<DocumentType>().notNull(),
  entityId: varchar("entity_id").notNull(),
  siteId: varchar("site_id"),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").$type<DocumentStatus>().notNull().default("review_required"),
  approvalStatus: text("approval_status").$type<ApprovalStatus>().notNull().default("pending"),
  reviewDate: timestamp("review_date"),
  expiryDate: timestamp("expiry_date"),
  uploadedBy: varchar("uploaded_by").notNull(),
  assignedTo: varchar("assigned_to"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Document versions (for version history)
export const documentVersions = pgTable("document_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull(),
  version: integer("version").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  changeNote: text("change_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDocumentVersionSchema = createInsertSchema(documentVersions).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;
export type DocumentVersion = typeof documentVersions.$inferSelect;

// Audit log action types
export type AuditAction = 
  | "document_uploaded" 
  | "document_viewed" 
  | "document_approved" 
  | "document_rejected" 
  | "document_updated" 
  | "document_archived"
  | "changes_requested"
  | "comment_added"
  | "support_request_created"
  | "support_request_resolved";

// Audit logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").$type<AuditAction>().notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  entityId: varchar("entity_id"),
  documentId: varchar("document_id"),
  supportRequestId: varchar("support_request_id"),
  module: text("module").$type<ModuleType>(),
  details: text("details"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Support request priority
export type SupportPriority = "low" | "medium" | "high" | "urgent";

// Support request status
export type SupportStatus = "open" | "in_progress" | "resolved" | "closed";

// Support requests
export const supportRequests = pgTable("support_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  priority: text("priority").$type<SupportPriority>().notNull().default("medium"),
  status: text("status").$type<SupportStatus>().notNull().default("open"),
  category: text("category").notNull(),
  module: text("module").$type<ModuleType>(),
  entityId: varchar("entity_id").notNull(),
  createdBy: varchar("created_by").notNull(),
  assignedTo: varchar("assigned_to"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertSupportRequestSchema = createInsertSchema(supportRequests).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  resolvedAt: true 
});
export type InsertSupportRequest = z.infer<typeof insertSupportRequestSchema>;
export type SupportRequest = typeof supportRequests.$inferSelect;

// Compliance summary (computed/cached data for dashboard)
export interface ComplianceSummary {
  totalDocuments: number;
  compliantDocuments: number;
  reviewRequired: number;
  overdueDocuments: number;
  pendingApprovals: number;
  complianceScore: number;
}

// Module summary for dashboard
export interface ModuleSummary extends ComplianceSummary {
  module: ModuleType;
  moduleName: string;
}

// Entity with sites for hierarchy view
export interface EntityWithSites extends Entity {
  sites: Site[];
  complianceSummary?: ComplianceSummary;
}

// Document with related data
export interface DocumentWithDetails extends Document {
  entityName?: string;
  siteName?: string;
  uploadedByName?: string;
  assignedToName?: string;
  versions?: DocumentVersion[];
}

// Module configuration
export const moduleConfig: Record<ModuleType, { 
  name: string; 
  shortName: string;
  documentTypes: { value: DocumentType; label: string }[] 
}> = {
  health_safety: {
    name: "Health & Safety",
    shortName: "H&S",
    documentTypes: [
      { value: "hs_policy", label: "H&S Policy" },
      { value: "risk_assessment", label: "Risk Assessment" },
      { value: "safety_audit", label: "Safety Audit" },
      { value: "coshh_assessment", label: "COSHH Assessment" },
      { value: "fire_safety", label: "Fire Safety" },
      { value: "incident_report", label: "Incident Report" },
      { value: "method_statement", label: "Method Statement" },
      { value: "hs_checklist", label: "H&S Checklist" },
    ],
  },
  human_resources: {
    name: "Human Resources",
    shortName: "HR",
    documentTypes: [
      { value: "employment_contract", label: "Employment Contract" },
      { value: "employee_handbook", label: "Employee Handbook" },
      { value: "disciplinary_procedure", label: "Disciplinary Procedure" },
      { value: "grievance_procedure", label: "Grievance Procedure" },
      { value: "training_record", label: "Training Record" },
      { value: "performance_review", label: "Performance Review" },
      { value: "hr_policy", label: "HR Policy" },
      { value: "absence_record", label: "Absence Record" },
    ],
  },
};
