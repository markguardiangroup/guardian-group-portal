import { useState } from "react";
import { Redirect, useLocation } from "wouter";
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
  Users,
  BookOpen,
  Settings,
  Star,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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

// ─── Shared sub-components ────────────────────────────────────────────────────

export interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  lastUpdated: string;
  content: React.ReactNode;
}

export function StepList({ steps, testId }: { steps: string[]; testId?: string }) {
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

export function TipBox({
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

// ─── Admin view-switcher bar ──────────────────────────────────────────────────

interface AdminView {
  label: string;
  path: string;
  badgeClass: string;
}

const ADMIN_VIEWS: AdminView[] = [
  { label: "Client", path: "/help/client", badgeClass: "border-blue-400 text-blue-700 dark:text-blue-300" },
  { label: "Standard Consultant", path: "/help/consultant", badgeClass: "border-violet-400 text-violet-700 dark:text-violet-300" },
  { label: "Pro Consultant", path: "/help/pro-consultant", badgeClass: "border-amber-400 text-amber-700 dark:text-amber-300" },
];

function AdminViewSwitcher({
  audienceLabel,
  onSwitch,
}: {
  audienceLabel: string;
  onSwitch: (path: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/20 flex-shrink-0">
      <span className="text-xs text-muted-foreground mr-2">Previewing as:</span>
      {ADMIN_VIEWS.map((view) => {
        const isActive = view.label === audienceLabel;
        return (
          <button
            key={view.path}
            onClick={() => onSwitch(view.path)}
            data-testid={`preview-toggle-${view.label.toLowerCase().replace(/\s+/g, "-")}`}
            className={[
              "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              isActive
                ? `${view.badgeClass} bg-background`
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            ].join(" ")}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Shared layout ─────────────────────────────────────────────────────────────

export function HelpGuideLayout({
  sections,
  audienceLabel,
  audienceBadgeClass,
}: {
  sections: GuideSection[];
  audienceLabel: string;
  audienceBadgeClass: string;
}) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedSection, setSelectedSection] = useState<string>(sections[0]?.id ?? "");
  const currentSection = sections.find((s) => s.id === selectedSection) ?? sections[0];

  const isDeveloper = user?.role === "developer";

  function handleSwitch(path: string) {
    setSelectedSection(sections[0]?.id ?? "");
    navigate(path);
  }

  return (
    <div className="flex flex-col h-full">
      {isDeveloper && (
        <AdminViewSwitcher audienceLabel={audienceLabel} onSwitch={handleSwitch} />
      )}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r bg-muted/30 flex-shrink-0 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Book className="h-5 w-5" />
              Help &amp; Training Guide
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">Guide for</p>
              <Badge variant="outline" className={`text-xs ${audienceBadgeClass}`}>
                {audienceLabel}
              </Badge>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className={[
                    "w-full text-left p-3 rounded-lg mb-1 transition-colors",
                    selectedSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover-elevate",
                  ].join(" ")}
                  data-testid={`nav-${section.id}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={[
                        "flex-shrink-0 mt-0.5",
                        selectedSection === section.id
                          ? "text-primary-foreground"
                          : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {section.icon}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{section.title}</div>
                      <div
                        className={[
                          "text-xs",
                          selectedSection === section.id
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground",
                        ].join(" ")}
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
    </div>
  );
}

// ─── /help redirect ────────────────────────────────────────────────────────────

export default function HelpGuide() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "client") return <Redirect to="/help/client" />;
  const isProConsultant =
    user.role === "developer" ||
    user.role === "administrator" ||
    user.consultantPermissions?.templateLibrary === true ||
    user.consultantPermissions?.trainingLibrary === true;
  if (isProConsultant) return <Redirect to="/help/pro-consultant" />;
  return <Redirect to="/help/consultant" />;
}

// ─── Re-export shared atoms so role pages can import from one place ────────────

export {
  Book,
  Building2,
  FileText,
  GraduationCap,
  HelpCircle,
  ChevronRight,
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
  Users,
  BookOpen,
  Settings,
  Star,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Separator,
  Badge,
};
