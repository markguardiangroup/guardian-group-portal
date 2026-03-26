import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Search,
  Plus,
  Calendar,
  Building2,
  User,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  AlertOctagon,
  ShieldAlert,
  MapPin,
  ClipboardList,
  Loader2,
  ArrowLeft,
  MoreVertical,
  RotateCcw,
  FileText,
  Upload,
  Download,
  Trash2,
  Flag,
  Activity,
  Camera,
  ZoomIn,
  X,
  Pencil,
  MessageSquare,
  History,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Shield,
  Eye,
  Filter,
  ImagePlus,
  Paperclip,
  ThumbsUp,
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  TrendingUp,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { PdfViewer } from "@/components/pdf-viewer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompanyCombobox } from "@/components/company-combobox";
import { SiteCombobox } from "@/components/site-combobox";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Incident, IncidentMilestone } from "@shared/schema";

type IncidentSeverity = "minor" | "moderate" | "major" | "critical";
type IncidentStatus = "reported" | "under_review" | "resolved" | "closed";

const INCIDENT_TYPES = [
  "Slip/Trip/Fall",
  "Near Miss",
  "Injury",
  "Hazardous Substance",
  "Fire/Explosion",
  "Equipment Failure",
  "Ergonomic Issue",
  "Violence/Aggression",
  "Property Damage",
  "Environmental Incident",
  "Other",
];

const severityConfig: Record<IncidentSeverity, { label: string; className: string }> = {
  minor: { label: "Minor", className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20" },
  moderate: { label: "Moderate", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  major: { label: "Major", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20" },
  critical: { label: "Critical", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
};

const statusConfig: Record<IncidentStatus, { label: string; icon: typeof AlertTriangle; className: string }> = {
  reported: { label: "Reported", icon: AlertTriangle, className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  under_review: { label: "Under Review", icon: Clock, className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  resolved: { label: "Resolved", icon: CheckCircle, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  closed: { label: "Closed", icon: XCircle, className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20" },
};

const INCIDENT_EFFECTS = [
  "Bone fracture",
  "Amputation",
  "Loss of or reduction of sight",
  "Crush injury leading to brain or organ damage",
  "Serious burns",
  "Scalping requiring hospital treatment",
  "Loss of consciousness caused by head injury or asphyxia",
  "Injury within an enclosed space leading to hypothermia, or heat-induced illness, or resuscitation, or hospitalisation for over 24 hours",
  "Dislocation without fracture",
  "Concussion and/or internal injuries",
  "Lacerations or open wounds",
  "Burns",
  "Contusions and bruising",
  "Asphyxia or poisoning",
  "Strains and sprains",
  "Superficial injuries",
  "Electric shock",
];

const CAUSE_EFFECT_MAP: Record<string, string[]> = {
  "Contact with machinery": [
    "Bone fracture", "Amputation", "Lacerations or open wounds", "Contusions and bruising",
    "Crush injury leading to brain or organ damage", "Dislocation without fracture", "Superficial injuries", "Strains and sprains",
  ],
  "Struck by object": [
    "Bone fracture", "Concussion and/or internal injuries", "Lacerations or open wounds", "Contusions and bruising",
    "Loss of consciousness caused by head injury or asphyxia", "Superficial injuries", "Dislocation without fracture",
  ],
  "Struck by moving vehicle": [
    "Bone fracture", "Crush injury leading to brain or organ damage", "Lacerations or open wounds", "Contusions and bruising",
    "Concussion and/or internal injuries", "Loss of consciousness caused by head injury or asphyxia", "Amputation", "Serious burns",
  ],
  "Struck against a stationary object": [
    "Bone fracture", "Lacerations or open wounds", "Contusions and bruising", "Superficial injuries", "Concussion and/or internal injuries",
  ],
  "Lifting and handling injuries": [
    "Strains and sprains", "Dislocation without fracture", "Bone fracture",
  ],
  "Slip, trip, fall at the same level": [
    "Bone fracture", "Strains and sprains", "Lacerations or open wounds", "Contusions and bruising",
    "Concussion and/or internal injuries", "Superficial injuries", "Dislocation without fracture",
  ],
  "Fall from height": [
    "Bone fracture", "Crush injury leading to brain or organ damage", "Loss of consciousness caused by head injury or asphyxia",
    "Lacerations or open wounds", "Contusions and bruising", "Concussion and/or internal injuries", "Amputation", "Dislocation without fracture",
  ],
  "Trapped by something collapsing": [
    "Bone fracture", "Crush injury leading to brain or organ damage", "Amputation",
    "Loss of consciousness caused by head injury or asphyxia", "Lacerations or open wounds", "Asphyxia or poisoning",
    "Injury within an enclosed space leading to hypothermia, or heat-induced illness, or resuscitation, or hospitalisation for over 24 hours",
  ],
  "Drowned or asphyxiated": [
    "Asphyxia or poisoning", "Loss of consciousness caused by head injury or asphyxia",
    "Injury within an enclosed space leading to hypothermia, or heat-induced illness, or resuscitation, or hospitalisation for over 24 hours",
  ],
  "Exposure to harmful substance": [
    "Asphyxia or poisoning", "Burns", "Serious burns", "Loss of or reduction of sight",
    "Loss of consciousness caused by head injury or asphyxia",
    "Injury within an enclosed space leading to hypothermia, or heat-induced illness, or resuscitation, or hospitalisation for over 24 hours",
  ],
  "Exposed to fire": [
    "Burns", "Serious burns", "Loss of or reduction of sight", "Asphyxia or poisoning",
    "Loss of consciousness caused by head injury or asphyxia", "Scalping requiring hospital treatment", "Lacerations or open wounds",
  ],
  "Exposed to explosion": [
    "Burns", "Serious burns", "Bone fracture", "Loss of or reduction of sight",
    "Loss of consciousness caused by head injury or asphyxia", "Lacerations or open wounds", "Concussion and/or internal injuries", "Amputation",
  ],
  "Contact with electricity": [
    "Electric shock", "Burns", "Serious burns", "Loss of consciousness caused by head injury or asphyxia", "Bone fracture",
  ],
  "Injured by an animal": [
    "Lacerations or open wounds", "Contusions and bruising", "Strains and sprains", "Bone fracture", "Superficial injuries",
  ],
  "Physical assault": [
    "Bone fracture", "Lacerations or open wounds", "Contusions and bruising", "Concussion and/or internal injuries",
    "Loss of consciousness caused by head injury or asphyxia", "Strains and sprains", "Superficial injuries",
  ],
  "Environment": [
    "Strains and sprains", "Contusions and bruising", "Bone fracture", "Loss of consciousness caused by head injury or asphyxia",
    "Asphyxia or poisoning",
    "Injury within an enclosed space leading to hypothermia, or heat-induced illness, or resuscitation, or hospitalisation for over 24 hours",
  ],
  "Dangerous occurrence (RIDDOR)": INCIDENT_EFFECTS,
  "Other": INCIDENT_EFFECTS,
};

const INCIDENT_CAUSES = Object.keys(CAUSE_EFFECT_MAP);

const BODY_ZONES_FRONT = [
  { id: "head", label: "Head", shape: "circle", cx: 60, cy: 24, r: 20 },
  { id: "neck", label: "Neck", shape: "rect", x: 54, y: 44, w: 12, h: 17, rx: 4 },
  { id: "l-shoulder", label: "L Shoulder", shape: "ellipse", cx: 20, cy: 62, rx: 14, ry: 12 },
  { id: "r-shoulder", label: "R Shoulder", shape: "ellipse", cx: 100, cy: 62, rx: 14, ry: 12 },
  { id: "chest", label: "Chest", shape: "rect", x: 34, y: 58, w: 52, h: 42, rx: 4 },
  { id: "abdomen", label: "Abdomen", shape: "rect", x: 34, y: 100, w: 52, h: 40, rx: 4 },
  { id: "l-upper-arm", label: "L Upper Arm", shape: "rect", x: 6, y: 74, w: 18, h: 44, rx: 7 },
  { id: "r-upper-arm", label: "R Upper Arm", shape: "rect", x: 96, y: 74, w: 18, h: 44, rx: 7 },
  { id: "l-forearm", label: "L Forearm", shape: "rect", x: 5, y: 118, w: 17, h: 42, rx: 6 },
  { id: "r-forearm", label: "R Forearm", shape: "rect", x: 98, y: 118, w: 17, h: 42, rx: 6 },
  { id: "l-hand", label: "L Hand", shape: "ellipse", cx: 13, cy: 167, rx: 12, ry: 11 },
  { id: "r-hand", label: "R Hand", shape: "ellipse", cx: 107, cy: 167, rx: 12, ry: 11 },
  { id: "l-hip", label: "L Hip", shape: "rect", x: 32, y: 140, w: 24, h: 28, rx: 5 },
  { id: "r-hip", label: "R Hip", shape: "rect", x: 64, y: 140, w: 24, h: 28, rx: 5 },
  { id: "l-thigh", label: "L Thigh", shape: "rect", x: 33, y: 168, w: 22, h: 52, rx: 7 },
  { id: "r-thigh", label: "R Thigh", shape: "rect", x: 65, y: 168, w: 22, h: 52, rx: 7 },
  { id: "l-knee", label: "L Knee", shape: "ellipse", cx: 43, cy: 224, rx: 14, ry: 10 },
  { id: "r-knee", label: "R Knee", shape: "ellipse", cx: 77, cy: 224, rx: 14, ry: 10 },
  { id: "l-lower-leg", label: "L Lower Leg", shape: "rect", x: 33, y: 234, w: 20, h: 50, rx: 6 },
  { id: "r-lower-leg", label: "R Lower Leg", shape: "rect", x: 67, y: 234, w: 20, h: 50, rx: 6 },
  { id: "l-foot", label: "L Foot", shape: "ellipse", cx: 41, cy: 292, rx: 18, ry: 9 },
  { id: "r-foot", label: "R Foot", shape: "ellipse", cx: 79, cy: 292, rx: 18, ry: 9 },
];

const BODY_ZONES_BACK = [
  { id: "head-b", label: "Head (Back)", shape: "circle", cx: 60, cy: 24, r: 20 },
  { id: "neck-b", label: "Neck (Back)", shape: "rect", x: 54, y: 44, w: 12, h: 17, rx: 4 },
  { id: "l-shoulder-b", label: "L Shoulder (Back)", shape: "ellipse", cx: 20, cy: 62, rx: 14, ry: 12 },
  { id: "r-shoulder-b", label: "R Shoulder (Back)", shape: "ellipse", cx: 100, cy: 62, rx: 14, ry: 12 },
  { id: "upper-back", label: "Upper Back", shape: "rect", x: 34, y: 58, w: 52, h: 42, rx: 4 },
  { id: "lower-back", label: "Lower Back", shape: "rect", x: 34, y: 100, w: 52, h: 40, rx: 4 },
  { id: "l-upper-arm-b", label: "L Upper Arm (Back)", shape: "rect", x: 6, y: 74, w: 18, h: 44, rx: 7 },
  { id: "r-upper-arm-b", label: "R Upper Arm (Back)", shape: "rect", x: 96, y: 74, w: 18, h: 44, rx: 7 },
  { id: "l-forearm-b", label: "L Forearm (Back)", shape: "rect", x: 5, y: 118, w: 17, h: 42, rx: 6 },
  { id: "r-forearm-b", label: "R Forearm (Back)", shape: "rect", x: 98, y: 118, w: 17, h: 42, rx: 6 },
  { id: "l-hand-b", label: "L Hand (Back)", shape: "ellipse", cx: 13, cy: 167, rx: 12, ry: 11 },
  { id: "r-hand-b", label: "R Hand (Back)", shape: "ellipse", cx: 107, cy: 167, rx: 12, ry: 11 },
  { id: "l-buttock", label: "L Buttock", shape: "rect", x: 32, y: 140, w: 24, h: 28, rx: 5 },
  { id: "r-buttock", label: "R Buttock", shape: "rect", x: 64, y: 140, w: 24, h: 28, rx: 5 },
  { id: "l-hamstring", label: "L Hamstring", shape: "rect", x: 33, y: 168, w: 22, h: 52, rx: 7 },
  { id: "r-hamstring", label: "R Hamstring", shape: "rect", x: 65, y: 168, w: 22, h: 52, rx: 7 },
  { id: "l-knee-b", label: "L Knee (Back)", shape: "ellipse", cx: 43, cy: 224, rx: 14, ry: 10 },
  { id: "r-knee-b", label: "R Knee (Back)", shape: "ellipse", cx: 77, cy: 224, rx: 14, ry: 10 },
  { id: "l-calf", label: "L Calf", shape: "rect", x: 33, y: 234, w: 20, h: 50, rx: 6 },
  { id: "r-calf", label: "R Calf", shape: "rect", x: 67, y: 234, w: 20, h: 50, rx: 6 },
  { id: "l-foot-b", label: "L Foot (Back)", shape: "ellipse", cx: 41, cy: 292, rx: 18, ry: 9 },
  { id: "r-foot-b", label: "R Foot (Back)", shape: "ellipse", cx: 79, cy: 292, rx: 18, ry: 9 },
];

const ALL_BODY_ZONES = [...BODY_ZONES_FRONT, ...BODY_ZONES_BACK];

function BodyDiagramViewer({ selected }: { selected: string[] }) {
  const getFill = (id: string) => selected.includes(id) ? "#ef4444" : "#fde68a";
  const getStroke = (id: string) => selected.includes(id) ? "#b91c1c" : "#d97706";
  const baseStyle = { strokeWidth: 1.5 };

  const renderZones = (zones: typeof BODY_ZONES_FRONT) =>
    zones.map(zone => {
      const fill = getFill(zone.id);
      const stroke = getStroke(zone.id);
      const props = { key: zone.id, fill, stroke, style: baseStyle };
      if (zone.shape === "circle") return <circle {...props} cx={(zone as any).cx} cy={(zone as any).cy} r={(zone as any).r}><title>{zone.label}</title></circle>;
      if (zone.shape === "ellipse") return <ellipse {...props} cx={(zone as any).cx} cy={(zone as any).cy} rx={(zone as any).rx} ry={(zone as any).ry}><title>{zone.label}</title></ellipse>;
      return <rect {...props} x={(zone as any).x} y={(zone as any).y} width={(zone as any).w} height={(zone as any).h} rx={(zone as any).rx}><title>{zone.label}</title></rect>;
    });

  return (
    <div className="flex gap-6 items-start">
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Front</span>
        <svg viewBox="0 0 120 308" className="w-24 h-auto">
          {renderZones(BODY_ZONES_FRONT)}
          <text x="18" y="304" fontSize="7" fill="#6b7280" textAnchor="middle">L</text>
          <text x="102" y="304" fontSize="7" fill="#6b7280" textAnchor="middle">R</text>
        </svg>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Back</span>
        <svg viewBox="0 0 120 308" className="w-24 h-auto">
          {renderZones(BODY_ZONES_BACK)}
          <text x="18" y="304" fontSize="7" fill="#6b7280" textAnchor="middle">L</text>
          <text x="102" y="304" fontSize="7" fill="#6b7280" textAnchor="middle">R</text>
        </svg>
      </div>
    </div>
  );
}

function BodyDiagramSelector({ selected, onChange }: { selected: string[]; onChange: (zones: string[]) => void }) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(z => z !== id) : [...selected, id]);
  };

  const baseStyle = { cursor: "pointer", strokeWidth: 1.5, transition: "fill 0.15s" };
  const getFill = (id: string) => selected.includes(id) ? "#ef4444" : "#fde68a";
  const getStroke = (id: string) => selected.includes(id) ? "#b91c1c" : "#d97706";

  const renderZones = (zones: typeof BODY_ZONES_FRONT) =>
    zones.map(zone => {
      const fill = getFill(zone.id);
      const stroke = getStroke(zone.id);
      const props = { key: zone.id, fill, stroke, style: baseStyle, onClick: () => toggle(zone.id) };
      if (zone.shape === "circle") return <circle {...props} cx={(zone as any).cx} cy={(zone as any).cy} r={(zone as any).r}><title>{zone.label}</title></circle>;
      if (zone.shape === "ellipse") return <ellipse {...props} cx={(zone as any).cx} cy={(zone as any).cy} rx={(zone as any).rx} ry={(zone as any).ry}><title>{zone.label}</title></ellipse>;
      return <rect {...props} x={(zone as any).x} y={(zone as any).y} width={(zone as any).w} height={(zone as any).h} rx={(zone as any).rx}><title>{zone.label}</title></rect>;
    });

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-6 items-start">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Front</span>
          <svg viewBox="0 0 120 308" className="w-28 h-auto" style={{ userSelect: "none" }}>
            {renderZones(BODY_ZONES_FRONT)}
            <text x="18" y="304" fontSize="7" fill="#6b7280" textAnchor="middle">L</text>
            <text x="102" y="304" fontSize="7" fill="#6b7280" textAnchor="middle">R</text>
          </svg>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Back</span>
          <svg viewBox="0 0 120 308" className="w-28 h-auto" style={{ userSelect: "none" }}>
            {renderZones(BODY_ZONES_BACK)}
            <text x="18" y="304" fontSize="7" fill="#6b7280" textAnchor="middle">L</text>
            <text x="102" y="304" fontSize="7" fill="#6b7280" textAnchor="middle">R</text>
          </svg>
        </div>
      </div>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1 justify-center max-w-[300px]">
          {selected.map(id => (
            <span key={id} className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded px-1.5 py-0.5">
              {ALL_BODY_ZONES.find(z => z.id === id)?.label}
              <button type="button" onClick={() => toggle(id)} className="hover:text-red-900"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Click areas on either diagram to mark injuries</p>
      )}
    </div>
  );
}

function MultiSelectCombobox({ options, selected, onChange, placeholder, filtered }: {
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder: string;
  filtered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt]);
  };

  const visibleOptions = search.trim()
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? selected[0].length > 40 ? selected[0].substring(0, 40) + "…" : selected[0]
      : `${selected.length} selected`;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-left h-auto min-h-9 py-2 px-3"
          >
            <span className={`truncate text-sm ${selected.length === 0 ? "text-muted-foreground" : "text-foreground"}`}>
              {label}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          onWheel={(e) => e.stopPropagation()}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search…"
              className="h-9"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-56 overflow-y-auto">
              {visibleOptions.length === 0 && <CommandEmpty>No options found.</CommandEmpty>}
              <CommandGroup>
                {visibleOptions.map(opt => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => toggle(opt)}
                    className="cursor-pointer"
                  >
                    <Check className={`mr-2 h-4 w-4 shrink-0 ${selected.includes(opt) ? "opacity-100 text-module-accent" : "opacity-0"}`} />
                    <span className="text-sm leading-snug">{opt}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="border-t p-2">
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => { setOpen(false); setSearch(""); }}
              >
                Done{selected.length > 0 ? ` (${selected.length} selected)` : ""}
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(opt => (
            <span key={opt} className="inline-flex items-center gap-1 text-xs bg-module-accent/10 text-module-accent border border-module-accent/20 rounded-full px-2.5 py-1 max-w-[280px]">
              <span className="truncate">{opt}</span>
              <button type="button" onClick={() => toggle(opt)} className="shrink-0 hover:text-destructive ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const reportSchema = z.object({
  title: z.string().optional().default(""),
  description: z.string().min(10, "Description must be at least 10 characters"),
  incidentNature: z.string().optional(),
  incidentType: z.string().min(1, "Please select an incident type"),
  severity: z.enum(["minor", "moderate", "major", "critical"]),
  siteId: z.string().min(1, "Please select a site"),
  entityId: z.string().min(1, "Company is required"),
  incidentDate: z.string().min(1, "Incident date is required"),
  incidentTime: z.string().optional(),
  locationDetails: z.string().optional(),
  machineryInvolved: z.string().optional(),
  incidentCause: z.array(z.string()).optional(),
  incidentEffect: z.array(z.string()).optional(),
  affectedPersonName: z.string().optional(),
  affectedPersonAddress: z.string().optional(),
  affectedPersonJobTitle: z.string().optional(),
  affectedPersonIsPublic: z.boolean().default(false),
  reportingPersonName: z.string().optional(),
  reportingPersonAddress: z.string().optional(),
  reportingPersonJobTitle: z.string().optional(),
  bodyDiagramMarkers: z.string().optional(),
  witnesses: z.string().optional(),
  injuriesReported: z.boolean().default(false),
  injuryDetails: z.string().optional(),
  immediateActions: z.string().optional(),
  recommendations: z.string().optional(),
  riddorReportable: z.boolean().default(false),
  riddorResponsiblePerson: z.string().optional(),
  declarationName: z.string().optional(),
  declarationSignature: z.string().optional(),
  declarationDate: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b pb-2">{title}</p>
      {children}
    </div>
  );
}

// ─── Report Incident Dialog ───────────────────────────────────────────────────

function ReportIncidentDialog({
  open,
  onClose,
  sites,
  companies,
  userRole,
  userCompanyId,
}: {
  open: boolean;
  onClose: () => void;
  sites: any[];
  companies: any[];
  userRole: string;
  userCompanyId: string | null;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [selectedCauses, setSelectedCauses] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [bodyZones, setBodyZones] = useState<string[]>([]);

  const today = new Date().toISOString().split("T")[0];

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      title: "",
      description: "",
      incidentNature: "",
      incidentType: "",
      severity: "minor",
      siteId: "",
      entityId: userRole === "client" && userCompanyId ? userCompanyId : "",
      incidentDate: today,
      incidentTime: "",
      locationDetails: "",
      machineryInvolved: "",
      incidentCause: [],
      incidentEffect: [],
      affectedPersonName: "",
      affectedPersonAddress: "",
      affectedPersonJobTitle: "",
      affectedPersonIsPublic: false,
      reportingPersonName: "",
      reportingPersonAddress: "",
      reportingPersonJobTitle: "",
      bodyDiagramMarkers: "",
      witnesses: "",
      injuriesReported: false,
      injuryDetails: "",
      immediateActions: "",
      recommendations: "",
      riddorReportable: false,
      riddorResponsiblePerson: "",
      declarationName: "",
      declarationSignature: "",
      declarationDate: today,
    },
  });

  useEffect(() => {
    if (bodyZones.length > 0) {
      form.setValue("injuriesReported", true);
    }
  }, [bodyZones]);

  const watchEntityId = form.watch("entityId");
  const watchInjuries = form.watch("injuriesReported");
  const watchRiddor = form.watch("riddorReportable");
  const watchAffectedIsPublic = form.watch("affectedPersonIsPublic");

  const filteredEffects = useMemo(() => {
    if (selectedCauses.length === 0) return INCIDENT_EFFECTS;
    const linked = new Set<string>();
    selectedCauses.forEach(cause => {
      (CAUSE_EFFECT_MAP[cause] ?? []).forEach(e => linked.add(e));
    });
    return INCIDENT_EFFECTS.filter(e => linked.has(e));
  }, [selectedCauses]);

  useEffect(() => {
    if (selectedCauses.length > 0) {
      setSelectedEffects(prev => prev.filter(e => filteredEffects.includes(e)));
    }
  }, [filteredEffects]);

  const filteredSites = sites.filter(s =>
    watchEntityId ? s.entityId === watchEntityId || s.companyId === watchEntityId : true
  );

  const uploadFileToIncident = async (file: File, incidentId: string): Promise<string> => {
    const response = await fetch(`/api/incidents/${incidentId}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-file-name": encodeURIComponent(file.name),
      },
      body: file,
      credentials: "include",
    });
    if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
    const result = await response.json();
    return result.fileUrl as string;
  };

  const mutation = useMutation({
    mutationFn: async (data: ReportFormValues) => {
      const res = await apiRequest("POST", "/api/incidents", {
        ...data,
        incidentDate: new Date(data.incidentDate).toISOString(),
        incidentCause: selectedCauses,
        incidentEffect: selectedEffects,
        bodyDiagramMarkers: bodyZones.length > 0 ? JSON.stringify(bodyZones) : null,
      });
      const incident = await res.json();
      const incidentId = incident.id;

      const imageUrls: string[] = [];
      for (const photo of photoFiles) {
        const fileUrl = await uploadFileToIncident(photo, incidentId);
        imageUrls.push(fileUrl);
      }
      for (const doc of docFiles) {
        await uploadFileToIncident(doc, incidentId);
      }
      if (imageUrls.length > 0) {
        await fetch(`/api/incidents/${incidentId}/regenerate-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrls }),
          credentials: "include",
        });
      }
      return incident;
    },
    onSuccess: (incident: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({ title: "Incident reported", description: "The incident has been recorded successfully." });
      form.reset();
      setPhotoFiles([]);
      setDocFiles([]);
      setSelectedCauses([]);
      setSelectedEffects([]);
      setBodyZones([]);
      onClose();
      if (incident?.id) navigate(`/health-safety/incidents/${incident.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to report incident.", variant: "destructive" });
    },
  });

  const onSubmit = (values: ReportFormValues) => {
    const dateStr = format(new Date(values.incidentDate), "dd/MM/yyyy");
    const causeLabel = selectedCauses.length === 0
      ? "Incident"
      : selectedCauses.length === 1
        ? selectedCauses[0]
        : `${selectedCauses[0]} (+${selectedCauses.length - 1} more)`;
    const autoTitle = `${causeLabel} – ${dateStr}`;
    mutation.mutate({ ...values, title: autoTitle });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-module-accent" />
            Report Incident
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Please complete all relevant sections as accurately as possible.</p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* ── Section 1: Incident Overview ── */}
            <FormSection title="Incident Overview">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="incidentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-incident-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="severity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-severity"><SelectValue placeholder="Select severity" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className={`grid gap-4 ${userRole !== "client" ? "grid-cols-2" : "grid-cols-1"}`}>
                {userRole !== "client" && (
                  <FormField control={form.control} name="entityId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company *</FormLabel>
                      <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("siteId", ""); }}>
                        <FormControl>
                          <SelectTrigger data-testid="select-company"><SelectValue placeholder="Select company" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <FormField control={form.control} name="siteId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site *</FormLabel>
                    <Select value={field.value} onValueChange={(v) => {
                      field.onChange(v);
                      const site = sites.find((s: any) => s.id === v);
                      if (site) form.setValue("entityId", site.entityId || site.companyId || "");
                    }}>
                      <FormControl>
                        <SelectTrigger data-testid="select-site"><SelectValue placeholder="Select site" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredSites.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="incidentDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Accident *</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-incident-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="incidentTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time of Accident</FormLabel>
                    <FormControl><Input type="time" {...field} data-testid="input-incident-time" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="locationDetails" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Details</FormLabel>
                  <FormControl><Input placeholder="Specific location within the site where the incident occurred" {...field} data-testid="input-location" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="machineryInvolved" render={({ field }) => (
                <FormItem>
                  <FormLabel>Machinery / Equipment / Others Involved</FormLabel>
                  <FormControl><Input placeholder="Name any machinery, equipment or third parties involved" {...field} data-testid="input-machinery" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </FormSection>

            {/* ── Section 2: Description of Incident ── */}
            <FormSection title="Description of Incident">
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>What happened — description & cause *</FormLabel>
                  <FormControl><Textarea placeholder="Describe the sequence of events, what happened and the cause of the incident..." className="resize-none" rows={4} {...field} data-testid="textarea-description" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </FormSection>

            {/* ── Section 3: Cause ── */}
            <FormSection title="Cause">
              <p className="text-xs text-muted-foreground -mt-2">Select all causes that apply — this will filter the available effects below</p>
              <MultiSelectCombobox
                options={INCIDENT_CAUSES}
                selected={selectedCauses}
                onChange={setSelectedCauses}
                placeholder="Select cause(s)…"
              />
            </FormSection>

            {/* ── Section 4: Effect / Affect ── */}
            <FormSection title="Effect / Affect">
              {selectedCauses.length > 0 ? (
                <p className="text-xs text-muted-foreground -mt-2">
                  Showing <span className="font-medium text-foreground">{filteredEffects.length}</span> suggested effects based on selected cause{selectedCauses.length > 1 ? "s" : ""}.
                  {filteredEffects.length < INCIDENT_EFFECTS.length && (
                    <button type="button" className="ml-1 underline hover:text-foreground" onClick={() => setSelectedCauses([])}>
                      Clear causes to see all effects
                    </button>
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground -mt-2">Select a cause above to filter this list, or choose from all effects</p>
              )}
              <MultiSelectCombobox
                options={filteredEffects}
                selected={selectedEffects}
                onChange={setSelectedEffects}
                placeholder="Select effect(s)…"
                filtered={selectedCauses.length > 0}
              />
            </FormSection>

            {/* ── Section 5: Affected / Injured Person ── */}
            <FormSection title="Affected / Injured Person">
              <FormField control={form.control} name="affectedPersonIsPublic" render={({ field }) => (
                <FormItem>
                  <FormLabel>Was the affected / injured person a member of the public?</FormLabel>
                  <div className="flex gap-3 mt-1.5">
                    <button
                      type="button"
                      onClick={() => field.onChange(true)}
                      className={`px-4 py-1.5 rounded border text-sm font-medium transition-colors ${field.value ? "bg-module-accent text-module-accent-foreground border-module-accent" : "bg-background border-border text-muted-foreground hover:border-module-accent"}`}
                      data-testid="button-affected-public-yes"
                    >Yes</button>
                    <button
                      type="button"
                      onClick={() => field.onChange(false)}
                      className={`px-4 py-1.5 rounded border text-sm font-medium transition-colors ${!field.value ? "bg-module-accent text-module-accent-foreground border-module-accent" : "bg-background border-border text-muted-foreground hover:border-module-accent"}`}
                      data-testid="button-affected-public-no"
                    >No</button>
                  </div>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="affectedPersonName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="Full name of the affected person" {...field} data-testid="input-affected-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="affectedPersonJobTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{watchAffectedIsPublic ? "Role / Occupation" : "Job Title"}</FormLabel>
                    <FormControl><Input placeholder={watchAffectedIsPublic ? "Role or occupation (if known)" : "Job title"} {...field} data-testid="input-affected-jobtitle" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="affectedPersonAddress" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl><Textarea placeholder="Address of the affected person" className="resize-none" rows={2} {...field} data-testid="textarea-affected-address" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </FormSection>

            {/* ── Section 6: Reporting Person ── */}
            <FormSection title="Person Reporting this Incident">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="reportingPersonName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="Full name of the reporting person" {...field} data-testid="input-reporting-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="reportingPersonJobTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl><Input placeholder="Job title" {...field} data-testid="input-reporting-jobtitle" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="reportingPersonAddress" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl><Textarea placeholder="Address of the reporting person" className="resize-none" rows={2} {...field} data-testid="textarea-reporting-address" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </FormSection>

            {/* ── Section 7: Injury Location (Body Diagram) ── */}
            <FormSection title="Injury Location">
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  <p className="text-xs text-muted-foreground mb-2 text-center">Click to mark injured areas</p>
                  <BodyDiagramSelector selected={bodyZones} onChange={setBodyZones} />
                </div>
                <div className="flex-1 space-y-3">
                  <FormField control={form.control} name="injuriesReported" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0 rounded-md border px-3 py-2.5">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-injuries" /></FormControl>
                      <FormLabel className="font-normal cursor-pointer text-sm">Injuries were sustained</FormLabel>
                    </FormItem>
                  )} />
                  {watchInjuries && (
                    <FormField control={form.control} name="injuryDetails" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Injury Details</FormLabel>
                        <FormControl><Textarea placeholder="Describe the injuries in detail..." className="resize-none" rows={4} {...field} data-testid="textarea-injury-details" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              </div>
            </FormSection>

            {/* ── Section 8: Actions & Recommendations ── */}
            <FormSection title="Actions Taken & Recommendations">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="immediateActions" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Immediate Actions Taken</FormLabel>
                    <FormControl><Textarea placeholder="What immediate steps were taken following the incident?" className="resize-none" rows={4} {...field} data-testid="textarea-immediate-actions" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="recommendations" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recommendations</FormLabel>
                    <FormControl><Textarea placeholder="Recommended actions to prevent recurrence..." className="resize-none" rows={4} {...field} data-testid="textarea-recommendations" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </FormSection>

            {/* ── Section 9: RIDDOR ── */}
            <FormSection title="RIDDOR">
              <FormField control={form.control} name="riddorReportable" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-riddor" /></FormControl>
                  <div>
                    <FormLabel className="font-medium cursor-pointer">This incident is RIDDOR reportable</FormLabel>
                    <p className="text-xs text-muted-foreground">Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013</p>
                  </div>
                </FormItem>
              )} />
              {watchRiddor && (
                <FormField control={form.control} name="riddorResponsiblePerson" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsible Person for RIDDOR Report</FormLabel>
                    <FormControl><Input placeholder="Name and job title of person responsible for submitting the RIDDOR report" {...field} data-testid="input-riddor-responsible" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </FormSection>

            {/* ── Section 10: Supporting Evidence ── */}
            <FormSection title="Supporting Evidence">
              {/* Photos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Photos</p>
                    <p className="text-xs text-muted-foreground">Included in the incident report</p>
                  </div>
                  <label className="cursor-pointer" data-testid="label-add-photos">
                    <input type="file" accept="image/*" multiple className="sr-only" data-testid="input-photos"
                      onChange={(e) => { const files = Array.from(e.target.files || []); setPhotoFiles(prev => [...prev, ...files]); e.target.value = ""; }} />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span><ImagePlus className="h-4 w-4 mr-1.5" />Add Photos</span>
                    </Button>
                  </label>
                </div>
                {photoFiles.length > 0 && (
                  <div className="grid grid-cols-5 gap-2">
                    {photoFiles.map((file, i) => (
                      <div key={i} className="relative group aspect-square rounded-md overflow-hidden bg-muted border">
                        <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setPhotoFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-remove-photo-${i}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Documents */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Supporting Documents</p>
                    <p className="text-xs text-muted-foreground">PDFs, Word files, spreadsheets</p>
                  </div>
                  <label className="cursor-pointer" data-testid="label-add-documents">
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" multiple className="sr-only" data-testid="input-documents"
                      onChange={(e) => { const files = Array.from(e.target.files || []); setDocFiles(prev => [...prev, ...files]); e.target.value = ""; }} />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span><Paperclip className="h-4 w-4 mr-1.5" />Add Documents</span>
                    </Button>
                  </label>
                </div>
                {docFiles.length > 0 && (
                  <ul className="space-y-1.5">
                    {docFiles.map((file, i) => (
                      <li key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
                        <span className="flex items-center gap-2 truncate min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span className="truncate">{file.name}</span>
                        </span>
                        <button type="button" onClick={() => setDocFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive ml-2 flex-shrink-0" data-testid={`button-remove-doc-${i}`}>
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </FormSection>

            {/* ── Section 11: Declaration ── */}
            <FormSection title="Declaration">
              <div className="rounded-md bg-muted/40 border px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                I declare that the information given in this report is, to the best of my knowledge and belief, true and complete.
                I understand that it is an offence to make a false statement in connection with the reporting of an injury or dangerous occurrence.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="declarationName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name of Signatory</FormLabel>
                    <FormControl><Input placeholder="Full name" {...field} data-testid="input-declaration-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="declarationDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-declaration-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="declarationSignature" render={({ field }) => (
                <FormItem>
                  <FormLabel>Digital Signature</FormLabel>
                  <p className="text-xs text-muted-foreground">Type your full name below as your digital signature to confirm the declaration above.</p>
                  <FormControl>
                    <Input
                      placeholder="Type your full name to sign"
                      className="font-serif italic text-base"
                      {...field}
                      data-testid="input-declaration-signature"
                    />
                  </FormControl>
                  {field.value && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Signed: <span className="font-serif italic text-foreground">{field.value}</span>
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
            </FormSection>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="bg-module-accent hover:bg-module-accent/90" data-testid="button-submit-incident">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mutation.isPending ? "Submitting…" : "Submit Incident Report"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Doc History Panel ────────────────────────────────────────────────────────

function DocHistoryPanel({ docId }: { docId: string }) {
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/documents", docId, "audit"],
    queryFn: () => fetch(`/api/documents/${docId}/audit`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch audit"); return r.json(); }),
  });

  const actionLabel: Record<string, string> = {
    document_uploaded: "Uploaded",
    update_document: "Details updated",
  };
  const actionIcon: Record<string, React.ReactNode> = {
    document_uploaded: <Upload className="h-3.5 w-3.5" />,
    update_document: <Pencil className="h-3.5 w-3.5" />,
  };
  const actionColor: Record<string, string> = {
    document_uploaded: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    update_document: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 px-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading history…</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return <p className="text-xs text-muted-foreground py-2 px-1">No history recorded for this file.</p>;
  }

  return (
    <div className="space-y-2 py-1">
      {logs.map((log: any) => (
        <div key={log.id} className="flex items-start gap-2.5">
          <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${actionColor[log.action] ?? "bg-muted text-muted-foreground"}`}>
            {actionIcon[log.action] ?? <Activity className="h-3 w-3" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium leading-tight">
              {actionLabel[log.action] ?? log.action} <span className="font-normal text-muted-foreground">by {log.userName}</span>
            </p>
            {log.details && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{log.details}</p>
            )}
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {format(new Date(log.createdAt), "d MMM yyyy 'at' HH:mm")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Audit Action Style Helper ────────────────────────────────────────────────

function getAuditActionStyle(action: string): { icon: (props: any) => JSX.Element; bg: string; color: string } {
  switch (action) {
    case "incident_created":       return { icon: Plus,              bg: "bg-pink-50 dark:bg-pink-950",    color: "text-pink-600 dark:text-pink-400" };
    case "incident_status_changed":return { icon: AlertTriangle,     bg: "bg-amber-50 dark:bg-amber-950",  color: "text-amber-600 dark:text-amber-400" };
    case "incident_updated":       return { icon: FileText,          bg: "bg-muted",                        color: "text-muted-foreground" };
    case "document_uploaded":      return { icon: Upload,            bg: "bg-blue-50 dark:bg-blue-950",    color: "text-blue-600 dark:text-blue-400" };
    case "milestone_added":        return { icon: Calendar,          bg: "bg-purple-50 dark:bg-purple-950",color: "text-purple-600 dark:text-purple-400" };
    case "milestone_completed":    return { icon: CheckCircle,       bg: "bg-green-50 dark:bg-green-950",  color: "text-green-600 dark:text-green-400" };
    case "update_document":        return { icon: Pencil,            bg: "bg-blue-50 dark:bg-blue-950",    color: "text-blue-600 dark:text-blue-400" };
    default:                       return { icon: Shield,            bg: "bg-muted",                        color: "text-muted-foreground" };
  }
}

// ─── Incident Detail View (Full Page) ────────────────────────────────────────

function IncidentDetailView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isPrivileged = user?.role === "admin" || user?.role === "consultant";
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<IncidentMilestone | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [showAllAuditLogs, setShowAllAuditLogs] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [detailsMinimised, setDetailsMinimised] = useState(true);

  const navigatePhoto = useCallback((direction: "prev" | "next", photoList: any[]) => {
    setLightboxPhoto(current => {
      if (!current || photoList.length < 2) return current;
      const idx = photoList.findIndex(p => p.id === current.id);
      if (idx === -1) return current;
      return direction === "next"
        ? photoList[(idx + 1) % photoList.length]
        : photoList[(idx - 1 + photoList.length) % photoList.length];
    });
  }, []);

  const toggleHistory = (docId: string) => {
    setExpandedHistory(prev => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: incident, isLoading } = useQuery<Incident>({
    queryKey: ["/api/incidents", id],
    queryFn: () => fetch(`/api/incidents/${id}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch incident"); return r.json(); }),
  });

  const { data: milestones = [] } = useQuery<IncidentMilestone[]>({
    queryKey: ["/api/incidents", id, "milestones"],
    queryFn: () => fetch(`/api/incidents/${id}/milestones`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch milestones"); return r.json(); }),
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/incidents", id, "documents"],
    queryFn: () => fetch(`/api/incidents/${id}/documents`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch documents"); return r.json(); }),
  });

  useEffect(() => {
    if (!lightboxPhoto) return;
    const photoList = documents.filter((d: any) => d.mimeType?.startsWith("image/"));
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") navigatePhoto("next", photoList);
      else if (e.key === "ArrowLeft") navigatePhoto("prev", photoList);
      else if (e.key === "Escape") setLightboxPhoto(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxPhoto, documents, navigatePhoto]);

  const { data: incidentAuditLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/incidents", id, "audit"],
    queryFn: () => fetch(`/api/incidents/${id}/audit`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch audit"); return r.json(); }),
    enabled: !!id,
  });

  const { data: site } = useQuery<any>({
    queryKey: ["/api/sites", incident?.siteId],
    queryFn: () => fetch(`/api/sites/${incident?.siteId}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch site"); return r.json(); }),
    enabled: !!incident?.siteId,
  });

  const { data: company } = useQuery<any>({
    queryKey: ["/api/companies", incident?.entityId],
    queryFn: () => fetch(`/api/companies/${incident?.entityId}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch company"); return r.json(); }),
    enabled: !!incident?.entityId,
  });

  const invalidateAudit = () => queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "audit"] });

  const downloadIncidentDocument = async (docId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/documents/${docId}/download`, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const updateMutation = useMutation({
    mutationFn: (updates: any) => apiRequest("PATCH", `/api/incidents/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      invalidateAudit();
      setShowStatusDialog(false);
      toast({ title: "Incident updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update incident.", variant: "destructive" }),
  });

  const addMilestoneMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/incidents/${id}/milestones`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "milestones"] });
      invalidateAudit();
      setShowMilestoneDialog(false);
      toast({ title: "Action item added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add action item.", variant: "destructive" }),
  });

  const completeMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) => apiRequest("PATCH", `/api/milestones/incident/${milestoneId}`, {
      isCompleted: true,
      completedDate: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "milestones"] });
      invalidateAudit();
    },
    onError: () => toast({ title: "Error", description: "Failed to complete action item.", variant: "destructive" }),
  });

  const reopenMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) => apiRequest("PATCH", `/api/milestones/incident/${milestoneId}`, {
      isCompleted: false,
      completedDate: null,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "milestones"] }),
    onError: () => toast({ title: "Error", description: "Failed to reopen action item.", variant: "destructive" }),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) => apiRequest("DELETE", `/api/milestones/incident/${milestoneId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "milestones"] }),
    onError: () => toast({ title: "Error", description: "Failed to delete action item.", variant: "destructive" }),
  });

  const regenerateReportMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/incidents/${id}/regenerate-report`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "documents"] });
      invalidateAudit();
      toast({ title: "Report regenerated", description: "The incident report document has been updated with the latest details." });
    },
    onError: () => toast({ title: "Error", description: "Failed to regenerate report.", variant: "destructive" }),
  });

  const openEditDialog = (doc: any) => {
    setEditingDoc(doc);
    setEditTitle(doc.title || "");
    setEditNotes(doc.comments || "");
  };

  const saveDocEdit = async () => {
    if (!editingDoc) return;
    setIsSavingEdit(true);
    try {
      await apiRequest("PATCH", `/api/documents/${editingDoc.id}`, {
        title: editTitle.trim() || editingDoc.title,
        comments: editNotes,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "documents"] });
      if (lightboxPhoto?.id === editingDoc.id) {
        setLightboxPhoto({ ...lightboxPhoto, title: editTitle.trim() || editingDoc.title, comments: editNotes });
      }
      toast({ title: "Saved" });
      setEditingDoc(null);
    } catch {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const uploadRes = await fetch("/api/uploads/file", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: buffer,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      const { objectPath } = await uploadRes.json();

      const created = await apiRequest("POST", `/api/incidents/${id}/documents`, {
        title: file.name.replace(/\.[^/.]+$/, ""),
        fileName: file.name,
        fileUrl: objectPath,
        fileSize: file.size,
        mimeType: file.type,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "documents"] });
      invalidateAudit();
      toast({ title: "Document uploaded" });
      if (created) openEditDialog({ ...created, comments: "" });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload the document.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingPhoto(true);
    let lastDoc: any = null;
    let successCount = 0;
    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const uploadRes = await fetch("/api/uploads/file", {
          method: "POST",
          headers: {
            "Content-Type": file.type || "image/jpeg",
            "X-File-Name": encodeURIComponent(file.name),
          },
          body: buffer,
        });

        if (!uploadRes.ok) throw new Error("Upload failed");

        const { objectPath } = await uploadRes.json();

        const created = await apiRequest("POST", `/api/incidents/${id}/documents`, {
          title: file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          fileUrl: objectPath,
          fileSize: file.size,
          mimeType: file.type,
        });
        lastDoc = created;
        successCount++;
      } catch {
        toast({ title: "Photo upload failed", description: `Could not upload ${file.name}.`, variant: "destructive" });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "documents"] });
    if (successCount > 0) invalidateAudit();
    if (successCount > 0) {
      toast({ title: successCount === 1 ? "Photo uploaded" : `${successCount} photos uploaded`, description: "You can add a title and notes by clicking the edit button." });
      if (successCount === 1 && lastDoc) {
        openEditDialog({ ...lastDoc, comments: "" });
      }
    }
    setIsUploadingPhoto(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">Incident not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/health-safety/incidents")}>
          Back to Incidents
        </Button>
      </div>
    );
  }

  const severity = severityConfig[incident.severity as IncidentSeverity] ?? severityConfig.minor;
  const statusCfg = statusConfig[incident.status as IncidentStatus] ?? statusConfig.reported;
  const StatusIcon = statusCfg.icon;
  const completedMilestones = milestones.filter(m => m.isCompleted).length;
  const totalMilestones = milestones.length;
  const milestoneProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  const photos = documents.filter(d => d.mimeType?.startsWith("image/"));
  const files = documents.filter(d => !d.mimeType?.startsWith("image/"));

  return (
    <div className="theme-hs">
      <div className="space-y-6 p-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/health-safety/incidents")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{incident.incidentReference}</h1>
              <Badge variant="outline" className={severity.className}>{severity.label}</Badge>
              <Badge variant="outline" className={statusCfg.className}>
                <StatusIcon className="mr-1.5 h-3 w-3" />
                {statusCfg.label}
              </Badge>
              {incident.injuriesReported && (
                <Badge variant="destructive" className="text-xs">Injuries Reported</Badge>
              )}
              {incident.riddorReportable && (
                <Badge variant="destructive" className="text-xs">RIDDOR Reportable</Badge>
              )}
            </div>
            <p className="mt-1 text-lg text-muted-foreground">{incident.title}</p>
          </div>
          {isPrivileged && (
            <Button
              variant="outline"
              onClick={() => setShowStatusDialog(true)}
              data-testid="button-update-status"
            >
              Update Status
            </Button>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Incident Details — full form mirror */}
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">Incident Details</CardTitle>
                  <button
                    onClick={() => setDetailsMinimised(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-incident-details"
                  >
                    {detailsMinimised ? (
                      <><ChevronDown className="h-4 w-4" /><span>Expand</span></>
                    ) : (
                      <><ChevronUp className="h-4 w-4" /><span>Minimise</span></>
                    )}
                  </button>
                </div>
              </CardHeader>
              {!detailsMinimised && (
              <CardContent className="pt-0 divide-y">

                {/* ── Section 1: Overview ── */}
                <div className="py-5 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Overview</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Incident Type</p>
                      <p className="text-sm font-medium">{incident.incidentType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Severity</p>
                      <p className="text-sm font-medium capitalize">{incident.severity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Date of Incident</p>
                      <p className="text-sm font-medium">{format(new Date(incident.incidentDate), "d MMMM yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Time of Incident</p>
                      {incident.incidentTime
                        ? <p className="text-sm font-medium">{incident.incidentTime}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Location / Where Did It Happen</p>
                      {incident.locationDetails
                        ? <p className="text-sm">{incident.locationDetails}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Description ── */}
                <div className="py-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description of Incident</p>
                  <p className="text-sm leading-relaxed">{incident.description}</p>
                </div>

                {/* ── Section 3: Cause, Effect & Machinery ── */}
                <div className="py-5 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cause, Effect &amp; Equipment</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Cause(s) of Incident</p>
                      {incident.incidentCause?.length > 0
                        ? <div className="flex flex-wrap gap-1.5">{incident.incidentCause.map((c: string) => <Badge key={c} variant="outline" className="text-xs font-normal">{c}</Badge>)}</div>
                        : <p className="text-sm text-muted-foreground italic">None selected</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Effect / Affect</p>
                      {incident.incidentEffect?.length > 0
                        ? <div className="flex flex-wrap gap-1.5">{incident.incidentEffect.map((e: string) => <Badge key={e} variant="outline" className="text-xs font-normal">{e}</Badge>)}</div>
                        : <p className="text-sm text-muted-foreground italic">None selected</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Machinery / Equipment Involved</p>
                      {incident.machineryInvolved
                        ? <p className="text-sm">{incident.machineryInvolved}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                  </div>
                </div>

                {/* ── Section 4: Affected Person ── */}
                <div className="py-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Affected / Injured Person</p>
                    {incident.affectedPersonIsPublic && <Badge variant="outline" className="text-xs">Member of Public</Badge>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Member of Public</p>
                      <p className="text-sm font-medium">{incident.affectedPersonIsPublic ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Full Name</p>
                      {incident.affectedPersonName
                        ? <p className="text-sm">{incident.affectedPersonName}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{incident.affectedPersonIsPublic ? "Role / Occupation" : "Job Title"}</p>
                      {incident.affectedPersonJobTitle
                        ? <p className="text-sm">{incident.affectedPersonJobTitle}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                      {incident.affectedPersonAddress
                        ? <p className="text-sm">{incident.affectedPersonAddress}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                  </div>
                </div>

                {/* ── Section 5: Injury Location & Body Diagram ── */}
                <div className="py-5 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Injury Location</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Injuries Were Sustained</p>
                      <p className={`text-sm font-medium ${incident.injuriesReported ? "text-red-600" : ""}`}>
                        {incident.injuriesReported ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Injury Details</p>
                      {incident.injuryDetails
                        ? <p className="text-sm">{incident.injuryDetails}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">Body Diagram — Areas Affected</p>
                    {(() => {
                      let zones: string[] = [];
                      try { if (incident.bodyDiagramMarkers) zones = JSON.parse(incident.bodyDiagramMarkers); } catch {}
                      return (
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                          <BodyDiagramViewer selected={zones} />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1.5">Marked areas:</p>
                            {zones.length > 0
                              ? <div className="flex flex-wrap gap-1.5">{zones.map(id => <Badge key={id} variant="outline" className="text-xs font-normal bg-red-50 text-red-700 border-red-200">{ALL_BODY_ZONES.find(z => z.id === id)?.label ?? id}</Badge>)}</div>
                              : <p className="text-sm text-muted-foreground italic">No areas marked</p>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ── Section 6: Actions & Recommendations ── */}
                <div className="py-5 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Actions Taken &amp; Recommendations</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Immediate Actions Taken</p>
                      {incident.immediateActions
                        ? <p className="text-sm leading-relaxed">{incident.immediateActions}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Recommendations</p>
                      {incident.recommendations
                        ? <p className="text-sm leading-relaxed">{incident.recommendations}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                  </div>
                </div>

                {/* ── Section 7: RIDDOR ── */}
                <div className="py-5 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">RIDDOR</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">RIDDOR Reportable</p>
                      <p className={`text-sm font-medium ${incident.riddorReportable ? "text-red-600" : ""}`}>
                        {incident.riddorReportable ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Responsible Person</p>
                      {incident.riddorResponsiblePerson
                        ? <p className="text-sm">{incident.riddorResponsiblePerson}</p>
                        : <p className="text-sm text-muted-foreground italic">{incident.riddorReportable ? "Not provided" : "N/A"}</p>}
                    </div>
                  </div>
                </div>

                {/* ── Section 8: Witnesses ── */}
                <div className="py-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Witnesses</p>
                  {incident.witnesses
                    ? <p className="text-sm leading-relaxed">{incident.witnesses}</p>
                    : <p className="text-sm text-muted-foreground italic">No witnesses recorded</p>}
                </div>

                {/* ── Section 9: Person Reporting ── */}
                <div className="py-5 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Person Reporting This Incident</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Full Name</p>
                      {incident.reportingPersonName
                        ? <p className="text-sm">{incident.reportingPersonName}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Job Title</p>
                      {incident.reportingPersonJobTitle
                        ? <p className="text-sm">{incident.reportingPersonJobTitle}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                      {incident.reportingPersonAddress
                        ? <p className="text-sm">{incident.reportingPersonAddress}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                  </div>
                </div>

                {/* ── Section 10: Declaration ── */}
                <div className="py-5 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Declaration</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Full Name</p>
                      {incident.declarationName
                        ? <p className="text-sm">{incident.declarationName}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Date</p>
                      {incident.declarationDate
                        ? <p className="text-sm">{incident.declarationDate}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Signature</p>
                      {incident.declarationSignature
                        ? <p className="text-base italic font-medium border-b border-foreground/40 inline-block pb-0.5 min-w-[200px]">{incident.declarationSignature}</p>
                        : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                    </div>
                  </div>
                </div>

                {/* ── Investigation Notes (admin/post-incident) ── */}
                {(incident.rootCause || incident.correctiveActions || incident.resolvedAt) && (
                  <div className="py-5 space-y-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Investigation Notes</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Root Cause</p>
                        {incident.rootCause
                          ? <p className="text-sm leading-relaxed">{incident.rootCause}</p>
                          : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Corrective Actions</p>
                        {incident.correctiveActions
                          ? <p className="text-sm leading-relaxed">{incident.correctiveActions}</p>
                          : <p className="text-sm text-muted-foreground italic">Not provided</p>}
                      </div>
                      {incident.resolvedAt && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-muted-foreground mb-0.5">Resolved On</p>
                          <p className="text-sm font-medium text-emerald-600">{format(new Date(incident.resolvedAt), "d MMMM yyyy")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </CardContent>
              )}
            </Card>

            {/* Action Items / Milestones */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
                <div>
                  <CardTitle className="text-lg">Action Items</CardTitle>
                  <CardDescription>Track follow-up tasks and corrective actions</CardDescription>
                </div>
                {isPrivileged && (
                  <Button
                    size="sm"
                    onClick={() => setShowMilestoneDialog(true)}
                    className="bg-module-accent hover:bg-module-accent/90"
                    data-testid="button-add-milestone"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Action
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-5">
                {totalMilestones > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{completedMilestones} of {totalMilestones} completed</span>
                    </div>
                    <Progress value={milestoneProgress} className="h-2" />
                  </div>
                )}
                <div className="space-y-3">
                  {milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        milestone.isCompleted
                          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                          : "bg-card"
                      }`}
                      data-testid={`milestone-${milestone.id}`}
                    >
                      <div className={`mt-0.5 rounded-full p-1 ${
                        milestone.isCompleted
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {milestone.isCompleted
                          ? <CheckCircle className="h-4 w-4" />
                          : <Clock className="h-4 w-4" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${milestone.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                          {milestone.title}
                        </p>
                        {milestone.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{milestone.description}</p>
                        )}
                        {milestone.dueDate && (
                          <p className={`text-xs mt-1 ${
                            !milestone.isCompleted && isPast(new Date(milestone.dueDate))
                              ? "text-red-600"
                              : "text-muted-foreground"
                          }`}>
                            Due: {format(new Date(milestone.dueDate), "d MMM yyyy")}
                          </p>
                        )}
                      </div>
                      {isPrivileged && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-milestone-menu-${milestone.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!milestone.isCompleted ? (
                              <DropdownMenuItem
                                onClick={() => completeMilestoneMutation.mutate(milestone.id)}
                                data-testid={`button-complete-milestone-${milestone.id}`}
                              >
                                <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
                                Mark Complete
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => reopenMilestoneMutation.mutate(milestone.id)}
                                data-testid={`button-reopen-milestone-${milestone.id}`}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reopen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMilestoneMutation.mutate(milestone.id)}
                              data-testid={`button-delete-milestone-${milestone.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))}
                  {milestones.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No action items yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Photos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    Photos
                  </CardTitle>
                  <CardDescription>Incident scene photographs and visual evidence</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{photos.length}</Badge>
                  {isPrivileged && (
                    <>
                      <input
                        ref={photoInputRef}
                        type="file"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        multiple
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        data-testid="button-upload-photo"
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="mr-2 h-4 w-4" />
                        )}
                        Add Photos
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                {photos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <Camera className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No photos have been added yet.</p>
                    {isPrivileged && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Upload Photos
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {photos.map((photo: any) => (
                      <div key={photo.id} className="group rounded-lg border bg-card overflow-hidden" data-testid={`photo-thumb-${photo.id}`}>
                        {/* Image area */}
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          <button
                            className="absolute inset-0 w-full h-full"
                            onClick={() => setLightboxPhoto(photo)}
                          >
                            <img
                              src={photo.fileUrl}
                              alt={photo.title || photo.fileName}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                              <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                            </div>
                          </button>
                          {isPrivileged && (
                            <button
                              className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10"
                              onClick={(e) => { e.stopPropagation(); openEditDialog(photo); }}
                              title="Edit title & notes"
                              data-testid={`button-edit-photo-${photo.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {/* Caption */}
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-sm font-medium leading-tight truncate text-foreground">
                            {photo.title || photo.fileName}
                          </p>
                          {photo.description ? (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                              {photo.description}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground/50 mt-0.5 italic">No notes</p>
                          )}
                          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/50">
                            <span className="text-xs text-muted-foreground truncate">
                              {photo.uploadedByName || "Unknown"} · {format(new Date(photo.createdAt), "d MMM yyyy")}
                            </span>
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0 ml-2"
                              onClick={() => toggleHistory(photo.id)}
                              data-testid={`button-history-photo-${photo.id}`}
                            >
                              <History className="h-3 w-3" />
                              {expandedHistory.has(photo.id) ? "Hide" : "History"}
                            </button>
                          </div>
                          {expandedHistory.has(photo.id) && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <DocHistoryPanel docId={photo.id} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
                <div>
                  <CardTitle className="text-lg">Documents</CardTitle>
                  <CardDescription>Reports and files attached to this incident</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{files.length}</Badge>
                  {isPrivileged && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => regenerateReportMutation.mutate()}
                        disabled={regenerateReportMutation.isPending}
                        title="Regenerate the original incident report document with the latest incident details"
                        data-testid="button-regenerate-report"
                      >
                        {regenerateReportMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-2 h-4 w-4" />
                        )}
                        Regenerate Report
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        data-testid="button-upload-document"
                      >
                        {isUploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        Upload
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                {files.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No documents attached yet.</p>
                ) : (
                  <div className="space-y-2">
                    {files.map((doc: any) => (
                      <div key={doc.id} className="rounded-md border overflow-hidden" data-testid={`doc-${doc.id}`}>
                        <div className="group flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.title || doc.fileName}</p>
                            {doc.comments ? (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-start gap-1">
                                <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{doc.comments}</span>
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground/60 truncate">{doc.fileName}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {doc.uploadedByName || "Unknown"} · {format(new Date(doc.createdAt), "d MMM yyyy 'at' HH:mm")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {doc.fileUrl && (doc.mimeType === "application/pdf" || doc.mimeType?.startsWith("image/") || doc.mimeType === "text/html") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => setPreviewDoc(doc)}
                                data-testid={`button-preview-doc-${doc.id}`}
                                title="Preview document"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleHistory(doc.id)}
                              data-testid={`button-history-doc-${doc.id}`}
                              title="View history"
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            {isPrivileged && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => openEditDialog(doc)}
                                data-testid={`button-edit-doc-${doc.id}`}
                                title="Edit title & notes"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {doc.fileUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => downloadIncidentDocument(doc.id, doc.fileName)}
                                data-testid={`button-download-doc-${doc.id}`}
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {expandedHistory.has(doc.id) && (
                          <div className="border-t bg-muted/20 px-4 py-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">File History</p>
                            <DocHistoryPanel docId={doc.id} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-center mb-3">
                  <p className="text-2xl font-bold">{completedMilestones}<span className="text-muted-foreground text-lg">/{totalMilestones}</span></p>
                  <p className="text-xs text-muted-foreground">actions completed</p>
                </div>
                <Progress value={milestoneProgress} className="h-2" />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-muted-foreground">{Math.round(milestoneProgress)}% done</span>
                  <span className="text-xs text-muted-foreground">{totalMilestones - completedMilestones} remaining</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base">Overview</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Severity</p>
                  <Badge variant="outline" className={severity.className}>{severity.label}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                  <Badge variant="outline" className={statusCfg.className}>
                    <StatusIcon className="mr-1.5 h-3 w-3" />
                    {statusCfg.label}
                  </Badge>
                </div>
                <Separator />
                {company && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Company</p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {company.name}
                    </p>
                  </div>
                )}
                {site && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Site</p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {site.name}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reported By</p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {incident.reportedByName}
                  </p>
                </div>
              </CardContent>
            </Card>

            {(incident.injuriesReported || incident.riddorReportable) && (
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader className="border-b border-red-200 dark:border-red-900 pb-3">
                  <CardTitle className="text-base text-red-700 dark:text-red-400 flex items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Safety Flags
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {incident.injuriesReported && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <span className="font-medium">Injuries reported</span>
                    </div>
                  )}
                  {incident.riddorReportable && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <span className="font-medium">RIDDOR reportable</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Audit Trail */}
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {incidentAuditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No activity yet</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {(showAllAuditLogs ? incidentAuditLogs : incidentAuditLogs.slice(0, 3)).map((log: any) => {
                        const style = getAuditActionStyle(log.action);
                        const Icon = style.icon;
                        return (
                          <div key={log.id} className="flex gap-3 items-start">
                            <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${style.bg}`}>
                              <Icon className={`h-3.5 w-3.5 ${style.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs leading-snug text-foreground">{log.details}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {log.userName} · {format(new Date(log.createdAt), "d MMM yyyy, HH:mm")}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {incidentAuditLogs.length > 3 && (
                      <button
                        className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowAllAuditLogs(v => !v)}
                        data-testid="audit-toggle"
                      >
                        {showAllAuditLogs ? (
                          <><ChevronUp className="h-3 w-3" /> Show less</>
                        ) : (
                          <><ChevronDown className="h-3 w-3" /> Show {incidentAuditLogs.length - 3} more</>
                        )}
                      </button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxPhoto && (() => {
        const currentIdx = photos.findIndex(p => p.id === lightboxPhoto.id);
        const hasMultiple = photos.length > 1;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setLightboxPhoto(null)}
            data-testid="lightbox-overlay"
          >
            {/* Top-right controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {hasMultiple && (
                <span className="text-xs text-white/60 font-medium tabular-nums px-2">
                  {currentIdx + 1} / {photos.length}
                </span>
              )}
              {isPrivileged && (
                <button
                  className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                  onClick={(e) => { e.stopPropagation(); openEditDialog(lightboxPhoto); }}
                  title="Edit title & notes"
                  data-testid="lightbox-edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                onClick={() => setLightboxPhoto(null)}
                data-testid="lightbox-close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Prev arrow */}
            {hasMultiple && (
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/25 transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); navigatePhoto("prev", photos); }}
                data-testid="lightbox-prev"
                title="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Next arrow */}
            {hasMultiple && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/25 transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); navigatePhoto("next", photos); }}
                data-testid="lightbox-next"
                title="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* Image + caption */}
            <div className="flex flex-col items-center gap-3 max-h-[90vh] max-w-[80vw]" onClick={e => e.stopPropagation()}>
              <img
                key={lightboxPhoto.id}
                src={lightboxPhoto.fileUrl}
                alt={lightboxPhoto.title || lightboxPhoto.fileName}
                className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl"
              />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-white">{lightboxPhoto.title || lightboxPhoto.fileName}</p>
                {lightboxPhoto.comments && (
                  <p className="text-xs text-white/60 max-w-md">{lightboxPhoto.comments}</p>
                )}
              </div>
              <Button size="sm" variant="secondary" asChild>
                <a href={lightboxPhoto.fileUrl} download={lightboxPhoto.fileName} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-1.5 h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="h-[80vh] flex flex-col p-0 gap-0 overflow-hidden" style={{ maxWidth: "860px" }}>
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{previewDoc?.title || previewDoc?.fileName}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewDoc && (() => {
              const mime = previewDoc.mimeType || "";
              const previewUrl = `/api/documents/${previewDoc.id}/preview`;
              if (mime === "text/html") {
                return (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title={previewDoc.title || previewDoc.fileName}
                    sandbox="allow-same-origin"
                    data-testid="preview-iframe"
                  />
                );
              }
              if (mime === "application/pdf") {
                return (
                  <PdfViewer url={previewUrl} data-testid="preview-pdf" />
                );
              }
              if (mime.startsWith("image/")) {
                return (
                  <div className="w-full h-full flex items-center justify-center overflow-auto p-4 bg-muted/20">
                    <img
                      src={previewUrl}
                      alt={previewDoc.title}
                      className="max-w-full max-h-full object-contain rounded"
                      data-testid="preview-image"
                    />
                  </div>
                );
              }
              return (
                <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
                  <FileText className="h-14 w-14 text-muted-foreground" />
                  <div>
                    <p className="text-base font-medium">Preview not available for this file type</p>
                    <p className="text-sm text-muted-foreground mt-1">{previewDoc.fileName} ({mime || "unknown"})</p>
                  </div>
                  <Button variant="outline" onClick={() => downloadIncidentDocument(previewDoc.id, previewDoc.fileName)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              );
            })()}
          </div>
          <div className="px-5 py-3 border-t bg-muted/30 flex justify-between items-center shrink-0">
            <span className="text-xs text-muted-foreground truncate">{previewDoc?.fileName}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => previewDoc && downloadIncidentDocument(previewDoc.id, previewDoc.fileName)}
              data-testid="button-download-from-preview"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Title & Notes Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => { if (!open) setEditingDoc(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-doc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingDoc?.mimeType?.startsWith("image/") ? (
                <><Camera className="h-4 w-4" /> Edit Photo Details</>
              ) : (
                <><FileText className="h-4 w-4" /> Edit Document Details</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingDoc?.mimeType?.startsWith("image/") && editingDoc?.fileUrl && (
              <div className="overflow-hidden rounded-md border bg-muted h-32">
                <img src={editingDoc.fileUrl} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Enter a descriptive title..."
                data-testid="input-edit-title"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Notes / Comments
              </label>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Add context, observations, or notes about this file..."
                className="resize-none"
                rows={3}
                data-testid="textarea-edit-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDoc(null)} disabled={isSavingEdit}>Cancel</Button>
            <Button onClick={saveDocEdit} disabled={isSavingEdit} data-testid="button-save-doc-edit">
              {isSavingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Incident Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select
              defaultValue={incident.status}
              onValueChange={(v) => updateMutation.mutate({ status: v })}
            >
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reported">Reported</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Milestone Dialog */}
      <AddMilestoneDialog
        open={showMilestoneDialog}
        onClose={() => setShowMilestoneDialog(false)}
        onAdd={(data) => addMilestoneMutation.mutate(data)}
        isLoading={addMilestoneMutation.isPending}
      />
    </div>
  );
}

function AddMilestoneDialog({
  open,
  onClose,
  onAdd,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (data: any) => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
    setTitle("");
    setDescription("");
    setDueDate("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Action Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title *</label>
            <Input
              placeholder="Action item title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-milestone-title"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Optional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || isLoading}
            className="bg-module-accent hover:bg-module-accent/90"
            data-testid="button-save-milestone"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Incidents List View ──────────────────────────────────────────────────────

function IncidentCard({ incident, sites }: { incident: Incident; sites: any[] }) {
  const severity = severityConfig[incident.severity as IncidentSeverity] ?? severityConfig.minor;
  const statusCfg = statusConfig[incident.status as IncidentStatus] ?? statusConfig.reported;
  const StatusIcon = statusCfg.icon;
  const siteName = sites.find(s => s.id === incident.siteId)?.name;

  return (
    <Card className="hover-elevate" data-testid={`card-incident-${incident.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${
              incident.severity === "critical" ? "bg-red-500/10" :
              incident.severity === "major" ? "bg-orange-500/10" :
              "bg-module-accent/10"
            }`}>
              <AlertTriangle className={`h-6 w-6 ${
                incident.severity === "critical" ? "text-red-500" :
                incident.severity === "major" ? "text-orange-500" :
                "text-module-accent"
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{incident.title}</h3>
                <Badge variant="outline" className="text-xs font-mono text-muted-foreground border-muted">
                  {incident.incidentReference}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{incident.incidentType}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {siteName && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {siteName}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {incident.reportedByName}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={severity.className}>{severity.label}</Badge>
            <Badge variant="outline" className={statusCfg.className}>
              <StatusIcon className="mr-1.5 h-3 w-3" />
              {statusCfg.label}
            </Badge>
          </div>
        </div>

        {(incident.injuriesReported || incident.riddorReportable) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {incident.injuriesReported && <Badge variant="destructive" className="text-xs">Injuries Reported</Badge>}
            {incident.riddorReportable && <Badge variant="destructive" className="text-xs">RIDDOR Reportable</Badge>}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{format(new Date(incident.incidentDate), "MMM d, yyyy")}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-module-accent hover:text-module-accent"
            asChild
          >
            <Link href={`/health-safety/incidents/${incident.id}`} data-testid={`button-view-details-${incident.id}`}>
              Open File
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type RegisterType = "incident" | "near_miss" | "good_practice";

const registerTypeConfig = {
  incident: {
    label: "Incidents",
    icon: ShieldAlert,
    color: "text-red-600 dark:text-red-400",
    activeClass: "bg-red-500 dark:bg-red-600 text-white border-red-500 dark:border-red-600 shadow-sm",
    inactiveClass: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-500 dark:hover:bg-red-600 hover:text-white hover:border-red-500",
    reportButtonClass: "bg-red-500 hover:bg-red-600 text-white border-transparent disabled:opacity-100",
    reportLabel: "Report Incident",
    registerTitle: "Incident Register",
    description: "Workplace incidents and accidents",
    statCards: [
      { title: "Active Incidents", key: "active", colorClass: "border-l-module-accent", iconColor: "text-module-accent", bg: "bg-module-accent/10", sub: "Reported or under review" },
      { title: "High Severity", key: "critical", colorClass: "border-l-red-500", iconColor: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40", sub: "Major or critical severity" },
      { title: "Resolved", key: "resolved", colorClass: "border-l-green-500", iconColor: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40", sub: "Successfully closed" },
    ],
  },
  near_miss: {
    label: "Near Miss",
    icon: AlertCircle,
    color: "text-amber-600 dark:text-amber-400",
    activeClass: "bg-amber-500 dark:bg-amber-600 text-white border-amber-500 dark:border-amber-600 shadow-sm",
    inactiveClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-500 dark:hover:bg-amber-600 hover:text-white hover:border-amber-500",
    reportButtonClass: "bg-amber-500 hover:bg-amber-600 text-white border-transparent disabled:opacity-100 disabled:cursor-not-allowed",
    reportLabel: "Report Near Miss",
    registerTitle: "Near Miss Register",
    description: "Events that could have caused harm but didn't",
    statCards: [
      { title: "Near Misses Reported", key: "active", colorClass: "border-l-amber-500", iconColor: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40", sub: "Reported or under review" },
      { title: "Unreviewed", key: "critical", colorClass: "border-l-orange-500", iconColor: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/40", sub: "Awaiting review" },
      { title: "Closed", key: "resolved", colorClass: "border-l-green-500", iconColor: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40", sub: "Actions taken & closed" },
    ],
  },
  good_practice: {
    label: "Good Practice",
    icon: ThumbsUp,
    color: "text-green-600 dark:text-green-400",
    activeClass: "bg-green-600 dark:bg-green-700 text-white border-green-600 dark:border-green-700 shadow-sm",
    inactiveClass: "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-600 dark:hover:bg-green-700 hover:text-white hover:border-green-600",
    reportButtonClass: "bg-green-600 hover:bg-green-700 text-white border-transparent disabled:opacity-100 disabled:cursor-not-allowed",
    reportLabel: "Report Good Practice",
    registerTitle: "Good Practice Register",
    description: "Positive safety behaviours and best practices",
    statCards: [
      { title: "Practices Logged", key: "active", colorClass: "border-l-green-500", iconColor: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40", sub: "Submitted for review" },
      { title: "Shared", key: "critical", colorClass: "border-l-teal-500", iconColor: "text-teal-600 dark:text-teal-400", bg: "bg-teal-100 dark:bg-teal-900/40", sub: "Shared across the business" },
      { title: "Archived", key: "resolved", colorClass: "border-l-slate-400", iconColor: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-900/40", sub: "Completed & archived" },
    ],
  },
} as const;

function IncidentsListView() {
  const { user } = useAuth();
  const [view, setView] = useState<"dashboard" | "register">("dashboard");
  const [registerType, setRegisterType] = useState<RegisterType>("incident");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const { selectedCompany, selectedSiteId, setSelectedSiteId, setSelectedCompany, handleCompanyChange, resetFilters } = useSiteFilter();

  const activeConfig = registerTypeConfig[registerType];

  const isPrivileged = user?.role === "admin" || user?.role === "consultant";

  const { data: incidentsRaw, isLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });
  const incidents = Array.isArray(incidentsRaw) ? incidentsRaw : [];

  const { data: sites = [] } = useQuery<any[]>({
    queryKey: ["/api/sites"],
  });

  const { data: companiesData } = useQuery<any>({
    queryKey: ["/api/companies"],
    enabled: isPrivileged,
  });
  const companies = companiesData?.companies ?? [];

  const filteredSitesForCombobox = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return sites;
    return sites.filter((s: any) => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);

  const selectedSiteObj = useMemo(() =>
    sites.find((s: any) => s.id === selectedSiteId), [sites, selectedSiteId]);

  const handleSiteChange = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
    if (siteId && siteId !== "all" && sites) {
      const site = sites.find((s: any) => s.id === siteId);
      if (site?.companyName) setSelectedCompany(site.companyName);
    }
  }, [sites, setSelectedSiteId, setSelectedCompany]);

  const currentContextLabel = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") return selectedSiteObj?.name || null;
    if (isPrivileged) return selectedCompany && selectedCompany !== "all" ? selectedCompany : "All Clients";
    return null;
  }, [selectedSiteId, selectedCompany, selectedSiteObj, isPrivileged]);

  const contextCompany = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") return selectedSiteObj?.companyName || null;
    if (selectedCompany && selectedCompany !== "all") return selectedCompany;
    return null;
  }, [selectedSiteId, selectedCompany, selectedSiteObj]);

  const contextSite = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") return selectedSiteObj?.name || null;
    if (selectedCompany && selectedCompany !== "all") return "All Sites";
    return "All Sites";
  }, [selectedSiteId, selectedCompany, selectedSiteObj]);

  const filteredIncidents = useMemo(() => {
    if (registerType !== "incident") return [];
    return incidents.filter((incident) => {
      const incidentSite = sites.find((s: any) => s.id === incident.siteId);
      const matchesSearch =
        incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.incidentReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.incidentType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
      const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
      const matchesSite = !selectedSiteId || selectedSiteId === "all" || incident.siteId === selectedSiteId;
      const matchesCompany = !selectedCompany || selectedCompany === "all" || incidentSite?.companyName === selectedCompany;
      return matchesSearch && matchesStatus && matchesSeverity && matchesSite && matchesCompany;
    });
  }, [incidents, sites, searchQuery, statusFilter, severityFilter, selectedSiteId, selectedCompany, registerType]);

  const stats = {
    active: incidents.filter(i => i.status === "reported" || i.status === "under_review").length,
    critical: incidents.filter(i => i.severity === "major" || i.severity === "critical").length,
    resolved: incidents.filter(i => i.status === "resolved" || i.status === "closed").length,
  };

  return (
    <div className="theme-hs flex flex-col h-full">
      {/* Module header */}
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <ShieldAlert className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                Health &amp; Safety
                <span className="font-normal text-muted-foreground text-2xl"> - Incidents</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground min-h-[1.5rem]">
                {isPrivileged && (
                  <span className="font-semibold text-foreground">{contextCompany || "All Companies"}</span>
                )}
                {!isPrivileged && contextCompany && (
                  <span className="font-semibold text-foreground">{contextCompany}</span>
                )}
                {(isPrivileged || contextCompany) && contextSite && <span> - </span>}
                {contextSite && <span>{contextSite}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isPrivileged && sites && sites.length > 0 && (
              <div className="flex items-center gap-2">
                {((selectedCompany && selectedCompany !== "all") || (selectedSiteId && selectedSiteId !== "all")) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetFilters}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                    data-testid="button-clear-filters-incidents"
                    title="Clear selection"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <div className="flex flex-row items-center gap-2">
                  <CompanyCombobox
                    sites={sites}
                    value={selectedCompany}
                    onValueChange={handleCompanyChange}
                    className="w-[200px]"
                    testId="select-company-incidents"
                  />
                  <SiteCombobox
                    sites={filteredSitesForCombobox}
                    value={selectedSiteId}
                    onValueChange={handleSiteChange}
                    className="w-[200px]"
                    testId="select-site-incidents"
                  />
                </div>
              </div>
            )}
            {view === "register" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setView("dashboard")}
                  data-testid="button-view-dashboard"
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  View Dashboard
                </Button>
                <Button
                  className={activeConfig.reportButtonClass}
                  onClick={registerType === "incident" ? () => setShowReportDialog(true) : undefined}
                  disabled={registerType !== "incident"}
                  title={registerType !== "incident" ? "Coming soon — form not yet available" : undefined}
                  data-testid={registerType === "incident" ? "button-report-incident" : `button-report-${registerType}`}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {activeConfig.reportLabel}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toggle bar — always visible below the header */}
      <div className="px-8 py-4 border-b bg-background">
        <div className="grid w-full grid-cols-3 gap-2 p-1 rounded-xl bg-muted/50 border">
          {(["incident", "near_miss", "good_practice"] as RegisterType[]).map((type) => {
            const cfg = registerTypeConfig[type];
            const Icon = cfg.icon;
            const isActive = view === "register" && registerType === type;
            return (
              <button
                key={type}
                onClick={() => {
                  setRegisterType(type);
                  setSearchQuery("");
                  setStatusFilter("all");
                  setSeverityFilter("all");
                  setView("register");
                }}
                data-testid={`toggle-register-${type}`}
                className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-lg font-medium transition-all border ${
                  isActive ? cfg.activeClass : cfg.inactiveClass
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto">

      {/* Dashboard overview */}
      {view === "dashboard" && (
        <div className="p-8 space-y-8 dash-animate">
          <div>
            <h2 className="text-xl font-semibold mb-1">Overview</h2>
            <p className="text-muted-foreground text-sm">Select a register below to view, manage, and report incidents across your organisation.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Incidents card */}
            <button
              onClick={() => { setRegisterType("incident"); setView("register"); }}
              data-testid="dashboard-card-incident"
              className="text-left group rounded-xl border-2 border-red-200 dark:border-red-800 bg-white dark:bg-card hover:border-red-400 dark:hover:border-red-600 hover:shadow-lg transition-all p-6 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/40">
                  <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <ChevronRight className="h-5 w-5 text-red-300 group-hover:text-red-500 transition-colors mt-1" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Incident Register</h3>
              <p className="text-sm text-muted-foreground mb-5">Workplace incidents and accidents requiring formal reporting and investigation.</p>
              <div className="grid grid-cols-3 gap-2 border-t pt-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">{stats.active}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <div className="text-center border-x">
                  <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats.critical}</div>
                  <div className="text-xs text-muted-foreground">Unreviewed</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</div>
                  <div className="text-xs text-muted-foreground">Closed</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">
                <span>View Incident Register</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>

            {/* Near Miss card */}
            <button
              onClick={() => { setRegisterType("near_miss"); setView("register"); }}
              data-testid="dashboard-card-near-miss"
              className="text-left group rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-white dark:bg-card hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-lg transition-all p-6 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
                  <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <ChevronRight className="h-5 w-5 text-amber-300 group-hover:text-amber-500 transition-colors mt-1" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Near Miss Register</h3>
              <p className="text-sm text-muted-foreground mb-5">Events that could have caused harm but didn't — early warning signals worth recording.</p>
              <div className="grid grid-cols-3 gap-2 border-t pt-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">0</div>
                  <div className="text-xs text-muted-foreground">Reported</div>
                </div>
                <div className="text-center border-x">
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">0</div>
                  <div className="text-xs text-muted-foreground">In Review</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">0</div>
                  <div className="text-xs text-muted-foreground">Closed</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                <span>View Near Miss Register</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>

            {/* Good Practice card */}
            <button
              onClick={() => { setRegisterType("good_practice"); setView("register"); }}
              data-testid="dashboard-card-good-practice"
              className="text-left group rounded-xl border-2 border-green-200 dark:border-green-800 bg-white dark:bg-card hover:border-green-400 dark:hover:border-green-600 hover:shadow-lg transition-all p-6 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950/40">
                  <ThumbsUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <ChevronRight className="h-5 w-5 text-green-300 group-hover:text-green-500 transition-colors mt-1" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Good Practice Register</h3>
              <p className="text-sm text-muted-foreground mb-5">Positive safety behaviours and best practices worth recognising and sharing.</p>
              <div className="grid grid-cols-3 gap-2 border-t pt-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">0</div>
                  <div className="text-xs text-muted-foreground">Logged</div>
                </div>
                <div className="text-center border-x">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">0</div>
                  <div className="text-xs text-muted-foreground">Shared</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">0</div>
                  <div className="text-xs text-muted-foreground">Actioned</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors">
                <span>View Good Practice Register</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          </div>

        </div>
      )}

      {/* Register view */}
      {view === "register" && (
      <div className="space-y-6 p-8 dash-animate">
        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {activeConfig.statCards.map((card, i) => {
            const statVal = registerType === "incident" ? stats[card.key as keyof typeof stats] : 0;
            const StatIcon = i === 0 ? AlertOctagon : i === 1 ? Flag : CheckCircle2;
            return (
              <Card key={card.title} className={`border-l-4 ${card.colorClass}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <div className={`rounded-full ${card.bg} p-2`}>
                    <StatIcon className={`h-4 w-4 ${card.iconColor}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${card.iconColor}`} data-testid={`text-stat-${i}-${registerType}`}>{statVal}</div>
                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Table card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{activeConfig.registerTitle}</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">{activeConfig.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${activeConfig.label.toLowerCase()}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-[200px] pl-8"
                    data-testid="input-search-incidents"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="reported">Reported</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-severity-filter">
                    <SelectValue placeholder="All Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedSiteId ?? "all"}
                  onValueChange={(v) => handleSiteChange(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-[170px]" data-testid="select-site-filter">
                    <SelectValue placeholder="All Sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sites</SelectItem>
                    {sites.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredIncidents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => {
                    const site = sites.find((s: any) => s.id === incident.siteId);
                    const sev = severityConfig[incident.severity as IncidentSeverity] ?? severityConfig.minor;
                    const sta = statusConfig[incident.status as IncidentStatus] ?? statusConfig.reported;
                    return (
                      <TableRow
                        key={incident.id}
                        className="cursor-pointer"
                        data-testid={`row-incident-${incident.id}`}
                        onClick={() => window.location.href = `/health-safety/incidents/${incident.id}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5 text-module-accent" />
                            <span>{incident.incidentReference}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{incident.title}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {site ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {site.name}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {incident.incidentType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${sev.className}`}>
                            {sev.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${sta.className}`}>
                            {sta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(incident.incidentDate), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-incident-menu-${incident.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/health-safety/incidents/${incident.id}`} data-testid={`button-view-incident-${incident.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Incident
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                {(() => {
                  const EmptyIcon = activeConfig.icon;
                  const isFiltered = registerType === "incident" && (searchQuery || statusFilter !== "all" || severityFilter !== "all" || (selectedSiteId && selectedSiteId !== "all"));
                  if (registerType === "near_miss") {
                    return (
                      <>
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                          <EmptyIcon className="h-7 w-7 text-amber-500" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium">No near miss reports yet</h3>
                        <p className="mt-1 text-sm text-muted-foreground max-w-sm text-center">
                          Near miss reporting will be available soon. This register will populate once the reporting form is enabled.
                        </p>
                        <Button variant="outline" className="mt-4" disabled data-testid="button-report-near-miss-empty">
                          <Plus className="mr-2 h-4 w-4" />
                          Report Near Miss — Coming Soon
                        </Button>
                      </>
                    );
                  }
                  if (registerType === "good_practice") {
                    return (
                      <>
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <EmptyIcon className="h-7 w-7 text-green-500" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium">No good practice entries yet</h3>
                        <p className="mt-1 text-sm text-muted-foreground max-w-sm text-center">
                          Good practice reporting will be available soon. This register will populate once the reporting form is enabled.
                        </p>
                        <Button variant="outline" className="mt-4" disabled data-testid="button-report-good-practice-empty">
                          <Plus className="mr-2 h-4 w-4" />
                          Report Good Practice — Coming Soon
                        </Button>
                      </>
                    );
                  }
                  return (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                        <AlertTriangle className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <h3 className="mt-4 text-lg font-medium">No incidents found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isFiltered ? "Try adjusting your filters" : "No incidents have been reported yet"}
                      </p>
                      {!isFiltered && (
                        <Button
                          className="mt-4 bg-module-accent hover:bg-module-accent/90"
                          onClick={() => setShowReportDialog(true)}
                          data-testid="button-report-first-incident"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Report First Incident
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      <ReportIncidentDialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        sites={sites}
        companies={companies}
        userRole={user?.role || "client"}
        userCompanyId={user?.companyId || null}
      />
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function HSIncidents() {
  const [matchDetail, paramsDetail] = useRoute("/health-safety/incidents/:id");
  const [matchList] = useRoute("/health-safety/incidents");

  if (matchDetail && paramsDetail?.id) {
    return <IncidentDetailView id={paramsDetail.id} />;
  }

  return <IncidentsListView />;
}
