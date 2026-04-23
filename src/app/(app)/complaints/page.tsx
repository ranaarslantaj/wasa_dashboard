"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  FileSpreadsheet,
  FileText,
  MapPinned,
  Plus,
  Presentation,
  RotateCcw,
  Search,
  UserPlus2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";

import { useAuth } from "@/context/AuthContext";
import { useFilters, useActiveFilters } from "@/context/FilterContext";
import { useToast } from "@/context/ToastContext";
import { useComplaints } from "@/hooks/useComplaints";
import { useComplaintTypes } from "@/hooks/useComplaintTypes";
import { useDebounce } from "@/hooks/useDebounce";

import { db } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import {
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/constants/statuses";
import { COMPLAINT_TYPE_FALLBACK } from "@/constants/complaintTypes";
import { exportToPdf } from "@/lib/exportPdf";
import { exportToExcel } from "@/lib/exportExcel";
import { exportToPptx } from "@/lib/exportPptx";
import { formatDateTime } from "@/lib/formatters";

import { ComplaintsTable } from "@/components/complaints/ComplaintsTable";
import { ComplaintDetailModal } from "@/components/complaints/ComplaintDetailModal";
import { AssignEmployeePicker } from "@/components/complaints/AssignEmployeePicker";
import { ExportConfirmModal } from "@/components/complaints/ExportConfirmModal";
import { useWasaEmployees } from "@/hooks/useWasaEmployees";
import type { Complaint, ComplaintStatus } from "@/types";

type ExportFormat = "pdf" | "excel" | "pptx";

export default function ComplaintsPage() {
  const { admin } = useAuth();
  const toast = useToast();
  const filters = useFilters();
  const active = useActiveFilters();

  /* --------------------------- Search debouncing --------------------------- */
  const [searchInput, setSearchInput] = useState<string>(active.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  /* ----------------------------- Pagination ------------------------------- */
  const [pageNum, setPageNum] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  /* -------------------------- Complaint types hook ------------------------- */
  const { data: complaintTypes } = useComplaintTypes({ activeOnly: true });

  /* ------------------------------ Complaints hook -------------------------- */
  const complaintsFilters = useMemo(
    () => ({
      scopeDistricts: active.scopeDistricts,
      district: active.district || undefined,
      tehsil: active.tehsil || undefined,
      uc: active.uc || undefined,
      complaintType: active.complaintType || undefined,
      status: active.status || undefined,
      priority: active.priority || undefined,
      assignee: active.assignee || undefined,
      dateFrom: active.dateFrom,
      dateTo: active.dateTo,
      search: debouncedSearch.trim() || undefined,
    }),
    [active, debouncedSearch]
  );

  const { data, loading, refetch } = useComplaints(complaintsFilters);

  /* ------------------------------ Selection state -------------------------- */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /* ------------------------------ Detail modal ----------------------------- */
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

  // Keep the modal's complaint in sync with the refreshed list so mutations
  // reflect without forcing the user to re-open the detail.
  useEffect(() => {
    if (!selectedComplaint) return;
    const fresh = data.find((c) => c.id === selectedComplaint.id);
    if (fresh && fresh !== selectedComplaint) {
      setSelectedComplaint(fresh);
    }
  }, [data, selectedComplaint]);

  /* --------------------------------- Bulk state --------------------------- */
  const [bulkAssignOpen, setBulkAssignOpen] = useState<boolean>(false);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkStatusConfirmOpen, setBulkStatusConfirmOpen] = useState<boolean>(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState<boolean>(false);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  /* --------------------------------- Exports ------------------------------ */
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
  const [exportBusy, setExportBusy] = useState<boolean>(false);

  /* --------------------------- Employees for bulk -------------------------- */
  const bulkEmployeesFilters = useMemo(
    () =>
      bulkAssignOpen
        ? { scopeDistricts: active.scopeDistricts, activeOnly: true, limit: 500 }
        : null,
    [bulkAssignOpen, active.scopeDistricts]
  );
  const { data: bulkEmployees, loading: bulkEmployeesLoading } = useWasaEmployees(
    bulkEmployeesFilters
  );

  /* ------------------------- Derived lists + counts ------------------------ */
  const sorted = data; // already ordered by createdAt desc from the hook.
  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(pageNum, totalPages);

  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  const kpis = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;
    for (const c of sorted) {
      if (c.status === "pending") pending++;
      else if (c.status === "in_progress") inProgress++;
      else if (c.status === "resolved") resolved++;
    }
    return { total: sorted.length, pending, inProgress, resolved };
  }, [sorted]);

  /* ------------------------- Selection handlers ---------------------------- */
  const handleToggleSelect = useCallback((id: string): void => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleToggleSelectAll = useCallback(
    (v: boolean): void => {
      if (v) setSelectedIds(pageSlice.map((c) => c.id));
      else setSelectedIds([]);
    },
    [pageSlice]
  );

  /* ------------------------------- Row helpers ----------------------------- */
  const handleView = useCallback((c: Complaint) => {
    setSelectedComplaint(c);
    setDetailOpen(true);
  }, []);

  const handleQuickAssign = useCallback((c: Complaint) => {
    setSelectedComplaint(c);
    setDetailOpen(true);
  }, []);

  const logAssignment = useCallback(
    async (
      complaintId: string,
      status: "assigned" | "in_progress" | "resolved" | "reassigned" | "rejected",
      notes: string,
      employeeId: string,
      employeeName: string
    ): Promise<void> => {
      if (!admin) return;
      try {
        await addDoc(collection(db, "Assignments"), {
          complaintId,
          employeeId,
          employeeName,
          assignedBy: admin.id,
          assignedByName: admin.name,
          status,
          notes,
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.error("Assignments log failed:", err);
      }
    },
    [admin]
  );

  const handleChangeStatus = useCallback(
    async (c: Complaint, nextStatus: ComplaintStatus): Promise<void> => {
      if (!admin) return;
      if (nextStatus === c.status) return;
      try {
        await updateDoc(doc(db, "Complaints", c.id), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
        await logAssignment(
          c.id,
          nextStatus === "in_progress"
            ? "in_progress"
            : nextStatus === "resolved"
            ? "resolved"
            : nextStatus === "rejected"
            ? "rejected"
            : "assigned",
          `Status changed to ${nextStatus}`,
          c.assignedTo ?? "",
          c.assignedToName ?? ""
        );
        toast.show({
          type: "success",
          title: `Status updated to ${STATUS_LABELS[nextStatus]}`,
        });
        refetch();
      } catch (err) {
        console.error(err);
        toast.show({
          type: "error",
          title: "Status update failed",
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [admin, toast, refetch, logAssignment]
  );

  // Row-level delete uses a ConfirmDialog (per §19 rule 1).
  const [rowDeleteTarget, setRowDeleteTarget] = useState<Complaint | null>(null);
  const [rowDeleteBusy, setRowDeleteBusy] = useState<boolean>(false);

  const handleDeleteSingle = useCallback((c: Complaint): void => {
    setRowDeleteTarget(c);
  }, []);

  const performRowDelete = useCallback(async (): Promise<void> => {
    if (!admin || !rowDeleteTarget) return;
    setRowDeleteBusy(true);
    try {
      await deleteDoc(doc(db, "Complaints", rowDeleteTarget.id));
      await logAssignment(
        rowDeleteTarget.id,
        "rejected",
        "Complaint deleted",
        rowDeleteTarget.assignedTo ?? "",
        rowDeleteTarget.assignedToName ?? ""
      );
      toast.show({ type: "success", title: "Complaint deleted" });
      setSelectedIds((prev) => prev.filter((id) => id !== rowDeleteTarget.id));
      setRowDeleteTarget(null);
      refetch();
    } catch (err) {
      console.error(err);
      toast.show({
        type: "error",
        title: "Delete failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRowDeleteBusy(false);
    }
  }, [admin, rowDeleteTarget, toast, refetch, logAssignment]);

  /* -------------------------------- Bulk ops ------------------------------- */
  const handleBulkAssign = useCallback(
    async (employeeId: string, notes: string): Promise<void> => {
      if (!admin) return;
      const employee = bulkEmployees.find(
        (e) => e.uid === employeeId || e.id === employeeId
      );
      if (!employee) {
        toast.show({ type: "error", title: "Employee not found" });
        return;
      }
      setBulkBusy(true);
      const toastId = toast.show({
        type: "info",
        title: `Assigning ${selectedIds.length} complaint${
          selectedIds.length === 1 ? "" : "s"
        }…`,
      });
      let ok = 0;
      let fail = 0;
      for (const id of selectedIds) {
        try {
          await updateDoc(doc(db, "Complaints", id), {
            assignedTo: employee.uid || employee.id,
            assignedToName: employee.name,
            assignedBy: admin.id,
            assignedAt: serverTimestamp(),
            assignmentNotes: notes,
            status: "assigned",
            updatedAt: serverTimestamp(),
          });
          await logAssignment(
            id,
            "assigned",
            notes,
            employee.uid || employee.id,
            employee.name
          );
          ok++;
        } catch (err) {
          console.error(err);
          fail++;
        }
      }
      setBulkBusy(false);
      setBulkAssignOpen(false);
      setSelectedIds([]);
      refetch();
      toast.dismiss(toastId);
      toast.show({
        type: fail === 0 ? "success" : "warning",
        title: `Bulk assign complete`,
        description: `${ok} succeeded${fail > 0 ? `, ${fail} failed` : ""}`,
      });
    },
    [admin, bulkEmployees, selectedIds, toast, refetch, logAssignment]
  );

  const performBulkStatusChange = useCallback(async (): Promise<void> => {
    if (!admin || !bulkStatus) return;
    setBulkBusy(true);
    const next = bulkStatus as ComplaintStatus;
    let ok = 0;
    let fail = 0;
    for (const id of selectedIds) {
      try {
        await updateDoc(doc(db, "Complaints", id), {
          status: next,
          updatedAt: serverTimestamp(),
        });
        await logAssignment(
          id,
          next === "in_progress"
            ? "in_progress"
            : next === "resolved"
            ? "resolved"
            : next === "rejected"
            ? "rejected"
            : "assigned",
          `Bulk status change to ${next}`,
          "",
          ""
        );
        ok++;
      } catch (err) {
        console.error(err);
        fail++;
      }
    }
    setBulkBusy(false);
    setBulkStatusConfirmOpen(false);
    setBulkStatus("");
    setSelectedIds([]);
    refetch();
    toast.show({
      type: fail === 0 ? "success" : "warning",
      title: "Bulk status update complete",
      description: `${ok} succeeded${fail > 0 ? `, ${fail} failed` : ""}`,
    });
  }, [admin, bulkStatus, selectedIds, refetch, toast, logAssignment]);

  const performBulkDelete = useCallback(async (): Promise<void> => {
    if (!admin) return;
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    for (const id of selectedIds) {
      try {
        await deleteDoc(doc(db, "Complaints", id));
        ok++;
      } catch (err) {
        console.error(err);
        fail++;
      }
    }
    setBulkBusy(false);
    setBulkDeleteConfirmOpen(false);
    setSelectedIds([]);
    refetch();
    toast.show({
      type: fail === 0 ? "success" : "warning",
      title: "Bulk delete complete",
      description: `${ok} deleted${fail > 0 ? `, ${fail} failed` : ""}`,
    });
  }, [admin, selectedIds, refetch, toast]);

  /* -------------------------------- Exports -------------------------------- */
  const doExport = useCallback(async (): Promise<void> => {
    if (!exportFormat) return;
    setExportBusy(true);
    try {
      const now = new Date();
      const dateStr = format(now, "yyyy-MM-dd");
      const columns = [
        { header: "Complaint ID", dataKey: "complaintId" },
        { header: "Type", dataKey: "type" },
        { header: "Complainant", dataKey: "complainant" },
        { header: "Phone", dataKey: "phone" },
        { header: "District", dataKey: "district" },
        { header: "Tehsil", dataKey: "tehsil" },
        { header: "UC", dataKey: "uc" },
        { header: "Priority", dataKey: "priority" },
        { header: "Status", dataKey: "status" },
        { header: "Assignee", dataKey: "assignee" },
        { header: "Created", dataKey: "created" },
      ];
      const rows = sorted.map((c) => ({
        complaintId: c.complaintId || c.id,
        type:
          COMPLAINT_TYPE_FALLBACK[c.complaintType]?.label ?? c.complaintType,
        complainant: c.complainantName || "",
        phone: c.complainantPhone || "",
        district: c.district || "",
        tehsil: c.tehsil || "",
        uc: c.ucName || "",
        priority: PRIORITY_LABELS[c.priority] ?? c.priority,
        status: STATUS_LABELS[c.status] ?? c.status,
        assignee: c.assignedToName || "Unassigned",
        created: formatDateTime(c.createdAt),
      }));
      const summary = [
        { label: "Total", value: kpis.total },
        { label: "Pending", value: kpis.pending },
        { label: "In Progress", value: kpis.inProgress },
        { label: "Resolved", value: kpis.resolved },
      ];
      if (exportFormat === "pdf") {
        exportToPdf({
          title: "WASA Complaints Report",
          columns,
          rows,
          summary,
          filename: `WASA_Complaints_Report_${dateStr}.pdf`,
        });
      } else if (exportFormat === "excel") {
        exportToExcel({
          sheetName: "Complaints",
          columns,
          rows,
          filenamePrefix: "WASA_Complaints_Report",
        });
      } else if (exportFormat === "pptx") {
        const slides = sorted.slice(0, 20).map((c) => ({
          title: c.complaintId || c.id,
          body: [
            `Type: ${
              COMPLAINT_TYPE_FALLBACK[c.complaintType]?.label ?? c.complaintType
            }`,
            `Status: ${STATUS_LABELS[c.status] ?? c.status}`,
            `Priority: ${PRIORITY_LABELS[c.priority] ?? c.priority}`,
            `Location: ${[c.district, c.tehsil, c.ucName]
              .filter(Boolean)
              .join(" / ")}`,
            `Complainant: ${c.complainantName || "—"} (${
              c.complainantPhone || ""
            })`,
            c.description ? `\n${c.description}` : "",
          ].join("\n"),
          images: c.images ?? [],
        }));
        await exportToPptx(
          "WASA Complaints Report",
          slides,
          `WASA_Complaints_Report_${dateStr}.pptx`
        );
      }
      toast.show({ type: "success", title: "Export complete" });
      setExportFormat(null);
    } catch (err) {
      console.error(err);
      toast.show({
        type: "error",
        title: "Export failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setExportBusy(false);
    }
  }, [exportFormat, sorted, kpis, toast]);

  /* ------------------------------ Option lists ----------------------------- */
  const provinceOptions = useMemo(
    () => filters.availableProvinces.map((p) => ({ value: p, label: p })),
    [filters.availableProvinces]
  );
  const divisionOptions = useMemo(
    () => [
      { value: "", label: "All divisions" },
      ...filters.availableDivisions.map((d) => ({ value: d, label: d })),
    ],
    [filters.availableDivisions]
  );
  const districtOptions = useMemo(
    () => [
      { value: "", label: "All districts" },
      ...filters.availableDistricts.map((d) => ({ value: d, label: d })),
    ],
    [filters.availableDistricts]
  );
  const tehsilOptions = useMemo(
    () => [
      { value: "", label: "All tehsils" },
      ...filters.availableTehsils.map((t) => ({ value: t, label: t })),
    ],
    [filters.availableTehsils]
  );
  const statusOptions = useMemo(
    () => [
      { value: "", label: "All statuses" },
      ...COMPLAINT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    ],
    []
  );
  const priorityOptions = useMemo(
    () => [
      { value: "", label: "All priorities" },
      ...COMPLAINT_PRIORITIES.map((p) => ({ value: p.value, label: p.label })),
    ],
    []
  );
  const typeOptions = useMemo(
    () => [
      { value: "", label: "All types" },
      ...complaintTypes.map((t) => ({ value: t.key, label: t.label })),
    ],
    [complaintTypes]
  );
  const bulkStatusOptions = useMemo(
    () => [
      { value: "", label: "Change status…" },
      ...COMPLAINT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    ],
    []
  );

  const resetAll = useCallback((): void => {
    filters.resetFilters();
    setSearchInput("");
    setPageNum(1);
  }, [filters]);

  /* ------------------------------- Render -------------------------------- */

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Complaints
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage and assign public water & sanitation complaints
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() =>
              toast.show({
                type: "info",
                title: "Coming in next phase",
                description: "Dashboard-side complaint creation.",
              })
            }
          >
            New complaint
          </Button>
          <Button
            variant="outline"
            leftIcon={<FileText className="h-4 w-4" />}
            onClick={() => setExportFormat("pdf")}
          >
            Export PDF
          </Button>
          <Button
            variant="outline"
            leftIcon={<FileSpreadsheet className="h-4 w-4" />}
            onClick={() => setExportFormat("excel")}
          >
            Export Excel
          </Button>
          <Button
            variant="outline"
            leftIcon={<Presentation className="h-4 w-4" />}
            onClick={() => setExportFormat("pptx")}
          >
            Export PowerPoint
          </Button>
        </div>
      </div>

      {/* Scope chip */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <MapPinned className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Viewing:
        </span>
        <span>
          {active.province || "—"} /{" "}
          {active.division || "All divisions"} /{" "}
          {active.district || "All districts"} /{" "}
          {active.tehsil || "All tehsils"}
        </span>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Dropdown
            value={filters.selectedProvince}
            onChange={filters.setSelectedProvince}
            options={provinceOptions}
            locked={filters.provinceLocked}
          />
          <Dropdown
            value={filters.selectedDivision}
            onChange={filters.setSelectedDivision}
            options={divisionOptions}
            locked={filters.divisionLocked}
          />
          <Dropdown
            value={filters.selectedDistrict}
            onChange={filters.setSelectedDistrict}
            options={districtOptions}
            locked={filters.districtLocked}
          />
          <Dropdown
            value={filters.selectedTehsil}
            onChange={filters.setSelectedTehsil}
            options={tehsilOptions}
            locked={filters.tehsilLocked}
          />
          <Dropdown
            value={filters.selectedStatus}
            onChange={filters.setSelectedStatus}
            options={statusOptions}
          />
          <Dropdown
            value={filters.selectedPriority}
            onChange={filters.setSelectedPriority}
            options={priorityOptions}
          />
          <Dropdown
            value={filters.selectedComplaintType}
            onChange={filters.setSelectedComplaintType}
            options={typeOptions}
            className="col-span-2"
          />
          <div className="relative col-span-2 md:col-span-3">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPageNum(1);
              }}
              placeholder="Search name, phone, complaint ID, description…"
              className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="col-span-2 flex justify-end md:col-span-1">
            <Button
              variant="ghost"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              onClick={resetAll}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiChip label="Total" value={kpis.total} />
        <KpiChip label="Pending" value={kpis.pending} tone="slate" />
        <KpiChip label="In Progress" value={kpis.inProgress} tone="amber" />
        <KpiChip label="Resolved" value={kpis.resolved} tone="emerald" />
      </div>

      {/* Selection bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm dark:border-brand-900/40 dark:bg-brand-900/20">
          <div className="text-brand-900 dark:text-brand-200">
            <span className="font-semibold">{selectedIds.length}</span> selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserPlus2 className="h-4 w-4" />}
              onClick={() => setBulkAssignOpen(true)}
            >
              Bulk assign
            </Button>
            <Dropdown
              value={bulkStatus}
              onChange={(v) => {
                setBulkStatus(v);
                if (v) setBulkStatusConfirmOpen(true);
              }}
              options={bulkStatusOptions}
              className="min-w-[10rem]"
            />
            <Button
              variant="destructive"
              size="sm"
              leftIcon={<X className="h-4 w-4" />}
              onClick={() => setBulkDeleteConfirmOpen(true)}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              Cancel selection
            </Button>
          </div>
        </div>
      )}

      {/* Complaints table */}
      <Card>
        <CardContent className="p-0">
          <ComplaintsTable
            complaints={pageSlice}
            loading={loading}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onView={handleView}
            onQuickAssign={handleQuickAssign}
            onChangeStatus={handleChangeStatus}
            onDelete={handleDeleteSingle}
          />
        </CardContent>
        <div className="px-4">
          <Pagination
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPageNum}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPageNum(1);
            }}
          />
        </div>
      </Card>

      {/* Detail modal */}
      <ComplaintDetailModal
        complaint={selectedComplaint}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          // keep selectedComplaint so the close transition doesn't flash empty
        }}
        onMutated={refetch}
      />

      {/* Bulk assign modal */}
      <Modal
        open={bulkAssignOpen}
        onClose={() => (bulkBusy ? undefined : setBulkAssignOpen(false))}
        title={`Bulk assign (${selectedIds.length})`}
        size="xl"
      >
        {selectedIds.length > 0 && (
          <AssignEmployeePicker
            complaint={
              // Use the first selected complaint as the ranking reference so the
              // picker has a complaint type / geography to sort employees against.
              sorted.find((c) => selectedIds.includes(c.id)) ?? sorted[0]
            }
            employees={bulkEmployees}
            loading={bulkEmployeesLoading}
            onAssign={handleBulkAssign}
            onCancel={() => setBulkAssignOpen(false)}
            submitLabel={`Assign to ${selectedIds.length}`}
          />
        )}
      </Modal>

      {/* Bulk status confirm */}
      <ConfirmDialog
        open={bulkStatusConfirmOpen}
        onClose={() => {
          if (!bulkBusy) {
            setBulkStatusConfirmOpen(false);
            setBulkStatus("");
          }
        }}
        title="Change status for selected complaints?"
        message={`This will update ${selectedIds.length} complaint${
          selectedIds.length === 1 ? "" : "s"
        } to status "${
          bulkStatus ? STATUS_LABELS[bulkStatus as ComplaintStatus] : ""
        }".`}
        confirmLabel="Apply"
        variant="primary"
        loading={bulkBusy}
        onConfirm={performBulkStatusChange}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onClose={() => (bulkBusy ? undefined : setBulkDeleteConfirmOpen(false))}
        title="Delete selected complaints?"
        message={`This will permanently delete ${selectedIds.length} complaint${
          selectedIds.length === 1 ? "" : "s"
        }. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={bulkBusy}
        onConfirm={performBulkDelete}
      />

      {/* Export confirmation modal */}
      <ExportConfirmModal
        open={exportFormat !== null}
        onClose={() => (exportBusy ? undefined : setExportFormat(null))}
        format={exportFormat ?? "pdf"}
        count={kpis.total}
        onConfirm={doExport}
        loading={exportBusy}
      />

      {/* Row-level delete confirm */}
      <ConfirmDialog
        open={rowDeleteTarget !== null}
        onClose={() => (rowDeleteBusy ? undefined : setRowDeleteTarget(null))}
        title="Delete this complaint?"
        message={`This will permanently delete ${
          rowDeleteTarget?.complaintId ?? "this record"
        }. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={rowDeleteBusy}
        onConfirm={performRowDelete}
      />
    </div>
  );
}

/* ---------------------------- Local helpers ------------------------------- */

function KpiChip({
  label,
  value,
  tone = "brand",
}: {
  label: string;
  value: number;
  tone?: "brand" | "slate" | "amber" | "emerald";
}) {
  const toneClass: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  };
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {value}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex h-2 w-2 rounded-full",
            toneClass[tone]
          )}
          aria-hidden
        />
      </CardContent>
    </Card>
  );
}

