"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Users,
} from "lucide-react";
import {
  isAfter,
  isSameDay,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Dropdown } from "@/components/ui/Dropdown";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

import { useActiveFilters } from "@/context/FilterContext";
import { useWasaEmployees } from "@/hooks/useWasaEmployees";
import { useComplaints } from "@/hooks/useComplaints";

import { tsToDate } from "@/lib/firebase";
import { workloadBadgeClass } from "@/lib/smartAssignment";
import { formatDateTime, formatTimeAgo } from "@/lib/formatters";
import {
  STATUS_BADGE,
  STATUS_LABELS,
} from "@/constants/statuses";
import {
  wasaCategoryLabel,
  wasaCategoryColor,
} from "@/constants/wasaCategories";

import type {
  Complaint,
  ComplaintStatus,
  WasaEmployee,
} from "@/types";

import { WorkloadChart } from "@/components/assignments/WorkloadChart";
import { PageFilterBar } from "@/components/filters/PageFilterBar";

type TabId = "by_employee" | "by_date" | "by_status";

const TABS = [
  { id: "by_employee" as TabId, label: "By Employee" },
  { id: "by_date" as TabId, label: "By Date" },
  { id: "by_status" as TabId, label: "By Status" },
];

const STATUS_ORDER: ComplaintStatus[] = [
  "action_required",
  "action_taken",
  "irrelevant",
];

const DATE_RANGE_OPTIONS = [
  { value: "", label: "All dates" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export default function AssignmentsPage() {
  const f = useActiveFilters();
  const [tab, setTab] = useState<TabId>("by_employee");
  const [expandedEmp, setExpandedEmp] = useState<Record<string, boolean>>({});
  const [dateRange, setDateRange] = useState<string>("");

  const empFilters = useMemo(
    () => ({
      scopeDistricts: f.scopeDistricts,
      district: f.district || undefined,
      tehsil: f.tehsil || undefined,
      limit: 500,
    }),
    [f.scopeDistricts, f.district, f.tehsil],
  );

  const complaintFilters = useMemo(
    () => ({
      scopeDistricts: f.scopeDistricts,
      district: f.district || undefined,
      tahsil: f.tehsil || undefined,
      limit: 1000,
    }),
    [f.scopeDistricts, f.district, f.tehsil],
  );

  const { data: employees, loading: eLoading } = useWasaEmployees(empFilters);
  const { data: complaints, loading: cLoading } = useComplaints(complaintFilters);

  /* Apply date-range filter on `assignedAt` (when assigned). */
  const dateFiltered = useMemo<Complaint[]>(() => {
    if (!dateRange) return complaints;
    const days = Number(dateRange);
    if (!Number.isFinite(days) || days <= 0) return complaints;
    const cutoff = subDays(new Date(), days);
    return complaints.filter((c) => {
      if (!c.assignedAt) return false;
      const ts = tsToDate(c.assignedAt);
      return ts ? isAfter(ts, cutoff) : false;
    });
  }, [complaints, dateRange]);

  /* Active complaints per employee uid (action_required only) */
  const activeComplaintsByEmpUid = useMemo<Map<string, Complaint[]>>(() => {
    const map = new Map<string, Complaint[]>();
    for (const c of complaints) {
      if (!c.assignedTo) continue;
      if (c.complaintStatus !== "action_required") continue;
      const list = map.get(c.assignedTo) ?? [];
      list.push(c);
      map.set(c.assignedTo, list);
    }
    return map;
  }, [complaints]);

  const workloadChartData = useMemo(() => {
    return [...employees]
      .sort((a, b) => (b.currentAssignments ?? 0) - (a.currentAssignments ?? 0))
      .slice(0, 15)
      .map((e) => ({
        name: e.name || "Unknown",
        active: e.currentAssignments ?? 0,
      }));
  }, [employees]);

  /* By Date: bucket assigned complaints by `assignedAt` */
  const byDateBuckets = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterday = startOfDay(subDays(now, 1));
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });

    const buckets = {
      today: [] as Complaint[],
      yesterday: [] as Complaint[],
      thisWeek: [] as Complaint[],
      earlier: [] as Complaint[],
    };

    for (const c of dateFiltered) {
      const ts = tsToDate(c.assignedAt);
      if (!ts) continue;
      if (isSameDay(ts, todayStart)) buckets.today.push(c);
      else if (isSameDay(ts, yesterday)) buckets.yesterday.push(c);
      else if (isAfter(ts, weekStart)) buckets.thisWeek.push(c);
      else buckets.earlier.push(c);
    }
    return buckets;
  }, [dateFiltered]);

  /* By Status: group complaints by complaintStatus */
  const byStatus = useMemo<Partial<Record<ComplaintStatus, Complaint[]>>>(() => {
    const map: Partial<Record<ComplaintStatus, Complaint[]>> = {};
    for (const c of dateFiltered) {
      const key = c.complaintStatus;
      if (!map[key]) map[key] = [];
      map[key]!.push(c);
    }
    return map;
  }, [dateFiltered]);

  const loading = eLoading || cLoading;

  const toggleEmp = (id: string): void => {
    setExpandedEmp((s) => ({ ...s, [id]: !s[id] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Assignments
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Track complaint assignments and workload across your scope.
        </p>
      </div>

      {/* Shared filters */}
      <PageFilterBar />

      {/* Date-range scoped to the assignments view */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Date range (assigned)
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

      <Tabs
        tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-[320px] rounded-2xl" />
          <Skeleton className="h-[220px] rounded-2xl" />
        </div>
      ) : tab === "by_employee" ? (
        <ByEmployeeTab
          employees={employees}
          workloadChartData={workloadChartData}
          activeComplaintsByEmpUid={activeComplaintsByEmpUid}
          expandedEmp={expandedEmp}
          onToggle={toggleEmp}
        />
      ) : tab === "by_date" ? (
        <ByDateTab buckets={byDateBuckets} />
      ) : (
        <ByStatusTab byStatus={byStatus} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  By Employee tab                                                           */
/* -------------------------------------------------------------------------- */

function ByEmployeeTab({
  employees,
  workloadChartData,
  activeComplaintsByEmpUid,
  expandedEmp,
  onToggle,
}: {
  employees: WasaEmployee[];
  workloadChartData: { name: string; active: number }[];
  activeComplaintsByEmpUid: Map<string, Complaint[]>;
  expandedEmp: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  if (employees.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No employees in scope"
        description="Adjust your scope filters to see employees and their workload."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workload by employee</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {workloadChartData.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No workload data.
            </p>
          ) : (
            <WorkloadChart employees={workloadChartData} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[...employees]
          .sort((a, b) => (b.currentAssignments ?? 0) - (a.currentAssignments ?? 0))
          .map((emp) => {
            const active = emp.currentAssignments ?? 0;
            const overloaded = active >= 10;
            const expanded = !!expandedEmp[emp.id];
            const complaintsList = activeComplaintsByEmpUid.get(emp.uid ?? "") ?? [];
            return (
              <Card
                key={emp.id}
                className={cn(
                  overloaded &&
                    "border-red-300 ring-1 ring-red-200 dark:border-red-800 dark:ring-red-900/40",
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {emp.name || "Unnamed"}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {emp.designation || "Employee"}
                        {emp.district ? ` · ${emp.district}` : ""}
                        {emp.tehsil ? ` · ${emp.tehsil}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={workloadBadgeClass(active)}>
                        {active} active
                      </Badge>
                      {overloaded && (
                        <Badge variant="danger" className="gap-1 whitespace-nowrap">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          Overloaded
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-slate-500 dark:text-slate-400">Active</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {active}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-slate-500 dark:text-slate-400">Resolved</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {emp.totalResolved ?? 0}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggle(emp.id)}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    {expanded ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {expanded ? "Hide" : "Show"} active complaints (
                    {complaintsList.length})
                  </button>

                  {expanded && (
                    <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">
                      {complaintsList.length === 0 ? (
                        <li className="py-2 text-xs text-slate-500 dark:text-slate-400">
                          No active complaints.
                        </li>
                      ) : (
                        complaintsList.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center justify-between gap-2 py-1"
                          >
                            <span className="truncate text-xs text-slate-700 dark:text-slate-200">
                              {c.complaintId || c.id}
                            </span>
                            <Badge className={STATUS_BADGE[c.complaintStatus]}>
                              {STATUS_LABELS[c.complaintStatus]}
                            </Badge>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  By Date tab                                                               */
/* -------------------------------------------------------------------------- */

function ByDateTab({
  buckets,
}: {
  buckets: {
    today: Complaint[];
    yesterday: Complaint[];
    thisWeek: Complaint[];
    earlier: Complaint[];
  };
}) {
  const sections: { key: string; label: string; items: Complaint[] }[] = [
    { key: "today", label: "Today", items: buckets.today },
    { key: "yesterday", label: "Yesterday", items: buckets.yesterday },
    { key: "thisWeek", label: "This Week", items: buckets.thisWeek },
    { key: "earlier", label: "Earlier", items: buckets.earlier },
  ];

  const total =
    buckets.today.length +
    buckets.yesterday.length +
    buckets.thisWeek.length +
    buckets.earlier.length;

  if (total === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No assignments"
        description="There are no assigned complaints in this date range or scope."
      />
    );
  }

  return (
    <div className="space-y-4">
      {sections
        .filter((s) => s.items.length > 0)
        .map((s) => (
          <Card key={s.key}>
            <CardHeader>
              <CardTitle>
                {s.label}{" "}
                <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({s.items.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ComplaintList items={s.items} />
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  By Status tab                                                             */
/* -------------------------------------------------------------------------- */

function ByStatusTab({
  byStatus,
}: {
  byStatus: Partial<Record<ComplaintStatus, Complaint[]>>;
}) {
  const total = STATUS_ORDER.reduce(
    (acc, s) => acc + (byStatus[s]?.length ?? 0),
    0,
  );

  if (total === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No complaints"
        description="There are no complaints in this scope."
      />
    );
  }

  return (
    <div className="space-y-4">
      {STATUS_ORDER.filter((s) => (byStatus[s]?.length ?? 0) > 0).map((s) => (
        <StatusSection key={s} status={s} items={byStatus[s] ?? []} />
      ))}
    </div>
  );
}

function StatusSection({
  status,
  items,
}: {
  status: ComplaintStatus;
  items: Complaint[];
}) {
  const [open, setOpen] = useState<boolean>(true);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-4 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
            )}
            <CardTitle>{STATUS_LABELS[status]}</CardTitle>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({items.length})
            </span>
          </div>
        </div>
      </button>
      {open && (
        <CardContent className="pt-0">
          <ComplaintList items={items} />
        </CardContent>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared list                                                                */
/* -------------------------------------------------------------------------- */

function ComplaintList({ items }: { items: Complaint[] }) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
        Empty.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((c) => {
        const cat = c.wasaCategory;
        const color = wasaCategoryColor(cat);
        const label = wasaCategoryLabel(cat);
        const assigneeName =
          (c as Complaint & { assignedToName?: string | null }).assignedToName ??
          c.assignedTo;
        return (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {c.complaintId || c.id}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {label}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {assigneeName ? `Assigned to ${assigneeName}` : "Unassigned"}
                {c.assignedAt ? ` · ${formatTimeAgo(c.assignedAt)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={STATUS_BADGE[c.complaintStatus]}>
                {STATUS_LABELS[c.complaintStatus]}
              </Badge>
              <span
                className="hidden text-xs text-slate-400 sm:inline"
                title={formatDateTime(c.assignedAt ?? c.createdAt)}
              >
                {formatTimeAgo(c.assignedAt ?? c.createdAt)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
