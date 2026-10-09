import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  discovered: "bg-slate-100 text-slate-700",
  filtered_out: "bg-slate-100 text-slate-500",
  qualified: "bg-emerald-100 text-emerald-800",
  disqualified: "bg-slate-100 text-slate-500",
  proposal_generated: "bg-blue-100 text-blue-800",
  awaiting_approval: "bg-amber-100 text-amber-800",
  ready_for_manual_submission: "bg-violet-100 text-violet-800",
  submitted: "bg-blue-600 text-white",
  rejected_by_user: "bg-slate-200 text-slate-600",
  won: "bg-emerald-600 text-white",
  lost: "bg-rose-100 text-rose-700",
  expired: "bg-slate-100 text-slate-500",
  draft: "bg-slate-100 text-slate-700",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-700",
  withdrawn: "bg-slate-200 text-slate-600",
  pending: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800",
  failed: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-200 text-slate-600",
  running: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  skipped: "bg-slate-100 text-slate-500",
  working: "bg-emerald-100 text-emerald-800",
  requires_credentials: "bg-amber-100 text-amber-800",
  requires_approval: "bg-violet-100 text-violet-800",
  manual_only: "bg-slate-100 text-slate-600",
  unsupported: "bg-rose-100 text-rose-700",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", STYLES[status], className)}>
      {status.replace(/_/g, " ").toUpperCase()}
    </Badge>
  );
}
