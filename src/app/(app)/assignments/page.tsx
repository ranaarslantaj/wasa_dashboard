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

import { useFilters, useActiveFilters } from "@/context/FilterContext";
import { useWasaEmployees } from "@/hooks/useWasaEmployees";
import { useAssignments } from "@/hooks/useAssignments";
import { useComplaints } from "@/hooks/useComplaints";

import { tsToDate } from "@/lib/firebase";
import { workloadBadgeClass } from "@/lib/smartAssignment";
import { formatDate } from "@/lib/formatters";
import { STATUS_BADGE, STATUS_LABELS } from "@/constants/statuses";

import type {
  Assignment,
  AssignmentStatus,
  Complaint,
  WasaEmployee,
} from "@/types";

import { WorkloadChart } from "@/components/assignments/WorkloadChart";
import { AssignmentTimeline } from "@/components/assignments/AssignmentTimeline";

type TabId = "by_employee" | "by_date" | "by_status";

const TABS = [
  { id: "by_employee" as TabId, label: "By Employee" },
  { id: "by_date" as TabId, label: "By Date" },
  { id: "by_status" as TabId, label: "By Status" },
];

const ASSIGNMENT_STATUS_ORDER: AssignmentStatus[] = [
  "assigned",
  "in_progress",
  "resolved",
  "reassigned",
  "rejected",
];

const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  reassigned: "Reassigned",
  rejected: "Rejected",
};

const DATE_RANGE_OPTIONS = [
  { value: "", label: "All dates" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export default function AssignmentsPage() {
  const f = useActiveFilters();
  const filters = useFilters();
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

  const assignmentsFilters = useMemo(() => ({ limit: 500 }), []);

  const complaintFilters = useMemo(
    () => ({
      scopeDistricts: f.scopeDistricts,
      district: f.district || undefined,
      tehsil: f.tehsil || undefined,
      limit: 1000,
    }),
    [f.scopeDistricts, f.district, f.tehsil],
  );

  const { data: employees, loading: eLoading } = useWasaEmployees(empFilters);
  const { data: assignments, loading: aLoading } =
    useAssignments(assignmentsFilters);
  const { data: complaints } = useComplaints(complaintFilters);

  /* ---- Date range filter for assignments ---- */
  const filteredAssignments = useMemo<Assignment[]>(() => {
    if (!dateRange) return assignments;
    const days = Number(dateRange);
    if (!Number.isFinite(days) || days <= 0) return assignments;
    const cutoff = subDays(new Date(), days);
    return assignments.filter((a) => {
      const ts = tsToDate(a.timestamp);
      return ts ? isAfter(ts, cutoff) : false;
    });
  }, [assignments, dateRange]);

  /* ---- Scope-filter assignments by employeeId (only employees in scope) ---- */
  const scopedEmployeeIds = useMemo<Set<string>>(() => {
    return new Set(employees.map((e) => e.uid).filter(Boolean));
  }, [employees]);

  const scopedAssignments = useMemo<Assignment[]>(() => {
    if (scopedEmployeeIds.size === 0) return filteredAssignments;
    return filteredAssignments.filter(
      (a) => !a.employeeId || scopedEmployeeIds.has(a.employeeId),
    );
  }, [filteredAssignments, scopedEmployeeIds]);

  /* ---- Active complaints per employee (uid) ---- */
  const activeComplaintsByEmpUid = useMemo<Map<string, Complaint[]>>(() => {
    const map = new Map<string, Complaint[]>();
    for (const c of complaints) {
      if (!c.assignedTo) continue;
      if (c.status === "resolved" || c.status === "rejected") continue;
      const list = map.get(c.assignedTo) ?? [];
      list.push(c);
      map.set(c.assignedTo, list);
    }
    return map;
  }, [complaints]);

  /* ---- By Employee: workload chart data ---- */
  const workloadChartData = useMemo(() => {
    return [...employees]
      .sort(
        (a, b) =>
          (b.currentAssignments ?? 0) - (a.currentAssignments ?? 0),
      )
      .slice(0, 15)
      .map((e) => ({
        name: e.name || "Unknown",
        active: e.currentAssignments ?? 0,
      }));
  }, [employees]);

  /* ---- By Date: group assignments ---- */
  const assignmentsByDateBucket = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterday = startOfDay(subDays(now, 1));
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });

    const buckets = {
      today: [] as Assignment[],
      yesterday: [] as Assignment[],
      thisWeek: [] as Assignment[],
      earlier: [] as Assignment[],
    };

    for (const a of scopedAssignments) {
      const ts = tsToDate(a.timestamp);
      if (!ts) {
        buckets.earlier.push(a);
        continue;
      }
      if (isSameDay(ts, todayStart)) buckets.today.push(a);
      else if (isSameDay(ts, yesterday)) buckets.yesterday.push(a);
      else if (isAfter(ts, weekStart)) buckets.thisWeek.push(a);
      else buckets.earlier.push(a);
    }

    return buckets;
  }, [scopedAssignments]);

  /* ---- By Status: group assignments ---- */
  const assignmentsByStatus = useMemo<
    Partial<Record<AssignmentStatus, Assignment[]>>
  >(() => {
    const map: Partial<Record<AssignmentStatus, Assignment[]>> = {};
    for (const a of scopedAssignments) {
      const key = a.status;
      if (!map[key]) map[key] = [];
      map[key]!.push(a);
    }
    return map;
  }, [scopedAssignments]);

  const loading = eLoading || aLoading;

  const toggleEmp = (id: string): void => {
    setExpandedEmp((s) => ({ ...s, [id]: !s[id] }));
  };

  /* ---- UI bits ---- */

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Assignments
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Track complaint assignments, workload, and history across your scope.
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
        <ByDateTab buckets={assignmentsByDateBucket} />
      ) : (
        <ByStatusTab byStatus={assignmentsByStatus} />
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
          .sort(
            (a, b) =>
              (b.currentAssignments ?? 0) - (a.currentAssignments ?? 0),
          )
          .map((emp) => {
            const active = emp.currentAssignments ?? 0;
            const overloaded = active >= 10;
            const expanded = !!expandedEmp[emp.id];
            const complaintsList =
              activeComplaintsByEmpUid.get(emp.uid ?? "") ?? [];
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
                        <Badge
                          variant="danger"
                          className="gap-1 whitespace-nowrap"
                        >
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          Overloaded
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-slate-500 dark:text-slate-400">
                        Active
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {active}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-slate-500 dark:text-slate-400">
                        Resolved
                      </p>
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
                            <Badge className={STATUS_BADGE[c.status]}>
                              {STATUS_LABELS[c.status]}
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
    today: Assignment[];
    yesterday: Assignment[];
    thisWeek: Assignment[];
    earlier: Assignment[];
  };
}) {
  const sections: { key: string; label: string; items: Assignment[] }[] = [
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
        description="There are no assignments in this date range or scope."
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
              <AssignmentTimeline assignments={s.items} />
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
  byStatus: Partial<Record<AssignmentStatus, Assignment[]>>;
}) {
  const total = ASSIGNMENT_STATUS_ORDER.reduce(
    (acc, s) => acc + (byStatus[s]?.length ?? 0),
    0,
  );

  if (total === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No assignments"
        description="There are no assignments in this scope."
      />
    );
  }

  return (
    <div className="space-y-4">
      {ASSIGNMENT_STATUS_ORDER.filter((s) => (byStatus[s]?.length ?? 0) > 0).map(
        (s) => (
          <StatusSection
            key={s}
            status={s}
            items={byStatus[s] ?? []}
          />
        ),
      )}
    </div>
  );
}

function StatusSection({
  status,
  items,
}: {
  status: AssignmentStatus;
  items: Assignment[];
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
            <CardTitle>{ASSIGNMENT_STATUS_LABEL[status]}</CardTitle>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({items.length})
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {items[0] ? `Last: ${formatDate(items[0].timestamp)}` : ""}
          </span>
        </div>
      </button>
      {open && (
        <CardContent className="pt-0">
          <AssignmentTimeline assignments={items} />
        </CardContent>
      )}
    </Card>
  );
}
