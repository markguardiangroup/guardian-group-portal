import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  CheckCircle,
  GraduationCap,
  Calendar,
} from "lucide-react";
import { Link } from "wouter";
import type { Site } from "@shared/schema";

const trainingCertificateSchema = z.object({
  trainingCourseTitle: z.string().min(3, "Course title must be at least 3 characters"),
  trainingCourseCode: z.string().min(1, "Course code is required"),
  trainingDate: z.string().min(1, "Training date is required"),
  description: z.string().optional(),
  siteId: z.string().min(1, "Please select a site"),
});

type TrainingCertificateForm = z.infer<typeof trainingCertificateSchema>;

interface SiteWithCompany extends Site {
  companyName?: string | null;
}

export default function TrainingCertificateUpload() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");

  const isAdminOrConsultant = user?.role === "admin" || user?.role === "consultant";

  const { data: sites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });

  const form = useForm<TrainingCertificateForm>({
    resolver: zodResolver(trainingCertificateSchema),
    defaultValues: {
      trainingCourseTitle: "",
      trainingCourseCode: "",
      trainingDate: "",
      description: "",
      siteId: "",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: TrainingCertificateForm & { file: File }) => {
      const uploadResponse = await fetch("/api/uploads/file", {
        method: "POST",
        headers: {
          "Content-Type": data.file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(data.file.name),
        },
        credentials: "include",
        body: data.file,
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload file");
      }
      
      const uploadResult = await uploadResponse.json();
      const fileUrl = uploadResult.objectPath;
      
      const documentData = {
        title: `${data.trainingCourseTitle} - Certificate`,
        description: data.description || `Training certificate for ${data.trainingCourseTitle}`,
        module: "training",
        type: "training_certificate",
        siteId: data.siteId,
        fileName: data.file.name,
        fileUrl: fileUrl,
        fileSize: data.file.size,
        mimeType: data.file.type || "application/octet-stream",
        source: "upload",
        trainingCourseTitle: data.trainingCourseTitle,
        trainingCourseCode: data.trainingCourseCode,
        trainingDate: data.trainingDate,
      };
      
      return apiRequest("POST", "/api/documents", documentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Certificate Uploaded",
        description: "Training certificate has been uploaded successfully.",
      });
      navigate("/training/documents");
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload training certificate",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TrainingCertificateForm) => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a certificate file to upload",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate({ ...data, file: selectedFile });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const companies = sites
    ? Array.from(new Set(sites.map((s) => s.companyName).filter(Boolean)))
    : [];

  const filteredSites = sites?.filter((site) => {
    if (selectedCompany === "all") return true;
    return site.companyName === selectedCompany;
  }) || [];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Link href="/training/documents">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Training Documents
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <GraduationCap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle>Upload Training Certificate</CardTitle>
              <CardDescription>
                Upload a training certificate with course details
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="trainingCourseTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Fire Safety Awareness"
                        data-testid="input-course-title"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The name of the training course
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trainingCourseCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., FS-101"
                        data-testid="input-course-code"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The unique code for this training course
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trainingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Training Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-training-date"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The date when the training was completed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isAdminOrConsultant && (
                <div className="space-y-4">
                  <FormItem>
                    <FormLabel>Filter by Company</FormLabel>
                    <Select
                      value={selectedCompany}
                      onValueChange={setSelectedCompany}
                    >
                      <SelectTrigger data-testid="select-company-filter">
                        <SelectValue placeholder="All Companies" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Companies</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company} value={company!}>
                            {company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                </div>
              )}

              <FormField
                control={form.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-site">
                          <SelectValue placeholder="Select a site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredSites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                            {isAdminOrConsultant && site.companyName && (
                              <span className="text-muted-foreground ml-2">
                                ({site.companyName})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the site this certificate belongs to
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes about this certificate..."
                        className="resize-none"
                        data-testid="textarea-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Certificate File</FormLabel>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : selectedFile
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-testid="dropzone-file"
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                      <div className="text-left">
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedFile(null)}
                        data-testid="button-remove-file"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Drag and drop your certificate file here, or
                      </p>
                      <label>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={handleFileSelect}
                          data-testid="input-file"
                        />
                        <Button type="button" variant="outline" asChild>
                          <span>Browse Files</span>
                        </Button>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        PDF, JPG, PNG, DOC, or DOCX (max 10MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/training/documents")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={uploadMutation.isPending || !selectedFile}
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="button-upload"
                >
                  {uploadMutation.isPending ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Certificate
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
