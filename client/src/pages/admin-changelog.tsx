import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, History, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import ChangelogSection from "@/components/changelog-section";

export default function AdminChangelog() {
  const { user } = useAuth();

  if (!user || user.role !== "developer") {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This section is restricted to developers only.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 px-8 py-6 bg-background border-b">
        <div className="flex items-center gap-4">
          <Link href="/developer-reports">
            <Button variant="outline" size="sm" data-testid="button-back-admin-reports">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Developer Reports
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold flex items-center gap-2">
              <History className="h-7 w-7" />
              Changelog / Release Notes
            </h1>
            <p className="mt-1 text-muted-foreground">
              Track software changes by version. Patch versions are auto-incremented on each deployment; minor and major versions are created manually.
            </p>
          </div>
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-6 dash-animate">
        <Card>
          <CardContent className="p-6">
            <ChangelogSection />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
