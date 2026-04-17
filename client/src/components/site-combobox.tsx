import { useState } from "react";
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

interface SiteOption {
  id: string;
  name: string;
}

interface SiteComboboxProps {
  sites: SiteOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  includeAllOption?: boolean;
  testId?: string;
  disabled?: boolean;
}

export function SiteCombobox({
  sites,
  value,
  onValueChange,
  placeholder = "Select site...",
  className,
  includeAllOption = true,
  testId,
  disabled = false,
}: SiteComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedSite = value === "all" || !value 
    ? null 
    : sites.find((e) => e.id === value);
  
  const displayValue = disabled
    ? "Select a company first"
    : value === "all" || !value
      ? "All Sites"
      : selectedSite?.name || placeholder;

  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={disabled ? false : open}
          disabled={disabled}
          className={cn("justify-between", disabled && "opacity-50 cursor-not-allowed", className)}
          data-testid={testId}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search sites..." />
          <CommandList>
            <CommandEmpty>No site found.</CommandEmpty>
            <CommandGroup>
              {includeAllOption && (
                <CommandItem
                  value="all-sites"
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
                  All Sites
                </CommandItem>
              )}
              {sites.map((site) => (
                <CommandItem
                  key={site.id}
                  value={site.name}
                  onSelect={() => {
                    onValueChange(site.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === site.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {site.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
