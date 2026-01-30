import { useState } from "react";
import { 
  Book, 
  Building2, 
  Users, 
  Key, 
  FileText, 
  GraduationCap, 
  HelpCircle,
  ChevronRight,
  CheckCircle2,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
  UserPlus,
  RefreshCw,
  Mail,
  Shield,
  ClipboardList,
  MessageSquare,
  Link2,
  Briefcase,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  lastUpdated: string;
  forRoles: string[];
  content: React.ReactNode;
}

function StepList({ steps, testId }: { steps: string[]; testId?: string }) {
  return (
    <ol className="space-y-3 ml-4" data-testid={testId || "step-list"}>
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-3" data-testid={`step-${index + 1}`}>
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">
            {index + 1}
          </span>
          <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function TipBox({ children, type = "info", testId }: { children: React.ReactNode; type?: "info" | "warning" | "success"; testId?: string }) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200",
    warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200",
    success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200",
  };
  const icons = {
    info: <Info className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    success: <CheckCircle2 className="h-4 w-4" />,
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${styles[type]}`} data-testid={testId || `tip-${type}`}>
      <span className="flex-shrink-0 mt-0.5">{icons[type]}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

const guideSections: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <Book className="h-5 w-5" />,
    description: "An overview of the Guardian Group portal and how to navigate it",
    lastUpdated: "January 2026",
    forRoles: ["Admin", "Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Welcome to the Guardian Group Health & Safety and HR Compliance Portal. This guide will help you understand 
          how to use the system effectively.
        </p>
        
        <div>
          <h4 className="font-semibold mb-3">Portal Overview</h4>
          <p className="text-sm text-muted-foreground mb-4">
            The portal is organized into several key areas accessible from the sidebar:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
              <span><strong>Dashboard</strong> - Your central hub showing key metrics and recent activity</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
              <span><strong>Health & Safety</strong> - Manage H&S compliance documents and assessments</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
              <span><strong>Human Resources</strong> - Manage HR policies and employment documents</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
              <span><strong>Employment Law</strong> - Access employment law resources and case management</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
              <span><strong>Training</strong> - View and manage training courses and certificates</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
              <span><strong>Support</strong> - Submit and track support requests</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Understanding User Roles</h4>
          <div className="grid gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default">Admin</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Full access to all companies, sites, and users. Can manage the entire system including user invitations, 
                company setup, and system settings.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary">Consultant</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Access to assigned sites only. Can manage documents, training, and support for their assigned clients.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline">Client</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Access to their company's sites. Can view and sign off on documents, access training, and submit support requests.
              </p>
            </div>
          </div>
        </div>

        <TipBox type="info">
          Each entity in the system has a unique reference number (e.g., CMP-00001 for companies, STE-00001 for sites) 
          that makes it easy to identify and reference items.
        </TipBox>
      </div>
    ),
  },
  {
    id: "company-setup",
    title: "Setting Up Companies & Sites",
    icon: <Building2 className="h-5 w-5" />,
    description: "How to create and configure companies and their sites",
    lastUpdated: "January 2026",
    forRoles: ["Admin"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The portal uses a hierarchical structure: Companies contain Sites, and Sites have Users assigned to them. 
          This guide explains how to set up this structure.
        </p>

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Creating a New Company
          </h4>
          <StepList steps={[
            "Navigate to 'Companies' in the sidebar",
            "Click the 'Add Company' button in the top right",
            "Fill in the company details: name, address, contact information",
            "Optionally add company-specific notes",
            "Click 'Create' to save the new company",
            "The system will automatically generate a reference number (CMP-XXXXX)"
          ]} />
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Adding Sites to a Company
          </h4>
          <StepList steps={[
            "Open the company by clicking on it in the Companies list",
            "In the company detail view, find the 'Sites' section",
            "Click 'Add Site' to create a new site",
            "Enter the site name and address",
            "Configure which modules this site has access to (H&S, HR, Employment Law)",
            "Click 'Create' to save the site",
            "The system will generate a site reference number (STE-XXXXX)"
          ]} />
        </div>

        <TipBox type="success">
          After creating a site, you can assign consultants to manage it and invite client users who work at that location.
        </TipBox>

        <div>
          <h4 className="font-semibold mb-3">Module Access</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Each site can have access to different compliance modules based on your client's subscription:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500" />
              <span><strong>Health & Safety</strong> - Risk assessments, safety policies, COSHH assessments</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500" />
              <span><strong>Human Resources</strong> - Employment contracts, HR policies, staff handbooks</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500" />
              <span><strong>Employment Law</strong> - Legal advice, case management, tribunal support</span>
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "user-invitations",
    title: "Inviting Users",
    icon: <UserPlus className="h-5 w-5" />,
    description: "How to invite new users and manage their access",
    lastUpdated: "January 2026",
    forRoles: ["Admin"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The portal uses a secure invitation system. When you create a user, they receive an invitation link 
          to set up their own password. Admins never see or set user passwords.
        </p>

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Creating and Inviting a New User
          </h4>
          <StepList steps={[
            "Click 'Users' in the sidebar (under the Admin section)",
            "Click the 'Add User' button",
            "Fill in the user's details: first name, last name, email, and username",
            "Select their role: Admin, Consultant, or Client",
            "For Client users, select which company they belong to",
            "Click 'Create' - the system will generate an invitation",
            "Copy the invitation link from the dialog that appears",
            "Send the invitation link to the user via email or other secure means"
          ]} />
        </div>

        <TipBox type="info">
          Invitation links are valid for 48 hours. If the link expires, you can resend a new invitation from the user management page.
        </TipBox>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Resending an Invitation
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            If a user's invitation has expired or they didn't receive it:
          </p>
          <StepList steps={[
            "Go to User Management",
            "Find the user with 'Invited' status (shown with an amber badge)",
            "Click on the user row to open the actions menu",
            "Select 'Resend Invitation'",
            "A new invitation link will be generated (the old one becomes invalid)",
            "Copy and share the new link with the user"
          ]} />
        </div>

        <div>
          <h4 className="font-semibold mb-3">Understanding User Status</h4>
          <div className="grid gap-2">
            <div className="flex items-center gap-3 p-2 rounded border">
              <Badge className="bg-amber-500">Invited</Badge>
              <span className="text-sm text-muted-foreground">User has been invited but hasn't set their password yet</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded border">
              <Badge className="bg-green-500">Active</Badge>
              <span className="text-sm text-muted-foreground">User has set their password and can log in</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded border">
              <Badge variant="secondary">Inactive</Badge>
              <span className="text-sm text-muted-foreground">User account has been deactivated</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "password-management",
    title: "Password Creation & Resets",
    icon: <Key className="h-5 w-5" />,
    description: "How users set their passwords and reset forgotten passwords",
    lastUpdated: "January 2026",
    forRoles: ["Admin", "Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          This guide covers how users set their initial password when invited and how to reset a forgotten password.
        </p>

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Setting Your Password (New Users)
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            When you receive an invitation link:
          </p>
          <StepList steps={[
            "Click the invitation link you received",
            "You'll be taken to the 'Set Password' page",
            "Enter a password that meets the requirements (minimum 8 characters)",
            "Confirm your password by entering it again",
            "Click 'Set Password'",
            "You'll be redirected to the login page",
            "Log in with your username and new password"
          ]} />
        </div>

        <TipBox type="warning">
          Invitation links expire after 48 hours. If your link has expired, contact your administrator to request a new invitation.
        </TipBox>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Resetting a Forgotten Password
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            If you've forgotten your password:
          </p>
          <StepList steps={[
            "Go to the login page",
            "Click 'Forgot your password?' below the login button",
            "Enter the email address associated with your account",
            "Click 'Send Reset Link'",
            "Check your email for the password reset link",
            "Click the link and enter your new password",
            "Log in with your new password"
          ]} />
        </div>

        <TipBox type="info">
          Password reset links are valid for 1 hour and can only be used once. If your link expires, 
          you can request a new one from the login page.
        </TipBox>

        <div>
          <h4 className="font-semibold mb-3">Password Requirements</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Minimum 8 characters long</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>We recommend using a mix of letters, numbers, and symbols</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Avoid using easily guessable information</span>
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "user-site-assignments",
    title: "User Site Assignments",
    icon: <Link2 className="h-5 w-5" />,
    description: "How to assign users to companies and sites for access control",
    lastUpdated: "January 2026",
    forRoles: ["Admin", "Consultant"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Users must be assigned to sites to access the portal. Site assignments are managed directly from User Management.
        </p>

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Managing Site Assignments
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            You can view and manage site assignments for any user directly from the Users page:
          </p>
          <StepList steps={[
            "Navigate to Users from the sidebar",
            "View assigned sites as badges in the 'Sites' column",
            "Click the Actions menu (three dots) for any user",
            "Select 'Add Site' to assign a new site",
            "Select 'Remove Site' to remove an existing assignment",
            "Confirm the change when prompted"
          ]} />
        </div>

        <TipBox type="info">
          Clients can only be assigned to sites within their company. Consultants can be assigned to any site across all companies.
        </TipBox>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            View Profile
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            To see all details about a user including their full list of site assignments:
          </p>
          <StepList steps={[
            "Click the Actions menu for the user",
            "Select 'View Profile'",
            "Review the user's details and all assigned sites"
          ]} />
        </div>

        <TipBox type="warning">
          Consultants cannot see any sites until they are explicitly assigned. Make sure to assign sites when creating a new consultant account.
        </TipBox>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">Permission Levels for Clients</h4>
          <p className="text-sm text-muted-foreground mb-3">
            When assigning sites to client users, you can also set their permission level:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Eye className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-foreground">Viewer:</span> Can view documents and reports but cannot make changes
              </div>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-foreground">Contributor:</span> Can upload documents and submit for approval
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-foreground">Manager:</span> Full access including approving documents on behalf of the client
              </div>
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "employment-law-cases",
    title: "Employment Law Case Access",
    icon: <Briefcase className="h-5 w-5" />,
    description: "How case access works and adding users to Employment Law cases",
    lastUpdated: "January 2026",
    forRoles: ["Admin", "Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Employment Law cases contain sensitive information and have restricted access by default. This guide explains how case access works.
        </p>

        <TipBox type="warning">
          <strong>Important:</strong> By default, no users have access to Employment Law cases. Users must be explicitly added to each case to view or work with it.
        </TipBox>

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Why Cases Have Restricted Access
          </h4>
          <p className="text-sm text-muted-foreground">
            Employment Law cases often contain confidential employee information, disciplinary records, and legal correspondence. 
            To protect this sensitive data, access is controlled on a case-by-case basis. Even if a user has access to a site, 
            they won't see any EL cases unless they're specifically granted access to each case.
          </p>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Adding Users to a Case (Admin/Consultant)
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            To grant a user access to an Employment Law case:
          </p>
          <StepList steps={[
            "Navigate to Employment Law from the sidebar",
            "Find and open the case you want to manage",
            "Look for the 'Case Access' or 'Manage Access' section",
            "Click 'Add User' to grant access",
            "Select the user(s) who should have access to this case",
            "Choose their access level (View only, or Full access)",
            "Save changes"
          ]} />
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <EyeOff className="h-4 w-4" />
            What Users Without Access See
          </h4>
          <p className="text-sm text-muted-foreground">
            If a user doesn't have access to any Employment Law cases, they will see an empty case list when they visit the 
            Employment Law section. They will not be able to see that cases exist - ensuring complete confidentiality.
          </p>
        </div>

        <TipBox type="info">
          When you create a new Employment Law case, remember to add the relevant client users who need to be involved. 
          The case creator (admin or consultant) automatically has access.
        </TipBox>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">Access Levels for Cases</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Eye className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-foreground">View Access:</span> Can view case details and documents but cannot make changes
              </div>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-foreground">Full Access:</span> Can view, add documents, update milestones, and manage case progress
              </div>
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "document-management",
    title: "Managing Documents",
    icon: <FileText className="h-5 w-5" />,
    description: "How to upload, review, and approve compliance documents",
    lastUpdated: "January 2026",
    forRoles: ["Admin", "Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Documents are the core of your compliance management. This guide explains the document workflow.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Document Workflow Overview</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Documents go through an approval process depending on who uploads them:
          </p>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg border bg-card">
              <h5 className="font-medium mb-2">Consultant-Uploaded Documents</h5>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">Pending</Badge>
                <ChevronRight className="h-4 w-4" />
                <Badge className="bg-blue-500">Client Signed Off</Badge>
                <ChevronRight className="h-4 w-4" />
                <Badge className="bg-green-500">Approved</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Client reviews and signs off, then consultant gives final approval
              </p>
            </div>
            
            <div className="p-4 rounded-lg border bg-card">
              <h5 className="font-medium mb-2">Client-Uploaded Documents</h5>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">Pending</Badge>
                <ChevronRight className="h-4 w-4" />
                <Badge className="bg-green-500">Approved</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Consultant or admin reviews and approves directly
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">Uploading a Document</h4>
          <StepList steps={[
            "Navigate to the appropriate module (H&S, HR, or Employment Law)",
            "Click 'Documents' in the module menu",
            "Click 'Upload Document'",
            "Select the document template/type",
            "Choose the site this document is for",
            "Upload your file (PDF, Word, etc.)",
            "Add any notes or comments",
            "Click 'Upload' to submit"
          ]} />
        </div>

        <TipBox type="success">
          Documents are automatically tracked with version history. When you upload a new version, 
          the previous versions are kept for audit purposes.
        </TipBox>
      </div>
    ),
  },
  {
    id: "training",
    title: "Training & Courses",
    icon: <GraduationCap className="h-5 w-5" />,
    description: "How to book training and manage training records",
    lastUpdated: "January 2026",
    forRoles: ["Admin", "Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The training module helps you manage staff training requirements and maintain training records.
        </p>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="consultants">
            <AccordionTrigger>For Consultants: Booking Training</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList steps={[
                  "Go to 'Training Library' in the sidebar (under Admin section)",
                  "Browse available courses by module (H&S, HR)",
                  "Click on a course to view details",
                  "Click 'Book for Site' to create a booking",
                  "Select the site and enter booking details",
                  "For online courses, add access credentials if needed",
                  "Click 'Create Booking' to confirm"
                ]} />
                <TipBox type="info">
                  When training is completed, you can upload the certificate from the Training Certificates section.
                </TipBox>
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="clients">
            <AccordionTrigger>For Clients: Viewing Your Training</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList steps={[
                  "Go to Training → My Training",
                  "View your booked courses and their status",
                  "For online courses, click to view access credentials",
                  "Once completed, view and download your certificates"
                ]} />
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="certificates">
            <AccordionTrigger>Uploading Training Certificates</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Certificates can only be uploaded for completed training bookings:
                </p>
                <StepList steps={[
                  "Go to Training → Certificates",
                  "Click 'Upload Certificate'",
                  "Select the training booking this certificate is for",
                  "Upload the certificate file",
                  "Add completion date and any notes",
                  "Click 'Upload' to save"
                ]} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    ),
  },
  {
    id: "support",
    title: "Support Requests",
    icon: <MessageSquare className="h-5 w-5" />,
    description: "How to submit and track support requests",
    lastUpdated: "January 2026",
    forRoles: ["Admin", "Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Need help with a compliance question? The support system lets you submit requests and track their progress.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Submitting a Support Request</h4>
          <StepList steps={[
            "Navigate to 'Support' in the sidebar",
            "Click 'New Request'",
            "Select the category (H&S, HR, Employment Law, or General)",
            "Choose the priority level",
            "Enter a clear subject line",
            "Describe your question or issue in detail",
            "Attach any relevant files if needed",
            "Click 'Submit'"
          ]} />
        </div>

        <TipBox type="success">
          You'll receive notifications when your consultant responds. You can view all your requests 
          and their status from the Support page.
        </TipBox>

        <div>
          <h4 className="font-semibold mb-3">Request Status</h4>
          <div className="grid gap-2">
            <div className="flex items-center gap-3 p-2 rounded border">
              <Badge variant="outline">Open</Badge>
              <span className="text-sm text-muted-foreground">Request submitted and awaiting response</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded border">
              <Badge className="bg-blue-500">In Progress</Badge>
              <span className="text-sm text-muted-foreground">Consultant is working on your request</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded border">
              <Badge className="bg-green-500">Resolved</Badge>
              <span className="text-sm text-muted-foreground">Request has been addressed and closed</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export default function HelpGuide() {
  const [selectedSection, setSelectedSection] = useState<string>("getting-started");
  
  const currentSection = guideSections.find(s => s.id === selectedSection) || guideSections[0];

  return (
    <div className="flex h-full">
      <div className="w-72 border-r bg-muted/30 flex-shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Book className="h-5 w-5" />
            Help & Training Guide
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Learn how to use the portal
          </p>
        </div>
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="p-2">
            {guideSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                  selectedSection === section.id
                    ? "bg-primary text-primary-foreground"
                    : "hover-elevate"
                }`}
                data-testid={`nav-${section.id}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 mt-0.5 ${selectedSection === section.id ? "text-primary-foreground" : "text-muted-foreground"}`}>
                    {section.icon}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{section.title}</div>
                    <div className={`text-xs ${
                      selectedSection === section.id ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}>
                      {section.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-4xl">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-primary">{currentSection.icon}</span>
              <h1 className="text-2xl font-bold">{currentSection.title}</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Last updated: {currentSection.lastUpdated}</span>
              <span className="flex items-center gap-1">
                For: {currentSection.forRoles.map((role, i) => (
                  <Badge key={role} variant="outline" className="text-xs">
                    {role}
                  </Badge>
                ))}
              </span>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              {currentSection.content}
            </CardContent>
          </Card>

          <div className="mt-8 p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Need more help?</span>
            </div>
            <p className="text-sm text-muted-foreground">
              If you can't find the answer you're looking for, please submit a support request 
              and our team will be happy to assist you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
