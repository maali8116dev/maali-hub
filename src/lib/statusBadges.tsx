import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Users, RefreshCw } from "lucide-react";
import { ReactNode } from "react";
import type { TFunction } from "i18next";
import i18n from "@/lib/i18n";

export interface ReviewProgress {
  completed: number;
  total: number;
}

type CommonT = TFunction<readonly ["common"], undefined>;

function resolveT(t?: TFunction): CommonT {
  if (t) {
    return ((key: string, options?: Record<string, unknown>) =>
      t(key, { ns: "common", ...options })) as CommonT;
  }
  return ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { ns: "common", ...options })) as CommonT;
}

export function getApplicationStatusLabel(status: string, t?: TFunction): string {
  const tr = resolveT(t);
  const key = `status.application.${status}` as const;
  const translated = tr(key);
  if (translated !== key) return translated;
  return status;
}

/**
 * Get application status badge (returns className string for simple badges)
 */
export function getApplicationStatusBadgeClassName(status: string): string {
  const styles: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/20",
    pending_payment: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    approved: "bg-success/10 text-success border-success/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
    draft: "bg-muted text-muted-foreground border-border",
    under_review: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  };
  return styles[status] || styles.pending;
}

/**
 * Get application status badge component (returns JSX for badges with icons)
 */
export function getApplicationStatusBadge(
  status: string,
  reviewProgress?: ReviewProgress,
  t?: TFunction,
): ReactNode {
  const tr = resolveT(t);
  const label = getApplicationStatusLabel(status, tr);

  switch (status) {
    case "pending":
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    case "pending_payment":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400">
          <Clock className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    case "under_review":
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400">
          <Users className="h-3 w-3 mr-1" />
          {label}
          {reviewProgress && (
            <span className="ml-1 text-xs">
              ({reviewProgress.completed}/{reviewProgress.total})
            </span>
          )}
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
          <XCircle className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

/**
 * Get project status badge component
 */
export function getProjectStatusBadge(status: string, t?: TFunction): ReactNode {
  const tr = resolveT(t);
  const labelKey = `status.opportunity.${status === "closing-soon" ? "closingSoon" : status}` as const;
  const label = tr(labelKey, { defaultValue: status });

  switch (status) {
    case "open":
      return <Badge className="bg-success text-success-foreground">{label}</Badge>;
    case "closing-soon":
      return <Badge className="bg-warning text-warning-foreground">{label}</Badge>;
    case "closed":
      return <Badge variant="secondary">{label}</Badge>;
    case "new":
      return <Badge variant="default">{label}</Badge>;
    case "archived":
      return <Badge className="bg-slate-500 text-white">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

/**
 * Get payment/transaction status badge component
 */
export function getPaymentStatusBadge(status: string, t?: TFunction): ReactNode {
  const tr = resolveT(t);
  const label = tr(`status.payment.${status}` as const, { defaultValue: status });

  switch (status) {
    case "completed":
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    case "pending":
    case "processing":
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    case "failed":
    case "cancelled":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
          <XCircle className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    case "refunded":
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          <RefreshCw className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}
