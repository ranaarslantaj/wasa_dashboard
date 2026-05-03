"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Info,
  MapPin,
  Phone,
  RefreshCcw,
  UserCircle2,
  UserPlus2,
  XCircle,
} from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useWasaEmployees } from "@/hooks/useWasaEmployees";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import {
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
} from "@/constants/statuses";
import {
  wasaCategoryColor,
  wasaCategoryLabel,
} from "@/constants/wasaCategories";
import { derivePriority } from "@/lib/derivePriority";
import {
  formatDateTime,
  formatResolutionTime,
  formatTimeAgo,
} from "@/lib/formatters";
import type { Complaint } from "@/types";
import { AssignEmployeePicker } from "./AssignEmployeePicker";
import { RoutingBadge } from "./RoutingBadge";
import { OverdueChip } from "./OverdueChip";
import { UnassignButton } from "./UnassignButton";

export interface ComplaintDetailModalProps {
  complaint: Complaint | null;
  open: boolean;
  onClose: () => void;
  onMutated: () => void;
}

export function ComplaintDetailModal({
  complaint,
  open,
  onClose,
  onMutated,
}: ComplaintDetailModalProps) {
  const { admin, adminScope } = useAuth();
  const toast = useToast();

  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  // Inline irrelevant-reason state
  const [markingIrrelevant, setMarkingIrrelevant] = useState<boolean>(false);
  const [irrelevantReason, setIrrelevantReason] = useState<string>("");

  useEffect(() => {
    setShowPicker(false);
    setMarkingIrrelevant(false);
    setIrrelevantReason("");
  }, [complaint?.id]);

  // Employees scoped to admin (used for picker + assignee lookup).
  const employeesFilters = useMemo(
    () =>
      open && complaint
        ? {
            scopeDistricts: adminScope
              ? adminScope.accessLevel === "tehsil" ||
                adminScope.accessLevel === "district"
                ? [complaint.district]
                : []
              : [],
            activeOnly: true,
            limit: 500,
          }
        : null,
    [open, complaint, adminScope]
  );
  const { data: employees, loading: employeesLoading } =
    useWasaEmployees(employeesFilters);

  const assignedEmployee = useMemo(() => {
    if (!complaint?.assignedTo) return null;
    return (
      employees.find(
        (e) => e.uid === complaint.assignedTo || e.id === complaint.assignedTo
      ) ?? null
    );
  }, [employees, complaint?.assignedTo]);

  /* -------------------------------------------------------------------- */
  /*                              Mutations                               */
  /* All writes target the Complaints document only — no extra collections */
  /* -------------------------------------------------------------------- */

  const handleAssign = useCallback(
    async (employeeId: string): Promise<void> => {
      if (!complaint || !admin) return;
      const employee = employees.find(
        (e) => e.uid === employeeId || e.id === employeeId
      );
      if (!employee) {
        toast.show({ type: "error", title: "Employee not found" });
        return;
      }
      const isReassign = !!complaint.assignedTo;
      setBusy(true);
      try {
        await updateDoc(doc(db, "Complaints", complaint.id), {
          assignedTo: employee.uid || employee.id,
          assignedToName: employee.name,
          assignedBy: admin.id,
          assignedByName: admin.name,
          assignedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.show({
          type: "success",
          title: isReassign ? "Complaint reassigned" : "Complaint assigned",
          description: `Assigned to ${employee.name}`,
        });
        setShowPicker(false);
        onMutated();
      } catch (err) {
        console.error(err);
        toast.show({
          type: "error",
          title: "Assignment failed",
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setBusy(false);
      }
    },
    [complaint, admin, employees, toast, onMutated]
  );

  const handleUnassign = useCallback(async (): Promise<void> => {
    if (!complaint || !admin) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "Complaints", complaint.id), {
        assignedTo: null,
        assignedToName: null,
        assignedBy: null,
        assignedByName: null,
        assignedAt: null,
        updatedAt: serverTimestamp(),
      });
      toast.show({ type: "success", title: "Complaint unassigned" });
      onMutated();
    } catch (err) {
      console.error(err);
      toast.show({
        type: "error",
        title: "Unassign failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [complaint, admin, toast, onMutated]);

  const handleMarkResolved = useCallback(async (): Promise<void> => {
    if (!complaint || !admin) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "Complaints", complaint.id), {
        complaintStatus: "action_taken",
        updatedAt: serverTimestamp(),
      });
      toast.show({ type: "success", title: "Marked as resolved" });
      onMutated();
    } catch (err) {
      console.error(err);
      toast.show({
        type: "error",
        title: "Failed to mark resolved",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [complaint, admin, toast, onMutated]);

  const handleMarkIrrelevant = useCallback(async (): Promise<void> => {
    if (!complaint || !admin) return;
    const reason = irrelevantReason.trim();
    if (!reason) {
      toast.show({ type: "warning", title: "Enter a reason to reject" });
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "Complaints", complaint.id), {
        complaintStatus: "irrelevant",
        reason,
        updatedAt: serverTimestamp(),
      });
      toast.show({ type: "success", title: "Marked irrelevant" });
      setMarkingIrrelevant(false);
      setIrrelevantReason("");
      onMutated();
    } catch (err) {
      console.error(err);
      toast.show({
        type: "error",
        title: "Action failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [complaint, admin, irrelevantReason, toast, onMutated]);

  /* -------------------------------------------------------------------- */
  /*                              Derived UI                              */
  /* -------------------------------------------------------------------- */

  const coords = complaint?.complainCoordinates;
  const mapsHref =
    coords && typeof coords.lat === "number" && typeof coords.lng === "number"
      ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
      : null;

  const actionCoords = complaint?.actionCoordinates;
  const actionMapsHref =
    actionCoords &&
    typeof actionCoords.lat === "number" &&
    typeof actionCoords.lng === "number"
      ? `https://www.google.com/maps?q=${actionCoords.lat},${actionCoords.lng}`
      : null;

  if (!complaint) {
    return null;
  }

  const isUcMcAuto = complaint.routingStrategy === "UC_MC_AUTO";
  const isDeptDashboard = complaint.routingStrategy === "DEPT_DASHBOARD";
  const hasAssignee = !!complaint.assignedTo;
  const isPending = complaint.complaintStatus === "action_required";
  const isResolved = complaint.complaintStatus === "action_taken";

  const derivedPriority = derivePriority(complaint.wasaCategory);
  const categoryColor = wasaCategoryColor(complaint.wasaCategory);
  const categoryLabel = wasaCategoryLabel(complaint.wasaCategory);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title={undefined}
      className="max-w-3xl"
      bodyClassName="p-0"
      scrollBody
      footer={
        <Button
          variant={isResolved ? "primary" : "ghost"}
          size="sm"
          onClick={onClose}
          disabled={busy}
        >
          Close
        </Button>
      }
    >
      {/* ---------------- Compact header ---------------- */}
      <header
        className="border-b border-slate-200 px-5 pb-3 pt-5 dark:border-slate-800"
        style={{
          background: `linear-gradient(135deg, ${categoryColor}10 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: categoryColor }}
                aria-hidden
              />
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: categoryColor }}
              >
                {categoryLabel}
              </span>
            </div>
            <h2 className="mt-1 truncate text-xl font-bold text-slate-900 dark:text-slate-100">
              {complaint.complaintId || complaint.id}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Filed {formatTimeAgo(complaint.createdAt)} ·{" "}
              {[complaint.district, complaint.tahsil].filter(Boolean).join(" / ") ||
                "Unknown"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Badge className={STATUS_BADGE[complaint.complaintStatus]}>
              {STATUS_LABELS[complaint.complaintStatus]}
            </Badge>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                PRIORITY_BADGE[derivedPriority],
              )}
            >
              {PRIORITY_LABELS[derivedPriority]}
            </span>
            <RoutingBadge value={complaint.routingStrategy} />
            <OverdueChip
              createdAt={complaint.createdAt}
              complaintStatus={complaint.complaintStatus}
            />
          </div>
        </div>
      </header>

      {/* ---------------- Hero (single or before/after) ---------------- */}
      <div className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40">
        {isResolved && complaint.actionImage ? (
          <div className="grid h-40 grid-cols-2 gap-px bg-slate-300 dark:bg-slate-700 sm:h-52">
            <HeroPhoto
              src={complaint.complaintImage}
              alt={`Before — ${complaint.complaintId}`}
              fallbackLabel="No before photo"
              fallbackColor={categoryColor}
              tag="Before"
              tagClass="bg-amber-500/95"
            />
            <HeroPhoto
              src={complaint.actionImage}
              alt={`After — ${complaint.complaintId}`}
              fallbackLabel="No after photo"
              fallbackColor={categoryColor}
              tag="After"
              tagClass="bg-emerald-500/95"
            />
          </div>
        ) : (
          <div className="h-40 w-full sm:h-52">
            <HeroPhoto
              src={complaint.complaintImage}
              alt={`Complaint ${complaint.complaintId}`}
              fallbackLabel="No attached image"
              fallbackColor={categoryColor}
            />
          </div>
        )}
      </div>

      {/* ---------------- Body ---------------- */}
      <div className="space-y-4 p-5">
        {/* Description */}
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Description
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">
            {complaint.description || "—"}
          </p>
        </section>

        {/* Two-column compact info grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoCard icon={<UserCircle2 className="h-3.5 w-3.5" />} title="Complainant">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {complaint.complainantName || "—"}
            </div>
            <div className="mt-1.5 space-y-0.5">
              {complaint.complainantPhone && (
                <a
                  href={`tel:${complaint.complainantPhone}`}
                  className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline dark:text-brand-400"
                >
                  <Phone className="h-3 w-3" /> {complaint.complainantPhone}
                </a>
              )}
              {complaint.complainantCnic && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  CNIC · {complaint.complainantCnic}
                </div>
              )}
              {complaint.complainantAddress && (
                <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {complaint.complainantAddress}
                </div>
              )}
            </div>
          </InfoCard>

          <InfoCard icon={<MapPin className="h-3.5 w-3.5" />} title="Location">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {[complaint.district, complaint.tahsil].filter(Boolean).join(" / ") ||
                "—"}
            </div>
            <div className="mt-1.5 space-y-0.5">
              {complaint.ucId && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {complaint.ucMcType}-{complaint.ucMcNumber}
                </div>
              )}
              {complaint.address && (
                <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {complaint.address}
                </div>
              )}
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
                >
                  Open in Maps <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </InfoCard>
        </div>

        {/* Assignment / Routing panel */}
        {isUcMcAuto && (
          <section className="flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50 p-3.5 dark:border-purple-900/40 dark:bg-purple-900/10">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-purple-700 dark:text-purple-300" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                Auto-routed to {complaint.ucMcType}-{complaint.ucMcNumber}
              </div>
              <p className="mt-0.5 text-xs text-purple-800 dark:text-purple-300">
                Resolution is handled by the UC/MC. This complaint is read-only
                here.
              </p>
            </div>
          </section>
        )}

        {isDeptDashboard && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <UserCircle2 className="h-4 w-4 text-brand-600" /> Assignment
              </h3>
              {!showPicker && hasAssignee && isPending && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPicker(true)}
                  leftIcon={<RefreshCcw className="h-3.5 w-3.5" />}
                >
                  Reassign
                </Button>
              )}
            </div>

            <div className="p-4">
              {showPicker ? (
                <AssignEmployeePicker
                  complaint={{
                    wasaCategory: complaint.wasaCategory,
                    division: complaint.division,
                    district: complaint.district,
                    tahsil: complaint.tahsil,
                  }}
                  employees={employees}
                  loading={employeesLoading}
                  onAssign={(employeeId) => handleAssign(employeeId)}
                  onCancel={() => setShowPicker(false)}
                  submitLabel={hasAssignee ? "Reassign" : "Assign"}
                />
              ) : hasAssignee ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white shadow">
                    {(assignedEmployee?.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {assignedEmployee?.name ??
                        (employeesLoading ? "Loading…" : complaint.assignedTo)}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-[11px] text-slate-500 dark:text-slate-400">
                      {assignedEmployee?.designation && (
                        <span className="truncate">{assignedEmployee.designation}</span>
                      )}
                      {assignedEmployee?.phone && (
                        <a
                          href={`tel:${assignedEmployee.phone}`}
                          className="inline-flex items-center gap-0.5 text-brand-600 hover:underline dark:text-brand-300"
                        >
                          <Phone className="h-2.5 w-2.5" /> {assignedEmployee.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                isPending && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                      <UserPlus2 className="h-5 w-5 text-slate-400" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Not assigned yet.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowPicker(true)}
                      leftIcon={<UserPlus2 className="h-3.5 w-3.5" />}
                    >
                      Assign
                    </Button>
                  </div>
                )
              )}

              {/* Quick actions */}
              {isPending && !showPicker && hasAssignee && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={busy}
                    onClick={handleMarkResolved}
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  >
                    Mark resolved
                  </Button>
                  {!markingIrrelevant && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setMarkingIrrelevant(true);
                        setIrrelevantReason("");
                      }}
                      leftIcon={<XCircle className="h-4 w-4" />}
                    >
                      Mark irrelevant
                    </Button>
                  )}
                  <UnassignButton onConfirm={handleUnassign} loading={busy} />
                </div>
              )}

              {isPending && !showPicker && !hasAssignee && !markingIrrelevant && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setMarkingIrrelevant(true);
                      setIrrelevantReason("");
                    }}
                    leftIcon={<XCircle className="h-4 w-4" />}
                  >
                    Mark irrelevant
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Inline irrelevant reason */}
        {markingIrrelevant && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" /> Mark complaint irrelevant
            </h3>
            <textarea
              value={irrelevantReason}
              onChange={(e) => setIrrelevantReason(e.target.value)}
              rows={3}
              placeholder="Why is this complaint being rejected?"
              className="block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMarkingIrrelevant(false);
                  setIrrelevantReason("");
                }}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={busy}
                onClick={handleMarkIrrelevant}
              >
                Confirm
              </Button>
            </div>
          </section>
        )}

        {/* Resolution summary (read-only) */}
        {complaint.actionTakenAt && (
          <section className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-900/10">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Resolved {formatTimeAgo(complaint.actionTakenAt)}
                <span className="font-normal text-emerald-700/80 dark:text-emerald-300/80">
                  {" "}
                  · took{" "}
                  {formatResolutionTime(
                    complaint.createdAt,
                    complaint.actionTakenAt,
                  )}
                </span>
              </div>
              {actionMapsHref && (
                <a
                  href={actionMapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  Action location in Maps <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </section>
        )}

        {/* Rejection reason (only when rejected) */}
        {complaint.complaintStatus === "irrelevant" && complaint.reason && (
          <section className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 dark:border-red-900/40 dark:bg-red-900/10">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
                Rejection reason
              </div>
              <p className="mt-0.5 text-sm text-red-900 dark:text-red-200">
                {complaint.reason}
              </p>
            </div>
          </section>
        )}

        {/* Timestamps strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stamp label="Created" value={formatDateTime(complaint.createdAt)} />
          <Stamp label="Updated" value={formatDateTime(complaint.updatedAt)} />
          <Stamp
            label="Assigned"
            value={
              complaint.assignedAt ? formatDateTime(complaint.assignedAt) : "—"
            }
          />
          <Stamp
            label="Action taken"
            value={
              complaint.actionTakenAt
                ? formatDateTime(complaint.actionTakenAt)
                : "—"
            }
          />
        </div>
      </div>

    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Local presentational helpers                                              */
/* -------------------------------------------------------------------------- */

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function HeroPhoto({
  src,
  alt,
  fallbackLabel,
  fallbackColor,
  tag,
  tagClass,
}: {
  src: string | null | undefined;
  alt: string;
  fallbackLabel: string;
  fallbackColor: string;
  tag?: string;
  tagClass?: string;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={600}
          unoptimized
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${fallbackColor}33 0%, ${fallbackColor}11 100%)`,
          }}
        >
          <div className="flex flex-col items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <ImageIcon className="h-8 w-8" aria-hidden />
            <span className="text-xs">{fallbackLabel}</span>
          </div>
        </div>
      )}
      {tag && (
        <span
          className={cn(
            "absolute left-3 top-3 z-10 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur",
            tagClass,
          )}
        >
          {tag}
        </span>
      )}
    </div>
  );
}

function Stamp({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-2.5 py-1.5 dark:border-slate-800">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="truncate text-xs text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}


export default ComplaintDetailModal;
