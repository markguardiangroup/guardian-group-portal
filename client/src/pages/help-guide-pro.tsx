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
  BookOpen,
  Star,
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
    description: "Overview of the portal and your extended Pro Consultant access",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          As a Pro Consultant you have all of the Standard Consultant capabilities, plus elevated
          access to portal-wide content management — including the Template Library and/or Training
          Library — depending on the permissions granted by your administrator.
        </p>

        <div>
          <h4 className="font-semibold mb-3">What's in the sidebar</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              ["Dashboard", "Compliance overview across all your assigned sites"],
              ["Health & Safety", "H&S documents, incidents, and cloud share"],
              ["Human Resources", "HR policies, contracts, and documents"],
              ["Employment Law", "Case management and confidential correspondence"],
              ["Training", "Manage bookings, certificates, and the training library"],
              ["Toolkit", "Browse and share reference resources"],
              ["Support", "Manage and respond to client support requests"],
              ["Reports", "Live compliance and activity reports"],
              ["Companies", "View all assigned companies"],
              ["Sites", "View and manage all assigned sites"],
              ["Users", "View users across assigned sites"],
              ["Template Library", "Create and manage document templates (if enabled)"],
              ["Training Library", "Create and manage training courses (if enabled)"],
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
          <h4 className="font-semibold mb-3">Your role</h4>
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary">Consultant</Badge>
              <Badge variant="outline" className="text-xs">Pro</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Manages documents, training, and cases for assigned client sites. Additionally has
              access to create and manage portal-wide document templates and/or training courses,
              depending on the permissions enabled by your administrator.
            </p>
          </div>
        </div>

        <TipBox type="info">
          Pro permissions (Template Library, Training Library) are individually enabled per
          consultant by an administrator. If you expect access to one of these areas but can't see
          it in the sidebar, contact your admin team.
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
          you're responsible for.
        </p>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="companies">
            <AccordionTrigger>Viewing your assigned companies</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
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
                <StepList
                  steps={[
                    "Click 'Sites' in the sidebar",
                    "Filter by company using the dropdown",
                    "Click a site row to open its detail page",
                    "Use the module tabs (H&S, HR, Employment Law) to navigate compliance areas",
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
    id: "template-library",
    title: "Template Library",
    icon: <BookOpen className="h-5 w-5" />,
    description: "Creating and managing document templates for the portal",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Template Library is the central store of document templates used across the portal.
          Templates define the document slots that appear in each compliance module for client
          sites. Changes here affect all sites that use those templates.
        </p>

        <TipBox type="warning">
          Changes to templates (adding, renaming, or removing) can affect compliance scores and
          required document sets across multiple client sites. Make changes carefully and
          communicate them to affected consultants.
        </TipBox>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="create-template">
            <AccordionTrigger>Creating a new template</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Click 'Template Library' in the sidebar",
                    "Navigate to the appropriate module folder (H&S, HR, Employment Law)",
                    "Click 'Add Template'",
                    "Enter the template name, description, and module",
                    "Set whether it requires client sign-off by default",
                    "Optionally mark it as required — this adds it to all sites' required document sets",
                    "Click 'Save'",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="toolkit-sync">
            <AccordionTrigger>Toolkit ↔ Template Library sync</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Toolkit folders are automatically mirrored as subfolders within the Template
                  Library. When you create or rename a Toolkit folder, the corresponding Template
                  Library folder is updated automatically.
                </p>
                <TipBox type="info">
                  You don't need to manage both separately — the sync keeps them consistent. Focus
                  on maintaining the Toolkit structure and the Template Library reflects it.
                </TipBox>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="required-templates">
            <AccordionTrigger>Setting company-required templates</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Individual templates can be marked as required for specific companies. This adds
                  them to the compliance tracking for all sites within that company.
                </p>
                <StepList
                  steps={[
                    "Open the template in the Template Library",
                    "In the 'Required For' section, click 'Add Company'",
                    "Select the company — the template now appears as a required slot across their sites",
                    "To remove it, click the company name and select 'Remove'",
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
    id: "training-library",
    title: "Training Library",
    icon: <GraduationCap className="h-5 w-5" />,
    description: "Creating and managing courses in the training library",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Training Library is the portal-wide catalogue of available training courses. Courses
          here are what clients browse and enquire about, and what consultants select when booking
          training for a site.
        </p>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="create-course">
            <AccordionTrigger>Creating a new course</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Click 'Training Library' in the sidebar",
                    "Click 'Add Course'",
                    "Enter the course title, description, and module (H&S, HR, Employment Law)",
                    "Set the delivery type (in-person, online, or blended)",
                    "Add the duration and any prerequisites",
                    "Click 'Save' — the course is now visible to clients in the Training Library",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="manage-courses">
            <AccordionTrigger>Editing and archiving courses</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Open the course in the Training Library",
                    "Click 'Edit' to update its details",
                    "To remove it from the client-facing catalogue without deleting it, toggle it to 'Archived'",
                    "Archived courses no longer appear to clients but existing bookings referencing them are preserved",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <TipBox type="info">
          Changes to the Training Library are portal-wide — all consultants and clients see the
          same catalogue. Coordinate with your team before removing or significantly changing
          existing courses.
        </TipBox>
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
              ["bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20", "Overdue", "Document has passed its renewal date"],
              ["bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20", "Rejected", "Document was not accepted — a note explains why"],
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
                    "Open the document — it will show 'Awaiting Final Approval' or 'Awaiting Sign-Off'",
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
              "Complete the Investigation section — first aid, hospital visit, time off, root cause, and contributing factors",
              "Add Milestones (corrective actions) with due dates to track what needs to be done",
              "Mark each milestone complete as actions are carried out",
              "Upload any supporting documents (photos, external reports) in the Documents tab",
              "Use 'Regenerate Report' if the investigation changes original details",
              "Once all actions are complete, update to 'Resolved', then 'Closed'",
            ]}
          />
          <div className="mt-4">
            <TipBox type="info">
              The auto-generated incident report updates each time you regenerate it. It can be
              shared with the client or retained for audit purposes.
            </TipBox>
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
                    "Click 'Create' — you are automatically added with full access",
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
                    "Open the case and scroll to the 'Case Access' panel",
                    "Click 'Add User' and select the person",
                    "Choose their access level: View only, or Full access",
                    "Save — the user can now see and work with the case",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="bundles">
            <AccordionTrigger>Document bundle builder</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  The bundle builder lets you compile multiple case documents into a single merged
                  PDF — useful for sending a complete case pack to a solicitor or tribunal.
                </p>
                <StepList
                  steps={[
                    "Open the case and go to the 'Bundles' tab",
                    "Click 'Create Bundle' and give it a name",
                    "Add documents to the bundle from the case's document list",
                    "Click 'Generate PDF' — the bundle is merged into a single paginated document",
                    "Download the PDF or share the link",
                  ]}
                />
                <TipBox type="info">
                  Generated PDFs are cached. If you add more documents to the bundle, regenerate
                  it to include the latest additions.
                </TipBox>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    ),
  },
  {
    id: "training-bookings",
    title: "Training Bookings",
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
                    "Go to Training → Training Dashboard",
                    "Click 'Book Training'",
                    "Select the site, course, and scheduled date",
                    "For online courses, add the login URL and access credentials",
                    "Confirm — the booking appears immediately on the client's My Training page",
                    "When training is complete, click 'Mark as Complete'",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="enquiries">
            <AccordionTrigger>Responding to training enquiries</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <StepList
                  steps={[
                    "Open the enquiry from the Training Dashboard",
                    "Review the course, site, attendee count, and client notes",
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
                    "Go to Training → Certificates",
                    "Click 'Upload Certificate'",
                    "Select the completed booking this certificate relates to",
                    "Upload the file and enter the completion date",
                    "Click 'Upload' — the certificate is visible to the client immediately",
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
            ["Compliance Gaps", "Shows every required document slot that is missing or not yet approved."],
            ["Expiry & Renewal Risk", "Lists documents that are overdue or approaching their renewal date."],
            ["Site Comparison", "Displays the compliance score for every site within a company side-by-side."],
            ["Approval Pipeline", "Shows all documents waiting for sign-off or approval, grouped by workflow stage."],
            ["Deadline & Milestone Risk", "Highlights overdue incident investigation milestones and long-running open incidents."],
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
              "Click 'Support' in the sidebar",
              "Click a request to open it",
              "Read the client's subject and description",
              "Type your response in the reply box and click 'Send'",
              "Update the status to 'In Progress' while you're working on it",
              "Once resolved, mark the request as 'Resolved' — the client is notified",
            ]}
          />
        </div>

        <TipBox type="success">
          Clients can add follow-up messages to an open request — check requests you've already
          responded to for updates.
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

export default function HelpGuidePro() {
  return (
    <HelpGuideLayout
      sections={sections}
      audienceLabel="Pro Consultants"
      audienceBadgeClass="border-amber-400 text-amber-700 dark:text-amber-300"
    />
  );
}
