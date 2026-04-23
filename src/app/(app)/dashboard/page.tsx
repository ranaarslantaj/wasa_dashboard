"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";
import {
  differenceInHours,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
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
import { useComplaints } from "@/hooks/useComplaints";
import { useWasaEmployees } from "@/hooks/useWasaEmployees";
import { useComplaintTypes } from "@/hooks/useComplaintTypes";

import { tsToDate } from "@/lib/firebase";
import { formatTimeAgo } from "@/lib/formatters";
import { COMPLAINT_TYPE_FALLBACK } from "@/constants/complaintTypes";
import { STATUS_LABELS } from "@/constants/statuses";
import type { Complaint, ComplaintStatus, WasaEmployee } from "@/types";

import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  ByTehsilChart,
  ByTypeChart,
  ComplaintsOverTimeChart,
  StatusPieChart,
  TopEmployeesChart,
} from "@/components/dashboard/charts";
import { RecentActivityList } from "@/components/dashboard/RecentActivityList";

type Window = "7d" | "30d" | "90d" | "all";

const WINDOW_OPTIONS: { value: Window; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  pending: "#94a3b8",
  assigned: "#3b82f6",
  in_progress: "#f59e0b",
  resolved: "#10b981",
  rejected: "#ef4444",
  reopened: "#a855f7",
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

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (windowKey === "all") return { from: null, to: null };
    const days = windowKey === "7d" ? 7 : windowKey === "30d" ? 30 : 90;
    return { from: subDays(now, days), to: now };
  }, [windowKey]);

  const complaintFilters = useMemo(
    () => ({
      scopeDistricts: f.scopeDistricts,
      district: f.district || undefined,
      tehsil: f.tehsil || undefined,
      complaintType: f.complaintType || undefined,
      dateFrom: from,
      dateTo: to,
      limit: 1000,
    }),
    [
      f.scopeDistricts,
      f.district,
      f.tehsil,
      f.complaintType,
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

  const typeFilters = useMemo(() => ({ activeOnly: true }), []);

  const { data: complaints, loading: cLoading } = useComplaints(complaintFilters);
  const { data: employees, loading: eLoading } = useWasaEmployees(employeeFilters);
  const { data: types } = useComplaintTypes(typeFilters);

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

  /* ---- Type color lookup ---- */
  const typeColorLookup = useMemo<Record<string, { label: string; color: string }>>(() => {
    const out: Record<string, { label: string; color: string }> = {};
    for (const key of Object.keys(COMPLAINT_TYPE_FALLBACK)) {
      const f = COMPLAINT_TYPE_FALLBACK[key];
      out[key] = { label: f.label, color: f.color };
    }
    for (const t of types) {
      out[t.key] = { label: t.label, color: t.color };
    }
    return out;
  }, [types]);

  /* ---- KPI stats ---- */
  const kpi = useMemo(() => {
    const total = complaints.length;
    let pending = 0;
    let inProgress = 0;
    let resolvedToday = 0;
    let resolvedThisWeek = 0;
    let resolvedThisMonth = 0;
    let resolvedCount = 0;
    let resolutionHoursSum = 0;

    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);

    for (const c of complaints) {
      if (c.status === "pending") pending += 1;
      if (c.status === "in_progress") inProgress += 1;
      if (c.status === "resolved") {
        const created = tsToDate(c.createdAt);
        const resolved = tsToDate(c.resolvedAt);
        if (resolved) {
          if (resolved >= todayStart) resolvedToday += 1;
          if (resolved >= weekStart) resolvedThisWeek += 1;
          if (resolved >= monthStart) resolvedThisMonth += 1;
        }
        if (created && resolved) {
          resolvedCount += 1;
          resolutionHoursSum += differenceInHours(resolved, created);
        }
      }
    }

    const avgResolutionHours =
      resolvedCount > 0 ? resolutionHoursSum / resolvedCount : null;

    return {
      total,
      pending,
      inProgress,
      resolvedToday,
      resolvedThisWeek,
      resolvedThisMonth,
      avgResolutionHours,
    };
  }, [complaints]);

  const activeEmployeesCount = useMemo<number>(
    () => employees.filter((e: WasaEmployee) => e.active).length,
    [employees],
  );

  /* ---- Charts: Over time ---- */
  const overTimeData = useMemo(() => {
    if (complaints.length === 0 && !from) {
      return [] as { date: string; count: number }[];
    }
    // Determine range
    let start: Date;
    let end: Date;
    if (from && to) {
      start = startOfDay(from);
      end = startOfDay(to);
    } else {
      // All-time window: compute from complaint createdAt bounds (cap at 90 days back for readability)
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
      const spanDays = Math.floor((end.getTime() - start.getTime()) / (24 * 3600 * 1000));
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

  /* ---- Charts: By type ---- */
  const byTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of complaints) {
      const k = c.complaintType || "unknown";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => {
        const meta = typeColorLookup[key];
        return {
          type: meta?.label ?? key,
          count,
          color: meta?.color ?? "#64748b",
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [complaints, typeColorLookup]);

  /* ---- Charts: By tehsil ---- */
  const byTehsilData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of complaints) {
      const k = c.tehsil || "Unknown";
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
      counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
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
      complaints.filter((c) => c.assignedAt && c.assignedToName),
      (c) => tsToDate(c.assignedAt),
    ).slice(0, 5);
  }, [complaints]);

  const recentlyResolved = useMemo(() => {
    return sortByDate(
      complaints.filter((c) => c.status === "resolved" && c.resolvedAt),
      (c) => tsToDate(c.resolvedAt),
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
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
              label="Pending Assignment"
              value={kpi.pending}
              icon={Clock}
              accent="amber"
            />
            <KpiCard
              label="In Progress"
              value={kpi.inProgress}
              icon={Activity}
              accent="brand"
            />
            <KpiCard
              label="Resolved Today"
              value={kpi.resolvedToday}
              subtext={`${kpi.resolvedThisWeek} this week`}
              icon={CheckCircle2}
              accent="emerald"
            />
            <KpiCard
              label="Resolved This Month"
              value={kpi.resolvedThisMonth}
              icon={ClipboardCheck}
              accent="emerald"
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
            <KpiCard
              label="Resolved This Week"
              value={kpi.resolvedThisWeek}
              icon={Users}
              accent="emerald"
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
            <CardTitle>Complaints by type</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[280px]" />
            ) : byTypeData.length === 0 ? (
              <p className="flex h-[280px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No data.
              </p>
            ) : (
              <ByTypeChart data={byTypeData} />
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
            <CardTitle>Complaints by tehsil (top 10)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[280px]" />
            ) : byTehsilData.length === 0 ? (
              <p className="flex h-[280px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No data.
              </p>
            ) : (
              <ByTehsilChart data={byTehsilData} />
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
            secondary:
              typeColorLookup[c.complaintType]?.label ?? c.complaintType,
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
            secondary: c.assignedToName ?? "Unassigned",
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
            secondary: c.assignedToName ?? "Unknown",
            meta: formatTimeAgo(c.resolvedAt),
            href: "/complaints",
          }))}
        />
      </div>
    </div>
  );
}
