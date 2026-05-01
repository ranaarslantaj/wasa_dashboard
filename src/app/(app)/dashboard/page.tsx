"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Inbox,
  Timer,
  UserCheck,
  XCircle,
} from "lucide-react";
import {
  format,
  startOfDay,
  subDays,
} from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

import { useAuth } from "@/context/AuthContext";
import { useActiveFilters } from "@/context/FilterContext";
import { useComplaints, type ComplaintsFilters } from "@/hooks/useComplaints";
import { useWasaEmployees } from "@/hooks/useWasaEmployees";

import { tsToDate } from "@/lib/firebase";
import { formatTimeAgo, hoursBetween } from "@/lib/formatters";
import { isOverdue } from "@/lib/derivePriority";
import { STATUS_LABELS } from "@/constants/statuses";
import { wasaCategoryColor, wasaCategoryLabel } from "@/constants/wasaCategories";
import type {
  Complaint,
  ComplaintStatus,
  WasaEmployee,
} from "@/types";

import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  ByTehsilChart,
  ByTypeChart,
  ComplaintsOverTimeChart,
  StatusPieChart,
  TopEmployeesChart,
} from "@/components/dashboard/charts";
import { RecentActivityList } from "@/components/dashboard/RecentActivityList";
import { PageFilterBar } from "@/components/filters/PageFilterBar";

type Window = "7d" | "30d" | "90d" | "all";

const WINDOW_OPTIONS: { value: Window; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  action_required: "#f59e0b",
  action_taken: "#10b981",
  irrelevant: "#ef4444",
};

const formatHours = (h: number | null): string => {
  if (h === null || !Number.isFinite(h)) return "-";
  if (h < 1) return `${Math.max(0, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
};

export default function DashboardPage() {
  const { adminScope, hasFullAccess } = useAuth();
  const f = useActiveFilters();

  const [windowKey, setWindowKey] = useState<Window>("30d");

  const { from, to } = useMemo<{ from: Date | null; to: Date | null }>(() => {
    const now = new Date();
    if (windowKey === "all") return { from: null, to: null };
    const days = windowKey === "7d" ? 7 : windowKey === "30d" ? 30 : 90;
    return { from: subDays(now, days), to: now };
  }, [windowKey]);

  const complaintFilters = useMemo<ComplaintsFilters>(
    () => ({
      scopeDistricts: f.scopeDistricts,
      district: f.district || undefined,
      tahsil: f.tehsil || undefined,
      wasaCategory: f.wasaCategory || undefined,
      routingStrategy: f.routing || undefined,
      dateFrom: from,
      dateTo: to,
      limit: 1000,
    }),
    [
      f.scopeDistricts,
      f.district,
      f.tehsil,
      f.wasaCategory,
      f.routing,
      from,
      to,
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

  const { data: complaints, loading: cLoading } = useComplaints(complaintFilters);
  const { data: employees, loading: eLoading } = useWasaEmployees(employeeFilters);

  /* ---- Scope label ---- */
  const scopeLabel = useMemo<string>(() => {
    if (!adminScope) return "";
    if (hasFullAccess || adminScope.fullAccess) return "All regions";
    const parts: string[] = [adminScope.province || "Punjab"];
    if (adminScope.division) parts.push(adminScope.division);
    if (adminScope.district) parts.push(adminScope.district);
    if (adminScope.tehsil) parts.push(adminScope.tehsil);
    return parts.join(" / ");
  }, [adminScope, hasFullAccess]);

  /* ---- KPI stats ---- */
  const kpi = useMemo(() => {
    let actionRequired = 0;
    let actionTaken = 0;
    let irrelevant = 0;
    let pendingQueue = 0;
    let overdue = 0;
    let resolvedCount = 0;
    let resolutionHoursSum = 0;

    for (const c of complaints) {
      if (c.complaintStatus === "action_required") actionRequired += 1;
      else if (c.complaintStatus === "action_taken") actionTaken += 1;
      else if (c.complaintStatus === "irrelevant") irrelevant += 1;

      if (
        c.routingStrategy === "DEPT_DASHBOARD" &&
        c.assignedTo == null &&
        c.complaintStatus === "action_required"
      ) {
        pendingQueue += 1;
      }

      const created = tsToDate(c.createdAt);
      if (isOverdue(created, c.complaintStatus)) {
        overdue += 1;
      }

      if (c.complaintStatus === "action_taken") {
        const h = hoursBetween(c.createdAt, c.actionTakenAt);
        if (h !== null) {
          resolutionHoursSum += h;
          resolvedCount += 1;
        }
      }
    }

    const avgResolutionHours =
      resolvedCount > 0 ? resolutionHoursSum / resolvedCount : null;

    return {
      total: complaints.length,
      actionRequired,
      actionTaken,
      irrelevant,
      pendingQueue,
      overdue,
      avgResolutionHours,
    };
  }, [complaints]);

  const activeEmployeesCount = useMemo<number>(
    () => employees.filter((e: WasaEmployee) => e.active).length,
    [employees],
  );

  /* ---- Employee uid -> name lookup ---- */
  const employeeNameByUid = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const e of employees) {
      if (e.uid) map[e.uid] = e.name || "Unnamed";
    }
    return map;
  }, [employees]);

  /* ---- Charts: Over time ---- */
  const overTimeData = useMemo(() => {
    if (complaints.length === 0 && !from) {
      return [] as { date: string; count: number }[];
    }
    let start: Date;
    let end: Date;
    if (from && to) {
      start = startOfDay(from);
      end = startOfDay(to);
    } else {
      const times: number[] = [];
      for (const c of complaints) {
        const d = tsToDate(c.createdAt);
        if (d) times.push(d.getTime());
      }
      if (times.length === 0) return [];
      const minT = Math.min(...times);
      const maxT = Math.max(...times);
      start = startOfDay(new Date(minT));
      end = startOfDay(new Date(maxT));
      const maxDays = 90;
      const spanDays = Math.floor(
        (end.getTime() - start.getTime()) / (24 * 3600 * 1000),
      );
      if (spanDays > maxDays) {
        start = startOfDay(subDays(end, maxDays));
      }
    }

    const bucket = new Map<string, number>();
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      bucket.set(format(cursor, "yyyy-MM-dd"), 0);
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const c of complaints) {
      const d = tsToDate(c.createdAt);
      if (!d) continue;
      const key = format(startOfDay(d), "yyyy-MM-dd");
      if (bucket.has(key)) {
        bucket.set(key, (bucket.get(key) ?? 0) + 1);
      }
    }
    return Array.from(bucket.entries()).map(([k, v]) => ({
      date: format(new Date(k), "MMM d"),
      count: v,
    }));
  }, [complaints, from, to]);

  /* ---- Charts: By category ---- */
  const byCategoryData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of complaints) {
      const k = c.wasaCategory ?? "others";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({
        type: wasaCategoryLabel(key),
        count,
        color: wasaCategoryColor(key),
      }))
      .sort((a, b) => b.count - a.count);
  }, [complaints]);

  /* ---- Charts: By tahsil ---- */
  const byTahsilData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of complaints) {
      const k = c.tahsil || "Unknown";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [complaints]);

  /* ---- Charts: Status pie ---- */
  const statusPieData = useMemo(() => {
    const counts = new Map<ComplaintStatus, number>();
    for (const c of complaints) {
      counts.set(c.complaintStatus, (counts.get(c.complaintStatus) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([status, count]) => ({
        status: STATUS_LABELS[status],
        count,
        color: STATUS_COLORS[status] ?? "#64748b",
      }))
      .sort((a, b) => b.count - a.count);
  }, [complaints]);

  /* ---- Charts: Top employees ---- */
  const topEmployees = useMemo(() => {
    return [...employees]
      .sort((a, b) => (b.totalResolved ?? 0) - (a.totalResolved ?? 0))
      .slice(0, 5)
      .map((e) => ({
        name: e.name || "Unknown",
        resolved: e.totalResolved ?? 0,
      }));
  }, [employees]);

  /* ---- Recent activity lists ---- */
  const sortByDate = (
    list: Complaint[],
    getter: (c: Complaint) => Date | null,
  ): Complaint[] => {
    return [...list]
      .filter((c) => getter(c) !== null)
      .sort((a, b) => {
        const da = getter(a)?.getTime() ?? 0;
        const db = getter(b)?.getTime() ?? 0;
        return db - da;
      });
  };

  const latestComplaints = useMemo(() => {
    return sortByDate(complaints, (c) => tsToDate(c.createdAt)).slice(0, 5);
  }, [complaints]);

  const recentlyAssigned = useMemo(() => {
    return sortByDate(
      complaints.filter((c) => c.assignedAt != null),
      (c) => tsToDate(c.assignedAt),
    ).slice(0, 5);
  }, [complaints]);

  const recentlyResolved = useMemo(() => {
    return sortByDate(
      complaints.filter(
        (c) => c.complaintStatus === "action_taken" && c.actionTakenAt != null,
      ),
      (c) => tsToDate(c.actionTakenAt),
    ).slice(0, 5);
  }, [complaints]);

  const loading = cLoading || eLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {scopeLabel
              ? `Overview for ${scopeLabel}`
              : "Overview of WASA operations"}
          </p>
        </div>

        {/* Window toggle */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {WINDOW_OPTIONS.map((opt) => {
            const active = windowKey === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setWindowKey(opt.value)}
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
      </div>

      {/* Shared filters */}
      <PageFilterBar />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[98px] rounded-2xl" />
          ))
        ) : (
          <>
            <KpiCard
              label="Total Complaints"
              value={kpi.total}
              icon={ClipboardList}
              accent="brand"
            />
            <KpiCard
              label="Action Required"
              value={kpi.actionRequired}
              icon={Clock}
              accent="amber"
            />
            <KpiCard
              label="Resolved"
              value={kpi.actionTaken}
              icon={CheckCircle2}
              accent="emerald"
            />
            <KpiCard
              label="Rejected"
              value={kpi.irrelevant}
              icon={XCircle}
              accent="red"
            />
            <KpiCard
              label="Pending Queue"
              value={kpi.pendingQueue}
              subtext="Unassigned dept queue"
              icon={Inbox}
              accent="amber"
            />
            <KpiCard
              label="Overdue"
              value={kpi.overdue}
              subtext=">72h pending"
              icon={AlertTriangle}
              accent="red"
            />
            <KpiCard
              label="Avg Resolution"
              value={formatHours(kpi.avgResolutionHours)}
              icon={Timer}
              accent="slate"
            />
            <KpiCard
              label="Active Employees"
              value={activeEmployeesCount}
              subtext={`${employees.length} total`}
              icon={UserCheck}
              accent="brand"
            />
          </>
        )}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Complaints over time</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[280px]" />
            ) : overTimeData.length === 0 ? (
              <p className="flex h-[280px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No complaints in this window.
              </p>
            ) : (
              <ComplaintsOverTimeChart data={overTimeData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Category</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[280px]" />
            ) : byCategoryData.length === 0 ? (
              <p className="flex h-[280px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No data.
              </p>
            ) : (
              <ByTypeChart data={byCategoryData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Status distribution</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[280px]" />
            ) : statusPieData.length === 0 ? (
              <p className="flex h-[280px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No data.
              </p>
            ) : (
              <StatusPieChart data={statusPieData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Complaints by tahsil (top 10)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[280px]" />
            ) : byTahsilData.length === 0 ? (
              <p className="flex h-[280px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No data.
              </p>
            ) : (
              <ByTehsilChart data={byTahsilData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 3 */}
      <Card>
        <CardHeader>
          <CardTitle>Top employees by resolved count</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <Skeleton className="h-[280px]" />
          ) : topEmployees.length === 0 ? (
            <p className="flex h-[280px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              No employees in scope.
            </p>
          ) : (
            <TopEmployeesChart data={topEmployees} />
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RecentActivityList
          title="Latest complaints"
          icon={ClipboardList}
          emptyLabel="No recent complaints."
          items={latestComplaints.map((c) => ({
            id: c.id,
            primary: c.complaintId || c.id,
            secondary: wasaCategoryLabel(c.wasaCategory),
            meta: formatTimeAgo(c.createdAt),
            href: "/complaints",
          }))}
        />
        <RecentActivityList
          title="Recently assigned"
          icon={UserCheck}
          emptyLabel="No recent assignments."
          items={recentlyAssigned.map((c) => ({
            id: c.id,
            primary: c.complaintId || c.id,
            secondary: c.assignedTo
              ? employeeNameByUid[c.assignedTo] ?? "Assigned"
              : "Unassigned",
            meta: formatTimeAgo(c.assignedAt),
            href: "/complaints",
          }))}
        />
        <RecentActivityList
          title="Recently resolved"
          icon={CheckCircle2}
          emptyLabel="No recent resolutions."
          items={recentlyResolved.map((c) => ({
            id: c.id,
            primary: c.complaintId || c.id,
            secondary: c.assignedTo
              ? employeeNameByUid[c.assignedTo] ?? "Resolved"
              : "Resolved",
            meta: formatTimeAgo(c.actionTakenAt),
            href: "/complaints",
          }))}
        />
      </div>
    </div>
  );
}
