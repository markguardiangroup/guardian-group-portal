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
              ["Reports", "View compliance reports across your sites"],
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

        <TipBox type="info">
          You only see the sites and companies you've been assigned to. If you're missing access to
          a site, contact your consultant.
        </TipBox>
      </div>
    ),
  },
  {
    id: "dashboard",
    title: "Your Dashboard",
    icon: <BarChart2 className="h-5 w-5" />,
    description: "Understanding your compliance score and site overview",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Dashboard is your starting point. It gives an at-a-glance view of compliance health
          across your sites.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Compliance Score</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Each site has a compliance score expressed as a percentage. The score reflects how many
            required documents are approved and up to date.
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
          Incident reports and Employment Law case documents are tracked separately and don't
          affect the compliance score.
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
    description: "Reviewing, signing off, and providing documents",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Documents sit at the heart of compliance. Your consultant manages and uploads documents
          for your sites. Some will need your sign-off before they're formally approved.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Document statuses</h4>
          <div className="grid gap-2">
            {[
              ["outline", "Pending", "Uploaded but awaiting sign-off or approval"],
              ["bg-blue-500", "Client Signed Off", "You've reviewed and signed — consultant to approve"],
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

        <div>
          <h4 className="font-semibold mb-3">Reviewing and signing off a document</h4>
          <p className="text-sm text-muted-foreground mb-3">
            When your consultant uploads a document that needs your sign-off, you'll see it listed
            under the relevant module with a <strong>Pending</strong> badge.
          </p>
          <StepList
            steps={[
              "Open the document to read or download it",
              "Click 'Sign Off' once you're happy with the content",
              "Add an optional note if needed, then confirm",
              "The document moves to 'Client Signed Off' and your consultant is notified to approve it",
            ]}
          />
          <div className="mt-4">
            <TipBox type="info">
              If something doesn't look right, use the Support section to raise a query with your
              consultant before signing off.
            </TipBox>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">Providing documents to your consultant</h4>
          <p className="text-sm text-muted-foreground">
            If your consultant needs a document from you — for example, a copy of an existing
            policy or record — share it via your usual method (e.g. OneDrive, Google Drive, or
            email) and let your consultant know through the Support section. Your consultant will
            then upload and manage the document on your behalf.
          </p>
          <div className="mt-4">
            <TipBox type="info">
              Not sure how to share a file? Raise a Support request and your consultant will advise
              on the best way to get it to them.
            </TipBox>
          </div>
        </div>

        <TipBox type="success">
          Every upload is versioned. When a new document replaces an old one, the previous version
          is archived automatically — nothing is ever deleted.
        </TipBox>
      </div>
    ),
  },
  {
    id: "incidents",
    title: "Reporting Incidents",
    icon: <AlertTriangle className="h-5 w-5" />,
    description: "How to report a workplace incident and track its progress",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Incidents section sits within Health &amp; Safety. Use it to report workplace
          accidents, near misses, and dangerous occurrences.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Reporting an incident</h4>
          <StepList
            steps={[
              "Open the Health & Safety module and click 'Incidents' in the navigation",
              "Click 'Report Incident'",
              "Select the site and incident type (e.g. Slip/Trip/Fall, Near Miss, Dangerous Occurrence)",
              "Set the severity level and the date and time it occurred",
              "Enter details of the person affected — name, job title, and whether they are a member of the public",
              "Select what caused the incident and the resulting effects from the option lists",
              "Use the body diagram to mark the area(s) of injury if applicable",
              "Add witness details if relevant",
              "Tick 'RIDDOR Reportable' if the incident meets the legal reporting threshold (your consultant can advise)",
              "Submit — an incident report document is generated automatically and your consultant is notified",
            ]}
          />
          <div className="mt-4">
            <TipBox type="warning">
              If you are unsure whether an incident is RIDDOR reportable, tick the flag and your
              consultant will confirm. It is better to flag it and check than to miss a legal
              reporting obligation.
            </TipBox>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">Tracking an incident after reporting</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Once submitted, you can follow the progress of an incident from the Incidents list.
          </p>
          <div className="grid gap-2">
            {[
              ["bg-amber-500", "Reported", "Submitted — awaiting consultant review"],
              ["bg-blue-500", "Under Review", "Your consultant is investigating"],
              ["bg-purple-500", "Action Required", "Corrective actions are in progress"],
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
          <p className="text-sm text-muted-foreground mt-3">
            You can also upload supporting documents (photos, witness statements) to any incident
            by opening it and using the Documents tab.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "employment-law",
    title: "Employment Law Cases",
    icon: <Briefcase className="h-5 w-5" />,
    description: "How to access and work with Employment Law cases",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Employment Law cases contain sensitive and confidential information. Access is restricted
          by default — you must be explicitly added to each case by your consultant.
        </p>

        <TipBox type="warning">
          Even if you have full site access, you will not see any Employment Law cases unless your
          consultant has added you to them.
        </TipBox>

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            How case access works
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              <span>Your consultant adds you to cases where your involvement is needed</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              <span>Users without access cannot see that a case exists at all</span>
            </li>
          </ul>
        </div>

        <Separator />

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
    description: "Browsing courses, viewing bookings, and certificates",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Training section keeps all booked courses and completed certificates in one place.
        </p>

        <div>
          <h4 className="font-semibold mb-3">Browsing courses and making an enquiry</h4>
          <p className="text-sm text-muted-foreground mb-3">
            The Training Library lets you explore available courses and submit an enquiry directly
            to your consultant.
          </p>
          <StepList
            steps={[
              "Click 'Training' in the sidebar to open the Training Library",
              "Browse by module (H&S, HR, Employment Law) or use the Training Finder for personalised recommendations",
              "Click 'Enquire' on a course you're interested in",
              "Select the site, number of attendees, preferred timeframe, and add any notes",
              "Submit — your consultant will receive the enquiry and follow up to confirm the booking",
            ]}
          />
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3">Viewing your booked training and certificates</h4>
          <StepList
            steps={[
              "Click 'My Training' in the sidebar",
              "The Booked tab shows all upcoming courses with their scheduled dates",
              "For online courses, click to view the login URL and credentials provided by your consultant",
              "The Completed tab shows your training history",
              "The Certificates tab lets you view and download all your earned certificates",
            ]}
          />
        </div>

        <div>
          <h4 className="font-semibold mb-3">Booking statuses</h4>
          <div className="grid gap-2">
            {[
              ["outline", "Enquiry Sent", "Booking request submitted, awaiting confirmation"],
              ["bg-blue-500", "Confirmed", "Date and details confirmed"],
              ["bg-amber-500", "Scheduled", "Upcoming — added to the calendar"],
              ["bg-green-500", "Completed", "Training done"],
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
    lastUpdated: "May 2026",
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

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Not sure what you need? Use the Guided Template Finder
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            The Guided Template Finder asks a short series of questions and points you to the right
            templates for your situation.
          </p>
          <StepList
            steps={[
              "Open the Toolkit and click 'Guided Template Finder'",
              "Answer the questions about your situation — each answer narrows down the recommendations",
              "At the end, the wizard shows the templates most relevant to you",
              "Click any result to view and download the template",
              "Use 'Back' to change an answer or 'Start Again' to restart from scratch",
            ]}
          />
        </div>

        <TipBox type="info">
          Toolkit resources are for reference and guidance. For documents that need to be formally
          approved as part of your site's compliance, your consultant will upload them through the
          relevant module (H&S or HR).
        </TipBox>
      </div>
    ),
  },
  {
    id: "reports",
    title: "Reports",
    icon: <BarChart2 className="h-5 w-5" />,
    description: "Understanding the compliance reports available to you",
    lastUpdated: "May 2026",
    content: (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          The Reports section gives you a live view of compliance health and outstanding actions
          across your sites. Each report can be filtered by company and site.
        </p>

        <div className="grid gap-3">
          <div className="p-4 rounded-lg border bg-card">
            <h5 className="font-medium mb-1">Compliance Gaps</h5>
            <p className="text-sm text-muted-foreground">
              Shows every required document slot that is missing or not yet approved. Use this to
              see exactly what needs to be done to improve your compliance score.
            </p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <h5 className="font-medium mb-1">Expiry &amp; Renewal Risk</h5>
            <p className="text-sm text-muted-foreground">
              Lists documents that are overdue or approaching their renewal date.
            </p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <h5 className="font-medium mb-1">Site Comparison</h5>
            <p className="text-sm text-muted-foreground">
              Displays the compliance score for every site within a company side-by-side.
            </p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <h5 className="font-medium mb-1">Approval Pipeline</h5>
            <p className="text-sm text-muted-foreground">
              Shows all documents currently waiting for sign-off or approval, grouped by their
              current stage in the workflow.
            </p>
          </div>
        </div>

        <TipBox type="info">
          Reports are live — they always reflect the current state of the portal. There is no need
          to refresh or re-run them.
        </TipBox>
      </div>
    ),
  },
  {
    id: "support",
    title: "Support",
    icon: <MessageSquare className="h-5 w-5" />,
    description: "Raising a support request and tracking responses",
    lastUpdated: "May 2026",
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
              Invitation links expire after 48 hours. If your link has expired, ask your consultant
              or administrator to resend it.
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
            To update your name, contact details, or change your password, click your name or
            avatar in the top-right corner and select <strong>Settings</strong>.
          </p>
        </div>
      </div>
    ),
  },
];

export default function HelpGuideClient() {
  return (
    <HelpGuideLayout
      sections={sections}
      audienceLabel="Clients"
      audienceBadgeClass="border-blue-400 text-blue-700 dark:text-blue-300"
    />
  );
}
