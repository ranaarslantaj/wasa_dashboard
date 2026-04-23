"use client";

import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/Badge";
import type { Assignment, AssignmentStatus } from "@/types";

const DOT_COLORS: Record<AssignmentStatus, string> = {
  assigned: "bg-blue-500",
  in_progress: "bg-amber-500",
  resolved: "bg-emerald-500",
  reassigned: "bg-purple-500",
  rejected: "bg-red-500",
};

const BADGE_CLASS: Record<AssignmentStatus, string> = {
  assigned: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  resolved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  reassigned:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  reassigned: "Reassigned",
  rejected: "Rejected",
};

export interface AssignmentTimelineProps {
  assignments: Assignment[];
}

export function AssignmentTimeline({ assignments }: AssignmentTimelineProps) {
  if (!assignments.length) {
    return (
      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
        No assignments.
      </p>
    );
  }

  return (
    <ol className="relative ml-2 border-l border-slate-200 pl-6 dark:border-slate-800">
      {assignments.map((a) => (
        <li key={a.id} className="relative pb-6 last:pb-0">
          <span
            className={cn(
              "absolute -left-[33px] top-1.5 inline-block h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-900",
              DOT_COLORS[a.status] ?? "bg-slate-400",
            )}
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatDateTime(a.timestamp)}</span>
              <Badge className={BADGE_CLASS[a.status]}>
                {STATUS_LABEL[a.status] ?? a.status}
              </Badge>
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {a.employeeName || "Unknown employee"}
            </p>
            {a.assignedByName && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                by {a.assignedByName}
              </p>
            )}
            {a.notes && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {a.notes}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default AssignmentTimeline;
