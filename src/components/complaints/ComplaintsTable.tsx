"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Eye, MoreHorizontal, Trash2, UserPlus2, RefreshCcw } from "lucide-react";
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
import { cn } from "@/lib/cn";
import {
  COMPLAINT_STATUSES,
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
} from "@/constants/statuses";
import { COMPLAINT_TYPE_FALLBACK } from "@/constants/complaintTypes";
import { formatTimeAgo } from "@/lib/formatters";
import type { Complaint, ComplaintStatus } from "@/types";
import { MessageSquareWarning } from "lucide-react";

export interface ComplaintsTableProps {
  complaints: Complaint[];
  loading: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (v: boolean) => void;
  onView: (c: Complaint) => void;
  onQuickAssign: (c: Complaint) => void;
  onChangeStatus: (c: Complaint, nextStatus: ComplaintStatus) => void;
  onDelete: (c: Complaint) => void;
}

const HEADER_TH_CLASS =
  "sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800";

function RowMenu({
  complaint,
  onView,
  onQuickAssign,
  onChangeStatus,
  onDelete,
}: {
  complaint: Complaint;
  onView: (c: Complaint) => void;
  onQuickAssign: (c: Complaint) => void;
  onChangeStatus: (c: Complaint, nextStatus: ComplaintStatus) => void;
  onDelete: (c: Complaint) => void;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [statusOpen, setStatusOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const close = (): void => {
    setOpen(false);
    setStatusOpen(false);
  };

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
          setStatusOpen(false);
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setStatusOpen((s) => !s)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" /> Change status
              </span>
              <span className="text-xs text-slate-400">›</span>
            </button>
            {statusOpen && (
              <div className="absolute left-full top-0 ml-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {COMPLAINT_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      onChangeStatus(complaint, s.value);
                      close();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                      complaint.status === s.value && "font-semibold"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        STATUS_BADGE[s.value]
                      )}
                      aria-hidden
                    />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
          <button
            type="button"
            onClick={() => {
              onDelete(complaint);
              close();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
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
  onChangeStatus,
  onDelete,
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
            <TH className={HEADER_TH_CLASS}>Type</TH>
            <TH className={HEADER_TH_CLASS}>Complainant</TH>
            <TH className={HEADER_TH_CLASS}>Location</TH>
            <TH className={HEADER_TH_CLASS}>Priority</TH>
            <TH className={HEADER_TH_CLASS}>Status</TH>
            <TH className={HEADER_TH_CLASS}>Assignee</TH>
            <TH className={HEADER_TH_CLASS}>Created</TH>
            <TH className={cn(HEADER_TH_CLASS, "text-right pr-4")}>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-b border-slate-200 dark:border-slate-800">
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
              const type = COMPLAINT_TYPE_FALLBACK[c.complaintType];
              const typeLabel = type?.label ?? c.complaintType;
              const typeColor = type?.color ?? "#94a3b8";
              const isSelected = selectedIds.includes(c.id);
              return (
                <TR
                  key={c.id}
                  className={cn(
                    "cursor-pointer",
                    isSelected && "bg-brand-50/40 dark:bg-brand-900/10"
                  )}
                  onClick={() => onView(c)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                        style={{ backgroundColor: typeColor }}
                        aria-hidden
                      />
                      <span className="text-slate-700 dark:text-slate-200">
                        {typeLabel}
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
                      {[c.district, c.tehsil].filter(Boolean).join(" · ") || "-"}
                    </div>
                    {c.ucName && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {c.ucName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        PRIORITY_BADGE[c.priority] ?? PRIORITY_BADGE.low
                      )}
                    >
                      {PRIORITY_LABELS[c.priority] ?? c.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        STATUS_BADGE[c.status] ?? STATUS_BADGE.pending
                      )}
                    >
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.assignedToName ? (
                      <span className="text-slate-700 dark:text-slate-200">
                        {c.assignedToName}
                      </span>
                    ) : (
                      <span className="text-xs italic text-slate-400 dark:text-slate-500">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {formatTimeAgo(c.createdAt)}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowMenu
                      complaint={c}
                      onView={onView}
                      onQuickAssign={onQuickAssign}
                      onChangeStatus={onChangeStatus}
                      onDelete={onDelete}
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
