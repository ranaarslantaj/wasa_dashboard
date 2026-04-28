"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  MapPinned,
  RotateCcw,
  Search,
  UserPlus2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { Tabs, type TabItem } from "@/components/ui/Tabs";

import { useAuth } from "@/context/AuthContext";
import { useFilters, useActiveFilters } from "@/context/FilterContext";
import { useToast } from "@/context/ToastContext";
import { useComplaints, type ComplaintsFilters } from "@/hooks/useComplaints";
import { useDebounce } from "@/hooks/useDebounce";

import { db, tsToDate } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import {
  COMPLAINT_STATUSES,
  STATUS_LABELS,
} from "@/constants/statuses";
import {
  WASA_CATEGORIES,
  wasaCategoryLabel,
} from "@/constants/wasaCategories";
import { exportToPdf } from "@/lib/exportPdf";
import { exportToExcel } from "@/lib/exportExcel";
import { isOverdue } from "@/lib/derivePriority";
import { formatDateTime } from "@/lib/formatters";

import { ComplaintsTable } from "@/components/complaints/ComplaintsTable";
import { ComplaintDetailModal } from "@/components/complaints/ComplaintDetailModal";
import { AssignEmployeePicker } from "@/components/complaints/AssignEmployeePicker";
import { ExportConfirmModal } from "@/components/complaints/ExportConfirmModal";
import { CategoryQuickFilters } from "@/components/complaints/CategoryQuickFilters";
import { useWasaEmployees } from "@/hooks/useWasaEmployees";
import type {
  Complaint,
  ComplaintStatus,
  RoutingStrategy,
} from "@/types";

type ExportFormat = "pdf" | "excel";

type TabId = "pending_queue" | "all_manhole" | "my_assignments";

type BulkStatusKind = "" | "action_taken" | "irrelevant";

const TABS: TabItem[] = [
  { id: "pending_queue", label: "Pending Queue" },
  { id: "all_manhole", label: "All Manhole" },
  { id: "my_assignments", label: "My Assignments" },
];

export default function ComplaintsPage() {
  const { admin } = useAuth();
  const toast = useToast();
  const filters = useFilters();
  const active = useActiveFilters();

  /* ------------------------------ Tabs ------------------------------------ */
  const [tab, setTab] = useState<TabId>("all_manhole");

  /* --------------------------- Search debouncing --------------------------- */
  const [searchInput, setSearchInput] = useState<string>(active.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  /* ----------------------------- Pagination ------------------------------- */
  const [pageNum, setPageNum] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  /* ------------------------------ Filters --------------------------------- */
  const baseFilters = useMemo<ComplaintsFilters>(
    () => ({
      scopeDistricts: active.scopeDistricts,
      district: active.district || undefined,
      tahsil: active.tehsil || undefined,
      uc: active.uc || undefined,
      wasaCategory: active.wasaCategory || undefined,
      complaintStatus: active.status
        ? (active.status as ComplaintStatus)
        : undefined,
      routingStrategy: active.routing ? active.routing : undefined,
      assignee: active.assignee || undefined,
      dateFrom: active.dateFrom,
      dateTo: active.dateTo,
      search: debouncedSearch.trim() || undefined,
    }),
    [active, debouncedSearch]
  );

  const complaintsFilters = useMemo<ComplaintsFilters>(() => {
    if (tab === "pending_queue") {
      return {
        ...baseFilters,
        routingStrategy: "DEPT_DASHBOARD",
        complaintStatus: "action_required",
        onlyUnassigned: true,
        sort: "oldest",
      };
    }
    return baseFilters;
  }, [baseFilters, tab]);

  const { data, loading, refetch } = useComplaints(complaintsFilters);

  /* ----------- Employees lookup (for table display + bulk assign) --------- */
  const employeesFilters = useMemo(
    () => ({
      scopeDistricts: active.scopeDistricts,
      activeOnly: true,
      limit: 500,
    }),
    [active.scopeDistricts]
  );
  const { data: employees, loading: employeesLoading } = useWasaEmployees(
    employeesFilters
  );

  const employeeNamesByUid = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const e of employees) {
      const key = e.uid || e.id;
      if (key) out[key] = e.name;
    }
    return out;
  }, [employees]);

  /* ------------- My Assignments: complaints I assigned -------------------- */
  /* Driven entirely by the `assignedBy` field on the Complaint doc itself. */

  /* --------------------------- Selection state ---------------------------- */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /* ------------------------------ Detail modal ----------------------------- */
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedComplaint) return;
    const fresh = data.find((c) => c.id === selectedComplaint.id);
    if (fresh && fresh !== selectedComplaint) {
      setSelectedComplaint(fresh);
    }
  }, [data, selectedComplaint]);

  /* --------------------------------- Bulk state --------------------------- */
  const [bulkAssignOpen, setBulkAssignOpen] = useState<boolean>(false);
  const [bulkStatusKind, setBulkStatusKind] = useState<BulkStatusKind>("");
  const [bulkIrrelevantReason, setBulkIrrelevantReason] = useState<string>("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState<boolean>(false);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  /* ------------------------ Inline irrelevant reason ---------------------- */
  const [irrelevantTarget, setIrrelevantTarget] = useState<Complaint | null>(
    null
  );
  const [irrelevantReason, setIrrelevantReason] = useState<string>("");
  const [irrelevantBusy, setIrrelevantBusy] = useState<boolean>(false);

  /* --------------------------------- Exports ------------------------------ */
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
  const [exportBusy, setExportBusy] = useState<boolean>(false);

  /* ------------------------- Derived lists + counts ------------------------ */
  const filteredByTab = useMemo<Complaint[]>(() => {
    if (tab === "my_assignments" && admin) {
      return data.filter(
        (c) => (c as Complaint & { assignedBy?: string }).assignedBy === admin.id,
      );
    }
    return data;
  }, [data, tab, admin]);

  const totalCount = filteredByTab.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(pageNum, totalPages);

  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredByTab.slice(start, start + pageSize);
  }, [filteredByTab, safePage, pageSize]);

  const categoryCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const cat of WASA_CATEGORIES) counts[cat.value] = 0;
    for (const c of filteredByTab) {
      if (c.wasaCategory && counts[c.wasaCategory] !== undefined) {
        counts[c.wasaCategory] = (counts[c.wasaCategory] ?? 0) + 1;
      }
    }
    return counts;
  }, [filteredByTab]);

  const stats = useMemo(() => {
    let total = 0;
    let actionRequired = 0;
    let resolved = 0;
    let rejected = 0;
    let pendingQueue = 0;
    let overdue = 0;
    for (const c of filteredByTab) {
      total++;
      if (c.complaintStatus === "action_required") actionRequired++;
      else if (c.complaintStatus === "action_taken") resolved++;
      else if (c.complaintStatus === "irrelevant") rejected++;
      if (
        c.routingStrategy === "DEPT_DASHBOARD" &&
        c.complaintStatus === "action_required" &&
        !c.assignedTo
      ) {
        pendingQueue++;
      }
      if (isOverdue(tsToDate(c.createdAt), c.complaintStatus)) overdue++;
    }
    return { total, actionRequired, resolved, rejected, pendingQueue, overdue };
  }, [filteredByTab]);

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

  const handleReassign = useCallback((c: Complaint) => {
    setSelectedComplaint(c);
    setDetailOpen(true);
  }, []);

  const handleUnassignRow = useCallback(
    async (c: Complaint): Promise<void> => {
      if (!admin) return;
      try {
        await updateDoc(doc(db, "Complaints", c.id), {
          assignedTo: null,
          assignedToName: null,
          assignedBy: null,
          assignedByName: null,
          assignedAt: null,
          updatedAt: serverTimestamp(),
        });
        toast.show({ type: "success", title: "Complaint unassigned" });
        refetch();
      } catch (err) {
        console.error(err);
        toast.show({
          type: "error",
          title: "Unassign failed",
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [admin, toast, refetch]
  );

  const handleMarkResolvedRow = useCallback(
    async (c: Complaint): Promise<void> => {
      if (!admin) return;
      try {
        await updateDoc(doc(db, "Complaints", c.id), {
          complaintStatus: "action_taken",
          updatedAt: serverTimestamp(),
        });
        toast.show({ type: "success", title: "Marked as resolved" });
        refetch();
      } catch (err) {
        console.error(err);
        toast.show({
          type: "error",
          title: "Failed to mark resolved",
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [admin, toast, refetch]
  );

  const handleMarkIrrelevantRow = useCallback((c: Complaint): void => {
    setIrrelevantTarget(c);
    setIrrelevantReason("");
  }, []);

  const performMarkIrrelevant = useCallback(async (): Promise<void> => {
    if (!admin || !irrelevantTarget) return;
    const reason = irrelevantReason.trim();
    if (!reason) {
      toast.show({ type: "warning", title: "Enter a reason" });
      return;
    }
    setIrrelevantBusy(true);
    try {
      await updateDoc(doc(db, "Complaints", irrelevantTarget.id), {
        complaintStatus: "irrelevant",
        reason,
        updatedAt: serverTimestamp(),
      });
      toast.show({ type: "success", title: "Marked irrelevant" });
      setIrrelevantTarget(null);
      setIrrelevantReason("");
      refetch();
    } catch (err) {
      console.error(err);
      toast.show({
        type: "error",
        title: "Action failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIrrelevantBusy(false);
    }
  }, [admin, irrelevantTarget, irrelevantReason, toast, refetch]);

  /* -------------------------------- Bulk ops ------------------------------- */
  const handleBulkAssign = useCallback(
    async (employeeId: string, notes: string): Promise<void> => {
      if (!admin) return;
      const employee = employees.find(
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
            assignedByName: admin.name,
            assignedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
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
        title: "Bulk assign complete",
        description: `${ok} succeeded${fail > 0 ? `, ${fail} failed` : ""}`,
      });
    },
    [admin, employees, selectedIds, toast, refetch]
  );

  const performBulkStatusChange = useCallback(async (): Promise<void> => {
    if (!admin || !bulkStatusKind) return;
    if (bulkStatusKind === "irrelevant" && !bulkIrrelevantReason.trim()) {
      toast.show({ type: "warning", title: "Enter a reason" });
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    for (const id of selectedIds) {
      try {
        if (bulkStatusKind === "action_taken") {
          await updateDoc(doc(db, "Complaints", id), {
            complaintStatus: "action_taken",
            updatedAt: serverTimestamp(),
          });
        } else if (bulkStatusKind === "irrelevant") {
          await updateDoc(doc(db, "Complaints", id), {
            complaintStatus: "irrelevant",
            reason: bulkIrrelevantReason.trim(),
            updatedAt: serverTimestamp(),
          });
        }
        ok++;
      } catch (err) {
        console.error(err);
        fail++;
      }
    }
    setBulkBusy(false);
    setBulkConfirmOpen(false);
    setBulkStatusKind("");
    setBulkIrrelevantReason("");
    setSelectedIds([]);
    refetch();
    toast.show({
      type: fail === 0 ? "success" : "warning",
      title: "Bulk status update complete",
      description: `${ok} succeeded${fail > 0 ? `, ${fail} failed` : ""}`,
    });
  }, [admin, bulkStatusKind, bulkIrrelevantReason, selectedIds, refetch, toast]);

  /* -------------------------------- Exports -------------------------------- */
  const doExport = useCallback(async (): Promise<void> => {
    if (!exportFormat) return;
    setExportBusy(true);
    try {
      const now = new Date();
      const dateStr = format(now, "yyyy-MM-dd");
      const columns = [
        { header: "Complaint ID", dataKey: "complaintId" },
        { header: "Category", dataKey: "category" },
        { header: "Complainant", dataKey: "complainant" },
        { header: "Phone", dataKey: "phone" },
        { header: "District", dataKey: "district" },
        { header: "Tahsil", dataKey: "tahsil" },
        { header: "UC", dataKey: "uc" },
        { header: "Routing", dataKey: "routing" },
        { header: "Status", dataKey: "status" },
        { header: "Assignee", dataKey: "assignee" },
        { header: "Created", dataKey: "created" },
      ];
      const rows = filteredByTab.map((c) => ({
        complaintId: c.complaintId || c.id,
        category: wasaCategoryLabel(c.wasaCategory),
        complainant: c.complainantName || "",
        phone: c.complainantPhone || "",
        district: c.district || "",
        tahsil: c.tahsil || "",
        uc: c.ucMcNumber || "",
        routing:
          c.routingStrategy === "UC_MC_AUTO" ? "UC/MC Auto" : "Dept Queue",
        status: STATUS_LABELS[c.complaintStatus] ?? c.complaintStatus,
        assignee: c.assignedTo
          ? employeeNamesByUid[c.assignedTo] ?? c.assignedTo
          : "Unassigned",
        created: formatDateTime(c.createdAt),
      }));
      const summary = [
        { label: "Total", value: stats.total },
        { label: "Action Required", value: stats.actionRequired },
        { label: "Resolved", value: stats.resolved },
        { label: "Rejected", value: stats.rejected },
        { label: "Pending Queue", value: stats.pendingQueue },
        { label: "Overdue", value: stats.overdue },
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
  }, [exportFormat, filteredByTab, employeeNamesByUid, stats, toast]);

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
  const tahsilOptions = useMemo(
    () => [
      { value: "", label: "All tahsils" },
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
  const wasaCategoryOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...WASA_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
    ],
    []
  );
  const routingOptions = useMemo(
    () => [
      { value: "", label: "All routing" },
      { value: "DEPT_DASHBOARD", label: "Dept Queue" },
      { value: "UC_MC_AUTO", label: "UC/MC Auto" },
    ],
    []
  );

  const resetAll = useCallback((): void => {
    filters.resetFilters();
    setSearchInput("");
    setPageNum(1);
  }, [filters]);

  /* ------------------------------ Tab counts ------------------------------- */
  const myAssignmentsCount = useMemo(() => {
    if (!admin) return 0;
    return data.filter(
      (c) => (c as Complaint & { assignedBy?: string }).assignedBy === admin.id,
    ).length;
  }, [data, admin]);

  const tabsWithCounts: TabItem[] = useMemo(() => {
    return TABS.map((t) => {
      if (t.id === "pending_queue") return { ...t, count: stats.pendingQueue };
      if (t.id === "all_manhole") return { ...t, count: data.length };
      if (t.id === "my_assignments")
        return { ...t, count: myAssignmentsCount };
      return t;
    });
  }, [stats.pendingQueue, data.length, myAssignmentsCount]);

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
            Manage and assign WASA manhole complaints
          </p>
          <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">
            Complaints are filed by citizens via the public app.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabsWithCounts}
        activeId={tab}
        onChange={(id) => {
          setTab(id as TabId);
          setPageNum(1);
        }}
      />

      {/* Category quick filters */}
      <CategoryQuickFilters
        counts={categoryCounts}
        selected={filters.selectedWasaCategory}
        onSelect={(v) => {
          filters.setSelectedWasaCategory(v);
          setPageNum(1);
        }}
      />

      {/* Scope chip */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <MapPinned className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Viewing:
        </span>
        <span>
          {active.province || "-"} / {active.division || "All divisions"} /{" "}
          {active.district || "All districts"} /{" "}
          {active.tehsil || "All tahsils"}
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
            options={tahsilOptions}
            locked={filters.tehsilLocked}
          />
          <Dropdown
            value={filters.selectedWasaCategory}
            onChange={filters.setSelectedWasaCategory}
            options={wasaCategoryOptions}
          />
          <Dropdown
            value={filters.selectedStatus}
            onChange={filters.setSelectedStatus}
            options={statusOptions}
          />
          <Dropdown
            value={filters.selectedRouting}
            onChange={(v) =>
              filters.setSelectedRouting(v as "" | RoutingStrategy)
            }
            options={routingOptions}
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

      {/* Stats chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiChip label="Total" value={stats.total} />
        <KpiChip
          label="Action Required"
          value={stats.actionRequired}
          tone="amber"
        />
        <KpiChip label="Resolved" value={stats.resolved} tone="emerald" />
        <KpiChip label="Rejected" value={stats.rejected} tone="red" />
        <KpiChip label="Pending Queue" value={stats.pendingQueue} tone="brand" />
        <KpiChip label="Overdue" value={stats.overdue} tone="red" />
      </div>

      {/* Selection bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm dark:border-brand-900/40 dark:bg-brand-900/20">
          <div className="text-brand-900 dark:text-brand-200">
            <span className="font-semibold">{selectedIds.length}</span>{" "}
            selected
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
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => {
                setBulkStatusKind("action_taken");
                setBulkConfirmOpen(true);
              }}
            >
              Mark all Resolved
            </Button>
            <Button
              variant="destructive"
              size="sm"
              leftIcon={<XCircle className="h-4 w-4" />}
              onClick={() => {
                setBulkStatusKind("irrelevant");
                setBulkIrrelevantReason("");
                setBulkConfirmOpen(true);
              }}
            >
              Mark all Irrelevant
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              Cancel
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
            onReassign={handleReassign}
            onUnassign={handleUnassignRow}
            onMarkResolved={handleMarkResolvedRow}
            onMarkIrrelevant={handleMarkIrrelevantRow}
            employeeNamesByUid={employeeNamesByUid}
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
        onClose={() => setDetailOpen(false)}
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
            complaint={(() => {
              const ref =
                filteredByTab.find((c) => selectedIds.includes(c.id)) ??
                filteredByTab[0];
              return {
                wasaCategory: ref?.wasaCategory ?? null,
                division: ref?.division ?? "",
                district: ref?.district ?? "",
                tahsil: ref?.tahsil ?? "",
              };
            })()}
            employees={employees}
            loading={employeesLoading}
            onAssign={handleBulkAssign}
            onCancel={() => setBulkAssignOpen(false)}
            submitLabel={`Assign to ${selectedIds.length}`}
          />
        )}
      </Modal>

      {/* Bulk status confirm */}
      <Modal
        open={bulkConfirmOpen}
        onClose={() => {
          if (!bulkBusy) {
            setBulkConfirmOpen(false);
            setBulkStatusKind("");
            setBulkIrrelevantReason("");
          }
        }}
        title={
          bulkStatusKind === "action_taken"
            ? "Mark selected as Resolved?"
            : "Mark selected as Irrelevant?"
        }
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setBulkConfirmOpen(false);
                setBulkStatusKind("");
                setBulkIrrelevantReason("");
              }}
              disabled={bulkBusy}
            >
              Cancel
            </Button>
            <Button
              variant={
                bulkStatusKind === "irrelevant" ? "destructive" : "primary"
              }
              loading={bulkBusy}
              onClick={performBulkStatusChange}
            >
              Apply
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This will update {selectedIds.length} complaint
            {selectedIds.length === 1 ? "" : "s"}.
          </p>
          {bulkStatusKind === "irrelevant" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Shared reason
              </label>
              <textarea
                value={bulkIrrelevantReason}
                onChange={(e) => setBulkIrrelevantReason(e.target.value)}
                rows={3}
                placeholder="Why are these complaints irrelevant?"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Inline irrelevant (row) */}
      <Modal
        open={irrelevantTarget !== null}
        onClose={() => {
          if (!irrelevantBusy) {
            setIrrelevantTarget(null);
            setIrrelevantReason("");
          }
        }}
        title="Mark complaint irrelevant"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setIrrelevantTarget(null);
                setIrrelevantReason("");
              }}
              disabled={irrelevantBusy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={irrelevantBusy}
              onClick={performMarkIrrelevant}
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            This will set status to <strong>irrelevant</strong>. Provide a
            reason.
          </div>
          <textarea
            value={irrelevantReason}
            onChange={(e) => setIrrelevantReason(e.target.value)}
            rows={3}
            placeholder="Enter a short reason"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </Modal>

      {/* Export confirm */}
      <ExportConfirmModal
        open={exportFormat !== null}
        onClose={() => (exportBusy ? undefined : setExportFormat(null))}
        format={exportFormat ?? "pdf"}
        count={stats.total}
        onConfirm={doExport}
        loading={exportBusy}
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
  tone?: "brand" | "slate" | "amber" | "emerald" | "red";
}) {
  const toneClass: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    red: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
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
          className={cn("inline-flex h-2 w-2 rounded-full", toneClass[tone])}
          aria-hidden
        />
      </CardContent>
    </Card>
  );
}
