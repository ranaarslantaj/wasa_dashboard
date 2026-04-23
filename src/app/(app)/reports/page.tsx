"use client";

import { useMemo, useState } from "react";
import { differenceInHours, format } from "date-fns";
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
import { useComplaints } from "@/hooks/useComplaints";
import { useComplaintTypes } from "@/hooks/useComplaintTypes";

import { tsToDate } from "@/lib/firebase";
import { exportToPdf } from "@/lib/exportPdf";
import { exportToExcel } from "@/lib/exportExcel";
import { COMPLAINT_TYPE_FALLBACK } from "@/constants/complaintTypes";

import type { Complaint, ComplaintStatus } from "@/types";

import { ReportTable, type ReportRow } from "@/components/reports/ReportTable";
import { ExportConfirmModal } from "@/components/complaints/ExportConfirmModal";

type GroupBy = "tehsil" | "uc" | "complaint_type" | "employee";

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "tehsil", label: "Tehsil" },
  { value: "uc", label: "UC" },
  { value: "complaint_type", label: "Complaint Type" },
  { value: "employee", label: "Employee" },
];

const GROUP_BY_COLUMN_LABEL: Record<GroupBy, string> = {
  tehsil: "Tehsil",
  uc: "Union Council",
  complaint_type: "Complaint Type",
  employee: "Employee",
};

const STATUS_CHIPS: {
  key: ComplaintStatus | "total";
  label: string;
  classes: string;
}[] = [
  {
    key: "total",
    label: "Total",
    classes: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  {
    key: "pending",
    label: "Pending",
    classes: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  {
    key: "in_progress",
    label: "In Progress",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    key: "resolved",
    label: "Resolved",
    classes:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  {
    key: "rejected",
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

  const [groupBy, setGroupBy] = useState<GroupBy>("tehsil");
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

  const complaintFilters = useMemo(
    () => ({
      scopeDistricts: f.scopeDistricts,
      district: f.district || undefined,
      tehsil: f.tehsil || undefined,
      complaintType: f.complaintType || undefined,
      dateFrom: dateBounds.from,
      dateTo: dateBounds.to,
      limit: 1000,
    }),
    [
      f.scopeDistricts,
      f.district,
      f.tehsil,
      f.complaintType,
      dateBounds.from,
      dateBounds.to,
    ],
  );

  const { data: complaints, loading } = useComplaints(complaintFilters);
  const { data: types } = useComplaintTypes({ activeOnly: false });

  const typeLabelLookup = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const k of Object.keys(COMPLAINT_TYPE_FALLBACK)) {
      out[k] = COMPLAINT_TYPE_FALLBACK[k].label;
    }
    for (const t of types) out[t.key] = t.label;
    return out;
  }, [types]);

  /* ---- Top-level stats chips ---- */
  const statsCounts = useMemo(() => {
    const out: Record<ComplaintStatus | "total", number> = {
      total: complaints.length,
      pending: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
      reopened: 0,
    };
    for (const c of complaints) {
      out[c.status] = (out[c.status] ?? 0) + 1;
    }
    return out;
  }, [complaints]);

  /* ---- Aggregation ---- */
  const rows = useMemo<ReportRow[]>(() => {
    const keyFor = (c: Complaint): string => {
      switch (groupBy) {
        case "tehsil":
          return c.tehsil || "Unknown";
        case "uc":
          return c.ucName || "Unknown";
        case "complaint_type":
          return c.complaintType || "Unknown";
        case "employee":
          return c.assignedToName || "Unassigned";
        default:
          return "Unknown";
      }
    };

    const labelFor = (k: string): string => {
      if (groupBy === "complaint_type") {
        return typeLabelLookup[k] ?? k;
      }
      return k;
    };

    const buckets = new Map<
      string,
      {
        total: number;
        pending: number;
        assigned: number;
        in_progress: number;
        resolved: number;
        rejected: number;
        reopened: number;
        hoursSum: number;
        hoursCount: number;
      }
    >();

    for (const c of complaints) {
      const k = keyFor(c);
      let b = buckets.get(k);
      if (!b) {
        b = {
          total: 0,
          pending: 0,
          assigned: 0,
          in_progress: 0,
          resolved: 0,
          rejected: 0,
          reopened: 0,
          hoursSum: 0,
          hoursCount: 0,
        };
        buckets.set(k, b);
      }
      b.total += 1;
      switch (c.status) {
        case "pending":
          b.pending += 1;
          break;
        case "assigned":
          b.assigned += 1;
          break;
        case "in_progress":
          b.in_progress += 1;
          break;
        case "resolved":
          b.resolved += 1;
          break;
        case "rejected":
          b.rejected += 1;
          break;
        case "reopened":
          b.reopened += 1;
          break;
      }
      if (c.status === "resolved" && c.resolvedAt) {
        const created = tsToDate(c.createdAt);
        const resolved = tsToDate(c.resolvedAt);
        if (created && resolved) {
          b.hoursSum += differenceInHours(resolved, created);
          b.hoursCount += 1;
        }
      }
    }

    return Array.from(buckets.entries())
      .map(([k, b]) => ({
        key: k,
        label: labelFor(k),
        total: b.total,
        pending: b.pending,
        assigned: b.assigned,
        in_progress: b.in_progress,
        resolved: b.resolved,
        rejected: b.rejected,
        avgResolutionHours:
          b.hoursCount > 0 ? b.hoursSum / b.hoursCount : null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [complaints, groupBy, typeLabelLookup]);

  /* ---- Export helpers ---- */
  const groupByLabel = GROUP_BY_COLUMN_LABEL[groupBy];

  const buildExportPayload = () => {
    const columns = [
      { header: groupByLabel, dataKey: "label", width: 28 },
      { header: "Total", dataKey: "total", width: 10 },
      { header: "Pending", dataKey: "pending", width: 12 },
      { header: "Assigned", dataKey: "assigned", width: 12 },
      { header: "In Progress", dataKey: "in_progress", width: 14 },
      { header: "Resolved", dataKey: "resolved", width: 12 },
      { header: "Rejected", dataKey: "rejected", width: 12 },
      { header: "Avg Resolution", dataKey: "avgResolution", width: 16 },
    ];

    const mappedRows: Record<string, string | number>[] = rows.map((r) => ({
      label: r.label,
      total: r.total,
      pending: r.pending,
      assigned: r.assigned,
      in_progress: r.in_progress,
      resolved: r.resolved,
      rejected: r.rejected,
      avgResolution: formatHoursForExport(r.avgResolutionHours),
    }));

    const summary = [
      { label: "Total", value: statsCounts.total },
      { label: "Pending", value: statsCounts.pending },
      { label: "In Progress", value: statsCounts.in_progress },
      { label: "Resolved", value: statsCounts.resolved },
      { label: "Rejected", value: statsCounts.rejected },
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
      { value: "", label: "All tehsils" },
      ...filters.availableTehsils.map((t) => ({ value: t, label: t })),
    ],
    [filters.availableTehsils],
  );

  const complaintTypeOptions = useMemo(
    () => [
      { value: "", label: "All types" },
      ...types.map((t) => ({ value: t.key, label: t.label })),
    ],
    [types],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Reports
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Aggregated complaint statistics across your scope. Group by tehsil,
          UC, complaint type, or employee.
        </p>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
                Tehsil
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
                Complaint type
              </label>
              <Dropdown
                value={filters.selectedComplaintType}
                onChange={filters.setSelectedComplaintType}
                options={complaintTypeOptions}
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
              {statsCounts[chip.key as ComplaintStatus | "total"] ?? 0}
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
