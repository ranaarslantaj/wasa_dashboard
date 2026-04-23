"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  MapPin,
  Phone,
  Trash2,
  Upload,
  UserCircle2,
  UserPlus2,
  XCircle,
} from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useAssignments } from "@/hooks/useAssignments";
import { useWasaEmployees } from "@/hooks/useWasaEmployees";
import { db, storage } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import {
  APPROVAL_BADGE,
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
} from "@/constants/statuses";
import { COMPLAINT_TYPE_FALLBACK } from "@/constants/complaintTypes";
import { formatDateTime, formatTimeAgo } from "@/lib/formatters";
import type {
  Assignment,
  AssignmentStatus,
  Complaint,
  ComplaintApproval,
  ComplaintStatus,
} from "@/types";
import { AssignEmployeePicker } from "./AssignEmployeePicker";

export interface ComplaintDetailModalProps {
  complaint: Complaint | null;
  open: boolean;
  onClose: () => void;
  onMutated: () => void;
}

type AssignmentLogPayload = {
  complaintId: string;
  employeeId: string;
  employeeName: string;
  assignedBy: string;
  assignedByName: string;
  status: AssignmentStatus;
  notes: string;
};

export function ComplaintDetailModal({
  complaint,
  open,
  onClose,
  onMutated,
}: ComplaintDetailModalProps) {
  const { admin, adminScope } = useAuth();
  const toast = useToast();

  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [deleteConfirm, setDeleteConfirm] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  // Rejection-reason state (used by "Reject complaint" and "Reject resolution")
  const [rejectingComplaint, setRejectingComplaint] = useState<boolean>(false);
  const [rejectingResolution, setRejectingResolution] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("");

  // Resolution section state
  const [resolutionNotes, setResolutionNotes] = useState<string>("");
  const [resolutionImages, setResolutionImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);

  // Sync state when complaint changes.
  useEffect(() => {
    setActiveImageIdx(0);
    setShowPicker(false);
    setDeleteConfirm(false);
    setRejectingComplaint(false);
    setRejectingResolution(false);
    setRejectReason("");
    setResolutionNotes(complaint?.resolutionNotes ?? "");
    setResolutionImages(complaint?.resolutionImages ?? []);
  }, [complaint?.id, complaint?.resolutionNotes, complaint?.resolutionImages]);

  // Employee list scoped to admin — the picker uses rankEmployees internally.
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

  // Assignment history
  const assignmentsFilters = useMemo(
    () => (open && complaint ? { complaintId: complaint.id } : null),
    [open, complaint]
  );
  const { data: assignments, loading: assignmentsLoading, refetch: refetchAssignments } =
    useAssignments(assignmentsFilters);

  /* -------------------------------------------------------------------- */
  /*                              Mutations                               */
  /* -------------------------------------------------------------------- */

  const logAssignment = useCallback(
    async (payload: AssignmentLogPayload): Promise<void> => {
      try {
        await addDoc(collection(db, "Assignments"), {
          ...payload,
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to write Assignments log:", err);
      }
    },
    []
  );

  const handleAssign = useCallback(
    async (employeeId: string, notes: string): Promise<void> => {
      if (!complaint || !admin) return;
      const employee = employees.find(
        (e) => e.uid === employeeId || e.id === employeeId
      );
      if (!employee) {
        toast.show({ type: "error", title: "Employee not found" });
        return;
      }
      setBusy(true);
      try {
        await updateDoc(doc(db, "Complaints", complaint.id), {
          assignedTo: employee.uid || employee.id,
          assignedToName: employee.name,
          assignedBy: admin.id,
          assignedAt: serverTimestamp(),
          assignmentNotes: notes,
          status: "assigned",
          updatedAt: serverTimestamp(),
        });
        await logAssignment({
          complaintId: complaint.id,
          employeeId: employee.uid || employee.id,
          employeeName: employee.name,
          assignedBy: admin.id,
          assignedByName: admin.name,
          status: "assigned",
          notes,
        });
        toast.show({
          type: "success",
          title: "Complaint assigned",
          description: `Assigned to ${employee.name}`,
        });
        setShowPicker(false);
        onMutated();
        refetchAssignments();
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
    [complaint, admin, employees, toast, onMutated, logAssignment, refetchAssignments]
  );

  const handleUploadResolutionImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (!complaint) return null;
      const path = `complaints/${complaint.id}/resolution/${Date.now()}_${file.name}`;
      const r = ref(storage, path);
      const snap = await uploadBytes(r, file);
      const url = await getDownloadURL(snap.ref);
      return url;
    },
    [complaint]
  );

  const handleResolutionImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        const uploads = await Promise.all(
          Array.from(files).map((f) => handleUploadResolutionImage(f))
        );
        const urls = uploads.filter((u): u is string => !!u);
        setResolutionImages((prev) => [...prev, ...urls]);
        toast.show({
          type: "success",
          title: `${urls.length} photo${urls.length === 1 ? "" : "s"} uploaded`,
        });
      } catch (err) {
        console.error(err);
        toast.show({
          type: "error",
          title: "Upload failed",
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [handleUploadResolutionImage, toast]
  );

  const handleMarkResolved = useCallback(async (): Promise<void> => {
    if (!complaint || !admin) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "Complaints", complaint.id), {
        status: "resolved",
        approval: "pending",
        resolvedAt: serverTimestamp(),
        resolutionNotes: resolutionNotes.trim(),
        resolutionImages,
        updatedAt: serverTimestamp(),
      });
      await logAssignment({
        complaintId: complaint.id,
        employeeId: complaint.assignedTo ?? "",
        employeeName: complaint.assignedToName ?? "",
        assignedBy: admin.id,
        assignedByName: admin.name,
        status: "resolved",
        notes: resolutionNotes.trim(),
      });
      toast.show({ type: "success", title: "Marked as resolved" });
      onMutated();
      refetchAssignments();
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
  }, [
    complaint,
    admin,
    resolutionNotes,
    resolutionImages,
    toast,
    onMutated,
    logAssignment,
    refetchAssignments,
  ]);

  const handleApprove = useCallback(async (): Promise<void> => {
    if (!complaint || !admin) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "Complaints", complaint.id), {
        approval: "approved" as ComplaintApproval,
        updatedAt: serverTimestamp(),
      });
      toast.show({ type: "success", title: "Resolution approved" });
      onMutated();
      refetchAssignments();
    } catch (err) {
      console.error(err);
      toast.show({
        type: "error",
        title: "Approval failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [complaint, admin, toast, onMutated, refetchAssignments]);

  const handleRejectResolution = useCallback(async (): Promise<void> => {
    if (!complaint || !admin) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.show({ type: "warning", title: "Enter a reason to reject" });
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "Complaints", complaint.id), {
        status: "reopened" as ComplaintStatus,
        approval: "rejected" as ComplaintApproval,
        rejectionReason: reason,
        updatedAt: serverTimestamp(),
      });
      await logAssignment({
        complaintId: complaint.id,
        employeeId: complaint.assignedTo ?? "",
        employeeName: complaint.assignedToName ?? "",
        assignedBy: admin.id,
        assignedByName: admin.name,
        status: "rejected",
        notes: reason,
      });
      toast.show({ type: "success", title: "Resolution rejected — complaint reopened" });
      setRejectingResolution(false);
      setRejectReason("");
      onMutated();
      refetchAssignments();
    } catch (err) {
      console.error(err);
      toast.show({
        type: "error",
        title: "Rejection failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [
    complaint,
    admin,
    rejectReason,
    toast,
    onMutated,
    logAssignment,
    refetchAssignments,
  ]);

  const handleRejectComplaint = useCallback(async (): Promise<void> => {
    if (!complaint || !admin) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.show({ type: "warning", title: "Enter a reason to reject" });
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "Complaints", complaint.id), {
        status: "rejected" as ComplaintStatus,
        rejectionReason: reason,
        updatedAt: serverTimestamp(),
      });
      await logAssignment({
        complaintId: complaint.id,
        employeeId: complaint.assignedTo ?? "",
        employeeName: complaint.assignedToName ?? "",
        assignedBy: admin.id,
        assignedByName: admin.name,
        status: "rejected",
        notes: reason,
      });
      toast.show({ type: "success", title: "Complaint rejected" });
      setRejectingComplaint(false);
      setRejectReason("");
      onMutated();
      refetchAssignments();
    } catch (err) {
      console.error(err);
      toast.show({
        type: "error",
        title: "Rejection failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [
    complaint,
    admin,
    rejectReason,
    toast,
    onMutated,
    logAssignment,
    refetchAssignments,
  ]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!complaint || !admin) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "Complaints", complaint.id));
      await logAssignment({
        complaintId: complaint.id,
        employeeId: complaint.assignedTo ?? "",
        employeeName: complaint.assignedToName ?? "",
        assignedBy: admin.id,
        assignedByName: admin.name,
        status: "rejected",
        notes: "Complaint deleted",
      });
      toast.show({ type: "success", title: "Complaint deleted" });
      setDeleteConfirm(false);
      onMutated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.show({
        type: "error",
        title: "Delete failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [complaint, admin, toast, onMutated, onClose, logAssignment]);

  /* -------------------------------------------------------------------- */
  /*                              Derived UI                              */
  /* -------------------------------------------------------------------- */

  const images: string[] = useMemo(
    () => (complaint?.images ?? []).filter(Boolean),
    [complaint?.images]
  );
  const activeImage = images[activeImageIdx] ?? null;

  const typeMeta = complaint
    ? COMPLAINT_TYPE_FALLBACK[complaint.complaintType]
    : undefined;

  const coords = complaint?.coordinates;
  const mapsHref =
    coords && typeof coords.lat === "number" && typeof coords.lng === "number"
      ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
      : null;

  const canApprove =
    !!complaint &&
    complaint.status === "resolved" &&
    (complaint.approval === "pending" || complaint.approval === null);

  const canRejectResolution = !!complaint && complaint.status === "resolved";

  const canRejectComplaint =
    !!complaint && complaint.status !== "rejected";

  const canMarkResolved =
    !!complaint &&
    (complaint.status === "assigned" || complaint.status === "in_progress");

  const canReassign = !!complaint && complaint.assignedTo !== null;

  if (!complaint) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title={undefined}
      className="max-w-5xl"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {/* -------------------- LEFT: Image gallery -------------------- */}
        <div>
          <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            {activeImage ? (
              <Image
                src={activeImage}
                alt={`Complaint image ${activeImageIdx + 1}`}
                width={800}
                height={600}
                unoptimized
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <ImageIcon className="h-10 w-10" aria-hidden />
                <span className="text-sm">No attached images</span>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((src, idx) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={cn(
                    "relative h-16 w-16 overflow-hidden rounded-lg border",
                    idx === activeImageIdx
                      ? "border-brand-600 ring-2 ring-brand-500"
                      : "border-slate-200 dark:border-slate-700"
                  )}
                  aria-label={`Show image ${idx + 1}`}
                >
                  <Image
                    src={src}
                    alt={`thumb-${idx}`}
                    width={80}
                    height={80}
                    unoptimized
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* -------------------- RIGHT: Metadata + workflow -------------------- */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            {typeMeta && (
              <span
                className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${typeMeta.color}20`,
                  color: typeMeta.color,
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: typeMeta.color }}
                  aria-hidden
                />
                {typeMeta.label}
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                PRIORITY_BADGE[complaint.priority]
              )}
            >
              {PRIORITY_LABELS[complaint.priority]}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                STATUS_BADGE[complaint.status]
              )}
            >
              {STATUS_LABELS[complaint.status]}
            </span>
            {complaint.approval && (
              <span
                className={cn(
                  "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                  APPROVAL_BADGE[complaint.approval]
                )}
              >
                Approval: {complaint.approval}
              </span>
            )}
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
            {complaint.complainantCNIC && (
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                CNIC: {complaint.complainantCNIC}
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
              {[complaint.district, complaint.tehsil, complaint.ucName]
                .filter(Boolean)
                .join(" / ") || "-"}
            </div>
            {complaint.locationAddress && (
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {complaint.locationAddress}
              </div>
            )}
            {coords && (
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {coords.lat?.toFixed?.(5)}, {coords.lng?.toFixed?.(5)}
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
                <div className="text-slate-500 dark:text-slate-400">Assigned</div>
                <div className="text-slate-900 dark:text-slate-100">
                  {formatDateTime(complaint.assignedAt)}
                </div>
              </div>
            )}
            {complaint.resolvedAt && (
              <div>
                <div className="text-slate-500 dark:text-slate-400">Resolved</div>
                <div className="text-slate-900 dark:text-slate-100">
                  {formatDateTime(complaint.resolvedAt)}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* -------------------- Assignment section -------------------- */}
      <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Assignment
          </h3>
          {!showPicker && complaint.assignedTo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPicker(true)}
              leftIcon={<UserPlus2 className="h-4 w-4" />}
            >
              Reassign
            </Button>
          )}
        </div>

        {showPicker ? (
          <div className="mt-3">
            <AssignEmployeePicker
              complaint={complaint}
              employees={employees}
              loading={employeesLoading}
              onAssign={handleAssign}
              onCancel={() => setShowPicker(false)}
              submitLabel={complaint.assignedTo ? "Reassign" : "Assign"}
            />
          </div>
        ) : complaint.assignedTo ? (
          <div className="mt-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {complaint.assignedToName ?? "Assigned employee"}
            </div>
            {complaint.assignmentNotes && (
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Notes: {complaint.assignmentNotes}
              </div>
            )}
          </div>
        ) : (
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
        )}
      </section>

      {/* -------------------- Assignments timeline -------------------- */}
      <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Assignment history
        </h3>
        {assignmentsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No history yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {assignments.map((a: Assignment) => (
              <li key={a.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                    STATUS_BADGE[
                      (a.status === "reassigned"
                        ? "assigned"
                        : a.status) as ComplaintStatus
                    ] ?? "bg-slate-300"
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                        STATUS_BADGE[
                          (a.status === "reassigned"
                            ? "assigned"
                            : a.status) as ComplaintStatus
                        ] ?? "bg-slate-100 text-slate-700"
                      )}
                    >
                      {a.status.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {a.employeeName || "—"}
                    </span>
                    {a.assignedByName && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        by {a.assignedByName}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-slate-400">
                      {formatTimeAgo(a.timestamp)}
                    </span>
                  </div>
                  {a.notes && (
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {a.notes}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* -------------------- Resolution section -------------------- */}
      <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Resolution
        </h3>
        <textarea
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
          rows={3}
          placeholder="Add resolution notes (visible on the audit trail)"
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Upload after-photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleResolutionImageChange}
              disabled={uploading}
            />
          </label>
          {resolutionImages.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {resolutionImages.length} photo
              {resolutionImages.length === 1 ? "" : "s"} attached
            </span>
          )}
        </div>
        {resolutionImages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {resolutionImages.map((src, idx) => (
              <div
                key={`${src}-${idx}`}
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <Image
                  src={src}
                  alt={`Resolution ${idx + 1}`}
                  width={80}
                  height={80}
                  unoptimized
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* -------------------- Inline reject reason panels -------------------- */}
      {(rejectingComplaint || rejectingResolution) && (
        <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            {rejectingResolution
              ? "Reject resolution (complaint will reopen)"
              : "Reject complaint"}
          </h3>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="Enter a reason"
            className="block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRejectingComplaint(false);
                setRejectingResolution(false);
                setRejectReason("");
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              loading={busy}
              onClick={
                rejectingResolution ? handleRejectResolution : handleRejectComplaint
              }
            >
              Confirm rejection
            </Button>
          </div>
        </section>
      )}

      {/* -------------------- Inline delete confirm banner -------------------- */}
      {deleteConfirm && (
        <section className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-red-900 dark:text-red-200">
                Are you sure? This will permanently delete this record.
              </div>
              <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
                This action cannot be undone.
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  loading={busy}
                  onClick={handleDelete}
                  leftIcon={<Trash2 className="h-4 w-4" />}
                >
                  Confirm delete
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* -------------------- Action row -------------------- */}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        {canApprove && (
          <Button
            variant="primary"
            size="sm"
            loading={busy}
            onClick={handleApprove}
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            Approve
          </Button>
        )}
        {canRejectResolution && !rejectingResolution && (
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => {
              setRejectingComplaint(false);
              setRejectingResolution(true);
              setRejectReason("");
            }}
            leftIcon={<XCircle className="h-4 w-4" />}
          >
            Reject resolution
          </Button>
        )}
        {canRejectComplaint && !rejectingComplaint && !rejectingResolution && (
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => {
              setRejectingResolution(false);
              setRejectingComplaint(true);
              setRejectReason("");
            }}
            leftIcon={<XCircle className="h-4 w-4" />}
          >
            Reject complaint
          </Button>
        )}
        {canReassign && !showPicker && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => setShowPicker(true)}
            leftIcon={<UserPlus2 className="h-4 w-4" />}
          >
            Reassign
          </Button>
        )}
        {canMarkResolved && (
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
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => setDeleteConfirm(true)}
          leftIcon={<Trash2 className="h-4 w-4" />}
        >
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

export default ComplaintDetailModal;
