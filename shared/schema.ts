import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
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
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  county: text("county"),
  postalCode: text("postal_code"),
  country: text("country"),
  contactUserId: text("contact_user_id"),
  contactName: text("contact_name"),
  contactPosition: text("contact_position"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  searchTag: text("search_tag"),
  status: text("status").$type<CompanyStatus>().notNull().default("active"),
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

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: text("reference_number").unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  title: text("title"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  jobTitle: text("job_title"),
  department: text("department"),
  phone: text("phone"),
  mobile: text("mobile"),
  preferredContactMethod: text("preferred_contact_method").$type<"email" | "phone" | "mobile">(),
  notes: text("notes"),
  role: text("role").$type<UserRole>().notNull().default("client"),
  companyId: varchar("entity_id"),
  consultantTier: text("consultant_tier").$type<ConsultantTier>(),
  clientPermissionRole: text("client_permission_role").$type<ClientPermissionRole>(),
  status: text("status").$type<"active" | "inactive" | "invited" | "site_required" | "invite_required">().notNull().default("invited"),
  lastLoginAt: timestamp("last_login_at"),
  legalAcceptedAt: timestamp("legal_accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, referenceNumber: true, createdAt: true, lastLoginAt: true, legalAcceptedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  entityId: varchar("entity_id"),
  siteId: varchar("site_id"),
  documentId: varchar("document_id"),
  caseId: varchar("case_id"),
  supportRequestId: varchar("support_request_id"),
  module: text("module").$type<ModuleType>(),
  details: text("details"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const feedbackTable = pgTable("feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  message: text("message").notNull(),
  adminNotes: text("admin_notes"),
  likes: jsonb("likes").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Feedback = typeof feedbackTable.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

export const userInvitations = pgTable("user_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull(),
  purpose: text("purpose").$type<"invite" | "password_reset">().notNull().default("invite"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserInvitation = typeof userInvitations.$inferSelect;
export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({ id: true, createdAt: true });
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;

export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: text("reference_number").unique(),
  companyId: varchar("entity_id").notNull(),
  name: text("name").notNull(),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  county: text("county"),
  postalCode: text("postal_code"),
  country: text("country"),
  contactName: text("contact_name"),
  contactPosition: text("contact_position"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
});

export const insertSiteSchema = createInsertSchema(sites).omit({ id: true, referenceNumber: true });
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sites.$inferSelect;

export const SECURITY_CONFIG = {
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
};

export const getClientCapabilities = (role: string | null) => {
  return {
    canManageUsers: role === "owner" || role === "admin",
    canEditDocuments: role === "owner" || role === "manager",
    canDeleteDocuments: role === "owner",
    canApproveDocuments: role === "owner" || role === "manager",
  };
};

export const trainingModules = pgTable("training_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TrainingModule = typeof trainingModules.$inferSelect;
export const insertTrainingModuleSchema = createInsertSchema(trainingModules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrainingModule = z.infer<typeof insertTrainingModuleSchema>;

export const trainingFolders = pgTable("training_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  module: text("module").$type<ModuleType>().notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TrainingFolder = typeof trainingFolders.$inferSelect;
export const insertTrainingFolderSchema = createInsertSchema(trainingFolders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrainingFolder = z.infer<typeof insertTrainingFolderSchema>;

export const trainingCourses = pgTable("training_courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  summary: text("summary"),
  module: text("module").$type<ModuleType>().notNull(),
  trainingFolderId: varchar("training_folder_id"),
  provider: text("provider"),
  externalLink: text("external_link"),
  duration: text("duration"),
  courseOverview: text("course_overview"),
  faqs: text("faqs"),
  isRequired: boolean("is_required").notNull().default(false),
  renewalPeriodMonths: integer("renewal_period_months"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TrainingCourse = typeof trainingCourses.$inferSelect;
export const insertTrainingCourseSchema = createInsertSchema(trainingCourses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrainingCourse = z.infer<typeof insertTrainingCourseSchema>;

export const trainingRequests = pgTable("training_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trainingCourseId: varchar("training_course_id").notNull(),
  siteId: varchar("site_id").notNull(),
  requestType: text("request_type").$type<"booking" | "info">().notNull(),
  requestedBy: varchar("requested_by").notNull(),
  message: text("message"),
  status: text("status").$type<"pending" | "responded" | "closed">().notNull().default("pending"),
  respondedBy: varchar("responded_by"),
  responseNotes: text("response_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
});

export type TrainingRequest = typeof trainingRequests.$inferSelect;
export const insertTrainingRequestSchema = createInsertSchema(trainingRequests).omit({ id: true, createdAt: true, respondedAt: true });
export type InsertTrainingRequest = z.infer<typeof insertTrainingRequestSchema>;

export const trainingBookings = pgTable("training_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trainingCourseId: varchar("training_course_id").notNull(),
  siteId: varchar("site_id").notNull(),
  bookingDate: timestamp("booking_date"),
  expiryDate: timestamp("expiry_date"),
  status: text("status").$type<"upcoming" | "completed" | "cancelled">().notNull().default("upcoming"),
  accessCredentials: text("access_credentials"),
  bookedBy: varchar("booked_by").notNull(),
  bookedAt: timestamp("booked_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TrainingBooking = typeof trainingBookings.$inferSelect;
export const insertTrainingBookingSchema = createInsertSchema(trainingBookings).omit({ id: true, createdAt: true, updatedAt: true, bookedAt: true });
export type InsertTrainingBooking = z.infer<typeof insertTrainingBookingSchema>;

export const roadmapItemsTable = pgTable("roadmap_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").$type<"feature" | "improvement" | "bugfix">().notNull().default("feature"),
  status: text("status").$type<"idea" | "planned" | "in_progress" | "completed" | "declined">().notNull().default("idea"),
  priority: text("priority").$type<"low" | "medium" | "high">().notNull().default("medium"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type RoadmapItem = typeof roadmapItemsTable.$inferSelect;
export const insertRoadmapItemSchema = createInsertSchema(roadmapItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRoadmapItem = z.infer<typeof insertRoadmapItemSchema>;

export const loginAttempts = pgTable("login_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export const insertLoginAttemptSchema = createInsertSchema(loginAttempts).omit({ id: true, createdAt: true });
export type InsertLoginAttempt = z.infer<typeof insertLoginAttemptSchema>;

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  type: text("type").notNull(),
  entityId: varchar("entity_id").notNull(),
  documentTypeId: varchar("document_type_id"),
  folderId: varchar("folder_id"),
  siteId: varchar("site_id"),
  caseId: varchar("case_id"),
  fileName: text("fileName").notNull(),
  fileUrl: text("fileUrl"),
  fileSize: integer("fileSize").notNull(),
  mimeType: text("mimeType").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").$type<DocumentStatus>().notNull().default("review_required"),
  approvalStatus: text("approval_status").$type<ApprovalStatus>().notNull().default("pending"),
  reviewDate: timestamp("review_date"),
  expiryDate: timestamp("expiry_date"),
  lastApprovedAt: timestamp("last_approved_at"),
  renewalDate: timestamp("renewal_date"),
  uploadedBy: varchar("uploaded_by").notNull(),
  assignedTo: varchar("assigned_to"),
  isArchived: boolean("is_archived").notNull().default(false),
  source: text("source").$type<"template" | "upload" | "external">().notNull().default("upload"),
  templateId: varchar("template_id"),
  templateVersion: integer("template_version"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Document = typeof documents.$inferSelect;
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export const documentVersions = pgTable("document_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull(),
  version: integer("version").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type"),
  changeNote: text("change_note"),
  uploadedBy: varchar("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DocumentVersion = typeof documentVersions.$inferSelect;
export const insertDocumentVersionSchema = createInsertSchema(documentVersions).omit({ id: true, createdAt: true });
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;

export const documentFolders = pgTable("document_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  siteId: varchar("site_id").notNull(),
  parentId: varchar("parent_id"),
  templateId: varchar("template_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type DocumentFolder = typeof documentFolders.$inferSelect;
export const insertDocumentFolderSchema = createInsertSchema(documentFolders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentFolder = z.infer<typeof insertDocumentFolderSchema>;

export const supportRequests = pgTable("support_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  priority: text("priority").$type<"low" | "medium" | "high" | "urgent">().notNull().default("medium"),
  category: text("category").notNull(),
  status: text("status").$type<"open" | "in_progress" | "resolved" | "closed">().notNull().default("open"),
  siteId: varchar("site_id").notNull(),
  module: text("module").$type<ModuleType>(),
  userId: varchar("user_id").notNull(),
  assignedTo: varchar("assigned_to"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SupportRequest = typeof supportRequests.$inferSelect;
export const insertSupportRequestSchema = createInsertSchema(supportRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportRequest = z.infer<typeof insertSupportRequestSchema>;

export const supportMessages = pgTable("support_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  message: text("message").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SupportMessage = typeof supportMessages.$inferSelect;
export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({ id: true, createdAt: true });
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;

export const supportRequestReads = pgTable("support_request_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(),
  userId: varchar("user_id").notNull(),
  lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
});

export type SupportRequestRead = typeof supportRequestReads.$inferSelect;

export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull(),
  siteId: varchar("site_id").notNull(),
  folderId: varchar("folder_id"),
  caseReference: text("case_reference").notNull(),
  employeeName: text("employee_name").notNull(),
  employeeId: text("employee_id"),
  caseType: text("case_type").$type<"disciplinary" | "grievance" | "tupe" | "redundancy" | "tribunal_claim" | "settlement" | "appeal" | "investigation">().notNull(),
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

export type Case = typeof cases.$inferSelect;
export const insertCaseSchema = createInsertSchema(cases).omit({ id: true, caseReference: true, createdAt: true, updatedAt: true });
export type InsertCase = z.infer<typeof insertCaseSchema>;

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

export type CaseMilestone = typeof caseMilestones.$inferSelect;
export const insertCaseMilestoneSchema = createInsertSchema(caseMilestones).omit({ id: true, createdAt: true });
export type InsertCaseMilestone = z.infer<typeof insertCaseMilestoneSchema>;

export const consultantAssignments = pgTable("consultant_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").notNull(),
  entityId: varchar("entity_id").notNull(),
  siteId: varchar("site_id"),
  isPrimary: boolean("is_primary").notNull().default(false),
  canManageModules: boolean("can_manage_modules").notNull().default(false),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export type ConsultantAssignment = typeof consultantAssignments.$inferSelect;
export const insertConsultantAssignmentSchema = createInsertSchema(consultantAssignments).omit({ id: true, assignedAt: true });
export type InsertConsultantAssignment = z.infer<typeof insertConsultantAssignmentSchema>;

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

export type ModuleAccessRequest = typeof moduleAccessRequests.$inferSelect;
export const insertModuleAccessRequestSchema = createInsertSchema(moduleAccessRequests).omit({ id: true, createdAt: true, reviewedAt: true, reviewedBy: true, reviewedByName: true, reviewNotes: true });
export type InsertModuleAccessRequest = z.infer<typeof insertModuleAccessRequestSchema>;

export const siteDocumentTypeAccess = pgTable("site_document_type_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull(),
  documentTypeId: varchar("document_type_id").notNull(),
  isGranted: boolean("is_granted").notNull().default(true),
  grantedBy: varchar("granted_by"),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
});

export type SiteDocumentTypeAccess = typeof siteDocumentTypeAccess.$inferSelect;
export const insertSiteDocumentTypeAccessSchema = createInsertSchema(siteDocumentTypeAccess).omit({ id: true, grantedAt: true });
export type InsertSiteDocumentTypeAccess = z.infer<typeof insertSiteDocumentTypeAccessSchema>;

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

export type SiteModuleAccess = typeof siteModuleAccess.$inferSelect;
export const insertSiteModuleAccessSchema = createInsertSchema(siteModuleAccess).omit({ id: true, createdAt: true, updatedAt: true, grantedAt: true });
export type InsertSiteModuleAccess = z.infer<typeof insertSiteModuleAccessSchema>;

export const documentTypes = pgTable("document_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  module: text("module").$type<ModuleType>().notNull(),
  description: text("description"),
  isRequired: boolean("is_required").notNull().default(false),
  renewalPeriodMonths: integer("renewal_period_months"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type DocumentTypeRecord = typeof documentTypes.$inferSelect;
export const insertDocumentTypeSchema = createInsertSchema(documentTypes).omit({ id: true, code: true, createdAt: true, updatedAt: true });
export type InsertDocumentType = z.infer<typeof insertDocumentTypeSchema>;

export const folderTemplates = pgTable("folder_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  module: text("module").$type<ModuleType>().notNull(),
  description: text("description"),
  parentId: varchar("parent_id"),
  isRequired: boolean("is_required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type FolderTemplate = typeof folderTemplates.$inferSelect;
export const insertFolderTemplateSchema = createInsertSchema(folderTemplates).omit({ id: true, code: true, createdAt: true, updatedAt: true });
export type InsertFolderTemplate = z.infer<typeof insertFolderTemplateSchema>;

export const folderDocumentTypeRules = pgTable("folder_document_type_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderTemplateId: varchar("folder_template_id").notNull(),
  documentTypeId: varchar("document_type_id").notNull(),
  isRequired: boolean("is_required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FolderDocumentTypeRule = typeof folderDocumentTypeRules.$inferSelect;
export const insertFolderDocumentTypeRuleSchema = createInsertSchema(folderDocumentTypeRules).omit({ id: true, createdAt: true });
export type InsertFolderDocumentTypeRule = z.infer<typeof insertFolderDocumentTypeRuleSchema>;

export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").$type<ModuleType>().notNull(),
  folderTemplateId: varchar("folder_template_id").notNull(),
  documentTypeId: varchar("document_type_id"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  version: integer("version").notNull().default(1),
  placeholders: text("placeholders"),
  isRequired: boolean("is_required").notNull().default(false),
  renewalPeriodMonths: integer("renewal_period_months"),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  deletionReason: text("deletion_reason"),
});

export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;

export const documentTemplateVersions = pgTable("document_template_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  version: integer("version").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type"),
  changeNote: text("change_note"),
  uploadedBy: varchar("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DocumentTemplateVersion = typeof documentTemplateVersions.$inferSelect;
export const insertDocumentTemplateVersionSchema = createInsertSchema(documentTemplateVersions).omit({ id: true, createdAt: true });
export type InsertDocumentTemplateVersion = z.infer<typeof insertDocumentTemplateVersionSchema>;

// Additional shared types
export type ComplianceSummary = {
  totalDocuments: number;
  compliantDocuments: number;
  reviewRequired: number;
  overdueDocuments: number;
  pendingApprovals: number;
  awaitingYourApproval: number;
  awaitingOthersApproval: number;
  complianceScore: number;
};

export type ModuleSummary = {
  module: ModuleType;
  totalDocuments: number;
  compliantDocuments: number;
  reviewRequired: number;
  overdueDocuments: number;
  pendingApprovals: number;
  complianceScore: number;
  status: ModuleAccessStatus;
};

export type SiteWithDetails = Site & {
  companyName?: string;
  companyNumber?: string;
  companySearchTag?: string;
  complianceSummary: ComplianceSummary;
  moduleAccess: Record<string, ModuleAccessStatus>;
  assignedConsultants: { id: string; name: string; isPrimary: boolean }[];
};

export type DocumentWithDetails = Document & {
  folderName?: string;
  siteName?: string;
  companyName?: string;
};

export type DocumentTypeWithAccess = DocumentTypeRecord & {
  isGranted: boolean;
};

export type DocumentType = typeof documentTypes.$inferSelect;
