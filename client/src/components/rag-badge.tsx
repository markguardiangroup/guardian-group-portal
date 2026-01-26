import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Clock, UserCheck, ShieldCheck } from "lucide-react";
import type { DocumentStatus, ApprovalStatus } from "@shared/schema";
import { cn } from "@/lib/utils";

interface RAGBadgeProps {
  status: DocumentStatus;
  approvalStatus?: ApprovalStatus;
  className?: string;
}

export function RAGBadge({ status, approvalStatus, className }: RAGBadgeProps) {
  // Enhanced logic: if client_signed_off, show more specific messaging
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

  const config = {
    compliant: {
      label: "Compliant",
      icon: CheckCircle,
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
    review_required: {
      label: "Review Required",
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
    rejected: {
      label: "Rejected",
      icon: XCircle,
      className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
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
