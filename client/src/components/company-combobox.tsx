import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SiteWithCompany {
  id: string;
  name: string;
  companyName?: string | null;
  companySearchTag?: string | null;
}

interface CompanyComboboxProps {
  sites?: SiteWithCompany[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  includeAllOption?: boolean;
  testId?: string;
}

export function CompanyCombobox({
  sites = [],
  value,
  onValueChange,
  placeholder = "Select company...",
  className,
  includeAllOption = true,
  testId,
}: CompanyComboboxProps) {
  const [open, setOpen] = useState(false);

  const companies = useMemo(() => {
    const companyMap = new Map<string, string>();
    sites.forEach((site) => {
      if (site.companyName && !companyMap.has(site.companyName)) {
        companyMap.set(site.companyName, site.companySearchTag || "");
      }
    });
    return Array.from(companyMap.entries())
      .map(([name, searchTag]) => ({ name, searchTag }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sites]);

  const displayValue = !value || value === "all"
    ? "All Companies"
    : value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          data-testid={testId}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search companies..." />
          <CommandList>
            <CommandEmpty>No company found.</CommandEmpty>
            <CommandGroup>
              {includeAllOption && (
                <CommandItem
                  value="all-companies"
                  onSelect={() => {
                    onValueChange("all");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      (!value || value === "all") ? "opacity-100" : "opacity-0"
                    )}
                  />
                  All Companies
                </CommandItem>
              )}
              {companies.map((company) => (
                <CommandItem
                  key={company.name}
                  value={company.searchTag ? `${company.name} ${company.searchTag}` : company.name}
                  onSelect={() => {
                    onValueChange(company.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === company.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {company.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
