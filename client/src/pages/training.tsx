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
  List,
  HelpCircle,
  Mail,
  Calendar,
  X,
  CheckCircle,
  Target,
  Sparkles,
  Award,
  Monitor,
  Users2,
  Filter,
  LayoutGrid,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingFolder, TrainingCourse, TrainingFAQ, PricingTable, ModuleType, Site } from "@shared/schema";

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
  all: "text-foreground",
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
};

const moduleBgColors: Record<string, string> = {
  all: "bg-primary/10",
  health_safety: "bg-emerald-100 dark:bg-emerald-900/30",
  human_resources: "bg-blue-100 dark:bg-blue-900/30",
  employment_law: "bg-pink-100 dark:bg-pink-900/30",
};

const moduleBorderColors: Record<string, string> = {
  all: "border-primary/20",
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
  all: "bg-primary",
  health_safety: "bg-emerald-600 dark:bg-emerald-500",
  human_resources: "bg-blue-600 dark:bg-blue-500",
  employment_law: "bg-pink-600 dark:bg-pink-500",
};

const moduleGradients: Record<string, string> = {
  all: "from-primary/10 via-primary/5 to-transparent",
  health_safety: "from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10",
  human_resources: "from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:via-blue-500/10",
  employment_law: "from-pink-500/10 via-pink-500/5 to-transparent dark:from-pink-500/20 dark:via-pink-500/10",
};

const moduleAccentBg: Record<string, string> = {
  all: "bg-primary",
  health_safety: "bg-emerald-500",
  human_resources: "bg-blue-500",
  employment_law: "bg-pink-500",
};

type ModuleFilter = "all" | ModuleType;

export default function Training() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ModuleFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestType, setRequestType] = useState<"info" | "booking">("info");
  const [requestMessage, setRequestMessage] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  
  const [filterRequired, setFilterRequired] = useState<"all" | "required" | "recommended">("all");
  const [filterMethod, setFilterMethod] = useState<"all" | "online" | "in_person">("all");
  const [filterProvider, setFilterProvider] = useState<string>("all");

  const { data: allFolders, isLoading: foldersLoading } = useQuery<TrainingFolder[]>({
    queryKey: ["/api/training-folders"],
  });

  const { data: allCourses, isLoading: coursesLoading } = useQuery<TrainingCourse[]>({
    queryKey: ["/api/training-courses"],
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: !!user,
  });

  const trainingFolders = useMemo(() => {
    if (!allFolders) return [];
    if (activeTab === "all") return allFolders;
    return allFolders.filter(f => f.module === activeTab);
  }, [allFolders, activeTab]);

  const trainingCourses = useMemo(() => {
    if (!allCourses) return [];
    if (activeTab === "all") return allCourses;
    return allCourses.filter(c => c.module === activeTab);
  }, [allCourses, activeTab]);

  const submitRequestMutation = useMutation({
    mutationFn: async (data: { trainingCourseId: string; siteId: string; requestType: "info" | "booking"; message?: string }) => {
      const response = await apiRequest("POST", "/api/training-requests", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: requestType === "info" ? "Request Submitted" : "Booking Request Submitted",
        description: requestType === "info" 
          ? "We'll get back to you with more information soon." 
          : "Your training booking request has been submitted.",
      });
      setShowRequestDialog(false);
      setRequestMessage("");
      setSelectedCourse(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit request",
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
    if (!trainingCourses) return [];
    return trainingCourses
      .filter(course => course.isFeatured)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [trainingCourses]);

  const requiredCount = filteredCourses.filter((c) => c.isRequired).length;
  const totalCourses = trainingCourses?.length || 0;
  const totalFolders = trainingFolders?.length || 0;

  const handleRequestInfo = (course: TrainingCourse) => {
    setSelectedCourse(course);
    setRequestType("info");
    setShowRequestDialog(true);
  };

  const handleBookTraining = (course: TrainingCourse) => {
    setSelectedCourse(course);
    setRequestType("booking");
    setShowRequestDialog(true);
  };

  const handleSubmitRequest = () => {
    if (!selectedCourse || !selectedSiteId) {
      toast({
        title: "Site Required",
        description: "Please select a site for this training request.",
        variant: "destructive",
      });
      return;
    }
    
    submitRequestMutation.mutate({
      trainingCourseId: selectedCourse.id,
      siteId: selectedSiteId,
      requestType,
      message: requestMessage || undefined,
    });
  };

  useEffect(() => {
    if (sites && sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const isLoading = foldersLoading || coursesLoading;
  const currentColor = activeTab === "all" ? "all" : activeTab;
  const currentModuleName = activeTab === "all" ? "All Training" : moduleNames[activeTab];

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
      <div className={`flex-shrink-0 bg-gradient-to-br ${moduleGradients[currentColor]} border-b`}>
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${moduleAccentBg[currentColor]} shadow-lg`}>
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Training</h1>
                <p className="text-muted-foreground mt-1 max-w-xl">
                  Browse training courses across all compliance areas
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/80 backdrop-blur border shadow-sm">
                <BookOpen className={`h-5 w-5 ${moduleColors[currentColor]}`} />
                <div>
                  <p className="text-lg font-bold">{totalCourses}</p>
                  <p className="text-xs text-muted-foreground">Courses</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/80 backdrop-blur border shadow-sm">
                <Target className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-lg font-bold">{requiredCount}</p>
                  <p className="text-xs text-muted-foreground">Required</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/80 backdrop-blur border shadow-sm">
                <FolderOpen className={`h-5 w-5 ${moduleColors[currentColor]}`} />
                <div>
                  <p className="text-lg font-bold">{totalFolders}</p>
                  <p className="text-xs text-muted-foreground">Categories</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-b bg-background">
        <div className="px-6 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ModuleFilter)}>
            <TabsList className="grid w-full max-w-3xl grid-cols-4 h-auto">
              <TabsTrigger 
                value="all" 
                data-testid="tab-all" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">All Training</span>
              </TabsTrigger>
              <TabsTrigger 
                value="health_safety" 
                data-testid="tab-health-safety" 
                className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-500"
              >
                <HardHat className="h-4 w-4" />
                <span className="hidden sm:inline">Health & Safety</span>
              </TabsTrigger>
              <TabsTrigger 
                value="human_resources" 
                data-testid="tab-human-resources" 
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=active]:bg-blue-500"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Human Resources</span>
              </TabsTrigger>
              <TabsTrigger 
                value="employment_law" 
                data-testid="tab-employment-law" 
                className="flex items-center gap-2 data-[state=active]:bg-pink-600 data-[state=active]:text-white dark:data-[state=active]:bg-pink-500"
              >
                <Scale className="h-4 w-4" />
                <span className="hidden sm:inline">Employment Law</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-shrink-0 p-4 border-b bg-background/50 backdrop-blur-sm space-y-3">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses by title, provider, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
              data-testid="input-search-training"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>
          
          <Select value={filterRequired} onValueChange={(v) => setFilterRequired(v as typeof filterRequired)}>
            <SelectTrigger className="w-[140px] h-8 text-sm" data-testid="select-filter-required">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              <SelectItem value="required">Required</SelectItem>
              <SelectItem value="recommended">Recommended</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterMethod} onValueChange={(v) => setFilterMethod(v as typeof filterMethod)}>
            <SelectTrigger className="w-[140px] h-8 text-sm" data-testid="select-filter-method">
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
              <SelectTrigger className="w-[160px] h-8 text-sm" data-testid="select-filter-provider">
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
          
          {(filterRequired !== "all" || filterMethod !== "all" || filterProvider !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-sm"
              onClick={() => {
                setFilterRequired("all");
                setFilterMethod("all");
                setFilterProvider("all");
              }}
              data-testid="button-clear-filters"
            >
              <X className="h-3 w-3 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
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
          <div className="p-6 space-y-8">
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
                      onRequestInfo={() => handleRequestInfo(course)}
                      onBookTraining={() => handleBookTraining(course)}
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
                          onRequestInfo={() => handleRequestInfo(course)}
                          onBookTraining={() => handleBookTraining(course)}
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
                                  {activeTab === "all" && folder.module && (
                                    <Badge variant="outline" className="text-xs">
                                      {moduleNames[folder.module]}
                                    </Badge>
                                  )}
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
                                    onRequestInfo={() => handleRequestInfo(course)}
                                    onBookTraining={() => handleBookTraining(course)}
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

      <Dialog open={!!selectedCourse && !showRequestDialog} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedCourse && (
            <CourseDetailView
              course={selectedCourse}
              onClose={() => setSelectedCourse(null)}
              onRequestInfo={() => handleRequestInfo(selectedCourse)}
              onBookTraining={() => handleBookTraining(selectedCourse)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRequestDialog} onOpenChange={(open) => {
        setShowRequestDialog(open);
        if (!open) setSelectedCourse(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {requestType === "info" ? "Request More Information" : "Book Training"}
            </DialogTitle>
            <DialogDescription>
              {requestType === "info" 
                ? `Request more details about "${selectedCourse?.title}"`
                : `Submit a booking request for "${selectedCourse?.title}"`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {sites && sites.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="request-site">Site</Label>
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger data-testid="select-request-site">
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
                Request for: <span className="font-medium">{sites[0].name}</span>
              </div>
            )}
            {(!sites || sites.length === 0) && (
              <div className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                No sites available. Please contact your administrator.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="request-message">Message (optional)</Label>
              <Textarea
                id="request-message"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder={requestType === "info" 
                  ? "What would you like to know about this training?"
                  : "Any specific requirements or preferred dates?"
                }
                rows={4}
                data-testid="input-request-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRequestDialog(false);
              setSelectedCourse(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitRequest}
              disabled={submitRequestMutation.isPending || !selectedSiteId}
              data-testid="button-submit-request"
            >
              {requestType === "info" ? (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Request Info
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Training
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeaturedCourseCard({
  course,
  onViewDetails,
  onRequestInfo,
  onBookTraining,
}: {
  course: TrainingCourse;
  onViewDetails: () => void;
  onRequestInfo: () => void;
  onBookTraining: () => void;
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
          
          <div className="flex gap-2 pt-2 border-t mt-auto" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onRequestInfo}
              data-testid={`button-featured-info-${course.id}`}
            >
              <Mail className="h-4 w-4 mr-1" />
              Enquire
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={onBookTraining}
              data-testid={`button-featured-book-${course.id}`}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Book
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
  onRequestInfo,
  onBookTraining,
}: {
  course: TrainingCourse;
  onViewDetails: () => void;
  onRequestInfo: () => void;
  onBookTraining: () => void;
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
              
              <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onRequestInfo}
                  data-testid={`button-request-info-${course.id}`}
                >
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  Enquire
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onBookTraining}
                  data-testid={`button-book-training-${course.id}`}
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Book
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
  onRequestInfo,
  onBookTraining,
}: {
  course: TrainingCourse;
  onClose: () => void;
  onRequestInfo: () => void;
  onBookTraining: () => void;
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

        <div className="flex gap-3 pt-2 border-t">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onRequestInfo}
            data-testid="button-detail-request-info"
          >
            <Mail className="h-4 w-4 mr-2" />
            Request More Info
          </Button>
          <Button
            className="flex-1"
            onClick={onBookTraining}
            data-testid="button-detail-book-training"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Book This Training
          </Button>
        </div>
      </div>
    </>
  );
}
