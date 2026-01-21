import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { TrainingModule, FolderTemplate, ModuleType } from "@shared/schema";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<string[]>([]);

  // Fetch training modules for this module
  const { data: trainingModules, isLoading: modulesLoading } = useQuery<TrainingModule[]>({
    queryKey: ["/api/training-modules", { module }],
    queryFn: async () => {
      const response = await fetch(`/api/training-modules?module=${module}`);
      if (!response.ok) throw new Error("Failed to fetch training modules");
      return response.json();
    },
  });

  // Fetch folder templates for organization
  const { data: folderTemplates } = useQuery<FolderTemplate[]>({
    queryKey: ["/api/folder-templates"],
  });

  // Filter modules by search
  const filteredModules = useMemo(() => {
    if (!trainingModules) return [];
    
    if (!searchQuery) return trainingModules;
    
    const query = searchQuery.toLowerCase();
    return trainingModules.filter((m) => 
      m.title.toLowerCase().includes(query) ||
      m.description?.toLowerCase().includes(query) ||
      m.provider?.toLowerCase().includes(query)
    );
  }, [trainingModules, searchQuery]);

  // Get folder templates for this module
  const moduleFolders = useMemo(() => {
    if (!folderTemplates) return [];
    return folderTemplates.filter((f) => f.module === module && f.isActive);
  }, [folderTemplates, module]);

  // Group modules by folder
  const groupedByFolder = useMemo(() => {
    const groups: Record<string, TrainingModule[]> = { unfiled: [] };
    
    moduleFolders.forEach((folder) => {
      groups[folder.id] = [];
    });
    
    filteredModules.forEach((trainingModule) => {
      if (trainingModule.folderTemplateId && groups[trainingModule.folderTemplateId]) {
        groups[trainingModule.folderTemplateId].push(trainingModule);
      } else {
        groups.unfiled.push(trainingModule);
      }
    });
    
    return groups;
  }, [filteredModules, moduleFolders]);

  // Count training by status
  const requiredCount = filteredModules.filter((m) => m.isRequired).length;
  const recommendedCount = filteredModules.filter((m) => !m.isRequired).length;

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
        {modulesLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filteredModules.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No training available</h3>
            <p className="text-muted-foreground">
              {searchQuery 
                ? "No training modules match your search." 
                : "Training resources for this module will appear here once added."}
            </p>
          </Card>
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
                  {groupedByFolder.unfiled.map((training) => (
                    <TrainingCard 
                      key={training.id} 
                      training={training} 
                      moduleColor={moduleColors[module]}
                      buttonColor={moduleButtonColors[module]}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Grouped by folder */}
            <Accordion
              type="multiple"
              value={openFolders}
              onValueChange={setOpenFolders}
              className="space-y-3"
            >
              {moduleFolders.map((folder) => {
                const folderModules = groupedByFolder[folder.id] || [];
                if (folderModules.length === 0) return null;
                
                return (
                  <AccordionItem 
                    key={folder.id} 
                    value={folder.id}
                    className={`border rounded-lg ${moduleBorderColors[module]}`}
                  >
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <GraduationCap className={`h-5 w-5 ${moduleColors[module]}`} />
                        <span className="font-medium">{folder.name}</span>
                        <Badge variant="secondary">{folderModules.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                      {folderModules.map((training) => (
                        <TrainingCard 
                          key={training.id} 
                          training={training} 
                          moduleColor={moduleColors[module]}
                          buttonColor={moduleButtonColors[module]}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
}

// Training card component for client view
function TrainingCard({
  training,
  moduleColor,
  buttonColor,
}: {
  training: TrainingModule;
  moduleColor: string;
  buttonColor: string;
}) {
  return (
    <Card 
      className="hover-elevate transition-shadow"
      data-testid={`card-training-${training.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{training.title}</h4>
              {training.isRequired ? (
                <Badge className="bg-amber-500 hover:bg-amber-600">
                  Required
                  {training.renewalPeriodMonths && (
                    <span className="ml-1 opacity-75">
                      ({training.renewalPeriodMonths}mo renewal)
                    </span>
                  )}
                </Badge>
              ) : (
                <Badge variant="secondary">Recommended</Badge>
              )}
            </div>
            
            {training.description && (
              <p className="text-sm text-muted-foreground">
                {training.description}
              </p>
            )}
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {training.provider && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {training.provider}
                </div>
              )}
              {training.duration && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {training.duration}
                </div>
              )}
            </div>
          </div>
          
          <Button
            asChild
            className={buttonColor}
            data-testid={`button-start-training-${training.id}`}
          >
            <a
              href={training.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Start Training
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
