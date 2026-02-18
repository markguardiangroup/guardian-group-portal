import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Modules
export type ModuleType = "health_safety" | "human_resources" | "employment_law" | "training" | "support" | "reports";

// User roles (top-level)
export type UserRole = "admin" | "consultant" | "client";

// Consultant tiers (for consultant users)
export type ConsultantTier = "senior" | "standard" | "junior";

// Client permission roles (for client users within their entity)
export type ClientPermissionRole = "owner" | "manager" | "approver" | "contributor" | "viewer";

// Site request status
export type SiteRequestStatus = "draft" | "pending" | "approved" | "rejected";

// Site status
export type SiteStatus = "active" | "inactive" | "pending";

// Document status for RAG indicators
export type DocumentStatus = "compliant" | "review_required" | "overdue";

// Approval status
// - pending: Initial state, awaiting first review
// - client_signed_off: Client has reviewed and signed off, awaiting consultant final approval
// - approved: Consultant has given final approval (triggers renewal date)
// - rejected: Document was rejected
// - changes_requested: Changes requested by reviewer
export type ApprovalStatus = "pending" | "review_required" | "client_signed_off" | "approved" | "rejected" | "changes_requested";

// Company status
export type CompanyStatus = "active" | "inactive" | "pending";

// Companies table (parent of sites)
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: text("reference_number").unique(),
  name: text("name").notNull(),
  companyNumber: text("company_number"),
  website: text("website"),
  // Structured address fields
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  county: text("county"),
  postalCode: text("postal_code"),
  country: text("country"),
  // Primary contact details
  contactUserId: text("contact_user_id"),
  contactName: text("contact_name"),
  contactPosition: text("contact_position"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  searchTag: text("search_tag"),
  status: text("status").$type<CompanyStatus>().notNull().default("active"),
  // Module access - set at company level, applies to all sites and users
  healthSafetyAccess: boolean("health_safety_access").notNull().default(false),
  humanResourcesAccess: boolean("human_resources_access").notNull().default(false),
  employmentLawAccess: boolean("employment_law_access").notNull().default(false),
  supportAccess: boolean("support_access").notNull().default(false),
  reportsAccess: boolean("reports_access").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, referenceNumber: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Extended company type with site count for listings
export type CompanyWithSiteCount = Company & {
  siteCount: number;
};

// Paginated response for companies
export type PaginatedCompaniesResponse = {
  companies: CompanyWithSiteCount[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: text("reference_number").unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  // Extended user profile fields
  title: text("title"), // Mr, Mrs, Ms, Dr, etc.
  firstName: text("first_name"),
  lastName: text("last_name"),
  jobTitle: text("job_title"),
  department: text("department"),
  phone: text("phone"),
  mobile: text("mobile"),
  preferredContactMethod: text("preferred_contact_method").$type<"email" | "phone" | "mobile">(),
  notes: text("notes"),
  role: text("role").$type<UserRole>().notNull().default("client"),
  // Company-level access (user can access all sites in this company)
  companyId: varchar("entity_id"),
  // Consultant-specific: tier level
  consultantTier: text("consultant_tier").$type<ConsultantTier>(),
  // Client-specific: permission role within their site/company
  clientPermissionRole: text("client_permission_role").$type<ClientPermissionRole>(),
  status: text("status").$type<"active" | "inactive" | "invited">().notNull().default("invited"),
  lastLoginAt: timestamp("last_login_at"),
  legalAcceptedAt: timestamp("legal_accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, referenceNumber: true, createdAt: true, lastLoginAt: true, legalAcceptedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User status type for type safety
export type UserStatus = "active" | "inactive" | "invited";

// Invitation token purpose
export type InvitationPurpose = "invite" | "password_reset";

// User invitations table (for invite links and password resets)
export const userInvitations = pgTable("user_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull(), // Store hashed token only
  purpose: text("purpose").$type<InvitationPurpose>().notNull().default("invite"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"), // null if not yet used
  createdBy: varchar("created_by"), // Admin/consultant who created the invite
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({ id: true, createdAt: true });
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;
export type UserInvitation = typeof userInvitations.$inferSelect;

// Sites (Client locations - belong to a company)
export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: text("reference_number").unique(),
  companyId: varchar("entity_id").notNull(),
  name: text("name").notNull(),
  // Structured address fields
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  county: text("county"),
  postalCode: text("postal_code"),
  country: text("country"),
  // Primary site contact details
  contactName: text("contact_name"),
  contactPosition: text("contact_position"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
});

export const insertSiteSchema = createInsertSchema(sites).omit({ id: true, referenceNumber: true });
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sites.$inferSelect;

// Extended site type with company details (for queries that join company data)
export type SiteWithCompany = Site & {
  companyName?: string;
  companyNumber?: string | null;
};

// Site Requests (consultants request, admins approve) - uses entity_requests table
export const siteRequests = pgTable("entity_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposedName: text("proposed_name").notNull(),
  companyNumber: text("company_number"),
  address: text("address"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactName: text("contact_name"),
  notes: text("notes"),
  status: text("status").$type<SiteRequestStatus>().notNull().default("draft"),
  requestedBy: varchar("requested_by").notNull(),
  reviewedBy: varchar("reviewed_by"),
  adminNotes: text("admin_notes"),
  approvedEntityId: varchar("approved_entity_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSiteRequestSchema = createInsertSchema(siteRequests).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  reviewedBy: true,
  adminNotes: true,
  approvedEntityId: true
});
export type InsertSiteRequest = z.infer<typeof insertSiteRequestSchema>;
export type SiteRequest = typeof siteRequests.$inferSelect;

// Consultant-Site assignments (which consultants work with which sites)
// Note: entityId is the site ID (legacy naming from original design)
export const consultantAssignments = pgTable("consultant_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").notNull(),
  entityId: varchar("entity_id").notNull(), // This is the site ID
  siteId: varchar("site_id"), // Optional, kept for compatibility
  isPrimary: boolean("is_primary").notNull().default(false),
  canManageModules: boolean("can_manage_modules").notNull().default(false),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export const insertConsultantAssignmentSchema = createInsertSchema(consultantAssignments).omit({ 
  id: true, 
  assignedAt: true 
});
export type InsertConsultantAssignment = z.infer<typeof insertConsultantAssignmentSchema>;
export type ConsultantAssignment = typeof consultantAssignments.$inferSelect;

// Client-Site assignments (which clients can access which sites within their company)
export const clientSiteAssignments = pgTable("client_site_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  siteId: varchar("site_id").notNull(),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  assignedBy: varchar("assigned_by"),
});

export const insertClientSiteAssignmentSchema = createInsertSchema(clientSiteAssignments).omit({ 
  id: true, 
  assignedAt: true 
});
export type InsertClientSiteAssignment = z.infer<typeof insertClientSiteAssignmentSchema>;
export type ClientSiteAssignment = typeof clientSiteAssignments.$inferSelect;

// Site Module Access status
export type ModuleAccessStatus = "active" | "visible" | "hidden";

// Site Module Access Request status
export type ModuleAccessRequestStatus = "pending" | "approved" | "rejected";

// Site Module Access (which modules a site has access to)
export const siteModuleAccess = pgTable("site_module_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull(),
  module: text("module").$type<ModuleType>().notNull(),
  status: text("status").$type<ModuleAccessStatus>().notNull().default("visible"),
  grantedBy: varchar("granted_by"),
  grantedAt: timestamp("granted_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSiteModuleAccessSchema = createInsertSchema(siteModuleAccess).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
  grantedAt: true
});
export type InsertSiteModuleAccess = z.infer<typeof insertSiteModuleAccessSchema>;
export type SiteModuleAccess = typeof siteModuleAccess.$inferSelect;

// Site Module Access Requests (clients request access to modules)
export const moduleAccessRequests = pgTable("module_access_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull(),
  siteName: text("site_name").notNull(),
  module: text("module").$type<ModuleType>().notNull(),
  requestedBy: varchar("requested_by").notNull(),
  requestedByName: text("requested_by_name").notNull(),
  reason: text("reason"),
  status: text("status").$type<ModuleAccessRequestStatus>().notNull().default("pending"),
  reviewedBy: varchar("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertModuleAccessRequestSchema = createInsertSchema(moduleAccessRequests).omit({ 
  id: true, 
  createdAt: true,
  reviewedBy: true,
  reviewedByName: true,
  reviewNotes: true,
  reviewedAt: true
});
export type InsertModuleAccessRequest = z.infer<typeof insertModuleAccessRequestSchema>;
export type ModuleAccessRequest = typeof moduleAccessRequests.$inferSelect;

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

// Employment Law document types
export type ELDocumentType = 
  | "tupe_consultation" 
  | "investigation_report" 
  | "disciplinary_hearing" 
  | "cot3_agreement" 
  | "settlement_agreement" 
  | "grievance_outcome" 
  | "appeal_hearing" 
  | "witness_statement"
  | "case_notes"
  | "legal_correspondence";

// Training document types
export type TrainingDocumentType = 
  | "training_certificate"
  | "completion_record"
  | "attendance_register";

// Combined document type
export type DocumentType = HSDocumentType | HRDocumentType | ELDocumentType | TrainingDocumentType;

// Case status for Employment Law module
export type CaseStatus = "open" | "under_investigation" | "hearing_scheduled" | "resolved" | "closed";

// Case type for Employment Law
export type CaseType = "tribunal_claim";

// Employment Law Cases (Individual files linked to specific people)
export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull(), // Company the case belongs to
  siteId: varchar("site_id").notNull(), // Site within the company
  folderId: varchar("folder_id"), // Auto-created folder for case documents
  caseReference: text("case_reference").notNull(),
  employeeName: text("employee_name").notNull(),
  employeeId: text("employee_id"),
  caseType: text("case_type").$type<CaseType>().notNull(),
  status: text("status").$type<CaseStatus>().notNull().default("open"),
  description: text("description"),
  isConfidential: boolean("is_confidential").notNull().default(true),
  isArchived: boolean("is_archived").notNull().default(false),
  restrictedToUsers: text("restricted_to_users"),
  hearingDate: timestamp("hearing_date"),
  responseDeadline: timestamp("response_deadline"),
  resolutionDate: timestamp("resolution_date"),
  assignedConsultant: varchar("assigned_consultant"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCaseSchema = createInsertSchema(cases).omit({ 
  id: true, 
  caseReference: true, // Auto-generated as CSE-XXXXX
  createdAt: true, 
  updatedAt: true 
});
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;

// Case Milestones (key dates and events for cases)
export const caseMilestones = pgTable("case_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  completedDate: timestamp("completed_date"),
  isCompleted: boolean("is_completed").notNull().default(false),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCaseMilestoneSchema = createInsertSchema(caseMilestones).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertCaseMilestone = z.infer<typeof insertCaseMilestoneSchema>;
export type CaseMilestone = typeof caseMilestones.$inferSelect;

// Document Types (Admin-managed master list)
export const documentTypes = pgTable("document_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // Unique identifier like "fire_risk_assessment"
  module: text("module").$type<ModuleType>().notNull(),
  description: text("description"), // Guidance for clients
  isRequired: boolean("is_required").notNull().default(false),
  renewalPeriodMonths: integer("renewal_period_months"), // null = no renewal needed
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDocumentTypeSchema = createInsertSchema(documentTypes).omit({ 
  id: true, 
  code: true, // Auto-generated as TPL-XXXXX
  createdAt: true, 
  updatedAt: true 
});
export type InsertDocumentType = z.infer<typeof insertDocumentTypeSchema>;
export type DocumentTypeRecord = typeof documentTypes.$inferSelect;

// Folder Templates (Admin-managed master folder structure)
export const folderTemplates = pgTable("folder_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // Unique identifier like "fire_safety_docs"
  module: text("module").$type<ModuleType>().notNull(),
  description: text("description"),
  parentId: varchar("parent_id"), // Reference to parent template for nested hierarchy
  isRequired: boolean("is_required").notNull().default(false), // Required folder per module
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFolderTemplateSchema = createInsertSchema(folderTemplates).omit({ 
  id: true, 
  code: true, // Auto-generated as FLD-XXXXX
  createdAt: true, 
  updatedAt: true 
});
export type InsertFolderTemplate = z.infer<typeof insertFolderTemplateSchema>;
export type FolderTemplate = typeof folderTemplates.$inferSelect;

// Folder-Document Type Rules (which document types belong in which folders)
export const folderDocumentTypeRules = pgTable("folder_document_type_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderTemplateId: varchar("folder_template_id").notNull(),
  documentTypeId: varchar("document_type_id").notNull(),
  isRequired: boolean("is_required").notNull().default(false), // Document is required in this folder
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFolderDocumentTypeRuleSchema = createInsertSchema(folderDocumentTypeRules).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertFolderDocumentTypeRule = z.infer<typeof insertFolderDocumentTypeRuleSchema>;
export type FolderDocumentTypeRule = typeof folderDocumentTypeRules.$inferSelect;

// Document Templates (The "Document Bible" - master templates for creating documents)
export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  folderTemplateId: varchar("folder_template_id").notNull(), // Which template folder this belongs to
  documentTypeId: varchar("document_type_id"), // Legacy - kept for backward compatibility
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"), // URL/path to the uploaded template file in object storage
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  version: integer("version").notNull().default(1),
  // Placeholder variables available in this template
  placeholders: text("placeholders"), // JSON array of placeholder names like ["COMPANY_NAME", "SITE_ADDRESS"]
  // Compliance properties (moved from document types for simplicity)
  isRequired: boolean("is_required").notNull().default(false), // Is this template required for compliance?
  renewalPeriodMonths: integer("renewal_period_months"), // How often documents from this template need renewal (null = no renewal)
  requiresApproval: boolean("requires_approval").notNull().default(true), // Does document need client approval workflow?
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Soft delete tracking
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  deletionReason: text("deletion_reason"),
});

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

// Document Template Versions (track template history for lineage)
export const documentTemplateVersions = pgTable("document_template_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  version: integer("version").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"), // URL/path to the uploaded file in object storage
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type"), // File MIME type
  changeNote: text("change_note"),
  uploadedBy: varchar("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDocumentTemplateVersionSchema = createInsertSchema(documentTemplateVersions).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertDocumentTemplateVersion = z.infer<typeof insertDocumentTemplateVersionSchema>;
export type DocumentTemplateVersion = typeof documentTemplateVersions.$inferSelect;

// Document Folders (for organizing documents)
export const documentFolders = pgTable("document_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  siteId: varchar("site_id").notNull(),
  parentId: varchar("parent_id"), // Reference to parent folder for nesting
  templateId: varchar("template_id"), // Reference to folder template this was created from
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDocumentFolderSchema = createInsertSchema(documentFolders).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertDocumentFolder = z.infer<typeof insertDocumentFolderSchema>;
export type DocumentFolder = typeof documentFolders.$inferSelect;

// Document source type
export type DocumentSource = "template" | "external";

// Documents
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  type: text("type").$type<DocumentType>().notNull(),
  entityId: varchar("entity_id").notNull(), // Company ID - required
  documentTypeId: varchar("document_type_id"), // Reference to admin-managed document types
  folderId: varchar("folder_id"), // Reference to folder for organization
  siteId: varchar("site_id"), // Can be null for company-level documents
  caseId: varchar("case_id"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"), // URL/path to the uploaded file in object storage
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").$type<DocumentStatus>().notNull().default("review_required"),
  approvalStatus: text("approval_status").$type<ApprovalStatus>().notNull().default("pending"),
  reviewDate: timestamp("review_date"),
  expiryDate: timestamp("expiry_date"),
  lastApprovedAt: timestamp("last_approved_at"), // When document was last approved
  renewalDate: timestamp("renewal_date"), // Calculated: lastApprovedAt + renewalPeriodMonths - 30 days
  uploadedBy: varchar("uploaded_by").notNull(),
  assignedTo: varchar("assigned_to"),
  isArchived: boolean("is_archived").notNull().default(false),
  // Template lineage tracking
  source: text("source").$type<DocumentSource>().notNull().default("external"), // "template" or "external"
  templateId: varchar("template_id"), // Reference to document template used
  templateVersion: integer("template_version"), // Version of template when document was created
  // Training certificate specific fields
  trainingCourseTitle: text("training_course_title"), // Course title for training certificates
  trainingCourseCode: text("training_course_code"), // Course code for training certificates
  trainingDate: timestamp("training_date"), // Date of training/certification
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
  fileUrl: text("file_url"),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type"),
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
  | "document_signed_off"
  | "document_rejected" 
  | "document_updated" 
  | "document_archived"
  | "changes_requested"
  | "comment_added"
  | "support_request_created"
  | "support_request_resolved"
  | "case_created"
  | "case_updated"
  | "case_status_changed"
  | "case_closed"
  | "milestone_added"
  | "milestone_completed"
  | "login"
  | "logout"
  | "login_failed"
  | "account_locked"
  | "password_change"
  | "email_sent";

// Audit logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").$type<AuditAction>().notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  entityId: varchar("entity_id"),
  documentId: varchar("document_id"),
  caseId: varchar("case_id"),
  supportRequestId: varchar("support_request_id"),
  module: text("module").$type<ModuleType>(),
  details: text("details"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
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
  siteId: varchar("site_id").notNull(),
  createdBy: varchar("created_by").notNull(),
  assignedTo: varchar("assigned_to"),
  response: text("response"),
  respondedBy: varchar("responded_by"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertSupportRequestSchema = createInsertSchema(supportRequests).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  resolvedAt: true,
  response: true,
  respondedBy: true,
  respondedAt: true,
});
export type InsertSupportRequest = z.infer<typeof insertSupportRequestSchema>;
export type SupportRequest = typeof supportRequests.$inferSelect;

// Support messages - conversation thread for support requests
export const supportMessages = pgTable("support_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({ 
  id: true, 
  createdAt: true,
});
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type SupportMessage = typeof supportMessages.$inferSelect;

// Support request read tracking - tracks when users last viewed a support request
export const supportRequestReads = pgTable("support_request_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(),
  userId: varchar("user_id").notNull(),
  lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
});

export type SupportRequestRead = typeof supportRequestReads.$inferSelect;

// Site document type access - tracks which document types each site has access to
export const siteDocumentTypeAccess = pgTable("site_document_type_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull(),
  documentTypeId: varchar("document_type_id").notNull(), // Links to documentTypes.id
  module: text("module").$type<ModuleType>().notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  grantedBy: varchar("granted_by"),
});

export const insertSiteDocumentTypeAccessSchema = createInsertSchema(siteDocumentTypeAccess).omit({ 
  id: true, 
  grantedAt: true 
});
export type InsertSiteDocumentTypeAccess = z.infer<typeof insertSiteDocumentTypeAccessSchema>;
export type SiteDocumentTypeAccess = typeof siteDocumentTypeAccess.$inferSelect;

// Document type with access status for display
export interface DocumentTypeWithAccess {
  id: string; // documentTypeId from master list
  code: string; // document type code
  name: string; // display name
  module: ModuleType;
  hasAccess: boolean;
  documentCount: number;
  isRequired: boolean;
  renewalPeriodMonths: number | null;
}

// Compliance summary (computed/cached data for dashboard)
export interface ComplianceSummary {
  totalDocuments: number;
  compliantDocuments: number;
  reviewRequired: number;
  overdueDocuments: number;
  pendingApprovals: number;
  awaitingYourApproval: number;
  awaitingOthersApproval: number;
  complianceScore: number;
}

// Module summary for dashboard
export interface ModuleSummary extends ComplianceSummary {
  module: ModuleType;
  moduleName: string;
}

// Module access summary for site list view
export interface SiteModuleAccessSummary {
  health_safety: "active" | "visible" | "hidden";
  human_resources: "active" | "visible" | "hidden";
  employment_law: "active" | "visible" | "hidden";
  support: "active" | "visible" | "hidden";
}

// Assigned consultant summary for site list view
export interface AssignedConsultantSummary {
  id: string;
  name: string;
  isPrimary: boolean;
}

// Site with extended data for list view
export interface SiteWithDetails extends Site {
  companyName?: string;
  companyNumber?: string;
  companySearchTag?: string;
  complianceSummary?: ComplianceSummary;
  moduleAccess?: SiteModuleAccessSummary;
  assignedConsultants?: AssignedConsultantSummary[];
}

// Document with related data
export interface DocumentWithDetails extends Document {
  siteName?: string;
  companyName?: string;
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
      { value: "risk_assessment", label: "Risk Assessment" },
    ],
  },
  human_resources: {
    name: "Human Resources",
    shortName: "HR",
    documentTypes: [],
  },
  employment_law: {
    name: "Employment Law",
    shortName: "EL",
    documentTypes: [],
  },
  training: {
    name: "Training",
    shortName: "TRN",
    documentTypes: [
      { value: "training_certificate", label: "Training Certificate" },
      { value: "completion_record", label: "Completion Record" },
      { value: "attendance_register", label: "Attendance Register" },
    ],
  },
  support: {
    name: "Support",
    shortName: "SUP",
    documentTypes: [],
  },
  reports: {
    name: "Reports",
    shortName: "RPT",
    documentTypes: [],
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
  manager: {
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

// Site request with requester info
export interface SiteRequestWithDetails extends SiteRequest {
  requesterName?: string;
  reviewerName?: string;
}

// User with site name
export interface UserWithDetails extends User {
  siteName?: string;
}

// ============================================
// SECURITY TABLES
// ============================================

// Login attempts tracking (for account lockout)
export const loginAttempts = pgTable("login_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull().default(false),
  failureReason: text("failure_reason"),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
});

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = typeof loginAttempts.$inferInsert;

// Training Folders (unique folder structure for training, separate from document folders)
export const trainingFolders = pgTable("training_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrainingFolderSchema = createInsertSchema(trainingFolders).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertTrainingFolder = z.infer<typeof insertTrainingFolderSchema>;
export type TrainingFolder = typeof trainingFolders.$inferSelect;

// FAQ item type for training courses
export type TrainingFAQ = {
  question: string;
  answer: string;
};

// Pricing table row type for training courses (2 columns)
export type PricingTableRow = {
  column1: string;
  column2: string;
};

// Full pricing table structure (heading row + 5 data rows)
export type PricingTable = {
  headingRow: PricingTableRow;
  dataRows: PricingTableRow[]; // Up to 5 rows
};

// Training Method type
export type TrainingMethod = "online" | "in_person";

// Training Courses (Admin-managed training library)
export const trainingCourses = pgTable("training_courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  summary: text("summary"), // Brief summary of the course
  productCode: text("product_code"), // Product/SKU code for the course
  module: text("module").$type<ModuleType>().notNull(),
  trainingFolderId: varchar("training_folder_id"), // Links to training folders
  provider: text("provider"), // e.g., "IOSH", "HSE Direct", "CIPD"
  trainingMethod: text("training_method").$type<TrainingMethod>(), // Online or In Person
  externalLink: text("external_link"), // Optional URL to 3rd party training
  duration: text("duration"), // e.g., "2 hours", "1 day", "Self-paced"
  courseOverview: text("course_overview").array(), // List of course topics/sections
  faqs: text("faqs"), // JSON string of TrainingFAQ[] (5 Q&A pairs)
  pricingTable: text("pricing_table"), // JSON string of PricingTable (heading row + 5 data rows)
  isRequired: boolean("is_required").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false), // Show in featured section
  renewalPeriodMonths: integer("renewal_period_months"), // For required training refresh
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrainingCourseSchema = createInsertSchema(trainingCourses).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertTrainingCourse = z.infer<typeof insertTrainingCourseSchema>;
export type TrainingCourse = typeof trainingCourses.$inferSelect;

// Training Requests (for clients to request info or book training)
export type TrainingRequestType = "info" | "booking";
export type TrainingRequestStatus = "pending" | "contacted" | "booked" | "completed" | "cancelled";

export const trainingRequests = pgTable("training_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trainingCourseId: varchar("training_course_id").notNull(),
  siteId: varchar("site_id").notNull(),
  requestType: text("request_type").$type<TrainingRequestType>().notNull(),
  requestedBy: varchar("requested_by").notNull(),
  message: text("message"), // Optional message from requester
  status: text("status").$type<TrainingRequestStatus>().notNull().default("pending"),
  respondedBy: varchar("responded_by"),
  responseNotes: text("response_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  bookedAt: timestamp("booked_at"), // When training was booked by consultant
  bookedBy: varchar("booked_by"), // Consultant who booked
  scheduledDate: timestamp("scheduled_date"), // Scheduled training date
  completedAt: timestamp("completed_at"), // When training was marked complete
  completedBy: varchar("completed_by"), // Consultant who marked complete
  renewalDate: timestamp("renewal_date"), // When re-training is due
});

export const insertTrainingRequestSchema = createInsertSchema(trainingRequests).omit({ 
  id: true, 
  createdAt: true,
  respondedAt: true,
  bookedAt: true,
  bookedBy: true,
  completedAt: true,
  completedBy: true,
  renewalDate: true
});
export type InsertTrainingRequest = z.infer<typeof insertTrainingRequestSchema>;
export type TrainingRequest = typeof trainingRequests.$inferSelect;

// Legacy Training Modules table (kept for backward compatibility)
export const trainingModules = pgTable("training_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  folderTemplateId: varchar("folder_template_id"),
  provider: text("provider"),
  externalLink: text("external_link"),
  duration: text("duration"),
  isRequired: boolean("is_required").notNull().default(false),
  renewalPeriodMonths: integer("renewal_period_months"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrainingModuleSchema = createInsertSchema(trainingModules).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertTrainingModule = z.infer<typeof insertTrainingModuleSchema>;
export type TrainingModule = typeof trainingModules.$inferSelect;

// Training Bookings - Simplified training management (consultant books, client views)
export type TrainingBookingStatus = "booked" | "completed";

export const trainingBookings = pgTable("training_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trainingCourseId: varchar("training_course_id").notNull(),
  siteId: varchar("site_id").notNull(),
  
  // Booking details
  scheduledDate: timestamp("scheduled_date"),
  bookedBy: varchar("booked_by").notNull(), // Consultant who created the booking
  bookedAt: timestamp("booked_at").notNull().defaultNow(),
  
  // Access information for clients
  accessUrl: text("access_url"), // Login URL or course link
  accessUsername: text("access_username"),
  accessPassword: text("access_password"),
  
  // Provider contact
  providerName: text("provider_name"),
  providerContact: text("provider_contact"), // Phone or email
  
  // Status tracking
  status: text("status").$type<TrainingBookingStatus>().notNull().default("booked"),
  notes: text("notes"),
  
  // Completion tracking
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"),
  certificateId: varchar("certificate_id"), // Linked document ID when certificate uploaded
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrainingBookingSchema = createInsertSchema(trainingBookings).omit({ 
  id: true, 
  bookedAt: true,
  createdAt: true, 
  updatedAt: true,
  completedAt: true,
  completedBy: true,
});
export type InsertTrainingBooking = z.infer<typeof insertTrainingBookingSchema>;
export type TrainingBooking = typeof trainingBookings.$inferSelect;

// Account lockout configuration
export const SECURITY_CONFIG = {
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
  sessionTimeoutMinutes: 60,
  passwordMinLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false,
} as const;

// Development Roadmap - Admin feature tracking
export type RoadmapStatus = "idea" | "planned" | "in_progress" | "completed";
export type RoadmapPriority = "low" | "medium" | "high";

export const roadmapItems = pgTable("roadmap_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("feature"), // feature, improvement, bug, enhancement
  status: text("status").$type<RoadmapStatus>().notNull().default("idea"),
  priority: text("priority").$type<RoadmapPriority>().notNull().default("medium"),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRoadmapItemSchema = createInsertSchema(roadmapItems).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertRoadmapItem = z.infer<typeof insertRoadmapItemSchema>;
export type RoadmapItem = typeof roadmapItems.$inferSelect;
