import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Clock, UserCheck, ShieldCheck, ShieldAlert, RotateCcw, CalendarOff } from "lucide-react";
import type { DocumentStatus, ApprovalStatus } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ComplianceBadgeProps {
  isRequired: boolean;
  status: DocumentStatus;
  approvalStatus: ApprovalStatus;
  className?: string;
}

export function ComplianceBadge({ isRequired, status, approvalStatus, className }: ComplianceBadgeProps) {
  if (!isRequired) {
    return null;
  }

  const statusConfig: Partial<Record<string, { label: string; Icon: typeof CheckCircle; cls: string }>> = {
    compliant: { label: "Compliant", Icon: CheckCircle, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    approval_required: { label: "Approval Required", Icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    overdue: { label: "Overdue", Icon: XCircle, cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
  };
  const primary = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {primary && (
        <Badge
          variant="outline"
          className={cn("gap-1.5 font-medium", primary.cls)}
          data-testid="badge-compliance-status"
        >
          <primary.Icon className="h-3 w-3" />
          {primary.label}
        </Badge>
      )}
      <Badge
        variant="outline"
        className="gap-1.5 font-medium bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20"
        data-testid="badge-compliance"
      >
        <ShieldAlert className="h-3 w-3" />
        Required
      </Badge>
    </div>
  );
}

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  approvalStatus: ApprovalStatus;
  className?: string;
}

export function DocumentStatusBadge({ status, approvalStatus, className }: DocumentStatusBadgeProps) {
  let label: string;
  let Icon: typeof CheckCircle;
  let statusClassName: string;

  if (status === "overdue") {
    label = "Overdue";
    Icon = XCircle;
    statusClassName = "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20";
  } else if (status === "approval_required") {
    label = "Approval Required";
    Icon = AlertTriangle;
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
  } else if (approvalStatus === "rejected") {
    label = "Rejected";
    Icon = XCircle;
    statusClassName = "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20";
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
      className={cn("gap-1.5 font-medium", statusClassName, className)}
      data-testid="badge-document-status"
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

interface RAGBadgeProps {
  status: DocumentStatus;
  approvalStatus?: ApprovalStatus;
  className?: string;
}

export function RAGBadge({ status, approvalStatus, className }: RAGBadgeProps) {
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

interface DocumentBadgesProps {
  isRequired?: boolean | null;
  status: DocumentStatus;
  approvalStatus: ApprovalStatus;
  renewalDate?: string | Date | null;
  expiryDate?: string | Date | null;
  className?: string;
}

export function DocumentBadges({
  isRequired,
  status,
  approvalStatus,
  renewalDate,
  expiryDate,
  className,
}: DocumentBadgesProps) {
  const now = new Date();
  const isPastRenewal = renewalDate ? new Date(renewalDate) < now : false;
  const isPastExpiry = expiryDate ? new Date(expiryDate) < now : false;
  const needsClientSignOff = approvalStatus === "pending";
  const needsConsultantApproval = approvalStatus === "client_signed_off";

  const statusConfig: Partial<Record<string, { label: string; Icon: typeof CheckCircle; cls: string }>> = {
    compliant: { label: "Compliant", Icon: CheckCircle, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    approved: { label: "Approved", Icon: CheckCircle, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    approval_required: { label: "Approval Required", Icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    overdue: { label: "Overdue", Icon: XCircle, cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
  };
  const primary = statusConfig[status] ?? statusConfig.approval_required!;

  return (
    <div className={cn("flex items-center gap-1 flex-wrap justify-end", className)}>
      <Badge variant="outline" className={cn("gap-1.5 font-medium", primary.cls)} data-testid="badge-doc-status">
        <primary.Icon className="h-3 w-3" />
        {primary.label}
      </Badge>
      {isRequired && (
        <Badge variant="outline" className="gap-1.5 font-medium bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" data-testid="badge-doc-required">
          <ShieldAlert className="h-3 w-3" />
          Required
        </Badge>
      )}
      {isPastRenewal && (
        <Badge variant="outline" className="gap-1.5 font-medium bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20" data-testid="badge-doc-past-renewal">
          <RotateCcw className="h-3 w-3" />
          Past Renewal Date
        </Badge>
      )}
      {isPastExpiry && (
        <Badge variant="outline" className="gap-1.5 font-medium bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20" data-testid="badge-doc-past-expiry">
          <CalendarOff className="h-3 w-3" />
          Past Expiry Date
        </Badge>
      )}
      {needsClientSignOff && (
        <Badge variant="outline" className="gap-1.5 font-medium bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20" data-testid="badge-doc-client-signoff">
          <UserCheck className="h-3 w-3" />
          Client Sign Off Required
        </Badge>
      )}
      {needsConsultantApproval && (
        <Badge variant="outline" className="gap-1.5 font-medium bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/20" data-testid="badge-doc-consultant-approval">
          <ShieldCheck className="h-3 w-3" />
          Consultant Approval Required
        </Badge>
      )}
    </div>
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
