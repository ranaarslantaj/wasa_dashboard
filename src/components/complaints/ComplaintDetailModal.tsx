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
      className="max-w-5xl"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {/* -------------------- LEFT: Image -------------------- */}
        <div>
          <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            {complaint.complaintImage ? (
              <Image
                src={complaint.complaintImage}
                alt={`Complaint ${complaint.complaintId}`}
                width={800}
                height={600}
                unoptimized
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <ImageIcon className="h-10 w-10" aria-hidden />
                <span className="text-sm">No attached image</span>
              </div>
            )}
          </div>
        </div>

        {/* -------------------- RIGHT: Metadata -------------------- */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${categoryColor}20`,
                color: categoryColor,
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: categoryColor }}
                aria-hidden
              />
              {categoryLabel}
            </span>
            <RoutingBadge value={complaint.routingStrategy} />
            <Badge className={STATUS_BADGE[complaint.complaintStatus]}>
              {STATUS_LABELS[complaint.complaintStatus]}
            </Badge>
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                PRIORITY_BADGE[derivedPriority]
              )}
            >
              {PRIORITY_LABELS[derivedPriority]}
            </span>
            <OverdueChip
              createdAt={complaint.createdAt}
              complaintStatus={complaint.complaintStatus}
            />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {complaint.complaintId || complaint.id}
            </h2>
          </div>

          {/* Complainant */}
          <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <UserCircle2 className="h-4 w-4" /> Complainant
            </h3>
            <div className="text-sm text-slate-900 dark:text-slate-100">
              {complaint.complainantName || "-"}
            </div>
            {complaint.complainantPhone && (
              <a
                href={`tel:${complaint.complainantPhone}`}
                className="mt-1 flex items-center gap-1.5 text-sm text-brand-600 hover:underline dark:text-brand-400"
              >
                <Phone className="h-3.5 w-3.5" /> {complaint.complainantPhone}
              </a>
            )}
            {complaint.complainantCnic && (
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                CNIC: {complaint.complainantCnic}
              </div>
            )}
            {complaint.complainantAddress && (
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {complaint.complainantAddress}
              </div>
            )}
          </section>

          {/* Location */}
          <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <MapPin className="h-4 w-4" /> Location
            </h3>
            <div className="text-sm text-slate-900 dark:text-slate-100">
              {[complaint.district, complaint.tahsil].filter(Boolean).join(" / ") ||
                "-"}
            </div>
            {complaint.ucId && (
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {complaint.ucMcType}-{complaint.ucMcNumber}
              </div>
            )}
            {complaint.address && (
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {complaint.address}
              </div>
            )}
            {coords && (
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {typeof coords.lat === "number"
                    ? coords.lat.toFixed(5)
                    : "-"}
                  ,{" "}
                  {typeof coords.lng === "number"
                    ? coords.lng.toFixed(5)
                    : "-"}
                </span>
                {mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Open in Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </section>

          {/* Description */}
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Description
            </h3>
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
              {complaint.description || "-"}
            </p>
          </section>

          {/* Timestamps */}
          <section className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-slate-500 dark:text-slate-400">Created</div>
              <div className="text-slate-900 dark:text-slate-100">
                {formatDateTime(complaint.createdAt)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Updated</div>
              <div className="text-slate-900 dark:text-slate-100">
                {formatDateTime(complaint.updatedAt)}
              </div>
            </div>
            {complaint.assignedAt && (
              <div>
                <div className="text-slate-500 dark:text-slate-400">
                  Assigned at
                </div>
                <div className="text-slate-900 dark:text-slate-100">
                  {formatDateTime(complaint.assignedAt)}
                </div>
              </div>
            )}
            {complaint.actionTakenAt && (
              <div>
                <div className="text-slate-500 dark:text-slate-400">
                  Action taken at
                </div>
                <div className="text-slate-900 dark:text-slate-100">
                  {formatDateTime(complaint.actionTakenAt)}
                </div>
              </div>
            )}
          </section>

          {/* Reason (irrelevant) */}
          {complaint.complaintStatus === "irrelevant" && complaint.reason && (
            <section className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-900/10">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                Rejection reason
              </h3>
              <p className="text-sm text-red-900 dark:text-red-200">
                {complaint.reason}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* -------------------- Action panel -------------------- */}
      {isUcMcAuto && (
        <section className="mt-5 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/40 dark:bg-purple-900/10">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 shrink-0 text-purple-700 dark:text-purple-300" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                Auto-routed to {complaint.ucMcType}-{complaint.ucMcNumber}
              </div>
              <p className="mt-0.5 text-xs text-purple-800 dark:text-purple-300">
                Resolution handled by the UC/MC. The dashboard cannot modify this
                complaint.
              </p>
            </div>
          </div>
        </section>
      )}

      {isDeptDashboard && (
        <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Assignment
            </h3>
            {!showPicker && hasAssignee && isPending && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPicker(true)}
                leftIcon={<RefreshCcw className="h-4 w-4" />}
              >
                Reassign
              </Button>
            )}
          </div>

          {showPicker ? (
            <div className="mt-3">
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
            </div>
          ) : hasAssignee ? (
            <div className="mt-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {assignedEmployee?.name ??
                  (employeesLoading ? "Loading…" : complaint.assignedTo)}
              </div>
              {assignedEmployee?.designation && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {assignedEmployee.designation}
                </div>
              )}
              {assignedEmployee?.phone && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {assignedEmployee.phone}
                </div>
              )}
            </div>
          ) : (
            isPending && (
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  No employee assigned yet.
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowPicker(true)}
                  leftIcon={<UserPlus2 className="h-4 w-4" />}
                >
                  Assign employee
                </Button>
              </div>
            )
          )}
        </section>
      )}

      {/* -------------------- Resolution panel (read-only) -------------------- */}
      {complaint.actionTakenAt && (
        <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Resolved {formatTimeAgo(complaint.actionTakenAt)} (took{" "}
                {formatResolutionTime(
                  complaint.createdAt,
                  complaint.actionTakenAt
                )}
                )
              </div>
              {complaint.actionImage && (
                <div className="mt-2 inline-block overflow-hidden rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                  <Image
                    src={complaint.actionImage}
                    alt="Resolution proof"
                    width={240}
                    height={180}
                    unoptimized
                    loading="lazy"
                    className="h-32 w-auto object-cover"
                  />
                </div>
              )}
              {actionMapsHref && (
                <div className="mt-2 text-xs">
                  <a
                    href={actionMapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-300"
                  >
                    Open action location in Maps
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* -------------------- Inline irrelevant reason -------------------- */}
      {markingIrrelevant && (
        <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" /> Mark complaint irrelevant
          </h3>
          <textarea
            value={irrelevantReason}
            onChange={(e) => setIrrelevantReason(e.target.value)}
            rows={2}
            placeholder="Enter a short reason"
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

      {/* -------------------- Action row -------------------- */}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        {isDeptDashboard && hasAssignee && isPending && !showPicker && (
          <UnassignButton onConfirm={handleUnassign} loading={busy} />
        )}
        {isDeptDashboard && isPending && !markingIrrelevant && !showPicker && (
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
        {isDeptDashboard && isPending && hasAssignee && !showPicker && (
          <Button
            variant="primary"
            size="sm"
            loading={busy}
            onClick={handleMarkResolved}
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            Mark resolved
          </Button>
        )}
        {!isResolved && (
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Close
          </Button>
        )}
        {isResolved && (
          <Button variant="primary" size="sm" onClick={onClose} disabled={busy}>
            Close
          </Button>
        )}
      </div>
    </Modal>
  );
}


export default ComplaintDetailModal;
