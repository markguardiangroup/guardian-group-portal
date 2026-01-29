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
  trainingModules as trainingModulesTable,
  trainingFolders as trainingFoldersTable,
  trainingCourses as trainingCoursesTable,
  trainingRequests as trainingRequestsTable,
  trainingBookings as trainingBookingsTable,
  roadmapItems as roadmapItemsTable,
  moduleConfig,
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
  consultantAssignments as consultantAssignmentsTable,
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
  getDocuments(module?: ModuleType): Promise<Document[]>;
  getDocument(id: string): Promise<DocumentWithDetails | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  
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
  getCases(filters?: { siteId?: string; entityId?: string; status?: CaseStatus }): Promise<Case[]>;
  getCase(id: string): Promise<Case | undefined>;
  createCase(caseData: InsertCase): Promise<Case>;
  updateCase(id: string, updates: Partial<Case>): Promise<Case | undefined>;
  getCaseDocuments(caseId: string): Promise<Document[]>;
  
  // Case Milestones
  getCaseMilestones(caseId: string): Promise<CaseMilestone[]>;
  getCaseMilestone(id: string): Promise<CaseMilestone | undefined>;
  createCaseMilestone(milestone: InsertCaseMilestone): Promise<CaseMilestone>;
  updateCaseMilestone(id: string, updates: Partial<CaseMilestone>): Promise<CaseMilestone | undefined>;
  deleteCaseMilestone(id: string): Promise<void>;
  
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
  
  // Folder Templates (Admin-managed master folder structure)
  getFolderTemplates(module?: ModuleType): Promise<FolderTemplate[]>;
  getFolderTemplate(id: string): Promise<FolderTemplate | undefined>;
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
  deleteDocumentTemplate(id: string, deletedBy: string, reason: string): Promise<boolean>;
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private companies: Map<string, Company>;
  private sites: Map<string, Site>;
  private documents: Map<string, Document>;
  private documentVersions: Map<string, DocumentVersion>;
  private documentFolders: Map<string, DocumentFolder>;
  private auditLogs: Map<string, AuditLog>;
  private supportRequests: Map<string, SupportRequest>;
  private supportMessages: Map<string, SupportMessage>;
  private siteDocumentTypeAccess: Map<string, SiteDocumentTypeAccess>;
  private cases: Map<string, Case>;
  private caseMilestones: Map<string, CaseMilestone>;
  private siteModuleAccess: Map<string, SiteModuleAccess>;
  private moduleAccessRequests: Map<string, ModuleAccessRequest>;
  private consultantAssignments: Map<string, ConsultantAssignment>;
  private clientSiteAssignments: Map<string, ClientSiteAssignment>;
  private documentTypesMap: Map<string, DocumentTypeRecord>;
  private folderTemplates: Map<string, FolderTemplate>;
  private folderDocumentTypeRules: Map<string, FolderDocumentTypeRule>;
  private documentTemplates: Map<string, DocumentTemplate>;
  private documentTemplateVersions: Map<string, DocumentTemplateVersion>;
  private trainingModulesMap: Map<string, TrainingModule>;
  private supportRequestReads: Map<string, { requestId: string; userId: string; lastReadAt: Date }>;
  
  // Reference number counters
  private companyCounter: number = 0;
  private siteCounter: number = 0;
  private userCounter: number = 0;

  constructor() {
    this.users = new Map();
    this.companies = new Map();
    this.sites = new Map();
    this.documents = new Map();
    this.documentVersions = new Map();
    this.documentFolders = new Map();
    this.auditLogs = new Map();
    this.supportRequests = new Map();
    this.supportMessages = new Map();
    this.siteDocumentTypeAccess = new Map();
    this.cases = new Map();
    this.caseMilestones = new Map();
    this.siteModuleAccess = new Map();
    this.moduleAccessRequests = new Map();
    this.consultantAssignments = new Map();
    this.clientSiteAssignments = new Map();
    this.documentTypesMap = new Map();
    this.folderTemplates = new Map();
    this.folderDocumentTypeRules = new Map();
    this.documentTemplates = new Map();
    this.documentTemplateVersions = new Map();
    this.trainingModulesMap = new Map();
    this.supportRequestReads = new Map();
    
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const now = new Date();
    
    // Create sample users
    this.userCounter = 5; // Start counter after sample data
    const admin: User = {
      id: "user-admin",
      referenceNumber: "ADM-00001",
      username: "admin",
      password: "admin123",
      email: "admin@guardiangroup.com",
      fullName: "System Administrator",
      role: "admin",
      companyId: null,
      status: "active",
      consultantTier: null,
      clientPermissionRole: null,
      lastLoginAt: null,
      createdAt: now,
    };
    this.users.set(admin.id, admin);

    const consultant1: User = {
      id: "user-1",
      referenceNumber: "CON-00002",
      username: "john.doe",
      password: "consultant123",
      email: "john.doe@guardiangroup.com",
      fullName: "John Doe",
      role: "consultant",
      companyId: null,
      status: "active",
      consultantTier: "senior",
      clientPermissionRole: null,
      lastLoginAt: null,
      createdAt: now,
    };
    this.users.set(consultant1.id, consultant1);

    const consultant2: User = {
      id: "user-consultant-2",
      referenceNumber: "CON-00003",
      username: "jane.smith",
      password: "consultant123",
      email: "jane.smith@guardiangroup.com",
      fullName: "Jane Smith",
      role: "consultant",
      companyId: null,
      status: "active",
      consultantTier: "standard",
      clientPermissionRole: null,
      lastLoginAt: null,
      createdAt: now,
    };
    this.users.set(consultant2.id, consultant2);

    const client1: User = {
      id: "user-client-1",
      referenceNumber: "CLI-00004",
      username: "sarah.acme",
      password: "client123",
      email: "sarah@acme-mfg.com",
      fullName: "Sarah Johnson",
      role: "client",
      companyId: "company-1",
      status: "active",
      consultantTier: null,
      clientPermissionRole: "owner",
      lastLoginAt: null,
      createdAt: now,
    };
    this.users.set(client1.id, client1);

    const client2: User = {
      id: "user-client-2",
      referenceNumber: "CLI-00005",
      username: "emma.tech",
      password: "client123",
      email: "emma@techcorp.co.uk",
      fullName: "Emma Davis",
      role: "client",
      companyId: "company-2",
      status: "active",
      consultantTier: null,
      clientPermissionRole: "approver",
      lastLoginAt: null,
      createdAt: now,
    };
    this.users.set(client2.id, client2);

    // Create sample companies
    this.companyCounter = 2; // Start counter after sample data
    const sampleCompanies: Company[] = [
      {
        id: "company-1",
        referenceNumber: "CMP-00001",
        name: "Acme Manufacturing Ltd",
        companyNumber: "12345678",
        website: "https://acme-mfg.com",
        addressLine1: "123 Industrial Way",
        addressLine2: null,
        city: "Manchester",
        county: "Greater Manchester",
        postalCode: "M1 2AB",
        country: "United Kingdom",
        contactName: "Sarah Johnson",
        contactPosition: "Health & Safety Manager",
        contactEmail: "safety@acme-mfg.com",
        contactPhone: "+44 161 123 4567",
        status: "active",
        healthSafetyAccess: true,
        humanResourcesAccess: true,
        employmentLawAccess: true,
        supportAccess: true,
        reportsAccess: true,
        createdAt: now,
      },
      {
        id: "company-2",
        referenceNumber: "CMP-00002",
        name: "TechCorp Solutions",
        companyNumber: "87654321",
        website: "https://techcorp.co.uk",
        addressLine1: "456 Tech Park",
        addressLine2: null,
        city: "London",
        county: null,
        postalCode: "EC2A 4NE",
        country: "United Kingdom",
        contactName: "Emma Davis",
        contactPosition: "Compliance Director",
        contactEmail: "compliance@techcorp.co.uk",
        contactPhone: "+44 20 7123 4567",
        status: "active",
        healthSafetyAccess: true,
        humanResourcesAccess: false,
        employmentLawAccess: false,
        supportAccess: true,
        reportsAccess: false,
        createdAt: now,
      },
    ];
    sampleCompanies.forEach(company => this.companies.set(company.id, company));

    // Create sample sites (linked to companies via companyId)
    this.siteCounter = 3; // Start counter after sample data
    const sampleSites: Site[] = [
      {
        id: "site-1",
        referenceNumber: "STE-00001",
        companyId: "company-1",
        name: "Main Factory",
        addressLine1: "123 Industrial Way",
        addressLine2: null,
        city: "Manchester",
        county: "Greater Manchester",
        postalCode: "M1 2AB",
        country: "United Kingdom",
        contactName: "Sarah Johnson",
        contactPosition: "Site Manager",
        contactPhone: "+44 161 123 4567",
        contactEmail: "sarah@acme-mfg.com",
      },
      {
        id: "site-2",
        referenceNumber: "STE-00002",
        companyId: "company-1",
        name: "Warehouse North",
        addressLine1: "789 Logistics Road",
        addressLine2: null,
        city: "Manchester",
        county: "Greater Manchester",
        postalCode: "M3 4CD",
        country: "United Kingdom",
        contactName: "Mike Williams",
        contactPosition: "Warehouse Manager",
        contactPhone: "+44 161 123 4569",
        contactEmail: "mike@acme-mfg.com",
      },
      {
        id: "site-3",
        referenceNumber: "STE-00003",
        companyId: "company-2",
        name: "London Office",
        addressLine1: "456 Tech Park",
        addressLine2: null,
        city: "London",
        county: null,
        postalCode: "EC2A 4NE",
        country: "United Kingdom",
        contactName: "Emma Davis",
        contactPosition: "Office Manager",
        contactPhone: "+44 20 7123 4567",
        contactEmail: "emma@techcorp.co.uk",
      },
    ];
    sampleSites.forEach(site => this.sites.set(site.id, site));

    // Health & Safety Documents
    const hsDocs: Document[] = [
      {
        id: "doc-hs-1",
        title: "Health & Safety Policy 2024",
        description: "Company-wide health and safety policy document",
        module: "health_safety",
        type: "hs_policy",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "hs_policy_2024.pdf",
        fileSize: 245760,
        mimeType: "application/pdf",
        version: 3,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hs-2",
        title: "Fire Risk Assessment - Main Factory",
        description: "Annual fire risk assessment for the main manufacturing facility",
        module: "health_safety",
        type: "fire_safety",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "fire_risk_main_factory.pdf",
        fileSize: 512000,
        mimeType: "application/pdf",
        version: 1,
        status: "review_required",
        approvalStatus: "pending",
        reviewDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: "user-1",
        isArchived: false,
        createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hs-3",
        title: "COSHH Assessment - Chemical Storage",
        description: "Control of Substances Hazardous to Health assessment",
        module: "health_safety",
        type: "coshh_assessment",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "coshh_chemical_storage.pdf",
        fileSize: 384000,
        mimeType: "application/pdf",
        version: 2,
        status: "overdue",
        approvalStatus: "changes_requested",
        reviewDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: "user-1",
        isArchived: false,
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hs-4",
        title: "Risk Assessment - Office Workstation",
        description: "DSE assessment for office workstations",
        module: "health_safety",
        type: "risk_assessment",
        siteId: "site-3",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "dse_assessment.pdf",
        fileSize: 256000,
        mimeType: "application/pdf",
        version: 1,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      },
    ];

    // Human Resources Documents
    const hrDocs: Document[] = [
      {
        id: "doc-hr-1",
        title: "Employee Handbook 2024",
        description: "Comprehensive employee handbook with policies and procedures",
        module: "human_resources",
        type: "employee_handbook",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "employee_handbook_2024.pdf",
        fileSize: 1024000,
        mimeType: "application/pdf",
        version: 5,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-2",
        title: "Disciplinary Procedure",
        description: "Company disciplinary and grievance procedure",
        module: "human_resources",
        type: "disciplinary_procedure",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "disciplinary_procedure.pdf",
        fileSize: 320000,
        mimeType: "application/pdf",
        version: 2,
        status: "review_required",
        approvalStatus: "pending",
        reviewDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: "user-1",
        isArchived: false,
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-3",
        title: "Training Record - John Smith",
        description: "Training history and certifications for John Smith",
        module: "human_resources",
        type: "training_record",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "training_john_smith.pdf",
        fileSize: 128000,
        mimeType: "application/pdf",
        version: 1,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-4",
        title: "HR Policy - Remote Working",
        description: "Policy for remote and hybrid working arrangements",
        module: "human_resources",
        type: "hr_policy",
        siteId: "site-3",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "remote_working_policy.pdf",
        fileSize: 192000,
        mimeType: "application/pdf",
        version: 1,
        status: "overdue",
        approvalStatus: "changes_requested",
        reviewDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: "user-1",
        isArchived: false,
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-5",
        title: "Employment Contract - Standard Template",
        description: "Standard employment contract template for full-time employees",
        module: "human_resources",
        type: "employment_contract",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "employment_contract_template.pdf",
        fileSize: 285000,
        mimeType: "application/pdf",
        version: 4,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-6",
        title: "Grievance Procedure",
        description: "Formal grievance handling and resolution process",
        module: "human_resources",
        type: "grievance_procedure",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "grievance_procedure.pdf",
        fileSize: 198000,
        mimeType: "application/pdf",
        version: 2,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-7",
        title: "Performance Review - Q4 2024",
        description: "Quarterly performance review documentation",
        module: "human_resources",
        type: "performance_review",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "performance_review_q4_2024.pdf",
        fileSize: 156000,
        mimeType: "application/pdf",
        version: 1,
        status: "review_required",
        approvalStatus: "pending",
        reviewDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: "user-client-1",
        isArchived: false,
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-8",
        title: "Absence Management Policy",
        description: "Policy for managing employee absences and leave",
        module: "human_resources",
        type: "hr_policy",
        siteId: "site-3",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "absence_management_policy.pdf",
        fileSize: 245000,
        mimeType: "application/pdf",
        version: 3,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-9",
        title: "Training Record - Sarah Johnson",
        description: "Training history and certifications for Sarah Johnson",
        module: "human_resources",
        type: "training_record",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "training_sarah_johnson.pdf",
        fileSize: 142000,
        mimeType: "application/pdf",
        version: 2,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: new Date(now.getTime() + 270 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-10",
        title: "Absence Record - January 2025",
        description: "Monthly absence tracking report",
        module: "human_resources",
        type: "absence_record",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "absence_record_jan_2025.pdf",
        fileSize: 98000,
        mimeType: "application/pdf",
        version: 1,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: null,
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-11",
        title: "Employment Contract - Part-Time Template",
        description: "Employment contract template for part-time employees",
        module: "human_resources",
        type: "employment_contract",
        siteId: "site-3",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "employment_contract_parttime.pdf",
        fileSize: 265000,
        mimeType: "application/pdf",
        version: 2,
        status: "review_required",
        approvalStatus: "pending",
        reviewDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: "user-1",
        isArchived: false,
        createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-hr-12",
        title: "HR Policy - Equal Opportunities",
        description: "Equal opportunities and diversity policy statement",
        module: "human_resources",
        type: "hr_policy",
        siteId: "site-1",
        caseId: null,
        documentTypeId: null,
        folderId: null,
        fileName: "equal_opportunities_policy.pdf",
        fileSize: 178000,
        mimeType: "application/pdf",
        version: 1,
        status: "overdue",
        approvalStatus: "pending",
        reviewDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: "user-1",
        isArchived: false,
        createdAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
      },
    ];

    // Seed documents disabled for clean testing
    // [...hsDocs, ...hrDocs].forEach(doc => this.documents.set(doc.id, doc));

    // Create sample audit logs with all action types
    const logs: AuditLog[] = [
      // H&S Policy document - full lifecycle
      {
        id: "log-hs1-1",
        action: "document_uploaded",
        userId: "user-1",
        userName: "John Doe",
        siteId: "site-1",
        documentId: "doc-hs-1",
        caseId: null,
        supportRequestId: null,
        module: "health_safety",
        details: "Uploaded Health & Safety Policy 2024 v1",
        metadata: null,
        createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      },
      {
        id: "log-hs1-2",
        action: "document_rejected",
        userId: "user-consultant-1",
        userName: "Sarah Mitchell",
        siteId: "site-1",
        documentId: "doc-hs-1",
        caseId: null,
        supportRequestId: null,
        module: "health_safety",
        details: "Rejected - Missing fire safety procedures section",
        metadata: null,
        createdAt: new Date(now.getTime() - 85 * 24 * 60 * 60 * 1000),
      },
      {
        id: "log-hs1-3",
        action: "document_uploaded",
        userId: "user-1",
        userName: "John Doe",
        siteId: "site-1",
        documentId: "doc-hs-1",
        caseId: null,
        supportRequestId: null,
        module: "health_safety",
        details: "Uploaded Health & Safety Policy 2024 v2",
        metadata: null,
        createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      },
      {
        id: "log-hs1-4",
        action: "changes_requested",
        userId: "user-consultant-1",
        userName: "Sarah Mitchell",
        siteId: "site-1",
        documentId: "doc-hs-1",
        caseId: null,
        supportRequestId: null,
        module: "health_safety",
        details: "Requested minor updates to PPE requirements",
        metadata: null,
        createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      },
      {
        id: "log-hs1-5",
        action: "document_uploaded",
        userId: "user-1",
        userName: "John Doe",
        siteId: "site-1",
        documentId: "doc-hs-1",
        caseId: null,
        supportRequestId: null,
        module: "health_safety",
        details: "Uploaded Health & Safety Policy 2024 v3",
        metadata: null,
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: "log-hs1-6",
        action: "document_approved",
        userId: "user-consultant-1",
        userName: "Sarah Mitchell",
        siteId: "site-1",
        documentId: "doc-hs-1",
        caseId: null,
        supportRequestId: null,
        module: "health_safety",
        details: "Approved Health & Safety Policy 2024 v3",
        metadata: null,
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: "log-hs1-7",
        action: "document_downloaded",
        userId: "user-client-1",
        userName: "Mike Thompson",
        siteId: "site-1",
        documentId: "doc-hs-1",
        caseId: null,
        supportRequestId: null,
        module: "health_safety",
        details: "Downloaded Health & Safety Policy 2024",
        metadata: null,
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: "log-hs1-8",
        action: "document_viewed",
        userId: "user-client-2",
        userName: "Emma Wilson",
        siteId: "site-1",
        documentId: "doc-hs-1",
        caseId: null,
        supportRequestId: null,
        module: "health_safety",
        details: "Viewed Health & Safety Policy 2024",
        metadata: null,
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      // Fire Risk Assessment
      {
        id: "log-hs2-1",
        action: "document_uploaded",
        userId: "user-1",
        userName: "John Doe",
        siteId: "site-1",
        documentId: "doc-hs-2",
        caseId: null,
        supportRequestId: null,
        module: "health_safety",
        details: "Uploaded Fire Risk Assessment - Main Factory",
        metadata: null,
        createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      },
      // HR Documents
      {
        id: "log-hr1-1",
        action: "document_uploaded",
        userId: "user-1",
        userName: "John Doe",
        siteId: "site-1",
        documentId: "doc-hr-1",
        caseId: null,
        supportRequestId: null,
        module: "human_resources",
        details: "Uploaded Employee Handbook 2024",
        metadata: null,
        createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      },
      {
        id: "log-hr1-2",
        action: "document_approved",
        userId: "user-consultant-2",
        userName: "James Anderson",
        siteId: "site-1",
        documentId: "doc-hr-1",
        caseId: null,
        supportRequestId: null,
        module: "human_resources",
        details: "Approved Employee Handbook 2024",
        metadata: null,
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: "log-hr4-1",
        action: "changes_requested",
        userId: "user-consultant-2",
        userName: "James Anderson",
        siteId: "site-3",
        documentId: "doc-hr-4",
        caseId: null,
        supportRequestId: null,
        module: "human_resources",
        details: "Requested updates to remote working policy",
        metadata: null,
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
    ];
    // Seed audit logs disabled for clean testing
    // logs.forEach(log => this.auditLogs.set(log.id, log));

    // Create sample document versions (for documents with version > 1)
    const docVersions: DocumentVersion[] = [
      // doc-hs-1 has version 3, so we have versions 1 and 2 in history
      {
        id: "ver-hs1-1",
        documentId: "doc-hs-1",
        version: 1,
        fileName: "hs_policy_2024_v1.pdf",
        fileSize: 220000,
        uploadedBy: "user-1",
        changeNote: "Initial version of the H&S Policy",
        createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      },
      {
        id: "ver-hs1-2",
        documentId: "doc-hs-1",
        version: 2,
        fileName: "hs_policy_2024_v2.pdf",
        fileSize: 235000,
        uploadedBy: "user-1",
        changeNote: "Updated fire safety section and added PPE requirements",
        createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      },
      // doc-hs-3 has version 2, so we have version 1 in history
      {
        id: "ver-hs3-1",
        documentId: "doc-hs-3",
        version: 1,
        fileName: "coshh_chemical_storage_v1.pdf",
        fileSize: 350000,
        uploadedBy: "user-1",
        changeNote: "Initial COSHH assessment for chemical storage area",
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      },
      // doc-hr-1 has version 2, so we have version 1 in history
      {
        id: "ver-hr1-1",
        documentId: "doc-hr-1",
        version: 1,
        fileName: "employee_handbook_2024_v1.pdf",
        fileSize: 480000,
        uploadedBy: "user-1",
        changeNote: "Initial employee handbook for 2024",
        createdAt: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000),
      },
    ];
    // Seed document versions disabled for clean testing
    // docVersions.forEach(ver => this.documentVersions.set(ver.id, ver));

    // Support requests - no sample data (created by users as needed)
    
    // Create sample entity document type access - now linked to document type IDs from master list
    // Entity 1 (Acme Manufacturing) - has access to most document types but not all
    const entity1Access: SiteDocumentTypeAccess[] = [
      // H&S document types (doctype-1 to doctype-8) - missing doctype-7 (method_statement) and doctype-8 (hs_checklist) for upsell
      { id: "access-1", siteId: "site-1", documentTypeId: "doctype-1", module: "health_safety" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-2", siteId: "site-1", documentTypeId: "doctype-2", module: "health_safety" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-3", siteId: "site-1", documentTypeId: "doctype-3", module: "health_safety" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-4", siteId: "site-1", documentTypeId: "doctype-4", module: "health_safety" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-5", siteId: "site-1", documentTypeId: "doctype-5", module: "health_safety" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-6", siteId: "site-1", documentTypeId: "doctype-6", module: "health_safety" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      // HR document types (doctype-9 to doctype-16) - missing doctype-16 (absence_record) for upsell
      { id: "access-7", siteId: "site-1", documentTypeId: "doctype-9", module: "human_resources" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-8", siteId: "site-1", documentTypeId: "doctype-10", module: "human_resources" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-9", siteId: "site-1", documentTypeId: "doctype-11", module: "human_resources" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-10", siteId: "site-1", documentTypeId: "doctype-12", module: "human_resources" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-11", siteId: "site-1", documentTypeId: "doctype-13", module: "human_resources" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-12", siteId: "site-1", documentTypeId: "doctype-14", module: "human_resources" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-13", siteId: "site-1", documentTypeId: "doctype-15", module: "human_resources" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
    ];
    entity1Access.forEach(access => this.siteDocumentTypeAccess.set(access.id, access));
    
    // Entity 2 (TechStart Solutions) - smaller package, fewer document types
    const entity2Access: SiteDocumentTypeAccess[] = [
      // H&S - basic package only (doctype-1, doctype-2, doctype-5)
      { id: "access-20", siteId: "site-3", documentTypeId: "doctype-1", module: "health_safety" as ModuleType, grantedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-21", siteId: "site-3", documentTypeId: "doctype-2", module: "health_safety" as ModuleType, grantedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-22", siteId: "site-3", documentTypeId: "doctype-5", module: "health_safety" as ModuleType, grantedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      // HR - basic package only (doctype-9, doctype-10, doctype-15)
      { id: "access-23", siteId: "site-3", documentTypeId: "doctype-9", module: "human_resources" as ModuleType, grantedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-24", siteId: "site-3", documentTypeId: "doctype-10", module: "human_resources" as ModuleType, grantedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-25", siteId: "site-3", documentTypeId: "doctype-15", module: "human_resources" as ModuleType, grantedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
    ];
    entity2Access.forEach(access => this.siteDocumentTypeAccess.set(access.id, access));
    
    // Employment Law document type access for Entity 1 (doctype-17 to doctype-26)
    const entity1ELAccess: SiteDocumentTypeAccess[] = [
      { id: "access-30", siteId: "site-1", documentTypeId: "doctype-17", module: "employment_law" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-31", siteId: "site-1", documentTypeId: "doctype-18", module: "employment_law" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-32", siteId: "site-1", documentTypeId: "doctype-19", module: "employment_law" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-33", siteId: "site-1", documentTypeId: "doctype-21", module: "employment_law" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-34", siteId: "site-1", documentTypeId: "doctype-22", module: "employment_law" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-35", siteId: "site-1", documentTypeId: "doctype-24", module: "employment_law" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
      { id: "access-36", siteId: "site-1", documentTypeId: "doctype-25", module: "employment_law" as ModuleType, grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), grantedBy: "user-admin" },
    ];
    entity1ELAccess.forEach(access => this.siteDocumentTypeAccess.set(access.id, access));

    // Employment law cases, folders, milestones, and documents are created through the UI
    // No sample data is seeded - users create cases from scratch
    
    // Employment Law audit logs removed - will be created when cases are created through UI
    
    // Clean up employment law-related audit logs
    
    // Site Module Access - Site 1 has all modules active
    const site1ModuleAccess: SiteModuleAccess[] = [
      {
        id: "sma-1",
        siteId: "site-1",
        module: "health_safety",
        status: "active",
        grantedBy: "user-admin",
        grantedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        notes: "Initial subscription",
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      },
      {
        id: "sma-2",
        siteId: "site-1",
        module: "human_resources",
        status: "active",
        grantedBy: "user-admin",
        grantedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        notes: "Initial subscription",
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      },
      {
        id: "sma-3",
        siteId: "site-1",
        module: "employment_law",
        status: "active",
        grantedBy: "user-admin",
        grantedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        notes: "Added 6 months after initial subscription",
        createdAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
      },
    ];
    site1ModuleAccess.forEach(a => this.siteModuleAccess.set(a.id, a));
    
    // Site 3 has H&S active, HR visible (can request), EL hidden
    const site3ModuleAccess: SiteModuleAccess[] = [
      {
        id: "sma-4",
        siteId: "site-3",
        module: "health_safety",
        status: "active",
        grantedBy: "user-admin",
        grantedAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000),
        notes: null,
        createdAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000),
      },
      {
        id: "sma-5",
        siteId: "site-3",
        module: "human_resources",
        status: "visible",
        grantedBy: null,
        grantedAt: null,
        notes: "Available for request",
        createdAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000),
      },
      {
        id: "sma-6",
        siteId: "site-3",
        module: "employment_law",
        status: "hidden",
        grantedBy: null,
        grantedAt: null,
        notes: null,
        createdAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000),
      },
    ];
    site3ModuleAccess.forEach(a => this.siteModuleAccess.set(a.id, a));
    
    // Sample pending access request from sites for modules
    const sampleAccessRequests: ModuleAccessRequest[] = [
      {
        id: "mar-1",
        siteId: "site-3",
        siteName: "London Office",
        module: "human_resources",
        requestedBy: "user-2",
        requestedByName: "Client User",
        reason: "We need to manage our HR documentation and employee contracts through the portal.",
        status: "pending",
        reviewedBy: null,
        reviewedByName: null,
        reviewNotes: null,
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        reviewedAt: null,
      },
      {
        id: "mar-2",
        siteId: "site-1",
        siteName: "Main Factory",
        module: "employment_law",
        requestedBy: "user-3",
        requestedByName: "Sarah Mitchell",
        reason: "Required for upcoming tribunal case support.",
        status: "pending",
        reviewedBy: null,
        reviewedByName: null,
        reviewNotes: null,
        createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        reviewedAt: null,
      },
      {
        id: "mar-3",
        siteId: "site-2",
        siteName: "Warehouse North",
        module: "health_safety",
        requestedBy: "user-4",
        requestedByName: "James Wilson",
        reason: "New project requires full H&S compliance documentation.",
        status: "pending",
        reviewedBy: null,
        reviewedByName: null,
        reviewNotes: null,
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        reviewedAt: null,
      },
      {
        id: "mar-4",
        siteId: "site-3",
        siteName: "London Office",
        module: "health_safety",
        requestedBy: "user-2",
        requestedByName: "Client User",
        reason: "Office expansion requires H&S review.",
        status: "approved",
        reviewedBy: "user-1",
        reviewedByName: "Admin User",
        reviewNotes: "Approved - standard H&S package activated.",
        createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        reviewedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      },
    ];
    // Cleared for testing - no sample module access requests
    // sampleAccessRequests.forEach(req => this.moduleAccessRequests.set(req.id, req));

    // Sample consultant assignments
    const consultantAssignments: ConsultantAssignment[] = [
      {
        id: "ca-1",
        consultantId: "user-1",
        siteId: "site-1",
        isPrimary: true,
        assignedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
      },
      {
        id: "ca-2",
        consultantId: "user-consultant-2",
        siteId: "site-1",
        isPrimary: false,
        assignedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      },
      {
        id: "ca-3",
        consultantId: "user-consultant-2",
        siteId: "site-3",
        isPrimary: true,
        assignedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      },
    ];
    consultantAssignments.forEach(ca => this.consultantAssignments.set(ca.id, ca));

    // Initialize document types from module config
    let docTypeId = 1;
    const modules = ["health_safety", "human_resources", "employment_law"] as ModuleType[];
    modules.forEach(module => {
      const config = moduleConfig[module];
      config.documentTypes.forEach((dt, index) => {
        const id = `doctype-${docTypeId++}`;
        const docType: DocumentTypeRecord = {
          id,
          name: dt.label,
          code: dt.value,
          module,
          description: null,
          isRequired: index < 3,
          renewalPeriodMonths: index < 2 ? 12 : null,
          sortOrder: index,
          isActive: true,
          createdBy: "user-admin",
          createdAt: now,
          updatedAt: now,
        };
        this.documentTypesMap.set(id, docType);
      });
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    this.userCounter++;
    const role = insertUser.role ?? "client";
    const referenceNumber = formatReferenceNumber(getUserReferencePrefix(role), this.userCounter);
    const user: User = { 
      ...insertUser, 
      id,
      referenceNumber,
      role: role as any,
      companyId: insertUser.companyId ?? null,
      status: (insertUser.status ?? "active") as any,
      consultantTier: (insertUser.consultantTier ?? null) as any,
      clientPermissionRole: (insertUser.clientPermissionRole ?? null) as any,
      lastLoginAt: null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) {
      return undefined;
    }
    const updatedUser: User = {
      ...user,
      ...updates,
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Sites
  async getSites(): Promise<Site[]> {
    return Array.from(this.sites.values());
  }

  async getSitesWithDetails(): Promise<SiteWithDetails[]> {
    const sites = Array.from(this.sites.values());
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
      const company = this.companies.get(site.companyId);
      
      return { 
        ...site, 
        companyName: company?.name,
        companyNumber: company?.companyNumber ?? undefined,
        complianceSummary: summary, 
        moduleAccess, 
        assignedConsultants 
      };
    }));
  }

  async getSitesWithDetailsByCompanyId(companyId: string): Promise<SiteWithDetails[]> {
    // Filter sites first to avoid processing unrelated sites
    const companySites = Array.from(this.sites.values()).filter(s => s.companyId === companyId);
    const company = this.companies.get(companyId);
    
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
        complianceSummary: summary, 
        moduleAccess, 
        assignedConsultants 
      };
    }));
  }

  async getSite(id: string): Promise<Site | undefined> {
    return this.sites.get(id);
  }

  async getSitesByCompanyId(companyId: string): Promise<Site[]> {
    return Array.from(this.sites.values()).filter(site => site.companyId === companyId);
  }

  async getSitesWithCompany(): Promise<SiteWithCompany[]> {
    return Array.from(this.sites.values()).map(site => {
      const company = this.companies.get(site.companyId);
      return {
        ...site,
        companyName: company?.name,
        companyNumber: company?.companyNumber,
      };
    });
  }

  async createSite(insertSite: InsertSite): Promise<Site> {
    const id = randomUUID();
    this.siteCounter++;
    const referenceNumber = formatReferenceNumber('STE', this.siteCounter);
    const site: Site = { 
      ...insertSite, 
      id,
      referenceNumber,
      addressLine1: insertSite.addressLine1 ?? null,
      addressLine2: insertSite.addressLine2 ?? null,
      city: insertSite.city ?? null,
      county: insertSite.county ?? null,
      postalCode: insertSite.postalCode ?? null,
      country: insertSite.country ?? null,
      contactName: insertSite.contactName ?? null,
      contactPosition: insertSite.contactPosition ?? null,
      contactPhone: insertSite.contactPhone ?? null,
      contactEmail: insertSite.contactEmail ?? null,
    };
    this.sites.set(id, site);
    return site;
  }

  async updateSite(id: string, updates: Partial<Site>): Promise<Site | undefined> {
    const site = this.sites.get(id);
    if (!site) {
      return undefined;
    }
    const updatedSite: Site = {
      ...site,
      ...updates,
    };
    this.sites.set(id, updatedSite);
    return updatedSite;
  }

  // Company CRUD
  async getCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }

  async getCompaniesWithSiteCount(): Promise<CompanyWithSiteCount[]> {
    const companies = Array.from(this.companies.values());
    const sites = Array.from(this.sites.values());
    
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
    return this.companies.get(id);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = randomUUID();
    this.companyCounter++;
    const referenceNumber = formatReferenceNumber('CMP', this.companyCounter);
    const company: Company = {
      ...insertCompany,
      id,
      referenceNumber,
      companyNumber: insertCompany.companyNumber ?? null,
      website: insertCompany.website ?? null,
      addressLine1: insertCompany.addressLine1 ?? null,
      addressLine2: insertCompany.addressLine2 ?? null,
      city: insertCompany.city ?? null,
      county: insertCompany.county ?? null,
      postalCode: insertCompany.postalCode ?? null,
      country: insertCompany.country ?? null,
      contactName: insertCompany.contactName ?? null,
      contactPosition: insertCompany.contactPosition ?? null,
      contactEmail: insertCompany.contactEmail ?? null,
      contactPhone: insertCompany.contactPhone ?? null,
      status: (insertCompany.status ?? "active") as any,
      healthSafetyAccess: insertCompany.healthSafetyAccess ?? false,
      employmentLawAccess: insertCompany.employmentLawAccess ?? false,
      hrAccess: insertCompany.hrAccess ?? false,
      supportAccess: insertCompany.supportAccess ?? false,
      trainingAccess: insertCompany.trainingAccess ?? false,
      reportsAccess: insertCompany.reportsAccess ?? false,
      createdAt: new Date(),
    };
    this.companies.set(id, company);
    return company;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const company = this.companies.get(id);
    if (!company) {
      return undefined;
    }
    const updatedCompany: Company = {
      ...company,
      ...updates,
    };
    this.companies.set(id, updatedCompany);
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
      complianceScore: total > 0 ? Math.round((compliant / total) * 100) : 100,
    };
  }

  // Documents
  async getDocuments(module?: ModuleType): Promise<Document[]> {
    let query = db.select().from(documentsTable).where(eq(documentsTable.isArchived, false));
    const docs = await query;
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
    
    const site = doc.siteId ? this.sites.get(doc.siteId) : undefined;
    const company = site?.companyId ? this.companies.get(site.companyId) : undefined;
    const uploader = doc.uploadedBy ? this.users.get(doc.uploadedBy) : undefined;
    const assignee = doc.assignedTo ? this.users.get(doc.assignedTo) : undefined;
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
      const site = this.sites.get(insertDocument.siteId);
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
    }
    if (siteId) {
      docs = docs.filter(d => d.siteId === siteId);
    } else if (companyId) {
      // Filter by company: get all sites for this company
      const companySites = Array.from(this.sites.values()).filter(s => s.companyId === companyId);
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
      complianceScore: total > 0 ? Math.round((compliant / total) * 100) : 100,
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
        complianceScore: total > 0 ? Math.round((compliant / total) * 100) : 100,
      };
    }));
  }

  // Entity Document Type Access
  async getSiteDocumentTypeAccess(siteId: string, module?: ModuleType): Promise<SiteDocumentTypeAccess[]> {
    let access = Array.from(this.siteDocumentTypeAccess.values())
      .filter(a => a.siteId === siteId);
    if (module) {
      access = access.filter(a => a.module === module);
    }
    return access;
  }

  async getDocumentTypesWithAccess(siteId: string, module: ModuleType): Promise<DocumentTypeWithAccess[]> {
    // Get document types from master list for this module
    const masterDocTypes = Array.from(this.documentTypesMap.values())
      .filter(dt => dt.module === module && dt.isActive);
    
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
    this.siteDocumentTypeAccess.set(id, access);
    return access;
  }

  async revokeDocumentTypeAccess(siteId: string, documentTypeId: string): Promise<boolean> {
    const toRemove = Array.from(this.siteDocumentTypeAccess.values())
      .find(a => a.siteId === siteId && a.documentTypeId === documentTypeId);
    if (toRemove) {
      this.siteDocumentTypeAccess.delete(toRemove.id);
      return true;
    }
    return false;
  }

  // Cases (Employment Law) - Database backed
  async getCases(filters?: { siteId?: string; entityId?: string; status?: CaseStatus }): Promise<Case[]> {
    let allCases = await db.select().from(casesTable);
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

  async getCase(id: string): Promise<Case | undefined> {
    const [result] = await db.select().from(casesTable).where(eq(casesTable.id, id));
    return result;
  }

  async createCase(insertCase: InsertCase): Promise<Case> {
    // Auto-create a standalone folder for the case documents (case-specific, not shown in main folder hierarchy)
    const folderName = `${insertCase.caseReference} - ${insertCase.employeeName}`;
    const folder = await this.createDocumentFolder({
      name: folderName,
      description: `Documents for case ${insertCase.caseReference}`,
      module: "employment_law",
      siteId: insertCase.siteId,
      parentId: null, // Case folders are standalone, accessed only through case detail view
      templateId: null,
      sortOrder: 0,
      createdBy: insertCase.createdBy,
    });
    
    const [newCase] = await db.insert(casesTable).values({
      ...insertCase,
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
    const company = this.companies.get(companyId);
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
    const company = this.companies.get(companyId);
    if (!company) return undefined;
    
    const updated: Company = {
      ...company,
      healthSafetyAccess: modules.healthSafety ?? company.healthSafetyAccess,
      humanResourcesAccess: modules.humanResources ?? company.humanResourcesAccess,
      employmentLawAccess: modules.employmentLaw ?? company.employmentLawAccess,
      supportAccess: modules.support ?? company.supportAccess,
      reportsAccess: modules.reports ?? company.reportsAccess,
    };
    this.companies.set(companyId, updated);
    return updated;
  }

  async hasCompanyModuleAccess(companyId: string, module: ModuleType): Promise<boolean> {
    const company = this.companies.get(companyId);
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

  // Module Access Requests
  async getModuleAccessRequests(siteId?: string, status?: ModuleAccessRequestStatus): Promise<ModuleAccessRequest[]> {
    let requests = Array.from(this.moduleAccessRequests.values());
    if (siteId) {
      requests = requests.filter(r => r.siteId === siteId);
    }
    if (status) {
      requests = requests.filter(r => r.status === status);
    }
    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    this.moduleAccessRequests.set(id, request);
    return request;
  }

  async reviewModuleAccessRequest(
    id: string, 
    reviewedBy: string, 
    reviewedByName: string, 
    status: ModuleAccessRequestStatus, 
    notes?: string
  ): Promise<ModuleAccessRequest | undefined> {
    const existing = this.moduleAccessRequests.get(id);
    if (!existing) return undefined;
    
    const updated: ModuleAccessRequest = {
      ...existing,
      status,
      reviewedBy,
      reviewedByName,
      reviewNotes: notes ?? null,
      reviewedAt: new Date(),
    };
    this.moduleAccessRequests.set(id, updated);
    
    // If approved, grant module access
    if (status === "approved") {
      await this.setSiteModuleAccess(existing.siteId, existing.module, "active", reviewedBy);
    }
    
    return updated;
  }

  // Consultant Assignments - Database backed
  async getConsultantAssignments(siteId: string): Promise<ConsultantAssignment[]> {
    const results = await db.select().from(consultantAssignmentsTable)
      .where(eq(consultantAssignmentsTable.siteId, siteId));
    return results;
  }

  async getConsultantSites(consultantId: string): Promise<ConsultantAssignment[]> {
    const results = await db.select().from(consultantAssignmentsTable)
      .where(eq(consultantAssignmentsTable.consultantId, consultantId));
    return results;
  }

  async assignConsultant(assignment: InsertConsultantAssignment): Promise<ConsultantAssignment> {
    // Check if already assigned
    const [existing] = await db.select().from(consultantAssignmentsTable)
      .where(and(
        eq(consultantAssignmentsTable.consultantId, assignment.consultantId),
        eq(consultantAssignmentsTable.siteId, assignment.siteId)
      ));
    if (existing) {
      return existing;
    }

    const [newAssignment] = await db.insert(consultantAssignmentsTable).values({
      consultantId: assignment.consultantId,
      siteId: assignment.siteId,
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
        eq(consultantAssignmentsTable.siteId, siteId)
      ))
      .returning();
    return updated;
  }

  async removeConsultantAssignment(consultantId: string, siteId: string): Promise<boolean> {
    const result = await db.delete(consultantAssignmentsTable)
      .where(and(
        eq(consultantAssignmentsTable.consultantId, consultantId),
        eq(consultantAssignmentsTable.siteId, siteId)
      ))
      .returning();
    return result.length > 0;
  }

  // Client Site Assignments
  async getClientSiteAssignments(siteId: string): Promise<ClientSiteAssignment[]> {
    // Try database first
    try {
      const result = await db.select().from(clientSiteAssignmentsTable).where(eq(clientSiteAssignmentsTable.siteId, siteId));
      return result;
    } catch {
      return Array.from(this.clientSiteAssignments.values())
        .filter(a => a.siteId === siteId);
    }
  }

  async getClientSites(clientId: string): Promise<ClientSiteAssignment[]> {
    // Try database first
    try {
      const result = await db.select().from(clientSiteAssignmentsTable).where(eq(clientSiteAssignmentsTable.clientId, clientId));
      return result;
    } catch {
      return Array.from(this.clientSiteAssignments.values())
        .filter(a => a.clientId === clientId);
    }
  }

  async assignClientToSite(assignment: InsertClientSiteAssignment): Promise<ClientSiteAssignment> {
    // Check if already assigned
    try {
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
    } catch {
      const existing = Array.from(this.clientSiteAssignments.values())
        .find(a => a.clientId === assignment.clientId && a.siteId === assignment.siteId);
      if (existing) {
        return existing;
      }
      const id = randomUUID();
      const newAssignment: ClientSiteAssignment = {
        id,
        clientId: assignment.clientId,
        siteId: assignment.siteId,
        assignedAt: new Date(),
        assignedBy: assignment.assignedBy || null,
      };
      this.clientSiteAssignments.set(id, newAssignment);
      return newAssignment;
    }
  }

  async removeClientSiteAssignment(clientId: string, siteId: string): Promise<boolean> {
    try {
      const result = await db.delete(clientSiteAssignmentsTable)
        .where(and(
          eq(clientSiteAssignmentsTable.clientId, clientId),
          eq(clientSiteAssignmentsTable.siteId, siteId)
        ));
      return true;
    } catch {
      const assignment = Array.from(this.clientSiteAssignments.entries())
        .find(([_, a]) => a.clientId === clientId && a.siteId === siteId);
      if (assignment) {
        this.clientSiteAssignments.delete(assignment[0]);
        return true;
      }
      return false;
    }
  }

  async hasClientSiteAssignments(clientId: string): Promise<boolean> {
    try {
      const result = await db.select().from(clientSiteAssignmentsTable)
        .where(eq(clientSiteAssignmentsTable.clientId, clientId));
      const hasAssignments = result.length > 0;
      return hasAssignments;
    } catch {
      const hasAssignments = Array.from(this.clientSiteAssignments.values())
        .some(a => a.clientId === clientId);
      return hasAssignments;
    }
  }

  // Users by Company (get all users associated with a company)
  async getUsersBySite(siteId: string): Promise<User[]> {
    // First get the site to find its company
    const site = this.sites.get(siteId);
    if (!site) return [];
    // Return users that have access to this company
    return Array.from(this.users.values())
      .filter(u => u.companyId === site.companyId);
  }

  async getConsultants(): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(u => u.role === "consultant");
  }

  // Document Types (Admin-managed)
  async getDocumentTypes(module?: ModuleType): Promise<DocumentTypeRecord[]> {
    try {
      let query = db.select().from(documentTypes);
      if (module) {
        query = query.where(eq(documentTypes.module, module)) as typeof query;
      }
      const types = await query.orderBy(asc(documentTypes.sortOrder));
      return types;
    } catch (error) {
      console.error("Error fetching document types from DB:", error);
      let types = Array.from(this.documentTypesMap.values());
      if (module) {
        types = types.filter(t => t.module === module);
      }
      return types.sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }

  async getDocumentType(id: string): Promise<DocumentTypeRecord | undefined> {
    try {
      const [docType] = await db.select().from(documentTypes).where(eq(documentTypes.id, id));
      return docType;
    } catch (error) {
      console.error("Error fetching document type from DB:", error);
      return this.documentTypesMap.get(id);
    }
  }

  async createDocumentType(docType: InsertDocumentType): Promise<DocumentTypeRecord> {
    const id = randomUUID();
    const now = new Date();
    const newDocType: DocumentTypeRecord = {
      id,
      name: docType.name,
      code: docType.code,
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
    
    try {
      await db.insert(documentTypes).values(newDocType);
    } catch (error) {
      console.error("Error saving document type to DB:", error);
    }
    
    this.documentTypesMap.set(id, newDocType);
    return newDocType;
  }

  async updateDocumentType(id: string, updates: Partial<DocumentTypeRecord>): Promise<DocumentTypeRecord | undefined> {
    try {
      const [existing] = await db.select().from(documentTypes).where(eq(documentTypes.id, id));
      if (!existing) {
        // Fallback to memory
        const memExisting = this.documentTypesMap.get(id);
        if (!memExisting) return undefined;
        const updated: DocumentTypeRecord = { ...memExisting, ...updates, updatedAt: new Date() };
        this.documentTypesMap.set(id, updated);
        return updated;
      }
      
      const updatedData = {
        ...updates,
        updatedAt: new Date(),
      };
      
      await db.update(documentTypes).set(updatedData).where(eq(documentTypes.id, id));
      
      const [updated] = await db.select().from(documentTypes).where(eq(documentTypes.id, id));
      return updated;
    } catch (error) {
      console.error("Error updating document type:", error);
      const existing = this.documentTypesMap.get(id);
      if (!existing) return undefined;
      const updated: DocumentTypeRecord = { ...existing, ...updates, updatedAt: new Date() };
      this.documentTypesMap.set(id, updated);
      return updated;
    }
  }

  async deleteDocumentType(id: string): Promise<boolean> {
    try {
      await db.delete(documentTypes).where(eq(documentTypes.id, id));
      this.documentTypesMap.delete(id);
      return true;
    } catch (error) {
      console.error("Error deleting document type:", error);
      return this.documentTypesMap.delete(id);
    }
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

  // Folder Templates (Admin-managed master folder structure - Database-backed)
  async getFolderTemplates(module?: ModuleType): Promise<FolderTemplate[]> {
    try {
      let query = db.select().from(folderTemplatesTable);
      if (module) {
        query = query.where(eq(folderTemplatesTable.module, module)) as typeof query;
      }
      const templates = await query.orderBy(asc(folderTemplatesTable.sortOrder));
      return templates;
    } catch (error) {
      console.error("Error fetching folder templates from DB:", error);
      let templates = Array.from(this.folderTemplates.values());
      if (module) {
        templates = templates.filter(t => t.module === module);
      }
      return templates.sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }

  async getFolderTemplate(id: string): Promise<FolderTemplate | undefined> {
    try {
      const [template] = await db.select().from(folderTemplatesTable).where(eq(folderTemplatesTable.id, id));
      return template;
    } catch (error) {
      console.error("Error fetching folder template from DB:", error);
      return this.folderTemplates.get(id);
    }
  }

  async createFolderTemplate(template: InsertFolderTemplate): Promise<FolderTemplate> {
    const id = randomUUID();
    const now = new Date();
    const newTemplate: FolderTemplate = {
      id,
      name: template.name,
      code: template.code,
      module: template.module as ModuleType,
      description: template.description ?? null,
      parentId: template.parentId ?? null,
      isRequired: template.isRequired ?? false,
      sortOrder: template.sortOrder ?? 0,
      isActive: template.isActive ?? true,
      createdBy: template.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    
    try {
      const [inserted] = await db.insert(folderTemplatesTable).values(newTemplate).returning();
      this.folderTemplates.set(inserted.id, inserted);
      return inserted;
    } catch (error) {
      console.error("Error inserting folder template to DB:", error);
      this.folderTemplates.set(id, newTemplate);
      return newTemplate;
    }
  }

  async updateFolderTemplate(id: string, updates: Partial<FolderTemplate>): Promise<FolderTemplate | undefined> {
    try {
      const [updated] = await db.update(folderTemplatesTable)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(folderTemplatesTable.id, id))
        .returning();
      if (updated) {
        this.folderTemplates.set(id, updated);
      }
      return updated;
    } catch (error) {
      console.error("Error updating folder template in DB:", error);
      const existing = this.folderTemplates.get(id);
      if (!existing) {
        return undefined;
      }
      const updated: FolderTemplate = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };
      this.folderTemplates.set(id, updated);
      return updated;
    }
  }

  async deleteFolderTemplate(id: string): Promise<boolean> {
    try {
      // First remove any rules associated with this template
      await db.delete(folderDocumentTypeRulesTable).where(eq(folderDocumentTypeRulesTable.folderTemplateId, id));
      
      // Delete child templates recursively
      const children = await db.select().from(folderTemplatesTable).where(eq(folderTemplatesTable.parentId, id));
      for (const child of children) {
        await this.deleteFolderTemplate(child.id);
      }
      
      // Delete the template
      await db.delete(folderTemplatesTable).where(eq(folderTemplatesTable.id, id));
      this.folderTemplates.delete(id);
      return true;
    } catch (error) {
      console.error("Error deleting folder template from DB:", error);
      // Fallback to memory-based deletion
      const rules = Array.from(this.folderDocumentTypeRules.values());
      for (const rule of rules) {
        if (rule.folderTemplateId === id) {
          this.folderDocumentTypeRules.delete(rule.id);
        }
      }
      const templates = Array.from(this.folderTemplates.values());
      for (const template of templates) {
        if (template.parentId === id) {
          await this.deleteFolderTemplate(template.id);
        }
      }
      return this.folderTemplates.delete(id);
    }
  }

  // Folder-Document Type Rules (Database-backed)
  async getAllFolderDocumentTypeRules(): Promise<FolderDocumentTypeRule[]> {
    try {
      return await db.select().from(folderDocumentTypeRulesTable).orderBy(asc(folderDocumentTypeRulesTable.sortOrder));
    } catch (error) {
      console.error("Error fetching folder document type rules from DB:", error);
      return Array.from(this.folderDocumentTypeRules.values());
    }
  }

  async getFolderDocumentTypeRules(folderTemplateId: string): Promise<FolderDocumentTypeRule[]> {
    try {
      return await db.select().from(folderDocumentTypeRulesTable)
        .where(eq(folderDocumentTypeRulesTable.folderTemplateId, folderTemplateId))
        .orderBy(asc(folderDocumentTypeRulesTable.sortOrder));
    } catch (error) {
      console.error("Error fetching folder rules from DB:", error);
      return Array.from(this.folderDocumentTypeRules.values())
        .filter(r => r.folderTemplateId === folderTemplateId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }

  async getDocumentTypeRulesForTemplate(folderTemplateId: string): Promise<(FolderDocumentTypeRule & { documentType?: DocumentTypeRecord })[]> {
    const rules = await this.getFolderDocumentTypeRules(folderTemplateId);
    return rules.map(rule => {
      const documentType = this.documentTypesMap.get(rule.documentTypeId);
      return { ...rule, documentType };
    });
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
    
    try {
      const [inserted] = await db.insert(folderDocumentTypeRulesTable).values(newRule).returning();
      this.folderDocumentTypeRules.set(inserted.id, inserted);
      return inserted;
    } catch (error) {
      console.error("Error inserting folder rule to DB, using memory:", error);
      this.folderDocumentTypeRules.set(id, newRule);
      return newRule;
    }
  }

  async deleteFolderDocumentTypeRule(id: string): Promise<boolean> {
    try {
      await db.delete(folderDocumentTypeRulesTable).where(eq(folderDocumentTypeRulesTable.id, id));
      this.folderDocumentTypeRules.delete(id);
      return true;
    } catch (error) {
      console.error("Error deleting folder rule from DB:", error);
      return this.folderDocumentTypeRules.delete(id);
    }
  }

  // ============================================
  // DOCUMENT TEMPLATES (The "Document Bible")
  // ============================================
  
  async getDocumentTemplates(module?: ModuleType, folderTemplateId?: string): Promise<DocumentTemplate[]> {
    try {
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
    } catch (error) {
      console.error("Error fetching document templates from DB:", error);
      let templates = Array.from(this.documentTemplates.values());
      
      if (module) {
        templates = templates.filter(t => t.module === module);
      }
      if (folderTemplateId) {
        templates = templates.filter(t => t.folderTemplateId === folderTemplateId);
      }
      
      return templates.filter(t => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }
  
  async getArchivedDocumentTemplates(): Promise<DocumentTemplate[]> {
    try {
      const templates = await db.select().from(documentTemplatesTable)
        .where(eq(documentTemplatesTable.isActive, false))
        .orderBy(asc(documentTemplatesTable.sortOrder));
      return templates;
    } catch (error) {
      console.error("Error fetching archived templates from DB:", error);
      return Array.from(this.documentTemplates.values())
        .filter(t => !t.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }
  
  async restoreDocumentTemplate(id: string, restoredBy: string): Promise<boolean> {
    try {
      const restoreData = {
        isActive: true,
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        updatedAt: new Date(),
      };
      
      await db.update(documentTemplatesTable).set(restoreData).where(eq(documentTemplatesTable.id, id));
      
      // Update memory cache too
      const existing = this.documentTemplates.get(id);
      if (existing) {
        this.documentTemplates.set(id, { ...existing, ...restoreData });
      }
      
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
    } catch (error) {
      console.error("Error restoring document template:", error);
      return false;
    }
  }
  
  async getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined> {
    try {
      const [template] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id));
      return template;
    } catch (error) {
      console.error("Error fetching document template from DB:", error);
      return this.documentTemplates.get(id);
    }
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
      documentTypeId: template.documentTypeId ?? null,
      fileName: template.fileName,
      fileUrl: template.fileUrl ?? null,
      fileSize: template.fileSize,
      mimeType: template.mimeType,
      version: template.version ?? 1,
      placeholders: template.placeholders ?? null,
      isRequired: template.isRequired ?? false,
      renewalPeriodMonths: template.renewalPeriodMonths ?? null,
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
    try {
      const [inserted] = await db.insert(documentTemplatesTable).values(newTemplate).returning();
      this.documentTemplates.set(inserted.id, inserted);
      
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
    } catch (error) {
      console.error("Error inserting document template to DB:", error);
      this.documentTemplates.set(id, newTemplate);
      
      // Create initial version in memory
      await this.createDocumentTemplateVersion({
        templateId: id,
        version: 1,
        fileName: template.fileName,
        fileUrl: template.fileUrl,
        fileSize: template.fileSize,
        mimeType: template.mimeType,
        changeNote: "Initial version",
        uploadedBy: template.createdBy,
      });
      
      return newTemplate;
    }
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
    try {
      const [updated] = await db.update(documentTemplatesTable)
        .set(updateData)
        .where(eq(documentTemplatesTable.id, id))
        .returning();
      
      if (updated) {
        this.documentTemplates.set(id, updated);
        return updated;
      }
    } catch (error) {
      console.error("Error updating document template in DB:", error);
    }
    
    // Fallback to in-memory if DB fails - use sanitized updateData
    const fallbackTemplate = { ...dbTemplate, ...updateData } as DocumentTemplate;
    this.documentTemplates.set(id, fallbackTemplate);
    return fallbackTemplate;
  }
  
  async deleteDocumentTemplate(id: string, deletedBy: string, reason: string): Promise<boolean> {
    try {
      // Soft delete - mark as inactive with audit info
      const deletionData = {
        isActive: false,
        deletedAt: new Date(),
        deletedBy: deletedBy,
        deletionReason: reason,
        updatedAt: new Date(),
      };
      
      await db.update(documentTemplatesTable).set(deletionData).where(eq(documentTemplatesTable.id, id));
      
      // Update memory cache too
      const existing = this.documentTemplates.get(id);
      if (existing) {
        this.documentTemplates.set(id, { ...existing, ...deletionData });
      }
      
      // Log to audit trail
      await this.createAuditLog({
        userId: deletedBy,
        action: 'template_deleted',
        entityType: 'document_template',
        entityId: id,
        details: JSON.stringify({ 
          templateName: existing?.name || 'Unknown',
          reason: reason 
        }),
      });
      
      return true;
    } catch (error) {
      console.error("Error soft-deleting document template:", error);
      return false;
    }
  }
  
  // Document Template Versions
  async getDocumentTemplateVersions(templateId: string): Promise<DocumentTemplateVersion[]> {
    try {
      const versions = await db.select().from(documentTemplateVersionsTable)
        .where(eq(documentTemplateVersionsTable.templateId, templateId));
      return versions.sort((a, b) => b.version - a.version);
    } catch (error) {
      console.error("Error fetching document template versions from DB:", error);
      return Array.from(this.documentTemplateVersions.values())
        .filter(v => v.templateId === templateId)
        .sort((a, b) => b.version - a.version);
    }
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
    try {
      const [inserted] = await db.insert(documentTemplateVersionsTable).values(newVersion).returning();
      this.documentTemplateVersions.set(inserted.id, inserted);
      return inserted;
    } catch (error) {
      console.error("Error inserting document template version to DB:", error);
      this.documentTemplateVersions.set(id, newVersion);
      return newVersion;
    }
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
  // SECURITY - LOGIN ATTEMPTS
  // ============================================
  
  private loginAttempts: Map<string, LoginAttempt> = new Map();
  
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
      return Array.from(this.trainingModulesMap.values())
        .filter(t => t.isActive && (!module || t.module === module))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }

  async getTrainingModule(id: string): Promise<TrainingModule | undefined> {
    try {
      const results = await db.select().from(trainingModulesTable)
        .where(eq(trainingModulesTable.id, id));
      return results[0];
    } catch (error) {
      console.error("Database error in getTrainingModule:", error);
      return this.trainingModulesMap.get(id);
    }
  }

  async createTrainingModule(trainingModule: InsertTrainingModule): Promise<TrainingModule> {
    const now = new Date();
    try {
      const results = await db.insert(trainingModulesTable)
        .values({
          ...trainingModule,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return results[0];
    } catch (error) {
      console.error("Database error in createTrainingModule:", error);
      const id = randomUUID();
      const newModule: TrainingModule = {
        id,
        ...trainingModule,
        description: trainingModule.description ?? null,
        folderTemplateId: trainingModule.folderTemplateId ?? null,
        provider: trainingModule.provider ?? null,
        duration: trainingModule.duration ?? null,
        isRequired: trainingModule.isRequired ?? false,
        renewalPeriodMonths: trainingModule.renewalPeriodMonths ?? null,
        sortOrder: trainingModule.sortOrder ?? 0,
        isActive: trainingModule.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
      this.trainingModulesMap.set(id, newModule);
      return newModule;
    }
  }

  async updateTrainingModule(id: string, updates: Partial<TrainingModule>): Promise<TrainingModule | undefined> {
    const now = new Date();
    try {
      const results = await db.update(trainingModulesTable)
        .set({ ...updates, updatedAt: now })
        .where(eq(trainingModulesTable.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error("Database error in updateTrainingModule:", error);
      const existing = this.trainingModulesMap.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...updates, updatedAt: now };
      this.trainingModulesMap.set(id, updated);
      return updated;
    }
  }

  async deleteTrainingModule(id: string): Promise<boolean> {
    try {
      // Soft delete - just mark as inactive
      const results = await db.update(trainingModulesTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(trainingModulesTable.id, id))
        .returning();
      return results.length > 0;
    } catch (error) {
      console.error("Database error in deleteTrainingModule:", error);
      const existing = this.trainingModulesMap.get(id);
      if (!existing) return false;
      this.trainingModulesMap.set(id, { ...existing, isActive: false });
      return true;
    }
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
}

export const storage = new MemStorage();
