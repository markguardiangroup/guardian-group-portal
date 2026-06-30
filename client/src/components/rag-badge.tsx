import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Clock, UserCheck, ShieldCheck, ShieldAlert, CalendarX, CalendarClock } from "lucide-react";
import type { DocumentStatus, ApprovalStatus } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ComplianceBadgeProps {
  isMandatory: boolean;
  status: DocumentStatus;
  approvalStatus: ApprovalStatus;
  renewalDate?: string | Date | null;
  expiryDate?: string | Date | null;
  hideApprovalChips?: boolean;
  className?: string;
  compact?: boolean;
}

export function ComplianceBadge({ isMandatory, status, approvalStatus, renewalDate, expiryDate, hideApprovalChips = false, className, compact = false }: ComplianceBadgeProps) {
  const now = new Date();
  const isPastRenewal = !!renewalDate && new Date(renewalDate as string) < now;

  interface ChipDef { label: string; Icon: typeof CheckCircle; cls: string; testId: string }
  const chips: ChipDef[] = [];

  if (isMandatory && status !== "compliant") {
    chips.push({ label: "Non Compliant", Icon: ShieldAlert, cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20", testId: "badge-non-compliant" });
  } else if (!isMandatory && status !== "approved" && !hideApprovalChips) {
    chips.push({ label: "Not Approved", Icon: ShieldAlert, cls: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20", testId: "badge-not-approved" });
  }

  if (isMandatory) {
    chips.push({ label: "Mandatory", Icon: ShieldCheck, cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20", testId: "badge-mandatory" });
  }

  if (isPastRenewal) {
    chips.push({ label: "Past Renewal Date", Icon: CalendarX, cls: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20", testId: "badge-past-renewal" });
  }

  if (chips.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {chips.map(chip => (
        <Badge
          key={chip.label}
          variant="outline"
          className={cn(compact ? "gap-1 text-[10px] px-1.5 py-0 font-medium" : "gap-1.5 font-medium", chip.cls)}
          data-testid={chip.testId}
        >
          <chip.Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
          {chip.label}
        </Badge>
      ))}
    </div>
  );
}

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  approvalStatus: ApprovalStatus;
  expiryDate?: string | Date | null;
  className?: string;
  compact?: boolean;
}

export function DocumentStatusBadge({ status, approvalStatus, expiryDate, className, compact = false }: DocumentStatusBadgeProps) {
  const now = new Date();
  let label: string;
  let Icon: typeof CheckCircle;
  let statusClassName: string;

  const expiry = expiryDate ? new Date(expiryDate as string) : null;
  const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 14;

  if (status === "overdue") {
    const isExpired = !!expiry && expiry < now;
    if (isExpired) {
      label = "Expired";
      Icon = CalendarX;
      statusClassName = "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20";
    } else {
      label = "Overdue";
      Icon = XCircle;
      statusClassName = "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20";
    }
  } else if (status === "approval_required") {
    label = "Approval Required";
    Icon = AlertTriangle;
    statusClassName = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20";
  } else if ((status === "compliant" || status === "approved") && isExpiringSoon) {
    label = "Expiring Soon";
    Icon = CalendarClock;
    statusClassName = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20";
  } else if (status === "compliant") {
    label = "Compliant";
    Icon = CheckCircle;
    statusClassName = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  } else if (status === "approved") {
    label = "Approved";
    Icon = CheckCircle;
    statusClassName = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  } else if (approvalStatus === "changes_requested") {
    label = "Changes Requested";
    Icon = AlertTriangle;
    statusClassName = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20";
  } else if (approvalStatus === "pending") {
    label = "Awaiting Sign-Off";
    Icon = Clock;
    statusClassName = "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20";
  } else if (approvalStatus === "client_signed_off") {
    label = "Awaiting Final Approval";
    Icon = UserCheck;
    statusClassName = "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20";
  } else if (approvalStatus === "approved") {
    label = "Approved";
    Icon = CheckCircle;
    statusClassName = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  } else {
    label = "Approval Required";
    Icon = AlertTriangle;
    statusClassName = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20";
  }

  return (
    <Badge
      variant="outline"
      className={cn(compact ? "gap-1 text-[10px] px-1.5 py-0 font-medium" : "gap-1.5 font-medium", statusClassName, className)}
      data-testid="badge-document-status"
    >
      <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label}
    </Badge>
  );
}

interface RAGBadgeProps {
  status: DocumentStatus;
  approvalStatus?: ApprovalStatus;
  expiryDate?: string | Date | null;
  className?: string;
}

export function RAGBadge({ status, approvalStatus, expiryDate, className }: RAGBadgeProps) {
  const now = new Date();
  if (approvalStatus === "client_signed_off") {
    return (
      <Badge 
        variant="outline" 
        className={cn("gap-1.5 font-medium", "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20", className)}
      >
        <ShieldCheck className="h-3 w-3" />
        Awaiting Final Approval
      </Badge>
    );
  }

  if (status === "overdue" && !!expiryDate && new Date(expiryDate as string) < now) {
    return (
      <Badge variant="outline" className={cn("gap-1.5 font-medium", "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20", className)}>
        <CalendarX className="h-3 w-3" />
        Expired
      </Badge>
    );
  }

  const config = {
    compliant: {
      label: "Compliant",
      icon: CheckCircle,
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
    approved: {
      label: "Approved",
      icon: CheckCircle,
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
    approval_required: {
      label: "Approval Required",
      icon: AlertTriangle,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    overdue: {
      label: "Overdue",
      icon: XCircle,
      className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
    },
  };

  const { label, icon: Icon, className: statusClassName } = config[status];

  return (
    <Badge 
      variant="outline" 
      className={cn("gap-1.5 font-medium", statusClassName, className)}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

interface ApprovalBadgeProps {
  status: ApprovalStatus;
  className?: string;
}

export function ApprovalBadge({ status, className }: ApprovalBadgeProps) {
  const config = {
    pending: {
      label: "Awaiting Sign-Off",
      icon: Clock,
      className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20",
    },
    client_signed_off: {
      label: "Awaiting Consultant Approval",
      icon: UserCheck,
      className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
    },
    approved: {
      label: "Approved",
      icon: CheckCircle,
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
    changes_requested: {
      label: "Changes Requested",
      icon: AlertTriangle,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
  };

  const { label, icon: Icon, className: statusClassName } = config[status];

  return (
    <Badge 
      variant="outline" 
      className={cn("gap-1.5 font-medium", statusClassName, className)}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

interface PriorityBadgeProps {
  priority: "low" | "medium" | "high" | "urgent";
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = {
    low: {
      label: "Low",
      className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20",
    },
    medium: {
      label: "Medium",
      className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
    },
    high: {
      label: "High",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    urgent: {
      label: "Urgent",
      className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
    },
  };

  const { label, className: priorityClassName } = config[priority];

  return (
    <Badge 
      variant="outline" 
      className={cn("font-medium", priorityClassName, className)}
    >
      {label}
    </Badge>
  );
}

interface SupportStatusBadgeProps {
  status: "open" | "in_progress" | "resolved" | "closed";
  className?: string;
}

export function SupportStatusBadge({ status, className }: SupportStatusBadgeProps) {
  const config = {
    open: {
      label: "Open",
      className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
    },
    in_progress: {
      label: "In Progress",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    resolved: {
      label: "Resolved",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
    closed: {
      label: "Closed",
      className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20",
    },
  };

  const { label, className: statusClassName } = config[status];

  return (
    <Badge 
      variant="outline" 
      className={cn("font-medium", statusClassName, className)}
    >
      {label}
    </Badge>
  );
}
