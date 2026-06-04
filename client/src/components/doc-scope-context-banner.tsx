import { useState } from "react";
import { Building2, MapPin, Layers, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ScopeItem {
  id: string;
  name: string;
}

interface DocScopeContextBannerProps {
  docScope: "site" | "company" | "group";
  entityName?: string;
  siteObjects?: ScopeItem[];
  companySites?: ScopeItem[];
  groupMemberCompanies?: ScopeItem[];
}

const COLLAPSE_THRESHOLD = 4;

export function DocScopeContextBanner({
  docScope,
  entityName,
  siteObjects = [],
  companySites = [],
  groupMemberCompanies = [],
}: DocScopeContextBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (docScope === "site") {
    const companyName = siteObjects[0]
      ? (siteObjects[0] as any).companyName ?? entityName
      : entityName;
    const multipleSites = siteObjects.length > 1;
    const needsExpand = siteObjects.length > COLLAPSE_THRESHOLD;
    const visibleSites = needsExpand && !expanded ? siteObjects.slice(0, COLLAPSE_THRESHOLD) : siteObjects;

    return (
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 font-medium">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {companyName || "—"}
          </span>
          {!multipleSites && siteObjects[0] && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {siteObjects[0].name}
              </span>
            </>
          )}
          {multipleSites && (
            <Badge variant="secondary" className="text-xs font-normal">
              {siteObjects.length} sites
            </Badge>
          )}
        </div>
        {multipleSites && (
          <div className="space-y-1">
            {visibleSites.map(s => (
              <div key={s.id} className="flex items-center gap-1.5 text-muted-foreground pl-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {s.name}
              </div>
            ))}
            {needsExpand && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-xs text-muted-foreground"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? (
                  <><ChevronUp className="h-3 w-3 mr-1" />Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3 mr-1" />Show {siteObjects.length - COLLAPSE_THRESHOLD} more</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (docScope === "company") {
    const needsExpand = companySites.length > COLLAPSE_THRESHOLD;
    const visibleSites = needsExpand && !expanded ? companySites.slice(0, COLLAPSE_THRESHOLD) : companySites;
    return (
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 font-medium">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {entityName || "—"}
          </span>
          <span className="text-muted-foreground">·</span>
          <Badge variant="outline" className="text-xs font-normal border-blue-400/60 text-blue-600 dark:text-blue-400">
            Company Level
          </Badge>
        </div>
        {companySites.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Applies to {companySites.length} {companySites.length === 1 ? "site" : "sites"}:
            </p>
            {visibleSites.map(s => (
              <div key={s.id} className="flex items-center gap-1.5 text-muted-foreground pl-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {s.name}
              </div>
            ))}
            {needsExpand && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-xs text-muted-foreground"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? (
                  <><ChevronUp className="h-3 w-3 mr-1" />Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3 mr-1" />Show {companySites.length - COLLAPSE_THRESHOLD} more</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (docScope === "group") {
    const needsExpand = groupMemberCompanies.length > COLLAPSE_THRESHOLD;
    const visible = needsExpand && !expanded ? groupMemberCompanies.slice(0, COLLAPSE_THRESHOLD) : groupMemberCompanies;
    return (
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 font-medium">
            <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {entityName || "—"}
          </span>
          <span className="text-muted-foreground">·</span>
          <Badge variant="outline" className="text-xs font-normal border-indigo-400/60 text-indigo-600 dark:text-indigo-400">
            Group Level
          </Badge>
        </div>
        {groupMemberCompanies.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Applies to {groupMemberCompanies.length} {groupMemberCompanies.length === 1 ? "company" : "companies"}:
            </p>
            {visible.map(c => (
              <div key={c.id} className="flex items-center gap-1.5 text-muted-foreground pl-1">
                <Building2 className="h-3 w-3 shrink-0" />
                {c.name}
              </div>
            ))}
            {needsExpand && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-xs text-muted-foreground"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? (
                  <><ChevronUp className="h-3 w-3 mr-1" />Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3 mr-1" />Show {groupMemberCompanies.length - COLLAPSE_THRESHOLD} more</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
