"use client";

import Image from "next/image";
import { memo } from "react";
import {
  ImageIcon,
  MoreHorizontal,
  Phone,
  RefreshCcw,
  UserPlus2,
  XCircle,
  CheckCircle2,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
} from "@/constants/statuses";
import { wasaCategoryColor, wasaCategoryLabel } from "@/constants/wasaCategories";
import { derivePriority } from "@/lib/derivePriority";
import { formatTimeAgo } from "@/lib/formatters";
import { isOverdue } from "@/lib/derivePriority";
import { tsToDate } from "@/lib/firebase";
import type { Complaint, ComplaintStatus } from "@/types";

import { RoutingBadge } from "./RoutingBadge";
import { OverdueChip } from "./OverdueChip";

export interface ComplaintsGridProps {
  complaints: Complaint[];
  loading: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onView: (c: Complaint) => void;
  onQuickAssign: (c: Complaint) => void;
  onChangeStatus: (c: Complaint, next: ComplaintStatus) => void;
  employeeNamesByUid: Record<string, string>;
}

function ComplaintsGridImpl({
  complaints,
  loading,
  selectedIds,
  onToggleSelect,
  onView,
  onQuickAssign,
  onChangeStatus,
  employeeNamesByUid,
}: ComplaintsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[260px] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (complaints.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No complaints"
        description="Try adjusting your filters or selecting a different tab."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {complaints.map((c) => (
        <ComplaintCard
          key={c.id}
          complaint={c}
          selected={selectedIds.includes(c.id)}
          onToggleSelect={onToggleSelect}
          onView={onView}
          onQuickAssign={onQuickAssign}
          onChangeStatus={onChangeStatus}
          employeeNamesByUid={employeeNamesByUid}
        />
      ))}
    </div>
  );
}

interface CardProps {
  complaint: Complaint;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onView: (c: Complaint) => void;
  onQuickAssign: (c: Complaint) => void;
  onChangeStatus: (c: Complaint, next: ComplaintStatus) => void;
  employeeNamesByUid: Record<string, string>;
}

function ComplaintCard({
  complaint,
  selected,
  onToggleSelect,
  onView,
  onQuickAssign,
  onChangeStatus,
  employeeNamesByUid,
}: CardProps) {
  const cat = complaint.wasaCategory;
  const color = wasaCategoryColor(cat);
  const label = wasaCategoryLabel(cat);
  const priority = derivePriority(cat);
  const overdue = isOverdue(
    tsToDate(complaint.createdAt),
    complaint.complaintStatus,
  );
  const assigneeName = complaint.assignedTo
    ? employeeNamesByUid[complaint.assignedTo] ?? complaint.assignedTo
    : null;
  const isPending = complaint.complaintStatus === "action_required";
  const isDept = complaint.routingStrategy === "DEPT_DASHBOARD";
  const hasAssignee = !!complaint.assignedTo;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all hover:shadow-md dark:bg-slate-900",
        selected
          ? "border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900/40"
          : "border-slate-200 dark:border-slate-800",
      )}
    >
      {/* Image */}
      <button
        type="button"
        onClick={() => onView(complaint)}
        className="relative h-36 w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
        aria-label={`View ${complaint.complaintId || complaint.id}`}
      >
        {complaint.complaintImage ? (
          <Image
            src={complaint.complaintImage}
            alt={complaint.complaintId || "complaint"}
            width={400}
            height={300}
            unoptimized
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${color}33 0%, ${color}11 100%)`,
            }}
          >
            <ImageIcon className="h-8 w-8 text-slate-400" aria-hidden />
          </div>
        )}

        {/* Top-left: select checkbox */}
        <span
          className="absolute left-2 top-2 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(complaint.id);
          }}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(complaint.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 shadow focus:ring-brand-500"
          />
        </span>

        {/* Top-right: status + overdue */}
        <span className="absolute right-2 top-2 z-10 flex items-center gap-1">
          <Badge className={STATUS_BADGE[complaint.complaintStatus]}>
            {STATUS_LABELS[complaint.complaintStatus]}
          </Badge>
          {overdue && (
            <OverdueChip
              createdAt={complaint.createdAt}
              complaintStatus={complaint.complaintStatus}
            />
          )}
        </span>

        {/* Bottom: category strip */}
        <span
          className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-white"
          style={{
            background: `linear-gradient(to top, ${color}E6, ${color}99)`,
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-white/80"
            aria-hidden
          />
          <span className="truncate">{label}</span>
        </span>
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onView(complaint)}
              className="block truncate text-left text-sm font-bold text-slate-900 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
            >
              {complaint.complaintId || complaint.id}
            </button>
            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {[complaint.district, complaint.tahsil].filter(Boolean).join(" / ") ||
                "—"}
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              PRIORITY_BADGE[priority],
            )}
            title={PRIORITY_LABELS[priority]}
          >
            {PRIORITY_LABELS[priority]}
          </span>
        </div>

        {/* Complainant */}
        <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/50">
          <div className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
            {complaint.complainantName || "Anonymous"}
          </div>
          {complaint.complainantPhone && (
            <a
              href={`tel:${complaint.complainantPhone}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:underline dark:text-brand-400"
            >
              <Phone className="h-2.5 w-2.5" /> {complaint.complainantPhone}
            </a>
          )}
        </div>

        {/* Footer row */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <RoutingBadge value={complaint.routingStrategy} />
            <span className="truncate text-[11px] text-slate-400">
              {formatTimeAgo(complaint.createdAt)}
            </span>
          </div>
          <CardActionsMenu
            complaint={complaint}
            isPending={isPending}
            isDept={isDept}
            hasAssignee={hasAssignee}
            onView={onView}
            onQuickAssign={onQuickAssign}
            onChangeStatus={onChangeStatus}
          />
        </div>

        {/* Assignee row */}
        {assigneeName && (
          <div className="-mx-3 -mb-3 mt-1 flex items-center gap-2 border-t border-slate-100 bg-brand-50 px-3 py-1.5 text-[11px] dark:border-slate-800 dark:bg-brand-900/20">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
              {assigneeName.charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-brand-800 dark:text-brand-200">
              {assigneeName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface CardActionsMenuProps {
  complaint: Complaint;
  isPending: boolean;
  isDept: boolean;
  hasAssignee: boolean;
  onView: (c: Complaint) => void;
  onQuickAssign: (c: Complaint) => void;
  onChangeStatus: (c: Complaint, next: ComplaintStatus) => void;
}

function CardActionsMenu({
  complaint,
  isPending,
  isDept,
  hasAssignee,
  onView,
  onQuickAssign,
  onChangeStatus,
}: CardActionsMenuProps) {
  return (
    <div className="relative">
      <details className="group">
        <summary
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Card actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </summary>
        <ul className="absolute bottom-full right-0 z-20 mb-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <li>
            <button
              type="button"
              onClick={() => onView(complaint)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              View details
            </button>
          </li>
          {isDept && isPending && !hasAssignee && (
            <li>
              <button
                type="button"
                onClick={() => onQuickAssign(complaint)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <UserPlus2 className="h-3 w-3" /> Quick assign
              </button>
            </li>
          )}
          {isDept && isPending && hasAssignee && (
            <li>
              <button
                type="button"
                onClick={() => onQuickAssign(complaint)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCcw className="h-3 w-3" /> Reassign
              </button>
            </li>
          )}
          {isDept && isPending && hasAssignee && (
            <li>
              <button
                type="button"
                onClick={() => onChangeStatus(complaint, "action_taken")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              >
                <CheckCircle2 className="h-3 w-3" /> Mark resolved
              </button>
            </li>
          )}
          {isDept && isPending && (
            <li>
              <button
                type="button"
                onClick={() => onChangeStatus(complaint, "irrelevant")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <XCircle className="h-3 w-3" /> Mark irrelevant
              </button>
            </li>
          )}
        </ul>
      </details>
    </div>
  );
}

export const ComplaintsGrid = memo(ComplaintsGridImpl);

export default ComplaintsGrid;
