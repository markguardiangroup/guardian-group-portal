import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Plus, 
  Search,
  HardHat, 
  Users, 
  Scale,
  Headphones,
  GraduationCap,
  MoreVertical,
  Pencil,
  Trash2,
  Clock,
  AlertCircle,
  FolderOpen,
  BookOpen,
  List,
  HelpCircle,
  ChevronRight,
  Eye,
  ExternalLink,
  Building2,
  DollarSign,
  Monitor,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingFolder, TrainingCourse, ModuleType, TrainingFAQ, PricingTable, PricingTableRow, TrainingMethod } from "@shared/schema";

const moduleIcons: Record<string, typeof HardHat> = {
  health_safety: HardHat,
  human_resources: Users,
  employment_law: Scale,
  support: Headphones,
};

const moduleNames: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  support: "Support",
};

const moduleColors: Record<string, string> = {
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
  support: "text-purple-600 dark:text-purple-400",
};

const moduleBgColors: Record<string, string> = {
  health_safety: "bg-emerald-100 dark:bg-emerald-900/30",
  human_resources: "bg-blue-100 dark:bg-blue-900/30",
  employment_law: "bg-pink-100 dark:bg-pink-900/30",
  support: "bg-purple-100 dark:bg-purple-900/30",
};

const moduleBorderColors: Record<string, string> = {
  health_safety: "border-emerald-200 dark:border-emerald-800",
  human_resources: "border-blue-200 dark:border-blue-800",
  employment_law: "border-pink-200 dark:border-pink-800",
  support: "border-purple-200 dark:border-purple-800",
};

const moduleGradients: Record<string, string> = {
  health_safety: "from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10",
  human_resources: "from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:via-blue-500/10",
  employment_law: "from-pink-500/10 via-pink-500/5 to-transparent dark:from-pink-500/20 dark:via-pink-500/10",
  support: "from-purple-500/10 via-purple-500/5 to-transparent dark:from-purple-500/20 dark:via-purple-500/10",
};

type ViewMode = "folders" | "courses";

export default function TrainingLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeModule, setActiveModule] = useState<ModuleType>("health_safety");
  const [viewMode, setViewMode] = useState<ViewMode>("folders");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Folder dialog state
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TrainingFolder | null>(null);
  const [folderForm, setFolderForm] = useState({
    name: "",
    description: "",
    module: "health_safety" as ModuleType,
  });

  // Course dialog state
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);
  const [viewingCourse, setViewingCourse] = useState<TrainingCourse | null>(null);
  const emptyPricingTable: PricingTable = {
    headingRow: { column1: "", column2: "" },
    dataRows: [
      { column1: "", column2: "" },
      { column1: "", column2: "" },
      { column1: "", column2: "" },
      { column1: "", column2: "" },
      { column1: "", column2: "" },
    ],
  };
  const [courseForm, setCourseForm] = useState({
    title: "",
    summary: "",
    productCode: "",
    module: "health_safety" as ModuleType,
    trainingFolderId: "",
    provider: "",
    trainingMethod: null as TrainingMethod | null,
    externalLink: "",
    duration: "",
    courseOverview: ["", "", "", "", ""],
    faqs: [
      { question: "", answer: "" },
      { question: "", answer: "" },
      { question: "", answer: "" },
      { question: "", answer: "" },
      { question: "", answer: "" },
    ] as TrainingFAQ[],
    pricingTable: emptyPricingTable,
    isRequired: false,
    isFeatured: false,
    renewalPeriodMonths: null as number | null,
  });

  // Fetch training folders
  const { data: trainingFolders, isLoading: foldersLoading } = useQuery<TrainingFolder[]>({
    queryKey: ["/api/training-folders"],
  });

  // Fetch training courses
  const { data: trainingCourses, isLoading: coursesLoading } = useQuery<TrainingCourse[]>({
    queryKey: ["/api/training-courses"],
  });

  // Folder mutations
  const createFolderMutation = useMutation({
    mutationFn: async (data: typeof folderForm) => {
      const response = await apiRequest("POST", "/api/training-folders", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-folders"] });
      setShowFolderDialog(false);
      resetFolderForm();
      toast({ title: "Folder created", description: "The training folder has been created." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create folder", variant: "destructive" });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof folderForm> }) => {
      const response = await apiRequest("PATCH", `/api/training-folders/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-folders"] });
      setEditingFolder(null);
      resetFolderForm();
      toast({ title: "Folder updated", description: "The training folder has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update folder", variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/training-folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-folders"] });
      toast({ title: "Folder deleted", description: "The training folder has been removed." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete folder", variant: "destructive" });
    },
  });

  // Helper to clean pricing table (remove empty rows)
  const cleanPricingTable = (table: PricingTable): PricingTable | undefined => {
    const hasHeading = table.headingRow.column1.trim() || table.headingRow.column2.trim();
    const filledRows = table.dataRows.filter(row => row.column1.trim() || row.column2.trim());
    if (!hasHeading && filledRows.length === 0) return undefined;
    return {
      headingRow: table.headingRow,
      dataRows: filledRows.length > 0 ? filledRows : table.dataRows.slice(0, 1),
    };
  };

  // Course mutations
  const createCourseMutation = useMutation({
    mutationFn: async (data: typeof courseForm) => {
      const cleanedPricingTable = cleanPricingTable(data.pricingTable);
      const cleanedData = {
        ...data,
        trainingFolderId: data.trainingFolderId || undefined,
        productCode: data.productCode || undefined,
        courseOverview: data.courseOverview.filter(item => item.trim()),
        faqs: data.faqs.filter(faq => faq.question.trim() && faq.answer.trim()),
        pricingTable: cleanedPricingTable,
        renewalPeriodMonths: data.renewalPeriodMonths || undefined,
        externalLink: data.externalLink || undefined,
      };
      const response = await apiRequest("POST", "/api/training-courses", cleanedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-courses"] });
      setShowCourseDialog(false);
      resetCourseForm();
      toast({ title: "Course created", description: "The training course has been added to the library." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create course", variant: "destructive" });
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof courseForm> }) => {
      const cleanedPricingTable = data.pricingTable ? cleanPricingTable(data.pricingTable) : null;
      const cleanedData = {
        ...data,
        trainingFolderId: data.trainingFolderId || null,
        productCode: data.productCode || null,
        courseOverview: data.courseOverview?.filter(item => item.trim()),
        faqs: data.faqs?.filter(faq => faq.question.trim() && faq.answer.trim()),
        pricingTable: cleanedPricingTable,
        renewalPeriodMonths: data.renewalPeriodMonths || null,
        externalLink: data.externalLink || null,
      };
      const response = await apiRequest("PATCH", `/api/training-courses/${id}`, cleanedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-courses"] });
      setEditingCourse(null);
      resetCourseForm();
      toast({ title: "Course updated", description: "The training course has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update course", variant: "destructive" });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/training-courses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-courses"] });
      toast({ title: "Course deleted", description: "The training course has been removed." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete course", variant: "destructive" });
    },
  });

  const resetFolderForm = () => {
    setFolderForm({ name: "", description: "", module: activeModule });
  };

  const resetCourseForm = () => {
    setCourseForm({
      title: "",
      summary: "",
      productCode: "",
      module: activeModule,
      trainingFolderId: "",
      provider: "",
      trainingMethod: null,
      externalLink: "",
      duration: "",
      courseOverview: ["", "", "", "", ""],
      faqs: [
        { question: "", answer: "" },
        { question: "", answer: "" },
        { question: "", answer: "" },
        { question: "", answer: "" },
        { question: "", answer: "" },
      ],
      pricingTable: emptyPricingTable,
      isRequired: false,
      isFeatured: false,
      renewalPeriodMonths: null,
    });
  };

  const handleEditFolder = (folder: TrainingFolder) => {
    setEditingFolder(folder);
    setFolderForm({
      name: folder.name,
      description: folder.description || "",
      module: folder.module,
    });
  };

  const handleEditCourse = (course: TrainingCourse) => {
    setEditingCourse(course);
    const parsedFaqs: TrainingFAQ[] = course.faqs ? JSON.parse(course.faqs) : [];
    const paddedFaqs = [...parsedFaqs];
    while (paddedFaqs.length < 5) {
      paddedFaqs.push({ question: "", answer: "" });
    }
    const paddedOverview = [...(course.courseOverview || [])];
    while (paddedOverview.length < 5) {
      paddedOverview.push("");
    }
    let parsedPricingTable: PricingTable;
    try {
      const parsed = course.pricingTable ? JSON.parse(course.pricingTable) : null;
      if (parsed && parsed.headingRow && Array.isArray(parsed.dataRows)) {
        parsedPricingTable = parsed;
      } else {
        parsedPricingTable = emptyPricingTable;
      }
    } catch {
      parsedPricingTable = emptyPricingTable;
    }
    const paddedPricingDataRows = [...(parsedPricingTable.dataRows || [])];
    while (paddedPricingDataRows.length < 5) {
      paddedPricingDataRows.push({ column1: "", column2: "" });
    }
    const headingRow = parsedPricingTable.headingRow || { column1: "", column2: "" };
    setCourseForm({
      title: course.title,
      summary: course.summary || "",
      productCode: course.productCode || "",
      module: course.module,
      trainingFolderId: course.trainingFolderId || "",
      provider: course.provider || "",
      trainingMethod: course.trainingMethod || null,
      externalLink: course.externalLink || "",
      duration: course.duration || "",
      courseOverview: paddedOverview,
      faqs: paddedFaqs,
      pricingTable: {
        headingRow: headingRow,
        dataRows: paddedPricingDataRows,
      },
      isRequired: course.isRequired,
      isFeatured: course.isFeatured,
      renewalPeriodMonths: course.renewalPeriodMonths,
    });
  };

  const handleFolderSubmit = () => {
    if (editingFolder) {
      updateFolderMutation.mutate({ id: editingFolder.id, data: folderForm });
    } else {
      createFolderMutation.mutate(folderForm);
    }
  };

  const handleCourseSubmit = () => {
    if (editingCourse) {
      updateCourseMutation.mutate({ id: editingCourse.id, data: courseForm });
    } else {
      createCourseMutation.mutate(courseForm);
    }
  };

  // Filter data by module and search
  const filteredFolders = useMemo(() => {
    return (trainingFolders || [])
      .filter(f => f.module === activeModule)
      .filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [trainingFolders, activeModule, searchQuery]);

  const filteredCourses = useMemo(() => {
    return (trainingCourses || [])
      .filter(c => c.module === activeModule)
      .filter(c => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [trainingCourses, activeModule, searchQuery]);

  // Get courses by folder for folder view
  const getCoursesByFolder = (folderId: string) => {
    return filteredCourses.filter(c => c.trainingFolderId === folderId);
  };

  const getUnassignedCourses = () => {
    return filteredCourses.filter(c => !c.trainingFolderId);
  };

  const isAdmin = user?.role === "admin";
  const isLoading = foldersLoading || coursesLoading;

  const ModuleIcon = moduleIcons[activeModule] || GraduationCap;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-6 bg-background border-b flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${moduleBgColors[activeModule]}`}>
            <GraduationCap className={`h-6 w-6 ${moduleColors[activeModule]}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Training Library</h1>
            <p className="text-sm text-muted-foreground">
              Manage training folders and courses for all modules
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                resetFolderForm();
                setShowFolderDialog(true);
              }}
              data-testid="button-add-folder"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Add Folder
            </Button>
            <Button
              onClick={() => {
                resetCourseForm();
                setShowCourseDialog(true);
              }}
              data-testid="button-add-course"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Course
            </Button>
          </div>
        )}
      </div>
      <div id="page-content" className="flex-1 overflow-auto px-6 pb-6 pt-6 space-y-6 dash-animate">

      {/* Module Tabs - Enhanced Prominence */}
      <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as ModuleType)}>
        <div className="grid w-full grid-cols-4 gap-2 p-1 rounded-xl bg-muted/50 border">
          {(["health_safety", "human_resources", "employment_law", "support"] as ModuleType[]).map((mod) => {
            const Icon = moduleIcons[mod];
            const isActive = activeModule === mod;
            const activeStyles: Record<string, string> = {
              health_safety: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700",
              human_resources: "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700",
              employment_law: "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700",
              support: "bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700",
            };
            return (
              <button
                key={mod}
                onClick={() => setActiveModule(mod)}
                data-testid={`tab-${mod}`}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-4 px-3 rounded-lg font-medium transition-all ${
                  isActive 
                    ? `${activeStyles[mod]} border shadow-sm ${moduleColors[mod]}` 
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent"
                }`}
              >
                <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${isActive ? "" : ""}`} />
                <span className="text-xs sm:text-sm">{moduleNames[mod]}</span>
              </button>
            );
          })}
        </div>

        {(["health_safety", "human_resources", "employment_law", "support"] as ModuleType[]).map((mod) => (
          <TabsContent key={mod} value={mod} className="mt-6">
            {/* Search and View Toggle */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search folders and courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "folders" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("folders")}
                  data-testid="button-view-folders"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  By Folder
                </Button>
                <Button
                  variant={viewMode === "courses" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("courses")}
                  data-testid="button-view-courses"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  All Courses
                </Button>
              </div>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : viewMode === "folders" ? (
              <FolderView
                folders={filteredFolders}
                courses={filteredCourses}
                getCoursesByFolder={getCoursesByFolder}
                getUnassignedCourses={getUnassignedCourses}
                isAdmin={isAdmin}
                onEditFolder={handleEditFolder}
                onDeleteFolder={(id) => deleteFolderMutation.mutate(id)}
                onViewCourse={setViewingCourse}
                onEditCourse={handleEditCourse}
                onDeleteCourse={(id) => deleteCourseMutation.mutate(id)}
                moduleColors={moduleColors}
                activeModule={activeModule}
              />
            ) : (
              <CourseListView
                courses={filteredCourses}
                folders={filteredFolders}
                isAdmin={isAdmin}
                onViewCourse={setViewingCourse}
                onEditCourse={handleEditCourse}
                onDeleteCourse={(id) => deleteCourseMutation.mutate(id)}
                moduleColors={moduleColors}
                activeModule={activeModule}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Folder Dialog */}
      <Dialog open={showFolderDialog || !!editingFolder} onOpenChange={(open) => {
        if (!open) {
          setShowFolderDialog(false);
          setEditingFolder(null);
          resetFolderForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFolder ? "Edit Folder" : "Create Training Folder"}</DialogTitle>
            <DialogDescription>
              {editingFolder ? "Update the folder details below." : "Add a new folder to organise training courses."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={folderForm.name}
                onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                placeholder="e.g., Fire Safety Training"
                data-testid="input-folder-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-description">Description</Label>
              <Textarea
                id="folder-description"
                value={folderForm.description}
                onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                placeholder="Brief description of this folder..."
                data-testid="input-folder-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-module">Module</Label>
              <Select
                value={folderForm.module}
                onValueChange={(v) => setFolderForm({ ...folderForm, module: v as ModuleType })}
              >
                <SelectTrigger data-testid="select-folder-module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["health_safety", "human_resources", "employment_law", "support"] as ModuleType[]).map((mod) => (
                    <SelectItem key={mod} value={mod}>{moduleNames[mod]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowFolderDialog(false);
              setEditingFolder(null);
              resetFolderForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleFolderSubmit}
              disabled={!folderForm.name.trim() || createFolderMutation.isPending || updateFolderMutation.isPending}
              data-testid="button-save-folder"
            >
              {editingFolder ? "Update" : "Create"} Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Course Dialog */}
      <Dialog open={showCourseDialog || !!editingCourse} onOpenChange={(open) => {
        if (!open) {
          setShowCourseDialog(false);
          setEditingCourse(null);
          resetCourseForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCourse ? "Edit Course" : "Create Training Course"}</DialogTitle>
            <DialogDescription>
              {editingCourse ? "Update the course details below." : "Add a new training course to the library."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="course-title">Course Title</Label>
                  <Input
                    id="course-title"
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    placeholder="e.g., Fire Warden Training"
                    data-testid="input-course-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course-provider">Provider</Label>
                  <Input
                    id="course-provider"
                    value={courseForm.provider}
                    onChange={(e) => setCourseForm({ ...courseForm, provider: e.target.value })}
                    placeholder="e.g., IOSH, HSE Direct"
                    data-testid="input-course-provider"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="course-summary">Summary</Label>
                  <Textarea
                    id="course-summary"
                    value={courseForm.summary}
                    onChange={(e) => setCourseForm({ ...courseForm, summary: e.target.value })}
                    placeholder="Brief summary of the training course..."
                    rows={3}
                    data-testid="input-course-summary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course-product-code">Product Code</Label>
                  <Input
                    id="course-product-code"
                    value={courseForm.productCode}
                    onChange={(e) => setCourseForm({ ...courseForm, productCode: e.target.value })}
                    placeholder="e.g., TR-001"
                    data-testid="input-course-product-code"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="course-module">Module</Label>
                  <Select
                    value={courseForm.module}
                    onValueChange={(v) => setCourseForm({ ...courseForm, module: v as ModuleType })}
                  >
                    <SelectTrigger data-testid="select-course-module">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["health_safety", "human_resources", "employment_law", "support"] as ModuleType[]).map((mod) => (
                        <SelectItem key={mod} value={mod}>{moduleNames[mod]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course-folder">Folder</Label>
                  <Select
                    value={courseForm.trainingFolderId || "none"}
                    onValueChange={(v) => setCourseForm({ ...courseForm, trainingFolderId: v === "none" ? "" : v })}
                  >
                    <SelectTrigger data-testid="select-course-folder">
                      <SelectValue placeholder="Select folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Folder</SelectItem>
                      {(trainingFolders || [])
                        .filter(f => f.module === courseForm.module)
                        .map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course-duration">Duration</Label>
                  <Input
                    id="course-duration"
                    value={courseForm.duration}
                    onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })}
                    placeholder="e.g., 2 hours"
                    data-testid="input-course-duration"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="course-method">Training Method</Label>
                  <Select
                    value={courseForm.trainingMethod || "none"}
                    onValueChange={(v) => setCourseForm({ ...courseForm, trainingMethod: v === "none" ? null : v as TrainingMethod })}
                  >
                    <SelectTrigger data-testid="select-course-method">
                      <SelectValue placeholder="Select delivery method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="in_person">In Person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course-link">External Link (optional)</Label>
                  <Input
                    id="course-link"
                    value={courseForm.externalLink}
                    onChange={(e) => setCourseForm({ ...courseForm, externalLink: e.target.value })}
                    placeholder="https://..."
                    data-testid="input-course-link"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch
                    id="course-required"
                    checked={courseForm.isRequired}
                    onCheckedChange={(checked) => setCourseForm({ ...courseForm, isRequired: checked })}
                    data-testid="switch-course-required"
                  />
                  <Label htmlFor="course-required">Required Training</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="course-featured"
                    checked={courseForm.isFeatured}
                    onCheckedChange={(checked) => setCourseForm({ ...courseForm, isFeatured: checked })}
                    data-testid="switch-course-featured"
                  />
                  <Label htmlFor="course-featured">Featured</Label>
                </div>
                {courseForm.isRequired && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="course-renewal">Renewal (months)</Label>
                    <Input
                      id="course-renewal"
                      type="number"
                      className="w-20"
                      value={courseForm.renewalPeriodMonths || ""}
                      onChange={(e) => setCourseForm({ 
                        ...courseForm, 
                        renewalPeriodMonths: e.target.value ? parseInt(e.target.value) : null 
                      })}
                      data-testid="input-course-renewal"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Course Overview */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <List className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm text-muted-foreground">Course Overview</h4>
              </div>
              <div className="space-y-2">
                {courseForm.courseOverview.map((item, index) => (
                  <Input
                    key={index}
                    value={item}
                    onChange={(e) => {
                      const newOverview = [...courseForm.courseOverview];
                      newOverview[index] = e.target.value;
                      setCourseForm({ ...courseForm, courseOverview: newOverview });
                    }}
                    placeholder={`Topic ${index + 1}`}
                    data-testid={`input-overview-${index}`}
                  />
                ))}
              </div>
            </div>

            {/* FAQs */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm text-muted-foreground">FAQs (up to 5)</h4>
              </div>
              <div className="space-y-4">
                {courseForm.faqs.map((faq, index) => (
                  <div key={index} className="space-y-2 p-3 border rounded-lg">
                    <Input
                      value={faq.question}
                      onChange={(e) => {
                        const newFaqs = [...courseForm.faqs];
                        newFaqs[index] = { ...newFaqs[index], question: e.target.value };
                        setCourseForm({ ...courseForm, faqs: newFaqs });
                      }}
                      placeholder={`Question ${index + 1}`}
                      data-testid={`input-faq-question-${index}`}
                    />
                    <Textarea
                      value={faq.answer}
                      onChange={(e) => {
                        const newFaqs = [...courseForm.faqs];
                        newFaqs[index] = { ...newFaqs[index], answer: e.target.value };
                        setCourseForm({ ...courseForm, faqs: newFaqs });
                      }}
                      placeholder={`Answer ${index + 1}`}
                      rows={2}
                      data-testid={`input-faq-answer-${index}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Table */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Pricing Table (2 columns, heading + 5 rows)</h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-1/2">
                        <Input
                          value={courseForm.pricingTable.headingRow.column1}
                          onChange={(e) => setCourseForm({
                            ...courseForm,
                            pricingTable: {
                              ...courseForm.pricingTable,
                              headingRow: { ...courseForm.pricingTable.headingRow, column1: e.target.value }
                            }
                          })}
                          placeholder="Column 1 Heading"
                          className="font-semibold"
                          data-testid="input-pricing-heading-1"
                        />
                      </TableHead>
                      <TableHead className="w-1/2">
                        <Input
                          value={courseForm.pricingTable.headingRow.column2}
                          onChange={(e) => setCourseForm({
                            ...courseForm,
                            pricingTable: {
                              ...courseForm.pricingTable,
                              headingRow: { ...courseForm.pricingTable.headingRow, column2: e.target.value }
                            }
                          })}
                          placeholder="Column 2 Heading"
                          className="font-semibold"
                          data-testid="input-pricing-heading-2"
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseForm.pricingTable.dataRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            value={row.column1}
                            onChange={(e) => {
                              const newRows = [...courseForm.pricingTable.dataRows];
                              newRows[index] = { ...newRows[index], column1: e.target.value };
                              setCourseForm({
                                ...courseForm,
                                pricingTable: { ...courseForm.pricingTable, dataRows: newRows }
                              });
                            }}
                            placeholder={`Row ${index + 1} - Col 1`}
                            data-testid={`input-pricing-row-${index}-col-1`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.column2}
                            onChange={(e) => {
                              const newRows = [...courseForm.pricingTable.dataRows];
                              newRows[index] = { ...newRows[index], column2: e.target.value };
                              setCourseForm({
                                ...courseForm,
                                pricingTable: { ...courseForm.pricingTable, dataRows: newRows }
                              });
                            }}
                            placeholder={`Row ${index + 1} - Col 2`}
                            data-testid={`input-pricing-row-${index}-col-2`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCourseDialog(false);
              setEditingCourse(null);
              resetCourseForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCourseSubmit}
              disabled={!courseForm.title.trim() || createCourseMutation.isPending || updateCourseMutation.isPending}
              data-testid="button-save-course"
            >
              {editingCourse ? "Update" : "Create"} Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Course Details Dialog */}
      <Dialog open={!!viewingCourse} onOpenChange={(open) => {
        if (!open) setViewingCourse(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {viewingCourse && (
            <CourseDetailView 
              course={viewingCourse} 
              folders={trainingFolders || []}
              onClose={() => setViewingCourse(null)}
              onEdit={() => {
                handleEditCourse(viewingCourse);
                setViewingCourse(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

// Course Detail View Component for read-only viewing
function CourseDetailView({
  course,
  folders,
  onClose,
  onEdit,
}: {
  course: TrainingCourse;
  folders: TrainingFolder[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const folderName = course.trainingFolderId 
    ? folders.find(f => f.id === course.trainingFolderId)?.name || "Unknown Folder"
    : "Unassigned";

  const parsedFaqs: TrainingFAQ[] = course.faqs ? JSON.parse(course.faqs) : [];
  const validFaqs = parsedFaqs.filter(faq => faq.question.trim() || faq.answer.trim());
  
  let parsedPricingTable: PricingTable | null = null;
  try {
    if (course.pricingTable) {
      const parsed = JSON.parse(course.pricingTable);
      if (parsed && parsed.headingRow && Array.isArray(parsed.dataRows)) {
        const hasData = parsed.dataRows.some((row: PricingTableRow) => row.column1?.trim() || row.column2?.trim());
        if (hasData || parsed.headingRow.column1?.trim() || parsed.headingRow.column2?.trim()) {
          parsedPricingTable = parsed;
        }
      }
    }
  } catch {
    parsedPricingTable = null;
  }

  const overview = course.courseOverview || [];
  const validOverview = overview.filter(item => item.trim());

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <DialogTitle className="text-xl">{course.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={moduleColors[course.module]}>
                {moduleNames[course.module]}
              </Badge>
              <span className="text-muted-foreground">•</span>
              <span>{folderName}</span>
              {course.productCode && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {course.productCode}
                  </Badge>
                </>
              )}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            {course.isRequired ? (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Required
                {course.renewalPeriodMonths && (
                  <span className="ml-1 opacity-75">({course.renewalPeriodMonths}mo)</span>
                )}
              </Badge>
            ) : (
              <Badge variant="secondary">Optional</Badge>
            )}
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Summary */}
        {course.summary && (
          <div>
            <h4 className="font-medium mb-2">Summary</h4>
            <p className="text-sm text-muted-foreground">{course.summary}</p>
          </div>
        )}

        {/* Course Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {course.provider && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Provider:</span>
              <span>{course.provider}</span>
            </div>
          )}
          {course.duration && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Duration:</span>
              <span>{course.duration}</span>
            </div>
          )}
          {course.trainingMethod && (
            <div className="flex items-center gap-2">
              {course.trainingMethod === "online" ? (
                <Monitor className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Users className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">Method:</span>
              <span>{course.trainingMethod === "online" ? "Online" : "In Person"}</span>
            </div>
          )}
          {course.externalLink && (
            <div className="flex items-center gap-2 col-span-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Link:</span>
              <a 
                href={course.externalLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate"
              >
                {course.externalLink}
              </a>
            </div>
          )}
        </div>

        {/* Course Overview */}
        {validOverview.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <List className="h-4 w-4" />
              Course Overview
            </h4>
            <ul className="space-y-1">
              {validOverview.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pricing Table */}
        {parsedPricingTable && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{parsedPricingTable.headingRow.column1 || "Item"}</TableHead>
                  <TableHead>{parsedPricingTable.headingRow.column2 || "Price"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedPricingTable.dataRows
                  .filter((row: PricingTableRow) => row.column1?.trim() || row.column2?.trim())
                  .map((row: PricingTableRow, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{row.column1}</TableCell>
                      <TableCell>{row.column2}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* FAQs */}
        {validFaqs.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Frequently Asked Questions
            </h4>
            <Accordion type="single" collapsible className="w-full">
              {validFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger className="text-sm text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Course
        </Button>
      </DialogFooter>
    </>
  );
}

// Folder View Component
function FolderView({
  folders,
  courses,
  getCoursesByFolder,
  getUnassignedCourses,
  isAdmin,
  onEditFolder,
  onDeleteFolder,
  onViewCourse,
  onEditCourse,
  onDeleteCourse,
  moduleColors,
  activeModule,
}: {
  folders: TrainingFolder[];
  courses: TrainingCourse[];
  getCoursesByFolder: (folderId: string) => TrainingCourse[];
  getUnassignedCourses: () => TrainingCourse[];
  isAdmin: boolean;
  onEditFolder: (folder: TrainingFolder) => void;
  onDeleteFolder: (id: string) => void;
  onViewCourse: (course: TrainingCourse) => void;
  onEditCourse: (course: TrainingCourse) => void;
  onDeleteCourse: (id: string) => void;
  moduleColors: Record<string, string>;
  activeModule: ModuleType;
}) {
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  const unassignedCourses = getUnassignedCourses();

  // Start with all folders collapsed by default

  const toggleAllFolders = () => {
    const allFolderIds = folders.map(f => f.id);
    if (unassignedCourses.length > 0) {
      allFolderIds.push("unassigned");
    }
    
    if (openFolders.length === allFolderIds.length) {
      setOpenFolders([]);
    } else {
      setOpenFolders(allFolderIds);
    }
  };

  const allExpanded = openFolders.length === folders.length + (unassignedCourses.length > 0 ? 1 : 0);

  if (folders.length === 0 && unassignedCourses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Training Content</h3>
          <p className="text-muted-foreground text-center">
            {isAdmin 
              ? "Create folders and add training courses to get started."
              : "No training content available for this module yet."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Expand/Collapse All Button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleAllFolders}
          className="text-muted-foreground"
          data-testid="button-toggle-all-folders"
        >
          {allExpanded ? "Collapse All" : "Expand All"}
        </Button>
      </div>

      <Accordion
        type="multiple"
        value={openFolders}
        onValueChange={setOpenFolders}
        className="space-y-3"
      >
        {folders.map((folder) => {
          const folderCourses = getCoursesByFolder(folder.id);
          return (
            <AccordionItem
              key={folder.id}
              value={folder.id}
              className={`border-2 rounded-lg overflow-hidden ${moduleBorderColors[activeModule]}`}
            >
              <AccordionTrigger 
                className={`px-4 py-3 hover:no-underline bg-gradient-to-r ${moduleGradients[activeModule]}`}
                data-testid={`folder-toggle-${folder.id}`}
              >
                <div className="flex items-center justify-between w-full pr-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${moduleBgColors[activeModule]}`}>
                      <FolderOpen className={`h-4 w-4 ${moduleColors[activeModule]}`} />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">{folder.name}</div>
                      {folder.description && (
                        <div className="text-sm text-muted-foreground font-normal">{folder.description}</div>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {folderCourses.length} course{folderCourses.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-folder-menu-${folder.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditFolder(folder); }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Folder
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Folder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                {folderCourses.length > 0 ? (
                  <div className="space-y-2">
                    {folderCourses.map((course) => (
                      <CourseRow 
                        key={course.id} 
                        course={course} 
                        isAdmin={isAdmin}
                        onView={() => onViewCourse(course)}
                        onEdit={() => onEditCourse(course)}
                        onDelete={() => onDeleteCourse(course.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No courses in this folder yet
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {/* Unassigned Courses */}
        {unassignedCourses.length > 0 && (
          <AccordionItem
            value="unassigned"
            className="border-2 rounded-lg overflow-hidden border-muted"
          >
            <AccordionTrigger 
              className="px-4 py-3 hover:no-underline bg-muted/30"
              data-testid="folder-toggle-unassigned"
            >
              <div className="flex items-center gap-3 w-full pr-2">
                <div className="p-1.5 rounded-lg bg-muted">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="font-semibold">Unassigned Courses</div>
                <Badge variant="outline">
                  {unassignedCourses.length} course{unassignedCourses.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2">
              <div className="space-y-2">
                {unassignedCourses.map((course) => (
                  <CourseRow 
                    key={course.id} 
                    course={course} 
                    isAdmin={isAdmin}
                    onView={() => onViewCourse(course)}
                    onEdit={() => onEditCourse(course)}
                    onDelete={() => onDeleteCourse(course.id)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

// Course List View Component
function CourseListView({
  courses,
  folders,
  isAdmin,
  onViewCourse,
  onEditCourse,
  onDeleteCourse,
  moduleColors,
  activeModule,
}: {
  courses: TrainingCourse[];
  folders: TrainingFolder[];
  isAdmin: boolean;
  onViewCourse: (course: TrainingCourse) => void;
  onEditCourse: (course: TrainingCourse) => void;
  onDeleteCourse: (id: string) => void;
  moduleColors: Record<string, string>;
  activeModule: ModuleType;
}) {
  const getFolderName = (folderId: string | null) => {
    if (!folderId) return "Unassigned";
    const folder = folders.find(f => f.id === folderId);
    return folder?.name || "Unknown";
  };

  if (courses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Training Courses</h3>
          <p className="text-muted-foreground text-center">
            {isAdmin 
              ? "Add training courses to this module to get started."
              : "No training courses available for this module yet."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Course</TableHead>
            <TableHead>Folder</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            {isAdmin && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {courses.map((course) => (
            <TableRow key={course.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <GraduationCap className={`h-4 w-4 ${moduleColors[activeModule]}`} />
                  <div>
                    <div className="font-medium">{course.title}</div>
                    {course.summary && (
                      <div className="text-sm text-muted-foreground line-clamp-1">{course.summary}</div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{getFolderName(course.trainingFolderId)}</Badge>
              </TableCell>
              <TableCell>{course.provider || "-"}</TableCell>
              <TableCell>
                {course.duration && (
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="h-3 w-3" />
                    {course.duration}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {course.isRequired ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Required
                  </Badge>
                ) : (
                  <Badge variant="secondary">Optional</Badge>
                )}
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-course-menu-${course.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewCourse(course)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditCourse(course)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Course
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDeleteCourse(course.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Course
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// Course Row Component for Folder View
function CourseRow({
  course,
  isAdmin,
  onView,
  onEdit,
  onDelete,
}: {
  course: TrainingCourse;
  isAdmin: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover-elevate">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="font-medium">{course.title}</div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {course.provider && <span>{course.provider}</span>}
            {course.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {course.duration}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {course.isRequired ? (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Required
          </Badge>
        ) : (
          <Badge variant="secondary">Optional</Badge>
        )}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-course-menu-${course.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Course
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Course
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
