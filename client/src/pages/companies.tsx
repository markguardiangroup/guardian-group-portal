import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAddressSync } from "@/hooks/use-address-sync";
import { IndustrySelect } from "@/components/industry-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Edit,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  MapPinned,
  Trash2,
  AlertTriangle,
  Users,
  RotateCcw,
  HardHat,
  Scale,
  GraduationCap,
  BookOpen,
  HelpCircle,
  BarChart2,
  X,
  MoreHorizontal,
  Download,
  Loader2,
  UserPlus,
  UserX,
  CheckSquare,
  Star,
  Key,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Lock,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCoverageFilter } from "@/hooks/use-coverage-filter";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useSessionState } from "@/hooks/use-session-state";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Info, Copy, Hash, ShieldAlert } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";
import type { CompanyWithSiteCount, PaginatedCompaniesResponse, User, ComplianceSummary } from "@shared/schema";
import { TablePagination, type PageSize } from "@/components/table-pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function CompanyComplianceBadge({ summary, onClick }: { summary?: ComplianceSummary; onClick?: (e: React.MouseEvent) => void }) {
  if (!summary) return null;
  const score = summary.complianceScore;
  const cls = score >= 90
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
    : score >= 70
    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
    : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800";
  const Icon = score >= 90 ? CheckCircle2 : score >= 70 ? AlertTriangle : XCircle;
  return (
    <Badge
      variant="outline"
      className={`${cls} cursor-pointer gap-1 text-xs`}
      style={{ minWidth: '4.25rem', justifyContent: 'center' }}
      onClick={onClick}
      data-testid="badge-compliance"
    >
      <Icon className="h-3 w-3" />
      {score}%
    </Badge>
  );
}

const COMPLIANCE_MODULES = [
  { accessKey: "healthSafetyAccess", scoreKey: "health_safety", label: "Health & Safety", path: "/health-safety", Icon: HardHat, iconClass: "text-emerald-600 dark:text-emerald-400" },
  { accessKey: "humanResourcesAccess", scoreKey: "human_resources", label: "Human Resources", path: "/human-resources", Icon: Users, iconClass: "text-blue-600 dark:text-blue-400" },
  { accessKey: "employmentLawAccess", scoreKey: "employment_law", label: "Employment Law", path: "/employment-law", Icon: Scale, iconClass: "text-pink-600 dark:text-pink-400" },
] as const;

function ComplianceModulePicker({ company }: { company: CompanyWithSiteCount }) {
  const [, navigate] = useLocation();
  const { handleCompanyChange } = useSiteFilter();
  const [open, setOpen] = useState(false);
  // For Group Owner companies, raw flags may be false while modules are inherited from members.
  // Prefer effectiveHealthSafetyAccess / effectiveHumanResourcesAccess / effectiveEmploymentLawAccess
  // (set by the backend) so the popover correctly reflects inherited module access.
  const isModuleEffectivelyEnabled = (accessKey: string) => {
    const effectiveKey = "effective" + accessKey.charAt(0).toUpperCase() + accessKey.slice(1);
    return (company as any)[effectiveKey] ?? (company as any)[accessKey];
  };
  const enabled = COMPLIANCE_MODULES.filter(m => isModuleEffectivelyEnabled(m.accessKey));

  const badge = <CompanyComplianceBadge summary={company.complianceSummary} />;

  if (!company.complianceSummary) return null;

  const goTo = (path: string) => {
    handleCompanyChange(company.name);
    navigate(path);
  };

  if (enabled.length <= 1) {
    const dest = enabled.length === 1 ? enabled[0].path : `/companies/${company.id}`;
    return (
      <span
        role="button"
        className="cursor-pointer"
        onClick={(e) => { e.stopPropagation(); goTo(dest); }}
        data-testid={`badge-compliance-link-${company.id}`}
      >
        {badge}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
          data-testid={`badge-compliance-link-${company.id}`}
        >
          {badge}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Go to dashboard</p>
        {enabled.map(({ label, path, Icon, iconClass, scoreKey }) => {
          const score = company.moduleScores?.[scoreKey];
          return (
            <button
              key={path}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => { e.stopPropagation(); goTo(path); setOpen(false); }}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
              <span className="flex-1 text-left">{label}</span>
              {score !== undefined && (
                <span className="ml-auto font-mono text-xs text-muted-foreground">{score}%</span>
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function CompanyDocumentsModulePicker({ company }: { company: CompanyWithSiteCount }) {
  const [, navigate] = useLocation();
  const { handleCompanyChange } = useSiteFilter();
  const [open, setOpen] = useState(false);
  const isModuleEffectivelyEnabled = (accessKey: string) => {
    const effectiveKey = "effective" + accessKey.charAt(0).toUpperCase() + accessKey.slice(1);
    return (company as any)[effectiveKey] ?? (company as any)[accessKey];
  };
  const enabled = COMPLIANCE_MODULES.filter(m => isModuleEffectivelyEnabled(m.accessKey));

  if (!company.complianceSummary) return null;

  const docsBadge = (
    <Badge variant="outline" className="text-xs gap-1 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" style={{ minWidth: '3rem', justifyContent: 'center' }}>
      <FileText className="h-3 w-3" />
      {company.complianceSummary.totalAllDocuments}
    </Badge>
  );

  const goTo = (path: string) => {
    handleCompanyChange(company.name);
    navigate(`${path}/documents`);
  };

  if (enabled.length <= 1) {
    const dest = enabled.length === 1 ? enabled[0].path : "/health-safety";
    return (
      <span role="button" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); goTo(dest); }} data-testid={`badge-doccount-${company.id}`}>
        {docsBadge}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span role="button" className="cursor-pointer" onClick={(e) => e.stopPropagation()} data-testid={`badge-doccount-${company.id}`}>
          {docsBadge}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Go to Documents</p>
        {enabled.map(({ label, path, Icon, iconClass, scoreKey }) => (
          <button
            key={path}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={(e) => { e.stopPropagation(); goTo(path); setOpen(false); }}
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
            <span className="flex-1 text-left">{label}</span>
            {company.moduleDocCounts?.[scoreKey] !== undefined && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">{company.moduleDocCounts[scoreKey]}</span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function CompanyCard({ 
  company, 
  onEdit, 
  onView,
  onDelete,
  isDeveloper,
}: { 
  company: CompanyWithSiteCount; 
  onEdit: (company: CompanyWithSiteCount) => void;
  onView: (companyId: string) => void;
  onDelete: (company: CompanyWithSiteCount) => void;
  isDeveloper: boolean;
}) {
  const [, navigate] = useLocation();

  const formatStatusDisplay = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const sources = company.sources ?? [];
  const firstSource = sources[0];
  const extraSources = sources.slice(1);

  return (
    <Card className="hover-elevate cursor-pointer" onClick={() => onView(company.id)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium">{company.name}</h4>
                  {company.internalCompanyNumber && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0 text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0" data-testid={`text-internal-no-${company.id}`}>
                      <Hash className="h-2.5 w-2.5" />{company.internalCompanyNumber}
                    </span>
                  )}
                </div>
                {(company.isGroupOwner || company.groupOwnerName) && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {company.isGroupOwner && (
                      <Badge variant="outline" className="text-xs py-0 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700" data-testid={`badge-go-${company.id}`}>
                        Group Owner
                      </Badge>
                    )}
                    {company.groupOwnerName && (
                      <Badge variant="outline" className="text-xs py-0 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700" data-testid={`badge-member-${company.id}`}>
                        Member of {company.groupOwnerName}
                      </Badge>
                    )}
                  </div>
                )}
                {company.acceloLinks && company.acceloLinks.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {company.acceloLinks.map((link) => {
                      const typeLabel = link.acceloType
                        ? link.acceloType.charAt(0).toUpperCase() + link.acceloType.slice(1).toLowerCase()
                        : null;
                      const acceloColor = (link as any).acceloColor;
                      const badgeStyle = acceloBadgeStyle(acceloColor);
                      return (
                        <Badge
                          key={link.sourceCode}
                          variant="outline"
                          className="text-xs py-0"
                          style={badgeStyle}
                          data-testid={`badge-accelo-${company.id}-${link.sourceCode}`}
                        >
                          Accelo{typeLabel ? `: ${typeLabel}` : ""}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Badge variant="secondary" data-testid={`badge-site-count-${company.id}`}>
                  {company.siteCount} {company.siteCount === 1 ? "site" : "sites"}
                </Badge>
                {company.complianceSummary && (
                  <CompanyComplianceBadge
                    summary={company.complianceSummary}
                    onClick={(e) => { e.stopPropagation(); navigate(`/companies/${company.id}`); }}
                  />
                )}
                <CompanyDocumentsModulePicker company={company} />
                <Badge 
                  variant={company.status === "on_hold" ? "secondary" : (company.status === "active" ? "default" : "secondary")} 
                  className={company.status === "on_hold" ? "bg-yellow-100 hover:bg-yellow-100 text-yellow-900" : ""}
                  data-testid={`badge-status-${company.id}`}
                >
                  {formatStatusDisplay(company.status)}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" data-testid={`button-company-menu-${company.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onView(company.id); }} 
                      data-testid={`button-view-company-${company.id}`}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Sites
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onEdit(company); }} 
                      data-testid={`button-edit-company-${company.id}`}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    {isDeveloper && (
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onDelete(company); }} 
                        className="text-destructive"
                        data-testid={`button-delete-company-${company.id}`}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Company
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {(company.addressLine1 || company.city) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {[company.addressLine1, company.city, company.postalCode].filter(Boolean).join(", ")}
                </span>
              )}
              {company.contactPhone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {company.contactPhone}
                </span>
              )}
              {company.contactEmail && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {company.contactEmail}
                </span>
              )}
              {company.employeeRange && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {company.employeeRange} employees
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              {sources.length > 0 ? (
                <>
                  <Badge key={firstSource} variant="outline" className="text-xs px-1.5 py-0 font-mono" data-testid={`badge-source-${company.id}-${firstSource}`}>
                    {firstSource}
                  </Badge>
                  {extraSources.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs px-1.5 py-0 cursor-default" data-testid={`badge-source-extra-${company.id}`}>
                            +{extraSources.length}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{extraSources.join(", ")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" data-testid={`badge-no-source-${company.id}`}>
                  No source assigned
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Persists across component mounts within a session — animation plays only on first load
function acceloBadgeStyle(color: string | null | undefined): React.CSSProperties {
  switch (color?.toLowerCase()) {
    case "green":    return { background: "#dcfce7", color: "#15803d", borderColor: "#86efac" };
    case "yellow":   return { background: "#fef9c3", color: "#a16207", borderColor: "#fde047" };
    case "pink":     return { background: "#fce7f3", color: "#be185d", borderColor: "#f9a8d4" };
    case "orange":   return { background: "#ffedd5", color: "#c2410c", borderColor: "#fdba74" };
    case "teal":     return { background: "#ccfbf1", color: "#0f766e", borderColor: "#5eead4" };
    case "purple":   return { background: "#f3e8ff", color: "#7e22ce", borderColor: "#d8b4fe" };
    case "red":      return { background: "#fee2e2", color: "#b91c1c", borderColor: "#fca5a5" };
    case "grey":
    case "gray":     return { background: "#f3f4f6", color: "#4b5563", borderColor: "#d1d5db" };
    case "blue":     return { background: "#dbeafe", color: "#1d4ed8", borderColor: "#93c5fd" };
    case "darkblue": return { background: "#e0e7ff", color: "#3730a3", borderColor: "#a5b4fc" };
    default:         return {};
  }
}

let _companiesShown = false;

export default function Companies() {
  const [searchQuery, setSearchQuery] = useSessionState("companies.searchQuery", "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useSessionState<string>("companies.statusFilter", "all");
  const [groupFilter, setGroupFilter] = useSessionState<string>("companies.groupFilter", "all");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithSiteCount | null>(null);
  const EMPLOYEE_RANGES = ["1-4", "5-9", "10-24", "25-49", "50-99", "100-249", "250-999", "1000+"];

  const [formData, setFormData] = useState({
    name: "",
    companyNumber: "",
    internalCompanyNumber: "",
    website: "",
    contactPhone: "",
    industry: "",
    employeeRange: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
    sources: [] as string[],
  });
  const [originalCompanyName, setOriginalCompanyName] = useState("");
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [companyNameError, setCompanyNameError] = useState<string | null>(null);

  const toTitleCase = (str: string): string => {
    return str
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };
  const [moduleAccessData, setModuleAccessData] = useState({
    healthSafety: false,
    humanResources: false,
    employmentLaw: false,
    training: false,
    toolkit: false,
    support: false,
    reports: false,
  });
  const [deleteTarget, setDeleteTarget] = useState<CompanyWithSiteCount | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState("");
  // Wizard state — all data collected locally, nothing written to DB until "Confirm & Create"
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardCurrentSiteName, setWizardCurrentSiteName] = useState<string>("");
  const [wizardStep, setWizardStep] = useState<"site" | "site-docs" | "add-another-site" | "contact" | "review" | null>(null);
  const [wizardSubsequentSite, setWizardSubsequentSite] = useState(false);
  const [wizardIsAcceloFlow, setWizardIsAcceloFlow] = useState(false);
  interface PendingSite { name: string; addressLine1: string; addressLine2: string; city: string; county: string; postalCode: string; country: string; mandatoryTemplateIds: string[]; }
  const [pendingSites, setPendingSites] = useState<PendingSite[]>([]);
  interface PendingCompanyFull { companyData: typeof formData; moduleAccess: typeof moduleAccessData; acceloContext: { acceloCompanyId: string; acceloStanding?: string | null; acceloType?: string | null; acceloColor?: string | null; sourceCode: string; } | null; }
  const [pendingCompanyFull, setPendingCompanyFull] = useState<PendingCompanyFull | null>(null);
  type PendingContact = { type: "manual"; data: typeof primaryContact } | { type: "accelo"; sourceCode: string; selections: Array<{ acceloId: string; firstname: string; lastname: string; email: string; phone: string; mobile: string; setAsPrimary: boolean; setAsKeyContact: boolean; addToSite: boolean; }> };
  const [pendingContact, setPendingContact] = useState<PendingContact | null>(null);
  // Site-docs sub-state (reused per site within the wizard)
  const [reqDocsActiveModule, setReqDocsActiveModule] = useState<string>("");
  const [selectedRequiredIds, setSelectedRequiredIds] = useState<Set<string>>(new Set());
  // Primary contact sub-state
  const [primaryContact, setPrimaryContact] = useState({
    title: "",
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    jobTitle: "",
    department: "",
    phone: "",
    mobile: "",
    preferredContactMethod: "email" as "email" | "phone" | "mobile" | "any",
    notes: "",
  });
  const [primaryContactEmailError, setPrimaryContactEmailError] = useState<string | null>(null);
  const [wizardDomainMismatch, setWizardDomainMismatch] = useState<{ emailDomain: string; websiteDomain: string } | null>(null);
  const [wizardShowDomainConfirm, setWizardShowDomainConfirm] = useState(false);
  const [wizardDomainConfirmCallback, setWizardDomainConfirmCallback] = useState<(() => void) | null>(null);

  // Accelo import state
  const [isAcceloSearchOpen, setIsAcceloSearchOpen] = useState(false);
  const [acceloSearchQuery, setAcceloSearchQuery] = useState("");
  const [acceloSearchResults, setAcceloSearchResults] = useState<any[]>([]);
  const [acceloSearching, setAcceloSearching] = useState(false);
  const [acceloSearchError, setAcceloSearchError] = useState<string | null>(null);
  const [acceloSearched, setAcceloSearched] = useState(false);
  const [acceloSelectingId, setAcceloSelectingId] = useState<string | null>(null);
  const [acceloImportContext, setAcceloImportContext] = useState<{ acceloCompanyId: string; acceloStanding?: string | null; acceloType?: string | null; acceloColor?: string | null } | null>(null);
  const acceloImportContextRef = useRef<{ acceloCompanyId: string; acceloStanding?: string | null; acceloType?: string | null; acceloColor?: string | null } | null>(null);
  useEffect(() => { acceloImportContextRef.current = acceloImportContext; }, [acceloImportContext]);
  const [acceloContacts, setAcceloContacts] = useState<any[]>([]);
  const [acceloContactsLoading, setAcceloContactsLoading] = useState(false);
  interface ContactRowState { selected: boolean; primary: boolean; keyContact: boolean; addToSite: boolean; }
  const [contactRows, setContactRows] = useState<Record<string, ContactRowState>>({});
  const [staffFilter, setStaffFilter] = useSessionState<string>("companies.staffFilter", "my");
  const [sortBy, setSortBy] = useSessionState<"name" | "city" | "industry" | "siteCount" | "status" | "compliance">("companies.sortBy", "name");
  const [sortDir, setSortDir] = useSessionState<"asc" | "desc">("companies.sortDir", "asc");
  const handleSortCompanies = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const { captureSnapshot, onCompanyUpdated, AddressSyncDialog } = useAddressSync();

  const [siteData, setSiteData] = useState({
    name: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const [limit, setLimit] = useState<PageSize>(20);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isProConsultant = user?.role === "consultant" && (user as any)?.consultantTier === "pro";
  const { coveringFor } = useCoverageFilter();

  type StaffConsultant = { id: string; fullName: string; consultantTier?: string | null };
  const { data: myStaff = [] } = useQuery<StaffConsultant[]>({
    queryKey: ["/api/consultants/my-staff"],
    queryFn: async () => {
      const res = await fetch("/api/consultants/my-staff", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isProConsultant,
  });

  type Source = { id: string; code: string; label: string; isActive: boolean };
  const { data: availableSources = [] } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const res = await fetch("/api/sources", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const queryParams = {
    page, limit, search: debouncedSearch, status: statusFilter,
    staffFilter: isProConsultant ? staffFilter : undefined, groupFilter,
  };
  const buildCompanyUrl = (extra?: Record<string, string>) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(statusFilter !== "all" && { status: statusFilter }),
      ...(isProConsultant && staffFilter === "my" && { myAssigned: "true" }),
      ...(isProConsultant && staffFilter !== "my" && staffFilter !== "all" && { staffId: staffFilter }),
      ...(groupFilter !== "all" && { groupFilter }),
      ...extra,
    });
    return `/api/companies?${params}`;
  };

  // Phase 1: fast lite fetch — basic company data, no compliance computation
  const { data: liteData, isLoading } = useQuery<PaginatedCompaniesResponse>({
    queryKey: ["/api/companies", { ...queryParams, lite: true }],
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(buildCompanyUrl({ lite: "true" }), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
  });

  // Phase 2: full fetch with compliance — runs in background, merges when ready
  const { data: fullData } = useQuery<PaginatedCompaniesResponse>({
    queryKey: ["/api/companies", queryParams],
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(buildCompanyUrl(), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
  });

  const data = fullData ?? liteData;
  const complianceLoading = !fullData && !!liteData;

  // Fetch all companies (large limit) to derive available group owners for the filter dropdown.
  // Use the lite path — this only needs the company list + isGroupOwner flag, not the
  // expensive per-company compliance computation.
  const { data: allCompaniesData } = useQuery<PaginatedCompaniesResponse>({
    queryKey: ["/api/companies", { limit: 1000, lite: true }],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await fetch("/api/companies?limit=1000&lite=true", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
  });

  const groupOwners = (allCompaniesData?.companies ?? []).filter(c => c.isGroupOwner);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await apiRequest("PATCH", `/api/companies/${id}`, data);
      return response.json();
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company updated successfully" });
      setEditingCompany(null);
      resetForm();

      const newAddr = {
        addressLine1: variables.data.addressLine1, addressLine2: variables.data.addressLine2,
        city: variables.data.city, county: variables.data.county,
        postalCode: variables.data.postalCode, country: variables.data.country,
      };
      await onCompanyUpdated(variables.id, newAddr);
    },
    onError: (error: Error) => {
      let message = "Failed to update company. Please try again.";
      try { message = JSON.parse(error.message.replace(/^\d+: /, "")).error || message; } catch {}
      toast({ title: "Failed to update company", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await apiRequest("DELETE", `/api/companies/${companyId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Company and all associated data deleted successfully" });
      setDeleteTarget(null);
      setDeleteConfirmText("");
    },
    onError: () => {
      toast({ title: "Failed to delete company", variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const response = await apiRequest("POST", `/api/companies/bulk-delete`, { companyIds });
      return response.json();
    },
    onSuccess: (data: { deleted: { id: string; name: string }[]; failed: { id: string; error: string }[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      if (data.failed.length === 0) {
        toast({ title: `${data.deleted.length} ${data.deleted.length === 1 ? "company" : "companies"} and all associated data deleted successfully` });
      } else {
        toast({
          title: `Deleted ${data.deleted.length} of ${data.deleted.length + data.failed.length} companies`,
          description: `${data.failed.length} failed: ${data.failed.map(f => f.error).join(", ")}`,
          variant: "destructive",
        });
      }
      setIsBulkDeleteOpen(false);
      setBulkDeleteConfirmText("");
      setSelectedCompanyIds(new Set());
      setIsAdminMode(false);
    },
    onError: () => {
      toast({ title: "Failed to delete companies", variant: "destructive" });
    },
  });

  interface DocumentTemplate {
    id: string;
    name: string;
    module: string;
    visibility: "public" | "private";
    isActive: boolean;
    requiresApproval?: boolean;
  }

  const { data: allTemplates = [] } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
    enabled: wizardOpen,
  });

  interface AcceloIntegrationStatus { sourceCode: string; sourceLabel: string; deployment: string; connected: boolean; expiresAt?: string | null; isActive: boolean; }
  const { data: acceloIntegrations } = useQuery<AcceloIntegrationStatus[]>({
    queryKey: ["/api/integrations/accelo/status"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/accelo/status", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: user?.role === "developer" || isProConsultant,
    staleTime: 5 * 60 * 1000,
  });
  const connectedAcceloIntegrations = (acceloIntegrations ?? []).filter(i => i.connected && i.isActive);
  // Active source for the current search session
  const [acceloActiveSource, setAcceloActiveSource] = useState<string>("GS");

  // ── Wizard helpers ─────────────────────────────────────────────────────────

  const generateWizardUsername = (firstName: string, lastName: string): string => {
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, "");
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, "");
    if (cleanFirst && cleanLast) return `${cleanFirst}.${cleanLast}`;
    return cleanFirst || cleanLast;
  };

  const extractEmailDomain = (email: string): string => {
    const at = email.indexOf("@");
    return at >= 0 ? email.slice(at + 1).toLowerCase().trim() : "";
  };

  const extractWebsiteDomain = (website: string): string => {
    try {
      const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
      const host = new URL(url).hostname.toLowerCase();
      return host.startsWith("www.") ? host.slice(4) : host;
    } catch {
      return website.toLowerCase().replace(/^www\./i, "").split("/")[0].trim();
    }
  };

  const resetWizard = () => {
    setWizardOpen(false);
    setWizardCurrentSiteName("");
    setWizardStep(null);
    setWizardSubsequentSite(false);
    setWizardIsAcceloFlow(false);
    setPendingSites([]);
    setPendingCompanyFull(null);
    setPendingContact(null);
    setSelectedRequiredIds(new Set());
    setReqDocsActiveModule("");
    setPrimaryContact({
      title: "", firstName: "", lastName: "", username: "", email: "",
      jobTitle: "", department: "", phone: "", mobile: "",
      preferredContactMethod: "email", notes: "",
    });
    setPrimaryContactEmailError(null);
    setSiteData({ name: "", addressLine1: "", addressLine2: "", city: "", county: "", postalCode: "", country: "" });
    setAcceloContacts([]);
    setContactRows({});
  };

  const handleWizardNavigateToCompany = (companyId: string) => {
    resetWizard();
    navigate(`/companies/${companyId}`);
  };

  const handleSwitchToManualContact = () => {
    setWizardIsAcceloFlow(false);
  };

  // ── Confirm & Create (deferred single API call) ────────────────────────────

  const confirmAndCreateMutation = useMutation({
    mutationFn: async () => {
      if (!pendingCompanyFull) throw new Error("No pending company data");
      const payload = {
        company: { ...pendingCompanyFull.companyData, moduleAccess: pendingCompanyFull.moduleAccess, acceloContext: pendingCompanyFull.acceloContext },
        sites: pendingSites,
        contact: pendingContact,
      };
      const response = await apiRequest("POST", "/api/companies/wizard", payload);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create company");
      }
      return response.json() as Promise<{ companyId: string; siteIds: string[]; contactIds: string[] }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Company created", description: "Company, site(s) and contact have been set up successfully." });
      handleWizardNavigateToCompany(result.companyId);
    },
    onError: (error: Error) => {
      let message = "Failed to create company. Please try again.";
      try { message = JSON.parse(error.message.replace(/^\d+: /, "")).error || message; } catch {}
      toast({ title: "Failed to create company", description: message, variant: "destructive" });
    },
  });

  // ── Save site template overrides (synchronous local state update) ──────────

  const handleSaveSiteDocs = () => {
    if (selectedRequiredIds.size > 0) {
      setPendingSites(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], mandatoryTemplateIds: Array.from(selectedRequiredIds) };
        }
        return updated;
      });
    }
    setWizardStep("add-another-site");
  };

  const handleSkipSiteDocs = () => {
    setWizardStep("add-another-site");
  };

  // ── Primary contact creation ───────────────────────────────────────────────

  const handlePrimaryContactSubmit = () => {
    if (!primaryContact.firstName.trim()) {
      toast({ title: "First name is required", variant: "destructive" }); return;
    }
    if (!primaryContact.lastName.trim()) {
      toast({ title: "Surname is required", variant: "destructive" }); return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!primaryContact.email.trim() || !emailRegex.test(primaryContact.email.trim())) {
      setPrimaryContactEmailError("Please enter a valid email address"); return;
    }
    setPrimaryContactEmailError(null);
    const doSave = () => {
      setPendingContact({ type: "manual", data: { ...primaryContact } });
      setWizardStep("review");
    };
    // Always recompute mismatch at submit time (catches paste/autofill bypassing onChange)
    const companyWebsite = pendingCompanyFull?.companyData.website;
    if (companyWebsite) {
      const emailDomain = extractEmailDomain(primaryContact.email.trim());
      const websiteDomain = extractWebsiteDomain(companyWebsite);
      if (emailDomain && websiteDomain && emailDomain !== websiteDomain) {
        setWizardDomainMismatch({ emailDomain, websiteDomain });
        setWizardDomainConfirmCallback(() => doSave);
        setWizardShowDomainConfirm(true);
        return;
      }
    }
    setWizardDomainMismatch(null);
    doSave();
  };

  const MODULE_MAP: Record<string, { key: "healthSafety" | "humanResources" | "employmentLaw"; label: string }> = {
    health_safety: { key: "healthSafety", label: "Health & Safety" },
    human_resources: { key: "humanResources", label: "Human Resources" },
    employment_law: { key: "employmentLaw", label: "Employment Law" },
  };

  const mapAcceloCountry = (country: string): string => {
    if (!country) return "";
    const c = country.trim().toLowerCase();
    if (c.includes("northern ireland")) return "Northern Ireland";
    if (c.includes("ireland")) return "Ireland";
    if (c.includes("scotland")) return "Scotland";
    if (c.includes("wales")) return "Wales";
    if (c.includes("england") || c.includes("united kingdom") || c === "uk" || c === "gb") return "England";
    return "";
  };

  const ACCELO_COUNTY_LOOKUP: Record<string, { county: string; country: string }> = {
    "BKM": { county: "Buckinghamshire", country: "England" },
    "CRF": { county: "Cardiff", country: "Wales" },
    "DEV": { county: "Devon", country: "England" },
    "ESX": { county: "Essex", country: "England" },
    "GLS": { county: "Gloucestershire", country: "England" },
    "HAM": { county: "Hampshire", country: "England" },
    "KEN": { county: "Kent", country: "England" },
    "LAN": { county: "Lancashire", country: "England" },
    "LEC": { county: "Leicestershire", country: "England" },
    "LIN": { county: "Lincolnshire", country: "England" },
    "LND": { county: "Greater London", country: "England" },
    "MAN": { county: "Greater Manchester", country: "England" },
    "NTT": { county: "Nottinghamshire", country: "England" },
    "RFW": { county: "Renfrewshire", country: "Scotland" },
    "SHR": { county: "Shropshire", country: "England" },
    "SOM": { county: "Somerset", country: "England" },
    "SRY": { county: "Surrey", country: "England" },
    "STS": { county: "Staffordshire", country: "England" },
    "WAR": { county: "Warwickshire", country: "England" },
    "WOR": { county: "Worcestershire", country: "England" },
    "WSX": { county: "West Sussex", country: "England" },
  };

  const parseAcceloAddress = (full: string | null | undefined, city: string | null | undefined) => {
    const empty = { addressLine1: "", addressLine2: "", postcode: "", county: "", country: "" };
    if (!full) return empty;
    const cityStr = (city || "").trim();
    const cityIdx = cityStr ? full.indexOf(cityStr) : -1;
    const beforeCity = cityIdx > 0 ? full.substring(0, cityIdx) : full;
    const afterCity  = cityIdx > 0 ? full.substring(cityIdx + cityStr.length) : "";
    const addrParts = beforeCity.split(",").map(p => p.trim()).filter(Boolean);
    const addressLine1 = addrParts[0] || "";
    const addressLine2 = addrParts.slice(1).join(", ");
    const afterParts = afterCity.split(",").map(p => p.trim()).filter(Boolean);
    const postcode    = afterParts[0] || "";
    // afterParts[1] is a Chapman code only if it's 2–4 uppercase letters (e.g. "GLS").
    // If it's a country name (e.g. "United Kingdom") the lookup returns nothing and
    // we fall back to reading the last segment as the country directly.
    const secondPart  = afterParts[1] || "";
    const isChapman   = /^[A-Z]{2,4}$/.test(secondPart) && secondPart === secondPart.toUpperCase();
    const lookup      = isChapman ? ACCELO_COUNTY_LOOKUP[secondPart] : undefined;
    const rawCountry  = afterParts[afterParts.length - 1] || "";
    return {
      addressLine1,
      addressLine2,
      postcode,
      county:  lookup?.county  || "",
      country: lookup?.country || mapAcceloCountry(rawCountry),
    };
  };

  const resetForm = () => {
    setFormData({
      name: "",
      companyNumber: "",
      internalCompanyNumber: "",
      website: "",
      contactPhone: "",
      industry: "",
      employeeRange: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      county: "",
      postalCode: "",
      country: "",
      sources: [],
    });
    setModuleAccessData({
      healthSafety: false,
      humanResources: false,
      employmentLaw: false,
      training: false,
      toolkit: false,
      support: false,
      reports: false,
    });
    setWebsiteError(null);
    setCompanyNameError(null);
    setAcceloImportContext(null);
  };

  // useEffect: when wizard reaches the contact step with Accelo flow, load contacts inline
  useEffect(() => {
    if (wizardStep === "contact" && wizardIsAcceloFlow && pendingCompanyFull?.acceloContext) {
      const ctx = pendingCompanyFull.acceloContext;
      setAcceloContacts([]);
      setContactRows({});
      setAcceloContactsLoading(true);
      fetch(`/api/integrations/accelo/companies/${ctx.acceloCompanyId}/contacts?source=${encodeURIComponent(ctx.sourceCode)}`, { credentials: "include" })
        .then(r => r.json())
        .then(contacts => {
          const loaded = Array.isArray(contacts) ? contacts : [];
          setAcceloContacts(loaded);
          const initialRows: Record<string, ContactRowState> = {};
          loaded.forEach((c: any) => {
            initialRows[String(c.id)] = { selected: false, primary: false, keyContact: false, addToSite: false };
          });
          setContactRows(initialRows);
        })
        .catch(() => { setAcceloContacts([]); setContactRows({}); })
        .finally(() => setAcceloContactsLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, wizardIsAcceloFlow]);

  const handleConfirmAcceloContacts = () => {
    const selections = acceloContacts
      .filter(c => contactRows[String(c.id)]?.selected && c.email)
      .map(c => {
        const row = contactRows[String(c.id)];
        return {
          acceloId: String(c.id),
          firstname: c.firstname || "",
          lastname: c.lastname || "",
          email: c.email,
          phone: c.phone || "",
          mobile: c.mobile || "",
          setAsPrimary: row.primary,
          setAsKeyContact: row.keyContact,
          addToSite: row.addToSite,
        };
      });
    if (selections.length === 0) {
      toast({ title: "Please select at least one contact", variant: "destructive" }); return;
    }
    const hasPrimary = selections.some(s => s.setAsPrimary);
    if (!hasPrimary) {
      toast({ title: "Please mark one contact as Primary", variant: "destructive" }); return;
    }
    const doSave = () => {
      setPendingContact({
        type: "accelo",
        sourceCode: pendingCompanyFull?.acceloContext?.sourceCode || acceloActiveSource,
        selections,
      });
      setWizardStep("review");
    };
    // Domain check: compare the primary contact's email domain against the company website
    const primarySel = selections.find(s => s.setAsPrimary);
    const companyWebsite = pendingCompanyFull?.companyData.website;
    if (primarySel?.email && companyWebsite) {
      const emailDomain = extractEmailDomain(primarySel.email);
      const websiteDomain = extractWebsiteDomain(companyWebsite);
      if (emailDomain && websiteDomain && emailDomain !== websiteDomain) {
        setWizardDomainMismatch({ emailDomain, websiteDomain });
        setWizardDomainConfirmCallback(() => doSave);
        setWizardShowDomainConfirm(true);
        return;
      }
    }
    setWizardDomainMismatch(null);
    doSave();
  };

  const handleEdit = (company: CompanyWithSiteCount) => {
    captureSnapshot(company);
    // For pro consultants, strip any out-of-scope sources from the form state on open
    // to prevent them silently blocking save due to legacy data.
    const allowedSources = isProConsultant && user?.sources ? user.sources : null;
    const initialSources = allowedSources
      ? (company.sources || []).filter((s) => allowedSources.includes(s))
      : company.sources || [];
    setFormData({
      name: company.name,
      companyNumber: company.companyNumber || "",
      internalCompanyNumber: (company as any).internalCompanyNumber || "",
      website: company.website || "",
      contactPhone: (company as any).contactPhone || "",
      industry: (company as any).industry || "",
      employeeRange: company.employeeRange || "",
      addressLine1: company.addressLine1 || "",
      addressLine2: company.addressLine2 || "",
      city: company.city || "",
      county: company.county || "",
      postalCode: company.postalCode || "",
      country: company.country || "",
      sources: initialSources,
    });
    setEditingCompany(company);
  };

  const handleView = useCallback((companyId: string) => {
    navigate(`/companies/${companyId}`);
  }, [navigate]);

  const validateUKPostcode = (postcode: string): boolean => {
    const regex = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;
    return regex.test(postcode.trim());
  };

  const validateEircode = (postcode: string): boolean => {
    const regex = /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i;
    return regex.test(postcode.trim());
  };

  const validatePostcode = (postcode: string, country: string): boolean => {
    if (["England", "Northern Ireland", "Scotland", "Wales"].includes(country)) return validateUKPostcode(postcode);
    if (country === "Ireland") return validateEircode(postcode);
    return postcode.trim().length > 0;
  };

  const getPostcodeError = (country: string): string => {
    if (["England", "Northern Ireland", "Scotland", "Wales"].includes(country)) return "Please enter a valid UK postcode (e.g., BT1 1AA, SW1A 1AA)";
    if (country === "Ireland") return "Please enter a valid Eircode (e.g., D02 AF30)";
    return "Please enter a valid postal code";
  };

  const COUNTRY_OPTIONS = [
    "England",
    "Ireland",
    "Northern Ireland",
    "Scotland",
    "Wales",
  ];

  const COUNTY_MAP: Record<string, string[]> = {
    "England": [
      "Bedfordshire", "Berkshire", "Bristol", "Buckinghamshire", "Cambridgeshire",
      "Cheshire", "City of London", "Cornwall", "County Durham", "Cumbria",
      "Derbyshire", "Devon", "Dorset", "East Riding of Yorkshire", "East Sussex",
      "Essex", "Gloucestershire", "Greater London", "Greater Manchester",
      "Hampshire", "Herefordshire", "Hertfordshire", "Isle of Wight", "Kent",
      "Lancashire", "Leicestershire", "Lincolnshire", "Merseyside", "Norfolk",
      "North Yorkshire", "Northamptonshire", "Northumberland", "Nottinghamshire",
      "Oxfordshire", "Rutland", "Shropshire", "Somerset", "South Yorkshire",
      "Staffordshire", "Suffolk", "Surrey", "Tyne and Wear", "Warwickshire",
      "West Midlands", "West Sussex", "West Yorkshire", "Wiltshire", "Worcestershire",
    ],
    "Ireland": [
      "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway",
      "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick",
      "Longford", "Louth", "Mayo", "Meath", "Monaghan", "Offaly",
      "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath",
      "Wexford", "Wicklow",
    ],
    "Northern Ireland": [
      "Antrim", "Armagh", "Down", "Fermanagh", "Londonderry", "Tyrone",
    ],
    "Scotland": [
      "Aberdeen City", "Aberdeenshire", "Angus", "Argyll and Bute",
      "Clackmannanshire", "Dumfries and Galloway", "Dundee City",
      "East Ayrshire", "East Dunbartonshire", "East Lothian", "East Renfrewshire",
      "Edinburgh", "Falkirk", "Fife", "Glasgow City", "Highland",
      "Inverclyde", "Midlothian", "Moray", "North Ayrshire",
      "North Lanarkshire", "Orkney Islands", "Perth and Kinross",
      "Renfrewshire", "Scottish Borders", "Shetland Islands",
      "South Ayrshire", "South Lanarkshire", "Stirling",
      "West Dunbartonshire", "West Lothian", "Western Isles",
    ],
    "Wales": [
      "Blaenau Gwent", "Bridgend", "Caerphilly", "Cardiff", "Carmarthenshire",
      "Ceredigion", "Conwy", "Denbighshire", "Flintshire", "Gwynedd",
      "Isle of Anglesey", "Merthyr Tydfil", "Monmouthshire", "Neath Port Talbot",
      "Newport", "Pembrokeshire", "Powys", "Rhondda Cynon Taf", "Swansea",
      "Torfaen", "Vale of Glamorgan", "Wrexham",
    ],
  };

  const handleSubmit = () => {
    setCompanyNameError(null);
    if (!formData.name.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    if (!editingCompany) {
      const duplicate = (data?.companies || []).find(
        (c) => c.name.trim().toLowerCase() === formData.name.trim().toLowerCase()
      );
      if (duplicate) {
        setCompanyNameError("A company with this name already exists");
        return;
      }
    }
    if (!formData.industry) {
      toast({ title: "Industry is required", variant: "destructive" });
      return;
    }
    if (!formData.addressLine1.trim()) {
      toast({ title: "Address Line 1 is required", variant: "destructive" });
      return;
    }
    if (!formData.city.trim()) {
      toast({ title: "City is required", variant: "destructive" });
      return;
    }
    if (!formData.country) {
      toast({ title: "Country is required", variant: "destructive" });
      return;
    }
    if (!formData.county) {
      toast({ title: "County is required", variant: "destructive" });
      return;
    }
    if (!formData.postalCode.trim()) {
      toast({ title: "Postal Code is required", variant: "destructive" });
      return;
    }
    if (!validatePostcode(formData.postalCode, formData.country)) {
      toast({ title: getPostcodeError(formData.country), variant: "destructive" });
      return;
    }
    if (!formData.sources || formData.sources.length === 0) {
      toast({ title: "At least one source is required", variant: "destructive" });
      return;
    }
    const submittedData = { ...formData };
    if (submittedData.website.trim()) {
      let websiteValue = submittedData.website.trim();
      if (!/^https?:\/\//i.test(websiteValue)) {
        websiteValue = "https://" + websiteValue;
      }
      try {
        const url = new URL(websiteValue);
        const hostParts = url.hostname.split(".");
        const tld = hostParts[hostParts.length - 1];
        const validTld = /^[a-zA-Z]{2,6}$/.test(tld);
        if (!validTld && hostParts.length < 3) throw new Error("Invalid hostname");
        submittedData.website = websiteValue;
        setFormData(prev => ({ ...prev, website: websiteValue }));
      } catch {
        toast({ title: "Please enter a valid website URL (e.g. https://www.example.com)", variant: "destructive" });
        return;
      }
    }
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data: submittedData });
    } else {
      // Snapshot Accelo context synchronously before dialog close clears it
      const acceloCtx = acceloImportContextRef.current;
      setPendingCompanyFull({
        companyData: { ...submittedData },
        moduleAccess: { ...moduleAccessData },
        acceloContext: acceloCtx
          ? { acceloCompanyId: acceloCtx.acceloCompanyId, acceloStanding: acceloCtx.acceloStanding, acceloType: acceloCtx.acceloType, acceloColor: acceloCtx.acceloColor, sourceCode: acceloActiveSource }
          : null,
      });
      setWizardIsAcceloFlow(!!acceloCtx);
      setIsAddOpen(false);
      setSiteData({ name: "", addressLine1: "", addressLine2: "", city: "", county: "", postalCode: "", country: "" });
      setWizardStep("site");
      setWizardSubsequentSite(false);
      setWizardOpen(true);
    }
  };

  const handleCreateSite = () => {
    if (!siteData.name.trim()) {
      toast({ title: "Site name is required", variant: "destructive" });
      return;
    }
    if (!siteData.addressLine1.trim()) {
      toast({ title: "Address Line 1 is required", variant: "destructive" });
      return;
    }
    if (!siteData.city.trim()) {
      toast({ title: "City is required", variant: "destructive" });
      return;
    }
    if (!siteData.country) {
      toast({ title: "Country is required", variant: "destructive" });
      return;
    }
    if (!siteData.county) {
      toast({ title: "County is required", variant: "destructive" });
      return;
    }
    if (!siteData.postalCode.trim()) {
      toast({ title: "Postal Code is required", variant: "destructive" });
      return;
    }
    if (!validatePostcode(siteData.postalCode, siteData.country)) {
      toast({ title: getPostcodeError(siteData.country), variant: "destructive" });
      return;
    }
    // Collect site locally (no DB write until final confirmation)
    const newSite: PendingSite = { ...siteData, mandatoryTemplateIds: [] };
    setPendingSites(prev => wizardSubsequentSite ? [...prev, newSite] : [newSite]);
    setWizardCurrentSiteName(siteData.name);
    setSiteData({ name: "", addressLine1: "", addressLine2: "", city: "", county: "", postalCode: "", country: "" });
    setSelectedRequiredIds(new Set());
    setReqDocsActiveModule("");
    setWizardStep("site-docs");
  };

  const handleCancelWizard = () => {
    resetWizard();
    setIsAddOpen(true);
  };

  const isDeveloper = user?.role === "developer";
  const isClient = user?.role === "client";
  const canCreateCompany = isDeveloper || isProConsultant;
  const companiesRaw = data?.companies || [];
  const companies = [...companiesRaw].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return dir * a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (sortBy === "city") return dir * (a.city || "").toLowerCase().localeCompare((b.city || "").toLowerCase());
    if (sortBy === "industry") return dir * (a.industry || "").toLowerCase().localeCompare((b.industry || "").toLowerCase());
    if (sortBy === "siteCount") return dir * ((a.siteCount ?? 0) - (b.siteCount ?? 0));
    if (sortBy === "status") return dir * (a.status || "").localeCompare(b.status || "");
    if (sortBy === "compliance") return dir * ((a.complianceSummary?.complianceScore ?? -1) - (b.complianceSummary?.complianceScore ?? -1));
    return 0;
  });
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const [alreadyShown] = useState(() => _companiesShown);
  useEffect(() => {
    if (!isLoading && companies.length > 0) _companiesShown = true;
  }, [isLoading, companies.length]);


  const formatStatusDisplay = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 shrink-0 px-8 py-6 bg-background border-b">
        <div>
          <h1 className="text-3xl font-semibold">Companies</h1>
          <p className="mt-1 text-muted-foreground">
            {total} {total === 1 ? "company" : "companies"}{isProConsultant ? (staffFilter === "my" ? " (my clients)" : staffFilter !== "all" ? ` (${myStaff.find(s => s.id === staffFilter)?.fullName?.split(" ")[0] || "staff"}'s clients)` : "") : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(isDeveloper || isProConsultant) && connectedAcceloIntegrations.map(integration => (
            <Button
              key={integration.sourceCode}
              size="sm"
              variant="outline"
              onClick={() => {
                setAcceloActiveSource(integration.sourceCode);
                setAcceloSearchQuery("");
                setAcceloSearchResults([]);
                setAcceloSearchError(null);
                setIsAcceloSearchOpen(true);
              }}
              data-testid={`button-import-from-accelo-${integration.sourceCode}`}
            >
              <Download className="mr-2 h-4 w-4" />
              Import from Accelo
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4">
                {integration.sourceLabel && integration.sourceLabel !== integration.sourceCode ? integration.sourceLabel : integration.sourceCode}
              </Badge>
            </Button>
          ))}
          {isDeveloper && selectedCompanyIds.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { setIsBulkDeleteOpen(true); setBulkDeleteConfirmText(""); }}
              data-testid="button-bulk-delete-companies"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete {selectedCompanyIds.size} {selectedCompanyIds.size === 1 ? "Company" : "Companies"}
            </Button>
          )}
          {isDeveloper && (
            <Button
              size="sm"
              variant={isAdminMode ? "default" : "outline"}
              onClick={() => {
                setIsAdminMode((prev) => !prev);
                setSelectedCompanyIds(new Set());
              }}
              data-testid="button-toggle-admin-mode"
            >
              <ShieldAlert className="mr-2 h-4 w-4" />
              {isAdminMode ? "Exit Admin Mode" : "Admin Mode"}
            </Button>
          )}
          {canCreateCompany && (
            <Button size="sm" className="w-36" onClick={() => setIsAddOpen(true)} data-testid="button-add-company">
              <Plus className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          )}
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pt-6 space-y-6 dash-animate">

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-companies"
          />
        </div>
        {isProConsultant && (
          <Select value={staffFilter} onValueChange={(v) => { setStaffFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]" data-testid="select-staff-filter-companies">
              <SelectValue placeholder={
                staffFilter === "my" ? "My clients"
                : staffFilter === "all" ? "All clients"
                : (myStaff.find(s => s.id === staffFilter)?.fullName
                    ?? coveringFor.find(c => c.absentConsultantId === staffFilter)?.absentConsultantName
                    ?? "") + "'s clients"
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">My clients</SelectItem>
              {myStaff.map(s => (
                <SelectItem key={s.id} value={s.id} data-testid={`staff-filter-${s.id}`}>{s.fullName}'s clients</SelectItem>
              ))}
              {coveringFor
                .filter(c => !myStaff.some(s => s.id === c.absentConsultantId))
                .map(c => (
                  <SelectItem key={c.absentConsultantId} value={c.absentConsultantId} data-testid={`staff-filter-coverage-${c.absentConsultantId}`}>
                    {c.absentConsultantName}'s clients
                  </SelectItem>
                ))}
              <SelectItem value="all">All clients</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {groupOwners.length > 0 && (
          <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]" data-testid="select-group-filter">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groupOwners.sort((a, b) => a.name.localeCompare(b.name)).map(go => (
                <SelectItem key={go.id} value={go.id} data-testid={`group-filter-option-${go.id}`}>
                  {go.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { setSearchQuery(""); setStatusFilter("all"); setGroupFilter("all"); setStaffFilter("my"); setPage(1); }}
          disabled={!(!!searchQuery || statusFilter !== "all" || groupFilter !== "all" || (isProConsultant && staffFilter !== "my"))}
          title="Clear filters"
          data-testid="button-clear-filters-companies"
          className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <Table wrapperClassName="overflow-visible" className="sticky-table-header table-fixed">
          <TableHeader>
            <TableRow>
              {isAdminMode && (
                <TableHead className="w-[3%]">
                  <Checkbox
                    checked={companies.length > 0 && companies.every((c) => selectedCompanyIds.has(c.id))}
                    onCheckedChange={(checked) => {
                      setSelectedCompanyIds((prev) => {
                        const next = new Set(prev);
                        if (checked) {
                          companies.forEach((c) => next.add(c.id));
                        } else {
                          companies.forEach((c) => next.delete(c.id));
                        }
                        return next;
                      });
                    }}
                    data-testid="checkbox-select-all-companies"
                  />
                </TableHead>
              )}
              <TableHead onClick={() => handleSortCompanies("name")} className="cursor-pointer select-none whitespace-nowrap w-[26%]">
                <div className="flex items-center gap-1">Company {sortBy === "name" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead onClick={() => handleSortCompanies("status")} className="w-[10%] cursor-pointer select-none whitespace-nowrap">
                <div className="flex items-center gap-1">Status {sortBy === "status" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead onClick={() => handleSortCompanies("city")} className="cursor-pointer select-none whitespace-nowrap w-[22%]">
                <div className="flex items-center gap-1">Address {sortBy === "city" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead onClick={() => handleSortCompanies("industry")} className="cursor-pointer select-none whitespace-nowrap w-[13%]">
                <div className="flex items-center gap-1">Industry {sortBy === "industry" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead className="hidden lg:table-cell w-[9%]">Sources</TableHead>
              <TableHead onClick={() => handleSortCompanies("siteCount")} className="w-[8%] cursor-pointer select-none whitespace-nowrap">
                <div className="flex items-center gap-1">Sites {sortBy === "siteCount" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead onClick={() => handleSortCompanies("compliance")} className="cursor-pointer select-none whitespace-nowrap w-[12%]">
                <div className="flex items-center gap-1">Compliance {sortBy === "compliance" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody key={isLoading ? "loading" : "loaded"} className={!alreadyShown && !isLoading && companies.length > 0 ? "table-rows-animate" : ""}>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdminMode ? 9 : 8}>
                  <FetchingOverlay />
                </TableCell>
              </TableRow>
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdminMode ? 9 : 8} className="h-24 text-center text-muted-foreground">
                  {debouncedSearch || statusFilter !== "all"
                    ? "No companies match your filters."
                    : "No companies found. Add your first company to get started."}
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow
                  key={company.id}
                  className="cursor-pointer"
                  onClick={() => handleView(company.id)}
                  data-testid={`row-company-${company.id}`}
                >
                  {isAdminMode && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedCompanyIds.has(company.id)}
                        onCheckedChange={(checked) => {
                          setSelectedCompanyIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(company.id);
                            else next.delete(company.id);
                            return next;
                          });
                        }}
                        data-testid={`checkbox-select-company-${company.id}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{company.name}</span>
                          {company.internalCompanyNumber && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0 text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0" data-testid={`text-internal-no-table-${company.id}`}>
                              <Hash className="h-2.5 w-2.5" />{company.internalCompanyNumber}
                            </span>
                          )}
                        </div>
                        {(company.isGroupOwner || company.groupOwnerName) && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {company.isGroupOwner && (
                              <Badge variant="outline" className="text-xs py-0 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700" data-testid={`badge-go-table-${company.id}`}>
                                Group Owner
                              </Badge>
                            )}
                            {company.groupOwnerName && (
                              <Badge variant="outline" className="text-xs py-0 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700" data-testid={`badge-member-table-${company.id}`}>
                                Member of {company.groupOwnerName}
                              </Badge>
                            )}
                          </div>
                        )}
                        {company.acceloLinks && company.acceloLinks.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {company.acceloLinks.map((link) => {
                              const typeLabel = link.acceloType
                                ? link.acceloType.charAt(0).toUpperCase() + link.acceloType.slice(1).toLowerCase()
                                : null;
                              const acceloColorTable = (link as any).acceloColor;
                              const badgeStyle = acceloBadgeStyle(acceloColorTable);
                              return (
                                <Badge
                                  key={link.sourceCode}
                                  variant="outline"
                                  className="text-xs py-0"
                                  style={badgeStyle}
                                  data-testid={`badge-accelo-table-${company.id}-${link.sourceCode}`}
                                >
                                  Accelo{typeLabel ? `: ${typeLabel}` : ""}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={company.status === "on_hold" ? "secondary" : (company.status === "active" ? "default" : "secondary")}
                      className={company.status === "on_hold" ? "bg-yellow-100 hover:bg-yellow-100 text-yellow-900" : ""}
                      data-testid={`badge-status-${company.id}`}
                    >
                      {formatStatusDisplay(company.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(company.addressLine1 || company.city) ? (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {[company.addressLine1, company.city, company.postalCode].filter(Boolean).join(", ")}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {(company as any).industry || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {company.sources && company.sources.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {company.sources.map((code) => (
                          <Badge key={code} variant="outline" className="text-xs px-1.5 py-0 font-mono" data-testid={`badge-table-source-${company.id}-${code}`}>
                            {code}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" data-testid={`badge-table-no-source-${company.id}`}>
                        None
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" data-testid={`badge-site-count-${company.id}`}>
                      {company.siteCount} {company.siteCount === 1 ? "site" : "sites"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {complianceLoading ? (
                      <img src={logoIcon} alt="Loading compliance" className="h-5 w-5 rounded-full object-cover shadow animate-spin" style={{ animationDuration: "1.5s" }} />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <ComplianceModulePicker company={company} />
                        <CompanyDocumentsModulePicker company={company} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-company-menu-${company.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleView(company.id); }}
                          data-testid={`button-view-company-${company.id}`}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Sites
                        </DropdownMenuItem>
                        {!isClient && (
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleEdit(company); }}
                            data-testid={`button-edit-company-${company.id}`}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {isDeveloper && (
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(company); setDeleteConfirmText(""); }}
                            className="text-destructive"
                            data-testid={`button-delete-company-${company.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Company
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {!isLoading && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
          itemLabel="companies"
        />
      )}

      <Dialog open={isAddOpen || !!editingCompany} onOpenChange={(open) => {
        if (!open) {
          setIsAddOpen(false);
          setEditingCompany(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Edit Company" : "Add New Company"}</DialogTitle>
            <DialogDescription>
              {editingCompany ? "Update company details" : "Create a new client company"}
            </DialogDescription>
            {!editingCompany && acceloImportContext && (
              <div className="mt-1 flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs gap-1 border-primary/40 text-primary bg-primary/5 py-0.5">
                  <ExternalLink className="h-3 w-3" />
                  Pre-filled from Accelo
                </Badge>
              </div>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="company-name">Company Name <span className="text-destructive">*</span></Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="company-name"
                  placeholder="e.g., Acme Manufacturing Ltd"
                  value={formData.name}
                  readOnly={!!(acceloImportContext && !editingCompany)}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (companyNameError) setCompanyNameError(null);
                  }}
                  onBlur={(e) => {
                    if (acceloImportContext && !editingCompany) return;
                    const value = e.target.value.trim();
                    if (value && value !== originalCompanyName) {
                      setOriginalCompanyName(value);
                      const titleCased = toTitleCase(value);
                      if (titleCased !== value) {
                        setFormData({ ...formData, name: titleCased });
                      }
                    }
                    if (!editingCompany && value) {
                      const duplicate = (data?.companies || []).find(
                        (c) => c.name.trim().toLowerCase() === value.toLowerCase()
                      );
                      setCompanyNameError(duplicate ? "A company with this name already exists" : null);
                    }
                  }}
                  data-testid="input-company-name"
                  className={`flex-1 ${companyNameError ? "border-destructive focus-visible:ring-destructive" : ""} ${acceloImportContext && !editingCompany ? "bg-muted cursor-default" : ""}`}
                />
                {acceloImportContext && !editingCompany ? (
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  formData.name && originalCompanyName && toTitleCase(originalCompanyName) !== originalCompanyName && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormData({ ...formData, name: originalCompanyName });
                        setOriginalCompanyName("");
                      }}
                      className="h-9 w-9 p-0"
                      title="Undo capitalization"
                      data-testid="button-undo-company-name"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )
                )}
              </div>
              {companyNameError && (
                <p className="text-sm text-destructive">{companyNameError}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-number">Registered Company Number</Label>
              <Input
                id="company-number"
                placeholder="e.g., 12345678"
                value={formData.companyNumber}
                onChange={(e) => setFormData({ ...formData, companyNumber: e.target.value })}
                data-testid="input-company-number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="internal-company-number">Internal Company Number</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="internal-company-number"
                  placeholder="e.g., INT-001"
                  value={formData.internalCompanyNumber}
                  readOnly={!!(acceloImportContext && !editingCompany && formData.internalCompanyNumber)}
                  onChange={(e) => setFormData({ ...formData, internalCompanyNumber: e.target.value })}
                  data-testid="input-internal-company-number"
                  className={`flex-1 ${acceloImportContext && !editingCompany && formData.internalCompanyNumber ? "bg-muted cursor-default" : ""}`}
                />
                {acceloImportContext && !editingCompany && formData.internalCompanyNumber && (
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-website">Website</Label>
              <Input
                id="company-website"
                placeholder="e.g., www.example.com"
                value={formData.website}
                onChange={(e) => {
                  setFormData({ ...formData, website: e.target.value });
                  if (websiteError) setWebsiteError(null);
                }}
                onBlur={() => {
                  const value = formData.website.trim();
                  if (!value) { setWebsiteError(null); return; }
                  let normalised = value;
                  if (!/^https?:\/\//i.test(normalised)) normalised = "https://" + normalised;
                  try {
                    const url = new URL(normalised);
                    const hostParts = url.hostname.split(".");
                    const tld = hostParts[hostParts.length - 1];
                    const validTld = /^[a-zA-Z]{2,6}$/.test(tld);
                    if (!validTld && hostParts.length < 3) throw new Error();
                    setWebsiteError(null);
                  } catch {
                    setWebsiteError("Please enter a valid website URL (e.g. www.example.com)");
                  }
                }}
                className={websiteError ? "border-destructive focus-visible:ring-destructive" : ""}
                data-testid="input-company-website"
              />
              {websiteError && (
                <p className="text-sm text-destructive">{websiteError}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-contact-phone">Main Phone Number</Label>
              <Input
                id="company-contact-phone"
                placeholder="e.g., 028 9012 3456"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                data-testid="input-company-contact-phone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-industry">Industry <span className="text-destructive">*</span></Label>
              <IndustrySelect
                id="company-industry"
                testId="select-company-industry"
                value={formData.industry || undefined}
                onChange={(v) => setFormData(prev => ({ ...prev, industry: v }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-employee-range">Number of Employees</Label>
              <Select
                value={formData.employeeRange || undefined}
                onValueChange={(v) => setFormData(prev => ({ ...prev, employeeRange: v }))}
              >
                <SelectTrigger id="company-employee-range" data-testid="select-company-employee-range">
                  <SelectValue placeholder="Select a range" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_RANGES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-1">Company Address</h4>
              <p className="text-xs text-muted-foreground mb-3">The registered or head office address for this company.</p>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="address-line1">Address Line 1 <span className="text-destructive">*</span></Label>
                  <Input
                    id="address-line1"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value) {
                        setFormData({ ...formData, addressLine1: toTitleCase(value) });
                      }
                    }}
                    placeholder="Street address"
                    data-testid="input-company-address-line1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address-line2">Address Line 2</Label>
                  <Input
                    id="address-line2"
                    value={formData.addressLine2}
                    onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value) {
                        setFormData({ ...formData, addressLine2: toTitleCase(value) });
                      }
                    }}
                    placeholder="Suite, floor, building (optional)"
                    data-testid="input-company-address-line2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value) {
                          setFormData({ ...formData, city: toTitleCase(value) });
                        }
                      }}
                      placeholder="City"
                      data-testid="input-company-city"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.country || ""}
                      onValueChange={(value) => setFormData({ ...formData, country: value, county: "" })}
                    >
                      <SelectTrigger id="country" data-testid="select-company-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="county">County <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.county || ""}
                      onValueChange={(value) => setFormData({ ...formData, county: value })}
                      disabled={!formData.country}
                    >
                      <SelectTrigger id="county" data-testid="select-company-county">
                        <SelectValue placeholder={formData.country ? "Select county" : "Select country first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(COUNTY_MAP[formData.country] || []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="postal-code">Post Code <span className="text-destructive">*</span></Label>
                    <Input
                      id="postal-code"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value.toUpperCase() })}
                      onBlur={(e) => {
                        const value = e.target.value.trim().toUpperCase();
                        if (value) {
                          setFormData({ ...formData, postalCode: value });
                        }
                      }}
                      placeholder={formData.country === "Ireland" ? "e.g., D02 AF30" : "e.g., BT1 1AA"}
                      data-testid="input-company-postal-code"
                    />
                  </div>
                </div>
              </div>
            </div>

            {availableSources.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-1">Sources <span className="text-destructive">*</span></h4>
                <p className="text-xs text-muted-foreground mb-3">Select which brand sources are associated with this company. At least one source is required.</p>
                <div className="flex flex-wrap gap-2">
                  {availableSources.filter(s => s.isActive && (!isProConsultant || user?.sources?.includes(s.code))).map((source) => {
                    const selected = formData.sources.includes(source.code);
                    return (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => {
                          const updated = selected
                            ? formData.sources.filter((c) => c !== source.code)
                            : [...formData.sources, source.code];
                          setFormData({ ...formData, sources: updated });
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-input hover:bg-muted"
                        }`}
                        data-testid={`button-source-${source.code}`}
                      >
                        {source.code}
                        <span className="text-[10px] opacity-70">{source.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!editingCompany && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium">Module Access</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => {
                      const allEnabled = Object.values(moduleAccessData).every(Boolean);
                      const newValue = !allEnabled;
                      setModuleAccessData({
                        healthSafety: newValue,
                        humanResources: newValue,
                        employmentLaw: newValue,
                        training: newValue,
                        toolkit: newValue,
                        support: newValue,
                        reports: newValue,
                      });
                    }}
                    data-testid="button-toggle-all-modules"
                  >
                    {Object.values(moduleAccessData).every(Boolean) ? "Disable All" : "Enable All"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Select which modules this company can access.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "healthSafety", label: "Health & Safety", icon: HardHat, iconClass: "text-emerald-700 dark:text-emerald-400", bgClass: "bg-emerald-50 dark:bg-emerald-950/30" },
                    { key: "humanResources", label: "Human Resources", icon: Users, iconClass: "text-blue-700 dark:text-blue-400", bgClass: "bg-blue-50 dark:bg-blue-950/30" },
                    { key: "employmentLaw", label: "Employment Law", icon: Scale, iconClass: "text-pink-700 dark:text-pink-400", bgClass: "bg-pink-50 dark:bg-pink-950/30" },
                    { key: "training", label: "Training", icon: GraduationCap, iconClass: "text-purple-700 dark:text-purple-400", bgClass: "bg-purple-50 dark:bg-purple-950/30" },
                    { key: "toolkit", label: "Toolkit", icon: BookOpen, iconClass: "text-amber-700 dark:text-amber-400", bgClass: "bg-amber-50 dark:bg-amber-950/30" },
                    { key: "support", label: "Support", icon: HelpCircle, iconClass: "text-cyan-700 dark:text-cyan-400", bgClass: "bg-cyan-50 dark:bg-cyan-950/30" },
                    { key: "reports", label: "Reports", icon: BarChart2, iconClass: "text-indigo-700 dark:text-indigo-400", bgClass: "bg-indigo-50 dark:bg-indigo-950/30" },
                  ].map(({ key, label, icon: Icon, iconClass, bgClass }) => {
                    const enabled = moduleAccessData[key as keyof typeof moduleAccessData];
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-2 transition-opacity ${enabled ? "" : "opacity-60"}`}
                      >
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${bgClass}`}>
                          <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
                        </div>
                        <Label htmlFor={`new-module-${key}`} className="text-xs font-medium flex-1 cursor-pointer truncate">{label}</Label>
                        <Switch
                          id={`new-module-${key}`}
                          checked={enabled}
                          onCheckedChange={(checked) => setModuleAccessData(prev => ({ ...prev, [key]: checked }))}
                          data-testid={`switch-new-module-${key}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAddOpen(false);
                setEditingCompany(null);
                resetForm();
              }}
              data-testid="button-cancel-company"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              data-testid="button-submit-company"
            >
              {updateMutation.isPending 
                ? "Saving..." 
                : editingCompany ? "Update Company" : "Next: Add Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Company Creation Wizard (single persistent dialog — no step flicker) ── */}
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) resetWizard(); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>

          {/* ── Step: Site ── */}
          {wizardStep === "site" && (<>
            <div className="px-6 pt-6 pb-4 shrink-0">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPinned className="h-5 w-5" />
                  {wizardSubsequentSite ? "Add Another Site" : "Add First Site"}
                </DialogTitle>
                <DialogDescription>
                  {wizardSubsequentSite
                    ? "Fill in the details for this additional site."
                    : "Every company needs at least one site. Fill in the details for this company's first site — you can add more sites later."}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-site-name">Site Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="new-site-name"
                    placeholder="e.g., Head Office, Main Factory"
                    value={siteData.name}
                    onChange={(e) => setSiteData({ ...siteData, name: e.target.value })}
                    data-testid="input-new-site-name"
                  />
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium">Site Address</h4>
                    {!wizardSubsequentSite && pendingCompanyFull?.companyData && (pendingCompanyFull.companyData.addressLine1 || pendingCompanyFull.companyData.city) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
                        onClick={() => setSiteData(prev => ({
                          ...prev,
                          addressLine1: pendingCompanyFull.companyData.addressLine1,
                          addressLine2: pendingCompanyFull.companyData.addressLine2,
                          city: pendingCompanyFull.companyData.city,
                          county: pendingCompanyFull.companyData.county,
                          postalCode: pendingCompanyFull.companyData.postalCode,
                          country: pendingCompanyFull.companyData.country,
                        }))}
                        data-testid="button-copy-company-address"
                      >
                        <Copy className="h-3 w-3" />
                        Copy company address
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">The physical location of this site.</p>
                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <Label htmlFor="site-address-line1">Address Line 1 <span className="text-destructive">*</span></Label>
                      <Input id="site-address-line1" value={siteData.addressLine1} onChange={(e) => setSiteData({ ...siteData, addressLine1: e.target.value })} placeholder="Street address" data-testid="input-site-address-line1" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="site-address-line2">Address Line 2</Label>
                      <Input id="site-address-line2" value={siteData.addressLine2} onChange={(e) => setSiteData({ ...siteData, addressLine2: e.target.value })} placeholder="Suite, floor, building (optional)" data-testid="input-site-address-line2" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="site-city">City <span className="text-destructive">*</span></Label>
                        <Input id="site-city" value={siteData.city} onChange={(e) => setSiteData({ ...siteData, city: e.target.value })} placeholder="City" data-testid="input-site-city" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="site-country">Country <span className="text-destructive">*</span></Label>
                        <Select value={siteData.country || ""} onValueChange={(value) => setSiteData({ ...siteData, country: value, county: "" })}>
                          <SelectTrigger id="site-country" data-testid="select-site-country"><SelectValue placeholder="Select country" /></SelectTrigger>
                          <SelectContent>{COUNTRY_OPTIONS.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="site-county">County <span className="text-destructive">*</span></Label>
                        <Select value={siteData.county || ""} onValueChange={(value) => setSiteData({ ...siteData, county: value })} disabled={!siteData.country}>
                          <SelectTrigger id="site-county" data-testid="select-site-county"><SelectValue placeholder={siteData.country ? "Select county" : "Select country first"} /></SelectTrigger>
                          <SelectContent>{(COUNTY_MAP[siteData.country] || []).map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="site-postal-code">Postal Code <span className="text-destructive">*</span></Label>
                        <Input id="site-postal-code" value={siteData.postalCode} onChange={(e) => setSiteData({ ...siteData, postalCode: e.target.value })} placeholder={siteData.country === "Ireland" ? "e.g., D02 AF30" : "e.g., BT1 1AA"} data-testid="input-site-postal-code" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 shrink-0 border-t">
              <DialogFooter className="gap-2">
                {wizardSubsequentSite ? (
                  <Button variant="outline" onClick={() => { setSiteData({ name: "", addressLine1: "", addressLine2: "", city: "", county: "", postalCode: "", country: "" }); setWizardSubsequentSite(false); setWizardStep("add-another-site"); }} data-testid="button-cancel-add-site">Cancel</Button>
                ) : (
                  <Button variant="outline" onClick={handleCancelWizard} data-testid="button-back-to-company">Back</Button>
                )}
                <Button onClick={handleCreateSite} data-testid="button-create-first-site">
                  {wizardSubsequentSite ? "Add Site" : "Continue"}
                </Button>
              </DialogFooter>
            </div>
          </>)}

          {/* ── Step: Site Mandatory Docs ── */}
          {wizardStep === "site-docs" && (<>
            <div className="px-6 pt-6 pb-4 shrink-0 border-b">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Assign Mandatory Documents — {wizardCurrentSiteName}
                </DialogTitle>
                <DialogDescription>Select templates to mark as required for this site. These affect the site's compliance score.</DialogDescription>
              </DialogHeader>
              <div className="rounded-md border bg-muted/50 p-3 flex gap-2 mt-4">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">You can adjust required documents per site at any time from the site details page.</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {(() => {
                const privateTemplates = allTemplates.filter(t => t.visibility === "private" && t.isActive);
                const ma = pendingCompanyFull?.moduleAccess;
                const allModulesDisabled = ma && !ma.healthSafety && !ma.humanResources && !ma.employmentLaw;
                const enabledModules = Object.entries(MODULE_MAP).filter(([, { key }]) => !ma || allModulesDisabled || ma[key]);
                if (enabledModules.length === 0) return <p className="text-sm text-muted-foreground py-4">No modules are enabled for this company.</p>;
                const isSingleModule = enabledModules.length === 1;
                const activeModule = isSingleModule ? enabledModules[0][0] : reqDocsActiveModule;
                return (
                  <Tabs value={activeModule} onValueChange={setReqDocsActiveModule}>
                    <TabsList className="mb-4">
                      {enabledModules.map(([mod, { label }]) => (<TabsTrigger key={mod} value={mod} data-testid={`tab-wizard-site-docs-${mod}`}>{label}</TabsTrigger>))}
                    </TabsList>
                    {!isSingleModule && !activeModule && (<p className="text-sm text-muted-foreground py-4 text-center">Select a module above to view its templates.</p>)}
                    {enabledModules.map(([mod, { label }]) => {
                      const moduleTemplates = privateTemplates.filter(t => t.module === mod);
                      return (
                        <TabsContent key={mod} value={mod}>
                          {moduleTemplates.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4">No private templates available for {label}.</p>
                          ) : (
                            <div className="space-y-3">
                              {moduleTemplates.map(template => (
                                <div key={template.id} className="flex items-center gap-3">
                                  <Checkbox
                                    id={`wizard-site-doc-${template.id}`}
                                    checked={selectedRequiredIds.has(template.id)}
                                    onCheckedChange={(checked) => {
                                      const newIds = new Set(selectedRequiredIds);
                                      if (checked) { newIds.add(template.id); } else { newIds.delete(template.id); }
                                      setSelectedRequiredIds(newIds);
                                    }}
                                    data-testid={`checkbox-wizard-site-doc-${template.id}`}
                                  />
                                  <label htmlFor={`wizard-site-doc-${template.id}`} className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
                                    {template.name}
                                    {template.requiresApproval && (<Badge variant="outline" className="text-xs">Approval Required</Badge>)}
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                );
              })()}
            </div>
            <div className="px-6 py-4 shrink-0 border-t">
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleSkipSiteDocs} data-testid="button-skip-site-docs">Skip</Button>
                <Button onClick={handleSaveSiteDocs} data-testid="button-save-site-docs">
                  {selectedRequiredIds.size > 0 ? "Save & Continue" : "Continue"}
                </Button>
              </DialogFooter>
            </div>
          </>)}

          {/* ── Step: Add Another Site? ── */}
          {wizardStep === "add-another-site" && (<>
            <div className="px-6 pt-6 pb-4 shrink-0">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPinned className="h-5 w-5" />
                  Add Another Site?
                </DialogTitle>
                <DialogDescription>
                  {pendingSites.length === 1
                    ? "You've added 1 site so far. Would you like to add another site to this company?"
                    : `You've added ${pendingSites.length} sites so far. Would you like to add another site to this company?`}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 pb-4">
              <div className="rounded-md border bg-muted/50 p-3 flex gap-2">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">You can also add more sites later from the company details page.</p>
              </div>
            </div>
            <div className="px-6 py-4 shrink-0 border-t">
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" onClick={() => setWizardStep("contact")} data-testid="button-no-more-sites">No, continue</Button>
                <Button onClick={() => { setSiteData({ name: "", addressLine1: "", addressLine2: "", city: "", county: "", postalCode: "", country: "" }); setWizardSubsequentSite(true); setWizardStep("site"); }} data-testid="button-yes-add-site">
                  <Plus className="h-4 w-4 mr-1" />
                  Yes, add another site
                </Button>
              </DialogFooter>
            </div>
          </>)}

          {/* ── Step: Contact (Accelo flow — inline contact picker) ── */}
          {wizardStep === "contact" && wizardIsAcceloFlow && (<>
            <div className="px-6 pt-6 pb-4 shrink-0 border-b">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Import Contacts
                </DialogTitle>
                <DialogDescription>
                  Select contacts to import. Mark one as Primary. For each, choose whether to set as key contact or assign to the site.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end mt-3">
                <Button variant="ghost" size="sm" onClick={handleSwitchToManualContact} data-testid="button-switch-manual-contact">
                  Enter contact manually instead
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {acceloContactsLoading && (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground" data-testid="loading-accelo-contacts">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading contacts…</span>
                </div>
              )}
              {!acceloContactsLoading && acceloContacts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground" data-testid="empty-accelo-contacts">
                  <UserPlus className="h-8 w-8" />
                  <p className="text-sm">No contacts found in Accelo for this company.</p>
                  <Button variant="outline" size="sm" onClick={handleSwitchToManualContact} data-testid="button-switch-manual-no-contacts">
                    Enter contact manually
                  </Button>
                </div>
              )}
              {!acceloContactsLoading && acceloContacts.length > 0 && (
                <div className="space-y-3" data-testid="list-accelo-contacts">
                  {acceloContacts.map((contact: any) => {
                    const row = contactRows[String(contact.id)] ?? { selected: false, primary: false, keyContact: false, addToSite: false };
                    return (
                      <div key={contact.id} className={`rounded-md border p-3 transition-colors ${row.selected ? "border-primary/40 bg-primary/5" : ""}`} data-testid={`card-accelo-contact-${contact.id}`}>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`accelo-contact-${contact.id}`}
                            checked={row.selected}
                            onCheckedChange={(checked) => setContactRows(prev => ({ ...prev, [String(contact.id)]: { ...row, selected: !!checked, primary: !!checked ? row.primary : false } }))}
                            data-testid={`checkbox-accelo-contact-${contact.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <label htmlFor={`accelo-contact-${contact.id}`} className="text-sm font-medium cursor-pointer">
                                {[contact.firstname, contact.lastname].filter(Boolean).join(" ") || contact.email}
                              </label>
                              {contact.status?.title && (
                                <Badge
                                  variant="outline"
                                  className="text-xs py-0 shrink-0"
                                  style={acceloBadgeStyle(contact.status?.color)}
                                  data-testid={`badge-accelo-contact-status-${contact.id}`}
                                >
                                  {contact.status.title}
                                </Badge>
                              )}
                            </div>
                            {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                          </div>
                        </div>
                        {row.selected && (
                          <div className="mt-2 ml-7 flex flex-wrap gap-x-4 gap-y-2">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={row.primary}
                                onCheckedChange={(checked) => {
                                  const isPrimary = !!checked;
                                  setContactRows(prev => {
                                    const next = { ...prev };
                                    if (isPrimary) {
                                      Object.keys(next).forEach(k => { next[k] = { ...next[k], primary: false }; });
                                    }
                                    next[String(contact.id)] = { ...next[String(contact.id)], primary: isPrimary };
                                    return next;
                                  });
                                }}
                                data-testid={`checkbox-primary-${contact.id}`}
                              />
                              Primary contact
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={row.keyContact}
                                onCheckedChange={(checked) => setContactRows(prev => ({ ...prev, [String(contact.id)]: { ...prev[String(contact.id)], keyContact: !!checked } }))}
                                data-testid={`checkbox-key-contact-${contact.id}`}
                              />
                              Key contact
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={row.addToSite}
                                onCheckedChange={(checked) => setContactRows(prev => ({ ...prev, [String(contact.id)]: { ...prev[String(contact.id)], addToSite: !!checked } }))}
                                data-testid={`checkbox-add-to-site-${contact.id}`}
                              />
                              Assign to site
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 shrink-0 border-t">
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setWizardStep("add-another-site")} data-testid="button-back-to-sites">Back</Button>
                <Button onClick={handleConfirmAcceloContacts} data-testid="button-confirm-accelo-contacts">
                  Continue
                </Button>
              </DialogFooter>
            </div>
          </>)}

          {/* ── Step: Contact (manual form) ── */}
          {wizardStep === "contact" && !wizardIsAcceloFlow && (<>
            <div className="px-6 pt-6 pb-4 shrink-0 border-b">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Add Primary Contact
                </DialogTitle>
                <DialogDescription>
                  Add a primary contact for this company. They will be created as a client user with access to all sites.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border bg-muted/50 p-3 flex gap-2 mt-4">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  This person will be the primary contact and will have access to all {pendingSites.length} site{pendingSites.length !== 1 ? "s" : ""} created in this wizard.
                </p>
              </div>
            </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            <div className="border-b pb-4">
              <h4 className="text-sm font-medium mb-3">Personal Details</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="pc-title">Title</Label>
                    <div className="relative flex items-center">
                      <Select
                        value={primaryContact.title}
                        onValueChange={(value) => setPrimaryContact(p => ({ ...p, title: value }))}
                      >
                        <SelectTrigger id="pc-title" data-testid="select-pc-title">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mr">Mr</SelectItem>
                          <SelectItem value="Mrs">Mrs</SelectItem>
                          <SelectItem value="Ms">Ms</SelectItem>
                          <SelectItem value="Miss">Miss</SelectItem>
                          <SelectItem value="Dr">Dr</SelectItem>
                          <SelectItem value="Prof">Prof</SelectItem>
                        </SelectContent>
                      </Select>
                      {primaryContact.title && (
                        <button
                          type="button"
                          onClick={() => setPrimaryContact(p => ({ ...p, title: "" }))}
                          className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-clear-pc-title"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="pc-firstname">First Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="pc-firstname"
                        value={primaryContact.firstName}
                        onChange={(e) => {
                          const firstName = e.target.value;
                          setPrimaryContact(p => ({ ...p, firstName, username: generateWizardUsername(firstName, p.lastName) }));
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value) {
                            const cap = value.charAt(0).toUpperCase() + value.slice(1);
                            setPrimaryContact(p => ({ ...p, firstName: cap, username: generateWizardUsername(cap, p.lastName) }));
                          }
                        }}
                        placeholder="First name"
                        data-testid="input-pc-firstname"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pc-lastname">Surname <span className="text-destructive">*</span></Label>
                      <Input
                        id="pc-lastname"
                        value={primaryContact.lastName}
                        onChange={(e) => {
                          const lastName = e.target.value;
                          setPrimaryContact(p => ({ ...p, lastName, username: generateWizardUsername(p.firstName, lastName) }));
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value) {
                            const cap = value.charAt(0).toUpperCase() + value.slice(1);
                            setPrimaryContact(p => ({ ...p, lastName: cap, username: generateWizardUsername(p.firstName, cap) }));
                          }
                        }}
                        placeholder="Surname"
                        data-testid="input-pc-lastname"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="pc-username" className="text-muted-foreground">
                      Username <span className="text-xs">(auto-generated)</span>
                    </Label>
                    <Input
                      id="pc-username"
                      value={primaryContact.username}
                      readOnly
                      placeholder="firstname.surname"
                      className="bg-muted"
                      data-testid="input-pc-username"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pc-email">Email <span className="text-destructive">*</span></Label>
                    <Input
                      id="pc-email"
                      type="email"
                      value={primaryContact.email}
                      className={primaryContactEmailError ? "border-destructive focus-visible:ring-destructive" : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPrimaryContact(p => ({ ...p, email: val }));
                        if (primaryContactEmailError) setPrimaryContactEmailError(null);
                        // Domain check against company website
                        const companyWebsite = pendingCompanyFull?.companyData.website;
                        const emailDomain = extractEmailDomain(val.trim());
                        if (companyWebsite && emailDomain.includes(".")) {
                          const websiteDomain = extractWebsiteDomain(companyWebsite);
                          if (websiteDomain && emailDomain !== websiteDomain) {
                            setWizardDomainMismatch({ emailDomain, websiteDomain });
                          } else {
                            setWizardDomainMismatch(null);
                          }
                        } else {
                          setWizardDomainMismatch(null);
                        }
                      }}
                      placeholder="email@company.com"
                      data-testid="input-pc-email"
                    />
                    {primaryContactEmailError && (
                      <p className="text-xs font-medium text-destructive">{primaryContactEmailError}</p>
                    )}
                    {!primaryContactEmailError && wizardDomainMismatch && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400" data-testid="warning-wizard-domain-mismatch">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>The email domain <strong>@{wizardDomainMismatch.emailDomain}</strong> doesn't match the company website domain <strong>{wizardDomainMismatch.websiteDomain}</strong>. You can still continue, but you'll need to confirm.</span>
                      </div>
                    )}
                    {!primaryContactEmailError && !wizardDomainMismatch && !pendingCompanyFull?.companyData.website && (
                      <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground" data-testid="note-wizard-no-website">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>No website on file for this company — email domain check unavailable.</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="pc-jobtitle">Job Title</Label>
                    <Input
                      id="pc-jobtitle"
                      value={primaryContact.jobTitle}
                      onChange={(e) => setPrimaryContact(p => ({ ...p, jobTitle: e.target.value }))}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v) setPrimaryContact(p => ({ ...p, jobTitle: toTitleCase(v) })); }}
                      placeholder="e.g., Safety Manager"
                      data-testid="input-pc-jobtitle"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pc-department">Department</Label>
                    <Input
                      id="pc-department"
                      value={primaryContact.department}
                      onChange={(e) => setPrimaryContact(p => ({ ...p, department: e.target.value }))}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v) setPrimaryContact(p => ({ ...p, department: toTitleCase(v) })); }}
                      placeholder="e.g., Operations"
                      data-testid="input-pc-department"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="border-b pb-4">
              <h4 className="text-sm font-medium mb-3">Contact Details</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="pc-phone">Phone</Label>
                    <Input
                      id="pc-phone"
                      value={primaryContact.phone}
                      onChange={(e) => setPrimaryContact(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+44 123 456 7890"
                      data-testid="input-pc-phone"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pc-mobile">Mobile</Label>
                    <Input
                      id="pc-mobile"
                      value={primaryContact.mobile}
                      onChange={(e) => setPrimaryContact(p => ({ ...p, mobile: e.target.value }))}
                      placeholder="+44 7xx xxx xxxx"
                      data-testid="input-pc-mobile"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pc-preferred-contact">Preferred Contact Method</Label>
                  <Select
                    value={primaryContact.preferredContactMethod}
                    onValueChange={(value: "email" | "phone" | "mobile" | "any") => setPrimaryContact(p => ({ ...p, preferredContactMethod: value }))}
                  >
                    <SelectTrigger id="pc-preferred-contact" data-testid="select-pc-preferred-contact">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-3">Additional Notes</h4>
              <Textarea
                value={primaryContact.notes}
                onChange={(e) => setPrimaryContact(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any additional notes about this contact..."
                className="min-h-[80px]"
                data-testid="textarea-pc-notes"
              />
            </div>
          </div>
            <div className="px-6 py-4 shrink-0 border-t">
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setWizardStep("add-another-site")} data-testid="button-back-to-sites">Back</Button>
                <Button onClick={handlePrimaryContactSubmit} data-testid="button-create-primary-contact">Continue</Button>
              </DialogFooter>
            </div>
          </>)}

          {/* ── Step: Review & Confirm ── */}
          {wizardStep === "review" && (<>
            <div className="px-6 pt-6 pb-4 shrink-0 border-b">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Review & Confirm
                </DialogTitle>
                <DialogDescription>
                  Please review the details below before creating the company.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Company */}
              <div className="rounded-md border p-4 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Company</p>
                <p className="text-sm font-medium">{pendingCompanyFull?.companyData.name}</p>
                <p className="text-xs text-muted-foreground">{[pendingCompanyFull?.companyData.addressLine1, pendingCompanyFull?.companyData.city, pendingCompanyFull?.companyData.postalCode].filter(Boolean).join(", ")}</p>
                {pendingCompanyFull?.companyData.industry && (
                  <p className="text-xs text-muted-foreground">Industry: {pendingCompanyFull.companyData.industry}</p>
                )}
                {(() => {
                  const ma = pendingCompanyFull?.moduleAccess;
                  if (!ma) return null;
                  const enabled = [
                    ma.healthSafety && "Health & Safety",
                    ma.humanResources && "Human Resources",
                    ma.employmentLaw && "Employment Law",
                    ma.training && "Training",
                    ma.toolkit && "Toolkit",
                    ma.support && "Support",
                    ma.reports && "Reports",
                  ].filter(Boolean) as string[];
                  return enabled.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Modules: {enabled.join(", ")}</p>
                  ) : null;
                })()}
                {pendingCompanyFull?.companyData.sources?.length ? (
                  <p className="text-xs text-muted-foreground">Sources: {pendingCompanyFull.companyData.sources.join(", ")}</p>
                ) : null}
                {pendingCompanyFull?.acceloContext && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Linked to Accelo ({pendingCompanyFull.acceloContext.sourceCode})
                  </p>
                )}
              </div>
              {/* Sites */}
              <div className="rounded-md border p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sites ({pendingSites.length})</p>
                {pendingSites.map((site, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{site.name}</p>
                      <p className="text-xs text-muted-foreground">{[site.addressLine1, site.city, site.postalCode].filter(Boolean).join(", ")}</p>
                    </div>
                    {site.mandatoryTemplateIds.length > 0 && (
                      <Badge variant="secondary" className="text-xs shrink-0">{site.mandatoryTemplateIds.length} required doc{site.mandatoryTemplateIds.length !== 1 ? "s" : ""}</Badge>
                    )}
                  </div>
                ))}
              </div>
              {/* Contact */}
              <div className="rounded-md border p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Primary Contact</p>
                {!pendingContact && <p className="text-sm text-muted-foreground italic">No contact — skip</p>}
                {pendingContact?.type === "manual" && (
                  <>
                    <p className="text-sm font-medium">{[pendingContact.data.firstName, pendingContact.data.lastName].filter(Boolean).join(" ")}</p>
                    <p className="text-xs text-muted-foreground">{pendingContact.data.email}</p>
                  </>
                )}
                {pendingContact?.type === "accelo" && (
                  <>
                    <p className="text-sm font-medium">{pendingContact.selections.length} contact{pendingContact.selections.length !== 1 ? "s" : ""} from Accelo</p>
                    {pendingContact.selections.map(s => (
                      <p key={s.acceloId} className="text-xs text-muted-foreground">{[s.firstname, s.lastname].filter(Boolean).join(" ")} — {s.email}{s.setAsPrimary ? " (primary)" : ""}</p>
                    ))}
                  </>
                )}
              </div>
            </div>
            <div className="px-6 py-4 shrink-0 border-t">
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setWizardStep("contact")} disabled={confirmAndCreateMutation.isPending} data-testid="button-back-to-contact">Back</Button>
                <Button onClick={() => confirmAndCreateMutation.mutate()} disabled={confirmAndCreateMutation.isPending} data-testid="button-confirm-create">
                  {confirmAndCreateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Confirm & Create"}
                </Button>
              </DialogFooter>
            </div>
          </>)}

        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Company
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium mb-2">
                  You are about to permanently delete:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Company: <strong>{deleteTarget.name}</strong></li>
                  <li>{deleteTarget.siteCount} {deleteTarget.siteCount === 1 ? "site" : "sites"} and all site data</li>
                  <li>All documents, cases, and document versions</li>
                  <li><strong>All client users belonging to this company will also be permanently deleted</strong></li>
                  <li>All support requests, training bookings, and audit logs</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <strong className="text-destructive">DELETE</strong> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  data-testid="input-delete-confirm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteConfirmText !== "DELETE" || deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkDeleteOpen} onOpenChange={(open) => { if (!open) { setIsBulkDeleteOpen(false); setBulkDeleteConfirmText(""); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete {selectedCompanyIds.size} {selectedCompanyIds.size === 1 ? "Company" : "Companies"}
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium mb-2">
                You are about to permanently delete:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside max-h-32 overflow-y-auto">
                {companies.filter((c) => selectedCompanyIds.has(c.id)).map((c) => (
                  <li key={c.id} data-testid={`text-bulk-delete-target-${c.id}`}>
                    <strong>{c.name}</strong> ({c.siteCount} {c.siteCount === 1 ? "site" : "sites"})
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground mt-3">
                For each company above, this also deletes all sites and site data, documents, cases, document versions,
                <strong> all client users belonging to that company</strong>, support requests, training bookings, and audit logs.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-delete-confirm">
                Type <strong className="text-destructive">DELETE</strong> to confirm
              </Label>
              <Input
                id="bulk-delete-confirm"
                value={bulkDeleteConfirmText}
                onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                data-testid="input-bulk-delete-confirm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setIsBulkDeleteOpen(false); setBulkDeleteConfirmText(""); }}
              data-testid="button-cancel-bulk-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedCompanyIds))}
              disabled={bulkDeleteConfirmText !== "DELETE" || bulkDeleteMutation.isPending || selectedCompanyIds.size === 0}
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedCompanyIds.size} ${selectedCompanyIds.size === 1 ? "Company" : "Companies"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {AddressSyncDialog}

      {/* ── Accelo Search Dialog ──────────────────────────────────────────── */}
      <Dialog open={isAcceloSearchOpen} onOpenChange={(open) => { if (!open) { setIsAcceloSearchOpen(false); setAcceloSearched(false); setAcceloSearchResults([]); setAcceloSearchQuery(""); setAcceloSearchError(null); } }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Import from Accelo
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {(connectedAcceloIntegrations.find(i => i.sourceCode === acceloActiveSource)?.sourceLabel ?? acceloActiveSource)}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Search for a company in Accelo by name. Selecting a match will open the company wizard pre-filled with their details.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Company name…"
                  value={acceloSearchQuery}
                  onChange={(e) => { setAcceloSearchQuery(e.target.value); setAcceloSearched(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && acceloSearchQuery.trim()) {
                      setAcceloSearchError(null);
                      setAcceloSearching(true);
                      setAcceloSearchResults([]);
                      fetch(`/api/integrations/accelo/search?source=${encodeURIComponent(acceloActiveSource)}&q=${encodeURIComponent(acceloSearchQuery.trim())}`, { credentials: "include" })
                        .then(r => r.json())
                        .then(d => {
                          if (Array.isArray(d)) setAcceloSearchResults(d);
                          else setAcceloSearchError(d?.error || "Search failed");
                        })
                        .catch(() => setAcceloSearchError("Search failed"))
                        .finally(() => { setAcceloSearching(false); setAcceloSearched(true); });
                    }
                  }}
                  data-testid="input-accelo-search"
                />
              </div>
              <Button
                onClick={() => {
                  if (!acceloSearchQuery.trim()) return;
                  setAcceloSearchError(null);
                  setAcceloSearching(true);
                  setAcceloSearchResults([]);
                  fetch(`/api/integrations/accelo/search?source=${encodeURIComponent(acceloActiveSource)}&q=${encodeURIComponent(acceloSearchQuery.trim())}`, { credentials: "include" })
                    .then(r => r.json())
                    .then(d => {
                      if (Array.isArray(d)) setAcceloSearchResults(d);
                      else setAcceloSearchError(d?.error || "Search failed");
                    })
                    .catch(() => setAcceloSearchError("Search failed"))
                    .finally(() => { setAcceloSearching(false); setAcceloSearched(true); });
                }}
                disabled={!acceloSearchQuery.trim() || acceloSearching}
                data-testid="button-accelo-search"
              >
                {acceloSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {acceloSearchError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" data-testid="error-accelo-search">
                {acceloSearchError}
              </div>
            )}

            {!acceloSearching && acceloSearched && acceloSearchResults.length === 0 && !acceloSearchError && (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-accelo-no-results">
                No companies found. Try a different name or client number.
              </p>
            )}

            {acceloSearchResults.length > 0 && (
              <div className="space-y-2" data-testid="list-accelo-results">
                {acceloSearchResults.map((result: any) => (
                  <button
                    key={result.id}
                    type="button"
                    className="w-full text-left rounded-md border px-4 py-3 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={acceloSelectingId !== null}
                    onClick={async () => {
                      const rid = String(result.id);
                      setAcceloSelectingId(rid);
                      try {
                        const res = await fetch(`/api/integrations/accelo/companies/${rid}?source=${encodeURIComponent(acceloActiveSource)}`, { credentials: "include" });
                        const detail = res.ok ? await res.json() : null;
                        const full = detail?.postal_address?.full ?? result.postal_address?.full;
                        const city = detail?.postal_address?.city ?? result.postal_address?.city;
                        const addr = parseAcceloAddress(full, city);
                        // Backend resolves numeric state IDs → county name in postal_address.county.
                        // For text state values (Chapman code or written name) fall back to
                        // postal_address.state and run it through the Chapman lookup first.
                        // Some Accelo state titles come back in inverted form (e.g. "London, City of")
                        // — normalise those to their preferred names.
                        const ACCELO_COUNTY_NAME_MAP: Record<string, string> = {
                          "london, city of": "City of London",
                        };
                        const rawCounty = detail?.postal_address?.county ?? detail?.postal_address?.state ?? null;
                        const resolvedCounty = rawCounty
                          ? (ACCELO_COUNTY_LOOKUP[String(rawCounty).toUpperCase().trim()]?.county
                              ?? ACCELO_COUNTY_NAME_MAP[String(rawCounty).toLowerCase().trim()]
                              ?? String(rawCounty).trim())
                          : null;
                        setFormData({
                          name: result.name || "",
                          companyNumber: "",
                          internalCompanyNumber: result.custom_id || "",
                          website: result.website || "",
                          contactPhone: result.phone || "",
                          industry: "",
                          employeeRange: "",
                          addressLine1: addr.addressLine1,
                          addressLine2: addr.addressLine2,
                          city: city || "",
                          county: resolvedCounty || addr.county,
                          postalCode: addr.postcode,
                          country: addr.country,
                          sources: availableSources.find(s => s.isActive && s.code === acceloActiveSource)
                            ? [acceloActiveSource]
                            : [],
                        });
                        const rawStatus = detail?.company_status;
                        const acceloType = rawStatus
                          ? (typeof rawStatus === "string" ? rawStatus : (rawStatus?.title ?? null))
                          : null;
                        const acceloColor = rawStatus && typeof rawStatus === "object" ? (rawStatus?.color ?? null) : null;
                        setAcceloImportContext({ acceloCompanyId: rid, acceloStanding: detail?.standing ?? null, acceloType, acceloColor });
                        setIsAcceloSearchOpen(false);
                        setIsAddOpen(true);
                      } finally {
                        setAcceloSelectingId(null);
                      }
                    }}
                    data-testid={`button-accelo-result-${result.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        {acceloSelectingId === String(result.id)
                          ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          : <Building2 className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{result.name}</p>
                          {result.company_status?.title && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 shrink-0"
                              style={acceloBadgeStyle(result.company_status?.color)}
                              data-testid={`badge-accelo-result-status-${result.id}`}
                            >
                              {result.company_status.title}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {result.custom_id ? `#${result.custom_id}` : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="px-6 py-4 shrink-0 border-t">
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAcceloSearchOpen(false)} data-testid="button-accelo-search-cancel">
                Cancel
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Wizard: email domain mismatch confirmation ── */}
      <AlertDialog open={wizardShowDomainConfirm} onOpenChange={setWizardShowDomainConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Email domain mismatch</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  The email domain <strong className="text-foreground font-mono">@{wizardDomainMismatch?.emailDomain}</strong> doesn't match the company website domain <strong className="text-foreground font-mono">{wizardDomainMismatch?.websiteDomain}</strong>.
                </p>
                <p>Please check this is the correct email address before continuing.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-wizard-domain-mismatch-cancel">Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setWizardShowDomainConfirm(false);
                setWizardDomainMismatch(null);
                wizardDomainConfirmCallback?.();
                setWizardDomainConfirmCallback(null);
              }}
              data-testid="button-wizard-domain-mismatch-confirm"
            >
              Continue anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      </div>
    </div>
  );
}
