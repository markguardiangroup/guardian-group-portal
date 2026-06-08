import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  CheckCircle,
  GraduationCap,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import { addMonths, format } from "date-fns";
import type { Site, TrainingCourse } from "@shared/schema";

const trainingCertificateSchema = z.object({
  trainingCourseId: z.string().min(1, "Please select a course"),
  trainingDate: z.string().min(1, "Certificate date is required"),
  renewalRequired: z.boolean().default(false),
  renewalPeriodMonths: z.number().min(1).max(120).optional(),
  comments: z.string().optional(),
  siteId: z.string().min(1, "Please select a site"),
}).refine((data) => {
  if (data.renewalRequired && !data.renewalPeriodMonths) {
    return false;
  }
  return true;
}, {
  message: "Renewal period is required when renewal is enabled",
  path: ["renewalPeriodMonths"],
});

type TrainingCertificateForm = z.infer<typeof trainingCertificateSchema>;

interface SiteWithCompany extends Site {
  companyName?: string | null;
}

export default function TrainingCertificateUpload() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");

  // Parse URL parameters for booking-linked upload
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get("bookingId");
  const preselectedCourseId = urlParams.get("courseId");
  const preselectedSiteId = urlParams.get("siteId");

  const isDeveloperOrConsultant = user?.role === "developer" || user?.role === "consultant";

  // Only admin/consultant can upload certificates
  if (!isDeveloperOrConsultant) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground mb-6">
              Only consultants and developers can upload training certificates.
            </p>
            <Link href="/training/my-training">
              <Button className="bg-purple-600 text-white" data-testid="button-go-to-my-training">
                <GraduationCap className="h-4 w-4 mr-2" />
                View Training Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Require a booking to upload certificates
  if (!bookingId) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Certificate Upload Requires a Booking</h2>
            <p className="text-muted-foreground mb-6">
              Training certificates can only be uploaded when completing a booked training course.
              This ensures proper tracking and audit trail for all training activities.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/training/dashboard">
                <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-go-to-dashboard">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Go to Training Dashboard
                </Button>
              </Link>
              <Link href="/training/certificates">
                <Button variant="outline" data-testid="button-view-certificates">
                  View Certificates
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: sites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });

  const { data: trainingCourses } = useQuery<TrainingCourse[]>({
    queryKey: ["/api/training-courses"],
  });

  const form = useForm<TrainingCertificateForm>({
    resolver: zodResolver(trainingCertificateSchema),
    defaultValues: {
      trainingCourseId: preselectedCourseId || "",
      trainingDate: "",
      renewalRequired: false,
      renewalPeriodMonths: undefined,
      comments: "",
      siteId: preselectedSiteId || "",
    },
  });

  const watchCourseId = form.watch("trainingCourseId");
  const selectedCourse = trainingCourses?.find(c => c.id === watchCourseId);

  // Set preselected values from URL params when data loads
  useEffect(() => {
    if (preselectedCourseId && trainingCourses?.length) {
      form.setValue("trainingCourseId", preselectedCourseId);
    }
    if (preselectedSiteId && sites?.length) {
      form.setValue("siteId", preselectedSiteId);
    }
  }, [preselectedCourseId, preselectedSiteId, trainingCourses, sites, form]);

  // Auto-populate renewal settings when a course is selected
  useEffect(() => {
    if (selectedCourse?.renewalPeriodMonths) {
      form.setValue("renewalRequired", true);
      form.setValue("renewalPeriodMonths", selectedCourse.renewalPeriodMonths);
    }
  }, [selectedCourse, form]);

  const watchRenewalRequired = form.watch("renewalRequired");
  const watchTrainingDate = form.watch("trainingDate");
  const watchRenewalPeriod = form.watch("renewalPeriodMonths");

  const calculatedRenewalDate = watchTrainingDate && watchRenewalPeriod
    ? format(addMonths(new Date(watchTrainingDate), watchRenewalPeriod), "dd MMM yyyy")
    : null;

  const uploadMutation = useMutation({
    mutationFn: async (data: TrainingCertificateForm & { file: File; course: TrainingCourse }) => {
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
        if (uploadResponse.status === 401) throw new Error("Your session has expired — please refresh the page and log back in.");
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload file");
      }
      
      const uploadResult = await uploadResponse.json();
      const fileUrl = uploadResult.objectPath;
      
      const renewalDate = data.renewalRequired && data.renewalPeriodMonths && data.trainingDate
        ? format(addMonths(new Date(data.trainingDate), data.renewalPeriodMonths), "yyyy-MM-dd")
        : undefined;
      
      const documentData = {
        title: `${data.course.title} - Certificate`,
        comments: data.comments || `Training certificate for ${data.course.title}`,
        module: "training",
        type: "training_certificate",
        siteId: data.siteId,
        fileName: data.file.name,
        fileUrl: fileUrl,
        fileSize: data.file.size,
        mimeType: data.file.type || "application/octet-stream",
        source: "upload",
        trainingCourseTitle: data.course.title,
        trainingCourseCode: data.course.productCode || "",
        trainingDate: data.trainingDate,
        renewalDate: renewalDate,
      };
      
      const documentResponse = await apiRequest("POST", "/api/documents", documentData);
      const documentResult = await documentResponse.json();
      
      // If this is linked to a booking, update the booking with the certificate ID
      if (bookingId) {
        await apiRequest("PATCH", `/api/training-bookings/${bookingId}`, {
          status: "completed",
          certificateId: documentResult.id,
          completedDate: data.trainingDate,
        });
      }
      
      return documentResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/training-bookings"], refetchType: "all" });
      toast({
        title: "Certificate Uploaded",
        description: bookingId 
          ? "Training certificate uploaded and booking marked as completed."
          : "Training certificate has been uploaded successfully.",
      });
      navigate(bookingId ? "/training/dashboard" : "/training/certificates");
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
    
    if (!selectedCourse) {
      toast({
        title: "No Course Selected",
        description: "Please select a training course",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate({ ...data, file: selectedFile, course: selectedCourse });
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
        <Link href={bookingId ? "/training/dashboard" : "/training/certificates"}>
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {bookingId ? "Back to Training Dashboard" : "Back to Certificates"}
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
              <CardTitle>
                {bookingId ? "Complete Training & Upload Certificate" : "Upload Training Certificate"}
              </CardTitle>
              <CardDescription>
                {bookingId 
                  ? "Upload the certificate to mark the training as completed"
                  : "Upload a training certificate with course details"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="trainingCourseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Training Course</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!!bookingId}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-course">
                          <SelectValue placeholder="Select a training course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trainingCourses?.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
                            {course.productCode && (
                              <span className="text-muted-foreground ml-2">
                                ({course.productCode})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {bookingId 
                        ? "Course is linked to the training booking"
                        : "Select a course from your training library"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedCourse && (
                <div className="p-3 bg-muted rounded-lg border space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Selected Course:</span>
                    <span className="text-sm">{selectedCourse.title}</span>
                  </div>
                  {selectedCourse.productCode && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Course Code:</span>
                      <span className="text-sm text-muted-foreground">{selectedCourse.productCode}</span>
                    </div>
                  )}
                  {selectedCourse.renewalPeriodMonths && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Default Renewal:</span>
                      <span className="text-sm text-muted-foreground">{selectedCourse.renewalPeriodMonths} months</span>
                    </div>
                  )}
                </div>
              )}

              <FormField
                control={form.control}
                name="trainingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certificate Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-certificate-date"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The date on the training certificate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="renewalRequired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Renewal Required</FormLabel>
                      <FormDescription>
                        Enable if this certificate needs periodic renewal
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-renewal-required"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {watchRenewalRequired && (
                <FormField
                  control={form.control}
                  name="renewalPeriodMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Renewal Period (Months)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={120}
                          placeholder="e.g., 12"
                          data-testid="input-renewal-period"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        How many months until renewal is due
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {calculatedRenewalDate && watchRenewalRequired && (
                <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <RefreshCw className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Renewal Date: </span>
                    <span className="font-medium">{calculatedRenewalDate}</span>
                  </span>
                </div>
              )}

              {isDeveloperOrConsultant && !bookingId && (
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
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!!bookingId}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-site">
                          <SelectValue placeholder="Select a site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredSites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                            {isDeveloperOrConsultant && site.companyName && (
                              <span className="text-muted-foreground ml-2">
                                ({site.companyName})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {bookingId 
                        ? "Site is linked to the training booking"
                        : "Select the site this certificate belongs to"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comments"
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
                  onClick={() => navigate("/training/certificates")}
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
