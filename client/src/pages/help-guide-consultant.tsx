import {
  HelpGuideLayout,
  StepList,
  TipBox,
  type GuideSection,
  Book,
  FileText,
  GraduationCap,
  HelpCircle,
  ChevronRight,
  AlertTriangle,
  Shield,
  MessageSquare,
  Briefcase,
  Lock,
  Eye,
  BarChart2,
  Wrench,
  Key,
  RefreshCw,
  UserPlus,
  Users,
  Building2,
  MapPin,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Separator,
  Badge,
} from "./help-guide";

const sections: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <Book className="h-5 w-5" />,
    description: "Overview of the portal and how to find your way around",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Welcome to the Guardian Group Compliance Portal. As a Standard Consultant you have access
          to all sites and companies you've been assigned to. You can manage documents, training,
          incidents, and Employment Law cases for those sites.
        </p>

        <div>
          <h4 className="font-semibold mb-3">What's in the sidebar</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              ["Dashboard", "Compliance overview across your assigned sites"],
              ["Health & Safety", "H&S documents, incidents, and cloud share for your sites"],
              ["Human Resources", "HR policies, contracts, and documents for your sites"],
              ["Employment Law", "Case management and confidential correspondence"],
              ["Training", "Manage bookings, certificates, and the training library"],
              ["Toolkit", "Browse and share reference resources with clients"],
              ["Support", "Manage and respond to client support requests"],
              ["Reports", "Live compliance and activity reports"],
              ["Companies", "View the companies assigned to you"],
              ["Sites", "View and manage sites across your assigned companies"],
              ["Users", "View users at your assigned sites"],
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

        <div>
          <h4 className="font-semibold mb-3">Consultant roles at a glance</h4>
          <div className="grid gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary">Consultant</Badge>
                <Badge variant="outline" className="text-xs">Standard</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Manages documents, training, and cases for assigned client sites only. Can upload
                documents, approve client sign-offs, and respond to support requests.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary">Consultant</Badge>
                <Badge variant="outline" className="text-xs">Pro</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                All Standard permissions, plus access to the Template Library and/or Training
                Library for creating and managing portal-wide content.
              </p>
            </div>
          </div>
        </div>

        <TipBox type="info">
          You only see the sites and companies you've been assigned to. Contact an administrator if
          you need access to additional sites.
        </TipBox>
      </div>
    ),
  },
  {
    id: "managing-sites",
    title: "Managing Companies & Sites",
    icon: <Building2 className="h-5 w-5" />,
    description: "Viewing assigned companies, sites, and managing client users",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Companies and Sites sections give you oversight of the organisations and locations
          you're responsible for. Client user management is handled from the Users section.
        </p>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="companies">
            <AccordionTrigger>Viewing your assigned companies</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  The Companies list shows every company you have been assigned to. Click any
                  company to open its detail view.
                </p>
                <StepList
                  steps={[
                    "Click 'Companies' in the sidebar",
                    "Use the search bar to find a specific company",
                    "Click a company row to open its detail page",
                    "From the detail page you can see its sites, users, and compliance status",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sites">
            <AccordionTrigger>Viewing and navigating sites</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  The Sites list shows all sites within your assigned companies.
                </p>
                <StepList
                  steps={[
                    "Click 'Sites' in the sidebar",
                    "Filter by company using the dropdown",
                    "Click a site row to open its detail page",
                    "Use the module tabs (H&S, HR, Employment Law) to navigate between compliance areas",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="client-users">
            <AccordionTrigger>Managing client users</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Client users are managed from the Users section. You can view users at your
                  assigned sites and check their status.
                </p>
                <TipBox type="info">
                  Creating new users and sending invitations is handled by administrators. If a
                  client needs an account, raise the request with your admin team.
                </TipBox>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    ),
  },
  {
    id: "documents",
    title: "Documents & Compliance",
    icon: <FileText className="h-5 w-5" />,
    description: "Uploading, reviewing, approving, and rejecting documents",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Documents sit at the heart of compliance. You upload and manage documents for each site,
          and approve or reject client sign-offs.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Document statuses</h4>
          <div className="grid gap-2">
            {[
              ["bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20", "Awaiting Sign-Off", "Uploaded but the client hasn't reviewed or signed off yet"],
              ["bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20", "Awaiting Final Approval", "Client has signed off — awaiting your final approval"],
              ["bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", "Compliant", "Document is current and counts towards the compliance score"],
              ["bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", "Approved", "Fully approved and counts towards the compliance score"],
              ["bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20", "Changes Requested", "Changes were requested; awaiting an updated document"],
              ["bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20", "Expired", "Document has passed its expiry date and must be replaced"],
              ["bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20", "Overdue", "Document has passed its renewal date"],
            ].map(([badgeClass, label, desc]) => (
              <div key={label} className="flex items-center gap-3 p-2 rounded border">
                <Badge variant="outline" className={badgeClass}>
                  {label}
                </Badge>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="upload-template">
            <AccordionTrigger>Uploading a document from a template</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Open the site and module, then click 'Add Document'",
                    "Select 'From Template' and choose the appropriate template from the list",
                    "The document slot and title are pre-filled from the template",
                    "Upload your file, add any notes, and click 'Upload'",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="upload-scratch">
            <AccordionTrigger>Uploading a document from scratch</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Open the site and module, then click 'Add Document'",
                    "Select 'From Scratch' and enter a document title",
                    "Choose whether the document requires client sign-off",
                    "Upload your file, add any notes, and click 'Upload'",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="approve">
            <AccordionTrigger>Approving or rejecting a document</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Open the document — it will show 'Awaiting Final Approval' or 'Awaiting Sign-Off' (for client-uploaded docs)",
                    "Review the file and any notes",
                    "Click 'Approve' to mark it as compliant — it now counts towards the site score",
                    "Or click 'Request Changes' and describe what needs to be updated",
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
    id: "incidents",
    title: "Incidents",
    icon: <AlertTriangle className="h-5 w-5" />,
    description: "Investigating and closing H&S incidents",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          When a client reports an incident you are notified automatically. Your role is to lead
          the investigation, track corrective actions, and formally close the case.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Investigating and closing an incident</h4>
          <StepList
            steps={[
              "Open the incident from the Incidents list",
              "Update the status to 'Under Review' to signal investigation has begun",
              "Complete the Investigation section — first aid given, hospital visit, time off work, root cause analysis, and contributing factors",
              "Add Milestones (corrective actions) with due dates to track what needs to be done",
              "Mark each milestone complete as actions are carried out",
              "Upload any supporting documents (photos, external reports) in the Documents tab",
              "If the investigation changes the original details, use 'Regenerate Report' to refresh the auto-generated PDF",
              "Once all actions are complete, update the status to 'Resolved', then 'Closed'",
            ]}
          />
          <div className="mt-4">
            <TipBox type="info">
              The automatically generated incident report can be shared with the client or retained
              for audit purposes. It updates each time you regenerate it.
            </TipBox>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">Incident statuses</h4>
          <div className="grid gap-2">
            {[
              ["bg-amber-500", "Reported", "Submitted by client — awaiting your review"],
              ["bg-blue-500", "Under Review", "Investigation in progress"],
              ["bg-purple-500", "Action Required", "Corrective actions in progress"],
              ["bg-green-500", "Resolved", "Investigation complete, actions done"],
              ["secondary", "Closed", "Formally closed and archived"],
            ].map(([colour, label, desc]) => (
              <div key={label} className="flex items-center gap-3 p-2 rounded border">
                <Badge
                  variant={colour.startsWith("bg-") ? "default" : (colour as any)}
                  className={colour.startsWith("bg-") ? colour : ""}
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
    id: "employment-law",
    title: "Employment Law Cases",
    icon: <Briefcase className="h-5 w-5" />,
    description: "Creating cases, managing access, and working with case documents",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Employment Law cases contain sensitive and confidential information. Access is restricted
          by default — you control who can see each case.
        </p>

        <TipBox type="warning">
          Even users with full site access cannot see Employment Law cases unless you explicitly
          add them.
        </TipBox>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="create-case">
            <AccordionTrigger>Creating a new case</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Open Employment Law and click 'New Case'",
                    "Select the company and site the case relates to",
                    "Enter the case title and a brief description",
                    "Set the case type (e.g. Disciplinary, Grievance, TUPE, etc.)",
                    "Click 'Create' — you are automatically added as a participant with full access",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="manage-access">
            <AccordionTrigger>Adding users to a case</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Open the case in Employment Law",
                    "Scroll to the 'Case Access' panel",
                    "Click 'Add User' and select the person",
                    "Choose their access level: View only, or Full access",
                    "Save — the user can now see and work with the case",
                  ]}
                />
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
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="case-documents">
            <AccordionTrigger>Working with case documents</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Open the case and click the 'Documents' tab",
                    "Click 'Add Document' to upload correspondence, evidence, or legal documents",
                    "Documents uploaded here are only visible to users with access to the case",
                    "Use document bundles to compile and merge multiple files into a single PDF for sending",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    ),
  },
  {
    id: "training",
    title: "Training",
    icon: <GraduationCap className="h-5 w-5" />,
    description: "Booking training, uploading certificates, and managing enquiries",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Training section lets you manage bookings for client sites, respond to training
          enquiries, and upload certificates once training is complete.
        </p>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="book">
            <AccordionTrigger>Booking training for a site</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Go to Training → Training Dashboard in the sidebar",
                    "Click 'Book Training'",
                    "Select the site, course, and scheduled date",
                    "For online courses, add the login URL and access credentials so the client can see them",
                    "Confirm the booking — it appears immediately on the client's My Training page",
                    "When training is complete, click 'Mark as Complete' on the booking",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="enquiries">
            <AccordionTrigger>Responding to training enquiries</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  When a client submits a training enquiry, it appears in the Training Dashboard
                  as an 'Enquiry Sent' booking.
                </p>
                <StepList
                  steps={[
                    "Open the enquiry from the Training Dashboard",
                    "Review the course, site, attendee count, and any notes from the client",
                    "Confirm a date and update the booking status to 'Confirmed'",
                    "The client is notified automatically",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="certificates">
            <AccordionTrigger>Uploading a certificate</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Go to Training → Certificates in the sidebar",
                    "Click 'Upload Certificate'",
                    "Select the completed booking this certificate relates to",
                    "Upload the certificate file and enter the completion date",
                    "Click 'Upload' — the certificate is immediately visible to the client in their My Training page",
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
              ["outline", "Enquiry Sent", "Client enquiry submitted, awaiting your confirmation"],
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
    description: "Browsing and sharing reference resources with clients",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Toolkit is a library of templates, guidance notes, checklists, and other reference
          materials available to you and your clients.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Browsing the Toolkit</h4>
          <StepList
            steps={[
              "Click 'Toolkit' in the sidebar",
              "Use the category filters to narrow down by topic",
              "Click any resource card to open its details",
              "Click 'Download' to save a copy to your device",
            ]}
          />
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Guided Template Finder
          </h4>
          <p className="text-sm text-muted-foreground">
            The Guided Template Finder walks users through a short question series to identify the
            right templates for their situation. You can walk a client through it during a
            consultation, or direct them to use it themselves in the Toolkit.
          </p>
        </div>

        <TipBox type="info">
          Toolkit resources are for reference. Documents that need formal sign-off and approval
          should be uploaded through the relevant compliance module (H&S or HR).
        </TipBox>
      </div>
    ),
  },
  {
    id: "reports",
    title: "Reports",
    icon: <BarChart2 className="h-5 w-5" />,
    description: "Using compliance and activity reports across your assigned sites",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Reports section gives you a live view of compliance health and outstanding actions
          across your assigned sites. Each report can be filtered by company and site.
        </p>

        <div className="grid gap-3">
          {[
            ["Compliance Gaps", "Shows every required document slot that is missing or not yet approved. Use this to identify exactly what needs to be done to improve a site's score."],
            ["Expiry & Renewal Risk", "Lists documents that are overdue or approaching their renewal date. Filter by time window to prioritise what needs attention soonest."],
            ["Site Comparison", "Displays the compliance score for every site within a company side-by-side, making it easy to spot which sites are lagging."],
            ["Approval Pipeline", "Shows all documents currently waiting for sign-off or approval, grouped by workflow stage. Useful for clearing a backlog."],
            ["Deadline & Milestone Risk", "Highlights overdue incident investigation milestones and unresolved incidents that have been open a long time."],
          ].map(([title, desc]) => (
            <div key={title} className="p-4 rounded-lg border bg-card">
              <h5 className="font-medium mb-1">{title}</h5>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <TipBox type="info">
          Reports are live — they always reflect the current state of the portal.
        </TipBox>
      </div>
    ),
  },
  {
    id: "support",
    title: "Support",
    icon: <MessageSquare className="h-5 w-5" />,
    description: "Responding to client support requests",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Clients use the Support section to ask questions and flag concerns. You receive
          notifications when new requests are raised.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Responding to a request</h4>
          <StepList
            steps={[
              "Click 'Support' in the sidebar to see all open requests for your assigned companies",
              "Click a request to open it",
              "Read the client's subject and description",
              "Type your response in the reply box and click 'Send'",
              "Update the status to 'In Progress' while you're working on it",
              "Once resolved, mark the request as 'Resolved' — the client is notified",
            ]}
          />
        </div>

        <div>
          <h4 className="font-semibold mb-3">Request statuses</h4>
          <div className="grid gap-2">
            {[
              ["outline", "Open", "Submitted by client — awaiting your response"],
              ["bg-blue-500", "In Progress", "You're working on it"],
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
          Clients can add follow-up messages to an open request without raising a new one — keep
          an eye on requests you've already responded to.
        </TipBox>
      </div>
    ),
  },
  {
    id: "account",
    title: "Your Account & Password",
    icon: <Key className="h-5 w-5" />,
    description: "Setting your password and managing your profile",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Your account is created by an administrator. You set your own password using the
          invitation link sent to your email.
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
              Invitation links expire after 48 hours. Contact an administrator if your link has
              expired.
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
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">Updating your profile</h4>
          <p className="text-sm text-muted-foreground">
            To update your name, contact details, or change your password, click your name or
            avatar in the top-right corner and select <strong>Settings</strong>.
          </p>
        </div>
      </div>
    ),
  },
];

export default function HelpGuideConsultant() {
  return (
    <HelpGuideLayout
      sections={sections}
      audienceLabel="Standard Consultants"
      audienceBadgeClass="border-violet-400 text-violet-700 dark:text-violet-300"
    />
  );
}
