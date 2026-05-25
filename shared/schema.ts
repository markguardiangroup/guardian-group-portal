import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, uniqueIndex, jsonb, bigint, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Modules
export type ModuleType = "health_safety" | "human_resources" | "employment_law" | "training" | "toolkit" | "support" | "reports";

// User roles (top-level)
export type UserRole = "admin" | "consultant" | "client";

// Consultant tiers (for consultant users)
export type ConsultantTier = "pro" | "standard";

// Client permission roles (for client users within their entity)
export type ClientPermissionRole = "full";

// Consultant feature permissions (stored as JSONB; null = all off)
export type ConsultantPermissions = {
  caseAdvocate?: boolean;
  trainingLibrary?: boolean;
  templateLibrary?: boolean;
  services?: boolean;
};

// Site status
export type SiteStatus = "active" | "inactive" | "pending";

// Document status for RAG indicators
export type DocumentStatus = "compliant" | "approval_required" | "overdue" | "approved";

// Approval status
// - pending: Initial state, awaiting first review
// - client_signed_off: Client has reviewed and signed off, awaiting consultant final approval
// - approved: Consultant has given final approval (triggers renewal date)
// - rejected: Document was rejected
// - changes_requested: Changes requested by reviewer
export type ApprovalStatus = "pending" | "review_required" | "client_signed_off" | "approved" | "rejected" | "changes_requested";

// Company status
export type CompanyStatus = "pending" | "active" | "on_hold" | "cancelled";

// Companies table (parent of sites)
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: text("reference_number").unique(),
  name: text("name").notNull(),
  companyNumber: text("company_number"),
  internalCompanyNumber: text("internal_company_number"),
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
  industry: text("industry"),
  employeeRange: text("employee_range"),
  status: text("status").$type<CompanyStatus>().notNull().default("pending"),
  // Module access - set at company level, applies to all sites and users
  healthSafetyAccess: boolean("health_safety_access").notNull().default(false),
  humanResourcesAccess: boolean("human_resources_access").notNull().default(false),
  employmentLawAccess: boolean("employment_law_access").notNull().default(false),
  trainingAccess: boolean("training_access").notNull().default(false),
  toolkitAccess: boolean("toolkit_access").notNull().default(false),
  supportAccess: boolean("support_access").notNull().default(false),
  reportsAccess: boolean("reports_access").notNull().default(false),
  sources: text("sources").array(),
  // Group Owner linkage: if set, this company belongs to the specified Group Owner company
  groupOwnerId: varchar("group_owner_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, referenceNumber: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Extended company type with site count for listings
export type CompanyWithSiteCount = Company & {
  siteCount: number;
  isGroupOwner?: boolean;      // true when other companies reference this as their GO
  groupOwnerName?: string | null; // name of the GO this company belongs to (if any)
  acceloLinks?: { sourceCode: string; acceloId: string; acceloStanding: string | null; acceloType: string | null; acceloColor: string | null; lastCheckedAt: Date | null }[];
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
  // Consultant-specific: the Pro Consultant who manages this consultant (null = unmanaged)
  managerId: varchar("manager_id"),
  // Consultant-specific: feature permissions (e.g. { caseAdvocate: true })
  consultantPermissions: jsonb("consultant_permissions").$type<ConsultantPermissions>(),
  // Client-specific: permission role within their site/company
  clientPermissionRole: text("client_permission_role").$type<ClientPermissionRole>(),
  sources: text("sources").array(),
  status: text("status").$type<"active" | "inactive" | "invited" | "site_required" | "invite_required" | "locked">().notNull().default("invited"),
  lastLoginAt: timestamp("last_login_at"),
  legalAcceptedAt: timestamp("legal_accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, referenceNumber: true, createdAt: true, lastLoginAt: true, legalAcceptedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User status type for type safety
export type UserStatus = "active" | "inactive" | "invited" | "site_required" | "invite_required" | "locked";

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
  invalidatedAt: timestamp("invalidated_at"), // set when superseded by a newer invite/reset
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
export type CaseType = "tribunal_claim" | "acas_conciliation";

// Employment Law Cases (Individual files linked to specific people)
export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull(), // Company the case belongs to
  siteId: varchar("site_id").notNull(), // Site within the company
  folderId: varchar("folder_id"), // Auto-created folder for case documents
  caseReference: text("case_reference").notNull(),
  caseNumber: text("case_number").notNull().default(""),
  caseName: text("case_name").notNull().default(""),
  employeeName: text("employee_name").notNull(),
  employeeId: text("employee_id"),
  caseType: text("case_type").$type<CaseType>().notNull(),
  status: text("status").$type<CaseStatus>().notNull().default("open"),
  description: text("description"),
  isConfidential: boolean("is_confidential").notNull().default(true),
  isArchived: boolean("is_archived").notNull().default(false),
  sources: text("sources").array().default([]),
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
  isResponseDeadline: boolean("is_response_deadline").notNull().default(false),
  completionNotes: text("completion_notes"),
  checklistItemId: varchar("checklist_item_id"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCaseMilestoneSchema = createInsertSchema(caseMilestones).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertCaseMilestone = z.infer<typeof insertCaseMilestoneSchema>;
export type CaseMilestone = typeof caseMilestones.$inferSelect;

// Case Document Checklist (essential documents required for a case)
export const caseDocumentChecklist = pgTable("case_document_checklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"),
  linkedDocumentId: varchar("linked_document_id"),
  submissionDate: timestamp("submission_date"),
  linkedMilestoneId: varchar("linked_milestone_id"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCaseDocumentChecklistSchema = createInsertSchema(caseDocumentChecklist).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  completedBy: true,
});
export type InsertCaseDocumentChecklist = z.infer<typeof insertCaseDocumentChecklistSchema>;
export type CaseDocumentChecklist = typeof caseDocumentChecklist.$inferSelect;

// Case Notes
export const caseNotes = pgTable("case_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull(),
  content: text("content").notNull(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCaseNoteSchema = createInsertSchema(caseNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCaseNote = z.infer<typeof insertCaseNoteSchema>;
export type CaseNote = typeof caseNotes.$inferSelect;

// Incident Management (Health & Safety)
export type IncidentSeverity = "minor" | "moderate" | "major" | "critical";
export type IncidentStatus = "reported" | "under_review" | "resolved" | "closed";

export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentReference: text("incident_reference").notNull(),
  siteId: varchar("site_id").notNull(),
  entityId: varchar("entity_id").notNull(),
  folderId: varchar("folder_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  incidentType: text("incident_type").notNull(),
  severity: text("severity").$type<IncidentSeverity>().notNull(),
  status: text("status").$type<IncidentStatus>().notNull().default("reported"),
  incidentDate: timestamp("incident_date").notNull(),
  incidentTime: text("incident_time"),
  machineryInvolved: text("machinery_involved"),
  incidentNature: text("incident_nature"),
  incidentCause: text("incident_cause").array(),
  incidentEffect: text("incident_effect").array(),
  injuriesReported: boolean("injuries_reported").notNull().default(false),
  riddorReportable: boolean("riddor_reportable").notNull().default(false),
  riddorResponsiblePerson: text("riddor_responsible_person"),
  riddorNotes: text("riddor_notes"),
  riddorReference: text("riddor_reference"),
  injuryDetails: text("injury_details"),
  bodyDiagramMarkers: text("body_diagram_markers"),
  immediateActions: text("immediate_actions"),
  recommendations: text("recommendations"),
  rootCause: text("root_cause"),
  correctiveActions: text("corrective_actions"),
  witnesses: text("witnesses"),
  locationDetails: text("location_details"),
  affectedPersonName: text("affected_person_name"),
  affectedPersonAddress: text("affected_person_address"),
  affectedPersonJobTitle: text("affected_person_job_title"),
  affectedPersonIsPublic: boolean("affected_person_is_public").default(false),
  reportingPersonName: text("reporting_person_name"),
  reportingPersonAddress: text("reporting_person_address"),
  reportingPersonJobTitle: text("reporting_person_job_title"),
  declarationName: text("declaration_name"),
  declarationDate: text("declaration_date"),
  declarationSignature: text("declaration_signature"),
  reportedBy: varchar("reported_by").notNull(),
  reportedByName: text("reported_by_name").notNull(),
  assignedConsultant: varchar("assigned_consultant"),
  resolvedAt: timestamp("resolved_at"),
  isArchived: boolean("is_archived").notNull().default(false),
  // ── Follow-up Investigation fields ──
  invFirstAidGiven: boolean("inv_first_aid_given"),
  invHospitalVisit: boolean("inv_hospital_visit"),
  invAbsentFromWork: boolean("inv_absent_from_work"),
  invAbsentTimeframe: text("inv_absent_timeframe"),
  invWitnessesPresent: boolean("inv_witnesses_present"),
  invWitnesses: text("inv_witnesses"),
  invEquipmentInvolved: boolean("inv_equipment_involved"),
  invEquipment: text("inv_equipment"),
  invOperators: text("inv_operators"),
  invOperatorsQualified: boolean("inv_operators_qualified"),
  invDocumentsReviewed: text("inv_documents_reviewed").array(),
  invDocumentsOther: text("inv_documents_other"),
  invDocumentsComments: text("inv_documents_comments"),
  invContributingFactors: text("inv_contributing_factors"),
  invPrimaryCause: text("inv_primary_cause"),
  invRootCause: text("inv_root_cause"),
  invConclusion: text("inv_conclusion"),
  invActions: text("inv_actions"),
  invRecommendations: text("inv_recommendations"),
  invAmendments: text("inv_amendments"),
  invCompletedAt: timestamp("inv_completed_at"),
  invCompletedBy: text("inv_completed_by"),
  consultantFullAccess: boolean("consultant_full_access").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  incidentReference: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

export const incidentMilestones = pgTable("incident_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  completedDate: timestamp("completed_date"),
  isCompleted: boolean("is_completed").notNull().default(false),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIncidentMilestoneSchema = createInsertSchema(incidentMilestones).omit({
  id: true,
  createdAt: true,
});
export type InsertIncidentMilestone = z.infer<typeof insertIncidentMilestoneSchema>;
export type IncidentMilestone = typeof incidentMilestones.$inferSelect;

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
  isLocked: boolean("is_locked").notNull().default(false), // Prevents deletion from UI (e.g. system Toolkit folders)
  toolkitFolderId: varchar("toolkit_folder_id"), // Links this folder to a ToolkitFolder (for mirrored subfolders)
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

// Toolkit Folders (separate from Template Library folders — admin-managed, for organising Toolkit templates)
export const toolkitFolders = pgTable("toolkit_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  module: text("module").$type<ModuleType>().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertToolkitFolderSchema = createInsertSchema(toolkitFolders).omit({ id: true, createdAt: true });
export type InsertToolkitFolder = z.infer<typeof insertToolkitFolderSchema>;
export type ToolkitFolder = typeof toolkitFolders.$inferSelect;

// Document Templates (The "Document Bible" - master templates for creating documents)
export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  synopsis: text("synopsis"),
  module: text("module").$type<ModuleType>().notNull(),
  folderTemplateId: varchar("folder_template_id"), // Which template folder this belongs to (Template Library), nullable = unassigned
  toolkitFolderId: varchar("toolkit_folder_id"), // Which toolkit folder this belongs to (Toolkit page, nullable)
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
  visibility: text("visibility").$type<"public" | "private">().notNull().default("public"), // Public = visible to all clients, Private = restricted
  sources: text("sources").array().notNull().default([]), // Source codes that restrict visibility (empty = visible to all)
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

// Document Folders (for organizing documents).
// Folders can be scoped to a single site (legacy default — siteId set, scope='site')
// or to a company / group as a whole (siteId null, scope='company'|'group', entityId = company/group id).
export const documentFolders = pgTable("document_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  siteId: varchar("site_id"), // nullable — only set for site-scoped folders
  scope: text("scope").$type<DocumentScope>().notNull().default("site"),
  entityId: varchar("entity_id"), // company or group id when scope is 'company'|'group'
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

// Document scope type — site (default), company-level, or group-level
export type DocumentScope = "site" | "company" | "group";

// Documents
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  comments: text("comments"),
  module: text("module").$type<ModuleType>().notNull(),
  type: text("type").$type<DocumentType>().notNull(),
  entityId: varchar("entity_id").notNull(), // Company ID - required
  documentTypeId: varchar("document_type_id"), // Reference to admin-managed document types
  folderId: varchar("folder_id"), // Reference to folder for organization
  siteId: varchar("site_id"), // Can be null for company-level documents
  caseId: varchar("case_id"),
  incidentId: varchar("incident_id"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"), // URL/path to the uploaded file in object storage
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").$type<DocumentStatus>().notNull().default("approval_required"),
  approvalStatus: text("approval_status").$type<ApprovalStatus>().notNull().default("pending"),
  expiryDate: timestamp("expiry_date"),
  lastApprovedAt: timestamp("last_approved_at"), // When document was last approved
  renewalDate: timestamp("renewal_date"), // Calculated: lastApprovedAt + renewalPeriodMonths
  renewalPeriodMonths: integer("renewal_period_months"), // Stored when admin manually sets renewal tracking
  uploadedBy: varchar("uploaded_by").notNull(),
  isArchived: boolean("is_archived").notNull().default(false),
  isRequired: boolean("is_required").notNull().default(false), // Marked as required for compliance
  // Template lineage tracking
  source: text("source").$type<DocumentSource>().notNull().default("external"), // "template" or "external"
  templateId: varchar("template_id"), // Reference to document template used
  templateVersion: integer("template_version"), // Version of template when document was created
  // Training certificate specific fields
  trainingCourseTitle: text("training_course_title"), // Course title for training certificates
  trainingCourseCode: text("training_course_code"), // Course code for training certificates
  trainingDate: timestamp("training_date"), // Date of training/certification
  // Scope: 'site' = traditional site-level document; 'company' = company-level (visible to all sites in company);
  // 'group' = group-level (visible to all companies in the group).
  // Company/group scoped docs have siteId = null.
  scope: text("scope").$type<DocumentScope>().notNull().default("site"),
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

// Extended document type including the shared scope context (for API responses)
export type DocumentWithScope = Document & {
  sharedScope?: "company" | "group";
  sharedFromEntityName?: string | null;
};

// Document shares — explicit cross-entity sharing records.
// Used when a company-scope document is explicitly shared to specific sites,
// or when a group-scope document is explicitly shared to specific companies.
// Implicit sharing (all sites in a company, all companies in a group) is derived
// from the document's scope + entityId and does NOT need a row here.
export const documentShares = pgTable("document_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull(),
  // entityType: 'site' = shared to a specific site; 'company' = shared to a specific company
  entityType: text("entity_type").$type<"site" | "company">().notNull(),
  entityId: varchar("entity_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDocumentShareSchema = createInsertSchema(documentShares).omit({ id: true, createdAt: true });
export type InsertDocumentShare = z.infer<typeof insertDocumentShareSchema>;
export type DocumentShare = typeof documentShares.$inferSelect;

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
  | "incident_created"
  | "incident_updated"
  | "incident_status_changed"
  | "login"
  | "logout"
  | "login_failed"
  | "account_locked"
  | "password_change"
  | "password_changed"
  | "email_sent"
  | "user_activated"
  | "password_reset"
  | "client_folder_created"
  | "client_folder_deleted"
  | "client_upload_uploaded"
  | "client_upload_downloaded"
  | "client_upload_deleted"
  | "client_folder_access_granted"
  | "client_folder_access_revoked"
  | "case_deleted"
  | "incident_deleted"
  | "primary_contact_auto_assigned"
  | "company_suspended"
  | "company_reactivated";

// Audit logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").$type<AuditAction>().notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  entityId: varchar("entity_id"),
  documentId: varchar("document_id"),
  caseId: varchar("case_id"),
  incidentId: varchar("incident_id"),
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
  // Slot-based compliance (required documents only)
  totalDocuments: number;        // count of required template slots
  compliantDocuments: number;
  approvalRequired: number;      // required docs in approval_required status
  overdueDocuments: number;      // required docs that are overdue
  missingRequiredDocuments: number;
  complianceScore: number;
  // All-document progress stats (includes non-required docs) — used for metric tiles
  totalAllDocuments: number;     // count of ALL uploaded docs (required + non-required)
  allDocuments: number;          // alias for totalAllDocuments (backwards compat)
  allCompliantDocuments: number;
  allApprovalRequired: number;   // ALL docs (required + non-required) in approval workflow
  allOverdueDocuments: number;   // ALL docs (required + non-required) that are overdue
  // Approval workflow (all docs)
  pendingApprovals: number;
  awaitingYourApproval: number;
  awaitingOthersApproval: number;
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
  companySources?: string[] | null;
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
  full: {
    canApproveDocuments: true,
    canSubmitDocuments: true,
    canComment: true,
    canView: true,
    canRequestSupport: true,
    canManageTeam: true,
  },
};

// Consultant tier capabilities
export interface ConsultantCapabilities {
  canAccessAllClients: boolean;
  canApproveDocuments: boolean;
  canCreateClientUsers: boolean;
  canCreateCompanies: boolean;
  canCreateSites: boolean;
  canAssignConsultants: boolean;
  canDeleteCompanies: boolean;
  canDeleteUsers: boolean;
  canDeleteDocuments: boolean;
  canEditDocuments: boolean;
  canViewDocuments: boolean;
}

export const consultantTierCapabilities: Record<ConsultantTier, ConsultantCapabilities> = {
  pro: {
    canAccessAllClients: true,
    canApproveDocuments: true,
    canCreateClientUsers: true,
    canCreateCompanies: true,
    canCreateSites: true,
    canAssignConsultants: true,
    canDeleteCompanies: true,
    canDeleteUsers: true,
    canDeleteDocuments: true,
    canEditDocuments: true,
    canViewDocuments: true,
  },
  standard: {
    canAccessAllClients: false,
    canApproveDocuments: true,
    canCreateClientUsers: true,
    canCreateCompanies: false,
    canCreateSites: false,
    canAssignConsultants: false,
    canDeleteCompanies: false,
    canDeleteUsers: false,
    canDeleteDocuments: false,
    canEditDocuments: true,
    canViewDocuments: true,
  },
};

// Helper to get capabilities
export function getClientCapabilities(role: ClientPermissionRole | null | undefined): ClientCapabilities {
  return clientPermissionCapabilities.full;
}

export function getConsultantCapabilities(tier: ConsultantTier | null | undefined): ConsultantCapabilities {
  if (!tier) {
    return consultantTierCapabilities.standard;
  }
  return consultantTierCapabilities[tier];
}

// User with site name
export interface UserWithDetails extends User {
  siteName?: string;
}

// ============================================
// SECURITY TABLES
// ============================================

// Login attempts tracking (for account lockout)
export interface LoginAttempt {
  id: string;
  username: string;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  failureReason: string | null;
  attemptedAt: Date;
}
export type InsertLoginAttempt = Omit<LoginAttempt, "id" | "attemptedAt">;

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
  maxLoginAttempts: 3,
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
export type RoadmapModule = "OVERVIEW" | "ADMIN" | "HR" | "H&S" | "EL" | "TRAINING" | "TOOLKIT" | "REPORTS";

export const roadmapItems = pgTable("roadmap_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("feature"), // feature, improvement, bug, enhancement
  status: text("status").$type<RoadmapStatus>().notNull().default("idea"),
  priority: text("priority").$type<RoadmapPriority>().notNull().default("medium"),
  module: text("module").$type<RoadmapModule>(),
  sortOrder: integer("sort_order").notNull().default(0),
  developerNotes: text("developer_notes"),
  completedAt: timestamp("completed_at"),
  assignedUserId: varchar("assigned_user_id"),
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

// ─── Client Upload Folders ────────────────────────────────────────────────────
export type ClientUploadModule = "health_safety" | "human_resources" | "employment_law";

export const clientUploadFolders = pgTable("client_upload_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").$type<ClientUploadModule>().notNull(),
  siteId: varchar("site_id").notNull(),
  createdByUserId: varchar("created_by_user_id").notNull(),
  allocatedClientId: varchar("allocated_client_id"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientUploadFolderSchema = createInsertSchema(clientUploadFolders).omit({
  id: true,
  createdAt: true,
});
export type InsertClientUploadFolder = z.infer<typeof insertClientUploadFolderSchema>;
export type ClientUploadFolder = typeof clientUploadFolders.$inferSelect;

export const clientUploadFolderAccess = pgTable("client_upload_folder_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderId: varchar("folder_id").notNull(),
  userId: varchar("user_id").notNull(),
  grantedByUserId: varchar("granted_by_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientUploadFolderAccessSchema = createInsertSchema(clientUploadFolderAccess).omit({
  id: true,
  createdAt: true,
});
export type InsertClientUploadFolderAccess = z.infer<typeof insertClientUploadFolderAccessSchema>;
export type ClientUploadFolderAccess = typeof clientUploadFolderAccess.$inferSelect;

export const clientUploads = pgTable("client_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderId: varchar("folder_id").notNull(),
  module: text("module").$type<ClientUploadModule>().notNull(),
  siteId: varchar("site_id").notNull(),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileUrl: text("file_url").notNull(),
  description: text("description"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientUploadSchema = createInsertSchema(clientUploads).omit({
  id: true,
  createdAt: true,
});
export type InsertClientUpload = z.infer<typeof insertClientUploadSchema>;
export type ClientUpload = typeof clientUploads.$inferSelect;

// Feedback table for consultants to submit feedback during testing
export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  message: text("message").notNull(),
  status: text("status").$type<"open" | "resolved">().notNull().default("open"),
  upvotes: text("upvotes").array().notNull().default(sql`'{}'::text[]`), // Array of user IDs who upvoted
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
  upvotes: true,
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

// Feedback Comments table
export const feedbackComments = pgTable("feedback_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feedbackId: varchar("feedback_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  content: text("content").notNull(),
  likes: text("likes").array().notNull().default(sql`'{}'::text[]`), // Array of user IDs who liked
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFeedbackCommentSchema = createInsertSchema(feedbackComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likes: true,
});
export type InsertFeedbackComment = z.infer<typeof insertFeedbackCommentSchema>;
export type FeedbackComment = typeof feedbackComments.$inferSelect;

// Track when users last viewed feedback comments
export const feedbackReads = pgTable("feedback_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  feedbackId: varchar("feedback_id").notNull(),
  lastViewedAt: timestamp("last_viewed_at").notNull().defaultNow(),
});

export type FeedbackRead = typeof feedbackReads.$inferSelect;

// Company Required Templates (which templates are required per company for compliance)
export const companyRequiredTemplates = pgTable("company_required_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  templateId: varchar("template_id").notNull(),
  // When this row was cascaded from a parent group's required-templates list,
  // this column holds the parent group's company id. Null for rows added
  // directly at this company level (or for the group's own rows).
  inheritedFromCompanyId: varchar("inherited_from_company_id"),
  // Soft-remove timestamp. When the parent group removes a required template,
  // the cascade sets this on every member's inherited row instead of deleting,
  // so the row stays visible in the member's (and its sites') Required
  // Documents lists as a struck-through "previously inherited, no longer
  // required" entry. Cleared (set to NULL) when the group re-adds the template
  // (cascade reactivation). Never set on group-owner rows or member-owned
  // (non-inherited) rows — those are still hard-deleted on removal.
  removedAt: timestamp("removed_at"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("company_template_unique").on(table.companyId, table.templateId),
]);

export const insertCompanyRequiredTemplateSchema = createInsertSchema(companyRequiredTemplates).omit({ id: true, createdAt: true });
export type InsertCompanyRequiredTemplate = z.infer<typeof insertCompanyRequiredTemplateSchema>;
export type CompanyRequiredTemplate = typeof companyRequiredTemplates.$inferSelect;

// Site-level required template overrides (add or exclude per-site requirements)
export const siteTemplateOverrides = pgTable("site_template_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull(),
  templateId: varchar("template_id").notNull(),
  action: text("action").$type<"include" | "exclude">().notNull(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("site_template_unique").on(table.siteId, table.templateId),
]);

export const insertSiteTemplateOverrideSchema = createInsertSchema(siteTemplateOverrides).omit({ id: true, createdAt: true });
export type InsertSiteTemplateOverride = z.infer<typeof insertSiteTemplateOverrideSchema>;
export type SiteTemplateOverride = typeof siteTemplateOverrides.$inferSelect;

// Company-level required template overrides — let a member company opt out
// of (or opt in to) a template that was inherited from its parent group.
export const companyTemplateOverrides = pgTable("company_template_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  templateId: varchar("template_id").notNull(),
  action: text("action").$type<"include" | "exclude">().notNull(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("company_template_override_unique").on(table.companyId, table.templateId),
]);

export const insertCompanyTemplateOverrideSchema = createInsertSchema(companyTemplateOverrides).omit({ id: true, createdAt: true });
export type InsertCompanyTemplateOverride = z.infer<typeof insertCompanyTemplateOverrideSchema>;
export type CompanyTemplateOverride = typeof companyTemplateOverrides.$inferSelect;

// Toolkit Template Downloads (track when users download templates)
export const toolkitDownloads = pgTable("toolkit_downloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  companyId: varchar("company_id"),
  companyName: text("company_name"),
  siteId: varchar("site_id"),
  siteName: text("site_name"),
  downloadedAt: timestamp("downloaded_at").notNull().defaultNow(),
});

export type ToolkitDownload = typeof toolkitDownloads.$inferSelect;

// Document Pathways (Guided document finder decision trees)
export interface PathwayNode {
  question: string;
  answers: Array<{
    label: string;
    description?: string;
    next?: PathwayNode | null;
    templateIds?: string[];
  }>;
}

export const documentPathways = pgTable("document_pathways", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module").$type<"health_safety" | "human_resources" | "employment_law" | null>(),
  tree: jsonb("tree").notNull().$type<PathwayNode>(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDocumentPathwaySchema = createInsertSchema(documentPathways).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentPathway = z.infer<typeof insertDocumentPathwaySchema>;
export type DocumentPathway = typeof documentPathways.$inferSelect;

// Training Pathways (Guided training finder decision trees)
export interface TrainingPathwayNode {
  question: string;
  answers: Array<{
    label: string;
    description?: string;
    next?: TrainingPathwayNode | null;
    courseIds?: string[];
  }>;
}

export const trainingPathways = pgTable("training_pathways", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module").$type<"health_safety" | "human_resources" | "employment_law" | null>(),
  tree: jsonb("tree").notNull().$type<TrainingPathwayNode>(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrainingPathwaySchema = createInsertSchema(trainingPathways).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrainingPathway = z.infer<typeof insertTrainingPathwaySchema>;
export type TrainingPathway = typeof trainingPathways.$inferSelect;

// ─── Testing Task Lists ───────────────────────────────────────────────────────

export type TestingModule = "health_safety" | "human_resources" | "employment_law" | "training" | "general";

export type TaskItem = {
  id: string;
  label: string;
  description?: string;
};

export const testingTaskLists = pgTable("testing_task_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module").$type<TestingModule>().notNull().default("general"),
  tasks: jsonb("tasks").notNull().$type<TaskItem[]>().default(sql`'[]'::jsonb`),
  isArchived: boolean("is_archived").notNull().default(false),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTestingTaskListSchema = createInsertSchema(testingTaskLists).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTestingTaskList = z.infer<typeof insertTestingTaskListSchema>;
export type TestingTaskList = typeof testingTaskLists.$inferSelect;

export const testingTaskAssignments = pgTable("testing_task_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskListId: varchar("task_list_id").notNull(),
  assignedTo: varchar("assigned_to").notNull(),
  assignedBy: varchar("assigned_by").notNull(),
  completedTaskIds: jsonb("completed_task_ids").notNull().$type<string[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTestingTaskAssignmentSchema = createInsertSchema(testingTaskAssignments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTestingTaskAssignment = z.infer<typeof insertTestingTaskAssignmentSchema>;
export type TestingTaskAssignment = typeof testingTaskAssignments.$inferSelect;

// ==================== CASE BUNDLES ====================
export const caseBundles = pgTable("case_bundles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  checklistItemIds: text("checklist_item_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  cachedFileUrl: text("cached_file_url"),
  cachedAt: timestamp("cached_at"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  pageCount: integer("page_count"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCaseBundleSchema = createInsertSchema(caseBundles).omit({
  id: true,
  cachedFileUrl: true,
  cachedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCaseBundle = z.infer<typeof insertCaseBundleSchema>;
export type CaseBundle = typeof caseBundles.$inferSelect;

// ==================== PORTAL MESSAGES ====================
export const portalMessages = pgTable("portal_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("update"),
  targetRoles: text("target_roles").array().notNull().default(sql`ARRAY[]::text[]`),
  status: text("status").notNull().default("draft"),
  pinned: boolean("pinned").notNull().default(false),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  ctaType: text("cta_type").notNull().default("none"),
  ctaUrl: text("cta_url"),
  ctaLabel: text("cta_label"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPortalMessageSchema = createInsertSchema(portalMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPortalMessage = z.infer<typeof insertPortalMessageSchema>;
export type PortalMessage = typeof portalMessages.$inferSelect;

// ==================== SOURCES ====================
export const sources = pgTable("sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSourceSchema = createInsertSchema(sources).omit({ id: true, createdAt: true });
export type InsertSource = z.infer<typeof insertSourceSchema>;
export type Source = typeof sources.$inferSelect;

// ==================== BADGE TYPES ====================
export const badgeTypes = pgTable("badge_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBadgeTypeSchema = createInsertSchema(badgeTypes).omit({ id: true, createdAt: true });
export type InsertBadgeType = z.infer<typeof insertBadgeTypeSchema>;
export type BadgeType = typeof badgeTypes.$inferSelect;

// ==================== SERVICES ====================
export type ServiceModule = "health_safety" | "human_resources" | "employment_law";
export type ServiceType = "retained" | "recurring" | "pay_as_you_go" | "subscription" | "training";
export type PricePeriod = "one_off" | "monthly" | "annually";

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module").$type<ServiceModule>().notNull(),
  sourceId: varchar("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }),
  priceGbp: numeric("price_gbp", { precision: 10, scale: 2 }).notNull(),
  benchmarkPriceGbp: numeric("benchmark_price_gbp", { precision: 10, scale: 2 }),
  serviceType: text("service_type").$type<ServiceType>(),
  pricePeriod: text("price_period").$type<PricePeriod>(),
  badgeTypeId: varchar("badge_type_id").references(() => badgeTypes.id, { onDelete: "set null" }),
  isMultiService: boolean("is_multi_service").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertServiceSchema = createInsertSchema(services, {
  module: z.enum(["health_safety", "human_resources", "employment_law"]),
  serviceType: z.enum(["retained", "recurring", "pay_as_you_go", "subscription", "training"]),
  pricePeriod: z.enum(["one_off", "monthly", "annually"]),
}).omit({ id: true, createdAt: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

// ==================== SERVICE COMPONENTS ====================
export const serviceComponents = pgTable("service_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentServiceId: varchar("parent_service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  componentServiceId: varchar("component_service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
}, (table) => ({
  uniqueComponent: uniqueIndex("service_components_parent_component_unique").on(table.parentServiceId, table.componentServiceId),
}));

export const insertServiceComponentSchema = createInsertSchema(serviceComponents).omit({ id: true });
export type InsertServiceComponent = z.infer<typeof insertServiceComponentSchema>;
export type ServiceComponent = typeof serviceComponents.$inferSelect;

export const companyServices = pgTable("company_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  assignedBy: text("assigned_by"),
}, (table) => ({
  uniqueAssignment: uniqueIndex("company_services_company_service_unique").on(table.companyId, table.serviceId),
}));

export const insertCompanyServiceSchema = createInsertSchema(companyServices).omit({ id: true, assignedAt: true });
export type InsertCompanyService = z.infer<typeof insertCompanyServiceSchema>;
export type CompanyService = typeof companyServices.$inferSelect;

// ==================== KEY CONTACTS ====================
export type KeyContactEntityType = "company" | "site";

export const keyContacts = pgTable("key_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  entityType: text("entity_type").$type<KeyContactEntityType>().notNull(),
  entityId: varchar("entity_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueKeyContact: uniqueIndex("key_contacts_user_entity_unique").on(table.userId, table.entityType, table.entityId),
}));

export const insertKeyContactSchema = createInsertSchema(keyContacts).omit({ id: true, createdAt: true });
export type InsertKeyContact = z.infer<typeof insertKeyContactSchema>;
export type KeyContact = typeof keyContacts.$inferSelect;

// ==================== COMPANY ACCELO LINKS ====================
export const companyAcceloLinks = pgTable("company_accelo_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  sourceCode: text("source_code").notNull(),
  acceloId: text("accelo_id").notNull(),
  acceloStanding: text("accelo_standing"),
  acceloType: text("accelo_type"),
  acceloColor: text("accelo_color"),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueCompanySource: uniqueIndex("company_accelo_links_company_source_unique").on(table.companyId, table.sourceCode),
}));

export type CompanyAcceloLink = typeof companyAcceloLinks.$inferSelect;

export const acceloSyncLogs = pgTable("accelo_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  syncType: text("sync_type").notNull(),
  sourceCode: text("source_code").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  triggeredByName: text("triggered_by_name").notNull(),
  companyId: varchar("company_id"),
  companyName: text("company_name"),
  companiesTotal: integer("companies_total").notNull().default(0),
  companiesUpdated: integer("companies_updated").notNull().default(0),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

export type AcceloSyncLog = typeof acceloSyncLogs.$inferSelect;

// Scheduler run tracking — one row per task, upserted after each run
export const schedulerRuns = pgTable("scheduler_runs", {
  taskId: text("task_id").primaryKey(),
  lastRunAt: timestamp("last_run_at").notNull(),
});

export type SchedulerRun = typeof schedulerRuns.$inferSelect;
