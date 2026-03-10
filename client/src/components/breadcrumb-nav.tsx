import { Link, useLocation, useSearch } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

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
  "admin-reports": "Admin Reports",
  "support": "Support",
  "settings": "Settings",
  "users": "User Management",
  "template-library": "Template Library",
  "training-library": "Training Library",
  "training": "Training",
  "dashboard": "Dashboard",
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

function buildCrumbs(path: string): { label: string; href: string }[] {
  const segments = path.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    if (isIdSegment(segment)) {
      crumbs.push({ label: "Details", href: currentPath });
    } else {
      const label = routeLabels[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      crumbs.push({ label, href: currentPath });
    }
  }
  return crumbs;
}

export function BreadcrumbNav() {
  const [location] = useLocation();
  const searchString = useSearch();

  if (location === "/") return null;

  let crumbs: { label: string; href: string }[];

  if (location === "/create-from-template") {
    const params = new URLSearchParams(searchString);
    const returnTo = params.get("returnTo");
    if (returnTo) {
      const parentCrumbs = buildCrumbs(returnTo);
      crumbs = [
        ...parentCrumbs,
        { label: "Create from Template", href: `/create-from-template?${searchString}` },
      ];
    } else {
      crumbs = buildCrumbs(location);
    }
  } else {
    crumbs = buildCrumbs(location);
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
              <span className="font-medium text-foreground truncate max-w-[200px]" data-testid={`breadcrumb-current`}>
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
