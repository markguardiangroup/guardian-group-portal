import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Modules
export type ModuleType = "health_safety" | "human_resources";

// User roles (top-level)
export type UserRole = "admin" | "consultant" | "client";

// Consultant tiers (for consultant users)
export type ConsultantTier = "senior" | "standard" | "junior";

// Client permission roles (for client users within their entity)
export type ClientPermissionRole = "owner" | "approver" | "contributor" | "viewer";

// Entity request status
export type EntityRequestStatus = "draft" | "pending" | "approved" | "rejected";

// Entity status
export type EntityStatus = "active" | "inactive" | "pending";

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
  // Consultant-specific: tier level
  consultantTier: text("consultant_tier").$type<ConsultantTier>(),
  // Client-specific: permission role within their entity
  clientPermissionRole: text("client_permission_role").$type<ClientPermissionRole>(),
  status: text("status").$type<"active" | "inactive">().notNull().default("active"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastLoginAt: true });
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
  status: text("status").$type<EntityStatus>().notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEntitySchema = createInsertSchema(entities).omit({ id: true, createdAt: true });
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entities.$inferSelect;

// Entity Requests (consultants request, admins approve)
export const entityRequests = pgTable("entity_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposedName: text("proposed_name").notNull(),
  companyNumber: text("company_number"),
  address: text("address"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactName: text("contact_name"),
  notes: text("notes"),
  status: text("status").$type<EntityRequestStatus>().notNull().default("draft"),
  requestedBy: varchar("requested_by").notNull(),
  reviewedBy: varchar("reviewed_by"),
  adminNotes: text("admin_notes"),
  approvedEntityId: varchar("approved_entity_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEntityRequestSchema = createInsertSchema(entityRequests).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  reviewedBy: true,
  adminNotes: true,
  approvedEntityId: true
});
export type InsertEntityRequest = z.infer<typeof insertEntityRequestSchema>;
export type EntityRequest = typeof entityRequests.$inferSelect;

// Consultant-Entity assignments (which consultants work with which entities)
export const consultantAssignments = pgTable("consultant_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").notNull(),
  entityId: varchar("entity_id").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export const insertConsultantAssignmentSchema = createInsertSchema(consultantAssignments).omit({ 
  id: true, 
  assignedAt: true 
});
export type InsertConsultantAssignment = z.infer<typeof insertConsultantAssignmentSchema>;
export type ConsultantAssignment = typeof consultantAssignments.$inferSelect;

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
  | "document_downloaded"
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

// Entity document type access - tracks which document types each entity has access to
export const entityDocumentTypeAccess = pgTable("entity_document_type_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull(),
  documentType: text("document_type").$type<DocumentType>().notNull(),
  module: text("module").$type<ModuleType>().notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  grantedBy: varchar("granted_by"),
});

export const insertEntityDocumentTypeAccessSchema = createInsertSchema(entityDocumentTypeAccess).omit({ 
  id: true, 
  grantedAt: true 
});
export type InsertEntityDocumentTypeAccess = z.infer<typeof insertEntityDocumentTypeAccessSchema>;
export type EntityDocumentTypeAccess = typeof entityDocumentTypeAccess.$inferSelect;

// Document type with access status for display
export interface DocumentTypeWithAccess {
  value: DocumentType;
  label: string;
  module: ModuleType;
  hasAccess: boolean;
  documentCount: number;
}

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

// Permission capability definitions

// Client permission capabilities
export interface ClientCapabilities {
  canApproveDocuments: boolean;
  canSubmitDocuments: boolean;
  canComment: boolean;
  canView: boolean;
  canRequestSupport: boolean;
  canManageTeam: boolean;
}

export const clientPermissionCapabilities: Record<ClientPermissionRole, ClientCapabilities> = {
  owner: {
    canApproveDocuments: true,
    canSubmitDocuments: true,
    canComment: true,
    canView: true,
    canRequestSupport: true,
    canManageTeam: true,
  },
  approver: {
    canApproveDocuments: true,
    canSubmitDocuments: true,
    canComment: true,
    canView: true,
    canRequestSupport: true,
    canManageTeam: false,
  },
  contributor: {
    canApproveDocuments: false,
    canSubmitDocuments: true,
    canComment: true,
    canView: true,
    canRequestSupport: true,
    canManageTeam: false,
  },
  viewer: {
    canApproveDocuments: false,
    canSubmitDocuments: false,
    canComment: false,
    canView: true,
    canRequestSupport: true,
    canManageTeam: false,
  },
};

// Consultant tier capabilities
export interface ConsultantCapabilities {
  canAccessAllClients: boolean;
  canRequestEntities: boolean;
  canManageClientUsers: boolean;
  canEditDocuments: boolean;
  canViewDocuments: boolean;
  canManageChecklists: boolean;
  canManageIncidents: boolean;
}

export const consultantTierCapabilities: Record<ConsultantTier, ConsultantCapabilities> = {
  senior: {
    canAccessAllClients: true,
    canRequestEntities: true,
    canManageClientUsers: true,
    canEditDocuments: true,
    canViewDocuments: true,
    canManageChecklists: true,
    canManageIncidents: true,
  },
  standard: {
    canAccessAllClients: false,
    canRequestEntities: true,
    canManageClientUsers: false,
    canEditDocuments: true,
    canViewDocuments: true,
    canManageChecklists: true,
    canManageIncidents: true,
  },
  junior: {
    canAccessAllClients: false,
    canRequestEntities: false,
    canManageClientUsers: false,
    canEditDocuments: false,
    canViewDocuments: true,
    canManageChecklists: false,
    canManageIncidents: false,
  },
};

// Helper to get capabilities
export function getClientCapabilities(role: ClientPermissionRole | null | undefined): ClientCapabilities {
  if (!role) {
    return clientPermissionCapabilities.viewer;
  }
  return clientPermissionCapabilities[role];
}

export function getConsultantCapabilities(tier: ConsultantTier | null | undefined): ConsultantCapabilities {
  if (!tier) {
    return consultantTierCapabilities.standard;
  }
  return consultantTierCapabilities[tier];
}

// Entity request with requester info
export interface EntityRequestWithDetails extends EntityRequest {
  requesterName?: string;
  reviewerName?: string;
}

// User with entity name
export interface UserWithDetails extends User {
  entityName?: string;
}
