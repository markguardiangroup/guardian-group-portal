import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search,
  HardHat, 
  Users, 
  Scale,
  GraduationCap,
  ExternalLink,
  Clock,
  Building2,
  BookOpen,
  AlertCircle,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  List,
  HelpCircle,
  Mail,
  Calendar,
  X,
  CheckCircle,
  CheckCircle2,
  Target,
  Sparkles,
  Award,
  Monitor,
  Users2,
  Filter,
  LayoutGrid,
  Compass,
  RotateCcw,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingFolder, TrainingCourse, TrainingFAQ, PricingTable, ModuleType, Site, Company } from "@shared/schema";

const moduleIcons: Record<string, typeof HardHat> = {
  health_safety: HardHat,
  human_resources: Users,
  employment_law: Scale,
};

const moduleNames: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
};

const moduleColors: Record<string, string> = {
  all: "text-purple-600 dark:text-purple-400",
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
};

const moduleBgColors: Record<string, string> = {
  all: "bg-purple-100 dark:bg-purple-900/30",
  health_safety: "bg-emerald-100 dark:bg-emerald-900/30",
  human_resources: "bg-blue-100 dark:bg-blue-900/30",
  employment_law: "bg-pink-100 dark:bg-pink-900/30",
};

const moduleBorderColors: Record<string, string> = {
  all: "border-purple-200 dark:border-purple-800",
  health_safety: "border-emerald-200 dark:border-emerald-800",
  human_resources: "border-blue-200 dark:border-blue-800",
  employment_law: "border-pink-200 dark:border-pink-800",
};

const moduleThemeClasses: Record<string, string> = {
  all: "",
  health_safety: "theme-hs",
  human_resources: "theme-hr",
  employment_law: "theme-el",
};

const moduleAccentBars: Record<string, string> = {
  all: "bg-purple-600 dark:bg-purple-500",
  health_safety: "bg-emerald-600 dark:bg-emerald-500",
  human_resources: "bg-blue-600 dark:bg-blue-500",
  employment_law: "bg-pink-600 dark:bg-pink-500",
};

const moduleGradients: Record<string, string> = {
  all: "from-purple-500/10 via-purple-500/5 to-transparent dark:from-purple-500/20 dark:via-purple-500/10",
  health_safety: "from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10",
  human_resources: "from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:via-blue-500/10",
  employment_law: "from-pink-500/10 via-pink-500/5 to-transparent dark:from-pink-500/20 dark:via-pink-500/10",
};

const moduleAccentBg: Record<string, string> = {
  all: "bg-purple-600 dark:bg-purple-500",
  health_safety: "bg-emerald-500",
  human_resources: "bg-blue-500",
  employment_law: "bg-pink-500",
};

type ModuleFilter = ModuleType;

// ── Training Pathway Wizard ──────────────────────────────────────────────────

interface TrainingPathwayNode {
  question: string;
  answers: Array<{
    label: string;
    description?: string;
    next?: TrainingPathwayNode | null;
    courseIds?: string[];
  }>;
}

interface TrainingPathway {
  id: string;
  title: string;
  description: string | null;
  module: ModuleType | null;
  tree: TrainingPathwayNode;
  isActive: boolean;
  sortOrder: number;
}

interface TrainingWizardStep {
  node: TrainingPathwayNode;
  selectedAnswerIndex: number | null;
}

function TrainingPathwayWizard({
  pathway,
  allCourses,
  activeTab,
  onClose,
  onEnquire,
}: {
  pathway: TrainingPathway;
  allCourses: TrainingCourse[];
  activeTab: ModuleFilter;
  onClose: () => void;
  onEnquire: (course: TrainingCourse) => void;
}) {
  const [steps, setSteps] = useState<TrainingWizardStep[]>([{ node: pathway.tree, selectedAnswerIndex: null }]);
  const [results, setResults] = useState<string[] | null>(null);
  const [animDir, setAnimDir] = useState<"forward" | "backward">("forward");
  const [animKey, setAnimKey] = useState(0);

  const currentStep = steps[steps.length - 1];
  const color = moduleColors[activeTab];
  const bgColor = moduleBgColors[activeTab];

  const advance = (dir: "forward" | "backward", fn: () => void) => {
    setAnimDir(dir);
    setAnimKey(k => k + 1);
    fn();
  };

  const handleAnswer = (idx: number) => {
    const answer = currentStep.node.answers[idx];
    const newSteps = steps.map((s, i) => i === steps.length - 1 ? { ...s, selectedAnswerIndex: idx } : s);
    if (answer.courseIds !== undefined && !answer.next) {
      advance("forward", () => { setSteps(newSteps); setResults(answer.courseIds ?? []); });
    } else if (answer.next) {
      advance("forward", () => setSteps([...newSteps, { node: answer.next!, selectedAnswerIndex: null }]));
    } else {
      advance("forward", () => { setSteps(newSteps); setResults([]); });
    }
  };

  const handleBack = () => {
    if (results !== null) {
      advance("backward", () => { setResults(null); setSteps(steps.map((s, i) => i === steps.length - 1 ? { ...s, selectedAnswerIndex: null } : s)); });
    } else if (steps.length > 1) {
      advance("backward", () => setSteps(steps.slice(0, -1)));
    }
  };

  const handleReset = () => advance("backward", () => { setSteps([{ node: pathway.tree, selectedAnswerIndex: null }]); setResults(null); });

  const recommendedCourses = results !== null ? allCourses.filter(c => results.includes(c.id)) : [];

  const slideClass = animDir === "forward"
    ? "animate-in slide-in-from-right-4 fade-in duration-200"
    : "animate-in slide-in-from-left-4 fade-in duration-200";

  return (
    <div className="flex flex-col h-full">
      {/* Progress breadcrumb */}
      <div className="px-6 pt-4 pb-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs ${steps.length === 1 && results === null ? "font-medium text-foreground" : "text-muted-foreground"}`}>Start</span>
          {steps.slice(1).map((s, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className={`text-xs ${i === steps.length - 2 && results === null ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {steps[i].node.answers[steps[i].selectedAnswerIndex!]?.label}
              </span>
            </span>
          ))}
          {results !== null && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Results
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div key={animKey} className={slideClass}>
          {results !== null ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-base">Recommended Courses</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Based on your answers, here are the most relevant training courses for you.
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 shrink-0 text-xs font-medium px-2 py-1 rounded-full ${bgColor} ${color}`}>
                  {moduleNames[activeTab]}
                </span>
              </div>
              {recommendedCourses.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No specific courses found.</p>
                  <p className="text-xs mt-1">Try browsing courses above, or start over with different answers.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden divide-y">
                  {recommendedCourses.map((course) => (
                    <div key={course.id} className="flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors">
                      <div className={`p-2 rounded-lg ${bgColor} shrink-0`}>
                        <GraduationCap className={`h-4 w-4 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-snug">{course.title}</p>
                        {course.provider && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {course.provider}
                          </p>
                        )}
                        {course.duration && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" /> {course.duration}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => onEnquire(course)}
                        data-testid={`button-wizard-enquire-${course.id}`}
                      >
                        <Mail className="h-3.5 w-3.5 mr-1.5" />
                        Enquire
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <h3 className="font-semibold text-base leading-snug">{currentStep.node.question}</h3>
              <div className="grid gap-2">
                {currentStep.node.answers.map((answer, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    data-testid={`button-training-pathway-answer-${idx}`}
                    className={`group flex items-start gap-3 rounded-lg border p-4 text-left hover:border-primary hover:bg-primary/5 transition-all ${
                      currentStep.selectedAnswerIndex === idx ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 transition-colors ${
                      currentStep.selectedAnswerIndex === idx ? "border-primary bg-primary" : "border-muted-foreground/40 group-hover:border-primary"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-snug">{answer.label}</p>
                      {answer.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{answer.description}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0 bg-background">
        <Button variant="ghost" size="sm" onClick={steps.length > 1 || results !== null ? handleBack : onClose} data-testid="button-training-pathway-back">
          <ChevronLeft className="h-4 w-4 mr-1" />
          {steps.length <= 1 && results === null ? "Close" : "Back"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleReset} data-testid="button-training-pathway-reset">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Start Over
        </Button>
      </div>
    </div>
  );
}

export default function Training() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ModuleFilter>("health_safety");
  const [searchQuery, setSearchQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null);
  const [showEnquiryDialog, setShowEnquiryDialog] = useState(false);
  const [showFinderSheet, setShowFinderSheet] = useState(false);
  const [selectedPathway, setSelectedPathway] = useState<TrainingPathway | null>(null);
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [numberOfAttendees, setNumberOfAttendees] = useState("");
  const [preferredTimeframe, setPreferredTimeframe] = useState("");
  
  const [filterRequired, setFilterRequired] = useState<"all" | "required" | "recommended">("all");
  const [filterMethod, setFilterMethod] = useState<"all" | "online" | "in_person">("all");
  const [filterProvider, setFilterProvider] = useState<string>("all");

  const { data: allFolders, isLoading: foldersLoading } = useQuery<TrainingFolder[]>({
    queryKey: ["/api/training-folders"],
  });

  const { data: allCourses, isLoading: coursesLoading } = useQuery<TrainingCourse[]>({
    queryKey: ["/api/training-courses"],
  });

  const { data: pathways } = useQuery<TrainingPathway[]>({
    queryKey: ["/api/training/pathways", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/training/pathways?module=${activeTab}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch training pathways");
      return res.json();
    },
  });

  const activePathways = (pathways ?? []).filter(p => p.isActive);
  const pathwaysLoaded = pathways !== undefined;

  const openFinder = () => {
    if (activePathways.length === 1) {
      setSelectedPathway(activePathways[0]);
    } else {
      setSelectedPathway(null);
    }
    setShowFinderSheet(true);
  };

  const { data: sites } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: !!user,
  });

  // Fetch user's company for auto-population
  const { data: companyData } = useQuery<Company>({
    queryKey: ["/api/companies", user?.companyId],
    enabled: !!user?.companyId,
  });

  const trainingFolders = useMemo(() => {
    if (!allFolders) return [];
    return allFolders.filter(f => f.module === activeTab);
  }, [allFolders, activeTab]);

  const trainingCourses = useMemo(() => {
    if (!allCourses) return [];
    return allCourses.filter(c => c.module === activeTab);
  }, [allCourses, activeTab]);

  const submitEnquiryMutation = useMutation({
    mutationFn: async (data: { 
      trainingCourseId: string; 
      siteId: string; 
      requestType: "booking"; 
      message?: string;
      numberOfAttendees?: string;
      preferredTimeframe?: string;
    }) => {
      const response = await apiRequest("POST", "/api/training-requests", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Booking Enquiry Submitted",
        description: "We'll review your enquiry and get back to you soon.",
      });
      setShowEnquiryDialog(false);
      setEnquiryMessage("");
      setNumberOfAttendees("");
      setPreferredTimeframe("");
      setSelectedCourse(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit enquiry",
        variant: "destructive",
      });
    },
  });

  const uniqueProviders = useMemo(() => {
    if (!trainingCourses) return [];
    const providers = trainingCourses
      .map((c) => c.provider)
      .filter((p): p is string => !!p && p.trim() !== "");
    return Array.from(new Set(providers)).sort();
  }, [trainingCourses]);

  const filteredCourses = useMemo(() => {
    if (!trainingCourses) return [];
    
    return trainingCourses.filter((c) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          c.title.toLowerCase().includes(query) ||
          c.summary?.toLowerCase().includes(query) ||
          c.provider?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      if (filterRequired === "required" && !c.isRequired) return false;
      if (filterRequired === "recommended" && c.isRequired) return false;
      if (filterMethod !== "all" && c.trainingMethod !== filterMethod) return false;
      if (filterProvider !== "all" && c.provider !== filterProvider) return false;
      
      return true;
    });
  }, [trainingCourses, searchQuery, filterRequired, filterMethod, filterProvider]);

  const groupedByFolder = useMemo(() => {
    const groups: Record<string, TrainingCourse[]> = { unfiled: [] };
    
    (trainingFolders || []).forEach((folder) => {
      groups[folder.id] = [];
    });
    
    filteredCourses.forEach((course) => {
      if (course.trainingFolderId && groups[course.trainingFolderId]) {
        groups[course.trainingFolderId].push(course);
      } else {
        groups.unfiled.push(course);
      }
    });
    
    return groups;
  }, [filteredCourses, trainingFolders]);

  const featuredCourses = useMemo(() => {
    if (!filteredCourses) return [];
    return filteredCourses
      .filter(course => course.isFeatured)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredCourses]);

  const requiredCount = filteredCourses.filter((c) => c.isRequired).length;
  const totalCourses = trainingCourses?.length || 0;
  const totalFolders = trainingFolders?.length || 0;

  // Check if any filters are active
  const hasActiveFilters = searchQuery || filterRequired !== "all" || filterMethod !== "all" || filterProvider !== "all";

  // Auto-expand folders containing matching courses when filters are applied
  useEffect(() => {
    if (hasActiveFilters && trainingFolders) {
      const foldersWithCourses = trainingFolders
        .filter(folder => groupedByFolder[folder.id]?.length > 0)
        .map(folder => folder.id);
      setOpenFolders(foldersWithCourses);
    }
  }, [hasActiveFilters, groupedByFolder, trainingFolders]);

  const handleBookingEnquiry = (course: TrainingCourse) => {
    setSelectedCourse(course);
    setShowEnquiryDialog(true);
  };

  const handleSubmitEnquiry = () => {
    if (!selectedCourse || !selectedSiteId) {
      toast({
        title: "Site Required",
        description: "Please select a site for this training enquiry.",
        variant: "destructive",
      });
      return;
    }
    
    // Combine all form data into the message for backend compatibility
    const fullMessage = [
      numberOfAttendees ? `Number of attendees: ${numberOfAttendees}` : null,
      preferredTimeframe ? `Preferred timeframe: ${preferredTimeframe}` : null,
      enquiryMessage ? `Additional requirements: ${enquiryMessage}` : null,
    ].filter(Boolean).join("\n");
    
    submitEnquiryMutation.mutate({
      trainingCourseId: selectedCourse.id,
      siteId: selectedSiteId,
      requestType: "booking",
      message: fullMessage || undefined,
      numberOfAttendees: numberOfAttendees || undefined,
      preferredTimeframe: preferredTimeframe || undefined,
    });
  };

  useEffect(() => {
    if (sites && sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const isLoading = foldersLoading || coursesLoading;
  const currentColor = activeTab;
  const currentModuleName = moduleNames[activeTab];

  const getCourseModuleColor = (course: TrainingCourse) => {
    return moduleColors[course.module] || moduleColors.all;
  };

  const getCourseModuleBgColor = (course: TrainingCourse) => {
    return moduleBgColors[course.module] || moduleBgColors.all;
  };

  const getCourseAccentBar = (course: TrainingCourse) => {
    return moduleAccentBars[course.module] || moduleAccentBars.all;
  };

  const getCourseThemeClass = (course: TrainingCourse) => {
    return moduleThemeClasses[course.module] || "";
  };

  const getCourseBorderColor = (course: TrainingCourse) => {
    return moduleBorderColors[course.module] || moduleBorderColors.all;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="theme-training dash-header flex-shrink-0 bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-module-accent shrink-0">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">
              Training
              <span className="font-normal text-muted-foreground text-base"> — Browse Courses</span>
            </h1>
            <p className="text-xs text-muted-foreground">Browse and book training courses</p>
          </div>
        </div>
      </div>

      {/* Module tabs + search toolbar */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Module selector pills */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-muted/60 border shrink-0">
            {([
              { value: "health_safety", label: "Health & Safety", Icon: HardHat, color: "text-emerald-700 dark:text-emerald-400", activeStyle: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700" },
              { value: "human_resources", label: "Human Resources", Icon: Users, color: "text-blue-700 dark:text-blue-400", activeStyle: "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700" },
              { value: "employment_law", label: "Employment Law", Icon: Scale, color: "text-pink-700 dark:text-pink-400", activeStyle: "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700" },
            ] as const).map(({ value, label, Icon, color, activeStyle }) => {
              const isActive = activeTab === value;
              return (
                <button
                  key={value}
                  onClick={() => setActiveTab(value as ModuleFilter)}
                  data-testid={`tab-${value.replace("_", "-")}`}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? `${activeStyle} border shadow-sm ${color}`
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-background"
              data-testid="input-search-training"
            />
          </div>

          {/* Filters */}
          <Select value={filterRequired} onValueChange={(v) => setFilterRequired(v as typeof filterRequired)}>
            <SelectTrigger className="w-[120px] h-8 text-sm" data-testid="select-filter-required">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              <SelectItem value="required">Required</SelectItem>
              <SelectItem value="recommended">Recommended</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterMethod} onValueChange={(v) => setFilterMethod(v as typeof filterMethod)}>
            <SelectTrigger className="w-[110px] h-8 text-sm" data-testid="select-filter-method">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Method</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="in_person">In Person</SelectItem>
            </SelectContent>
          </Select>

          {uniqueProviders.length > 0 && (
            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger className="w-[130px] h-8 text-sm" data-testid="select-filter-provider">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Provider</SelectItem>
                {uniqueProviders.map((provider) => (
                  <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(searchQuery || filterRequired !== "all" || filterMethod !== "all" || filterProvider !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                setSearchQuery("");
                setFilterRequired("all");
                setFilterMethod("all");
                setFilterProvider("all");
              }}
              data-testid="button-clear-filters"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}

        </div>
      </div>

      {/* Training Finder — full-width prominent strip */}
      <div className="flex-shrink-0 border-b">
        <button
          onClick={openFinder}
          data-testid="button-open-training-finder"
          style={
            activeTab === "health_safety"
              ? { background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }
              : activeTab === "human_resources"
              ? { background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }
              : { background: "linear-gradient(135deg, #db2777 0%, #be185d 100%)" }
          }
          className="w-full flex items-center justify-between gap-4 px-6 py-3 text-white hover:opacity-95 transition-opacity group"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors shrink-0">
              <Compass className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70 leading-none mb-0.5">Guided Training Finder</p>
              <p className="text-sm font-semibold leading-tight">Not sure which training you need? Answer a few quick questions and we'll point you to the right course.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 bg-white/20 group-hover:bg-white/30 transition-colors rounded-md px-3 py-1.5 text-sm font-semibold">
            Find a Course
            <ChevronRight className="h-4 w-4" />
          </div>
        </button>
      </div>

      <div id="page-content" className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : filteredCourses.length === 0 && (trainingFolders || []).length === 0 ? (
          <div className="p-6">
            <Card className="p-12 text-center max-w-lg mx-auto">
              <div className={`w-16 h-16 mx-auto mb-6 rounded-full ${moduleBgColors[currentColor]} flex items-center justify-center`}>
                <BookOpen className={`h-8 w-8 ${moduleColors[currentColor]}`} />
              </div>
              <h3 className="text-xl font-semibold mb-2">No training available yet</h3>
              <p className="text-muted-foreground mb-6">
                Training courses will appear here once they're added by your administrator.
              </p>
            </Card>
          </div>
        ) : searchQuery && filteredCourses.length === 0 ? (
          <div className="p-6">
            <Card className="p-8 text-center max-w-lg mx-auto">
              <Search className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No matching courses</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No training courses match "{searchQuery}"
              </p>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            </Card>
          </div>
        ) : (
          <div className="p-6 space-y-8 dash-animate">
            {!searchQuery && featuredCourses.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className={`h-5 w-5 ${moduleColors[currentColor]}`} />
                  <h2 className="text-lg font-semibold">Featured Courses</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {featuredCourses.map((course) => (
                    <FeaturedCourseCard
                      key={course.id}
                      course={course}
                      onViewDetails={() => setSelectedCourse(course)}
                      onBookingEnquiry={() => handleBookingEnquiry(course)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className={`h-5 w-5 ${moduleColors[currentColor]}`} />
                <h2 className="text-lg font-semibold">
                  {searchQuery ? `Search Results (${filteredCourses.length})` : "All Courses"}
                </h2>
              </div>

              <div className="space-y-4">
                {groupedByFolder.unfiled.length > 0 && (
                  <Card className={`overflow-hidden border-2 ${moduleBorderColors[currentColor]}`}>
                    <CardHeader className={`pb-3 bg-gradient-to-r ${moduleGradients[currentColor]}`}>
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${moduleBgColors[currentColor]}`}>
                          <GraduationCap className={`h-4 w-4 ${moduleColors[currentColor]}`} />
                        </div>
                        General Training
                        <Badge variant="secondary" className="ml-auto">{groupedByFolder.unfiled.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 grid gap-3 md:grid-cols-2">
                      {groupedByFolder.unfiled.map((course) => (
                        <TrainingCard 
                          key={course.id} 
                          course={course}
                          onViewDetails={() => setSelectedCourse(course)}
                          onBookingEnquiry={() => handleBookingEnquiry(course)}
                        />
                      ))}
                    </CardContent>
                  </Card>
                )}

                {(trainingFolders || []).length > 0 && (
                  <Accordion
                    type="multiple"
                    value={openFolders}
                    onValueChange={setOpenFolders}
                    className="space-y-3"
                  >
                    {(trainingFolders || []).map((folder) => {
                      const folderCourses = groupedByFolder[folder.id] || [];
                      const folderColor = folder.module ? moduleBorderColors[folder.module] : moduleBorderColors.all;
                      const folderBgColor = folder.module ? moduleBgColors[folder.module] : moduleBgColors.all;
                      const folderTextColor = folder.module ? moduleColors[folder.module] : moduleColors.all;
                      const folderGradient = folder.module ? moduleGradients[folder.module] : moduleGradients.all;
                      
                      return (
                        <AccordionItem 
                          key={folder.id} 
                          value={folder.id}
                          className={`border-2 rounded-xl overflow-hidden ${folderColor} bg-card`}
                          data-testid={`folder-${folder.id}`}
                        >
                          <AccordionTrigger className={`px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors [&[data-state=open]]:bg-gradient-to-r ${openFolders.includes(folder.id) ? folderGradient : ''}`}>
                            <div className="flex items-center gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${folderBgColor}`}>
                                <FolderOpen className={`h-5 w-5 ${folderTextColor}`} />
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{folder.name}</span>
                                </div>
                                {folder.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{folder.description}</p>
                                )}
                              </div>
                              <Badge variant="secondary" className="ml-auto mr-2">
                                {folderCourses.length} {folderCourses.length === 1 ? 'course' : 'courses'}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            {folderCourses.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <div className={`w-12 h-12 mx-auto mb-3 rounded-full ${folderBgColor} flex items-center justify-center`}>
                                  <BookOpen className={`h-6 w-6 ${folderTextColor} opacity-50`} />
                                </div>
                                <p className="text-sm">No courses in this category yet</p>
                              </div>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2 pt-2">
                                {folderCourses.map((course) => (
                                  <TrainingCard 
                                    key={course.id} 
                                    course={course}
                                    onViewDetails={() => setSelectedCourse(course)}
                                    onBookingEnquiry={() => handleBookingEnquiry(course)}
                                  />
                                ))}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      <Dialog open={!!selectedCourse && !showEnquiryDialog} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedCourse && (
            <CourseDetailView
              course={selectedCourse}
              onClose={() => setSelectedCourse(null)}
              onBookingEnquiry={() => handleBookingEnquiry(selectedCourse)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEnquiryDialog} onOpenChange={(open) => {
        setShowEnquiryDialog(open);
        if (!open) setSelectedCourse(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Booking Enquiry</DialogTitle>
            <DialogDescription>
              Submit an enquiry for "{selectedCourse?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Auto-populated Course Details */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Course Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Course:</span>
                  <p className="font-medium" data-testid="text-course-title">{selectedCourse?.title}</p>
                </div>
                {selectedCourse?.productCode && (
                  <div>
                    <span className="text-muted-foreground">Code:</span>
                    <p className="font-medium font-mono" data-testid="text-course-code">{selectedCourse.productCode}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Auto-populated User Details */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium" data-testid="text-user-name">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user?.fullName || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium" data-testid="text-user-email">{user?.email || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telephone:</span>
                  <p className="font-medium" data-testid="text-user-phone">{user?.phone || user?.mobile || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Company:</span>
                  <p className="font-medium" data-testid="text-user-company">{companyData?.name || "-"}</p>
                </div>
              </div>
            </div>

            {/* Site Selection */}
            {sites && sites.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="enquiry-site">Site</Label>
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger data-testid="select-enquiry-site">
                    <SelectValue placeholder="Select a site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {sites && sites.length === 1 && (
              <div className="text-sm text-muted-foreground">
                Enquiry for: <span className="font-medium">{sites[0].name}</span>
              </div>
            )}
            {(!sites || sites.length === 0) && (
              <div className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                No sites available. Please contact your administrator.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="number-of-attendees">Number of Attendees</Label>
              <Input
                id="number-of-attendees"
                type="text"
                value={numberOfAttendees}
                onChange={(e) => setNumberOfAttendees(e.target.value)}
                placeholder="e.g., 5 people, 10-15, entire team"
                data-testid="input-number-attendees"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferred-timeframe">When is the training needed?</Label>
              <Input
                id="preferred-timeframe"
                type="text"
                value={preferredTimeframe}
                onChange={(e) => setPreferredTimeframe(e.target.value)}
                placeholder="e.g., ASAP, within 2 weeks, March 2024"
                data-testid="input-preferred-timeframe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enquiry-message">Specific Requirements (optional)</Label>
              <Textarea
                id="enquiry-message"
                value={enquiryMessage}
                onChange={(e) => setEnquiryMessage(e.target.value)}
                placeholder="Any specific requirements, questions, or additional information..."
                rows={3}
                data-testid="input-enquiry-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEnquiryDialog(false);
              setSelectedCourse(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitEnquiry}
              disabled={submitEnquiryMutation.isPending || !selectedSiteId}
              data-testid="button-submit-enquiry"
            >
              <Mail className="h-4 w-4 mr-2" />
              Submit Enquiry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guided Training Finder Sheet */}
      <Sheet open={showFinderSheet} onOpenChange={(o) => { if (!o) { setShowFinderSheet(false); setSelectedPathway(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col gap-0">
          <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Find a Training Course
            </SheetTitle>
            <SheetDescription>
              Answer a few quick questions and we'll point you to the right course.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {!selectedPathway ? (
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {!pathwaysLoaded ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : activePathways.length === 0 ? (
                  <div className="flex flex-col items-center text-center gap-4 py-10">
                    <div className="p-3 rounded-full bg-muted">
                      <Compass className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                    <div>
                      <p className="font-semibold">No guided pathways available yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        A guided training finder has not been configured for <strong>{moduleNames[activeTab]}</strong> yet.
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      In the meantime, browse courses on this page or contact your administrator for help choosing the right training.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setShowFinderSheet(false)} data-testid="button-training-finder-close-no-pathways">
                      <GraduationCap className="h-4 w-4 mr-2" />
                      Browse Courses Instead
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Choose a topic to get started:</p>
                    {activePathways.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPathway(p)}
                        data-testid={`button-training-pathway-picker-${p.id}`}
                        className="w-full flex items-center gap-3 p-4 rounded-lg border hover:border-primary hover:bg-primary/5 text-left transition-all group"
                      >
                        <Compass className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{p.title}</p>
                          {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <TrainingPathwayWizard
                pathway={selectedPathway}
                allCourses={allCourses ?? []}
                activeTab={activeTab}
                onClose={() => setShowFinderSheet(false)}
                onEnquire={(course) => {
                  setSelectedCourse(course);
                  setShowEnquiryDialog(true);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FeaturedCourseCard({
  course,
  onViewDetails,
  onBookingEnquiry,
}: {
  course: TrainingCourse;
  onViewDetails: () => void;
  onBookingEnquiry: () => void;
}) {
  const accentBar = moduleAccentBars[course.module] || moduleAccentBars.all;
  
  return (
    <Card 
      className="group hover-elevate transition-all cursor-pointer overflow-hidden border-2 hover:border-primary/30 hover:shadow-lg flex flex-col h-full"
      onClick={onViewDetails}
      data-testid={`card-featured-${course.id}`}
    >
      <div className={`h-2 ${accentBar}`} />
      <CardContent className="p-5 flex flex-col flex-1">
        <div className="flex flex-col flex-1 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {moduleNames[course.module]}
                </Badge>
                {course.isRequired && (
                  <Badge className="bg-amber-500 text-white text-xs">
                    <Target className="h-3 w-3 mr-1" />
                    Required
                  </Badge>
                )}
                {course.productCode && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {course.productCode}
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
                {course.title}
              </h3>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
          </div>
          
          {course.summary && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {course.summary}
            </p>
          )}
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {course.provider && (
              <div className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                <span>{course.provider}</span>
              </div>
            )}
            {course.duration && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{course.duration}</span>
              </div>
            )}
          </div>
          
          <div className="flex-1" />
          
          <div className="text-xs text-muted-foreground/60 flex items-center gap-1 pt-1 group-hover:text-primary/60 transition-colors">
            <BookOpen className="h-3 w-3" />
            <span>Click to view full details</span>
          </div>
          
          <div className="flex pt-2 border-t mt-auto" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              className="flex-1"
              onClick={onBookingEnquiry}
              data-testid={`button-featured-enquiry-${course.id}`}
            >
              <Mail className="h-4 w-4 mr-1" />
              Booking Enquiry
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrainingCard({
  course,
  onViewDetails,
  onBookingEnquiry,
}: {
  course: TrainingCourse;
  onViewDetails: () => void;
  onBookingEnquiry: () => void;
}) {
  const moduleColor = moduleColors[course.module] || moduleColors.all;
  const moduleBgColor = moduleBgColors[course.module] || moduleBgColors.all;
  const accentBar = moduleAccentBars[course.module] || moduleAccentBars.all;

  return (
    <Card 
      className="hover-elevate transition-all cursor-pointer group border-2 hover:border-primary/30 hover:shadow-md bg-gradient-to-r from-background to-muted/30"
      onClick={onViewDetails}
      data-testid={`card-training-${course.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-1 self-stretch rounded-full ${accentBar} opacity-60 group-hover:opacity-100 transition-opacity`} />
          
          <div className={`p-2.5 rounded-xl ${moduleBgColor} shrink-0 shadow-sm`}>
            <GraduationCap className={`h-5 w-5 ${moduleColor}`} />
          </div>
          
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-base group-hover:text-primary transition-colors mb-1.5">
                  {course.title}
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {course.isRequired ? (
                    <Badge className="bg-amber-500 text-white text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      Required
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Recommended</Badge>
                  )}
                  {course.productCode && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {course.productCode}
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
            </div>
            
            {course.summary && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {course.summary}
              </p>
            )}
            
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {course.provider && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{course.provider}</span>
                  </div>
                )}
                {course.duration && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{course.duration}</span>
                  </div>
                )}
                {course.trainingMethod && (
                  <Badge variant="outline" className="text-xs">
                    {course.trainingMethod === "online" ? (
                      <><Monitor className="h-3 w-3 mr-1" />Online</>
                    ) : (
                      <><Users2 className="h-3 w-3 mr-1" />In Person</>
                    )}
                  </Badge>
                )}
                <div className="flex items-center gap-1 text-muted-foreground/60 group-hover:text-primary/60 transition-colors">
                  <BookOpen className="h-3 w-3" />
                  <span>Click for details</span>
                </div>
              </div>
              
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onBookingEnquiry}
                  data-testid={`button-booking-enquiry-${course.id}`}
                >
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  Booking Enquiry
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CourseDetailView({
  course,
  onClose,
  onBookingEnquiry,
}: {
  course: TrainingCourse;
  onClose: () => void;
  onBookingEnquiry: () => void;
}) {
  const moduleColor = moduleColors[course.module] || moduleColors.all;
  const moduleBgColor = moduleBgColors[course.module] || moduleBgColors.all;
  const moduleBorderColor = moduleBorderColors[course.module] || moduleBorderColors.all;
  
  const parsedFaqs: TrainingFAQ[] = course.faqs ? JSON.parse(course.faqs) : [];
  let parsedPricingTable: PricingTable | null = null;
  try {
    if (course.pricingTable) {
      const parsed = JSON.parse(course.pricingTable);
      if (parsed && parsed.headingRow && Array.isArray(parsed.dataRows) && parsed.dataRows.length > 0) {
        parsedPricingTable = parsed;
      }
    }
  } catch {
    parsedPricingTable = null;
  }
  const overview = course.courseOverview || [];

  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${moduleBgColor}`}>
            <GraduationCap className={`h-6 w-6 ${moduleColor}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-xs">
                {moduleNames[course.module]}
              </Badge>
              {course.productCode && (
                <Badge variant="outline" className="font-mono text-xs">
                  {course.productCode}
                </Badge>
              )}
              {course.isRequired ? (
                <Badge className="bg-amber-500 text-white">
                  <Target className="h-3 w-3 mr-1" />
                  Required
                  {course.renewalPeriodMonths && (
                    <span className="ml-1 opacity-75">
                      ({course.renewalPeriodMonths}mo renewal)
                    </span>
                  )}
                </Badge>
              ) : (
                <Badge variant="secondary">Recommended</Badge>
              )}
            </div>
            <DialogTitle className="text-xl">{course.title}</DialogTitle>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-6 mt-4">
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {course.provider && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>{course.provider}</span>
            </div>
          )}
          {course.duration && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{course.duration}</span>
            </div>
          )}
          {course.trainingMethod && (
            <Badge variant="outline">
              {course.trainingMethod === "online" ? (
                <><Monitor className="h-3.5 w-3.5 mr-1" />Online</>
              ) : (
                <><Users2 className="h-3.5 w-3.5 mr-1" />In Person</>
              )}
            </Badge>
          )}
        </div>

        {course.summary && (
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm leading-relaxed">{course.summary}</p>
          </div>
        )}

        {overview.length > 0 && (
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <List className={`h-4 w-4 ${moduleColor}`} />
              What You'll Learn
            </h4>
            <ul className="space-y-2">
              {overview.map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <CheckCircle className={`h-4 w-4 mt-0.5 ${moduleColor} shrink-0`} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {parsedPricingTable && parsedPricingTable.dataRows.length > 0 && (
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <Award className={`h-4 w-4 ${moduleColor}`} />
              Pricing
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{parsedPricingTable.headingRow.column1 || "Item"}</TableHead>
                    <TableHead className="font-semibold">{parsedPricingTable.headingRow.column2 || "Price"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedPricingTable.dataRows.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      <TableCell>{row.column1}</TableCell>
                      <TableCell>{row.column2}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {parsedFaqs.length > 0 && (
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <HelpCircle className={`h-4 w-4 ${moduleColor}`} />
              Frequently Asked Questions
            </h4>
            <Accordion type="single" collapsible className="space-y-2">
              {parsedFaqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className={`border rounded-lg px-4 ${moduleBorderColor}`}
                >
                  <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-3">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {course.externalLink && (
          <Button variant="outline" className="w-full" asChild>
            <a href={course.externalLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Course Details
            </a>
          </Button>
        )}

        <div className="flex pt-2 border-t">
          <Button
            className="flex-1"
            onClick={onBookingEnquiry}
            data-testid="button-detail-booking-enquiry"
          >
            <Mail className="h-4 w-4 mr-2" />
            Booking Enquiry
          </Button>
        </div>
      </div>
    </>
  );
}
