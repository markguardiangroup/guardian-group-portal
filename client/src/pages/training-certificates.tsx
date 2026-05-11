import { useState } from "react";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  Award,
  Search,
  FileText,
  Calendar,
  RefreshCw,
  Building2,
  MapPin,
  Download,
  Eye,
  HardHat,
  Users,
  Scale,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import type { Document, Site, TrainingBooking, TrainingCourse } from "@shared/schema";

interface CertificateWithDetails extends Document {
  siteName?: string;
  companyName?: string;
  courseModule?: string;
}

interface SiteWithCompany extends Site {
  companyName?: string | null;
}

type ModuleFilter = "all" | "health_safety" | "human_resources" | "employment_law";

const moduleFilterConfig = [
  { value: "all" as const, label: "All Modules", Icon: Filter, color: "text-purple-600 dark:text-purple-400", activeStyle: "bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700" },
  { value: "health_safety" as const, label: "Health & Safety", Icon: HardHat, color: "text-emerald-600 dark:text-emerald-400", activeStyle: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700" },
  { value: "human_resources" as const, label: "Human Resources", Icon: Users, color: "text-blue-600 dark:text-blue-400", activeStyle: "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700" },
  { value: "employment_law" as const, label: "Employment Law", Icon: Scale, color: "text-pink-600 dark:text-pink-400", activeStyle: "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700" },
];

export default function TrainingCertificates() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [viewDialog, setViewDialog] = useState<CertificateWithDetails | null>(null);

  const isAdminOrConsultant = user?.role === "admin" || user?.role === "consultant";

  const { data: sites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents/module/training"],
  });

  const { data: trainingBookings = [] } = useQuery<TrainingBooking[]>({
    queryKey: ["/api/training-bookings"],
  });

  const { data: trainingCourses = [] } = useQuery<TrainingCourse[]>({
    queryKey: ["/api/training-courses"],
  });

  const certificates: CertificateWithDetails[] = (documents || [])
    .filter((doc) => doc.type === "training_certificate")
    .map((doc) => {
      const site = sites?.find((s) => s.id === doc.siteId);
      const booking = trainingBookings.find((b) => b.certificateId === doc.id);
      const course = booking ? trainingCourses.find((c) => c.id === booking.trainingCourseId) : null;
      return {
        ...doc,
        siteName: site?.name,
        companyName: site?.companyName || undefined,
        courseModule: course?.module,
      };
    });

  const companies = sites
    ? Array.from(new Set(sites.map((s) => s.companyName).filter(Boolean)))
    : [];

  const filteredCertificates = certificates.filter((cert) => {
    const matchesSearch =
      !searchQuery ||
      cert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.trainingCourseTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.trainingCourseCode?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesModule =
      moduleFilter === "all" || cert.courseModule === moduleFilter;

    const matchesCompany =
      selectedCompany === "all" || cert.companyName === selectedCompany;

    const matchesSite = selectedSite === "all" || cert.siteId === selectedSite;

    return matchesSearch && matchesModule && matchesCompany && matchesSite;
  });

  const filteredSites = sites?.filter((site) => {
    if (selectedCompany === "all") return true;
    return site.companyName === selectedCompany;
  }) || [];

  const getStatusBadge = (cert: CertificateWithDetails) => {
    if (cert.renewalDate) {
      const renewalDate = new Date(cert.renewalDate);
      const now = new Date();
      const daysUntilRenewal = Math.ceil(
        (renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilRenewal < 0) {
        return <Badge variant="destructive">Overdue</Badge>;
      } else if (daysUntilRenewal <= 30) {
        return <Badge className="bg-amber-500 hover:bg-amber-600">Due Soon</Badge>;
      } else {
        return <Badge className="bg-green-600 hover:bg-green-700">Valid</Badge>;
      }
    }
    return <Badge variant="secondary">No Renewal</Badge>;
  };

  return (
    <div className="theme-training flex flex-col h-full">
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <Award className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                Training
                <span className="font-normal text-muted-foreground text-2xl"> — Certificates</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground min-h-[1.5rem]">
                Manage training certificates and track renewals
              </p>
            </div>
          </div>
        </div>
      </div>
      <div id="page-content" className="flex-1 overflow-auto container px-6 py-6 space-y-6 dash-animate">

      {/* Module Tabs - Enhanced Prominence */}
      <div className="grid w-full grid-cols-4 gap-2 p-1 rounded-xl bg-muted/50 border mb-6">
        {moduleFilterConfig.map(({ value, label, Icon, color, activeStyle }) => {
          const isActive = moduleFilter === value;
          return (
            <button
              key={value}
              onClick={() => setModuleFilter(value)}
              data-testid={`module-tab-${value}`}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-4 px-3 rounded-lg font-medium transition-all ${
                isActive 
                  ? `${activeStyle} border shadow-sm ${color}` 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent"
              }`}
            >
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm">{label}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, course name, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>

            {isAdminOrConsultant && (
              <Select value={selectedCompany} onValueChange={(v) => {
                setSelectedCompany(v);
                setSelectedSite("all");
              }}>
                <SelectTrigger className="w-[200px]" data-testid="select-company">
                  <Building2 className="h-4 w-4 mr-2" />
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
            )}

            {/* Site filter available for all users */}
            {filteredSites.length > 1 && (
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="w-[200px]" data-testid="select-site">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {filteredSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <FetchingOverlay />
          ) : filteredCertificates.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No certificates found</h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedCompany !== "all" || selectedSite !== "all"
                  ? "Try adjusting your filters"
                  : "Certificates will appear here when training is completed."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Certificate Date</TableHead>
                  <TableHead>Renewal Date</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCertificates.map((cert) => (
                  <TableRow key={cert.id} data-testid={`row-certificate-${cert.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-600" />
                        <div>
                          <div className="font-medium">
                            {cert.trainingCourseTitle || cert.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {cert.fileName}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                        {cert.trainingCourseCode || "-"}
                      </code>
                    </TableCell>
                    <TableCell>
                      {cert.trainingDate ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(new Date(cert.trainingDate), "dd MMM yyyy")}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {cert.renewalDate ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(new Date(cert.renewalDate), "dd MMM yyyy")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{cert.siteName}</div>
                        {isAdminOrConsultant && cert.companyName && (
                          <div className="text-xs text-muted-foreground">
                            {cert.companyName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(cert)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {cert.fileUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            data-testid={`button-download-${cert.id}`}
                          >
                            <a
                              href={`${cert.fileUrl}?download=${encodeURIComponent(cert.fileName)}`}
                              download={cert.fileName}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewDialog(cert)}
                          data-testid={`button-view-${cert.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        Showing {filteredCertificates.length} certificate{filteredCertificates.length !== 1 ? "s" : ""}
      </div>

      {/* View Certificate Dialog */}
      {viewDialog && (
        <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-purple-600" />
                Certificate Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-sm">
                <Label className="text-muted-foreground w-28 shrink-0">Course:</Label>
                <span className="font-medium">{viewDialog.trainingCourseTitle || viewDialog.title}</span>
              </div>

              {viewDialog.trainingCourseCode && (
                <div className="flex items-center gap-2 text-sm">
                  <Label className="text-muted-foreground w-28 shrink-0">Course Code:</Label>
                  <code className="bg-muted px-2 py-1 rounded text-sm">{viewDialog.trainingCourseCode}</code>
                </div>
              )}

              {viewDialog.siteName && (
                <div className="flex items-center gap-2 text-sm">
                  <Label className="text-muted-foreground w-28 shrink-0">Site:</Label>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{viewDialog.siteName}</span>
                  </div>
                </div>
              )}

              {isAdminOrConsultant && viewDialog.companyName && (
                <div className="flex items-center gap-2 text-sm">
                  <Label className="text-muted-foreground w-28 shrink-0">Company:</Label>
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{viewDialog.companyName}</span>
                  </div>
                </div>
              )}

              {viewDialog.trainingDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Label className="text-muted-foreground w-28 shrink-0">Certificate Date:</Label>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(viewDialog.trainingDate), "dd MMMM yyyy")}</span>
                  </div>
                </div>
              )}

              {viewDialog.renewalDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Label className="text-muted-foreground w-28 shrink-0">Renewal Date:</Label>
                  <div className="flex items-center gap-1">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(viewDialog.renewalDate), "dd MMMM yyyy")}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Label className="text-muted-foreground w-28 shrink-0">Status:</Label>
                {getStatusBadge(viewDialog)}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Label className="text-muted-foreground w-28 shrink-0">File:</Label>
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{viewDialog.fileName}</span>
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-wrap gap-2">
              {viewDialog.fileUrl && (
                <Button asChild data-testid="button-dialog-download">
                  <a
                    href={`${viewDialog.fileUrl}?download=${encodeURIComponent(viewDialog.fileName)}`}
                    download={viewDialog.fileName}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              )}
              <Button variant="ghost" onClick={() => setViewDialog(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  );
}
