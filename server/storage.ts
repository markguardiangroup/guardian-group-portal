import { 
  type User, type InsertUser,
  type Site, type InsertSite,
  type Document, type InsertDocument,
  type DocumentVersion, type InsertDocumentVersion,
  type AuditLog, type InsertAuditLog,
  type SupportRequest, type InsertSupportRequest,
  type Case, type InsertCase,
  type CaseMilestone, type InsertCaseMilestone,
  type ComplianceSummary,
  type SiteWithDetails,
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
  type DocumentTypeRecord, type InsertDocumentType,
  moduleConfig,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Sites
  getSites(): Promise<Site[]>;
  getSitesWithDetails(): Promise<SiteWithDetails[]>;
  getSite(id: string): Promise<Site | undefined>;
  getSitesByCompany(companyName: string): Promise<Site[]>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: string, updates: Partial<Site>): Promise<Site | undefined>;
  getCompanyNames(): Promise<string[]>;
  
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
  createSupportRequest(request: InsertSupportRequest): Promise<SupportRequest>;
  updateSupportRequest(id: string, updates: Partial<SupportRequest>): Promise<SupportRequest | undefined>;
  
  // Dashboard
  getComplianceSummary(module?: ModuleType): Promise<ComplianceSummary>;
  getModuleSummaries(siteId?: string): Promise<ModuleSummary[]>;
  
  // Site Document Type Access
  getSiteDocumentTypeAccess(siteId: string, module?: ModuleType): Promise<SiteDocumentTypeAccess[]>;
  getDocumentTypesWithAccess(siteId: string, module: ModuleType): Promise<DocumentTypeWithAccess[]>;
  grantDocumentTypeAccess(access: InsertSiteDocumentTypeAccess): Promise<SiteDocumentTypeAccess>;
  revokeDocumentTypeAccess(siteId: string, documentTypeId: string): Promise<boolean>;
  
  // Cases (Employment Law)
  getCases(siteId?: string, status?: CaseStatus): Promise<Case[]>;
  getCase(id: string): Promise<Case | undefined>;
  createCase(caseData: InsertCase): Promise<Case>;
  updateCase(id: string, updates: Partial<Case>): Promise<Case | undefined>;
  getCaseDocuments(caseId: string): Promise<Document[]>;
  
  // Case Milestones
  getCaseMilestones(caseId: string): Promise<CaseMilestone[]>;
  createCaseMilestone(milestone: InsertCaseMilestone): Promise<CaseMilestone>;
  updateCaseMilestone(id: string, updates: Partial<CaseMilestone>): Promise<CaseMilestone | undefined>;
  
  // Site Module Access
  getSiteModuleAccess(siteId: string): Promise<SiteModuleAccess[]>;
  getSiteModuleAccessByModule(siteId: string, module: ModuleType): Promise<SiteModuleAccess | undefined>;
  setSiteModuleAccess(siteId: string, module: ModuleType, status: ModuleAccessStatus, grantedBy?: string, notes?: string): Promise<SiteModuleAccess>;
  
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
  
  // Users by Site
  getUsersBySite(siteId: string): Promise<User[]>;
  getConsultants(): Promise<User[]>;
  
  // Document Types (Admin-managed)
  getDocumentTypes(module?: ModuleType): Promise<DocumentTypeRecord[]>;
  getDocumentType(id: string): Promise<DocumentTypeRecord | undefined>;
  createDocumentType(docType: InsertDocumentType): Promise<DocumentTypeRecord>;
  updateDocumentType(id: string, updates: Partial<DocumentTypeRecord>): Promise<DocumentTypeRecord | undefined>;
  deleteDocumentType(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private sites: Map<string, Site>;
  private documents: Map<string, Document>;
  private documentVersions: Map<string, DocumentVersion>;
  private auditLogs: Map<string, AuditLog>;
  private supportRequests: Map<string, SupportRequest>;
  private siteDocumentTypeAccess: Map<string, SiteDocumentTypeAccess>;
  private cases: Map<string, Case>;
  private caseMilestones: Map<string, CaseMilestone>;
  private siteModuleAccess: Map<string, SiteModuleAccess>;
  private moduleAccessRequests: Map<string, ModuleAccessRequest>;
  private consultantAssignments: Map<string, ConsultantAssignment>;
  private documentTypesMap: Map<string, DocumentTypeRecord>;

  constructor() {
    this.users = new Map();
    this.sites = new Map();
    this.documents = new Map();
    this.documentVersions = new Map();
    this.auditLogs = new Map();
    this.supportRequests = new Map();
    this.siteDocumentTypeAccess = new Map();
    this.cases = new Map();
    this.caseMilestones = new Map();
    this.siteModuleAccess = new Map();
    this.moduleAccessRequests = new Map();
    this.consultantAssignments = new Map();
    this.documentTypesMap = new Map();
    
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const now = new Date();
    
    // Create sample users
    const admin: User = {
      id: "user-admin",
      username: "admin",
      password: "admin123",
      email: "admin@guardiangroup.com",
      fullName: "System Administrator",
      role: "admin",
      siteId: null,
      status: "active",
      consultantTier: null,
      clientPermissionRole: null,
      lastLoginAt: null,
      createdAt: now,
    };
    this.users.set(admin.id, admin);

    const consultant1: User = {
      id: "user-1",
      username: "john.doe",
      password: "consultant123",
      email: "john.doe@guardiangroup.com",
      fullName: "John Doe",
      role: "consultant",
      siteId: null,
      status: "active",
      consultantTier: "senior",
      clientPermissionRole: null,
      lastLoginAt: null,
      createdAt: now,
    };
    this.users.set(consultant1.id, consultant1);

    const consultant2: User = {
      id: "user-consultant-2",
      username: "jane.smith",
      password: "consultant123",
      email: "jane.smith@guardiangroup.com",
      fullName: "Jane Smith",
      role: "consultant",
      siteId: null,
      status: "active",
      consultantTier: "standard",
      clientPermissionRole: null,
      lastLoginAt: null,
      createdAt: now,
    };
    this.users.set(consultant2.id, consultant2);

    const client1: User = {
      id: "user-client-1",
      username: "sarah.acme",
      password: "client123",
      email: "sarah@acme-mfg.com",
      fullName: "Sarah Johnson",
      role: "client",
      siteId: "site-1",
      status: "active",
      consultantTier: null,
      clientPermissionRole: "owner",
      lastLoginAt: null,
      createdAt: now,
    };
    this.users.set(client1.id, client1);

    const client2: User = {
      id: "user-client-2",
      username: "emma.tech",
      password: "client123",
      email: "emma@techcorp.co.uk",
      fullName: "Emma Davis",
      role: "client",
      siteId: "site-3",
      status: "active",
      consultantTier: null,
      clientPermissionRole: "approver",
      lastLoginAt: null,
      createdAt: now,
    };
    this.users.set(client2.id, client2);

    // Create sample sites (with companyName for grouping)
    const sampleSites: Site[] = [
      {
        id: "site-1",
        name: "Main Factory",
        companyName: "Acme Manufacturing Ltd",
        companyNumber: "12345678",
        address: "123 Industrial Way, Manchester M1 2AB",
        contactEmail: "safety@acme-mfg.com",
        contactPhone: "+44 161 123 4567",
        website: "https://www.acme-mfg.com",
        siteManager: "Sarah Johnson",
        status: "active",
        createdAt: now,
      },
      {
        id: "site-2",
        name: "Warehouse North",
        companyName: "Acme Manufacturing Ltd",
        companyNumber: "12345678",
        address: "789 Logistics Road, Manchester M3 4CD",
        contactEmail: "safety@acme-mfg.com",
        contactPhone: "+44 161 123 4569",
        website: "https://www.acme-mfg.com",
        siteManager: "Mike Williams",
        status: "active",
        createdAt: now,
      },
      {
        id: "site-3",
        name: "London Office",
        companyName: "TechCorp Solutions",
        companyNumber: "87654321",
        address: "456 Tech Park, London EC2A 4NE",
        contactEmail: "compliance@techcorp.co.uk",
        contactPhone: "+44 20 7123 4567",
        website: "https://www.techcorp.co.uk",
        siteManager: "Emma Davis",
        status: "active",
        createdAt: now,
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

    // Create sample support requests
    const requests: SupportRequest[] = [
      {
        id: "req-1",
        subject: "Question about fire extinguisher placement",
        description: "We're renovating the main floor and need guidance on where to relocate the fire extinguishers. Current positions will be blocked by new equipment.",
        priority: "medium",
        status: "open",
        category: "Compliance Question",
        module: "health_safety",
        siteId: "site-1",
        createdBy: "user-1",
        assignedTo: null,
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        resolvedAt: null,
      },
      {
        id: "req-2",
        subject: "Need updated contract template",
        description: "We need an updated employment contract template that includes the new remote working clause as per our HR policy.",
        priority: "low",
        status: "resolved",
        category: "Document Request",
        module: "human_resources",
        siteId: "site-3",
        createdBy: "user-1",
        assignedTo: "user-1",
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        resolvedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    ];
    requests.forEach(req => this.supportRequests.set(req.id, req));
    
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
    
    // Sample Employment Law Cases
    const sampleCases: Case[] = [
      {
        id: "case-1",
        siteId: "site-1",
        caseReference: "EL-2024-001",
        employeeName: "John Smith",
        employeeId: "EMP-1234",
        caseType: "disciplinary",
        status: "under_investigation",
        description: "Investigation into alleged misconduct relating to expenses claims",
        isConfidential: true,
        restrictedToUsers: null,
        hearingDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        responseDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        resolutionDate: null,
        assignedConsultant: "user-1",
        createdBy: "user-1",
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: "case-2",
        siteId: "site-1",
        caseReference: "EL-2024-002",
        employeeName: "Sarah Johnson",
        employeeId: "EMP-5678",
        caseType: "grievance",
        status: "open",
        description: "Grievance raised regarding workplace bullying allegations",
        isConfidential: true,
        restrictedToUsers: null,
        hearingDate: null,
        responseDeadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        resolutionDate: null,
        assignedConsultant: "user-1",
        createdBy: "user-1",
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: "case-3",
        siteId: "site-1",
        caseReference: "EL-2023-015",
        employeeName: "Michael Brown",
        employeeId: "EMP-9012",
        caseType: "settlement",
        status: "resolved",
        description: "Settlement agreement following redundancy consultation",
        isConfidential: true,
        restrictedToUsers: null,
        hearingDate: null,
        responseDeadline: null,
        resolutionDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        assignedConsultant: "user-1",
        createdBy: "user-admin",
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        id: "case-4",
        siteId: "site-1",
        caseReference: "EL-2024-003",
        employeeName: "Emma Wilson",
        employeeId: "EMP-3456",
        caseType: "tribunal_claim",
        status: "hearing_scheduled",
        description: "ET1 received - unfair dismissal claim",
        isConfidential: true,
        restrictedToUsers: null,
        hearingDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
        responseDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        resolutionDate: null,
        assignedConsultant: "user-1",
        createdBy: "user-1",
        createdAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    ];
    sampleCases.forEach(c => this.cases.set(c.id, c));
    
    // Sample Case Milestones
    const sampleMilestones: CaseMilestone[] = [
      {
        id: "milestone-1",
        caseId: "case-1",
        title: "Investigation meeting with employee",
        description: "Initial investigation meeting to gather facts",
        dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        completedDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        isCompleted: true,
        createdBy: "user-1",
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: "milestone-2",
        caseId: "case-1",
        title: "Gather witness statements",
        description: "Collect statements from relevant witnesses",
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        completedDate: null,
        isCompleted: false,
        createdBy: "user-1",
        createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        id: "milestone-3",
        caseId: "case-1",
        title: "Disciplinary hearing",
        description: "Formal disciplinary hearing",
        dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        completedDate: null,
        isCompleted: false,
        createdBy: "user-1",
        createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        id: "milestone-4",
        caseId: "case-2",
        title: "Acknowledge grievance",
        description: "Send formal acknowledgment letter",
        dueDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        completedDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        isCompleted: true,
        createdBy: "user-1",
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: "milestone-5",
        caseId: "case-2",
        title: "Schedule grievance meeting",
        description: "Arrange formal grievance hearing",
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        completedDate: null,
        isCompleted: false,
        createdBy: "user-1",
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: "milestone-6",
        caseId: "case-4",
        title: "Submit ET3 response",
        description: "File response to Employment Tribunal",
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        completedDate: null,
        isCompleted: false,
        createdBy: "user-1",
        createdAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
      },
    ];
    sampleMilestones.forEach(m => this.caseMilestones.set(m.id, m));
    
    // Sample Employment Law Documents linked to cases
    const elDocs: Document[] = [
      {
        id: "doc-el-1",
        title: "Investigation Report - J. Smith",
        description: "Summary of investigation findings",
        module: "employment_law",
        type: "investigation_report",
        siteId: "site-1",
        caseId: "case-1",
        documentTypeId: null,
        fileName: "investigation_report_jsmith.pdf",
        fileSize: 156000,
        mimeType: "application/pdf",
        version: 1,
        status: "review_required",
        approvalStatus: "pending",
        reviewDate: null,
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-el-2",
        title: "Witness Statement - A. Davis",
        description: "Witness statement from colleague",
        module: "employment_law",
        type: "witness_statement",
        siteId: "site-1",
        caseId: "case-1",
        documentTypeId: null,
        fileName: "witness_statement_adavis.pdf",
        fileSize: 78000,
        mimeType: "application/pdf",
        version: 1,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: null,
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-el-3",
        title: "Grievance Letter - S. Johnson",
        description: "Original grievance submission",
        module: "employment_law",
        type: "case_notes",
        siteId: "site-1",
        caseId: "case-2",
        documentTypeId: null,
        fileName: "grievance_letter_sjohnson.pdf",
        fileSize: 45000,
        mimeType: "application/pdf",
        version: 1,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: null,
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: "doc-el-4",
        title: "Settlement Agreement - M. Brown",
        description: "Final signed settlement agreement",
        module: "employment_law",
        type: "settlement_agreement",
        siteId: "site-1",
        caseId: "case-3",
        documentTypeId: null,
        fileName: "settlement_mbrown.pdf",
        fileSize: 234000,
        mimeType: "application/pdf",
        version: 2,
        status: "compliant",
        approvalStatus: "approved",
        reviewDate: null,
        expiryDate: null,
        uploadedBy: "user-1",
        assignedTo: null,
        isArchived: false,
        createdAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
    ];
    // Seed EL documents disabled for clean testing
    // elDocs.forEach(doc => this.documents.set(doc.id, doc));
    
    // Employment Law audit logs
    const elAuditLogs: AuditLog[] = [
      {
        id: "audit-el-1",
        action: "case_created",
        userId: "user-1",
        userName: "Sarah Johnson",
        siteId: "site-1",
        documentId: null,
        caseId: "case-1",
        supportRequestId: null,
        module: "employment_law",
        details: "Case EL-2024-001 created for John Smith",
        metadata: null,
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: "audit-el-2",
        action: "document_uploaded",
        userId: "user-1",
        userName: "Sarah Johnson",
        siteId: "site-1",
        documentId: "doc-el-1",
        caseId: "case-1",
        supportRequestId: null,
        module: "employment_law",
        details: "Investigation Report uploaded",
        metadata: null,
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: "audit-el-3",
        action: "milestone_completed",
        userId: "user-1",
        userName: "Sarah Johnson",
        siteId: "site-1",
        documentId: null,
        caseId: "case-1",
        supportRequestId: null,
        module: "employment_law",
        details: "Milestone 'Investigation meeting with employee' completed",
        metadata: null,
        createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      },
      {
        id: "audit-el-4",
        action: "case_status_changed",
        userId: "user-1",
        userName: "Sarah Johnson",
        siteId: "site-1",
        documentId: null,
        caseId: "case-1",
        supportRequestId: null,
        module: "employment_law",
        details: "Case status changed from open to under_investigation",
        metadata: null,
        createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
    ];
    // Seed EL audit logs disabled for clean testing
    // elAuditLogs.forEach(log => this.auditLogs.set(log.id, log));
    
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
    sampleAccessRequests.forEach(req => this.moduleAccessRequests.set(req.id, req));

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
    const user: User = { 
      ...insertUser, 
      id,
      role: (insertUser.role ?? "client") as any,
      siteId: insertUser.siteId ?? null,
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
      } = {
        health_safety: "hidden",
        human_resources: "hidden",
        employment_law: "hidden",
      };
      
      for (const access of moduleAccessList) {
        if (access.module === "health_safety" || access.module === "human_resources" || access.module === "employment_law") {
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
      
      return { ...site, complianceSummary: summary, moduleAccess, assignedConsultants };
    }));
  }

  async getSite(id: string): Promise<Site | undefined> {
    return this.sites.get(id);
  }

  async getSitesByCompany(companyName: string): Promise<Site[]> {
    return Array.from(this.sites.values()).filter(site => site.companyName === companyName);
  }

  async createSite(insertSite: InsertSite): Promise<Site> {
    const id = randomUUID();
    const site: Site = { 
      ...insertSite, 
      id,
      status: (insertSite.status ?? "active") as any,
      companyNumber: insertSite.companyNumber ?? null,
      address: insertSite.address ?? null,
      contactEmail: insertSite.contactEmail ?? null,
      contactPhone: insertSite.contactPhone ?? null,
      siteManager: insertSite.siteManager ?? null,
      website: insertSite.website ?? null,
      createdAt: new Date(),
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

  async getCompanyNames(): Promise<string[]> {
    const sites = Array.from(this.sites.values());
    const companyNames = new Set(sites.map(s => s.companyName));
    return Array.from(companyNames);
  }

  private async getSiteComplianceSummary(siteId: string): Promise<ComplianceSummary> {
    const docs = Array.from(this.documents.values()).filter(d => d.siteId === siteId && !d.isArchived);
    const total = docs.length;
    const compliant = docs.filter(d => d.status === "compliant").length;
    const review = docs.filter(d => d.status === "review_required").length;
    const overdue = docs.filter(d => d.status === "overdue").length;
    const pending = docs.filter(d => d.approvalStatus === "pending").length;
    
    return {
      totalDocuments: total,
      compliantDocuments: compliant,
      reviewRequired: review,
      overdueDocuments: overdue,
      pendingApprovals: pending,
      complianceScore: total > 0 ? Math.round((compliant / total) * 100) : 100,
    };
  }

  // Documents
  async getDocuments(module?: ModuleType): Promise<Document[]> {
    let docs = Array.from(this.documents.values()).filter(d => !d.isArchived);
    if (module) {
      docs = docs.filter(d => d.module === module);
    }
    return docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getDocument(id: string): Promise<DocumentWithDetails | undefined> {
    const doc = this.documents.get(id);
    if (!doc) return undefined;
    
    const site = doc.siteId ? this.sites.get(doc.siteId) : undefined;
    const uploader = doc.uploadedBy ? this.users.get(doc.uploadedBy) : undefined;
    const assignee = doc.assignedTo ? this.users.get(doc.assignedTo) : undefined;
    const versions = await this.getDocumentVersions(id);
    
    return {
      ...doc,
      siteName: site?.name,
      companyName: site?.companyName,
      uploadedByName: uploader?.fullName,
      assignedToName: assignee?.fullName,
      versions,
    };
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const createdNow = new Date();
    const doc: Document = { 
      ...insertDocument, 
      id,
      module: insertDocument.module as any,
      type: insertDocument.type as any,
      description: insertDocument.description ?? null,
      siteId: insertDocument.siteId ?? null,
      caseId: insertDocument.caseId ?? null,
      documentTypeId: insertDocument.documentTypeId ?? null,
      version: insertDocument.version ?? 1,
      status: (insertDocument.status ?? "review_required") as any,
      approvalStatus: (insertDocument.approvalStatus ?? "pending") as any,
      reviewDate: insertDocument.reviewDate ?? null,
      expiryDate: insertDocument.expiryDate ?? null,
      assignedTo: insertDocument.assignedTo ?? null,
      isArchived: insertDocument.isArchived ?? false,
      createdAt: createdNow,
      updatedAt: createdNow,
    };
    this.documents.set(id, doc);
    return doc;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const doc = this.documents.get(id);
    if (!doc) return undefined;
    
    const updated = { ...doc, ...updates, updatedAt: new Date() };
    this.documents.set(id, updated);
    return updated;
  }

  // Document Versions
  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return Array.from(this.documentVersions.values())
      .filter(v => v.documentId === documentId)
      .sort((a, b) => b.version - a.version);
  }

  async createDocumentVersion(insertVersion: InsertDocumentVersion): Promise<DocumentVersion> {
    const id = randomUUID();
    const version: DocumentVersion = { 
      ...insertVersion, 
      id,
      changeNote: insertVersion.changeNote ?? null,
      createdAt: new Date(),
    };
    this.documentVersions.set(id, version);
    return version;
  }

  // Audit Logs
  async getAuditLogs(documentId?: string, module?: ModuleType): Promise<AuditLog[]> {
    let logs = Array.from(this.auditLogs.values());
    if (documentId) {
      logs = logs.filter(log => log.documentId === documentId);
    }
    if (module) {
      logs = logs.filter(log => log.module === module);
    }
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const log: AuditLog = { 
      ...insertLog, 
      id,
      action: insertLog.action as any,
      module: (insertLog.module ?? null) as any,
      siteId: insertLog.siteId ?? null,
      documentId: insertLog.documentId ?? null,
      caseId: insertLog.caseId ?? null,
      supportRequestId: insertLog.supportRequestId ?? null,
      details: insertLog.details ?? null,
      metadata: insertLog.metadata ?? null,
      createdAt: new Date(),
    };
    this.auditLogs.set(id, log);
    return log;
  }

  // Support Requests
  async getSupportRequests(module?: ModuleType): Promise<SupportRequest[]> {
    let requests = Array.from(this.supportRequests.values());
    if (module) {
      requests = requests.filter(r => r.module === module);
    }
    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createSupportRequest(insertRequest: InsertSupportRequest): Promise<SupportRequest> {
    const id = randomUUID();
    const now = new Date();
    const request: SupportRequest = { 
      ...insertRequest, 
      id,
      status: (insertRequest.status ?? "open") as any,
      priority: (insertRequest.priority ?? "medium") as any,
      module: (insertRequest.module ?? null) as any,
      assignedTo: insertRequest.assignedTo ?? null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    this.supportRequests.set(id, request);
    return request;
  }

  async updateSupportRequest(id: string, updates: Partial<SupportRequest>): Promise<SupportRequest | undefined> {
    const request = this.supportRequests.get(id);
    if (!request) return undefined;
    
    const updated = { ...request, ...updates, updatedAt: new Date() };
    this.supportRequests.set(id, updated);
    return updated;
  }

  // Dashboard
  async getComplianceSummary(module?: ModuleType, siteId?: string): Promise<ComplianceSummary> {
    let docs = Array.from(this.documents.values()).filter(d => !d.isArchived);
    if (module) {
      docs = docs.filter(d => d.module === module);
    }
    if (siteId) {
      docs = docs.filter(d => d.siteId === siteId);
    }
    const total = docs.length;
    const compliant = docs.filter(d => d.status === "compliant").length;
    const review = docs.filter(d => d.status === "review_required").length;
    const overdue = docs.filter(d => d.status === "overdue").length;
    const pending = docs.filter(d => d.approvalStatus === "pending").length;
    
    return {
      totalDocuments: total,
      compliantDocuments: compliant,
      reviewRequired: review,
      overdueDocuments: overdue,
      pendingApprovals: pending,
      complianceScore: total > 0 ? Math.round((compliant / total) * 100) : 100,
    };
  }

  async getModuleSummaries(siteId?: string): Promise<ModuleSummary[]> {
    const modules: ModuleType[] = ["health_safety", "human_resources", "employment_law"];
    const moduleNames: Record<ModuleType, string> = {
      health_safety: "Health & Safety",
      human_resources: "Human Resources",
      employment_law: "Employment Law",
    };
    
    return Promise.all(modules.map(async (module) => {
      const summary = await this.getComplianceSummary(module, siteId);
      return {
        ...summary,
        module,
        moduleName: moduleNames[module],
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
    const docs = Array.from(this.documents.values())
      .filter(d => d.module === module && d.siteId === siteId && !d.isArchived);
    
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

  // Cases (Employment Law)
  async getCases(siteId?: string, status?: CaseStatus): Promise<Case[]> {
    let cases = Array.from(this.cases.values());
    if (siteId) {
      cases = cases.filter(c => c.siteId === siteId);
    }
    if (status) {
      cases = cases.filter(c => c.status === status);
    }
    return cases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getCase(id: string): Promise<Case | undefined> {
    return this.cases.get(id);
  }

  async createCase(insertCase: InsertCase): Promise<Case> {
    const id = randomUUID();
    const now = new Date();
    const newCase: Case = {
      ...insertCase,
      id,
      caseType: insertCase.caseType as any,
      status: (insertCase.status ?? "open") as any,
      description: insertCase.description ?? null,
      employeeId: insertCase.employeeId ?? null,
      isConfidential: insertCase.isConfidential ?? true,
      restrictedToUsers: insertCase.restrictedToUsers ?? null,
      hearingDate: insertCase.hearingDate ?? null,
      responseDeadline: insertCase.responseDeadline ?? null,
      resolutionDate: insertCase.resolutionDate ?? null,
      assignedConsultant: insertCase.assignedConsultant ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.cases.set(id, newCase);
    return newCase;
  }

  async updateCase(id: string, updates: Partial<Case>): Promise<Case | undefined> {
    const existing = this.cases.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.cases.set(id, updated);
    return updated;
  }

  async getCaseDocuments(caseId: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(d => d.caseId === caseId && !d.isArchived)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Case Milestones
  async getCaseMilestones(caseId: string): Promise<CaseMilestone[]> {
    return Array.from(this.caseMilestones.values())
      .filter(m => m.caseId === caseId)
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }

  async createCaseMilestone(insertMilestone: InsertCaseMilestone): Promise<CaseMilestone> {
    const id = randomUUID();
    const milestone: CaseMilestone = {
      ...insertMilestone,
      id,
      description: insertMilestone.description ?? null,
      dueDate: insertMilestone.dueDate ?? null,
      completedDate: insertMilestone.completedDate ?? null,
      isCompleted: insertMilestone.isCompleted ?? false,
      createdAt: new Date(),
    };
    this.caseMilestones.set(id, milestone);
    return milestone;
  }

  async updateCaseMilestone(id: string, updates: Partial<CaseMilestone>): Promise<CaseMilestone | undefined> {
    const existing = this.caseMilestones.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.caseMilestones.set(id, updated);
    return updated;
  }

  // Entity Module Access
  async getSiteModuleAccess(siteId: string): Promise<SiteModuleAccess[]> {
    return Array.from(this.siteModuleAccess.values())
      .filter(a => a.siteId === siteId);
  }

  async getSiteModuleAccessByModule(siteId: string, module: ModuleType): Promise<SiteModuleAccess | undefined> {
    return Array.from(this.siteModuleAccess.values())
      .find(a => a.siteId === siteId && a.module === module);
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
      const updated: SiteModuleAccess = {
        ...existing,
        status,
        grantedBy: status === "active" ? (grantedBy ?? existing.grantedBy) : existing.grantedBy,
        grantedAt: status === "active" ? now : existing.grantedAt,
        notes: notes ?? existing.notes,
        updatedAt: now,
      };
      this.siteModuleAccess.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const access: SiteModuleAccess = {
        id,
        siteId,
        module,
        status,
        grantedBy: status === "active" ? (grantedBy ?? null) : null,
        grantedAt: status === "active" ? now : null,
        notes: notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.siteModuleAccess.set(id, access);
      return access;
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

  // Consultant Assignments
  async getConsultantAssignments(siteId: string): Promise<ConsultantAssignment[]> {
    return Array.from(this.consultantAssignments.values())
      .filter(a => a.siteId === siteId);
  }

  async getConsultantSites(consultantId: string): Promise<ConsultantAssignment[]> {
    return Array.from(this.consultantAssignments.values())
      .filter(a => a.consultantId === consultantId);
  }

  async assignConsultant(assignment: InsertConsultantAssignment): Promise<ConsultantAssignment> {
    // Check if already assigned
    const existing = Array.from(this.consultantAssignments.values())
      .find(a => a.consultantId === assignment.consultantId && a.siteId === assignment.siteId);
    if (existing) {
      return existing;
    }

    const id = randomUUID();
    const newAssignment: ConsultantAssignment = {
      id,
      consultantId: assignment.consultantId,
      siteId: assignment.siteId,
      isPrimary: assignment.isPrimary ?? false,
      assignedAt: new Date(),
    };
    this.consultantAssignments.set(id, newAssignment);
    return newAssignment;
  }

  async updateConsultantAssignment(consultantId: string, siteId: string, updates: Partial<ConsultantAssignment>): Promise<ConsultantAssignment | undefined> {
    const entry = Array.from(this.consultantAssignments.entries())
      .find(([_, a]) => a.consultantId === consultantId && a.siteId === siteId);
    if (!entry) {
      return undefined;
    }
    const [id, assignment] = entry;
    const updated: ConsultantAssignment = {
      ...assignment,
      ...updates,
    };
    this.consultantAssignments.set(id, updated);
    return updated;
  }

  async removeConsultantAssignment(consultantId: string, siteId: string): Promise<boolean> {
    const assignment = Array.from(this.consultantAssignments.entries())
      .find(([_, a]) => a.consultantId === consultantId && a.siteId === siteId);
    if (assignment) {
      this.consultantAssignments.delete(assignment[0]);
      return true;
    }
    return false;
  }

  // Users by Entity
  async getUsersBySite(siteId: string): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(u => u.siteId === siteId);
  }

  async getConsultants(): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(u => u.role === "consultant");
  }

  // Document Types (Admin-managed)
  async getDocumentTypes(module?: ModuleType): Promise<DocumentTypeRecord[]> {
    let types = Array.from(this.documentTypesMap.values());
    if (module) {
      types = types.filter(t => t.module === module);
    }
    return types.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getDocumentType(id: string): Promise<DocumentTypeRecord | undefined> {
    return this.documentTypesMap.get(id);
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
    this.documentTypesMap.set(id, newDocType);
    return newDocType;
  }

  async updateDocumentType(id: string, updates: Partial<DocumentTypeRecord>): Promise<DocumentTypeRecord | undefined> {
    const existing = this.documentTypesMap.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: DocumentTypeRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.documentTypesMap.set(id, updated);
    return updated;
  }

  async deleteDocumentType(id: string): Promise<boolean> {
    return this.documentTypesMap.delete(id);
  }
}

export const storage = new MemStorage();
