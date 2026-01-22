import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Search,
  HardHat, 
  Users, 
  Scale,
  Headphones,
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
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingFolder, TrainingCourse, TrainingFAQ, PricingTable, ModuleType, Site } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const moduleButtonColors: Record<string, string> = {
  health_safety: "bg-emerald-600 hover:bg-emerald-700 text-white",
  human_resources: "bg-blue-600 hover:bg-blue-700 text-white",
  employment_law: "bg-pink-600 hover:bg-pink-700 text-white",
  support: "bg-purple-600 hover:bg-purple-700 text-white",
};

interface ModuleTrainingProps {
  module: ModuleType;
}

export default function ModuleTraining({ module }: ModuleTrainingProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestType, setRequestType] = useState<"info" | "booking">("info");
  const [requestMessage, setRequestMessage] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");

  // Fetch training folders for this module
  const { data: trainingFolders, isLoading: foldersLoading } = useQuery<TrainingFolder[]>({
    queryKey: ["/api/training-folders", { module }],
    queryFn: async () => {
      const response = await fetch(`/api/training-folders?module=${module}`);
      if (!response.ok) throw new Error("Failed to fetch training folders");
      return response.json();
    },
  });

  // Fetch training courses for this module
  const { data: trainingCourses, isLoading: coursesLoading } = useQuery<TrainingCourse[]>({
    queryKey: ["/api/training-courses", { module }],
    queryFn: async () => {
      const response = await fetch(`/api/training-courses?module=${module}`);
      if (!response.ok) throw new Error("Failed to fetch training courses");
      return response.json();
    },
  });

  // Fetch user's sites for request submission
  const { data: sites } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: !!user,
  });

  // Submit training request mutation
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

  // Filter courses by search
  const filteredCourses = useMemo(() => {
    if (!trainingCourses) return [];
    
    if (!searchQuery) return trainingCourses;
    
    const query = searchQuery.toLowerCase();
    return trainingCourses.filter((c) => 
      c.title.toLowerCase().includes(query) ||
      c.summary?.toLowerCase().includes(query) ||
      c.provider?.toLowerCase().includes(query)
    );
  }, [trainingCourses, searchQuery]);

  // Group courses by folder
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

  // Count training by status
  const requiredCount = filteredCourses.filter((c) => c.isRequired).length;
  const recommendedCount = filteredCourses.filter((c) => !c.isRequired).length;

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

  // Set default site when sites load
  useEffect(() => {
    if (sites && sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const isLoading = foldersLoading || coursesLoading;
  const ModuleIcon = moduleIcons[module];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${moduleBgColors[module]}`}>
              <GraduationCap className={`h-6 w-6 ${moduleColors[module]}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{moduleNames[module]} Training</h1>
              <p className="text-sm text-muted-foreground">
                Training resources and courses
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="px-6 pb-4 flex gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${moduleBgColors[module]}`}>
            <AlertCircle className={`h-4 w-4 ${moduleColors[module]}`} />
            <span className="text-sm font-medium">{requiredCount} Required</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{recommendedCount} Recommended</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search training..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-training"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filteredCourses.length === 0 && (trainingFolders || []).length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No training available</h3>
            <p className="text-muted-foreground">
              Training folders and courses for this module will appear here once added.
            </p>
          </Card>
        ) : searchQuery && filteredCourses.length === 0 ? (
          <div className="space-y-6">
            <Card className="p-8 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">No matching courses</h3>
              <p className="text-sm text-muted-foreground">
                No training courses match "{searchQuery}"
              </p>
            </Card>
            {/* Still show folders for reference */}
            {(trainingFolders || []).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Available Folders</h4>
                <div className="grid gap-2">
                  {(trainingFolders || []).map((folder) => (
                    <div 
                      key={folder.id}
                      className={`flex items-center gap-2 p-3 rounded-lg border ${moduleBorderColors[module]} bg-card`}
                    >
                      <FolderOpen className={`h-4 w-4 ${moduleColors[module]}`} />
                      <span className="text-sm font-medium">{folder.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Unfiled / General Training */}
            {groupedByFolder.unfiled.length > 0 && (
              <Card className={`border ${moduleBorderColors[module]}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GraduationCap className={`h-5 w-5 ${moduleColors[module]}`} />
                    General Training
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {groupedByFolder.unfiled.map((course) => (
                    <TrainingCard 
                      key={course.id} 
                      course={course} 
                      moduleColor={moduleColors[module]}
                      buttonColor={moduleButtonColors[module]}
                      onViewDetails={() => setSelectedCourse(course)}
                      onRequestInfo={() => handleRequestInfo(course)}
                      onBookTraining={() => handleBookTraining(course)}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Grouped by folder */}
            {(trainingFolders || []).length > 0 && (
              <Accordion
                type="multiple"
                value={openFolders}
                onValueChange={setOpenFolders}
                className="space-y-3"
              >
                {(trainingFolders || []).map((folder) => {
                  const folderCourses = groupedByFolder[folder.id] || [];
                  
                  return (
                    <AccordionItem 
                      key={folder.id} 
                      value={folder.id}
                      className={`border rounded-lg ${moduleBorderColors[module]}`}
                      data-testid={`folder-${folder.id}`}
                    >
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <FolderOpen className={`h-5 w-5 ${moduleColors[module]}`} />
                          <span className="font-medium">{folder.name}</span>
                          <Badge variant="secondary">{folderCourses.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        {folder.description && (
                          <p className="text-sm text-muted-foreground mb-4">{folder.description}</p>
                        )}
                        {folderCourses.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No courses in this folder yet</p>
                          </div>
                        ) : (
                          folderCourses.map((course) => (
                            <TrainingCard 
                              key={course.id} 
                              course={course} 
                              moduleColor={moduleColors[module]}
                              buttonColor={moduleButtonColors[module]}
                              onViewDetails={() => setSelectedCourse(course)}
                              onRequestInfo={() => handleRequestInfo(course)}
                              onBookTraining={() => handleBookTraining(course)}
                            />
                          ))
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        )}
      </div>

      {/* Course Detail Dialog */}
      <Dialog open={!!selectedCourse && !showRequestDialog} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedCourse && (
            <CourseDetailView
              course={selectedCourse}
              module={module}
              onClose={() => setSelectedCourse(null)}
              onRequestInfo={() => handleRequestInfo(selectedCourse)}
              onBookTraining={() => handleBookTraining(selectedCourse)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Request Dialog */}
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
            {/* Site Selection */}
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
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
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

// Training card component for client view
function TrainingCard({
  course,
  moduleColor,
  buttonColor,
  onViewDetails,
  onRequestInfo,
  onBookTraining,
}: {
  course: TrainingCourse;
  moduleColor: string;
  buttonColor: string;
  onViewDetails: () => void;
  onRequestInfo: () => void;
  onBookTraining: () => void;
}) {
  return (
    <Card 
      className="hover-elevate transition-shadow cursor-pointer"
      onClick={onViewDetails}
      data-testid={`card-training-${course.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium">{course.title}</h4>
              {course.productCode && (
                <Badge variant="outline" className="font-mono text-xs">
                  {course.productCode}
                </Badge>
              )}
              {course.isRequired ? (
                <Badge className="bg-amber-500 hover:bg-amber-600">
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
            
            {course.summary && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {course.summary}
              </p>
            )}
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {course.provider && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {course.provider}
                </div>
              )}
              {course.duration && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {course.duration}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestInfo}
              data-testid={`button-request-info-${course.id}`}
            >
              <Mail className="h-4 w-4 mr-1" />
              Info
            </Button>
            <Button
              size="sm"
              className={buttonColor}
              onClick={onBookTraining}
              data-testid={`button-book-training-${course.id}`}
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

// Course detail view component
function CourseDetailView({
  course,
  module,
  onClose,
  onRequestInfo,
  onBookTraining,
}: {
  course: TrainingCourse;
  module: ModuleType;
  onClose: () => void;
  onRequestInfo: () => void;
  onBookTraining: () => void;
}) {
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
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${moduleBgColors[module]}`}>
              <GraduationCap className={`h-5 w-5 ${moduleColors[module]}`} />
            </div>
            <div>
              <DialogTitle className="text-xl">{course.title}</DialogTitle>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {course.productCode && (
                  <span className="font-medium text-foreground">
                    {course.productCode}
                  </span>
                )}
                {course.provider && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {course.provider}
                  </span>
                )}
                {course.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {course.duration}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {course.isRequired ? (
              <Badge className="bg-amber-500 hover:bg-amber-600">
                Required
                {course.renewalPeriodMonths && ` (${course.renewalPeriodMonths}mo)`}
              </Badge>
            ) : (
              <Badge variant="secondary">Recommended</Badge>
            )}
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Summary */}
        {course.summary && (
          <div>
            <h4 className="font-medium mb-2">Summary</h4>
            <p className="text-muted-foreground">{course.summary}</p>
          </div>
        )}

        {/* Course Overview */}
        {overview.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <List className="h-4 w-4" />
              Course Overview
            </h4>
            <ul className="space-y-2">
              {overview.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* FAQs */}
        {parsedFaqs.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Frequently Asked Questions
            </h4>
            <Accordion type="single" collapsible className="space-y-2">
              {parsedFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {/* Pricing Table */}
        {parsedPricingTable && parsedPricingTable.dataRows.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Pricing</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{parsedPricingTable.headingRow.column1 || "Item"}</TableHead>
                    <TableHead className="font-semibold">{parsedPricingTable.headingRow.column2 || "Price"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedPricingTable.dataRows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.column1}</TableCell>
                      <TableCell>{row.column2}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* External Link */}
        {course.externalLink && (
          <div>
            <Button asChild variant="outline" className="w-full">
              <a href={course.externalLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View External Course Page
              </a>
            </Button>
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onRequestInfo} data-testid="button-detail-request-info">
          <Mail className="h-4 w-4 mr-2" />
          Request More Info
        </Button>
        <Button onClick={onBookTraining} className={moduleButtonColors[module]} data-testid="button-detail-book-training">
          <Calendar className="h-4 w-4 mr-2" />
          Book Training
        </Button>
      </DialogFooter>
    </>
  );
}
