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
  type CaseDocumentChecklist, type InsertCaseDocumentChecklist,
  type CaseNote, type InsertCaseNote,
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
  type CompanyRequiredTemplate, type InsertCompanyRequiredTemplate,
  companyRequiredTemplates as companyRequiredTemplatesTable,
  type SiteTemplateOverride,
  siteTemplateOverrides as siteTemplateOverridesTable,
  type CompanyTemplateOverride,
  companyTemplateOverrides as companyTemplateOverridesTable,
  type ClientUploadFolder, type InsertClientUploadFolder,
  type ClientUploadFolderAccess, type InsertClientUploadFolderAccess,
  type ClientUpload, type InsertClientUpload,
  clientUploadFolders as clientUploadFoldersTable,
  clientUploadFolderAccess as clientUploadFolderAccessTable,
  clientUploads as clientUploadsTable,
  userInvitations as userInvitationsTable,
  type DocumentPathway, type InsertDocumentPathway, type PathwayNode,
  documentPathways as documentPathwaysTable,
  type TrainingPathway, type InsertTrainingPathway,
  trainingPathways as trainingPathwaysTable,
  type TestingTaskList, type InsertTestingTaskList,
  type TestingTaskAssignment, type InsertTestingTaskAssignment,
  testingTaskLists as testingTaskListsTable,
  testingTaskAssignments as testingTaskAssignmentsTable,
  type DocumentShare, type InsertDocumentShare,
  documentShares as documentSharesTable,
  type DocumentScope,
  type Source, type InsertSource,
  sources as sourcesTable,
  type PortalMessage, type InsertPortalMessage,
  portalMessages as portalMessagesTable,
  type CaseBundle, type InsertCaseBundle,
  caseBundles as caseBundlesTable,
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
  caseDocumentChecklist as caseDocumentChecklistTable,
  caseNotes as caseNotesTable,
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
import { eq, and, or, asc, desc, isNull, gt, count, sql, inArray } from "drizzle-orm";

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
  // Shared/scoped documents
  getSharedDocumentsForSite(siteId: string, module?: ModuleType, includeArchived?: boolean): Promise<(Document & { sharedScope: "company" | "group"; sharedFromEntityName: string | null })[]>;
  getDocumentShares(documentId: string): Promise<DocumentShare[]>;
  createDocumentShare(share: InsertDocumentShare): Promise<DocumentShare>;
  deleteDocumentShare(documentId: string, entityType: string, entityId: string): Promise<boolean>;
  getCompanyScopedDocuments(companyId: string, module?: ModuleType, includeArchived?: boolean): Promise<Document[]>;
  
  // Document Versions
  getDocumentVersions(documentId: string): Promise<DocumentVersion[]>;
  createDocumentVersion(version: InsertDocumentVersion): Promise<DocumentVersion>;
  
  // Audit Logs
  getAuditLogs(documentId?: string, module?: ModuleType): Promise<AuditLog[]>;
  getUserActivityLogs(userId: string): Promise<AuditLog[]>;
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
  getCaseByCaseNumber(caseNumber: string, excludeId?: string): Promise<Case | undefined>;
  createCase(caseData: InsertCase): Promise<Case>;
  updateCase(id: string, updates: Partial<Case>): Promise<Case | undefined>;
  archiveCase(id: string): Promise<Case | undefined>;
  unarchiveCase(id: string): Promise<Case | undefined>;
  getCaseDocuments(caseId: string): Promise<Document[]>;
  
  // Case Milestones
  getCaseMilestones(caseId: string): Promise<CaseMilestone[]>;
  getCaseMilestonesForCases(caseIds: string[]): Promise<CaseMilestone[]>;
  getCaseMilestone(id: string): Promise<CaseMilestone | undefined>;
  createCaseMilestone(milestone: InsertCaseMilestone): Promise<CaseMilestone>;
  updateCaseMilestone(id: string, updates: Partial<CaseMilestone>): Promise<CaseMilestone | undefined>;
  deleteCaseMilestone(id: string): Promise<void>;

  // Case Document Checklist
  getCaseDocumentChecklist(caseId: string): Promise<CaseDocumentChecklist[]>;
  getCaseDocumentChecklistItem(id: string): Promise<CaseDocumentChecklist | undefined>;
  createCaseDocumentChecklistItem(item: InsertCaseDocumentChecklist): Promise<CaseDocumentChecklist>;
  updateCaseDocumentChecklistItem(id: string, updates: Partial<CaseDocumentChecklist>): Promise<CaseDocumentChecklist | undefined>;
  deleteCaseDocumentChecklistItem(id: string): Promise<void>;

  // Case Bundles
  getCaseBundles(caseId: string): Promise<CaseBundle[]>;
  getCaseBundle(id: string): Promise<CaseBundle | undefined>;
  createCaseBundle(bundle: InsertCaseBundle): Promise<CaseBundle>;
  updateCaseBundle(id: string, updates: Partial<CaseBundle>): Promise<CaseBundle | undefined>;
  deleteCaseBundle(id: string): Promise<void>;

  // Case Notes
  getCaseNotes(caseId: string): Promise<CaseNote[]>;
  getCaseNote(id: string): Promise<CaseNote | undefined>;
  createCaseNote(note: InsertCaseNote): Promise<CaseNote>;
  updateCaseNote(id: string, updates: Partial<CaseNote>): Promise<CaseNote | undefined>;
  deleteCaseNote(id: string): Promise<void>;

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
  getGroupOwnerInheritedAccess(companyId: string): Promise<{ healthSafety: boolean; humanResources: boolean; employmentLaw: boolean; training: boolean; toolkit: boolean; support: boolean; reports: boolean }>;
  
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
  clearClientSiteAssignments(clientId: string): Promise<void>;
  hasClientSiteAssignments(clientId: string): Promise<boolean>;
  
  // Users by Site
  getUsersBySite(siteId: string): Promise<User[]>;
  getUsersByCompany(companyId: string): Promise<User[]>;
  getConsultants(): Promise<User[]>;
  getConsultantsByManager(managerId: string): Promise<User[]>;
  
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
  getToolkitStats(filter?: { companyName?: string; userId?: string }): Promise<{ totalDownloads: number; downloadsLast30Days: number; downloadsByModule: { health_safety: number; human_resources: number; employment_law: number }; recentDownloads: Array<{ id: string; templateName: string; templateId: string; module: string | null; folderName: string | null; fileUrl: string | null; fileName: string | null; downloadedAt: string; downloadedBy: string; companyName: string | null; siteName: string | null }> }>;

  // Document Pathways (Guided finder decision trees)
  getDocumentPathways(module?: string): Promise<DocumentPathway[]>;
  getDocumentPathway(id: string): Promise<DocumentPathway | undefined>;
  createDocumentPathway(pathway: InsertDocumentPathway): Promise<DocumentPathway>;
  updateDocumentPathway(id: string, updates: Partial<DocumentPathway>): Promise<DocumentPathway | undefined>;
  deleteDocumentPathway(id: string): Promise<boolean>;
  getTrainingPathways(module?: string): Promise<TrainingPathway[]>;
  getTrainingPathway(id: string): Promise<TrainingPathway | undefined>;
  createTrainingPathway(pathway: InsertTrainingPathway): Promise<TrainingPathway>;
  updateTrainingPathway(id: string, updates: Partial<TrainingPathway>): Promise<TrainingPathway | undefined>;
  deleteTrainingPathway(id: string): Promise<boolean>;
  
  // Folder Templates (Admin-managed master folder structure)
  getFolderTemplates(module?: ModuleType): Promise<FolderTemplate[]>;
  getFolderTemplate(id: string): Promise<FolderTemplate | undefined>;
  getFolderTemplateByToolkitFolderId(toolkitFolderId: string): Promise<FolderTemplate | undefined>;
  getModuleToolkitRootFolder(module: ModuleType): Promise<FolderTemplate | undefined>;
  seedToolkitRootFolders(): Promise<void>;
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
  getDocumentTemplates(module?: ModuleType, folderTemplateId?: string, userSources?: string[]): Promise<DocumentTemplate[]>;
  bulkUpdateTemplateSources(templateIds: string[], sources: string[], mode: "merge" | "clear"): Promise<void>;
  getDocumentTemplatesByIds(ids: string[]): Promise<DocumentTemplate[]>;
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
  provisionFoldersFromTemplates(target: string | { scope: "company" | "group"; entityId: string }, module: ModuleType, createdBy: string): Promise<DocumentFolder[]>;
  getScopedDocumentFolders(scope: "company" | "group", entityId: string, module?: ModuleType): Promise<DocumentFolder[]>;
  
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
  updateFeedbackComment(id: string, content: string): Promise<FeedbackComment | undefined>;
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

  // Company Required Templates
  getCompanyRequiredTemplates(companyId: string): Promise<CompanyRequiredTemplate[]>;
  setCompanyRequiredTemplates(companyId: string, templateIds: string[], createdBy: string): Promise<CompanyRequiredTemplate[]>;
  addCompanyRequiredTemplate(companyId: string, templateId: string, createdBy: string): Promise<CompanyRequiredTemplate>;
  removeCompanyRequiredTemplate(companyId: string, templateId: string): Promise<boolean>;

  // Site Template Overrides
  getSiteTemplateOverrides(siteId: string): Promise<SiteTemplateOverride[]>;
  setSiteTemplateOverride(siteId: string, templateId: string, action: "include" | "exclude", createdBy: string): Promise<SiteTemplateOverride>;
  removeSiteTemplateOverride(siteId: string, templateId: string): Promise<boolean>;

  // Company Template Overrides (override group-inherited requireds at the company level)
  getCompanyTemplateOverrides(companyId: string): Promise<CompanyTemplateOverride[]>;
  setCompanyTemplateOverride(companyId: string, templateId: string, action: "include" | "exclude", createdBy: string): Promise<CompanyTemplateOverride>;
  removeCompanyTemplateOverride(companyId: string, templateId: string): Promise<boolean>;
  getEffectiveCompanyRequiredTemplateIds(companyId: string): Promise<Set<string>>;

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

  // Testing Task Lists
  getTestingTaskLists(includeArchived?: boolean): Promise<TestingTaskList[]>;
  getTestingTaskList(id: string): Promise<TestingTaskList | undefined>;
  createTestingTaskList(list: InsertTestingTaskList): Promise<TestingTaskList>;
  updateTestingTaskList(id: string, updates: Partial<TestingTaskList>): Promise<TestingTaskList | undefined>;
  deleteTestingTaskList(id: string): Promise<boolean>;

  // Testing Task Assignments
  getTestingTaskAssignments(taskListId?: string): Promise<(TestingTaskAssignment & { assignedToUser?: Pick<User, "id" | "fullName" | "email"> })[]>;
  getTestingTaskAssignment(id: string): Promise<TestingTaskAssignment | undefined>;
  getMyTestingTaskAssignments(userId: string): Promise<(TestingTaskAssignment & { taskList: TestingTaskList })[]>;
  createTestingTaskAssignment(assignment: InsertTestingTaskAssignment): Promise<TestingTaskAssignment>;
  updateTestingTaskAssignment(id: string, updates: Partial<TestingTaskAssignment>): Promise<TestingTaskAssignment | undefined>;
  deleteTestingTaskAssignment(id: string): Promise<boolean>;

  // Sources
  getSources(activeOnly?: boolean): Promise<Source[]>;
  getSource(id: string): Promise<Source | undefined>;
  createSource(source: InsertSource): Promise<Source>;
  updateSource(id: string, updates: Partial<Source>): Promise<Source | undefined>;

  // Group Owner
  getGroupMembers(groupOwnerId: string): Promise<Company[]>;
  setGroupOwner(companyId: string, groupOwnerId: string | null): Promise<Company | undefined>;

  // Portal Messages
  getPortalMessages(opts?: { publishedOnly?: boolean; role?: string }): Promise<PortalMessage[]>;
  getPortalMessage(id: string): Promise<PortalMessage | undefined>;
  createPortalMessage(data: InsertPortalMessage): Promise<PortalMessage>;
  updatePortalMessage(id: string, updates: Partial<PortalMessage>): Promise<PortalMessage | undefined>;
  deletePortalMessage(id: string): Promise<boolean>;
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
    // Seed example pathways if none exist
    this.seedExamplePathways().catch(err => {
      console.error("Failed to seed example pathways:", err);
    });
    // Seed training pathways if none exist
    this.seedTrainingPathways().catch(err => {
      console.error("Failed to seed training pathways:", err);
    });
    // Seed brand sources if none exist
    this.seedSources().catch(err => {
      console.error("Failed to seed sources:", err);
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
      const [user] = await db.select().from(usersTable).where(sql`LOWER(username) = LOWER(${username})`);
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

  /**
   * Computes a compliance summary in memory from pre-loaded data.
   * Called by the batched getSitesWithDetails / getSitesWithDetailsByCompanyId
   * so that no per-site DB queries are needed.
   */
  private computeComplianceSummaryInMemory(
    siteDocs: { templateId?: string | null; isRequired?: boolean | null; status?: string | null; approvalStatus?: string | null }[],
    siteOverrides: { templateId: string; action: string }[],
    companyRequired: { templateId: string; removedAt?: Date | null }[],
    templateMap: Map<string, { id: string; visibility?: string | null }>,
  ): ComplianceSummary {
    const excludedIds = new Set(siteOverrides.filter(o => o.action === "exclude").map(o => o.templateId));
    const includedIds = new Set(siteOverrides.filter(o => o.action === "include").map(o => o.templateId));

    // Filter out soft-removed inherited rows — they remain visible in the
    // company/site Required Documents UI as struck-through "previously
    // inherited, no longer required" entries but must not count as required
    // slots for compliance.
    const activeCompanyRequired = companyRequired.filter(r => !r.removedAt);
    const effectiveTemplateIds = [
      ...activeCompanyRequired.map(r => r.templateId).filter(id => !excludedIds.has(id)),
      ...[...includedIds].filter(id => !activeCompanyRequired.some(r => r.templateId === id)),
    ];

    let slotTotal = 0;
    let slotCompliantDocs = 0;
    let slotReview = 0;
    let slotOverdue = 0;
    let missingRequired = 0;
    const consumedTemplateIds = new Set<string>();

    for (const templateId of effectiveTemplateIds) {
      const tmpl = templateMap.get(templateId);
      if (!tmpl || tmpl.visibility !== "private") continue;
      consumedTemplateIds.add(templateId);
      slotTotal++;
      const matchingDocs = siteDocs.filter(d => d.templateId === templateId);
      if (matchingDocs.length === 0) { missingRequired++; continue; }
      for (const d of matchingDocs) {
        if (d.status === "compliant") slotCompliantDocs++;
        else if (d.status === "overdue") slotOverdue++;
        else if (d.status === "review_required") slotReview++;
      }
    }

    const manualRequired = siteDocs.filter(d =>
      d.isRequired && (!d.templateId || !consumedTemplateIds.has(d.templateId))
    );
    const manualCompliant = manualRequired.filter(d => d.status === "compliant").length;

    const total = slotTotal + manualRequired.length;
    const compliant = slotCompliantDocs + manualCompliant;
    const review = slotReview + manualRequired.filter(d => d.status === "review_required").length;
    const overdue = slotOverdue + manualRequired.filter(d => d.status === "overdue").length;
    const pending = siteDocs.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;
    const scoreDenominator = compliant + review + overdue + missingRequired;

    return {
      totalDocuments: total,
      compliantDocuments: compliant,
      reviewRequired: review,
      overdueDocuments: overdue,
      missingRequiredDocuments: missingRequired,
      pendingApprovals: pending,
      awaitingYourApproval: 0,
      awaitingOthersApproval: 0,
      complianceScore: scoreDenominator > 0 ? Math.round((compliant / scoreDenominator) * 100) : 0,
    };
  }

  /**
   * Loads all sites with full detail in ~8 parallel DB queries (previously one query
   * per site plus one per assigned consultant — easily hundreds of round-trips).
   */
  async getSitesWithDetails(): Promise<SiteWithDetails[]> {
    const [
      sites,
      companies,
      allDocs,
      allSiteOverrides,
      allCompanyRequired,
      allActiveTemplates,
      allModuleAccess,
      allAssignments,
      allUsers,
    ] = await Promise.all([
      db.select().from(sitesTable),
      db.select().from(companiesTable),
      db.select().from(documentsTable).where(and(
        eq(documentsTable.isArchived, false),
        isNull(documentsTable.caseId),
        isNull(documentsTable.incidentId),
      )),
      db.select().from(siteTemplateOverridesTable),
      db.select().from(companyRequiredTemplatesTable),
      db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.isActive, true)),
      db.select().from(siteModuleAccessTable),
      db.select().from(consultantAssignmentsTable),
      db.select().from(usersTable),
    ]);

    const companiesMap = new Map(companies.map(c => [c.id, c]));
    const templateMap = new Map(allActiveTemplates.map(t => [t.id, t]));
    const usersMap = new Map(allUsers.map(u => [u.id, u]));

    // Group by siteId / companyId for O(1) lookups
    const docsBySite = new Map<string, typeof allDocs>();
    const docsByCompany = new Map<string, typeof allDocs>();
    for (const d of allDocs) {
      if (d.siteId) {
        if (!docsBySite.has(d.siteId)) docsBySite.set(d.siteId, []);
        docsBySite.get(d.siteId)!.push(d);
      } else if (d.entityId) {
        // Company-scoped documents (siteId IS NULL) count toward all sites of that company
        if (!docsByCompany.has(d.entityId)) docsByCompany.set(d.entityId, []);
        docsByCompany.get(d.entityId)!.push(d);
      }
    }
    const overridesBySite = new Map<string, typeof allSiteOverrides>();
    for (const o of allSiteOverrides) {
      if (!overridesBySite.has(o.siteId)) overridesBySite.set(o.siteId, []);
      overridesBySite.get(o.siteId)!.push(o);
    }
    const requiredByCompany = new Map<string, typeof allCompanyRequired>();
    for (const r of allCompanyRequired) {
      if (!requiredByCompany.has(r.companyId)) requiredByCompany.set(r.companyId, []);
      requiredByCompany.get(r.companyId)!.push(r);
    }
    const moduleAccessBySite = new Map<string, typeof allModuleAccess>();
    for (const a of allModuleAccess) {
      if (!moduleAccessBySite.has(a.siteId)) moduleAccessBySite.set(a.siteId, []);
      moduleAccessBySite.get(a.siteId)!.push(a);
    }
    const assignmentsBySite = new Map<string, typeof allAssignments>();
    for (const a of allAssignments) {
      const key = a.entityId ?? a.siteId;
      if (!key) continue;
      if (!assignmentsBySite.has(key)) assignmentsBySite.set(key, []);
      assignmentsBySite.get(key)!.push(a);
    }

    return sites.map(site => {
      const company = companiesMap.get(site.companyId);
      const siteDocs = [
        ...(docsBySite.get(site.id) ?? []),
        ...(docsByCompany.get(site.companyId) ?? []),
      ];

      const complianceSummary = this.computeComplianceSummaryInMemory(
        siteDocs,
        overridesBySite.get(site.id) ?? [],
        requiredByCompany.get(site.companyId) ?? [],
        templateMap,
      );

      const moduleAccessList = moduleAccessBySite.get(site.id) ?? [];
      const moduleAccess: {
        health_safety: "active" | "visible" | "hidden";
        human_resources: "active" | "visible" | "hidden";
        employment_law: "active" | "visible" | "hidden";
        support: "active" | "visible" | "hidden";
      } = { health_safety: "hidden", human_resources: "hidden", employment_law: "hidden", support: "hidden" };
      for (const a of moduleAccessList) {
        if (a.module === "health_safety" || a.module === "human_resources" || a.module === "employment_law" || a.module === "support") {
          moduleAccess[a.module] = a.status as "active" | "visible" | "hidden";
        }
      }

      const assignments = assignmentsBySite.get(site.id) ?? [];
      const assignedConsultants = assignments.map(a => ({
        id: a.consultantId,
        name: usersMap.get(a.consultantId)?.fullName ?? "Unknown",
        isPrimary: a.isPrimary,
      }));

      return {
        ...site,
        companyName: company?.name,
        companyNumber: company?.companyNumber ?? undefined,
        companySearchTag: company?.searchTag ?? undefined,
        companySources: company?.sources ?? null,
        complianceSummary,
        moduleAccess,
        assignedConsultants,
      };
    });
  }

  async getSitesWithDetailsByCompanyId(companyId: string): Promise<SiteWithDetails[]> {
    // Filter sites first then batch the rest — avoids per-site queries
    const [companySites, company, allSiteOverrides, allCompanyRequired, allActiveTemplates, allModuleAccess, allAssignments, allUsers] = await Promise.all([
      db.select().from(sitesTable).where(eq(sitesTable.companyId, companyId)),
      this.getCompany(companyId),
      db.select().from(siteTemplateOverridesTable),
      db.select().from(companyRequiredTemplatesTable).where(eq(companyRequiredTemplatesTable.companyId, companyId)),
      db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.isActive, true)),
      db.select().from(siteModuleAccessTable),
      db.select().from(consultantAssignmentsTable),
      db.select().from(usersTable),
    ]);

    if (companySites.length === 0) return [];

    const siteIds = new Set(companySites.map(s => s.id));

    const allDocs = await db.select().from(documentsTable).where(and(
      eq(documentsTable.isArchived, false),
      isNull(documentsTable.caseId),
      isNull(documentsTable.incidentId),
    ));

    const templateMap = new Map(allActiveTemplates.map(t => [t.id, t]));
    const usersMap = new Map(allUsers.map(u => [u.id, u]));

    const docsBySite = new Map<string, typeof allDocs>();
    const companyDocs: typeof allDocs = [];
    for (const d of allDocs) {
      if (d.siteId) {
        if (!siteIds.has(d.siteId)) continue;
        if (!docsBySite.has(d.siteId)) docsBySite.set(d.siteId, []);
        docsBySite.get(d.siteId)!.push(d);
      } else if (d.entityId === companyId) {
        // Company-scoped documents count toward all sites of this company
        companyDocs.push(d);
      }
    }
    const overridesBySite = new Map<string, typeof allSiteOverrides>();
    for (const o of allSiteOverrides) {
      if (!siteIds.has(o.siteId)) continue;
      if (!overridesBySite.has(o.siteId)) overridesBySite.set(o.siteId, []);
      overridesBySite.get(o.siteId)!.push(o);
    }
    const moduleAccessBySite = new Map<string, typeof allModuleAccess>();
    for (const a of allModuleAccess) {
      if (!siteIds.has(a.siteId)) continue;
      if (!moduleAccessBySite.has(a.siteId)) moduleAccessBySite.set(a.siteId, []);
      moduleAccessBySite.get(a.siteId)!.push(a);
    }
    const assignmentsBySite = new Map<string, typeof allAssignments>();
    for (const a of allAssignments) {
      const key = a.entityId ?? a.siteId;
      if (!key || !siteIds.has(key)) continue;
      if (!assignmentsBySite.has(key)) assignmentsBySite.set(key, []);
      assignmentsBySite.get(key)!.push(a);
    }

    return companySites.map(site => {
      const siteDocs = [
        ...(docsBySite.get(site.id) ?? []),
        ...companyDocs,
      ];

      const complianceSummary = this.computeComplianceSummaryInMemory(
        siteDocs,
        overridesBySite.get(site.id) ?? [],
        allCompanyRequired,
        templateMap,
      );

      const moduleAccessList = moduleAccessBySite.get(site.id) ?? [];
      const moduleAccess: {
        health_safety: "active" | "visible" | "hidden";
        human_resources: "active" | "visible" | "hidden";
        employment_law: "active" | "visible" | "hidden";
        support: "active" | "visible" | "hidden";
      } = { health_safety: "hidden", human_resources: "hidden", employment_law: "hidden", support: "hidden" };
      for (const a of moduleAccessList) {
        if (a.module === "health_safety" || a.module === "human_resources" || a.module === "employment_law" || a.module === "support") {
          moduleAccess[a.module] = a.status as "active" | "visible" | "hidden";
        }
      }

      const assignments = assignmentsBySite.get(site.id) ?? [];
      const assignedConsultants = assignments.map(a => ({
        id: a.consultantId,
        name: usersMap.get(a.consultantId)?.fullName ?? "Unknown",
        isPrimary: a.isPrimary,
      }));

      return {
        ...site,
        companyName: company?.name,
        companyNumber: company?.companyNumber ?? undefined,
        companySearchTag: company?.searchTag ?? undefined,
        companySources: company?.sources ?? null,
        complianceSummary,
        moduleAccess,
        assignedConsultants,
      };
    });
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

    // Determine which companies are Group Owners (have at least one member) and build name lookup
    const goMemberCounts = new Map<string, number>();
    const companyNameById = new Map<string, string>();
    for (const c of companies) {
      companyNameById.set(c.id, c.name);
      if (c.groupOwnerId) {
        goMemberCounts.set(c.groupOwnerId, (goMemberCounts.get(c.groupOwnerId) || 0) + 1);
      }
    }
    
    return companies.map(company => ({
      ...company,
      siteCount: siteCountByCompany.get(company.id) || 0,
      isGroupOwner: (goMemberCounts.get(company.id) || 0) > 0,
      groupOwnerName: company.groupOwnerId ? (companyNameById.get(company.groupOwnerId) ?? null) : null,
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
      status: insertCompany.status ?? "pending",
      healthSafetyAccess: insertCompany.healthSafetyAccess ?? false,
      humanResourcesAccess: insertCompany.humanResourcesAccess ?? false,
      employmentLawAccess: insertCompany.employmentLawAccess ?? false,
      supportAccess: insertCompany.supportAccess ?? false,
      reportsAccess: insertCompany.reportsAccess ?? false,
    }).returning();
    // If joining a group at creation, copy the group's current required templates.
    if (company.groupOwnerId) {
      await this.cascadeGroupRequiredsToMember(company.groupOwnerId, company.id);
    }
    return company;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const [previous] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
    const [updatedCompany] = await db.update(companiesTable)
      .set(updates)
      .where(eq(companiesTable.id, id))
      .returning();
    // If a company has been (re)assigned to a group, copy the group's current
    // required templates into this company so they show up at the company level.
    if (updatedCompany?.groupOwnerId && previous?.groupOwnerId !== updatedCompany.groupOwnerId) {
      await this.cascadeGroupRequiredsToMember(updatedCompany.groupOwnerId, updatedCompany.id);
    }
    return updatedCompany;
  }

  private async cascadeGroupRequiredsToMember(groupOwnerId: string, memberCompanyId: string): Promise<void> {
    const groupReqs = await db.select().from(companyRequiredTemplatesTable)
      .where(eq(companyRequiredTemplatesTable.companyId, groupOwnerId));
    if (groupReqs.length === 0) return;
    const templateIds = groupReqs.map(r => r.templateId);
    // Reactivate any soft-removed inherited rows on this member for templates
    // currently required by the group — covers the case where a company is
    // (re-)assigned to a group it previously belonged to and still carries
    // the old soft-removed inherited rows.
    await db.update(companyRequiredTemplatesTable)
      .set({ removedAt: null, inheritedFromCompanyId: groupOwnerId })
      .where(and(
        eq(companyRequiredTemplatesTable.companyId, memberCompanyId),
        inArray(companyRequiredTemplatesTable.templateId, templateIds),
      ));
    const values = groupReqs.map(r => ({
      companyId: memberCompanyId,
      templateId: r.templateId,
      createdBy: r.createdBy,
      inheritedFromCompanyId: groupOwnerId,
    }));
    await db.insert(companyRequiredTemplatesTable).values(values).onConflictDoNothing();
  }

  private async getSiteComplianceSummary(siteId: string): Promise<ComplianceSummary> {
    const allDocs = await db.select().from(documentsTable)
      .where(and(
        eq(documentsTable.siteId, siteId), 
        eq(documentsTable.isArchived, false),
        isNull(documentsTable.caseId),
        isNull(documentsTable.incidentId)
      ));
    const docs = allDocs;

    const site = await db.select().from(sitesTable).where(eq(sitesTable.id, siteId)).then(r => r[0]);

    let slotTotal = 0;
    // per-document counts for display (matching computeSlotBasedCompliance in routes.ts)
    let slotCompliantDocs = 0;
    let slotReview = 0;
    let slotOverdue = 0;
    let missingRequired = 0;
    const consumedTemplateIds = new Set<string>();

    if (site?.companyId) {
      const [companyRequiredAll, siteOverrides] = await Promise.all([
        this.getCompanyRequiredTemplates(site.companyId),
        this.getSiteTemplateOverrides(siteId),
      ]);
      // Soft-removed inherited rows stay visible in the UI but must not count
      // as required slots for compliance.
      const companyRequired = companyRequiredAll.filter(r => !r.removedAt);
      const excludedIds = new Set(siteOverrides.filter(o => o.action === "exclude").map(o => o.templateId));
      const includedIds = new Set(siteOverrides.filter(o => o.action === "include").map(o => o.templateId));

      const templates = await db.select().from(documentTemplatesTable)
        .where(eq(documentTemplatesTable.isActive, true));
      const templateMap = new Map(templates.map(t => [t.id, t]));

      const effectiveTemplateIds = [
        ...companyRequired.map(r => r.templateId).filter(id => !excludedIds.has(id)),
        ...[...includedIds].filter(id => !companyRequired.some(r => r.templateId === id)),
      ];

      for (const templateId of effectiveTemplateIds) {
        const tmpl = templateMap.get(templateId);
        if (!tmpl || tmpl.visibility !== "private") continue;
        consumedTemplateIds.add(templateId);
        slotTotal++;
        const matchingDocs = docs.filter(d => d.templateId === templateId);
        if (matchingDocs.length === 0) {
          missingRequired++;
          continue;
        }
        // Per-document display counts — so the dialog list matches the card numbers
        matchingDocs.forEach(d => {
          if (d.status === "compliant") slotCompliantDocs++;
          else if (d.status === "overdue") slotOverdue++;
          else if (d.status === "review_required") slotReview++;
        });
      }
    }

    const manualRequired = docs.filter(d =>
      d.isRequired && (!d.templateId || !consumedTemplateIds.has(d.templateId))
    );
    const manualCompliant = manualRequired.filter(d => d.status === "compliant").length;

    const total = slotTotal + manualRequired.length;
    const compliant = slotCompliantDocs + manualCompliant;
    const review = slotReview + manualRequired.filter(d => d.status === "review_required").length;
    const overdue = slotOverdue + manualRequired.filter(d => d.status === "overdue").length;
    const pending = docs.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;
    // Compliance score: compliant / (compliant + not compliant + missing)
    // Ties the percentage directly to the three tiles shown on the dashboard card.
    const scoreDenominator = compliant + review + overdue + missingRequired;
    
    return {
      totalDocuments: total,
      compliantDocuments: compliant,
      reviewRequired: review,
      overdueDocuments: overdue,
      missingRequiredDocuments: missingRequired,
      pendingApprovals: pending,
      awaitingYourApproval: 0,
      awaitingOthersApproval: 0,
      complianceScore: scoreDenominator > 0 ? Math.round((compliant / scoreDenominator) * 100) : 0,
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
      comments: insertDocument.comments ?? null,
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

  // Shared/scoped documents
  async getSharedDocumentsForSite(siteId: string, module?: ModuleType, includeArchived = false): Promise<(Document & { sharedScope: "company" | "group"; sharedFromEntityName: string | null })[]> {
    const site = await this.getSite(siteId);
    if (!site) return [];
    const company = await this.getCompany(site.companyId);
    if (!company) return [];

    const results: (Document & { sharedScope: "company" | "group"; sharedFromEntityName: string | null })[] = [];
    const seenIds = new Set<string>();

    // --- Company-scope docs ---
    // Primary: explicit share records targeting this specific site or this company
    const companyScopeShares = await db
      .select({ doc: documentsTable })
      .from(documentSharesTable)
      .innerJoin(documentsTable, eq(documentsTable.id, documentSharesTable.documentId))
      .where(
        and(
          eq(documentsTable.scope, "company"),
          eq(documentsTable.entityId, site.companyId),
          isNull(documentsTable.siteId),
          or(
            and(eq(documentSharesTable.entityType, "site"), eq(documentSharesTable.entityId, siteId)),
            and(eq(documentSharesTable.entityType, "company"), eq(documentSharesTable.entityId, site.companyId)),
          ),
          ...(module ? [eq(documentsTable.module, module as any)] : []),
          ...(includeArchived ? [] : [eq(documentsTable.isArchived, false)]),
        )
      );
    for (const row of companyScopeShares) {
      if (!seenIds.has(row.doc.id)) {
        seenIds.add(row.doc.id);
        results.push({ ...row.doc, sharedScope: "company", sharedFromEntityName: company.name });
      }
    }

    // --- Group-scope docs ---
    // Group-scope docs uploaded under this site's OWN company (no share record needed):
    // when a company is itself a group, group-scoped docs uploaded against it should
    // be visible at all of its own sites by default.
    const ownGroupDocs = await db
      .select()
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.scope, "group"),
          eq(documentsTable.entityId, site.companyId),
          isNull(documentsTable.siteId),
          ...(module ? [eq(documentsTable.module, module as any)] : []),
          ...(includeArchived ? [] : [eq(documentsTable.isArchived, false)]),
        )
      );
    for (const doc of ownGroupDocs) {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        results.push({ ...doc, sharedScope: "group", sharedFromEntityName: company.name });
      }
    }

    // Determine which group owner IDs apply to this company (either it's a member or it IS the owner)
    const relevantGroupOwnerIds: string[] = [];
    if (company.groupOwnerId) relevantGroupOwnerIds.push(company.groupOwnerId);
    // For each group owner, check explicit shares to this company
    for (const goId of relevantGroupOwnerIds) {
      const groupOwner = await this.getCompany(goId);
      const groupScopeShares = await db
        .select({ doc: documentsTable })
        .from(documentSharesTable)
        .innerJoin(documentsTable, eq(documentsTable.id, documentSharesTable.documentId))
        .where(
          and(
            eq(documentsTable.scope, "group"),
            eq(documentsTable.entityId, goId),
            isNull(documentsTable.siteId),
            eq(documentSharesTable.entityType, "company"),
            eq(documentSharesTable.entityId, site.companyId),
            ...(module ? [eq(documentsTable.module, module as any)] : []),
            ...(includeArchived ? [] : [eq(documentsTable.isArchived, false)]),
          )
        );
      for (const row of groupScopeShares) {
        if (!seenIds.has(row.doc.id)) {
          seenIds.add(row.doc.id);
          results.push({ ...row.doc, sharedScope: "group", sharedFromEntityName: groupOwner?.name ?? null });
        }
      }
    }

    return results;
  }

  async getDocumentShares(documentId: string): Promise<DocumentShare[]> {
    return db.select().from(documentSharesTable).where(eq(documentSharesTable.documentId, documentId));
  }

  async createDocumentShare(share: InsertDocumentShare): Promise<DocumentShare> {
    const result = await db.insert(documentSharesTable).values({
      ...share,
      id: randomUUID(),
    }).returning();
    return result[0];
  }

  async deleteDocumentShare(documentId: string, entityType: string, entityId: string): Promise<boolean> {
    const result = await db.delete(documentSharesTable).where(
      and(
        eq(documentSharesTable.documentId, documentId),
        eq(documentSharesTable.entityType, entityType as any),
        eq(documentSharesTable.entityId, entityId),
      )
    ).returning();
    return result.length > 0;
  }

  async getCompanyScopedDocuments(companyId: string, module?: ModuleType, includeArchived = false): Promise<Document[]> {
    const docs = await db.select().from(documentsTable).where(
      and(
        eq(documentsTable.entityId, companyId),
        isNull(documentsTable.siteId),
        ...(module ? [eq(documentsTable.module, module as any)] : []),
        ...(includeArchived ? [] : [eq(documentsTable.isArchived, false)]),
      )
    );
    return docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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

  async getUserActivityLogs(userId: string): Promise<AuditLog[]> {
    const allLogs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt));
    return allLogs.filter(log => {
      // Actions performed BY this user
      if (log.userId === userId) return true;
      // Events directed AT this user (email sent to them, etc.) stored in metadata
      if (log.metadata) {
        try {
          const meta = JSON.parse(log.metadata);
          if (meta.targetUserId === userId) return true;
        } catch {}
      }
      return false;
    });
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
    // Calculate missing required templates
    let missingRequired = 0;
    const relevantSiteIds = siteId 
      ? [siteId]
      : companyId 
        ? (await db.select().from(sitesTable).where(eq(sitesTable.companyId, companyId))).map(s => s.id)
        : (await db.select().from(sitesTable)).map(s => s.id);
    
    const allTemplates = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.isActive, true));
    const templateMap = new Map(allTemplates.map(t => [t.id, t]));
    const companyReqCache = new Map<string, Awaited<ReturnType<typeof this.getCompanyRequiredTemplates>>>();
    const siteList = await db.select().from(sitesTable);
    const siteMap = new Map(siteList.map(s => [s.id, s]));
    
    for (const sid of relevantSiteIds) {
      const site = siteMap.get(sid);
      if (!site?.companyId) continue;
      if (!companyReqCache.has(site.companyId)) {
        companyReqCache.set(site.companyId, await this.getCompanyRequiredTemplates(site.companyId));
      }
      // Filter out soft-removed inherited rows (parent group dropped them) —
      // they remain visible in the Required Documents UI but must not count
      // as required slots for compliance.
      const companyRequired = companyReqCache.get(site.companyId)!.filter(r => !r.removedAt);
      const siteOverrides = await this.getSiteTemplateOverrides(sid);
      const excludedIds = new Set(siteOverrides.filter(o => o.action === "exclude").map(o => o.templateId));
      const includedIds = new Set(siteOverrides.filter(o => o.action === "include").map(o => o.templateId));
      const effectiveTemplateIds = [
        ...companyRequired.map(r => r.templateId).filter(id => !excludedIds.has(id)),
        ...[...includedIds].filter(id => !companyRequired.some(r => r.templateId === id)),
      ];

      const siteDocs = docs.filter(d => d.siteId === sid);
      for (const templateId of effectiveTemplateIds) {
        const tmpl = templateMap.get(templateId);
        if (!tmpl || tmpl.visibility !== "private") continue;
        if (module && tmpl.module !== module) continue;
        if (!module && tmpl.module === "training") continue;
        const isFulfilled = siteDocs.some(d => {
          if (d.templateId !== templateId) return false;
          if (d.status !== "compliant") return false;
          if (d.expiryDate && new Date(d.expiryDate) < new Date()) return false;
          if (d.renewalDate && new Date(d.renewalDate) < new Date()) return false;
          if (tmpl.requiresApproval && d.approvalStatus !== "approved") return false;
          return true;
        });
        if (!isFulfilled) missingRequired++;
      }
    }

    const total = docs.length + missingRequired;
    const compliant = docs.filter(d => d.status === "compliant").length;
    const review = docs.filter(d => d.status === "review_required").length;
    const overdue = docs.filter(d => d.status === "overdue").length;
    const pending = docs.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;
    
    return {
      totalDocuments: total,
      compliantDocuments: compliant,
      reviewRequired: review,
      overdueDocuments: overdue,
      missingRequiredDocuments: missingRequired,
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
        missingRequiredDocuments: 0,
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
    const conditions = [];
    if (!filters?.includeArchived) {
      conditions.push(eq(casesTable.isArchived, false));
    }
    if (filters?.siteId) {
      conditions.push(eq(casesTable.siteId, filters.siteId));
    }
    if (filters?.entityId) {
      conditions.push(eq(casesTable.entityId, filters.entityId));
    }
    if (filters?.status) {
      conditions.push(eq(casesTable.status, filters.status as CaseStatus));
    }
    const query = db.select().from(casesTable);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(casesTable.createdAt));
    }
    return await query.orderBy(desc(casesTable.createdAt));
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

  async getCaseByCaseNumber(caseNumber: string, excludeId?: string): Promise<Case | undefined> {
    const results = await db.select().from(casesTable).where(eq(casesTable.caseNumber, caseNumber));
    if (excludeId) return results.find(c => c.id !== excludeId);
    return results[0];
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

  async getCaseMilestonesForCases(caseIds: string[]): Promise<CaseMilestone[]> {
    if (caseIds.length === 0) return [];
    return db.select().from(caseMilestonesTable)
      .where(inArray(caseMilestonesTable.caseId, caseIds));
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

  // Case Document Checklist
  async getCaseDocumentChecklist(caseId: string): Promise<CaseDocumentChecklist[]> {
    return db.select().from(caseDocumentChecklistTable)
      .where(eq(caseDocumentChecklistTable.caseId, caseId))
      .orderBy(caseDocumentChecklistTable.createdAt);
  }

  async getCaseDocumentChecklistItem(id: string): Promise<CaseDocumentChecklist | undefined> {
    const [result] = await db.select().from(caseDocumentChecklistTable)
      .where(eq(caseDocumentChecklistTable.id, id));
    return result;
  }

  async createCaseDocumentChecklistItem(item: InsertCaseDocumentChecklist): Promise<CaseDocumentChecklist> {
    const now = new Date();
    const [result] = await db.insert(caseDocumentChecklistTable)
      .values({ ...item, createdAt: now, updatedAt: now })
      .returning();
    return result;
  }

  async updateCaseDocumentChecklistItem(id: string, updates: Partial<CaseDocumentChecklist>): Promise<CaseDocumentChecklist | undefined> {
    const [result] = await db.update(caseDocumentChecklistTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(caseDocumentChecklistTable.id, id))
      .returning();
    return result;
  }

  async deleteCaseDocumentChecklistItem(id: string): Promise<void> {
    await db.delete(caseDocumentChecklistTable).where(eq(caseDocumentChecklistTable.id, id));
  }

  // Case Bundles
  async getCaseBundles(caseId: string): Promise<CaseBundle[]> {
    return db.select().from(caseBundlesTable)
      .where(eq(caseBundlesTable.caseId, caseId))
      .orderBy(desc(caseBundlesTable.createdAt));
  }

  async getCaseBundle(id: string): Promise<CaseBundle | undefined> {
    const [result] = await db.select().from(caseBundlesTable).where(eq(caseBundlesTable.id, id));
    return result;
  }

  async createCaseBundle(bundle: InsertCaseBundle): Promise<CaseBundle> {
    const now = new Date();
    const [result] = await db.insert(caseBundlesTable).values({ ...bundle, createdAt: now, updatedAt: now }).returning();
    return result;
  }

  async updateCaseBundle(id: string, updates: Partial<CaseBundle>): Promise<CaseBundle | undefined> {
    const [result] = await db.update(caseBundlesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(caseBundlesTable.id, id))
      .returning();
    return result;
  }

  async deleteCaseBundle(id: string): Promise<void> {
    await db.delete(caseBundlesTable).where(eq(caseBundlesTable.id, id));
  }

  // Case Notes
  async getCaseNotes(caseId: string): Promise<CaseNote[]> {
    return db.select().from(caseNotesTable)
      .where(eq(caseNotesTable.caseId, caseId))
      .orderBy(desc(caseNotesTable.createdAt));
  }

  async getCaseNote(id: string): Promise<CaseNote | undefined> {
    const [result] = await db.select().from(caseNotesTable).where(eq(caseNotesTable.id, id));
    return result;
  }

  async createCaseNote(note: InsertCaseNote): Promise<CaseNote> {
    const now = new Date();
    const [result] = await db.insert(caseNotesTable)
      .values({ ...note, createdAt: now, updatedAt: now })
      .returning();
    return result;
  }

  async updateCaseNote(id: string, updates: Partial<CaseNote>): Promise<CaseNote | undefined> {
    const [result] = await db.update(caseNotesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(caseNotesTable.id, id))
      .returning();
    return result;
  }

  async deleteCaseNote(id: string): Promise<void> {
    await db.delete(caseNotesTable).where(eq(caseNotesTable.id, id));
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
      incidentTime: insertIncident.incidentTime ?? null,
      machineryInvolved: insertIncident.machineryInvolved ?? null,
      incidentNature: insertIncident.incidentNature ?? null,
      incidentCause: insertIncident.incidentCause ?? null,
      incidentEffect: insertIncident.incidentEffect ?? null,
      riddorResponsiblePerson: insertIncident.riddorResponsiblePerson ?? null,
      bodyDiagramMarkers: insertIncident.bodyDiagramMarkers ?? null,
      recommendations: insertIncident.recommendations ?? null,
      affectedPersonName: insertIncident.affectedPersonName ?? null,
      affectedPersonAddress: insertIncident.affectedPersonAddress ?? null,
      affectedPersonJobTitle: insertIncident.affectedPersonJobTitle ?? null,
      affectedPersonIsPublic: insertIncident.affectedPersonIsPublic ?? false,
      reportingPersonName: insertIncident.reportingPersonName ?? null,
      reportingPersonAddress: insertIncident.reportingPersonAddress ?? null,
      reportingPersonJobTitle: insertIncident.reportingPersonJobTitle ?? null,
      declarationName: insertIncident.declarationName ?? null,
      declarationDate: insertIncident.declarationDate ?? null,
      declarationSignature: insertIncident.declarationSignature ?? null,
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
  async getCompanyModuleAccess(companyId: string): Promise<{ healthSafety: boolean; humanResources: boolean; employmentLaw: boolean; training: boolean; toolkit: boolean; support: boolean; reports: boolean } | undefined> {
    const company = await this.getCompany(companyId);
    if (!company) return undefined;
    return {
      healthSafety: company.healthSafetyAccess,
      humanResources: company.humanResourcesAccess,
      employmentLaw: company.employmentLawAccess,
      training: company.trainingAccess,
      toolkit: company.toolkitAccess,
      support: company.supportAccess,
      reports: company.reportsAccess,
    };
  }

  async setCompanyModuleAccess(companyId: string, modules: { healthSafety?: boolean; humanResources?: boolean; employmentLaw?: boolean; training?: boolean; toolkit?: boolean; support?: boolean; reports?: boolean }): Promise<Company | undefined> {
    const company = await this.getCompany(companyId);
    if (!company) return undefined;
    
    const updateData: Partial<Company> = {};
    if (modules.healthSafety !== undefined) updateData.healthSafetyAccess = modules.healthSafety;
    if (modules.humanResources !== undefined) updateData.humanResourcesAccess = modules.humanResources;
    if (modules.employmentLaw !== undefined) updateData.employmentLawAccess = modules.employmentLaw;
    if (modules.training !== undefined) updateData.trainingAccess = modules.training;
    if (modules.toolkit !== undefined) updateData.toolkitAccess = modules.toolkit;
    if (modules.support !== undefined) updateData.supportAccess = modules.support;
    if (modules.reports !== undefined) updateData.reportsAccess = modules.reports;
    
    const [updated] = await db.update(companiesTable).set(updateData).where(eq(companiesTable.id, companyId)).returning();
    return updated;
  }

  async hasCompanyModuleAccess(companyId: string, module: ModuleType): Promise<boolean> {
    const company = await this.getCompany(companyId);
    if (!company) return false;
    
    let ownAccess: boolean;
    switch (module) {
      case "health_safety":
        ownAccess = company.healthSafetyAccess; break;
      case "human_resources":
        ownAccess = company.humanResourcesAccess; break;
      case "employment_law":
        ownAccess = company.employmentLawAccess; break;
      case "training":
        ownAccess = company.trainingAccess; break;
      case "toolkit":
        ownAccess = company.toolkitAccess; break;
      case "support":
        ownAccess = company.supportAccess; break;
      case "reports":
        ownAccess = company.reportsAccess; break;
      default:
        return false;
    }
    
    if (ownAccess) return true;
    
    const inherited = await this.getGroupOwnerInheritedAccess(companyId);
    switch (module) {
      case "health_safety": return inherited.healthSafety;
      case "human_resources": return inherited.humanResources;
      case "employment_law": return inherited.employmentLaw;
      case "training": return inherited.training;
      case "toolkit": return inherited.toolkit;
      case "support": return inherited.support;
      case "reports": return inherited.reports;
      default: return false;
    }
  }

  async getGroupOwnerInheritedAccess(companyId: string): Promise<{ healthSafety: boolean; humanResources: boolean; employmentLaw: boolean; training: boolean; toolkit: boolean; support: boolean; reports: boolean }> {
    const empty = { healthSafety: false, humanResources: false, employmentLaw: false, training: false, toolkit: false, support: false, reports: false };
    const members = await this.getGroupMembers(companyId);
    if (!members.length) return empty;
    return {
      healthSafety: members.some(m => m.healthSafetyAccess),
      humanResources: members.some(m => m.humanResourcesAccess),
      employmentLaw: members.some(m => m.employmentLawAccess),
      training: members.some(m => m.trainingAccess),
      toolkit: members.some(m => m.toolkitAccess),
      support: members.some(m => m.supportAccess),
      reports: members.some(m => m.reportsAccess),
    };
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

  async clearClientSiteAssignments(clientId: string): Promise<void> {
    await db.delete(clientSiteAssignmentsTable)
      .where(eq(clientSiteAssignmentsTable.clientId, clientId));
  }

  async hasClientSiteAssignments(clientId: string): Promise<boolean> {
    const result = await db.select().from(clientSiteAssignmentsTable)
      .where(eq(clientSiteAssignmentsTable.clientId, clientId));
    return result.length > 0;
  }

  // Users by Company (get all users associated with a company)
  async getUsersBySite(siteId: string): Promise<User[]> {
    try {
      // Get client users explicitly assigned to this specific site via clientSiteAssignments
      const assignments = await db
        .select()
        .from(clientSiteAssignmentsTable)
        .where(eq(clientSiteAssignmentsTable.siteId, siteId));
      const clientIds = assignments.map((a) => a.clientId);
      if (clientIds.length === 0) return [];
      return await db
        .select()
        .from(usersTable)
        .where(inArray(usersTable.id, clientIds));
    } catch (error) {
      console.error("Error fetching users by site from DB:", error);
      return [];
    }
  }

  async getUsersByCompany(companyId: string): Promise<User[]> {
    try {
      return await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.companyId, companyId),
            eq(usersTable.role, "client")
          )
        );
    } catch (error) {
      console.error("Error fetching users by company from DB:", error);
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

  async getConsultantsByManager(managerId: string): Promise<User[]> {
    try {
      return await db.select().from(usersTable).where(
        and(eq(usersTable.role, "consultant"), eq(usersTable.managerId, managerId))
      );
    } catch (error) {
      console.error("Error fetching consultants by manager from DB:", error);
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
    // Collect folder IDs that belong to cases so we can exclude them
    const caseFolders = await db.select({ folderId: casesTable.folderId })
      .from(casesTable)
      .where(eq(casesTable.siteId, siteId));
    const caseFolderIds = caseFolders.map(c => c.folderId).filter(Boolean) as string[];

    let query = db.select().from(documentFoldersTable)
      .where(
        caseFolderIds.length > 0
          ? and(eq(documentFoldersTable.siteId, siteId), sql`${documentFoldersTable.id} NOT IN (${sql.join(caseFolderIds.map(id => sql`${id}`), sql`, `)})`)
          : eq(documentFoldersTable.siteId, siteId)
      )
      .orderBy(asc(documentFoldersTable.sortOrder));

    let folders = await query;
    if (module) {
      folders = folders.filter(f => f.module === module);
    }
    return folders;
  }

  // Folders scoped to a company or group (siteId is null for these)
  async getScopedDocumentFolders(scope: "company" | "group", entityId: string, module?: ModuleType): Promise<DocumentFolder[]> {
    let folders = await db.select().from(documentFoldersTable)
      .where(and(
        eq(documentFoldersTable.scope, scope),
        eq(documentFoldersTable.entityId, entityId),
      ))
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
      siteId: folder.siteId ?? null,
      scope: (folder as any).scope ?? "site",
      entityId: (folder as any).entityId ?? null,
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

  // Document Pathways
  async getDocumentPathways(module?: string): Promise<DocumentPathway[]> {
    if (module) {
      // Return pathways for this specific module OR module-agnostic pathways (null)
      return await db.select().from(documentPathwaysTable)
        .where(
          sql`(${documentPathwaysTable.module} = ${module} OR ${documentPathwaysTable.module} IS NULL)`
        )
        .orderBy(asc(documentPathwaysTable.sortOrder), asc(documentPathwaysTable.createdAt));
    }
    return await db.select().from(documentPathwaysTable)
      .orderBy(asc(documentPathwaysTable.sortOrder), asc(documentPathwaysTable.createdAt));
  }

  async getDocumentPathway(id: string): Promise<DocumentPathway | undefined> {
    const [result] = await db.select().from(documentPathwaysTable).where(eq(documentPathwaysTable.id, id));
    return result;
  }

  async createDocumentPathway(pathway: InsertDocumentPathway): Promise<DocumentPathway> {
    const [result] = await db.insert(documentPathwaysTable).values(pathway).returning();
    return result;
  }

  async updateDocumentPathway(id: string, updates: Partial<DocumentPathway>): Promise<DocumentPathway | undefined> {
    const [result] = await db.update(documentPathwaysTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documentPathwaysTable.id, id))
      .returning();
    return result;
  }

  async deleteDocumentPathway(id: string): Promise<boolean> {
    const result = await db.delete(documentPathwaysTable).where(eq(documentPathwaysTable.id, id)).returning();
    return result.length > 0;
  }

  async getTrainingPathways(module?: string): Promise<TrainingPathway[]> {
    if (module) {
      return await db.select().from(trainingPathwaysTable)
        .where(sql`(${trainingPathwaysTable.module} = ${module} OR ${trainingPathwaysTable.module} IS NULL)`)
        .orderBy(asc(trainingPathwaysTable.sortOrder), asc(trainingPathwaysTable.createdAt));
    }
    return await db.select().from(trainingPathwaysTable)
      .orderBy(asc(trainingPathwaysTable.sortOrder), asc(trainingPathwaysTable.createdAt));
  }

  async getTrainingPathway(id: string): Promise<TrainingPathway | undefined> {
    const [result] = await db.select().from(trainingPathwaysTable).where(eq(trainingPathwaysTable.id, id));
    return result;
  }

  async createTrainingPathway(pathway: InsertTrainingPathway): Promise<TrainingPathway> {
    const [result] = await db.insert(trainingPathwaysTable).values(pathway).returning();
    return result;
  }

  async updateTrainingPathway(id: string, updates: Partial<TrainingPathway>): Promise<TrainingPathway | undefined> {
    const [result] = await db.update(trainingPathwaysTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(trainingPathwaysTable.id, id))
      .returning();
    return result;
  }

  async deleteTrainingPathway(id: string): Promise<boolean> {
    const result = await db.delete(trainingPathwaysTable).where(eq(trainingPathwaysTable.id, id)).returning();
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

  async getToolkitStats(filter?: { companyName?: string; userId?: string }) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const buildWhere = (extra?: any) => {
      const conditions = [];
      if (filter?.userId) {
        conditions.push(eq(toolkitDownloadsTable.userId, filter.userId));
      } else if (filter?.companyName) {
        conditions.push(eq(toolkitDownloadsTable.companyName, filter.companyName));
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
        module: documentTemplatesTable.module,
        folderName: toolkitFoldersTable.name,
        fileUrl: documentTemplatesTable.fileUrl,
        fileName: documentTemplatesTable.fileName,
        downloadedAt: toolkitDownloadsTable.downloadedAt,
        downloadedBy: toolkitDownloadsTable.userName,
        companyName: toolkitDownloadsTable.companyName,
        siteName: toolkitDownloadsTable.siteName,
      })
      .from(toolkitDownloadsTable)
      .leftJoin(documentTemplatesTable, eq(documentTemplatesTable.id, toolkitDownloadsTable.templateId))
      .leftJoin(toolkitFoldersTable, eq(toolkitFoldersTable.id, documentTemplatesTable.toolkitFolderId))
      .orderBy(desc(toolkitDownloadsTable.downloadedAt))
      .limit(30);

    const recentDownloads = totalWhere
      ? await recentQuery.where(totalWhere)
      : await recentQuery;

    const byModuleQuery = db
      .select({
        module: documentTemplatesTable.module,
        count: count(),
      })
      .from(toolkitDownloadsTable)
      .leftJoin(documentTemplatesTable, eq(documentTemplatesTable.id, toolkitDownloadsTable.templateId))
      .groupBy(documentTemplatesTable.module);

    const byModuleRows = totalWhere
      ? await byModuleQuery.where(totalWhere)
      : await byModuleQuery;

    const downloadsByModule = {
      health_safety: byModuleRows.find(r => r.module === "health_safety")?.count ?? 0,
      human_resources: byModuleRows.find(r => r.module === "human_resources")?.count ?? 0,
      employment_law: byModuleRows.find(r => r.module === "employment_law")?.count ?? 0,
    };

    return {
      totalDownloads: totalRow?.count ?? 0,
      downloadsLast30Days: last30Row?.count ?? 0,
      downloadsByModule,
      recentDownloads: recentDownloads.map(r => ({
        id: r.id,
        templateName: r.templateName ?? 'Unknown',
        templateId: r.templateId,
        module: r.module ?? null,
        folderName: r.folderName ?? null,
        fileUrl: r.fileUrl ?? null,
        fileName: r.fileName ?? null,
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

  async seedToolkitRootFolders(): Promise<void> {
    const modules: ModuleType[] = ["health_safety", "human_resources", "employment_law"];
    for (const module of modules) {
      const existing = await this.getModuleToolkitRootFolder(module);
      if (!existing) {
        const payload: InsertFolderTemplate = {
          name: "Toolkit",
          module,
          isRequired: false,
          sortOrder: 0,
          isActive: true,
          isLocked: true,
          createdBy: "system",
        };
        await this.createFolderTemplate(payload);
        console.log(`[seed] Created locked root Toolkit folder for module: ${module}`);
      }
    }
    console.log("[seed] Toolkit root folder templates verified for all modules (health_safety, human_resources, employment_law)");
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
  
  async getDocumentTemplates(module?: ModuleType, folderTemplateId?: string, userSources?: string[]): Promise<DocumentTemplate[]> {
    let query = db.select().from(documentTemplatesTable);
    const conditions: ReturnType<typeof eq>[] = [];
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

    // Source filtering: if userSources provided, return only templates that have no
    // sources set (visible to all) OR share at least one source with the user.
    if (userSources !== undefined) {
      return templates.filter(t => {
        const ts = t.sources ?? [];
        if (ts.length === 0) return true; // no restriction — visible to all
        return userSources.some(s => ts.includes(s));
      });
    }
    return templates;
  }

  async bulkUpdateTemplateSources(
    templateIds: string[],
    sources: string[],
    mode: "merge" | "clear"
  ): Promise<void> {
    if (!templateIds.length) return;
    for (const id of templateIds) {
      const [current] = await db.select({ sources: documentTemplatesTable.sources })
        .from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id));
      if (!current) continue;
      const newSources = mode === "clear"
        ? []
        : [...new Set([...(current.sources ?? []), ...sources])];
      await db.update(documentTemplatesTable)
        .set({ sources: newSources, updatedAt: new Date() })
        .where(eq(documentTemplatesTable.id, id));
    }
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

  async getDocumentTemplatesByIds(ids: string[]): Promise<DocumentTemplate[]> {
    if (!ids.length) return [];
    return await db.select().from(documentTemplatesTable)
      .where(sql`${documentTemplatesTable.id} = ANY(${ids})`);
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
      sources: template.sources ?? [],
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

  // Provision folder structure from templates for a site, company, or group
  async provisionFoldersFromTemplates(
    target: string | { scope: "company" | "group"; entityId: string },
    module: ModuleType,
    createdBy: string,
  ): Promise<DocumentFolder[]> {
    const isScoped = typeof target !== "string";
    const siteId = isScoped ? null : (target as string);
    const scope: "site" | "company" | "group" = isScoped ? (target as any).scope : "site";
    const entityId = isScoped ? (target as any).entityId : null;

    const templates = await this.getFolderTemplates(module);
    // Exclude locked Toolkit root folders and their mirrored subfolders — these are Toolkit-only
    const activeTemplates = templates.filter(t => t.isActive && !(t as any).isLocked && !(t as any).toolkitFolderId);
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
        siteId: siteId as any,
        scope,
        entityId: entityId as any,
        parentId: parentFolderId,
        templateId: template.id,
        sortOrder: template.sortOrder,
        createdBy,
      } as any);
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
            comments: (doc as any).comments ?? null,
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
      module: item.module ?? null,
      sortOrder: item.sortOrder ?? 0,
      assignedUserId: item.assignedUserId ?? null,
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

  async updateFeedbackComment(id: string, content: string): Promise<FeedbackComment | undefined> {
    const [updated] = await db.update(feedbackCommentsTable)
      .set({ content, updatedAt: new Date() })
      .where(eq(feedbackCommentsTable.id, id))
      .returning();
    return updated;
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
    // Soft-invalidate: mark superseded invites with invalidated_at instead of deleting.
    // This lets the validation endpoint return a clearer message when a user clicks
    // a link from an older email that has since been replaced.
    const now = new Date();
    if (purpose) {
      await db.update(userInvitationsTable)
        .set({ invalidatedAt: now })
        .where(and(
          eq(userInvitationsTable.userId, userId),
          eq(userInvitationsTable.purpose, purpose),
          isNull(userInvitationsTable.invalidatedAt),
          isNull(userInvitationsTable.usedAt),
        ));
    } else {
      await db.update(userInvitationsTable)
        .set({ invalidatedAt: now })
        .where(and(
          eq(userInvitationsTable.userId, userId),
          isNull(userInvitationsTable.invalidatedAt),
          isNull(userInvitationsTable.usedAt),
        ));
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

  async getCompanyRequiredTemplates(companyId: string): Promise<CompanyRequiredTemplate[]> {
    return db.select().from(companyRequiredTemplatesTable)
      .where(eq(companyRequiredTemplatesTable.companyId, companyId));
  }

  async setCompanyRequiredTemplates(companyId: string, templateIds: string[], createdBy: string): Promise<CompanyRequiredTemplate[]> {
    const previous = await db.select().from(companyRequiredTemplatesTable)
      .where(eq(companyRequiredTemplatesTable.companyId, companyId));
    const previousIds = new Set(previous.map(p => p.templateId));
    const nextIds = new Set(templateIds);
    const toAdd = templateIds.filter(t => !previousIds.has(t));
    const toRemove = [...previousIds].filter(t => !nextIds.has(t));

    await db.delete(companyRequiredTemplatesTable)
      .where(eq(companyRequiredTemplatesTable.companyId, companyId));

    let inserted: CompanyRequiredTemplate[] = [];
    if (templateIds.length > 0) {
      const values = templateIds.map(templateId => ({ companyId, templateId, createdBy }));
      inserted = await db.insert(companyRequiredTemplatesTable).values(values).returning();
    }

    // Cascade additions/removals to member companies if this is a group owner.
    const members = await db.select({ id: companiesTable.id }).from(companiesTable)
      .where(eq(companiesTable.groupOwnerId, companyId));
    if (members.length > 0) {
      const memberIds = members.map(m => m.id);
      if (toAdd.length > 0) {
        // Reactivate any previously soft-removed inherited rows on members
        // before inserting — covers re-tick after un-tick at group level.
        await db.update(companyRequiredTemplatesTable)
          .set({ removedAt: null, inheritedFromCompanyId: companyId })
          .where(and(
            inArray(companyRequiredTemplatesTable.companyId, memberIds),
            inArray(companyRequiredTemplatesTable.templateId, toAdd),
          ));
        const memberValues = members.flatMap(m => toAdd.map(templateId => ({
          companyId: m.id,
          templateId,
          createdBy,
          inheritedFromCompanyId: companyId,
        })));
        await db.insert(companyRequiredTemplatesTable).values(memberValues).onConflictDoNothing();
      }
      if (toRemove.length > 0) {
        // Soft-remove (instead of delete) inherited rows so they remain
        // visible at the company/site level as struck-through "previously
        // inherited, no longer required" entries. Member-managed rows
        // (inheritedFromCompanyId IS NULL or differs) are untouched.
        await db.update(companyRequiredTemplatesTable)
          .set({ removedAt: new Date() })
          .where(and(
            inArray(companyRequiredTemplatesTable.companyId, memberIds),
            inArray(companyRequiredTemplatesTable.templateId, toRemove),
            eq(companyRequiredTemplatesTable.inheritedFromCompanyId, companyId),
            isNull(companyRequiredTemplatesTable.removedAt),
          ));
      }
    }
    return inserted;
  }

  async addCompanyRequiredTemplate(companyId: string, templateId: string, createdBy: string): Promise<CompanyRequiredTemplate> {
    const [existing] = await db.select().from(companyRequiredTemplatesTable)
      .where(and(eq(companyRequiredTemplatesTable.companyId, companyId), eq(companyRequiredTemplatesTable.templateId, templateId)));
    let result = existing;
    if (result) {
      // If the existing row was soft-removed (i.e. the parent group had
      // dropped this template and we're now re-adding it), reactivate it.
      if (result.removedAt) {
        const [reactivated] = await db.update(companyRequiredTemplatesTable)
          .set({ removedAt: null })
          .where(eq(companyRequiredTemplatesTable.id, result.id))
          .returning();
        result = reactivated;
      }
    } else {
      const [inserted] = await db.insert(companyRequiredTemplatesTable)
        .values({ companyId, templateId, createdBy })
        .returning();
      result = inserted;
    }
    // Cascade: if this company is a group owner (has member companies),
    // copy the requirement into each member company so it shows up at the
    // company level and can then be managed independently. Reactivate any
    // soft-removed inherited rows on members first so a re-add at group
    // level cleanly restores the requirement everywhere it was previously
    // dropped (no orphan struck-through entries).
    const members = await db.select({ id: companiesTable.id }).from(companiesTable)
      .where(eq(companiesTable.groupOwnerId, companyId));
    if (members.length > 0) {
      const memberIds = members.map(m => m.id);
      await db.update(companyRequiredTemplatesTable)
        .set({ removedAt: null, inheritedFromCompanyId: companyId })
        .where(and(
          inArray(companyRequiredTemplatesTable.companyId, memberIds),
          eq(companyRequiredTemplatesTable.templateId, templateId),
        ));
      const memberValues = members.map(m => ({
        companyId: m.id,
        templateId,
        createdBy,
        inheritedFromCompanyId: companyId,
      }));
      await db.insert(companyRequiredTemplatesTable).values(memberValues).onConflictDoNothing();
    }
    return result;
  }

  async removeCompanyRequiredTemplate(companyId: string, templateId: string): Promise<boolean> {
    const [existing] = await db.select().from(companyRequiredTemplatesTable)
      .where(and(
        eq(companyRequiredTemplatesTable.companyId, companyId),
        eq(companyRequiredTemplatesTable.templateId, templateId),
      ));
    if (!existing) return false;

    const company = await this.getCompany(companyId);
    const isMemberInherited =
      !!company?.groupOwnerId &&
      !!existing.inheritedFromCompanyId &&
      existing.inheritedFromCompanyId === company.groupOwnerId;

    // Member-level removal of an inherited row is allowed but is a SOFT-
    // remove on first click — the row stays visible at the company and its
    // sites as a struck-through "was required, not anymore" entry instead of
    // disappearing, so users can see what was previously inherited. A second
    // click on an already-soft-removed row permanently deletes it from this
    // member only (re-adding at the group level inserts a fresh inherited
    // row by the existing add-cascade).
    if (isMemberInherited && !existing.removedAt) {
      await db.update(companyRequiredTemplatesTable)
        .set({ removedAt: new Date() })
        .where(eq(companyRequiredTemplatesTable.id, existing.id));
      return true;
    }

    const result = await db.delete(companyRequiredTemplatesTable)
      .where(eq(companyRequiredTemplatesTable.id, existing.id));
    // Cascade to member companies: SOFT-remove (set removedAt) inherited rows
    // instead of deleting, so the row stays visible at the company/site level
    // as a struck-through "previously inherited, no longer required" entry.
    // Independently-managed member entries (different inheritedFromCompanyId
    // or NULL) are untouched.
    const members = await db.select({ id: companiesTable.id }).from(companiesTable)
      .where(eq(companiesTable.groupOwnerId, companyId));
    if (members.length > 0) {
      await db.update(companyRequiredTemplatesTable)
        .set({ removedAt: new Date() })
        .where(and(
          inArray(companyRequiredTemplatesTable.companyId, members.map(m => m.id)),
          eq(companyRequiredTemplatesTable.templateId, templateId),
          eq(companyRequiredTemplatesTable.inheritedFromCompanyId, companyId),
          isNull(companyRequiredTemplatesTable.removedAt),
        ));
    }
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Idempotent backfill ensuring every member company carries every required
   * template defined on its parent group, with `inheritedFromCompanyId` set so
   * future remove-cascades work. Existing rows are left alone (onConflictDoNothing),
   * including member-owned rows whose templateId happens to match a group
   * requirement (those remain "own"). Run on startup to repair any historical
   * cascade gaps (e.g. requirements added before the cascade hooks existed,
   * or rows previously removed at the member level back when that was allowed).
   */
  async backfillGroupRequiredTemplatesCascade(): Promise<{ inserted: number }> {
    // Fetch all member companies (those with groupOwnerId set).
    const members = await db.select({ id: companiesTable.id, groupOwnerId: companiesTable.groupOwnerId })
      .from(companiesTable)
      .where(sql`${companiesTable.groupOwnerId} IS NOT NULL`);
    if (members.length === 0) return { inserted: 0 };
    // Group members by their parent group owner so we fetch each group's
    // requirements at most once.
    const membersByGroup = new Map<string, string[]>();
    for (const m of members) {
      if (!m.groupOwnerId) continue;
      const arr = membersByGroup.get(m.groupOwnerId) ?? [];
      arr.push(m.id);
      membersByGroup.set(m.groupOwnerId, arr);
    }
    let totalInserted = 0;
    for (const [groupOwnerId, memberIds] of membersByGroup.entries()) {
      const groupReqs = await db.select().from(companyRequiredTemplatesTable)
        .where(eq(companyRequiredTemplatesTable.companyId, groupOwnerId));
      if (groupReqs.length === 0) continue;
      const groupTemplateIds = groupReqs.map(r => r.templateId);
      // Reactivate any soft-removed inherited rows for templates currently
      // required at the group — covers historical removes that ran while
      // the soft-remove logic was incomplete or out-of-sync.
      await db.update(companyRequiredTemplatesTable)
        .set({ removedAt: null, inheritedFromCompanyId: groupOwnerId })
        .where(and(
          inArray(companyRequiredTemplatesTable.companyId, memberIds),
          inArray(companyRequiredTemplatesTable.templateId, groupTemplateIds),
          eq(companyRequiredTemplatesTable.inheritedFromCompanyId, groupOwnerId),
        ));
      const values = memberIds.flatMap(memberId =>
        groupReqs.map(r => ({
          companyId: memberId,
          templateId: r.templateId,
          createdBy: r.createdBy,
          inheritedFromCompanyId: groupOwnerId,
        }))
      );
      const inserted = await db.insert(companyRequiredTemplatesTable)
        .values(values)
        .onConflictDoNothing()
        .returning({ id: companyRequiredTemplatesTable.id });
      totalInserted += inserted.length;
    }
    return { inserted: totalInserted };
  }

  async getSiteTemplateOverrides(siteId: string): Promise<SiteTemplateOverride[]> {
    return db.select().from(siteTemplateOverridesTable)
      .where(eq(siteTemplateOverridesTable.siteId, siteId));
  }

  async setSiteTemplateOverride(siteId: string, templateId: string, action: "include" | "exclude", createdBy: string): Promise<SiteTemplateOverride> {
    const [result] = await db.insert(siteTemplateOverridesTable)
      .values({ siteId, templateId, action, createdBy })
      .onConflictDoUpdate({
        target: [siteTemplateOverridesTable.siteId, siteTemplateOverridesTable.templateId],
        set: { action, createdBy },
      })
      .returning();
    return result;
  }

  async removeSiteTemplateOverride(siteId: string, templateId: string): Promise<boolean> {
    const result = await db.delete(siteTemplateOverridesTable)
      .where(and(
        eq(siteTemplateOverridesTable.siteId, siteId),
        eq(siteTemplateOverridesTable.templateId, templateId),
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async getCompanyTemplateOverrides(companyId: string): Promise<CompanyTemplateOverride[]> {
    return db.select().from(companyTemplateOverridesTable)
      .where(eq(companyTemplateOverridesTable.companyId, companyId));
  }

  async setCompanyTemplateOverride(companyId: string, templateId: string, action: "include" | "exclude", createdBy: string): Promise<CompanyTemplateOverride> {
    const [result] = await db.insert(companyTemplateOverridesTable)
      .values({ companyId, templateId, action, createdBy })
      .onConflictDoUpdate({
        target: [companyTemplateOverridesTable.companyId, companyTemplateOverridesTable.templateId],
        set: { action, createdBy },
      })
      .returning();
    return result;
  }

  async removeCompanyTemplateOverride(companyId: string, templateId: string): Promise<boolean> {
    const result = await db.delete(companyTemplateOverridesTable)
      .where(and(
        eq(companyTemplateOverridesTable.companyId, companyId),
        eq(companyTemplateOverridesTable.templateId, templateId),
      ));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Returns the set of *active* required template IDs for a company — i.e.
   * excludes soft-removed inherited rows (rows with `removedAt` set, which
   * the parent group has dropped from its required list). Soft-removed rows
   * remain visible in the company's Required Documents UI as struck-through
   * "previously inherited, no longer required" entries, but they no longer
   * affect compliance — sites must not count them as required slots.
   */
  async getEffectiveCompanyRequiredTemplateIds(companyId: string): Promise<Set<string>> {
    const ownReqs = await this.getCompanyRequiredTemplates(companyId);
    return new Set(ownReqs.filter(r => !r.removedAt).map(r => r.templateId));
  }

  // Seed example pathways if none exist
  async seedExamplePathways(): Promise<void> {
    try {
      const existing = await db.select().from(documentPathwaysTable).limit(1);
      if (existing.length > 0) return; // Already seeded

      const hsTree: PathwayNode = {
        question: "What type of health & safety document do you need?",
        answers: [
          {
            label: "Risk Assessment",
            description: "Identify hazards and control measures",
            next: {
              question: "Which area does this risk assessment cover?",
              answers: [
                { label: "General workplace risk assessment", templateIds: [] },
                { label: "COSHH (hazardous substances)", templateIds: [] },
                { label: "Manual handling", templateIds: [] },
                { label: "Fire risk assessment", templateIds: [] },
              ],
            },
          },
          {
            label: "Policy or Procedure",
            description: "Formal written H&S policy or procedure",
            next: {
              question: "What does the policy or procedure relate to?",
              answers: [
                { label: "Health & Safety Policy Statement", templateIds: [] },
                { label: "Emergency evacuation procedure", templateIds: [] },
                { label: "First aid policy", templateIds: [] },
                { label: "Lone working policy", templateIds: [] },
              ],
            },
          },
          {
            label: "Inspection or Audit",
            description: "Checklists for workplace inspections and audits",
            templateIds: [],
          },
        ],
      };

      const hrTree: PathwayNode = {
        question: "What HR situation are you dealing with?",
        answers: [
          {
            label: "A new employee is starting",
            description: "Onboarding, contracts, and first-day documentation",
            next: {
              question: "What do you need for the new starter?",
              answers: [
                { label: "Employment contract", templateIds: [] },
                { label: "Offer letter", templateIds: [] },
                { label: "Induction checklist", templateIds: [] },
              ],
            },
          },
          {
            label: "Managing absence",
            description: "Short-term, long-term sickness, or unauthorised absence",
            next: {
              question: "What type of absence?",
              answers: [
                { label: "Short-term sickness absence", templateIds: [] },
                { label: "Long-term sickness absence", templateIds: [] },
                { label: "Unauthorised absence", templateIds: [] },
                { label: "Return to work", templateIds: [] },
              ],
            },
          },
          {
            label: "Disciplinary or performance issue",
            description: "Formal disciplinary, warnings, or performance management",
            next: {
              question: "What stage is the process at?",
              answers: [
                { label: "Informal discussion / first warning", templateIds: [] },
                { label: "Formal disciplinary hearing", templateIds: [] },
                { label: "Performance improvement plan", templateIds: [] },
                { label: "Dismissal or final warning", templateIds: [] },
              ],
            },
          },
        ],
      };

      // templateIds arrays are intentionally empty in seed data — they act as
      // placeholder leaf endpoints. Administrators should map real template IDs
      // through the Manage Pathways admin UI after the Toolkit library is populated.
      await db.insert(documentPathwaysTable).values([
        {
          id: "pathway-hs-default",
          title: "Find the Right H&S Document",
          description: "Quickly locate risk assessments, policies, and inspection checklists.",
          module: "health_safety" as const,
          tree: hsTree,
          isActive: true,
          sortOrder: 0,
          createdBy: "user-admin",
        },
        {
          id: "pathway-hr-default",
          title: "Find the Right HR Document",
          description: "Navigate contracts, absence management, and disciplinary templates.",
          module: "human_resources" as const,
          tree: hrTree,
          isActive: true,
          sortOrder: 0,
          createdBy: "user-admin",
        },
      ]).onConflictDoNothing();

      console.log("Example pathways seeded successfully.");
    } catch (error) {
      console.error("Error seeding example pathways:", error);
    }
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

  // ─── Testing Task Lists ──────────────────────────────────────────────────────

  async getTestingTaskLists(includeArchived = false): Promise<TestingTaskList[]> {
    if (includeArchived) {
      return db.select().from(testingTaskListsTable).orderBy(asc(testingTaskListsTable.createdAt));
    }
    return db.select().from(testingTaskListsTable)
      .where(eq(testingTaskListsTable.isArchived, false))
      .orderBy(asc(testingTaskListsTable.createdAt));
  }

  async getTestingTaskList(id: string): Promise<TestingTaskList | undefined> {
    const [row] = await db.select().from(testingTaskListsTable).where(eq(testingTaskListsTable.id, id));
    return row;
  }

  async createTestingTaskList(list: InsertTestingTaskList): Promise<TestingTaskList> {
    const [row] = await db.insert(testingTaskListsTable).values(list).returning();
    return row;
  }

  async updateTestingTaskList(id: string, updates: Partial<TestingTaskList>): Promise<TestingTaskList | undefined> {
    const [row] = await db.update(testingTaskListsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(testingTaskListsTable.id, id))
      .returning();
    return row;
  }

  async deleteTestingTaskList(id: string): Promise<boolean> {
    await db.delete(testingTaskAssignmentsTable).where(eq(testingTaskAssignmentsTable.taskListId, id));
    const result = await db.delete(testingTaskListsTable).where(eq(testingTaskListsTable.id, id)).returning();
    return result.length > 0;
  }

  async getTestingTaskAssignment(id: string): Promise<TestingTaskAssignment | undefined> {
    const [row] = await db.select().from(testingTaskAssignmentsTable).where(eq(testingTaskAssignmentsTable.id, id));
    return row;
  }

  async getTestingTaskAssignments(taskListId?: string): Promise<(TestingTaskAssignment & { assignedToUser?: Pick<User, "id" | "fullName" | "email"> })[]> {
    const rows = taskListId
      ? await db.select().from(testingTaskAssignmentsTable).where(eq(testingTaskAssignmentsTable.taskListId, taskListId))
      : await db.select().from(testingTaskAssignmentsTable);

    const result: (TestingTaskAssignment & { assignedToUser?: Pick<User, "id" | "fullName" | "email"> })[] = [];
    for (const row of rows) {
      const [user] = await db.select({ id: usersTable.id, fullName: usersTable.fullName, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, row.assignedTo));
      result.push({ ...row, assignedToUser: user });
    }
    return result;
  }

  async getMyTestingTaskAssignments(userId: string): Promise<(TestingTaskAssignment & { taskList: TestingTaskList })[]> {
    const rows = await db.select().from(testingTaskAssignmentsTable)
      .where(eq(testingTaskAssignmentsTable.assignedTo, userId));

    const result: (TestingTaskAssignment & { taskList: TestingTaskList })[] = [];
    for (const row of rows) {
      const [taskList] = await db.select().from(testingTaskListsTable)
        .where(eq(testingTaskListsTable.id, row.taskListId));
      if (taskList) result.push({ ...row, taskList });
    }
    return result;
  }

  async createTestingTaskAssignment(assignment: InsertTestingTaskAssignment): Promise<TestingTaskAssignment> {
    const [row] = await db.insert(testingTaskAssignmentsTable).values(assignment).returning();
    return row;
  }

  async updateTestingTaskAssignment(id: string, updates: Partial<TestingTaskAssignment>): Promise<TestingTaskAssignment | undefined> {
    const [row] = await db.update(testingTaskAssignmentsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(testingTaskAssignmentsTable.id, id))
      .returning();
    return row;
  }

  async deleteTestingTaskAssignment(id: string): Promise<boolean> {
    const result = await db.delete(testingTaskAssignmentsTable)
      .where(eq(testingTaskAssignmentsTable.id, id)).returning();
    return result.length > 0;
  }

  // ==================== SOURCES ====================
  private async seedTrainingPathways(): Promise<void> {
    try {
      const existing = await db.select().from(trainingPathwaysTable).limit(1);
      if (existing.length > 0) return;

      const pathways = [
        {
          title: "Health & Safety Training Finder",
          description: "Answer a few quick questions and we'll recommend the right H&S training course for your situation.",
          module: "health_safety" as const,
          isActive: true,
          sortOrder: 0,
          createdBy: "user-admin",
          tree: {
            question: "Who is the training for?",
            answers: [
              {
                label: "An individual employee",
                description: "Front-line staff or operatives who need specific skills training",
                next: {
                  question: "What type of work or activity do they carry out?",
                  answers: [
                    { label: "Working at height — ladders, scaffolding, roofing", description: "Any work where a person could fall from one level to another", courseIds: [] },
                    { label: "Fire safety or warden duties", description: "Fire marshal, warden, or emergency evacuation responsibilities", courseIds: [] },
                    { label: "General workplace health & safety awareness", description: "Foundational understanding of H&S rules and best practice", courseIds: [] },
                  ],
                },
              },
              {
                label: "A manager or supervisor",
                description: "Someone who oversees teams or is responsible for H&S compliance",
                next: {
                  question: "What do they primarily need to manage?",
                  answers: [
                    { label: "Overall H&S responsibilities and risk management", description: "Legal duties, risk assessments, incident management", courseIds: [] },
                    { label: "Teams working at height", description: "Supervising workers who operate at height", courseIds: [] },
                    { label: "Fire safety and emergency procedures", description: "Coordinating fire safety, drills, and evacuation across the site", courseIds: [] },
                  ],
                },
              },
              {
                label: "The whole team or organisation",
                description: "A business-wide training initiative covering all staff",
                courseIds: [],
              },
            ],
          },
        },
        {
          title: "Employment Law Training Finder",
          description: "Find training courses that cover your employment law needs.",
          module: "employment_law" as const,
          isActive: true,
          sortOrder: 0,
          createdBy: "user-admin",
          tree: {
            question: "What employment law topic do you need training on?",
            answers: [
              { label: "Disciplinary, grievance and dismissal", description: "Legal framework for handling employee disputes, misconduct, and fair dismissal", courseIds: [] },
              { label: "Equality, diversity and discrimination", description: "Protected characteristics, the Equality Act, and preventing discrimination", courseIds: [] },
              { label: "Employment contracts and terms", description: "Legal requirements around written statements, contracts, and working conditions", courseIds: [] },
              { label: "Redundancy and restructuring", description: "Legal procedures for ending employment fairly and managing organisational change", courseIds: [] },
              { label: "TUPE — business transfers", description: "Transfer of Undertakings and how they affect employees and employers", courseIds: [] },
            ],
          },
        },
        {
          title: "HR Training Finder",
          description: "Find the right HR training course for your team or situation.",
          module: "human_resources" as const,
          isActive: true,
          sortOrder: 0,
          createdBy: "user-admin",
          tree: {
            question: "What HR area does the training need to cover?",
            answers: [
              {
                label: "Disciplinary and grievance procedures",
                description: "How to handle misconduct, formal complaints, and employee disputes",
                next: {
                  question: "Who needs the training?",
                  answers: [
                    { label: "Managers and HR professionals conducting cases", description: "People who run investigations, hearings, and appeals", courseIds: [] },
                    { label: "Employees who want to understand the process", description: "Staff who need to know their rights and what to expect", courseIds: [] },
                  ],
                },
              },
              { label: "Employment rights and legislation", description: "Understanding legal requirements and obligations around employment", courseIds: [] },
              { label: "People management and leadership", description: "Skills for managing and developing your team effectively", courseIds: [] },
              { label: "Workplace wellbeing and absence management", description: "Supporting employee health, sickness, and return-to-work processes", courseIds: [] },
            ],
          },
        },
      ];

      for (const p of pathways) {
        await db.insert(trainingPathwaysTable).values(p as any);
      }
      console.log("Seeded 3 training pathways");
    } catch (err) {
      console.error("Error seeding training pathways:", err);
    }
  }

  private async seedSources(): Promise<void> {
    try {
      const existing = await db.select().from(sourcesTable).limit(1);
      if (existing.length > 0) return;
      const seeds = [
        { code: "GS", label: "Guardian Support" },
        { code: "WPHR", label: "Work Place HR" },
        { code: "SSD", label: "Safety Services Direct" },
        { code: "PSHR", label: "PS Human Resources" },
        { code: "IFRA", label: "Independent Fire Risk Assessments" },
        { code: "CQMS", label: "CQMS" },
        { code: "ELIA", label: "Employment Law in Action" },
        { code: "SPHERE", label: "Sphere RSM" },
      ];
      await db.insert(sourcesTable).values(seeds);
      console.log("Seeded 8 brand sources");
    } catch (err) {
      console.error("Error seeding sources:", err);
    }
  }

  async getSources(activeOnly = false): Promise<Source[]> {
    if (activeOnly) {
      return db.select().from(sourcesTable)
        .where(eq(sourcesTable.isActive, true))
        .orderBy(asc(sourcesTable.code));
    }
    return db.select().from(sourcesTable).orderBy(asc(sourcesTable.code));
  }

  async getSource(id: string): Promise<Source | undefined> {
    const [row] = await db.select().from(sourcesTable).where(eq(sourcesTable.id, id));
    return row;
  }

  async createSource(source: InsertSource): Promise<Source> {
    const [row] = await db.insert(sourcesTable).values(source).returning();
    return row;
  }

  async updateSource(id: string, updates: Partial<Source>): Promise<Source | undefined> {
    const [row] = await db.update(sourcesTable).set(updates).where(eq(sourcesTable.id, id)).returning();
    return row;
  }

  // Group Owner
  async getGroupMembers(groupOwnerId: string): Promise<Company[]> {
    return await db.select().from(companiesTable).where(eq(companiesTable.groupOwnerId, groupOwnerId));
  }

  async setGroupOwner(companyId: string, groupOwnerId: string | null): Promise<Company | undefined> {
    if (groupOwnerId === null) {
      const [updated] = await db.update(companiesTable)
        .set({ groupOwnerId: sql`NULL` })
        .where(eq(companiesTable.id, companyId))
        .returning();
      return updated;
    }
    const [updated] = await db.update(companiesTable)
      .set({ groupOwnerId })
      .where(eq(companiesTable.id, companyId))
      .returning();
    return updated;
  }

  // Portal Messages
  async getPortalMessages(opts: { publishedOnly?: boolean; role?: string } = {}): Promise<PortalMessage[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (opts.publishedOnly) {
      conditions.push(eq(portalMessagesTable.status, "published"));
      conditions.push(
        sql`(${portalMessagesTable.publishedAt} IS NULL OR ${portalMessagesTable.publishedAt} <= NOW())` as ReturnType<typeof eq>
      );
      conditions.push(
        sql`(${portalMessagesTable.expiresAt} IS NULL OR ${portalMessagesTable.expiresAt} > NOW())` as ReturnType<typeof eq>
      );
      if (opts.role) {
        conditions.push(
          sql`(array_length(${portalMessagesTable.targetRoles}, 1) IS NULL OR ${opts.role} = ANY(${portalMessagesTable.targetRoles}))` as ReturnType<typeof eq>
        );
      }
    }
    const query = db.select().from(portalMessagesTable);
    const results = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(portalMessagesTable.pinned), desc(portalMessagesTable.publishedAt))
      : await query.orderBy(desc(portalMessagesTable.createdAt));
    return results;
  }

  async getPortalMessage(id: string): Promise<PortalMessage | undefined> {
    const [row] = await db.select().from(portalMessagesTable).where(eq(portalMessagesTable.id, id));
    return row;
  }

  async createPortalMessage(data: InsertPortalMessage): Promise<PortalMessage> {
    const [row] = await db.insert(portalMessagesTable).values(data).returning();
    return row;
  }

  async updatePortalMessage(id: string, updates: Partial<PortalMessage>): Promise<PortalMessage | undefined> {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...safeUpdates } = updates;
    const [row] = await db.update(portalMessagesTable)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(portalMessagesTable.id, id))
      .returning();
    return row;
  }

  async deletePortalMessage(id: string): Promise<boolean> {
    const result = await db.delete(portalMessagesTable).where(eq(portalMessagesTable.id, id)).returning();
    return result.length > 0;
  }

}

export const storage = new MemStorage();
