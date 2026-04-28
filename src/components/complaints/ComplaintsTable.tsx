"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  Eye,
  MoreHorizontal,
  UserMinus2,
  UserPlus2,
  RefreshCcw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  ScrollableTable,
  Table,
  TBody,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  STATUS_BADGE,
  STATUS_LABELS,
} from "@/constants/statuses";
import {
  wasaCategoryColor,
  wasaCategoryLabel,
} from "@/constants/wasaCategories";
import { formatTimeAgo } from "@/lib/formatters";
import type { Complaint } from "@/types";
import { MessageSquareWarning } from "lucide-react";
import { RoutingBadge } from "./RoutingBadge";
import { OverdueChip } from "./OverdueChip";

export interface ComplaintsTableProps {
  complaints: Complaint[];
  loading: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (v: boolean) => void;
  onView: (c: Complaint) => void;
  onQuickAssign: (c: Complaint) => void;
  onReassign: (c: Complaint) => void;
  onUnassign: (c: Complaint) => void;
  onMarkResolved: (c: Complaint) => void;
  onMarkIrrelevant: (c: Complaint) => void;
  /** Map of employee uid -> friendly name (built from useWasaEmployees on the page). */
  employeeNamesByUid: Record<string, string>;
}

const HEADER_TH_CLASS =
  "sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800";

interface RowMenuProps {
  complaint: Complaint;
  onView: (c: Complaint) => void;
  onQuickAssign: (c: Complaint) => void;
  onReassign: (c: Complaint) => void;
  onUnassign: (c: Complaint) => void;
  onMarkResolved: (c: Complaint) => void;
  onMarkIrrelevant: (c: Complaint) => void;
}

function RowMenu({
  complaint,
  onView,
  onQuickAssign,
  onReassign,
  onUnassign,
  onMarkResolved,
  onMarkIrrelevant,
}: RowMenuProps) {
  const [open, setOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const close = (): void => setOpen(false);

  const canQuickAssign =
    complaint.routingStrategy === "DEPT_DASHBOARD" && !complaint.assignedTo;
  const hasAssignee = !!complaint.assignedTo;
  const isPending = complaint.complaintStatus === "action_required";

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="Row actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              onView(complaint);
              close();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Eye className="h-4 w-4" /> View details
          </button>
          {canQuickAssign && (
            <button
              type="button"
              onClick={() => {
                onQuickAssign(complaint);
                close();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <UserPlus2 className="h-4 w-4" /> Quick assign
            </button>
          )}
          {hasAssignee && (
            <button
              type="button"
              onClick={() => {
                onReassign(complaint);
                close();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCcw className="h-4 w-4" /> Reassign
            </button>
          )}
          {hasAssignee && (
            <button
              type="button"
              onClick={() => {
                onUnassign(complaint);
                close();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <UserMinus2 className="h-4 w-4" /> Unassign
            </button>
          )}
          {isPending && (
            <>
              <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
              <button
                type="button"
                onClick={() => {
                  onMarkResolved(complaint);
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
              >
                <CheckCircle2 className="h-4 w-4" /> Mark resolved
              </button>
              <button
                type="button"
                onClick={() => {
                  onMarkIrrelevant(complaint);
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <XCircle className="h-4 w-4" /> Mark irrelevant
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ComplaintsTableImpl({
  complaints,
  loading,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onQuickAssign,
  onReassign,
  onUnassign,
  onMarkResolved,
  onMarkIrrelevant,
  employeeNamesByUid,
}: ComplaintsTableProps) {
  const allSelected =
    complaints.length > 0 &&
    complaints.every((c) => selectedIds.includes(c.id));
  const someSelected =
    !allSelected && complaints.some((c) => selectedIds.includes(c.id));

  return (
    <ScrollableTable>
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH className={cn(HEADER_TH_CLASS, "w-10")}>
              <input
                type="checkbox"
                aria-label="Select all visible"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={(e) => onToggleSelectAll(e.target.checked)}
              />
            </TH>
            <TH className={HEADER_TH_CLASS}>Complaint ID</TH>
            <TH className={HEADER_TH_CLASS}>Category</TH>
            <TH className={HEADER_TH_CLASS}>Complainant</TH>
            <TH className={HEADER_TH_CLASS}>Location</TH>
            <TH className={HEADER_TH_CLASS}>Routing</TH>
            <TH className={HEADER_TH_CLASS}>Status</TH>
            <TH className={HEADER_TH_CLASS}>Assignee</TH>
            <TH className={HEADER_TH_CLASS}>Created</TH>
            <TH className={cn(HEADER_TH_CLASS, "text-right pr-4")}>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr
                key={`sk-${i}`}
                className="border-b border-slate-200 dark:border-slate-800"
              >
                {Array.from({ length: 10 }).map((__, j) => (
                  <td key={j} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))
          ) : complaints.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-6">
                <EmptyState
                  icon={MessageSquareWarning}
                  title="No complaints match your filters"
                  description="Adjust your filters or reset to view all accessible complaints."
                />
              </td>
            </tr>
          ) : (
            complaints.map((c) => {
              const dotColor = wasaCategoryColor(c.wasaCategory);
              const catLabel = wasaCategoryLabel(c.wasaCategory);
              const isSelected = selectedIds.includes(c.id);
              const assigneeName = c.assignedTo
                ? employeeNamesByUid[c.assignedTo] ?? c.assignedTo
                : null;
              const ucDisplay = c.ucMcNumber || "—";
              return (
                <TR
                  key={c.id}
                  className={cn(
                    "cursor-pointer",
                    isSelected && "bg-brand-50/40 dark:bg-brand-900/10"
                  )}
                  onClick={() => onView(c)}
                >
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.complaintId || c.id}`}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      checked={isSelected}
                      onChange={() => onToggleSelect(c.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {c.complaintId || c.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: dotColor }}
                        aria-hidden
                      />
                      <span className="text-slate-700 dark:text-slate-200">
                        {catLabel}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 dark:text-slate-100">
                      {c.complainantName || "-"}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {c.complainantPhone || ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    <div className="text-sm">
                      {[c.district, c.tahsil, ucDisplay]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoutingBadge value={c.routingStrategy} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_BADGE[c.complaintStatus]}>
                      {STATUS_LABELS[c.complaintStatus]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {assigneeName ? (
                      <span className="text-slate-700 dark:text-slate-200">
                        {assigneeName}
                      </span>
                    ) : (
                      <span className="text-xs italic text-slate-400 dark:text-slate-500">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatTimeAgo(c.createdAt)}
                      </span>
                      <OverdueChip
                        createdAt={c.createdAt}
                        complaintStatus={c.complaintStatus}
                      />
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowMenu
                      complaint={c}
                      onView={onView}
                      onQuickAssign={onQuickAssign}
                      onReassign={onReassign}
                      onUnassign={onUnassign}
                      onMarkResolved={onMarkResolved}
                      onMarkIrrelevant={onMarkIrrelevant}
                    />
                  </td>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>
    </ScrollableTable>
  );
}

export const ComplaintsTable = memo(ComplaintsTableImpl);
export default ComplaintsTable;
