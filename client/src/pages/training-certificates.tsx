import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  GraduationCap,
  Upload,
  Search,
  FileText,
  Calendar,
  RefreshCw,
  Building2,
  MapPin,
  Download,
  Eye,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { Document, Site } from "@shared/schema";

interface CertificateWithDetails extends Document {
  siteName?: string;
  companyName?: string;
}

interface SiteWithCompany extends Site {
  companyName?: string | null;
}

export default function TrainingCertificates() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedSite, setSelectedSite] = useState<string>("all");

  const isAdminOrConsultant = user?.role === "admin" || user?.role === "consultant";

  const { data: sites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents/module/training"],
  });

  const certificates: CertificateWithDetails[] = (documents || [])
    .filter((doc) => doc.type === "training_certificate")
    .map((doc) => {
      const site = sites?.find((s) => s.id === doc.siteId);
      return {
        ...doc,
        siteName: site?.name,
        companyName: site?.companyName || undefined,
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

    const matchesCompany =
      selectedCompany === "all" || cert.companyName === selectedCompany;

    const matchesSite = selectedSite === "all" || cert.siteId === selectedSite;

    return matchesSearch && matchesCompany && matchesSite;
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
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <GraduationCap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Training Certificates</h1>
            <p className="text-muted-foreground">
              Manage training certificates and track renewals
            </p>
          </div>
        </div>

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
              <>
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
              </>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading certificates...
            </div>
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
                        <Link href={`/training/certificates/${cert.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-view-${cert.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
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
    </div>
  );
}
