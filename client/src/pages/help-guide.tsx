import { useState } from "react";
import {
  Book,
  Building2,
  FileText,
  GraduationCap,
  HelpCircle,
  ChevronRight,
  CheckCircle2,
  Info,
  AlertTriangle,
  MapPin,
  Shield,
  MessageSquare,
  Briefcase,
  Lock,
  Eye,
  BarChart2,
  Wrench,
  Key,
  RefreshCw,
  Upload,
  UserPlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function TipBox({
  children,
  type = "info",
  testId,
}: {
  children: React.ReactNode;
  type?: "info" | "warning" | "success";
  testId?: string;
}) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200",
    warning:
      "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200",
    success:
      "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200",
  };
  const icons = {
    info: <Info className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    success: <CheckCircle2 className="h-4 w-4" />,
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${styles[type]}`}
      data-testid={testId || `tip-${type}`}
    >
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
    description: "Overview of the portal and how to find your way around",
    lastUpdated: "April 2026",
    forRoles: ["Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Welcome to the Guardian Group Compliance Portal. The portal brings together Health &amp;
          Safety, HR, Employment Law, Training, and Support in one place — organised around the
          companies and sites you work with.
        </p>

        <div>
          <h4 className="font-semibold mb-3">What's in the sidebar</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              ["Dashboard", "Your compliance overview — scores, recent activity, and quick links"],
              ["Health & Safety", "H&S compliance documents for your sites"],
              ["Human Resources", "HR policies, contracts, and employment documents"],
              ["Employment Law", "Case management and confidential legal correspondence"],
              ["Training", "Booked courses, certificates, and the training library"],
              ["Toolkit", "Browse and download reference resources"],
              ["Support", "Submit questions and track responses from your consultant"],
            ].map(([title, desc]) => (
              <li key={title} className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>
                  <strong>{title}</strong> — {desc}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">User roles at a glance</h4>
          <div className="grid gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <Badge variant="secondary" className="mb-1">
                Consultant
              </Badge>
              <p className="text-sm text-muted-foreground">
                Manages documents, training, and cases for assigned client sites. Can upload
                documents, approve client sign-offs, and respond to support requests.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <Badge variant="outline" className="mb-1">
                Client
              </Badge>
              <p className="text-sm text-muted-foreground">
                Views compliance documents for their sites, signs off documents sent by their
                consultant, accesses training records, and raises support requests.
              </p>
            </div>
          </div>
        </div>

        <TipBox type="info">
          You only see the sites and companies you've been assigned to. If you're missing access to
          a site, contact your consultant or administrator.
        </TipBox>
      </div>
    ),
  },
  {
    id: "dashboard",
    title: "Your Dashboard",
    icon: <BarChart2 className="h-5 w-5" />,
    description: "Understanding your compliance score and site overview",
    lastUpdated: "April 2026",
    forRoles: ["Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Dashboard is your starting point. It gives an at-a-glance view of compliance health
          across your sites.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Compliance Score</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Each site has a compliance score expressed as a percentage. The score is calculated
            from the required document slots for that site — the more required documents that are
            approved and up to date, the higher the score.
          </p>
          <div className="grid gap-2">
            {[
              ["bg-green-500", "80 – 100%", "Good standing — most required documents are in place"],
              ["bg-amber-500", "50 – 79%", "Needs attention — some required documents are missing or pending"],
              ["bg-red-500", "0 – 49%", "Critical — significant gaps in required compliance documents"],
            ].map(([colour, range, label]) => (
              <div key={range} className="flex items-center gap-3 p-2 rounded border">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${colour}`} />
                <span className="font-medium text-sm w-20 flex-shrink-0">{range}</span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <TipBox type="info">
          The score only counts documents in active required slots. Incident reports and
          Employment Law case documents are tracked separately and don't affect the score.
        </TipBox>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">Navigating to a site</h4>
          <StepList
            steps={[
              "Click a site card on the Dashboard to open that site's detail view",
              "Use the module tabs (H&S, HR, Employment Law) to switch between compliance areas",
              "Click any document row to view its full details, status, and history",
            ]}
          />
        </div>
      </div>
    ),
  },
  {
    id: "documents",
    title: "Documents & Compliance",
    icon: <FileText className="h-5 w-5" />,
    description: "Uploading, reviewing, signing off, and approving documents",
    lastUpdated: "April 2026",
    forRoles: ["Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Documents sit at the heart of compliance. The portal tracks required documents for each
          site and manages an approval workflow so nothing gets missed.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Document statuses</h4>
          <div className="grid gap-2">
            {[
              ["outline", "Pending", "Uploaded but awaiting sign-off or approval"],
              ["bg-blue-500", "Client Signed Off", "Client has reviewed and signed — consultant to approve"],
              ["bg-green-500", "Approved", "Fully approved and counted towards the compliance score"],
              ["bg-red-500", "Rejected", "Returned for changes — a note will explain why"],
              ["secondary", "Archived", "Superseded by a newer version; kept for audit purposes"],
            ].map(([variant, label, desc]) => (
              <div key={label} className="flex items-center gap-3 p-2 rounded border">
                <Badge
                  variant={variant.startsWith("bg-") ? "default" : (variant as any)}
                  className={variant.startsWith("bg-") ? variant : ""}
                >
                  {label}
                </Badge>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="consultant-upload">
            <AccordionTrigger>Consultants: uploading a document</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Open the site, then select the module (H&S or HR)",
                    "Find the document slot you want to fill and click 'Upload'",
                    "Choose or drag in your file (PDF, Word, Excel accepted)",
                    "Add any notes for the client, then click 'Upload'",
                    "The document status becomes Pending — the client will be prompted to review it",
                    "Once the client signs off, you'll see a notification to give final approval",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="client-signoff">
            <AccordionTrigger>Clients: reviewing and signing off a document</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  When your consultant uploads a document that needs your sign-off, you'll see it
                  listed under the relevant module with a <strong>Pending</strong> badge.
                </p>
                <StepList
                  steps={[
                    "Open the document to read or download it",
                    "Click 'Sign Off' once you're happy with the content",
                    "Add an optional note if needed, then confirm",
                    "The document moves to 'Client Signed Off' and your consultant is notified to approve it",
                  ]}
                />
                <TipBox type="info">
                  If something doesn't look right, use the Support section to raise a query with
                  your consultant before signing off.
                </TipBox>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="client-upload">
            <AccordionTrigger>Clients: uploading your own documents</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Some document slots allow clients to upload directly — for example, providing a
                  copy of an existing policy.
                </p>
                <StepList
                  steps={[
                    "Navigate to the document slot in the relevant module",
                    "Click 'Upload' and select your file",
                    "Add any notes for your consultant, then click 'Upload'",
                    "Your document is sent to your consultant for approval",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="consultant-approve">
            <AccordionTrigger>Consultants: approving a document</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Open the document — it will show 'Client Signed Off' or 'Pending' (for client-uploaded docs)",
                    "Review the file and any notes",
                    "Click 'Approve' to mark it as compliant — it now counts towards the site score",
                    "Or click 'Reject' and add a note explaining what needs to change",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <TipBox type="success">
          Every upload is versioned. When a new document replaces an old one, the previous version
          is archived automatically — nothing is ever deleted.
        </TipBox>
      </div>
    ),
  },
  {
    id: "employment-law",
    title: "Employment Law Cases",
    icon: <Briefcase className="h-5 w-5" />,
    description: "How to access and work with Employment Law cases",
    lastUpdated: "April 2026",
    forRoles: ["Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Employment Law cases contain sensitive and confidential information. Access is restricted
          by default — users must be explicitly added to each case.
        </p>

        <TipBox type="warning">
          Even if you have full site access, you will not see any Employment Law cases unless your
          consultant or administrator has added you to them.
        </TipBox>

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            How case access works
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              <span>The consultant who creates a case has access automatically</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              <span>Other users (including clients) must be added individually</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              <span>Users without access cannot see that a case exists at all</span>
            </li>
          </ul>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Adding users to a case (consultants)
          </h4>
          <StepList
            steps={[
              "Open the case in Employment Law",
              "Scroll to the 'Case Access' panel",
              "Click 'Add User' and select the person",
              "Choose their access level: View only, or Full access",
              "Save — the user can now see and work with the case",
            ]}
          />
        </div>

        <div>
          <h4 className="font-semibold mb-3">Access levels</h4>
          <div className="grid gap-2">
            <div className="flex items-start gap-3 p-3 rounded border">
              <Eye className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">View only</p>
                <p className="text-sm text-muted-foreground">
                  Can read case details and download documents
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded border">
              <FileText className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Full access</p>
                <p className="text-sm text-muted-foreground">
                  Can add documents, update milestones, and manage case progress
                </p>
              </div>
            </div>
          </div>
        </div>

        <TipBox type="info">
          If you believe you should have access to a case but cannot see it, contact your
          consultant and ask them to add you.
        </TipBox>
      </div>
    ),
  },
  {
    id: "training",
    title: "Training",
    icon: <GraduationCap className="h-5 w-5" />,
    description: "Viewing booked courses, certificates, and making enquiries",
    lastUpdated: "April 2026",
    forRoles: ["Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Training section keeps all booked courses and completed certificates in one place.
        </p>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="clients">
            <AccordionTrigger>Clients: viewing your training</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Go to Training → Dashboard in the sidebar",
                    "See all booked courses, their dates, and current status",
                    "For online courses, click to reveal the login credentials provided by your consultant",
                    "Go to Training → Certificates to view and download completed certificates",
                  ]}
                />
                <TipBox type="info">
                  If you need to book a course or have a question about upcoming training, raise a
                  Support request and your consultant will arrange it for you.
                </TipBox>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="consultants-book">
            <AccordionTrigger>Consultants: booking training for a site</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Go to Training Library in the sidebar",
                    "Browse available courses and click one to open the details",
                    "Click 'Make an Enquiry' to submit a booking request for a specific site",
                    "Fill in the site, preferred date, and any notes, then submit",
                    "Once confirmed, the course appears on the client's Training Dashboard",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="certificates">
            <AccordionTrigger>Consultants: uploading a certificate</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Go to Training → Certificates",
                    "Click 'Upload Certificate'",
                    "Select the booking this certificate relates to",
                    "Upload the file and enter the completion date",
                    "Click 'Upload' — the certificate is immediately visible to the client",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div>
          <h4 className="font-semibold mb-3">Booking statuses</h4>
          <div className="grid gap-2">
            {[
              ["outline", "Enquiry Sent", "Booking request submitted, awaiting confirmation"],
              ["bg-blue-500", "Confirmed", "Date and details confirmed"],
              ["bg-amber-500", "Scheduled", "Upcoming — added to the calendar"],
              ["bg-green-500", "Completed", "Training done; certificate can be uploaded"],
              ["secondary", "Cancelled", "Booking cancelled"],
            ].map(([variant, label, desc]) => (
              <div key={label} className="flex items-center gap-3 p-2 rounded border">
                <Badge
                  variant={variant.startsWith("bg-") ? "default" : (variant as any)}
                  className={variant.startsWith("bg-") ? variant : ""}
                >
                  {label}
                </Badge>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "toolkit",
    title: "Toolkit",
    icon: <Wrench className="h-5 w-5" />,
    description: "Browsing and downloading reference resources",
    lastUpdated: "April 2026",
    forRoles: ["Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Toolkit is a library of templates, guidance notes, checklists, and other reference
          materials. Resources can be browsed and downloaded at any time.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Browsing the Toolkit</h4>
          <StepList
            steps={[
              "Click 'Toolkit' in the sidebar",
              "Use the category filters to narrow down by topic (H&S, HR, General, etc.)",
              "Click any resource card to open its details",
              "Click 'Download' to save a copy to your device",
            ]}
          />
        </div>

        <TipBox type="info">
          Toolkit resources are provided for reference and guidance. For documents that need to
          be formally approved as part of your site's compliance, upload them through the
          relevant module (H&S or HR) rather than just downloading from the Toolkit.
        </TipBox>
      </div>
    ),
  },
  {
    id: "support",
    title: "Support",
    icon: <MessageSquare className="h-5 w-5" />,
    description: "Raising a support request and tracking responses",
    lastUpdated: "April 2026",
    forRoles: ["Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Use the Support section to ask questions, flag concerns, or request help from your
          consultant. Every request is tracked so nothing gets lost.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Raising a request</h4>
          <StepList
            steps={[
              "Click 'Support' in the sidebar",
              "Click 'New Request'",
              "Choose a category: Health & Safety, HR, Employment Law, or General",
              "Set a priority level",
              "Write a clear subject and description — the more detail, the faster we can help",
              "Attach any relevant files if needed",
              "Click 'Submit'",
            ]}
          />
        </div>

        <div>
          <h4 className="font-semibold mb-3">Request statuses</h4>
          <div className="grid gap-2">
            {[
              ["outline", "Open", "Submitted and waiting for a response"],
              ["bg-blue-500", "In Progress", "Your consultant is working on it"],
              ["bg-green-500", "Resolved", "Response provided and request closed"],
            ].map(([variant, label, desc]) => (
              <div key={label} className="flex items-center gap-3 p-2 rounded border">
                <Badge
                  variant={variant.startsWith("bg-") ? "default" : (variant as any)}
                  className={variant.startsWith("bg-") ? variant : ""}
                >
                  {label}
                </Badge>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <TipBox type="success">
          You can add follow-up messages to any open request directly from the Support page — no
          need to raise a new request for the same issue.
        </TipBox>
      </div>
    ),
  },
  {
    id: "account",
    title: "Your Account & Password",
    icon: <Key className="h-5 w-5" />,
    description: "Setting your password and what to do if you get locked out",
    lastUpdated: "April 2026",
    forRoles: ["Consultant", "Client"],
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Your account is created by an administrator. You set your own password using the invitation
          link sent to your email.
        </p>

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Setting your password for the first time
          </h4>
          <StepList
            steps={[
              "Open the invitation email from Guardian Group",
              "Click the 'Set up your account' link",
              "Enter a password of at least 8 characters and confirm it",
              "Click 'Set Password'",
              "You'll be redirected to the login page — log in with your email/username and new password",
            ]}
          />
          <div className="mt-4">
            <TipBox type="warning">
              Invitation links expire after 48 hours. If your link has expired, ask your
              administrator to resend it from User Management.
            </TipBox>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Resetting a forgotten password
          </h4>
          <StepList
            steps={[
              "Go to the login page",
              "Click 'Forgot your password?' below the login button",
              "Enter the email address on your account",
              "Click 'Send Reset Link' and check your inbox",
              "Follow the link in the email to choose a new password",
            ]}
          />
          <div className="mt-4">
            <TipBox type="info">
              Reset links are valid for 1 hour. If it expires, you can request another from the
              login page.
            </TipBox>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">Updating your profile</h4>
          <p className="text-sm text-muted-foreground">
            To update your name, contact details, or change your password after logging in, click
            your name or avatar in the top-right corner and select <strong>Settings</strong>.
          </p>
        </div>
      </div>
    ),
  },
];

export default function HelpGuide() {
  const [selectedSection, setSelectedSection] = useState<string>("getting-started");

  const currentSection =
    guideSections.find((s) => s.id === selectedSection) || guideSections[0];

  return (
    <div className="flex h-full">
      <div className="w-72 border-r bg-muted/30 flex-shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Book className="h-5 w-5" />
            Help &amp; Training Guide
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Learn how to use the portal</p>
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
                  <span
                    className={`flex-shrink-0 mt-0.5 ${
                      selectedSection === section.id
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {section.icon}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{section.title}</div>
                    <div
                      className={`text-xs ${
                        selectedSection === section.id
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      }`}
                    >
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
        <div className="p-6 max-w-4xl dash-animate">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-primary">{currentSection.icon}</span>
              <h1 className="text-2xl font-bold">{currentSection.title}</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Last updated: {currentSection.lastUpdated}</span>
              <span className="flex items-center gap-1">
                For:{" "}
                {currentSection.forRoles.map((role) => (
                  <Badge key={role} variant="outline" className="text-xs">
                    {role}
                  </Badge>
                ))}
              </span>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">{currentSection.content}</CardContent>
          </Card>

          <div className="mt-8 p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Can't find what you need?</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Raise a Support request and your consultant will get back to you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
