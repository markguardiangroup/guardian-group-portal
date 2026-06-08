import { Link, useLocation, useSearch } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";

const routeLabels: Record<string, string> = {
  "": "Overview",
  "health-safety": "Health & Safety",
  "human-resources": "Human Resources",
  "employment-law": "Employment Law",
  "documents": "Documents",
  "upload": "Upload",
  "companies": "Companies",
  "sites": "Sites",
  "reports": "Reports",
  "developer-reports": "Developer Reports",
  "support": "Support",
  "settings": "Settings",
  "users": "User Management",
  "template-library": "Template Library",
  "training-library": "Training Library",
  "training": "Training",
  "home": "Home",
  "dashboard": "Dashboard",
  "admin": "Developer",
  "portal-messages": "Portal Messages",
  "my-training": "My Training",
  "certificates": "Certificates",
  "create-from-template": "Create from Template",
  "roadmap": "Development Roadmap",
  "help": "Help Guide",
  "cases": "Cases",
};

function isIdSegment(segment: string): boolean {
  return /^\d+$/.test(segment) || /^[0-9a-f-]{36}$/i.test(segment);
}

function buildCrumbs(
  path: string,
  entityNames: Record<string, string>
): { label: string; href: string }[] {
  const segments = path.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    // Strip any query string from the segment before label lookup
    const bareSegment = segment.split("?")[0];
    if (entityNames[bareSegment]) {
      crumbs.push({ label: entityNames[bareSegment], href: currentPath });
    } else if (isIdSegment(bareSegment)) {
      crumbs.push({ label: "Details", href: currentPath });
    } else {
      const label =
        routeLabels[bareSegment] ||
        bareSegment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      crumbs.push({ label, href: currentPath });
    }
  }
  return crumbs;
}

export function BreadcrumbNav() {
  const [location] = useLocation();
  const searchString = useSearch();
  const queryClient = useQueryClient();

  const entityNames: Record<string, string> = {};

  const companiesData = queryClient.getQueryData<{
    companies: Array<{ id: string; name: string }>;
  }>(["/api/companies"]);
  companiesData?.companies?.forEach((c) => {
    entityNames[c.id] = c.name;
  });

  const sitesData = queryClient.getQueryData<Array<{ id: string; name: string }>>(["/api/sites"]);
  sitesData?.forEach((s) => {
    entityNames[s.id] = s.name;
  });

  if (location === "/") return null;

  const params = new URLSearchParams(searchString);
  let crumbs: { label: string; href: string }[];

  if (location === "/create-from-template") {
    const returnTo = params.get("returnTo");
    if (returnTo) {
      const parentCrumbs = buildCrumbs(returnTo, entityNames);
      crumbs = [
        ...parentCrumbs,
        { label: "Create from Template", href: `/create-from-template?${searchString}` },
      ];
    } else {
      crumbs = buildCrumbs(location, entityNames);
    }
  } else {
    const fromParam = params.get("from");
    if (fromParam) {
      const fromCrumbs = buildCrumbs(fromParam, entityNames);
      const currentSegments = location.split("/").filter(Boolean);
      const lastSegment = currentSegments[currentSegments.length - 1] ?? "";
      const currentLabel = entityNames[lastSegment]
        || (isIdSegment(lastSegment) ? "Details" : routeLabels[lastSegment] || lastSegment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
      crumbs = [
        ...fromCrumbs,
        { label: currentLabel, href: `${location}?from=${encodeURIComponent(fromParam)}` },
      ];
    } else {
      crumbs = buildCrumbs(location, entityNames);
    }
  }

  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumb-nav" className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        href="/"
        className="flex items-center gap-1 hover-elevate rounded px-1.5 py-0.5 text-muted-foreground transition-colors"
        data-testid="breadcrumb-home"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <Fragment key={crumb.href}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[200px]" data-testid="breadcrumb-current">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover-elevate rounded px-1.5 py-0.5 text-muted-foreground transition-colors truncate max-w-[200px]"
                data-testid={`breadcrumb-link-${index}`}
              >
                {crumb.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
