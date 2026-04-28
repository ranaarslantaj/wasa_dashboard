"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";

import { useActiveFilters, useFilters } from "@/context/FilterContext";
import { useToast } from "@/context/ToastContext";
import { useComplaints, type ComplaintsFilters } from "@/hooks/useComplaints";
import { useWasaEmployees } from "@/hooks/useWasaEmployees";

import { hoursBetween } from "@/lib/formatters";
import { exportToPdf } from "@/lib/exportPdf";
import { exportToExcel } from "@/lib/exportExcel";
import {
  WASA_CATEGORIES,
  wasaCategoryLabel,
  type WasaCategoryValue,
} from "@/constants/wasaCategories";

import type {
  Complaint,
  ComplaintStatus,
  RoutingStrategy,
} from "@/types";

import { ReportTable, type ReportRow } from "@/components/reports/ReportTable";
import { ExportConfirmModal } from "@/components/complaints/ExportConfirmModal";

type GroupBy = "tahsil" | "wasa_category" | "routing" | "employee";

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "tahsil", label: "Tahsil" },
  { value: "wasa_category", label: "Category" },
  { value: "routing", label: "Routing" },
  { value: "employee", label: "Employee" },
];

const GROUP_BY_COLUMN_LABEL: Record<GroupBy, string> = {
  tahsil: "Tahsil",
  wasa_category: "Category",
  routing: "Routing",
  employee: "Employee",
};

const STATUS_CHIPS: {
  key: "total" | ComplaintStatus;
  label: string;
  classes: string;
}[] = [
  {
    key: "total",
    label: "Total",
    classes: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  {
    key: "action_required",
    label: "Action Required",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    key: "action_taken",
    label: "Resolved",
    classes:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  {
    key: "irrelevant",
    label: "Rejected",
    classes: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
];

const DATE_RANGE_OPTIONS = [
  { value: "", label: "All dates" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const ROUTING_OPTIONS: { value: "" | RoutingStrategy; label: string }[] = [
  { value: "", label: "All routings" },
  { value: "DEPT_DASHBOARD", label: "Dept Queue" },
  { value: "UC_MC_AUTO", label: "UC/MC Auto" },
];

const ROUTING_LABEL: Record<RoutingStrategy, string> = {
  DEPT_DASHBOARD: "Dept Queue",
  UC_MC_AUTO: "UC/MC Auto",
};

const formatHoursForExport = (h: number | null): string => {
  if (h === null || !Number.isFinite(h)) return "-";
  if (h < 1) return `${Math.max(0, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
};

export default function ReportsPage() {
  const f = useActiveFilters();
  const filters = useFilters();
  const toast = useToast();

  const [groupBy, setGroupBy] = useState<GroupBy>("tahsil");
  const [dateRange, setDateRange] = useState<string>("");
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const dateBounds = useMemo(() => {
    if (!dateRange) return { from: null as Date | null, to: null as Date | null };
    const days = Number(dateRange);
    if (!Number.isFinite(days) || days <= 0) {
      return { from: null, to: null };
    }
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 3600 * 1000);
    return { from, to };
  }, [dateRange]);

  const complaintFilters = useMemo<ComplaintsFilters>(
    () => ({
      scopeDistricts: f.scopeDistricts,
      district: f.district || undefined,
      tahsil: f.tehsil || undefined,
      wasaCategory: f.wasaCategory || undefined,
      routingStrategy: f.routing || undefined,
      dateFrom: dateBounds.from,
      dateTo: dateBounds.to,
      limit: 1000,
    }),
    [
      f.scopeDistricts,
      f.district,
      f.tehsil,
      f.wasaCategory,
      f.routing,
      dateBounds.from,
      dateBounds.to,
    ],
  );

  const employeeFilters = useMemo(
    () => ({
      scopeDistricts: f.scopeDistricts,
      activeOnly: false,
      limit: 1000,
    }),
    [f.scopeDistricts],
  );

  const { data: complaints, loading } = useComplaints(complaintFilters);
  const { data: employees } = useWasaEmployees(employeeFilters);

  /* ---- Employee uid -> name lookup ---- */
  const employeeNameByUid = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const e of employees) {
      if (e.uid) out[e.uid] = e.name || "Unnamed";
    }
    return out;
  }, [employees]);

  /* ---- Top-level stats chips ---- */
  const statsCounts = useMemo(() => {
    const out: Record<"total" | ComplaintStatus, number> = {
      total: complaints.length,
      action_required: 0,
      action_taken: 0,
      irrelevant: 0,
    };
    for (const c of complaints) {
      out[c.complaintStatus] = (out[c.complaintStatus] ?? 0) + 1;
    }
    return out;
  }, [complaints]);

  /* ---- Aggregation ---- */
  const rows = useMemo<ReportRow[]>(() => {
    type Bucket = {
      key: string;
      label: string;
      total: number;
      action_required: number;
      action_taken: number;
      irrelevant: number;
      resolutionHoursSum: number;
      resolvedCount: number;
    };

    const keyFor = (c: Complaint): string => {
      switch (groupBy) {
        case "tahsil":
          return c.tahsil || "";
        case "wasa_category":
          return (c.wasaCategory as string) || "others";
        case "routing":
          return c.routingStrategy || "";
        case "employee":
          return c.assignedTo || "";
        default:
          return "";
      }
    };

    const labelFor = (k: string): string => {
      switch (groupBy) {
        case "tahsil":
          return k || "—";
        case "wasa_category":
          return wasaCategoryLabel(k);
        case "routing":
          return k ? ROUTING_LABEL[k as RoutingStrategy] ?? k : "—";
        case "employee":
          return k ? employeeNameByUid[k] ?? k : "Unassigned";
        default:
          return k || "—";
      }
    };

    const map = new Map<string, Bucket>();
    for (const c of complaints) {
      const key = keyFor(c);
      let b = map.get(key);
      if (!b) {
        b = {
          key,
          label: labelFor(key),
          total: 0,
          action_required: 0,
          action_taken: 0,
          irrelevant: 0,
          resolutionHoursSum: 0,
          resolvedCount: 0,
        };
        map.set(key, b);
      }
      b.total += 1;
      b[c.complaintStatus] += 1;
      if (c.complaintStatus === "action_taken") {
        const h = hoursBetween(c.createdAt, c.actionTakenAt);
        if (h !== null) {
          b.resolutionHoursSum += h;
          b.resolvedCount += 1;
        }
      }
    }

    return Array.from(map.values())
      .map((b) => ({
        key: b.key,
        label: b.label,
        total: b.total,
        action_required: b.action_required,
        action_taken: b.action_taken,
        irrelevant: b.irrelevant,
        avgResolutionHours:
          b.resolvedCount > 0 ? b.resolutionHoursSum / b.resolvedCount : null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [complaints, groupBy, employeeNameByUid]);

  /* ---- Export helpers ---- */
  const groupByLabel = GROUP_BY_COLUMN_LABEL[groupBy];

  const buildExportPayload = () => {
    const columns = [
      { header: groupByLabel, dataKey: "label", width: 28 },
      { header: "Total", dataKey: "total", width: 10 },
      { header: "Action Required", dataKey: "action_required", width: 16 },
      { header: "Resolved", dataKey: "action_taken", width: 12 },
      { header: "Rejected", dataKey: "irrelevant", width: 12 },
      { header: "Avg Resolution", dataKey: "avgResolution", width: 16 },
    ];

    const mappedRows: Record<string, string | number>[] = rows.map((r) => ({
      label: r.label,
      total: r.total,
      action_required: r.action_required,
      action_taken: r.action_taken,
      irrelevant: r.irrelevant,
      avgResolution: formatHoursForExport(r.avgResolutionHours),
    }));

    const summary = [
      { label: "Total", value: statsCounts.total },
      { label: "Action Required", value: statsCounts.action_required },
      { label: "Resolved", value: statsCounts.action_taken },
      { label: "Rejected", value: statsCounts.irrelevant },
    ];

    return { columns, mappedRows, summary };
  };

  const onExportPdf = async (): Promise<void> => {
    if (rows.length === 0) return;
    setIsExportingPdf(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const { columns, mappedRows, summary } = buildExportPayload();
      const dateStr = format(new Date(), "yyyy-MM-dd");
      exportToPdf({
        title: `WASA Report — by ${groupByLabel}`,
        columns,
        rows: mappedRows,
        filename: `WASA_Report_${groupBy}_${dateStr}.pdf`,
        summary,
      });
      toast.show({ type: "success", title: "PDF report downloaded." });
      setPdfModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.show({ type: "error", title: "Failed to export PDF." });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const onExportExcel = async (): Promise<void> => {
    if (rows.length === 0) return;
    setIsExportingExcel(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const { columns, mappedRows } = buildExportPayload();
      exportToExcel({
        sheetName: "Report",
        columns,
        rows: mappedRows,
        filenamePrefix: `WASA_Report_${groupBy}`,
      });
      toast.show({ type: "success", title: "Excel report downloaded." });
      setExcelModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.show({ type: "error", title: "Failed to export Excel." });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const districtOptions = useMemo(
    () => [
      { value: "", label: "All districts" },
      ...filters.availableDistricts.map((d) => ({ value: d, label: d })),
    ],
    [filters.availableDistricts],
  );

  const tehsilOptions = useMemo(
    () => [
      { value: "", label: "All tahsils" },
      ...filters.availableTehsils.map((t) => ({ value: t, label: t })),
    ],
    [filters.availableTehsils],
  );

  const wasaCategoryOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...WASA_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Reports
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Aggregated complaint statistics across your scope. Group by tahsil,
          category, routing, or employee.
        </p>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                District
              </label>
              <Dropdown
                value={filters.selectedDistrict}
                onChange={filters.setSelectedDistrict}
                options={districtOptions}
                locked={filters.districtLocked}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Tahsil
              </label>
              <Dropdown
                value={filters.selectedTehsil}
                onChange={filters.setSelectedTehsil}
                options={tehsilOptions}
                locked={filters.tehsilLocked}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Category
              </label>
              <Dropdown
                value={filters.selectedWasaCategory}
                onChange={(v) =>
                  filters.setSelectedWasaCategory(v as WasaCategoryValue | "")
                }
                options={wasaCategoryOptions}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Routing
              </label>
              <Dropdown
                value={filters.selectedRouting}
                onChange={(v) =>
                  filters.setSelectedRouting(v as "" | RoutingStrategy)
                }
                options={ROUTING_OPTIONS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Date range
              </label>
              <Dropdown
                value={dateRange}
                onChange={setDateRange}
                options={DATE_RANGE_OPTIONS}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Group by + Export row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <span className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Group by:
          </span>
          {GROUP_BY_OPTIONS.map((opt) => {
            const active = groupBy === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGroupBy(opt.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileText className="h-4 w-4" aria-hidden />}
            onClick={() => setPdfModalOpen(true)}
            loading={isExportingPdf}
            disabled={rows.length === 0 || loading}
          >
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}
            onClick={() => setExcelModalOpen(true)}
            loading={isExportingExcel}
            disabled={rows.length === 0 || loading}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {/* Stats chips */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_CHIPS.map((chip) => (
          <span
            key={chip.key}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium",
              chip.classes,
            )}
          >
            <span>{chip.label}</span>
            <span className="tabular-nums font-semibold">
              {statsCounts[chip.key] ?? 0}
            </span>
          </span>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Report — by {groupByLabel}</CardTitle>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Download className="h-3.5 w-3.5" aria-hidden />
              {rows.length} group{rows.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ReportTable
            rows={rows}
            loading={loading}
            groupByLabel={groupByLabel}
          />
        </CardContent>
      </Card>

      <ExportConfirmModal
        open={pdfModalOpen}
        onClose={() => {
          if (!isExportingPdf) setPdfModalOpen(false);
        }}
        format="pdf"
        count={rows.length}
        onConfirm={onExportPdf}
        loading={isExportingPdf}
      />
      <ExportConfirmModal
        open={excelModalOpen}
        onClose={() => {
          if (!isExportingExcel) setExcelModalOpen(false);
        }}
        format="excel"
        count={rows.length}
        onConfirm={onExportExcel}
        loading={isExportingExcel}
      />
    </div>
  );
}
