import { 
  type User, type InsertUser,
  type Site, type InsertSite,
  type Company, type InsertCompany, type CompanyWithSiteCount,
  type Document, type InsertDocument,
  type DocumentVersion, type InsertDocumentVersion,
  type DocumentFolder, type InsertDocumentFolder,
  type AuditLog, type InsertAuditLog,
  type SupportRequest, type InsertSupportRequest,
  type SupportMessage, type InsertSupportMessage,
  type Case, type InsertCase,
  type CaseMilestone, type InsertCaseMilestone,
  type ComplianceSummary,
  type SiteWithDetails,
  type SiteWithCompany,
  type DocumentWithDetails,
  type ModuleType,
  type ModuleSummary,
  type SiteDocumentTypeAccess, type InsertSiteDocumentTypeAccess,
  type DocumentTypeWithAccess,
  type DocumentType,
  type CaseStatus,
  type SiteModuleAccess, type InsertSiteModuleAccess, type ModuleAccessStatus,
  type ModuleAccessRequest, type InsertModuleAccessRequest, type ModuleAccessRequestStatus,
  type ConsultantAssignment, type InsertConsultantAssignment,
  type ClientSiteAssignment, type InsertClientSiteAssignment,
  clientSiteAssignments as clientSiteAssignmentsTable,
  type DocumentTypeRecord, type InsertDocumentType,
  type ToolkitFolder, type InsertToolkitFolder,
  toolkitFolders as toolkitFoldersTable,
  type ToolkitDownload,
  toolkitDownloads as toolkitDownloadsTable,
  type FolderTemplate, type InsertFolderTemplate,
  type FolderDocumentTypeRule, type InsertFolderDocumentTypeRule,
  type DocumentTemplate, type InsertDocumentTemplate,
  type DocumentTemplateVersion, type InsertDocumentTemplateVersion,
  type LoginAttempt, type InsertLoginAttempt,
  type TrainingModule, type InsertTrainingModule,
  type TrainingFolder, type InsertTrainingFolder,
  type TrainingCourse, type InsertTrainingCourse,
  type TrainingRequest, type InsertTrainingRequest,
  type TrainingBooking, type InsertTrainingBooking,
  type RoadmapItem, type InsertRoadmapItem,
  type Incident, type InsertIncident,
  type IncidentMilestone, type InsertIncidentMilestone,
  type Feedback, type InsertFeedback,
  type FeedbackComment, type InsertFeedbackComment,
  type UserInvitation, type InsertUserInvitation, type InvitationPurpose,
  type ClientUploadFolder, type InsertClientUploadFolder,
  type ClientUploadFolderAccess, type InsertClientUploadFolderAccess,
  type ClientUpload, type InsertClientUpload,
  clientUploadFolders as clientUploadFoldersTable,
  clientUploadFolderAccess as clientUploadFolderAccessTable,
  clientUploads as clientUploadsTable,
  userInvitations as userInvitationsTable,
  trainingModules as trainingModulesTable,
  trainingFolders as trainingFoldersTable,
  trainingCourses as trainingCoursesTable,
  trainingRequests as trainingRequestsTable,
  trainingBookings as trainingBookingsTable,
  roadmapItems as roadmapItemsTable,
  documentTypes,
  folderTemplates as folderTemplatesTable,
  folderDocumentTypeRules as folderDocumentTypeRulesTable,
  documentTemplates as documentTemplatesTable,
  documentTemplateVersions as documentTemplateVersionsTable,
  documents as documentsTable,
  documentVersions as documentVersionsTable,
  documentFolders as documentFoldersTable,
  auditLogs as auditLogsTable,
  siteModuleAccess as siteModuleAccessTable,
  users as usersTable,
  sites as sitesTable,
  companies as companiesTable,
  supportRequests as supportRequestsTable,
  supportMessages as supportMessagesTable,
  supportRequestReads as supportRequestReadsTable,
  cases as casesTable,
  caseMilestones as caseMilestonesTable,
  incidents as incidentsTable,
  incidentMilestones as incidentMilestonesTable,
  consultantAssignments as consultantAssignmentsTable,
  moduleAccessRequests as moduleAccessRequestsTable,
  siteDocumentTypeAccess as siteDocumentTypeAccessTable,
  feedback as feedbackTable,
  feedbackComments as feedbackCommentsTable,
  feedbackReads as feedbackReadsTable,
  SECURITY_CONFIG,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, asc, desc, isNull, gt, count, sql } from "drizzle-orm";

// Reference number generation helpers
type ReferencePrefix = 'CMP' | 'STE' | 'ADM' | 'CON' | 'CLI' | 'USR';

function formatReferenceNumber(prefix: ReferencePrefix, num: number): string {
  return `${prefix}-${String(num).padStart(5, '0')}`;
}

function getUserReferencePrefix(role: string): ReferencePrefix {
  switch (role) {
    case 'admin': return 'ADM';
    case 'consultant': return 'CON';
    case 'client': return 'CLI';
    default: return 'USR';
  }
}

export type ClientUploadFolderWithMeta = ClientUploadFolder & {
  fileCount: number;
  totalSize: number;
  creatorName: string;
  allocatedClientName: string | null;
  siteName: string;
};

export type FolderAccessWithUser = ClientUploadFolderAccess & {
  userName: string;
  userEmail: string;
  userRole: string;
};

export type ClientUploadWithUploader = ClientUpload & {
  uploaderName: string;
};

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Companies
  getCompanies(): Promise<Company[]>;
  getCompaniesWithSiteCount(): Promise<CompanyWithSiteCount[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined>;
  
  // Sites
  getSites(): Promise<Site[]>;
  getSitesWithCompany(): Promise<SiteWithCompany[]>;
  getSitesWithDetails(): Promise<SiteWithDetails[]>;
  getSitesWithDetailsByCompanyId(companyId: string): Promise<SiteWithDetails[]>;
  getSite(id: string): Promise<Site | undefined>;
  getSitesByCompanyId(companyId: string): Promise<Site[]>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: string, updates: Partial<Site>): Promise<Site | undefined>;
  
  // Documents
  getDocuments(module?: ModuleType, includeArchived?: boolean): Promise<Document[]>;
  getDocument(id: string): Promise<DocumentWithDetails | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  
  // Document Versions
  getDocumentVersions(documentId: string): Promise<DocumentVersion[]>;
  createDocumentVersion(version: InsertDocumentVersion): Promise<DocumentVersion>;
  
  // Audit Logs
  getAuditLogs(documentId?: string, module?: ModuleType): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // Support Requests
  getSupportRequests(module?: ModuleType): Promise<SupportRequest[]>;
  getSupportRequest(id: string): Promise<SupportRequest | undefined>;
  createSupportRequest(request: InsertSupportRequest): Promise<SupportRequest>;
  updateSupportRequest(id: string, updates: Partial<SupportRequest>): Promise<SupportRequest | undefined>;
  clearSupportRequests(): Promise<void>;
  
  // Support Messages
  getSupportMessages(requestId: string): Promise<SupportMessage[]>;
  createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage>;
  getLatestSupportMessage(requestId: string): Promise<SupportMessage | undefined>;
  
  // Support Request Reads (for unread message tracking)
  markSupportRequestRead(requestId: string, userId: string): Promise<void>;
  getUnreadMessageCount(requestId: string, userId: string): Promise<number>;
  
  // Dashboard
  getComplianceSummary(companyId?: string, siteId?: string, module?: ModuleType): Promise<ComplianceSummary>;
  getModuleSummaries(companyId?: string, siteId?: string): Promise<ModuleSummary[]>;
  getModuleSummariesForSites(siteIds: string[]): Promise<ModuleSummary[]>;
  
  // Site Document Type Access
  getSiteDocumentTypeAccess(siteId: string, module?: ModuleType): Promise<SiteDocumentTypeAccess[]>;
  getDocumentTypesWithAccess(siteId: string, module: ModuleType): Promise<DocumentTypeWithAccess[]>;
  grantDocumentTypeAccess(access: InsertSiteDocumentTypeAccess): Promise<SiteDocumentTypeAccess>;
  revokeDocumentTypeAccess(siteId: string, documentTypeId: string): Promise<boolean>;
  
  // Cases (Employment Law)
  getCases(filters?: { siteId?: string; entityId?: string; status?: CaseStatus; includeArchived?: boolean }): Promise<Case[]>;
  getCase(id: string): Promise<Case | undefined>;
  createCase(caseData: InsertCase): Promise<Case>;
  updateCase(id: string, updates: Partial<Case>): Promise<Case | undefined>;
  archiveCase(id: string): Promise<Case | undefined>;
  unarchiveCase(id: string): Promise<Case | undefined>;
  getCaseDocuments(caseId: string): Promise<Document[]>;
  
  // Case Milestones
  getCaseMilestones(caseId: string): Promise<CaseMilestone[]>;
  getCaseMilestone(id: string): Promise<CaseMilestone | undefined>;
  createCaseMilestone(milestone: InsertCaseMilestone): Promise<CaseMilestone>;
  updateCaseMilestone(id: string, updates: Partial<CaseMilestone>): Promise<CaseMilestone | undefined>;
  deleteCaseMilestone(id: string): Promise<void>;

  // Incidents
  getIncidents(filters?: { siteId?: string; entityId?: string; status?: string; includeArchived?: boolean }): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | undefined>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | undefined>;
  getIncidentDocuments(incidentId: string): Promise<Document[]>;
  getIncidentMilestones(incidentId: string): Promise<IncidentMilestone[]>;
  createIncidentMilestone(milestone: InsertIncidentMilestone): Promise<IncidentMilestone>;
  updateIncidentMilestone(id: string, updates: Partial<IncidentMilestone>): Promise<IncidentMilestone | undefined>;
  deleteIncidentMilestone(id: string): Promise<void>;
  
  // Site Module Access (deprecated - use company-level access)
  getSiteModuleAccess(siteId: string): Promise<SiteModuleAccess[]>;
  getSiteModuleAccessByModule(siteId: string, module: ModuleType): Promise<SiteModuleAccess | undefined>;
  setSiteModuleAccess(siteId: string, module: ModuleType, status: ModuleAccessStatus, grantedBy?: string, notes?: string): Promise<SiteModuleAccess>;
  
  // Company Module Access (new - company-level module access)
  getCompanyModuleAccess(companyId: string): Promise<{ healthSafety: boolean; humanResources: boolean; employmentLaw: boolean; support: boolean; reports: boolean } | undefined>;
  setCompanyModuleAccess(companyId: string, modules: { healthSafety?: boolean; humanResources?: boolean; employmentLaw?: boolean; support?: boolean; reports?: boolean }): Promise<Company | undefined>;
  hasCompanyModuleAccess(companyId: string, module: ModuleType): Promise<boolean>;
  
  // Module Access Requests
  getModuleAccessRequests(siteId?: string, status?: ModuleAccessRequestStatus): Promise<ModuleAccessRequest[]>;
  createModuleAccessRequest(request: InsertModuleAccessRequest): Promise<ModuleAccessRequest>;
  reviewModuleAccessRequest(id: string, reviewedBy: string, reviewedByName: string, status: ModuleAccessRequestStatus, notes?: string): Promise<ModuleAccessRequest | undefined>;
  
  // Consultant Assignments
  getConsultantAssignments(siteId: string): Promise<ConsultantAssignment[]>;
  getConsultantSites(consultantId: string): Promise<ConsultantAssignment[]>;
  assignConsultant(assignment: InsertConsultantAssignment): Promise<ConsultantAssignment>;
  updateConsultantAssignment(consultantId: string, siteId: string, updates: Partial<ConsultantAssignment>): Promise<ConsultantAssignment | undefined>;
  removeConsultantAssignment(consultantId: string, siteId: string): Promise<boolean>;
  
  // Client Site Assignments
  getClientSiteAssignments(siteId: string): Promise<ClientSiteAssignment[]>;
  getClientSites(clientId: string): Promise<ClientSiteAssignment[]>;
  assignClientToSite(assignment: InsertClientSiteAssignment): Promise<ClientSiteAssignment>;
  removeClientSiteAssignment(clientId: string, siteId: string): Promise<boolean>;
  hasClientSiteAssignments(clientId: string): Promise<boolean>;
  
  // Users by Site
  getUsersBySite(siteId: string): Promise<User[]>;
  getConsultants(): Promise<User[]>;
  
  // Document Types (Admin-managed)
  getDocumentTypes(module?: ModuleType): Promise<DocumentTypeRecord[]>;
  getDocumentType(id: string): Promise<DocumentTypeRecord | undefined>;
  createDocumentType(docType: InsertDocumentType): Promise<DocumentTypeRecord>;
  updateDocumentType(id: string, updates: Partial<DocumentTypeRecord>): Promise<DocumentTypeRecord | undefined>;
  deleteDocumentType(id: string): Promise<boolean>;
  
  // Document Folders
  getDocumentFolders(siteId: string, module?: ModuleType): Promise<DocumentFolder[]>;
  getDocumentFolder(id: string): Promise<DocumentFolder | undefined>;
  createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder>;
  updateDocumentFolder(id: string, updates: Partial<DocumentFolder>): Promise<DocumentFolder | undefined>;
  deleteDocumentFolder(id: string): Promise<boolean>;
  getDocumentsByFolder(folderId: string): Promise<Document[]>;
  moveDocumentToFolder(documentId: string, folderId: string | null): Promise<Document | undefined>;
  
  // Toolkit Folders (separate from Template Library — admin-managed)
  getToolkitFolders(module?: ModuleType): Promise<ToolkitFolder[]>;
  createToolkitFolder(folder: InsertToolkitFolder): Promise<ToolkitFolder>;
  deleteToolkitFolder(id: string): Promise<boolean>;
  trackTemplateDownload(templateId: string, userId: string, userName: string, companyId?: string | null, companyName?: string | null, siteId?: string | null, siteName?: string | null): Promise<void>;
  getToolkitStats(filter?: { siteId?: string | null; siteIds?: string[] | null }): Promise<{ totalDownloads: number; downloadsLast30Days: number; recentDownloads: Array<{ id: string; templateName: string; templateId: string; downloadedAt: string; downloadedBy: string; companyName: string | null; siteName: string | null }> }>;
  
  // Folder Templates (Admin-managed master folder structure)
  getFolderTemplates(module?: ModuleType): Promise<FolderTemplate[]>;
  getFolderTemplate(id: string): Promise<FolderTemplate | undefined>;
  getFolderTemplateByToolkitFolderId(toolkitFolderId: string): Promise<FolderTemplate | undefined>;
  getModuleToolkitRootFolder(module: ModuleType): Promise<FolderTemplate | undefined>;
  createFolderTemplate(template: InsertFolderTemplate): Promise<FolderTemplate>;
  updateFolderTemplate(id: string, updates: Partial<FolderTemplate>): Promise<FolderTemplate | undefined>;
  deleteFolderTemplate(id: string): Promise<boolean>;
  
  // Folder-Document Type Rules
  getAllFolderDocumentTypeRules(): Promise<FolderDocumentTypeRule[]>;
  getFolderDocumentTypeRules(folderTemplateId: string): Promise<FolderDocumentTypeRule[]>;
  getDocumentTypeRulesForTemplate(folderTemplateId: string): Promise<(FolderDocumentTypeRule & { documentType?: DocumentTypeRecord })[]>;
  createFolderDocumentTypeRule(rule: InsertFolderDocumentTypeRule): Promise<FolderDocumentTypeRule>;
  deleteFolderDocumentTypeRule(id: string): Promise<boolean>;
  
  // Document Templates (The "Document Bible")
  getDocumentTemplates(module?: ModuleType, folderTemplateId?: string): Promise<DocumentTemplate[]>;
  getArchivedDocumentTemplates(): Promise<DocumentTemplate[]>;
  getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined>;
  createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate>;
  updateDocumentTemplate(id: string, updates: Partial<DocumentTemplate>): Promise<DocumentTemplate | undefined>;
  deleteDocumentTemplate(id: string, deletedBy: string, deletedByName: string, reason: string): Promise<boolean>;
  permanentlyDeleteDocumentTemplate(id: string, deletedBy: string, deletedByName: string, reason: string): Promise<boolean>;
  restoreDocumentTemplate(id: string, restoredBy: string): Promise<boolean>;
  
  // Document Template Versions
  getDocumentTemplateVersions(templateId: string): Promise<DocumentTemplateVersion[]>;
  createDocumentTemplateVersion(version: InsertDocumentTemplateVersion): Promise<DocumentTemplateVersion>;
  
  // Provision folder structure from templates for a site
  provisionFoldersFromTemplates(siteId: string, module: ModuleType, createdBy: string): Promise<DocumentFolder[]>;
  
  // Security - Login Attempts
  recordLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt>;
  getRecentLoginAttempts(username: string, minutes: number): Promise<LoginAttempt[]>;
  isAccountLocked(username: string): Promise<boolean>;
  
  // Training Modules (legacy alias for Training Courses)
  getTrainingModules(module?: ModuleType): Promise<TrainingModule[]>;
  getTrainingModule(id: string): Promise<TrainingModule | undefined>;
  createTrainingModule(trainingModule: InsertTrainingModule): Promise<TrainingModule>;
  updateTrainingModule(id: string, updates: Partial<TrainingModule>): Promise<TrainingModule | undefined>;
  deleteTrainingModule(id: string): Promise<boolean>;

  // Training Folders
  getTrainingFolders(module?: ModuleType): Promise<TrainingFolder[]>;
  getTrainingFolder(id: string): Promise<TrainingFolder | undefined>;
  createTrainingFolder(folder: InsertTrainingFolder): Promise<TrainingFolder>;
  updateTrainingFolder(id: string, updates: Partial<TrainingFolder>): Promise<TrainingFolder | undefined>;
  deleteTrainingFolder(id: string): Promise<boolean>;

  // Training Courses
  getTrainingCourses(module?: ModuleType, folderId?: string): Promise<TrainingCourse[]>;
  getTrainingCourse(id: string): Promise<TrainingCourse | undefined>;
  createTrainingCourse(course: InsertTrainingCourse): Promise<TrainingCourse>;
  updateTrainingCourse(id: string, updates: Partial<TrainingCourse>): Promise<TrainingCourse | undefined>;
  deleteTrainingCourse(id: string): Promise<boolean>;

  // Training Requests
  getTrainingRequests(filters?: { siteId?: string; status?: string; courseId?: string }): Promise<TrainingRequest[]>;
  getTrainingRequest(id: string): Promise<TrainingRequest | undefined>;
  createTrainingRequest(request: InsertTrainingRequest): Promise<TrainingRequest>;
  updateTrainingRequest(id: string, updates: Partial<TrainingRequest>): Promise<TrainingRequest | undefined>;
  
  // Training Bookings
  getTrainingBookings(filters?: { siteId?: string; status?: string; courseId?: string }): Promise<TrainingBooking[]>;
  getTrainingBooking(id: string): Promise<TrainingBooking | undefined>;
  createTrainingBooking(booking: InsertTrainingBooking): Promise<TrainingBooking>;
  updateTrainingBooking(id: string, updates: Partial<TrainingBooking>): Promise<TrainingBooking | undefined>;
  deleteTrainingBooking(id: string): Promise<boolean>;
  
  // Development Roadmap (Admin feature tracking)
  getRoadmapItems(): Promise<RoadmapItem[]>;
  getRoadmapItem(id: string): Promise<RoadmapItem | undefined>;
  createRoadmapItem(item: InsertRoadmapItem): Promise<RoadmapItem>;
  updateRoadmapItem(id: string, updates: Partial<RoadmapItem>): Promise<RoadmapItem | undefined>;
  deleteRoadmapItem(id: string): Promise<boolean>;

  // Feedback
  getFeedback(): Promise<Feedback[]>;
  getFeedbackItem(id: string): Promise<Feedback | undefined>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  updateFeedback(id: string, updates: Partial<Feedback>): Promise<Feedback | undefined>;
  deleteFeedback(id: string): Promise<boolean>;
  toggleFeedbackUpvote(id: string, userId: string): Promise<Feedback | undefined>;
  getFeedbackComments(feedbackId: string): Promise<FeedbackComment[]>;
  createFeedbackComment(comment: InsertFeedbackComment): Promise<FeedbackComment>;
  toggleCommentLike(commentId: string, userId: string): Promise<FeedbackComment | undefined>;
  markFeedbackRead(feedbackId: string, userId: string): Promise<void>;
  getFeedbackWithMetadata(userId: string): Promise<(Feedback & { commentCount: number; hasUnreadComments: boolean })[]>;

  // User Invitations (for secure password setup)
  getUserInvitation(id: string): Promise<UserInvitation | undefined>;
  getUserInvitationByToken(tokenHash: string): Promise<UserInvitation | undefined>;
  getUserInvitationsByUser(userId: string): Promise<UserInvitation[]>;
  createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation>;
  markInvitationUsed(id: string): Promise<UserInvitation | undefined>;
  deleteUserInvitation(id: string): Promise<boolean>;
  invalidateUserInvitations(userId: string, purpose?: InvitationPurpose): Promise<void>;
  getUserByEmail(email: string): Promise<User | undefined>;

  // Client Upload Folders
  // Extended types used by client upload methods
  getClientUploadFolders(params: { module: string; siteId?: string; userId: string; userRole: string; userCompanyId: string | null }): Promise<ClientUploadFolderWithMeta[]>;
  getClientUploadFolder(id: string): Promise<ClientUploadFolder | undefined>;
  createClientUploadFolder(data: InsertClientUploadFolder): Promise<ClientUploadFolder>;
  deleteClientUploadFolder(id: string): Promise<boolean>;
  getClientUploadFolderAccess(folderId: string): Promise<FolderAccessWithUser[]>;
  grantClientUploadFolderAccess(folderId: string, userId: string, grantedByUserId: string): Promise<void>;
  revokeClientUploadFolderAccess(folderId: string, userId: string): Promise<void>;
  getGrantableUsers(folderId: string): Promise<User[]>;
  getClientUploads(folderId: string): Promise<ClientUploadWithUploader[]>;
  getClientUpload(id: string): Promise<ClientUpload | undefined>;
  createClientUpload(data: InsertClientUpload): Promise<ClientUpload>;
  deleteClientUpload(id: string): Promise<boolean>;
  cleanupExpiredFolders(): Promise<number>;
}

export class MemStorage implements IStorage {
  // All data is now stored in the PostgreSQL database
  // Only loginAttempts is kept in-memory for rate limiting (intentionally non-persistent)
  private loginAttempts: Map<string, LoginAttempt> = new Map();
  
  // Reference number counter for users only (companies/sites use DB-based counters)
  private userCounter: number = 0;

  constructor() {
    // Ensure default admin user exists on startup
    this.initializeDefaultAdmin().catch(err => {
      console.error("Failed to initialize default admin:", err);
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
      return user;
    } catch (error) {
      console.error("Error fetching user from DB:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
      return user;
    } catch (error) {
      console.error("Error fetching user by username from DB:", error);
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(usersTable).orderBy(asc(usersTable.createdAt));
    } catch (error) {
      console.error("Error fetching all users from DB:", error);
      return [];
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const role = insertUser.role ?? "client";
      const prefix = getUserReferencePrefix(role);
      
      // Get the next reference number from the database
      const [maxRef] = await db.select({ 
        maxNum: sql<number>`COALESCE(MAX(CAST(SUBSTRING(reference_number FROM 5) AS INTEGER)), 0)` 
      }).from(usersTable).where(sql`reference_number LIKE ${prefix + '-%'}`);
      
      const nextNum = (maxRef?.maxNum ?? 0) + 1;
      const referenceNumber = formatReferenceNumber(prefix, nextNum);
      
      const [user] = await db.insert(usersTable).values({
        ...insertUser,
        referenceNumber,
        role: role as any,
        companyId: insertUser.companyId ?? null,
        status: (insertUser.status ?? "invited") as any,
        consultantTier: (insertUser.consultantTier ?? null) as any,
        clientPermissionRole: (insertUser.clientPermissionRole ?? null) as any,
      }).returning();
      
      return user;
    } catch (error) {
      console.error("Error creating user in DB:", error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    try {
      const [updatedUser] = await db.update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Error updating user in DB:", error);
      return undefined;
    }
  }

  // Sites
  async getSites(): Promise<Site[]> {
    return await db.select().from(sitesTable);
  }

  async getSitesWithDetails(): Promise<SiteWithDetails[]> {
    const sites = await db.select().from(sitesTable);
    const companies = await db.select().from(companiesTable);
    const companiesMap = new Map(companies.map(c => [c.id, c]));
    
    return Promise.all(sites.map(async (site) => {
      const summary = await this.getSiteComplianceSummary(site.id);
      const moduleAccessList = await this.getSiteModuleAccess(site.id);
      
      const moduleAccess: {
        health_safety: "active" | "visible" | "hidden";
        human_resources: "active" | "visible" | "hidden";
        employment_law: "active" | "visible" | "hidden";
        support: "active" | "visible" | "hidden";
      } = {
        health_safety: "hidden",
        human_resources: "hidden",
        employment_law: "hidden",
        support: "hidden",
      };
      
      for (const access of moduleAccessList) {
        if (access.module === "health_safety" || access.module === "human_resources" || access.module === "employment_law" || access.module === "support") {
          moduleAccess[access.module] = access.status as "active" | "visible" | "hidden";
        }
      }
      
      // Get assigned consultants
      const assignments = await this.getConsultantAssignments(site.id);
      const assignedConsultants = await Promise.all(
        assignments.map(async (assignment: ConsultantAssignment) => {
          const user = await this.getUser(assignment.consultantId);
          return {
            id: assignment.consultantId,
            name: user?.fullName || "Unknown",
            isPrimary: assignment.isPrimary,
          };
        })
      );
      
      // Get company info
      const company = companiesMap.get(site.companyId);
      
      return { 
        ...site, 
        companyName: company?.name,
        companyNumber: company?.companyNumber ?? undefined,
        companySearchTag: company?.searchTag ?? undefined,
        complianceSummary: summary, 
        moduleAccess, 
        assignedConsultants 
      };
    }));
  }

  async getSitesWithDetailsByCompanyId(companyId: string): Promise<SiteWithDetails[]> {
    // Filter sites first to avoid processing unrelated sites
    const companySites = await db.select().from(sitesTable).where(eq(sitesTable.companyId, companyId));
    const company = await this.getCompany(companyId);
    
    return Promise.all(companySites.map(async (site) => {
      const summary = await this.getSiteComplianceSummary(site.id);
      const moduleAccessList = await this.getSiteModuleAccess(site.id);
      
      const moduleAccess: {
        health_safety: "active" | "visible" | "hidden";
        human_resources: "active" | "visible" | "hidden";
        employment_law: "active" | "visible" | "hidden";
        support: "active" | "visible" | "hidden";
      } = {
        health_safety: "hidden",
        human_resources: "hidden",
        employment_law: "hidden",
        support: "hidden",
      };
      
      for (const access of moduleAccessList) {
        if (access.module === "health_safety" || access.module === "human_resources" || access.module === "employment_law" || access.module === "support") {
          moduleAccess[access.module] = access.status as "active" | "visible" | "hidden";
        }
      }
      
      const assignments = await this.getConsultantAssignments(site.id);
      const assignedConsultants = await Promise.all(
        assignments.map(async (assignment: ConsultantAssignment) => {
          const user = await this.getUser(assignment.consultantId);
          return {
            id: assignment.consultantId,
            name: user?.fullName || "Unknown",
            isPrimary: assignment.isPrimary,
          };
        })
      );
      
      return { 
        ...site, 
        companyName: company?.name,
        companyNumber: company?.companyNumber ?? undefined,
        companySearchTag: company?.searchTag ?? undefined,
        complianceSummary: summary, 
        moduleAccess, 
        assignedConsultants 
      };
    }));
  }

  async getSite(id: string): Promise<Site | undefined> {
    const results = await db.select().from(sitesTable).where(eq(sitesTable.id, id));
    return results[0];
  }

  async getSitesByCompanyId(companyId: string): Promise<Site[]> {
    return await db.select().from(sitesTable).where(eq(sitesTable.companyId, companyId));
  }

  async getSitesWithCompany(): Promise<SiteWithCompany[]> {
    const sites = await db.select().from(sitesTable);
    const companies = await db.select().from(companiesTable);
    const companiesMap = new Map(companies.map(c => [c.id, c]));
    
    return sites.map(site => {
      const company = companiesMap.get(site.companyId);
      return {
        ...site,
        companyName: company?.name,
        companyNumber: company?.companyNumber,
        companySearchTag: company?.searchTag ?? undefined,
      };
    });
  }

  async createSite(insertSite: InsertSite): Promise<Site> {
    // Get next reference number
    const existingSites = await db.select().from(sitesTable);
    const maxRef = existingSites.reduce((max, s) => {
      if (s.referenceNumber) {
        const num = parseInt(s.referenceNumber.replace('STE-', ''));
        return num > max ? num : max;
      }
      return max;
    }, 0);
    const referenceNumber = formatReferenceNumber('STE', maxRef + 1);
    
    const [site] = await db.insert(sitesTable).values({
      ...insertSite,
      referenceNumber,
    }).returning();
    return site;
  }

  async updateSite(id: string, updates: Partial<Site>): Promise<Site | undefined> {
    const [updatedSite] = await db.update(sitesTable)
      .set(updates)
      .where(eq(sitesTable.id, id))
      .returning();
    return updatedSite;
  }

  // Company CRUD
  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companiesTable);
  }

  async getCompaniesWithSiteCount(): Promise<CompanyWithSiteCount[]> {
    const companies = await db.select().from(companiesTable);
    const sites = await db.select().from(sitesTable);
    
    // Single pass to count sites per company - O(sites) instead of O(companies * sites)
    const siteCountByCompany = new Map<string, number>();
    for (const site of sites) {
      siteCountByCompany.set(site.companyId, (siteCountByCompany.get(site.companyId) || 0) + 1);
    }
    
    return companies.map(company => ({
      ...company,
      siteCount: siteCountByCompany.get(company.id) || 0
    }));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const results = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
    return results[0];
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    // Get next reference number
    const existingCompanies = await db.select().from(companiesTable);
    const maxRef = existingCompanies.reduce((max, c) => {
      if (c.referenceNumber) {
        const num = parseInt(c.referenceNumber.replace('CMP-', ''));
        return num > max ? num : max;
      }
      return max;
    }, 0);
    const referenceNumber = formatReferenceNumber('CMP', maxRef + 1);
    
    const [company] = await db.insert(companiesTable).values({
      ...insertCompany,
      referenceNumber,
      status: insertCompany.status ?? "active",
      healthSafetyAccess: insertCompany.healthSafetyAccess ?? false,
      humanResourcesAccess: insertCompany.humanResourcesAccess ?? false,
      employmentLawAccess: insertCompany.employmentLawAccess ?? false,
      supportAccess: insertCompany.supportAccess ?? false,
      reportsAccess: insertCompany.reportsAccess ?? false,
    }).returning();
    return company;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const [updatedCompany] = await db.update(companiesTable)
      .set(updates)
      .where(eq(companiesTable.id, id))
      .returning();
    return updatedCompany;
  }

  private async getSiteComplianceSummary(siteId: string): Promise<ComplianceSummary> {
    const allDocs = await db.select().from(documentsTable)
      .where(and(
        eq(documentsTable.siteId, siteId), 
        eq(documentsTable.isArchived, false),
        isNull(documentsTable.caseId) // Exclude case documents from metrics
      ));
    const docs = allDocs;
    const total = docs.length;
    const compliant = docs.filter(d => d.status === "compliant").length;
    const review = docs.filter(d => d.status === "review_required").length;
    const overdue = docs.filter(d => d.status === "overdue").length;
    const pending = docs.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;
    
    return {
      totalDocuments: total,
      compliantDocuments: compliant,
      reviewRequired: review,
      overdueDocuments: overdue,
      pendingApprovals: pending,
      awaitingYourApproval: 0,
      awaitingOthersApproval: 0,
      complianceScore: total > 0 ? Math.round((compliant / total) * 100) : 0,
    };
  }

  // Documents
  async getDocuments(module?: ModuleType, includeArchived = false): Promise<Document[]> {
    const docs = includeArchived
      ? await db.select().from(documentsTable)
      : await db.select().from(documentsTable).where(eq(documentsTable.isArchived, false));
    let filtered = docs;
    if (module) {
      filtered = docs.filter(d => d.module === module);
    }
    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getDocument(id: string): Promise<DocumentWithDetails | undefined> {
    const docs = await db.select().from(documentsTable).where(eq(documentsTable.id, id));
    const doc = docs[0];
    if (!doc) return undefined;
    
    // Get site from database
    const site = doc.siteId ? await this.getSite(doc.siteId) : undefined;
    // Get company from database
    const company = site?.companyId ? await this.getCompany(site.companyId) : undefined;
    const uploader = doc.uploadedBy ? await this.getUser(doc.uploadedBy) : undefined;
    const assignee = doc.assignedTo ? await this.getUser(doc.assignedTo) : undefined;
    const versions = await this.getDocumentVersions(id);
    
    return {
      ...doc,
      siteName: site?.name,
      companyName: company?.name,
      uploadedByName: uploader?.fullName,
      assignedToName: assignee?.fullName,
      versions,
    };
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const createdNow = new Date();
    
    // Look up the site to get the company (entity) ID
    let entityId = insertDocument.entityId;
    if (!entityId && insertDocument.siteId) {
      const site = await this.getSite(insertDocument.siteId);
      if (site) {
        entityId = site.companyId;
      }
    }
    
    if (!entityId) {
      throw new Error("entityId is required - either provide entityId or a valid siteId");
    }
    
    const docData = { 
      ...insertDocument, 
      id,
      entityId, // Company ID - required
      module: insertDocument.module as any,
      type: insertDocument.type as any,
      description: insertDocument.description ?? null,
      siteId: insertDocument.siteId ?? null,
      caseId: insertDocument.caseId ?? null,
      documentTypeId: insertDocument.documentTypeId ?? null,
      folderId: insertDocument.folderId ?? null,
      version: insertDocument.version ?? 1,
      status: (insertDocument.status ?? "review_required") as any,
      approvalStatus: (insertDocument.approvalStatus ?? "pending") as any,
      reviewDate: insertDocument.reviewDate ?? null,
      expiryDate: insertDocument.expiryDate ?? null,
      assignedTo: insertDocument.assignedTo ?? null,
      isArchived: insertDocument.isArchived ?? false,
      source: (insertDocument.source ?? "external") as any,
      templateId: insertDocument.templateId ?? null,
      templateVersion: insertDocument.templateVersion ?? null,
      createdAt: createdNow,
      updatedAt: createdNow,
    };
    const result = await db.insert(documentsTable).values(docData).returning();
    return result[0];
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const result = await db.update(documentsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documentsTable.id, id))
      .returning();
    return result[0];
  }

  async deleteDocument(id: string): Promise<boolean> {
    await db.delete(documentVersionsTable).where(eq(documentVersionsTable.documentId, id));
    const result = await db.delete(documentsTable).where(eq(documentsTable.id, id)).returning();
    return result.length > 0;
  }

  // Document Versions
  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    const versions = await db.select().from(documentVersionsTable)
      .where(eq(documentVersionsTable.documentId, documentId))
      .orderBy(desc(documentVersionsTable.version));
    return versions;
  }

  async createDocumentVersion(insertVersion: InsertDocumentVersion): Promise<DocumentVersion> {
    const id = randomUUID();
    const versionData = { 
      ...insertVersion, 
      id,
      changeNote: insertVersion.changeNote ?? null,
      createdAt: new Date(),
    };
    const result = await db.insert(documentVersionsTable).values(versionData).returning();
    return result[0];
  }

  // Audit Logs
  async getAuditLogs(documentId?: string, module?: ModuleType): Promise<AuditLog[]> {
    let logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt));
    if (documentId) {
      logs = logs.filter(log => log.documentId === documentId);
    }
    if (module) {
      logs = logs.filter(log => log.module === module);
    }
    return logs;
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const logData = { 
      ...insertLog, 
      id,
      action: insertLog.action as any,
      module: (insertLog.module ?? null) as any,
      entityId: insertLog.entityId ?? null,
      documentId: insertLog.documentId ?? null,
      caseId: insertLog.caseId ?? null,
      incidentId: (insertLog as any).incidentId ?? null,
      supportRequestId: insertLog.supportRequestId ?? null,
      details: insertLog.details ?? null,
      metadata: insertLog.metadata ?? null,
      ipAddress: insertLog.ipAddress ?? null,
      userAgent: insertLog.userAgent ?? null,
      createdAt: new Date(),
    };
    const result = await db.insert(auditLogsTable).values(logData).returning();
    return result[0];
  }

  // Support Requests - Database backed
  async getSupportRequests(module?: ModuleType): Promise<SupportRequest[]> {
    let query = db.select().from(supportRequestsTable);
    if (module) {
      const requests = await query;
      return requests
        .filter(r => r.module === module)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    const requests = await query;
    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getSupportRequest(id: string): Promise<SupportRequest | undefined> {
    const [request] = await db.select().from(supportRequestsTable).where(eq(supportRequestsTable.id, id));
    return request;
  }

  async createSupportRequest(insertRequest: InsertSupportRequest): Promise<SupportRequest> {
    const [request] = await db.insert(supportRequestsTable).values({
      ...insertRequest,
      status: insertRequest.status ?? "open",
      priority: insertRequest.priority ?? "medium",
      module: insertRequest.module ?? null,
      assignedTo: insertRequest.assignedTo ?? null,
    }).returning();
    return request;
  }

  async updateSupportRequest(id: string, updates: Partial<SupportRequest>): Promise<SupportRequest | undefined> {
    const [updated] = await db.update(supportRequestsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(supportRequestsTable.id, id))
      .returning();
    return updated;
  }

  async clearSupportRequests(): Promise<void> {
    await db.delete(supportMessagesTable);
    await db.delete(supportRequestReadsTable);
    await db.delete(supportRequestsTable);
  }

  async getSupportMessages(requestId: string): Promise<SupportMessage[]> {
    const messages = await db.select().from(supportMessagesTable)
      .where(eq(supportMessagesTable.requestId, requestId))
      .orderBy(asc(supportMessagesTable.createdAt));
    return messages;
  }

  async createSupportMessage(insertMessage: InsertSupportMessage): Promise<SupportMessage> {
    const [message] = await db.insert(supportMessagesTable).values(insertMessage).returning();
    return message;
  }

  async getLatestSupportMessage(requestId: string): Promise<SupportMessage | undefined> {
    const messages = await db.select().from(supportMessagesTable)
      .where(eq(supportMessagesTable.requestId, requestId))
      .orderBy(desc(supportMessagesTable.createdAt))
      .limit(1);
    return messages[0];
  }

  async markSupportRequestRead(requestId: string, userId: string): Promise<void> {
    // Check if record exists
    const existing = await db.select().from(supportRequestReadsTable)
      .where(and(
        eq(supportRequestReadsTable.requestId, requestId),
        eq(supportRequestReadsTable.userId, userId)
      ));
    
    if (existing.length > 0) {
      // Update existing record
      await db.update(supportRequestReadsTable)
        .set({ lastReadAt: new Date() })
        .where(and(
          eq(supportRequestReadsTable.requestId, requestId),
          eq(supportRequestReadsTable.userId, userId)
        ));
    } else {
      // Insert new record
      await db.insert(supportRequestReadsTable).values({
        requestId,
        userId,
        lastReadAt: new Date(),
      });
    }
  }

  async getUnreadMessageCount(requestId: string, userId: string): Promise<number> {
    // Get last read timestamp
    const [readRecord] = await db.select().from(supportRequestReadsTable)
      .where(and(
        eq(supportRequestReadsTable.requestId, requestId),
        eq(supportRequestReadsTable.userId, userId)
      ));
    const lastReadAt = readRecord?.lastReadAt || new Date(0);
    
    // Count messages from others after last read
    const messages = await db.select().from(supportMessagesTable)
      .where(and(
        eq(supportMessagesTable.requestId, requestId),
        gt(supportMessagesTable.createdAt, lastReadAt)
      ));
    
    // Filter out messages from the current user
    return messages.filter(m => m.senderId !== userId).length;
  }

  // Dashboard
  async getComplianceSummary(companyId?: string, siteId?: string, module?: ModuleType): Promise<ComplianceSummary> {
    let allDocs = await db.select().from(documentsTable)
      .where(and(
        eq(documentsTable.isArchived, false),
        isNull(documentsTable.caseId) // Exclude case documents from metrics
      ));
    let docs = allDocs;
    if (module) {
      docs = docs.filter(d => d.module === module);
    } else {
      // Exclude training documents from overall compliance metrics (training is tracked separately)
      docs = docs.filter(d => d.module !== "training");
    }
    if (siteId) {
      docs = docs.filter(d => d.siteId === siteId);
    } else if (companyId) {
      // Filter by company: get all sites for this company from database
      const companySites = await db.select().from(sitesTable).where(eq(sitesTable.companyId, companyId));
      const companySiteIds = companySites.map(s => s.id);
      docs = docs.filter(d => d.siteId && companySiteIds.includes(d.siteId));
    }
    const total = docs.length;
    const compliant = docs.filter(d => d.status === "compliant").length;
    const review = docs.filter(d => d.status === "review_required").length;
    const overdue = docs.filter(d => d.status === "overdue").length;
    const pending = docs.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;
    
    return {
      totalDocuments: total,
      compliantDocuments: compliant,
      reviewRequired: review,
      overdueDocuments: overdue,
      pendingApprovals: pending,
      awaitingYourApproval: 0,
      awaitingOthersApproval: 0,
      complianceScore: total > 0 ? Math.round((compliant / total) * 100) : 0,
    };
  }

  async getModuleSummaries(companyId?: string, siteId?: string): Promise<ModuleSummary[]> {
    const modules: ModuleType[] = ["health_safety", "human_resources", "employment_law", "support"];
    const moduleNames: Record<ModuleType, string> = {
      health_safety: "Health & Safety",
      human_resources: "Human Resources",
      employment_law: "Employment Law",
      support: "Support",
      reports: "Reports",
    };
    
    return Promise.all(modules.map(async (module) => {
      const summary = await this.getComplianceSummary(companyId, siteId, module);
      return {
        ...summary,
        module,
        moduleName: moduleNames[module],
      };
    }));
  }

  async getModuleSummariesForSites(siteIds: string[]): Promise<ModuleSummary[]> {
    const modules: ModuleType[] = ["health_safety", "human_resources", "employment_law", "support"];
    const moduleNames: Record<ModuleType, string> = {
      health_safety: "Health & Safety",
      human_resources: "Human Resources",
      employment_law: "Employment Law",
      support: "Support",
      reports: "Reports",
    };
    
    // Aggregate compliance summary across multiple sites
    const allDocs = await db.select().from(documentsTable)
      .where(and(
        eq(documentsTable.isArchived, false),
        isNull(documentsTable.caseId) // Exclude case documents from metrics
      ));
    
    return Promise.all(modules.map(async (module) => {
      // Get documents from all specified sites
      const docs = allDocs.filter(d => d.module === module && d.siteId && siteIds.includes(d.siteId));
      
      const total = docs.length;
      const compliant = docs.filter(d => d.status === "compliant").length;
      const review = docs.filter(d => d.status === "review_required").length;
      const overdue = docs.filter(d => d.status === "overdue").length;
      const pending = docs.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;
      
      return {
        module,
        moduleName: moduleNames[module],
        totalDocuments: total,
        compliantDocuments: compliant,
        reviewRequired: review,
        overdueDocuments: overdue,
        pendingApprovals: pending,
        awaitingYourApproval: 0,
        awaitingOthersApproval: 0,
        complianceScore: total > 0 ? Math.round((compliant / total) * 100) : 0,
      };
    }));
  }

  // Entity Document Type Access (Database-backed)
  async getSiteDocumentTypeAccess(siteId: string, module?: ModuleType): Promise<SiteDocumentTypeAccess[]> {
    const conditions = [eq(siteDocumentTypeAccessTable.siteId, siteId)];
    if (module) {
      conditions.push(eq(siteDocumentTypeAccessTable.module, module));
    }
    return await db.select().from(siteDocumentTypeAccessTable).where(and(...conditions));
  }

  async getDocumentTypesWithAccess(siteId: string, module: ModuleType): Promise<DocumentTypeWithAccess[]> {
    // Get document types from database for this module
    const allDocTypes = await this.getDocumentTypes(module);
    const masterDocTypes = allDocTypes.filter(dt => dt.isActive);
    
    const entityAccess = await this.getSiteDocumentTypeAccess(siteId, module);
    const accessibleTypeIds = new Set(entityAccess.map(a => a.documentTypeId));
    
    // Filter documents by both module AND entity
    const allDocs = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.siteId, siteId), eq(documentsTable.isArchived, false)));
    const docs = allDocs.filter(d => d.module === module);
    
    return masterDocTypes.map(dt => ({
      id: dt.id,
      code: dt.code,
      name: dt.name,
      module: dt.module as ModuleType,
      hasAccess: accessibleTypeIds.has(dt.id),
      // Count documents for this specific entity matching this document type code
      documentCount: docs.filter(d => d.type === dt.code).length,
      isRequired: dt.isRequired,
      renewalPeriodMonths: dt.renewalPeriodMonths,
    }));
  }

  async grantDocumentTypeAccess(insertAccess: InsertSiteDocumentTypeAccess): Promise<SiteDocumentTypeAccess> {
    const id = randomUUID();
    const access: SiteDocumentTypeAccess = {
      ...insertAccess,
      id,
      documentTypeId: insertAccess.documentTypeId,
      module: insertAccess.module as ModuleType,
      grantedAt: new Date(),
      grantedBy: insertAccess.grantedBy ?? null,
    };
    await db.insert(siteDocumentTypeAccessTable).values(access);
    return access;
  }

  async revokeDocumentTypeAccess(siteId: string, documentTypeId: string): Promise<boolean> {
    await db.delete(siteDocumentTypeAccessTable)
      .where(and(
        eq(siteDocumentTypeAccessTable.siteId, siteId),
        eq(siteDocumentTypeAccessTable.documentTypeId, documentTypeId)
      ));
    return true;
  }

  // Cases (Employment Law) - Database backed
  async getCases(filters?: { siteId?: string; entityId?: string; status?: CaseStatus; includeArchived?: boolean }): Promise<Case[]> {
    let allCases = await db.select().from(casesTable);
    // Filter out archived cases by default
    if (!filters?.includeArchived) {
      allCases = allCases.filter(c => !c.isArchived);
    }
    if (filters?.siteId) {
      allCases = allCases.filter(c => c.siteId === filters.siteId);
    }
    if (filters?.entityId) {
      allCases = allCases.filter(c => c.entityId === filters.entityId);
    }
    if (filters?.status) {
      allCases = allCases.filter(c => c.status === filters.status);
    }
    return allCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async archiveCase(id: string): Promise<Case | undefined> {
    const [updated] = await db.update(casesTable)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(casesTable.id, id))
      .returning();
    return updated;
  }

  async unarchiveCase(id: string): Promise<Case | undefined> {
    const [updated] = await db.update(casesTable)
      .set({ isArchived: false, updatedAt: new Date() })
      .where(eq(casesTable.id, id))
      .returning();
    return updated;
  }

  async getCase(id: string): Promise<Case | undefined> {
    const [result] = await db.select().from(casesTable).where(eq(casesTable.id, id));
    return result;
  }

  private async generateNextCaseReference(): Promise<string> {
    // Get all existing case references that match CSE-XXXXX pattern
    const allCases = await db.select({ caseReference: casesTable.caseReference }).from(casesTable);
    const csePattern = /^CSE-(\d{5})$/;
    let maxNum = 0;
    
    for (const caseItem of allCases) {
      const match = caseItem.caseReference.match(csePattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    
    const nextNum = maxNum + 1;
    return `CSE-${nextNum.toString().padStart(5, '0')}`;
  }

  async createCase(insertCase: InsertCase): Promise<Case> {
    // Auto-generate case reference
    const caseReference = await this.generateNextCaseReference();
    
    // Auto-create a standalone folder for the case documents (case-specific, not shown in main folder hierarchy)
    const folderName = `${caseReference} - ${insertCase.employeeName}`;
    const folder = await this.createDocumentFolder({
      name: folderName,
      description: `Documents for case ${caseReference}`,
      module: "employment_law",
      siteId: insertCase.siteId,
      parentId: null, // Case folders are standalone, accessed only through case detail view
      templateId: null,
      sortOrder: 0,
      createdBy: insertCase.createdBy,
    });
    
    const [newCase] = await db.insert(casesTable).values({
      ...insertCase,
      caseReference, // Use auto-generated reference
      folderId: folder.id, // Link to auto-created folder
      status: insertCase.status ?? "open",
      description: insertCase.description ?? null,
      employeeId: insertCase.employeeId ?? null,
      isConfidential: insertCase.isConfidential ?? true, // Confidential by default
      restrictedToUsers: insertCase.restrictedToUsers ?? null,
      hearingDate: insertCase.hearingDate ?? null,
      responseDeadline: insertCase.responseDeadline ?? null,
      resolutionDate: insertCase.resolutionDate ?? null,
      assignedConsultant: insertCase.assignedConsultant ?? null,
    }).returning();
    return newCase;
  }

  async updateCase(id: string, updates: Partial<Case>): Promise<Case | undefined> {
    const [updated] = await db.update(casesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(casesTable.id, id))
      .returning();
    return updated;
  }

  async getCaseDocuments(caseId: string): Promise<Document[]> {
    const docs = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.caseId, caseId), eq(documentsTable.isArchived, false)))
      .orderBy(desc(documentsTable.createdAt));
    return docs;
  }

  // Case Milestones - Database backed
  async getCaseMilestones(caseId: string): Promise<CaseMilestone[]> {
    const milestones = await db.select().from(caseMilestonesTable)
      .where(eq(caseMilestonesTable.caseId, caseId));
    return milestones.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async createCaseMilestone(insertMilestone: InsertCaseMilestone): Promise<CaseMilestone> {
    const [milestone] = await db.insert(caseMilestonesTable).values({
      ...insertMilestone,
      description: insertMilestone.description ?? null,
      dueDate: insertMilestone.dueDate ?? null,
      completedDate: insertMilestone.completedDate ?? null,
      isCompleted: insertMilestone.isCompleted ?? false,
    }).returning();
    return milestone;
  }

  async updateCaseMilestone(id: string, updates: Partial<CaseMilestone>): Promise<CaseMilestone | undefined> {
    const [updated] = await db.update(caseMilestonesTable)
      .set(updates)
      .where(eq(caseMilestonesTable.id, id))
      .returning();
    return updated;
  }

  async getCaseMilestone(id: string): Promise<CaseMilestone | undefined> {
    const [result] = await db.select().from(caseMilestonesTable).where(eq(caseMilestonesTable.id, id));
    return result;
  }

  async deleteCaseMilestone(id: string): Promise<void> {
    await db.delete(caseMilestonesTable).where(eq(caseMilestonesTable.id, id));
  }

  // Incidents - Database backed
  async getIncidents(filters?: { siteId?: string; entityId?: string; status?: string; includeArchived?: boolean }): Promise<Incident[]> {
    let all = await db.select().from(incidentsTable);
    if (!filters?.includeArchived) all = all.filter(i => !i.isArchived);
    if (filters?.siteId) all = all.filter(i => i.siteId === filters.siteId);
    if (filters?.entityId) all = all.filter(i => i.entityId === filters.entityId);
    if (filters?.status) all = all.filter(i => i.status === filters.status);
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    const [result] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, id));
    return result;
  }

  private async generateNextIncidentReference(): Promise<string> {
    const all = await db.select({ incidentReference: incidentsTable.incidentReference }).from(incidentsTable);
    const pattern = /^INC-(\d{5})$/;
    let maxNum = 0;
    for (const item of all) {
      const match = item.incidentReference.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `INC-${(maxNum + 1).toString().padStart(5, '0')}`;
  }

  async createIncident(insertIncident: InsertIncident): Promise<Incident> {
    const incidentReference = await this.generateNextIncidentReference();
    const folder = await this.createDocumentFolder({
      name: `${incidentReference} - ${insertIncident.title}`,
      description: `Documents for incident ${incidentReference}`,
      module: "health_safety",
      siteId: insertIncident.siteId,
      parentId: null,
      templateId: null,
      sortOrder: 0,
      createdBy: insertIncident.reportedBy,
    });
    const [newIncident] = await db.insert(incidentsTable).values({
      ...insertIncident,
      incidentReference,
      folderId: folder.id,
      status: insertIncident.status ?? "reported",
      injuryDetails: insertIncident.injuryDetails ?? null,
      immediateActions: insertIncident.immediateActions ?? null,
      rootCause: insertIncident.rootCause ?? null,
      correctiveActions: insertIncident.correctiveActions ?? null,
      witnesses: insertIncident.witnesses ?? null,
      locationDetails: insertIncident.locationDetails ?? null,
      assignedConsultant: insertIncident.assignedConsultant ?? null,
      resolvedAt: insertIncident.resolvedAt ?? null,
    }).returning();
    return newIncident;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | undefined> {
    const [updated] = await db.update(incidentsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(incidentsTable.id, id))
      .returning();
    return updated;
  }

  async getIncidentDocuments(incidentId: string): Promise<Document[]> {
    const docs = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.incidentId, incidentId), eq(documentsTable.isArchived, false)))
      .orderBy(desc(documentsTable.createdAt));
    return docs;
  }

  async getIncidentMilestones(incidentId: string): Promise<IncidentMilestone[]> {
    const milestones = await db.select().from(incidentMilestonesTable)
      .where(eq(incidentMilestonesTable.incidentId, incidentId));
    return milestones.sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async createIncidentMilestone(insertMilestone: InsertIncidentMilestone): Promise<IncidentMilestone> {
    const [milestone] = await db.insert(incidentMilestonesTable).values({
      ...insertMilestone,
      description: insertMilestone.description ?? null,
      dueDate: insertMilestone.dueDate ?? null,
      completedDate: insertMilestone.completedDate ?? null,
      isCompleted: insertMilestone.isCompleted ?? false,
    }).returning();
    return milestone;
  }

  async updateIncidentMilestone(id: string, updates: Partial<IncidentMilestone>): Promise<IncidentMilestone | undefined> {
    const [updated] = await db.update(incidentMilestonesTable)
      .set(updates)
      .where(eq(incidentMilestonesTable.id, id))
      .returning();
    return updated;
  }

  async deleteIncidentMilestone(id: string): Promise<void> {
    await db.delete(incidentMilestonesTable).where(eq(incidentMilestonesTable.id, id));
  }

  // Entity Module Access - Database backed
  async getSiteModuleAccess(siteId: string): Promise<SiteModuleAccess[]> {
    const results = await db.select().from(siteModuleAccessTable)
      .where(eq(siteModuleAccessTable.siteId, siteId));
    return results;
  }

  async getSiteModuleAccessByModule(siteId: string, module: ModuleType): Promise<SiteModuleAccess | undefined> {
    const [result] = await db.select().from(siteModuleAccessTable)
      .where(and(
        eq(siteModuleAccessTable.siteId, siteId),
        eq(siteModuleAccessTable.module, module)
      ));
    return result;
  }

  async setSiteModuleAccess(
    siteId: string, 
    module: ModuleType, 
    status: ModuleAccessStatus, 
    grantedBy?: string, 
    notes?: string
  ): Promise<SiteModuleAccess> {
    const existing = await this.getSiteModuleAccessByModule(siteId, module);
    const now = new Date();
    
    if (existing) {
      const [updated] = await db.update(siteModuleAccessTable)
        .set({
          status,
          grantedBy: status === "active" ? (grantedBy ?? existing.grantedBy) : existing.grantedBy,
          grantedAt: status === "active" ? now : existing.grantedAt,
          notes: notes ?? existing.notes,
          updatedAt: now,
        })
        .where(eq(siteModuleAccessTable.id, existing.id))
        .returning();
      return updated;
    } else {
      const [access] = await db.insert(siteModuleAccessTable).values({
        siteId,
        module,
        status,
        grantedBy: status === "active" ? (grantedBy ?? null) : null,
        grantedAt: status === "active" ? now : null,
        notes: notes ?? null,
      }).returning();
      return access;
    }
  }

  // Company Module Access
  async getCompanyModuleAccess(companyId: string): Promise<{ healthSafety: boolean; humanResources: boolean; employmentLaw: boolean; support: boolean; reports: boolean } | undefined> {
    const company = await this.getCompany(companyId);
    if (!company) return undefined;
    return {
      healthSafety: company.healthSafetyAccess,
      humanResources: company.humanResourcesAccess,
      employmentLaw: company.employmentLawAccess,
      support: company.supportAccess,
      reports: company.reportsAccess,
    };
  }

  async setCompanyModuleAccess(companyId: string, modules: { healthSafety?: boolean; humanResources?: boolean; employmentLaw?: boolean; support?: boolean; reports?: boolean }): Promise<Company | undefined> {
    const company = await this.getCompany(companyId);
    if (!company) return undefined;
    
    const updateData: Partial<Company> = {};
    if (modules.healthSafety !== undefined) updateData.healthSafetyAccess = modules.healthSafety;
    if (modules.humanResources !== undefined) updateData.humanResourcesAccess = modules.humanResources;
    if (modules.employmentLaw !== undefined) updateData.employmentLawAccess = modules.employmentLaw;
    if (modules.support !== undefined) updateData.supportAccess = modules.support;
    if (modules.reports !== undefined) updateData.reportsAccess = modules.reports;
    
    const [updated] = await db.update(companiesTable).set(updateData).where(eq(companiesTable.id, companyId)).returning();
    return updated;
  }

  async hasCompanyModuleAccess(companyId: string, module: ModuleType): Promise<boolean> {
    const company = await this.getCompany(companyId);
    if (!company) return false;
    
    switch (module) {
      case "health_safety":
        return company.healthSafetyAccess;
      case "human_resources":
        return company.humanResourcesAccess;
      case "employment_law":
        return company.employmentLawAccess;
      case "support":
        return company.supportAccess;
      case "reports":
        return company.reportsAccess;
      default:
        return false;
    }
  }

  // Module Access Requests (Database-backed)
  async getModuleAccessRequests(siteId?: string, status?: ModuleAccessRequestStatus): Promise<ModuleAccessRequest[]> {
    const conditions = [];
    if (siteId) {
      conditions.push(eq(moduleAccessRequestsTable.siteId, siteId));
    }
    if (status) {
      conditions.push(eq(moduleAccessRequestsTable.status, status));
    }
    
    const query = conditions.length > 0 
      ? db.select().from(moduleAccessRequestsTable).where(and(...conditions))
      : db.select().from(moduleAccessRequestsTable);
    
    return await query.orderBy(desc(moduleAccessRequestsTable.createdAt));
  }

  async createModuleAccessRequest(insertRequest: InsertModuleAccessRequest): Promise<ModuleAccessRequest> {
    const id = randomUUID();
    const request: ModuleAccessRequest = {
      ...insertRequest,
      id,
      module: insertRequest.module as ModuleType,
      reason: insertRequest.reason ?? null,
      status: "pending",
      reviewedBy: null,
      reviewedByName: null,
      reviewNotes: null,
      createdAt: new Date(),
      reviewedAt: null,
    };
    await db.insert(moduleAccessRequestsTable).values(request);
    return request;
  }

  async reviewModuleAccessRequest(
    id: string, 
    reviewedBy: string, 
    reviewedByName: string, 
    status: ModuleAccessRequestStatus, 
    notes?: string
  ): Promise<ModuleAccessRequest | undefined> {
    const [existing] = await db.select().from(moduleAccessRequestsTable)
      .where(eq(moduleAccessRequestsTable.id, id));
    if (!existing) return undefined;
    
    const [updated] = await db.update(moduleAccessRequestsTable)
      .set({
        status,
        reviewedBy,
        reviewedByName,
        reviewNotes: notes ?? null,
        reviewedAt: new Date(),
      })
      .where(eq(moduleAccessRequestsTable.id, id))
      .returning();
    
    // If approved, grant module access
    if (status === "approved") {
      await this.setSiteModuleAccess(existing.siteId, existing.module, "active", reviewedBy);
    }
    
    return updated;
  }

  // Consultant Assignments - Database backed
  async getConsultantAssignments(siteId: string): Promise<ConsultantAssignment[]> {
    const results = await db.select().from(consultantAssignmentsTable)
      .where(eq(consultantAssignmentsTable.entityId, siteId));
    return results;
  }

  async getConsultantSites(consultantId: string): Promise<ConsultantAssignment[]> {
    const results = await db.select().from(consultantAssignmentsTable)
      .where(eq(consultantAssignmentsTable.consultantId, consultantId));
    return results;
  }

  async assignConsultant(assignment: InsertConsultantAssignment): Promise<ConsultantAssignment> {
    // Use entityId for site (legacy naming from original design)
    const siteId = assignment.siteId || assignment.entityId;
    
    // Check if already assigned
    const [existing] = await db.select().from(consultantAssignmentsTable)
      .where(and(
        eq(consultantAssignmentsTable.consultantId, assignment.consultantId),
        eq(consultantAssignmentsTable.entityId, siteId)
      ));
    if (existing) {
      return existing;
    }

    const [newAssignment] = await db.insert(consultantAssignmentsTable).values({
      consultantId: assignment.consultantId,
      entityId: siteId, // Main site ID field
      siteId: siteId, // Also populate for compatibility
      isPrimary: assignment.isPrimary ?? false,
      canManageModules: assignment.canManageModules ?? false,
    }).returning();
    return newAssignment;
  }

  async updateConsultantAssignment(consultantId: string, siteId: string, updates: Partial<ConsultantAssignment>): Promise<ConsultantAssignment | undefined> {
    const [updated] = await db.update(consultantAssignmentsTable)
      .set(updates)
      .where(and(
        eq(consultantAssignmentsTable.consultantId, consultantId),
        eq(consultantAssignmentsTable.entityId, siteId)
      ))
      .returning();
    return updated;
  }

  async removeConsultantAssignment(consultantId: string, siteId: string): Promise<boolean> {
    const result = await db.delete(consultantAssignmentsTable)
      .where(and(
        eq(consultantAssignmentsTable.consultantId, consultantId),
        eq(consultantAssignmentsTable.entityId, siteId)
      ))
      .returning();
    return result.length > 0;
  }

  // Client Site Assignments (database-backed)
  async getClientSiteAssignments(siteId: string): Promise<ClientSiteAssignment[]> {
    return await db.select().from(clientSiteAssignmentsTable)
      .where(eq(clientSiteAssignmentsTable.siteId, siteId));
  }

  async getClientSites(clientId: string): Promise<ClientSiteAssignment[]> {
    return await db.select().from(clientSiteAssignmentsTable)
      .where(eq(clientSiteAssignmentsTable.clientId, clientId));
  }

  async assignClientToSite(assignment: InsertClientSiteAssignment): Promise<ClientSiteAssignment> {
    // Check if already assigned
    const existing = await db.select().from(clientSiteAssignmentsTable)
      .where(and(
        eq(clientSiteAssignmentsTable.clientId, assignment.clientId),
        eq(clientSiteAssignmentsTable.siteId, assignment.siteId)
      ));
    if (existing.length > 0) {
      return existing[0];
    }
    const result = await db.insert(clientSiteAssignmentsTable).values({
      clientId: assignment.clientId,
      siteId: assignment.siteId,
      assignedBy: assignment.assignedBy,
    }).returning();
    return result[0];
  }

  async removeClientSiteAssignment(clientId: string, siteId: string): Promise<boolean> {
    await db.delete(clientSiteAssignmentsTable)
      .where(and(
        eq(clientSiteAssignmentsTable.clientId, clientId),
        eq(clientSiteAssignmentsTable.siteId, siteId)
      ));
    return true;
  }

  async hasClientSiteAssignments(clientId: string): Promise<boolean> {
    const result = await db.select().from(clientSiteAssignmentsTable)
      .where(eq(clientSiteAssignmentsTable.clientId, clientId));
    return result.length > 0;
  }

  // Users by Company (get all users associated with a company)
  async getUsersBySite(siteId: string): Promise<User[]> {
    try {
      // First get the site from database to find its company
      const site = await this.getSite(siteId);
      if (!site) return [];
      // Return users that have access to this company
      return await db.select().from(usersTable).where(eq(usersTable.companyId, site.companyId));
    } catch (error) {
      console.error("Error fetching users by site from DB:", error);
      return [];
    }
  }

  async getConsultants(): Promise<User[]> {
    try {
      return await db.select().from(usersTable).where(eq(usersTable.role, "consultant"));
    } catch (error) {
      console.error("Error fetching consultants from DB:", error);
      return [];
    }
  }

  // Document Types (Admin-managed - Database-backed)
  async getDocumentTypes(module?: ModuleType): Promise<DocumentTypeRecord[]> {
    let query = db.select().from(documentTypes);
    if (module) {
      query = query.where(eq(documentTypes.module, module)) as typeof query;
    }
    return await query.orderBy(asc(documentTypes.sortOrder));
  }

  async getDocumentType(id: string): Promise<DocumentTypeRecord | undefined> {
    const [docType] = await db.select().from(documentTypes).where(eq(documentTypes.id, id));
    return docType;
  }

  private async generateNextTemplateCode(): Promise<string> {
    // Get all existing template/doc type codes that match TPL-XXXXX pattern
    const allDocTypes = await this.getDocumentTypes();
    const tplPattern = /^TPL-(\d{5})$/;
    let maxNum = 0;
    
    for (const docType of allDocTypes) {
      const match = docType.code.match(tplPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    
    const nextNum = maxNum + 1;
    return `TPL-${nextNum.toString().padStart(5, '0')}`;
  }

  async createDocumentType(docType: InsertDocumentType): Promise<DocumentTypeRecord> {
    const id = randomUUID();
    const now = new Date();
    // Auto-generate the template code
    const code = await this.generateNextTemplateCode();
    const newDocType: DocumentTypeRecord = {
      id,
      name: docType.name,
      code,
      module: docType.module as ModuleType,
      description: docType.description ?? null,
      isRequired: docType.isRequired ?? false,
      renewalPeriodMonths: docType.renewalPeriodMonths ?? null,
      sortOrder: docType.sortOrder ?? 0,
      isActive: docType.isActive ?? true,
      createdBy: docType.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.insert(documentTypes).values(newDocType);
    return newDocType;
  }

  async updateDocumentType(id: string, updates: Partial<DocumentTypeRecord>): Promise<DocumentTypeRecord | undefined> {
    const [existing] = await db.select().from(documentTypes).where(eq(documentTypes.id, id));
    if (!existing) return undefined;
    
    const [updated] = await db.update(documentTypes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documentTypes.id, id))
      .returning();
    return updated;
  }

  async deleteDocumentType(id: string): Promise<boolean> {
    await db.delete(documentTypes).where(eq(documentTypes.id, id));
    return true;
  }

  // Document Folders
  async getDocumentFolders(siteId: string, module?: ModuleType): Promise<DocumentFolder[]> {
    let folders = await db.select().from(documentFoldersTable)
      .where(eq(documentFoldersTable.siteId, siteId))
      .orderBy(asc(documentFoldersTable.sortOrder));
    if (module) {
      folders = folders.filter(f => f.module === module);
    }
    return folders;
  }

  async getDocumentFolder(id: string): Promise<DocumentFolder | undefined> {
    const folders = await db.select().from(documentFoldersTable)
      .where(eq(documentFoldersTable.id, id));
    return folders[0];
  }

  async createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder> {
    const id = randomUUID();
    const now = new Date();
    const folderData = {
      id,
      name: folder.name,
      description: folder.description ?? null,
      module: folder.module as ModuleType,
      siteId: folder.siteId,
      parentId: folder.parentId ?? null,
      templateId: folder.templateId ?? null,
      sortOrder: folder.sortOrder ?? 0,
      createdBy: folder.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.insert(documentFoldersTable).values(folderData).returning();
    return result[0];
  }

  async updateDocumentFolder(id: string, updates: Partial<DocumentFolder>): Promise<DocumentFolder | undefined> {
    const result = await db.update(documentFoldersTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documentFoldersTable.id, id))
      .returning();
    return result[0];
  }

  async deleteDocumentFolder(id: string): Promise<boolean> {
    // Move all documents in this folder to no folder
    await db.update(documentsTable)
      .set({ folderId: null })
      .where(eq(documentsTable.folderId, id));
    
    // Delete child folders recursively
    const childFolders = await db.select().from(documentFoldersTable)
      .where(eq(documentFoldersTable.parentId, id));
    for (const folder of childFolders) {
      await this.deleteDocumentFolder(folder.id);
    }
    
    const result = await db.delete(documentFoldersTable).where(eq(documentFoldersTable.id, id));
    return true;
  }

  async getDocumentsByFolder(folderId: string): Promise<Document[]> {
    return await db.select().from(documentsTable)
      .where(eq(documentsTable.folderId, folderId));
  }

  async moveDocumentToFolder(documentId: string, folderId: string | null): Promise<Document | undefined> {
    const result = await db.update(documentsTable)
      .set({ folderId, updatedAt: new Date() })
      .where(eq(documentsTable.id, documentId))
      .returning();
    return result[0];
  }

  // Toolkit Folders (separate from Template Library — admin-managed)
  async getToolkitFolders(module?: ModuleType): Promise<ToolkitFolder[]> {
    let query = db.select().from(toolkitFoldersTable);
    if (module) {
      query = query.where(eq(toolkitFoldersTable.module, module)) as typeof query;
    }
    return await query.orderBy(asc(toolkitFoldersTable.sortOrder), asc(toolkitFoldersTable.createdAt));
  }

  async createToolkitFolder(folder: InsertToolkitFolder): Promise<ToolkitFolder> {
    const [result] = await db.insert(toolkitFoldersTable).values(folder).returning();
    return result;
  }

  async deleteToolkitFolder(id: string): Promise<boolean> {
    // Unassign any templates from this folder before deleting
    await db
      .update(documentTemplatesTable)
      .set({ toolkitFolderId: null })
      .where(eq(documentTemplatesTable.toolkitFolderId, id));
    const result = await db.delete(toolkitFoldersTable).where(eq(toolkitFoldersTable.id, id)).returning();
    return result.length > 0;
  }

  async trackTemplateDownload(templateId: string, userId: string, userName: string, companyId?: string | null, companyName?: string | null, siteId?: string | null, siteName?: string | null): Promise<void> {
    await db.insert(toolkitDownloadsTable).values({
      templateId,
      userId,
      userName,
      companyId: companyId ?? null,
      companyName: companyName ?? null,
      siteId: siteId ?? null,
      siteName: siteName ?? null,
      downloadedAt: new Date(),
    });
  }

  async getToolkitStats(filter?: { siteId?: string | null; siteIds?: string[] | null }) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const buildWhere = (extra?: any) => {
      const conditions = [];
      if (filter?.siteId) {
        conditions.push(eq(toolkitDownloadsTable.siteId, filter.siteId));
      } else if (filter?.siteIds && filter.siteIds.length > 0) {
        conditions.push(sql`${toolkitDownloadsTable.siteId} = ANY(${filter.siteIds})`);
      }
      if (extra) conditions.push(extra);
      return conditions.length > 0 ? and(...conditions) : undefined;
    };

    const totalWhere = buildWhere();
    const last30Where = buildWhere(gt(toolkitDownloadsTable.downloadedAt, thirtyDaysAgo));

    const [totalRow] = await db
      .select({ count: count() })
      .from(toolkitDownloadsTable)
      .where(totalWhere);
    const [last30Row] = await db
      .select({ count: count() })
      .from(toolkitDownloadsTable)
      .where(last30Where);

    const recentQuery = db
      .select({
        id: toolkitDownloadsTable.id,
        templateName: documentTemplatesTable.name,
        templateId: toolkitDownloadsTable.templateId,
        downloadedAt: toolkitDownloadsTable.downloadedAt,
        downloadedBy: toolkitDownloadsTable.userName,
        companyName: toolkitDownloadsTable.companyName,
        siteName: toolkitDownloadsTable.siteName,
      })
      .from(toolkitDownloadsTable)
      .leftJoin(documentTemplatesTable, eq(documentTemplatesTable.id, toolkitDownloadsTable.templateId))
      .orderBy(desc(toolkitDownloadsTable.downloadedAt))
      .limit(10);

    const recentDownloads = totalWhere
      ? await recentQuery.where(totalWhere)
      : await recentQuery;

    return {
      totalDownloads: totalRow?.count ?? 0,
      downloadsLast30Days: last30Row?.count ?? 0,
      recentDownloads: recentDownloads.map(r => ({
        id: r.id,
        templateName: r.templateName ?? 'Unknown',
        templateId: r.templateId,
        downloadedAt: r.downloadedAt?.toISOString() ?? new Date().toISOString(),
        downloadedBy: r.downloadedBy,
        companyName: r.companyName ?? null,
        siteName: r.siteName ?? null,
      })),
    };
  }

  // Folder Templates (Admin-managed master folder structure - Database-backed)
  async getFolderTemplates(module?: ModuleType): Promise<FolderTemplate[]> {
    let query = db.select().from(folderTemplatesTable);
    if (module) {
      query = query.where(eq(folderTemplatesTable.module, module)) as typeof query;
    }
    return await query.orderBy(asc(folderTemplatesTable.sortOrder));
  }

  async getFolderTemplate(id: string): Promise<FolderTemplate | undefined> {
    const [template] = await db.select().from(folderTemplatesTable).where(eq(folderTemplatesTable.id, id));
    return template;
  }

  async getFolderTemplateByToolkitFolderId(toolkitFolderId: string): Promise<FolderTemplate | undefined> {
    const [template] = await db.select().from(folderTemplatesTable)
      .where(eq(folderTemplatesTable.toolkitFolderId, toolkitFolderId));
    return template;
  }

  async getModuleToolkitRootFolder(module: ModuleType): Promise<FolderTemplate | undefined> {
    const [folder] = await db.select().from(folderTemplatesTable)
      .where(
        and(
          eq(folderTemplatesTable.module, module),
          eq(folderTemplatesTable.isLocked, true),
          eq(folderTemplatesTable.name, "Toolkit"),
          isNull(folderTemplatesTable.parentId)
        )
      );
    return folder;
  }

  private async generateNextFolderCode(): Promise<string> {
    // Get all existing folder codes that match FLD-XXXXX pattern
    const allFolders = await this.getFolderTemplates();
    const fldPattern = /^FLD-(\d{5})$/;
    let maxNum = 0;
    
    for (const folder of allFolders) {
      const match = folder.code.match(fldPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    
    const nextNum = maxNum + 1;
    return `FLD-${nextNum.toString().padStart(5, '0')}`;
  }

  async createFolderTemplate(template: InsertFolderTemplate): Promise<FolderTemplate> {
    const id = randomUUID();
    const now = new Date();
    // Auto-generate the folder code
    const code = await this.generateNextFolderCode();
    const newTemplate: FolderTemplate = {
      id,
      name: template.name,
      code,
      module: template.module as ModuleType,
      description: template.description ?? null,
      parentId: template.parentId ?? null,
      isRequired: template.isRequired ?? false,
      sortOrder: template.sortOrder ?? 0,
      isActive: template.isActive ?? true,
      isLocked: (template as any).isLocked ?? false,
      toolkitFolderId: (template as any).toolkitFolderId ?? null,
      createdBy: template.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    
    const [inserted] = await db.insert(folderTemplatesTable).values(newTemplate).returning();
    return inserted;
  }

  async updateFolderTemplate(id: string, updates: Partial<FolderTemplate>): Promise<FolderTemplate | undefined> {
    const [updated] = await db.update(folderTemplatesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(folderTemplatesTable.id, id))
      .returning();
    return updated;
  }

  async deleteFolderTemplate(id: string): Promise<boolean> {
    // First remove any rules associated with this folder
    await db.delete(folderDocumentTypeRulesTable).where(eq(folderDocumentTypeRulesTable.folderTemplateId, id));
    
    // Unassign any document templates that reference this folder (set to null so they appear as Unassigned)
    await db.update(documentTemplatesTable)
      .set({ folderTemplateId: null, updatedAt: new Date() })
      .where(eq(documentTemplatesTable.folderTemplateId, id));
    
    // Delete child folders recursively (this will also unassign their templates)
    const children = await db.select().from(folderTemplatesTable).where(eq(folderTemplatesTable.parentId, id));
    for (const child of children) {
      await this.deleteFolderTemplate(child.id);
    }
    
    // Delete the folder
    await db.delete(folderTemplatesTable).where(eq(folderTemplatesTable.id, id));
    return true;
  }

  // Folder-Document Type Rules (Database-backed)
  async getAllFolderDocumentTypeRules(): Promise<FolderDocumentTypeRule[]> {
    return await db.select().from(folderDocumentTypeRulesTable).orderBy(asc(folderDocumentTypeRulesTable.sortOrder));
  }

  async getFolderDocumentTypeRules(folderTemplateId: string): Promise<FolderDocumentTypeRule[]> {
    return await db.select().from(folderDocumentTypeRulesTable)
      .where(eq(folderDocumentTypeRulesTable.folderTemplateId, folderTemplateId))
      .orderBy(asc(folderDocumentTypeRulesTable.sortOrder));
  }

  async getDocumentTypeRulesForTemplate(folderTemplateId: string): Promise<(FolderDocumentTypeRule & { documentType?: DocumentTypeRecord })[]> {
    const rules = await this.getFolderDocumentTypeRules(folderTemplateId);
    const result: (FolderDocumentTypeRule & { documentType?: DocumentTypeRecord })[] = [];
    for (const rule of rules) {
      const documentType = await this.getDocumentType(rule.documentTypeId);
      result.push({ ...rule, documentType });
    }
    return result;
  }

  async createFolderDocumentTypeRule(rule: InsertFolderDocumentTypeRule): Promise<FolderDocumentTypeRule> {
    const id = randomUUID();
    const now = new Date();
    const newRule: FolderDocumentTypeRule = {
      id,
      folderTemplateId: rule.folderTemplateId,
      documentTypeId: rule.documentTypeId,
      isRequired: rule.isRequired ?? false,
      sortOrder: rule.sortOrder ?? 0,
      createdBy: rule.createdBy,
      createdAt: now,
    };
    
    const [inserted] = await db.insert(folderDocumentTypeRulesTable).values(newRule).returning();
    return inserted;
  }

  async deleteFolderDocumentTypeRule(id: string): Promise<boolean> {
    await db.delete(folderDocumentTypeRulesTable).where(eq(folderDocumentTypeRulesTable.id, id));
    return true;
  }

  // ============================================
  // DOCUMENT TEMPLATES (The "Document Bible")
  // ============================================
  
  async getDocumentTemplates(module?: ModuleType, folderTemplateId?: string): Promise<DocumentTemplate[]> {
    let query = db.select().from(documentTemplatesTable);
    const conditions = [];
    if (module) {
      conditions.push(eq(documentTemplatesTable.module, module));
    }
    if (folderTemplateId) {
      conditions.push(eq(documentTemplatesTable.folderTemplateId, folderTemplateId));
    }
    conditions.push(eq(documentTemplatesTable.isActive, true));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    const templates = await query.orderBy(asc(documentTemplatesTable.sortOrder));
    return templates;
  }
  
  async getArchivedDocumentTemplates(): Promise<DocumentTemplate[]> {
    return await db.select().from(documentTemplatesTable)
      .where(eq(documentTemplatesTable.isActive, false))
      .orderBy(asc(documentTemplatesTable.sortOrder));
  }
  
  async restoreDocumentTemplate(id: string, restoredBy: string): Promise<boolean> {
    const [existing] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id));
    
    const restoreData = {
      isActive: true,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      updatedAt: new Date(),
    };
    
    await db.update(documentTemplatesTable).set(restoreData).where(eq(documentTemplatesTable.id, id));
    
    // Log to audit trail
    await this.createAuditLog({
      userId: restoredBy,
      action: 'template_restored',
      entityType: 'document_template',
      entityId: id,
      details: JSON.stringify({ 
        templateName: existing?.name || 'Unknown',
      }),
    });
    
    return true;
  }
  
  async getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined> {
    const [template] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id));
    return template;
  }
  
  async createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate> {
    const id = randomUUID();
    const now = new Date();
    const newTemplate: DocumentTemplate = {
      id,
      name: template.name,
      description: template.description ?? null,
      module: template.module,
      folderTemplateId: template.folderTemplateId,
      toolkitFolderId: template.toolkitFolderId ?? null,
      documentTypeId: template.documentTypeId ?? null,
      fileName: template.fileName,
      fileUrl: template.fileUrl ?? null,
      fileSize: template.fileSize,
      mimeType: template.mimeType,
      version: template.version ?? 1,
      placeholders: template.placeholders ?? null,
      isRequired: template.isRequired ?? false,
      renewalPeriodMonths: template.renewalPeriodMonths ?? null,
      requiresApproval: template.requiresApproval ?? true,
      visibility: template.visibility ?? "public",
      isActive: template.isActive ?? true,
      sortOrder: template.sortOrder ?? 0,
      createdBy: template.createdBy,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
    };
    
    // Persist to database
    const [inserted] = await db.insert(documentTemplatesTable).values(newTemplate).returning();
    
    // Create initial version
    await this.createDocumentTemplateVersion({
      templateId: inserted.id,
      version: 1,
      fileName: template.fileName,
      fileUrl: template.fileUrl,
      fileSize: template.fileSize,
      mimeType: template.mimeType,
      changeNote: "Initial version",
      uploadedBy: template.createdBy,
    });
    
    return inserted;
  }
  
  async updateDocumentTemplate(id: string, updates: Partial<DocumentTemplate>): Promise<DocumentTemplate | undefined> {
    // Always fetch from database first to ensure we have latest data
    const [dbTemplate] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id));
    if (!dbTemplate) return undefined;
    
    // Build the update object - only include fields that are explicitly defined (not undefined)
    // This prevents accidental nullification of fields not being updated
    const updateData: Record<string, any> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }
    
    // Persist to database
    const [updated] = await db.update(documentTemplatesTable)
      .set(updateData)
      .where(eq(documentTemplatesTable.id, id))
      .returning();
    
    return updated;
  }
  
  async deleteDocumentTemplate(id: string, deletedBy: string, deletedByName: string, reason: string): Promise<boolean> {
    // Get existing template for audit log
    const [existing] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id));
    
    // Soft delete - mark as inactive with audit info
    const deletionData = {
      isActive: false,
      deletedAt: new Date(),
      deletedBy: deletedBy,
      deletionReason: reason,
      updatedAt: new Date(),
    };
    
    await db.update(documentTemplatesTable).set(deletionData).where(eq(documentTemplatesTable.id, id));
    
    // Log to audit trail
    await this.createAuditLog({
      userId: deletedBy,
      userName: deletedByName,
      action: 'template_deleted',
      entityType: 'document_template',
      entityId: id,
      details: JSON.stringify({ 
        templateName: existing?.name || 'Unknown',
        reason: reason 
      }),
    });
    
    return true;
  }

  async permanentlyDeleteDocumentTemplate(id: string, deletedBy: string, deletedByName: string, reason: string): Promise<boolean> {
    const [existing] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id));

    // Hard delete versions first, then the template
    await db.delete(documentTemplateVersionsTable).where(eq(documentTemplateVersionsTable.templateId, id));
    await db.delete(documentTemplatesTable).where(eq(documentTemplatesTable.id, id));

    await this.createAuditLog({
      userId: deletedBy,
      userName: deletedByName,
      action: 'template_permanently_deleted',
      entityType: 'document_template',
      entityId: id,
      details: JSON.stringify({
        templateName: existing?.name || 'Unknown',
        reason: reason,
      }),
    });

    return true;
  }
  
  // Document Template Versions (database-backed)
  async getDocumentTemplateVersions(templateId: string): Promise<DocumentTemplateVersion[]> {
    const versions = await db.select().from(documentTemplateVersionsTable)
      .where(eq(documentTemplateVersionsTable.templateId, templateId));
    return versions.sort((a, b) => b.version - a.version);
  }
  
  async createDocumentTemplateVersion(version: InsertDocumentTemplateVersion): Promise<DocumentTemplateVersion> {
    const id = randomUUID();
    const newVersion: DocumentTemplateVersion = {
      id,
      templateId: version.templateId,
      version: version.version,
      fileName: version.fileName,
      fileUrl: version.fileUrl ?? null,
      fileSize: version.fileSize,
      mimeType: version.mimeType ?? null,
      changeNote: version.changeNote ?? null,
      uploadedBy: version.uploadedBy,
      createdAt: new Date(),
    };
    
    // Persist to database
    const [inserted] = await db.insert(documentTemplateVersionsTable).values(newVersion).returning();
    return inserted;
  }

  // Provision folder structure from templates for a site
  async provisionFoldersFromTemplates(siteId: string, module: ModuleType, createdBy: string): Promise<DocumentFolder[]> {
    const templates = await this.getFolderTemplates(module);
    const activeTemplates = templates.filter(t => t.isActive);
    const createdFolders: DocumentFolder[] = [];
    const templateIdToFolderId = new Map<string, string>();

    // Recursive helper to create folders and their children
    const createFolderWithChildren = async (
      template: FolderTemplate, 
      parentFolderId: string | undefined
    ): Promise<void> => {
      const folder = await this.createDocumentFolder({
        name: template.name,
        description: template.description ?? undefined,
        module: template.module,
        siteId,
        parentId: parentFolderId,
        templateId: template.id,
        sortOrder: template.sortOrder,
        createdBy,
      });
      templateIdToFolderId.set(template.id, folder.id);
      createdFolders.push(folder);

      // Find and create all children of this template
      const children = activeTemplates.filter(t => t.parentId === template.id);
      for (const child of children.sort((a, b) => a.sortOrder - b.sortOrder)) {
        await createFolderWithChildren(child, folder.id);
      }
    };

    // Start with root templates (no parent)
    const rootTemplates = activeTemplates.filter(t => !t.parentId);
    for (const template of rootTemplates.sort((a, b) => a.sortOrder - b.sortOrder)) {
      await createFolderWithChildren(template, undefined);
    }

    return createdFolders;
  }
  
  // ============================================
  // SECURITY - LOGIN ATTEMPTS (In-memory for rate limiting)
  // ============================================
  
  async recordLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt> {
    const id = randomUUID();
    const loginAttempt: LoginAttempt = {
      id,
      username: attempt.username,
      ipAddress: attempt.ipAddress ?? null,
      userAgent: attempt.userAgent ?? null,
      success: attempt.success ?? false,
      failureReason: attempt.failureReason ?? null,
      attemptedAt: new Date(),
    };
    this.loginAttempts.set(id, loginAttempt);
    return loginAttempt;
  }
  
  async getRecentLoginAttempts(username: string, minutes: number): Promise<LoginAttempt[]> {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return Array.from(this.loginAttempts.values())
      .filter(attempt => 
        attempt.username.toLowerCase() === username.toLowerCase() &&
        attempt.attemptedAt >= cutoffTime
      )
      .sort((a, b) => b.attemptedAt.getTime() - a.attemptedAt.getTime());
  }
  
  async isAccountLocked(username: string): Promise<boolean> {
    const recentAttempts = await this.getRecentLoginAttempts(
      username, 
      SECURITY_CONFIG.lockoutDurationMinutes
    );
    
    // Count consecutive failures (until last success)
    let failedAttempts = 0;
    for (const attempt of recentAttempts) {
      if (attempt.success) break;
      failedAttempts++;
    }
    
    return failedAttempts >= SECURITY_CONFIG.maxLoginAttempts;
  }

  // Training Modules
  async getTrainingModules(module?: ModuleType): Promise<TrainingModule[]> {
    try {
      if (module) {
        const results = await db.select().from(trainingModulesTable)
          .where(and(
            eq(trainingModulesTable.module, module),
            eq(trainingModulesTable.isActive, true)
          ))
          .orderBy(asc(trainingModulesTable.sortOrder));
        return results;
      }
      const results = await db.select().from(trainingModulesTable)
        .where(eq(trainingModulesTable.isActive, true))
        .orderBy(asc(trainingModulesTable.sortOrder));
      return results;
    } catch (error) {
      console.error("Database error in getTrainingModules:", error);
      return [];
    }
  }

  async getTrainingModule(id: string): Promise<TrainingModule | undefined> {
    const results = await db.select().from(trainingModulesTable)
      .where(eq(trainingModulesTable.id, id));
    return results[0];
  }

  async createTrainingModule(trainingModule: InsertTrainingModule): Promise<TrainingModule> {
    const now = new Date();
    const results = await db.insert(trainingModulesTable)
      .values({
        ...trainingModule,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return results[0];
  }

  async updateTrainingModule(id: string, updates: Partial<TrainingModule>): Promise<TrainingModule | undefined> {
    const now = new Date();
    const results = await db.update(trainingModulesTable)
      .set({ ...updates, updatedAt: now })
      .where(eq(trainingModulesTable.id, id))
      .returning();
    return results[0];
  }

  async deleteTrainingModule(id: string): Promise<boolean> {
    // Soft delete - just mark as inactive
    const results = await db.update(trainingModulesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(trainingModulesTable.id, id))
      .returning();
    return results.length > 0;
  }

  // Training Folders
  async getTrainingFolders(module?: ModuleType): Promise<TrainingFolder[]> {
    try {
      if (module) {
        const results = await db.select().from(trainingFoldersTable)
          .where(and(
            eq(trainingFoldersTable.module, module),
            eq(trainingFoldersTable.isActive, true)
          ))
          .orderBy(asc(trainingFoldersTable.sortOrder));
        return results;
      }
      const results = await db.select().from(trainingFoldersTable)
        .where(eq(trainingFoldersTable.isActive, true))
        .orderBy(asc(trainingFoldersTable.sortOrder));
      return results;
    } catch (error) {
      console.error("Database error in getTrainingFolders:", error);
      return [];
    }
  }

  async getTrainingFolder(id: string): Promise<TrainingFolder | undefined> {
    try {
      const results = await db.select().from(trainingFoldersTable)
        .where(eq(trainingFoldersTable.id, id));
      return results[0];
    } catch (error) {
      console.error("Database error in getTrainingFolder:", error);
      return undefined;
    }
  }

  async createTrainingFolder(folder: InsertTrainingFolder): Promise<TrainingFolder> {
    const now = new Date();
    try {
      const results = await db.insert(trainingFoldersTable)
        .values({
          ...folder,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return results[0];
    } catch (error) {
      console.error("Database error in createTrainingFolder:", error);
      const id = `training-folder-${randomUUID()}`;
      const newFolder: TrainingFolder = {
        id,
        name: folder.name,
        description: folder.description || null,
        module: folder.module,
        sortOrder: folder.sortOrder || 0,
        isActive: folder.isActive ?? true,
        createdBy: folder.createdBy,
        createdAt: now,
        updatedAt: now,
      };
      return newFolder;
    }
  }

  async updateTrainingFolder(id: string, updates: Partial<TrainingFolder>): Promise<TrainingFolder | undefined> {
    const now = new Date();
    try {
      const results = await db.update(trainingFoldersTable)
        .set({ ...updates, updatedAt: now })
        .where(eq(trainingFoldersTable.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error("Database error in updateTrainingFolder:", error);
      return undefined;
    }
  }

  async deleteTrainingFolder(id: string): Promise<boolean> {
    try {
      const results = await db.update(trainingFoldersTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(trainingFoldersTable.id, id))
        .returning();
      return results.length > 0;
    } catch (error) {
      console.error("Database error in deleteTrainingFolder:", error);
      return false;
    }
  }

  // Training Courses
  async getTrainingCourses(module?: ModuleType, folderId?: string): Promise<TrainingCourse[]> {
    try {
      let conditions = [eq(trainingCoursesTable.isActive, true)];
      if (module) {
        conditions.push(eq(trainingCoursesTable.module, module));
      }
      if (folderId) {
        conditions.push(eq(trainingCoursesTable.trainingFolderId, folderId));
      }
      const results = await db.select().from(trainingCoursesTable)
        .where(and(...conditions))
        .orderBy(asc(trainingCoursesTable.sortOrder));
      return results;
    } catch (error) {
      console.error("Database error in getTrainingCourses:", error);
      return [];
    }
  }

  async getTrainingCourse(id: string): Promise<TrainingCourse | undefined> {
    try {
      const results = await db.select().from(trainingCoursesTable)
        .where(eq(trainingCoursesTable.id, id));
      return results[0];
    } catch (error) {
      console.error("Database error in getTrainingCourse:", error);
      return undefined;
    }
  }

  async createTrainingCourse(course: InsertTrainingCourse): Promise<TrainingCourse> {
    const now = new Date();
    try {
      const results = await db.insert(trainingCoursesTable)
        .values({
          ...course,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return results[0];
    } catch (error) {
      console.error("Database error in createTrainingCourse:", error);
      const id = `training-course-${randomUUID()}`;
      const newCourse: TrainingCourse = {
        id,
        title: course.title,
        summary: course.summary || null,
        module: course.module,
        trainingFolderId: course.trainingFolderId || null,
        provider: course.provider || null,
        externalLink: course.externalLink || null,
        duration: course.duration || null,
        courseOverview: course.courseOverview || null,
        faqs: course.faqs || null,
        isRequired: course.isRequired ?? false,
        renewalPeriodMonths: course.renewalPeriodMonths || null,
        sortOrder: course.sortOrder || 0,
        isActive: course.isActive ?? true,
        createdBy: course.createdBy,
        createdAt: now,
        updatedAt: now,
      };
      return newCourse;
    }
  }

  async updateTrainingCourse(id: string, updates: Partial<TrainingCourse>): Promise<TrainingCourse | undefined> {
    const now = new Date();
    try {
      const results = await db.update(trainingCoursesTable)
        .set({ ...updates, updatedAt: now })
        .where(eq(trainingCoursesTable.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error("Database error in updateTrainingCourse:", error);
      return undefined;
    }
  }

  async deleteTrainingCourse(id: string): Promise<boolean> {
    try {
      const results = await db.update(trainingCoursesTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(trainingCoursesTable.id, id))
        .returning();
      return results.length > 0;
    } catch (error) {
      console.error("Database error in deleteTrainingCourse:", error);
      return false;
    }
  }

  // Training Requests
  async getTrainingRequests(filters?: { siteId?: string; status?: string; courseId?: string }): Promise<TrainingRequest[]> {
    try {
      let conditions: any[] = [];
      if (filters?.siteId) {
        conditions.push(eq(trainingRequestsTable.siteId, filters.siteId));
      }
      if (filters?.status) {
        conditions.push(eq(trainingRequestsTable.status, filters.status as any));
      }
      if (filters?.courseId) {
        conditions.push(eq(trainingRequestsTable.trainingCourseId, filters.courseId));
      }
      if (conditions.length > 0) {
        const results = await db.select().from(trainingRequestsTable)
          .where(and(...conditions));
        return results;
      }
      return await db.select().from(trainingRequestsTable);
    } catch (error) {
      console.error("Database error in getTrainingRequests:", error);
      return [];
    }
  }

  async getTrainingRequest(id: string): Promise<TrainingRequest | undefined> {
    try {
      const results = await db.select().from(trainingRequestsTable)
        .where(eq(trainingRequestsTable.id, id));
      return results[0];
    } catch (error) {
      console.error("Database error in getTrainingRequest:", error);
      return undefined;
    }
  }

  async createTrainingRequest(request: InsertTrainingRequest): Promise<TrainingRequest> {
    const now = new Date();
    try {
      const results = await db.insert(trainingRequestsTable)
        .values({
          ...request,
          createdAt: now,
        })
        .returning();
      return results[0];
    } catch (error) {
      console.error("Database error in createTrainingRequest:", error);
      const id = `training-request-${randomUUID()}`;
      const newRequest: TrainingRequest = {
        id,
        trainingCourseId: request.trainingCourseId,
        siteId: request.siteId,
        requestType: request.requestType,
        requestedBy: request.requestedBy,
        message: request.message || null,
        status: request.status || "pending",
        respondedBy: request.respondedBy || null,
        responseNotes: request.responseNotes || null,
        createdAt: now,
        respondedAt: null,
      };
      return newRequest;
    }
  }

  async updateTrainingRequest(id: string, updates: Partial<TrainingRequest>): Promise<TrainingRequest | undefined> {
    try {
      const results = await db.update(trainingRequestsTable)
        .set(updates)
        .where(eq(trainingRequestsTable.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error("Database error in updateTrainingRequest:", error);
      return undefined;
    }
  }

  // Training Bookings
  async getTrainingBookings(filters?: { siteId?: string; status?: string; courseId?: string }): Promise<TrainingBooking[]> {
    try {
      let query = db.select().from(trainingBookingsTable);
      
      if (filters) {
        const conditions = [];
        if (filters.siteId) {
          conditions.push(eq(trainingBookingsTable.siteId, filters.siteId));
        }
        if (filters.status) {
          conditions.push(eq(trainingBookingsTable.status, filters.status as any));
        }
        if (filters.courseId) {
          conditions.push(eq(trainingBookingsTable.trainingCourseId, filters.courseId));
        }
        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }
      }
      
      return await query;
    } catch (error) {
      console.error("Database error in getTrainingBookings:", error);
      return [];
    }
  }

  async getTrainingBooking(id: string): Promise<TrainingBooking | undefined> {
    try {
      const results = await db.select().from(trainingBookingsTable)
        .where(eq(trainingBookingsTable.id, id));
      return results[0];
    } catch (error) {
      console.error("Database error in getTrainingBooking:", error);
      return undefined;
    }
  }

  async createTrainingBooking(booking: InsertTrainingBooking): Promise<TrainingBooking> {
    const now = new Date();
    try {
      const results = await db.insert(trainingBookingsTable)
        .values({
          ...booking,
          bookedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return results[0];
    } catch (error) {
      console.error("Database error in createTrainingBooking:", error);
      throw error;
    }
  }

  async updateTrainingBooking(id: string, updates: Partial<TrainingBooking>): Promise<TrainingBooking | undefined> {
    try {
      const results = await db.update(trainingBookingsTable)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(trainingBookingsTable.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error("Database error in updateTrainingBooking:", error);
      return undefined;
    }
  }

  async deleteTrainingBooking(id: string): Promise<boolean> {
    try {
      await db.delete(trainingBookingsTable)
        .where(eq(trainingBookingsTable.id, id));
      return true;
    } catch (error) {
      console.error("Database error in deleteTrainingBooking:", error);
      return false;
    }
  }

  // Private method to seed case documents into database
  private async seedCaseDocuments(docs: Document[]): Promise<void> {
    try {
      for (const doc of docs) {
        // Check if document already exists
        const existing = await db.select().from(documentsTable).where(eq(documentsTable.id, doc.id));
        if (existing.length === 0) {
          await db.insert(documentsTable).values({
            id: doc.id,
            title: doc.title,
            description: doc.description ?? null,
            module: doc.module as any,
            type: doc.type as any,
            entityId: doc.entityId,
            documentTypeId: doc.documentTypeId ?? null,
            folderId: doc.folderId ?? null,
            siteId: doc.siteId ?? null,
            caseId: doc.caseId ?? null,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl ?? null,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            version: doc.version ?? 1,
            status: doc.status as any,
            approvalStatus: (doc.approvalStatus ?? "pending") as any,
            reviewDate: doc.reviewDate ?? null,
            expiryDate: doc.expiryDate ?? null,
            lastApprovedAt: doc.lastApprovedAt ?? null,
            renewalDate: doc.renewalDate ?? null,
            uploadedBy: doc.uploadedBy,
            assignedTo: doc.assignedTo ?? null,
            isArchived: doc.isArchived ?? false,
            source: (doc.source ?? "consultant") as any,
            templateId: doc.templateId ?? null,
            templateVersion: doc.templateVersion ?? null,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          });
        }
      }
    } catch (error) {
      console.error("Error seeding case documents:", error);
    }
  }

  // Private method to seed case audit logs into database
  private async seedCaseAuditLogs(logs: AuditLog[]): Promise<void> {
    try {
      for (const log of logs) {
        // Check if audit log already exists
        const existing = await db.select().from(auditLogsTable).where(eq(auditLogsTable.id, log.id));
        if (existing.length === 0) {
          await db.insert(auditLogsTable).values({
            id: log.id,
            action: log.action as any,
            userId: log.userId,
            userName: log.userName,
            entityId: log.entityId ?? null,
            siteId: log.siteId ?? null,
            documentId: log.documentId ?? null,
            caseId: log.caseId ?? null,
            supportRequestId: log.supportRequestId ?? null,
            module: log.module as any ?? null,
            details: log.details ?? null,
            metadata: log.metadata ?? null,
            createdAt: log.createdAt,
          });
        }
      }
    } catch (error) {
      console.error("Error seeding case audit logs:", error);
    }
  }

  // Private method to seed case folders into database
  private async seedCaseFolders(folders: DocumentFolder[]): Promise<void> {
    try {
      for (const folder of folders) {
        // Check if folder already exists
        const existing = await db.select().from(documentFoldersTable).where(eq(documentFoldersTable.id, folder.id));
        if (existing.length === 0) {
          await db.insert(documentFoldersTable).values({
            id: folder.id,
            name: folder.name,
            description: folder.description ?? null,
            module: folder.module as any,
            siteId: folder.siteId,
            parentId: folder.parentId ?? null,
            templateId: folder.templateId ?? null,
            sortOrder: folder.sortOrder ?? 0,
            createdBy: folder.createdBy,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
          });
        }
      }
    } catch (error) {
      console.error("Error seeding case folders:", error);
    }
  }

  // ==================== ROADMAP METHODS ====================

  async getRoadmapItems(): Promise<RoadmapItem[]> {
    const items = await db.select().from(roadmapItemsTable).orderBy(asc(roadmapItemsTable.sortOrder), desc(roadmapItemsTable.createdAt));
    return items;
  }

  async getRoadmapItem(id: string): Promise<RoadmapItem | undefined> {
    const [item] = await db.select().from(roadmapItemsTable).where(eq(roadmapItemsTable.id, id));
    return item;
  }

  async createRoadmapItem(item: InsertRoadmapItem): Promise<RoadmapItem> {
    const id = randomUUID();
    const now = new Date();
    const [created] = await db.insert(roadmapItemsTable).values({
      id,
      title: item.title,
      description: item.description ?? null,
      category: item.category ?? "feature",
      status: item.status ?? "idea",
      priority: item.priority ?? "medium",
      sortOrder: item.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return created;
  }

  async updateRoadmapItem(id: string, updates: Partial<RoadmapItem>): Promise<RoadmapItem | undefined> {
    const [updated] = await db.update(roadmapItemsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(roadmapItemsTable.id, id))
      .returning();
    return updated;
  }

  async deleteRoadmapItem(id: string): Promise<boolean> {
    const result = await db.delete(roadmapItemsTable).where(eq(roadmapItemsTable.id, id)).returning();
    return result.length > 0;
  }

  // ==================== FEEDBACK METHODS ====================

  async getFeedback(): Promise<Feedback[]> {
    return await db.select().from(feedbackTable).orderBy(desc(feedbackTable.createdAt));
  }

  async getFeedbackItem(id: string): Promise<Feedback | undefined> {
    const [item] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, id));
    return item;
  }

  async createFeedback(feedback: InsertFeedback): Promise<Feedback> {
    const id = randomUUID();
    const now = new Date();
    const [created] = await db.insert(feedbackTable).values({
      id,
      userId: feedback.userId,
      userName: feedback.userName,
      message: feedback.message,
      status: "open",
      upvotes: [],
      createdAt: now,
      updatedAt: now,
    }).returning();
    return created;
  }

  async updateFeedback(id: string, updates: Partial<Feedback>): Promise<Feedback | undefined> {
    const [updated] = await db.update(feedbackTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(feedbackTable.id, id))
      .returning();
    return updated;
  }

  async deleteFeedback(id: string): Promise<boolean> {
    const result = await db.delete(feedbackTable).where(eq(feedbackTable.id, id)).returning();
    return result.length > 0;
  }

  async toggleFeedbackUpvote(id: string, userId: string): Promise<Feedback | undefined> {
    const item = await this.getFeedbackItem(id);
    if (!item) return undefined;

    const upvotes = item.upvotes || [];
    const hasUpvoted = upvotes.includes(userId);
    const newUpvotes = hasUpvoted 
      ? upvotes.filter(id => id !== userId)
      : [...upvotes, userId];

    const [updated] = await db.update(feedbackTable)
      .set({ upvotes: newUpvotes, updatedAt: new Date() })
      .where(eq(feedbackTable.id, id))
      .returning();
    return updated;
  }

  async getFeedbackComments(feedbackId: string): Promise<FeedbackComment[]> {
    return await db.select().from(feedbackCommentsTable)
      .where(eq(feedbackCommentsTable.feedbackId, feedbackId))
      .orderBy(asc(feedbackCommentsTable.createdAt));
  }

  async createFeedbackComment(comment: InsertFeedbackComment): Promise<FeedbackComment> {
    const id = randomUUID();
    const now = new Date();
    const [created] = await db.insert(feedbackCommentsTable).values({
      id,
      ...comment,
      likes: [],
      createdAt: now,
      updatedAt: now,
    }).returning();
    return created;
  }

  async toggleCommentLike(commentId: string, userId: string): Promise<FeedbackComment | undefined> {
    const [comment] = await db.select().from(feedbackCommentsTable).where(eq(feedbackCommentsTable.id, commentId));
    if (!comment) return undefined;

    const likes = comment.likes || [];
    const hasLiked = likes.includes(userId);
    const newLikes = hasLiked 
      ? likes.filter(id => id !== userId)
      : [...likes, userId];

    const [updated] = await db.update(feedbackCommentsTable)
      .set({ likes: newLikes, updatedAt: new Date() })
      .where(eq(feedbackCommentsTable.id, commentId))
      .returning();
    return updated;
  }

  async markFeedbackRead(feedbackId: string, userId: string): Promise<void> {
    const existing = await db.select().from(feedbackReadsTable)
      .where(and(eq(feedbackReadsTable.feedbackId, feedbackId), eq(feedbackReadsTable.userId, userId)));
    
    if (existing.length > 0) {
      await db.update(feedbackReadsTable)
        .set({ lastViewedAt: new Date() })
        .where(eq(feedbackReadsTable.id, existing[0].id));
    } else {
      await db.insert(feedbackReadsTable).values({
        id: randomUUID(),
        userId,
        feedbackId,
        lastViewedAt: new Date(),
      });
    }
  }

  async getFeedbackWithMetadata(userId: string): Promise<(Feedback & { commentCount: number; hasUnreadComments: boolean })[]> {
    const feedbackList = await this.getFeedback();
    const result = [];

    for (const item of feedbackList) {
      const comments = await this.getFeedbackComments(item.id);
      const [readRecord] = await db.select().from(feedbackReadsTable)
        .where(and(eq(feedbackReadsTable.feedbackId, item.id), eq(feedbackReadsTable.userId, userId)));
      
      const lastViewedAt = readRecord?.lastViewedAt || new Date(0);
      const hasUnreadComments = comments.some(c => new Date(c.createdAt) > lastViewedAt);

      result.push({
        ...item,
        commentCount: comments.length,
        hasUnreadComments,
      });
    }

    return result;
  }

  // ==================== USER INVITATION METHODS ====================

  async getUserInvitation(id: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitationsTable).where(eq(userInvitationsTable.id, id));
    return invitation;
  }

  async getUserInvitationByToken(tokenHash: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitationsTable).where(eq(userInvitationsTable.tokenHash, tokenHash));
    return invitation;
  }

  async getUserInvitationsByUser(userId: string): Promise<UserInvitation[]> {
    return await db.select().from(userInvitationsTable)
      .where(eq(userInvitationsTable.userId, userId))
      .orderBy(desc(userInvitationsTable.createdAt));
  }

  async createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation> {
    const id = randomUUID();
    const now = new Date();
    const [created] = await db.insert(userInvitationsTable).values({
      id,
      userId: invitation.userId,
      email: invitation.email,
      tokenHash: invitation.tokenHash,
      purpose: invitation.purpose ?? "invite",
      expiresAt: invitation.expiresAt,
      usedAt: invitation.usedAt ?? null,
      createdBy: invitation.createdBy ?? null,
      createdAt: now,
    }).returning();
    return created;
  }

  async markInvitationUsed(id: string): Promise<UserInvitation | undefined> {
    const [updated] = await db.update(userInvitationsTable)
      .set({ usedAt: new Date() })
      .where(eq(userInvitationsTable.id, id))
      .returning();
    return updated;
  }

  async deleteUserInvitation(id: string): Promise<boolean> {
    const result = await db.delete(userInvitationsTable).where(eq(userInvitationsTable.id, id)).returning();
    return result.length > 0;
  }

  async invalidateUserInvitations(userId: string, purpose?: InvitationPurpose): Promise<void> {
    if (purpose) {
      await db.delete(userInvitationsTable)
        .where(and(eq(userInvitationsTable.userId, userId), eq(userInvitationsTable.purpose, purpose)));
    } else {
      await db.delete(userInvitationsTable).where(eq(userInvitationsTable.userId, userId));
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(usersTable).where(sql`LOWER(email) = LOWER(${email})`);
      return user;
    } catch (error) {
      console.error("Error fetching user by email from DB:", error);
      return undefined;
    }
  }

  // Client Upload Folders
  async getClientUploadFolders(params: { module: string; siteId?: string; userId: string; userRole: string; userCompanyId: string | null }): Promise<ClientUploadFolderWithMeta[]> {
    const { module, siteId, userId, userRole, userCompanyId } = params;
    const now = new Date();

    const allFolders = await db
      .select()
      .from(clientUploadFoldersTable)
      .where(
        and(
          eq(clientUploadFoldersTable.module, module as any),
          gt(clientUploadFoldersTable.expiresAt, now)
        )
      )
      .orderBy(desc(clientUploadFoldersTable.createdAt));

    const siteIds = siteId ? [siteId] : undefined;

    let visibleFolders = allFolders;

    if (userRole === "consultant") {
      const assignments = await db
        .select()
        .from(consultantAssignmentsTable)
        .where(eq(consultantAssignmentsTable.consultantId, userId));
      const assignedSiteIds = new Set(assignments.map((a) => a.siteId));
      visibleFolders = allFolders.filter((f) => assignedSiteIds.has(f.siteId));
    } else if (userRole === "client") {
      if (!userCompanyId) return [];
      const companySites = await db
        .select()
        .from(sitesTable)
        .where(eq(sitesTable.companyId, userCompanyId));
      const companySiteIds = new Set(companySites.map((s) => s.id));

      const accessGrants = await db
        .select()
        .from(clientUploadFolderAccessTable)
        .where(eq(clientUploadFolderAccessTable.userId, userId));
      const accessFolderIds = new Set(accessGrants.map((g) => g.folderId));

      visibleFolders = allFolders.filter(
        (f) =>
          companySiteIds.has(f.siteId) &&
          (f.allocatedClientId === userId || accessFolderIds.has(f.id))
      );
    }

    if (siteIds) {
      visibleFolders = visibleFolders.filter((f) => siteIds.includes(f.siteId));
    }

    const results: ClientUploadFolderWithMeta[] = [];
    for (const folder of visibleFolders) {
      const files = await db
        .select()
        .from(clientUploadsTable)
        .where(eq(clientUploadsTable.folderId, folder.id));
      const fileCount = files.length;
      const totalSize = files.reduce((sum, f) => sum + f.fileSize, 0);

      const creator = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, folder.createdByUserId))
        .limit(1);
      const creatorName = creator[0]?.fullName ?? "Unknown";

      let allocatedClientName: string | null = null;
      if (folder.allocatedClientId) {
        const client = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, folder.allocatedClientId))
          .limit(1);
        allocatedClientName = client[0]?.fullName ?? null;
      }

      const site = await db
        .select()
        .from(sitesTable)
        .where(eq(sitesTable.id, folder.siteId))
        .limit(1);
      const siteName = site[0]?.name ?? "Unknown Site";

      results.push({ ...folder, fileCount, totalSize, creatorName, allocatedClientName, siteName });
    }

    return results;
  }

  async getClientUploadFolder(id: string): Promise<ClientUploadFolder | undefined> {
    const rows = await db
      .select()
      .from(clientUploadFoldersTable)
      .where(eq(clientUploadFoldersTable.id, id))
      .limit(1);
    return rows[0];
  }

  async createClientUploadFolder(data: InsertClientUploadFolder): Promise<ClientUploadFolder> {
    const rows = await db
      .insert(clientUploadFoldersTable)
      .values(data)
      .returning();
    return rows[0];
  }

  async deleteClientUploadFolder(id: string): Promise<boolean> {
    await db
      .delete(clientUploadFolderAccessTable)
      .where(eq(clientUploadFolderAccessTable.folderId, id));
    await db
      .delete(clientUploadsTable)
      .where(eq(clientUploadsTable.folderId, id));
    const result = await db
      .delete(clientUploadFoldersTable)
      .where(eq(clientUploadFoldersTable.id, id))
      .returning();
    return result.length > 0;
  }

  async getClientUploadFolderAccess(folderId: string): Promise<FolderAccessWithUser[]> {
    const grants = await db
      .select()
      .from(clientUploadFolderAccessTable)
      .where(eq(clientUploadFolderAccessTable.folderId, folderId));

    const results: FolderAccessWithUser[] = [];
    for (const grant of grants) {
      const user = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, grant.userId))
        .limit(1);
      if (user[0]) {
        results.push({
          ...grant,
          userName: user[0].fullName,
          userEmail: user[0].email,
          userRole: user[0].role,
        });
      }
    }
    return results;
  }

  async grantClientUploadFolderAccess(folderId: string, userId: string, grantedByUserId: string): Promise<void> {
    await db
      .insert(clientUploadFolderAccessTable)
      .values({ folderId, userId, grantedByUserId })
      .onConflictDoNothing();
  }

  async revokeClientUploadFolderAccess(folderId: string, userId: string): Promise<void> {
    await db
      .delete(clientUploadFolderAccessTable)
      .where(
        and(
          eq(clientUploadFolderAccessTable.folderId, folderId),
          eq(clientUploadFolderAccessTable.userId, userId)
        )
      );
  }

  async getGrantableUsers(folderId: string): Promise<User[]> {
    const folder = await this.getClientUploadFolder(folderId);
    if (!folder) return [];

    const site = await db
      .select()
      .from(sitesTable)
      .where(eq(sitesTable.id, folder.siteId))
      .limit(1);
    if (!site[0]) return [];
    const companyId = site[0].companyId;

    const existingGrants = await db
      .select()
      .from(clientUploadFolderAccessTable)
      .where(eq(clientUploadFolderAccessTable.folderId, folderId));
    const grantedUserIds = new Set([
      ...existingGrants.map((g) => g.userId),
      ...(folder.allocatedClientId ? [folder.allocatedClientId] : []),
    ]);

    const companyClients = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.companyId, companyId),
          eq(usersTable.role, "client")
        )
      );

    return companyClients.filter((u) => !grantedUserIds.has(u.id));
  }

  async getClientUploads(folderId: string): Promise<ClientUploadWithUploader[]> {
    const files = await db
      .select()
      .from(clientUploadsTable)
      .where(eq(clientUploadsTable.folderId, folderId))
      .orderBy(desc(clientUploadsTable.createdAt));

    const results: ClientUploadWithUploader[] = [];
    for (const file of files) {
      const uploader = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, file.uploadedByUserId))
        .limit(1);
      results.push({ ...file, uploaderName: uploader[0]?.fullName ?? "Unknown" });
    }
    return results;
  }

  async getClientUpload(id: string): Promise<ClientUpload | undefined> {
    const rows = await db
      .select()
      .from(clientUploadsTable)
      .where(eq(clientUploadsTable.id, id))
      .limit(1);
    return rows[0];
  }

  async createClientUpload(data: InsertClientUpload): Promise<ClientUpload> {
    const rows = await db
      .insert(clientUploadsTable)
      .values(data)
      .returning();
    return rows[0];
  }

  async deleteClientUpload(id: string): Promise<boolean> {
    const result = await db
      .delete(clientUploadsTable)
      .where(eq(clientUploadsTable.id, id))
      .returning();
    return result.length > 0;
  }

  async cleanupExpiredFolders(): Promise<number> {
    const now = new Date();
    const { objectStorageService } = await import("./replit_integrations/object_storage/objectStorage");

    // Step 1: Delete individual files that have passed their 30-day expiry
    const expiredFiles = await db
      .select()
      .from(clientUploadsTable)
      .where(sql`${clientUploadsTable.expiresAt} < ${now}`);

    let fileCount = 0;
    for (const file of expiredFiles) {
      try {
        await objectStorageService.deleteObjectEntityFile(file.fileUrl);
      } catch {
        // Continue even if object storage deletion fails
      }
      await db.delete(clientUploadsTable).where(eq(clientUploadsTable.id, file.id));
      fileCount++;
    }

    // Step 2: Delete any folders that are now empty (all files have expired/been deleted)
    // Also delete folders that hit the long-running safety-net expiry
    const allFolders = await db.select().from(clientUploadFoldersTable);
    for (const folder of allFolders) {
      const remaining = await db
        .select()
        .from(clientUploadsTable)
        .where(eq(clientUploadsTable.folderId, folder.id))
        .limit(1);

      const isEmpty = remaining.length === 0;
      const pastSafetyNet = folder.expiresAt < now;

      if (isEmpty || pastSafetyNet) {
        await this.deleteClientUploadFolder(folder.id);
      }
    }

    return fileCount;
  }

  // Initialize default admin user in database if not exists
  async initializeDefaultAdmin(): Promise<void> {
    try {
      // Check if admin user exists
      const existingAdmin = await this.getUserByUsername("admin");
      if (!existingAdmin) {
        console.log("Creating default admin user in database...");
        // Import bcrypt dynamically to avoid circular deps
        const bcrypt = await import("bcrypt");
        const hashedPassword = await bcrypt.hash("admin123", 10);
        
        await db.insert(usersTable).values({
          id: "user-admin",
          referenceNumber: "ADM-00001",
          username: "admin",
          password: hashedPassword,
          email: "admin@guardiangroup.com",
          fullName: "System Administrator",
          role: "admin",
          status: "active",
        });
        console.log("Default admin user created successfully.");
      }
    } catch (error) {
      console.error("Error initializing default admin:", error);
    }
  }

}

export const storage = new MemStorage();
