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
    <div className="space-y-4">
      {/* Full-width filter bar */}
      <PageFilterBar compact />

      {/* Hero — scope summary + date window */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-50 via-white to-emerald-50 p-4 dark:border-slate-800 dark:from-brand-900/30 dark:via-slate-900 dark:to-emerald-900/20 sm:p-5">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-500/20" />
        <div className="pointer-events-none absolute -bottom-12 right-24 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/15" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
              Dashboard overview
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              Welcome back{adminScope?.fullAccess ? ", super-admin" : ""}.
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {scopeLabel
                ? `Viewing ${scopeLabel}`
                : "WASA manhole complaints across your scope"}
              {" · "}
              <span className="text-slate-500 dark:text-slate-400">
                {windowKey === "all"
                  ? "All time"
                  : windowKey === "7d"
                    ? "Last 7 days"
                    : windowKey === "30d"
                      ? "Last 30 days"
                      : "Last 90 days"}
              </span>
            </p>
          </div>

          <div className="inline-flex w-fit shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
            {WINDOW_OPTIONS.map((opt) => {
              const active = windowKey === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setWindowKey(opt.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    active
                      ? "bg-brand-600 text-white shadow"
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
      </div>

      {/* Primary KPIs — bigger cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-2xl" />
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
              subtext={
                kpi.actionRequired > 0
                  ? `${Math.round((kpi.actionRequired / Math.max(1, kpi.total)) * 100)}% of total`
                  : undefined
              }
              icon={Clock}
              accent="amber"
            />
            <KpiCard
              label="Resolved"
              value={kpi.actionTaken}
              subtext={
                kpi.actionTaken > 0
                  ? `${Math.round((kpi.actionTaken / Math.max(1, kpi.total)) * 100)}% resolved`
                  : undefined
              }
              icon={CheckCircle2}
              accent="emerald"
            />
            <KpiCard
              label="Pending Queue"
              value={kpi.pendingQueue}
              subtext="Unassigned · awaiting admin"
              icon={Inbox}
              accent="amber"
            />
          </>
        )}
      </div>

      {/* Secondary KPIs — compact strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] rounded-2xl" />
          ))
        ) : (
          <>
            <KpiCard
              compact
              label="Rejected"
              value={kpi.irrelevant}
              icon={XCircle}
              accent="red"
            />
            <KpiCard
              compact
              label="Overdue (>72h)"
              value={kpi.overdue}
              icon={AlertTriangle}
              accent="red"
            />
            <KpiCard
              compact
              label="Avg Resolution"
              value={formatHours(kpi.avgResolutionHours)}
              icon={Timer}
              accent="slate"
            />
            <KpiCard
              compact
              label="Active Employees"
              value={`${activeEmployeesCount}/${employees.length || 0}`}
              icon={UserCheck}
              accent="brand"
            />
          </>
        )}
      </div>

      {/* Charts: trend (wide, 2/3) + status pie (narrow, 1/3) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Complaints over time"
          icon={ClipboardList}
          accent="brand"
          subtitle={overTimeData.length > 0 ? `${overTimeData.length} buckets` : undefined}
          className="lg:col-span-2"
        >
          {loading ? (
            <Skeleton className="h-[300px]" />
          ) : overTimeData.length === 0 ? (
            <EmptyChart label="No complaints in this window." />
          ) : (
            <ComplaintsOverTimeChart data={overTimeData} />
          )}
        </ChartCard>

        <ChartCard
          title="Status distribution"
          icon={CheckCircle2}
          accent="emerald"
          subtitle={statusPieData.length > 0 ? `${statusPieData.length} statuses` : undefined}
        >
          {loading ? (
            <Skeleton className="h-[300px]" />
          ) : statusPieData.length === 0 ? (
            <EmptyChart label="No data." />
          ) : (
            <StatusPieChart data={statusPieData} />
          )}
        </ChartCard>
      </div>

      {/* By category + by tahsil */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="By category"
          icon={Inbox}
          accent="amber"
          subtitle={byCategoryData.length > 0 ? `${byCategoryData.length} categories` : undefined}
        >
          {loading ? (
            <Skeleton className="h-[280px]" />
          ) : byCategoryData.length === 0 ? (
            <EmptyChart label="No data." />
          ) : (
            <ByTypeChart data={byCategoryData} />
          )}
        </ChartCard>

        <ChartCard
          title="Top tahsils"
          icon={ClipboardList}
          accent="brand"
          subtitle={byTahsilData.length > 0 ? `Top ${byTahsilData.length}` : undefined}
        >
          {loading ? (
            <Skeleton className="h-[280px]" />
          ) : byTahsilData.length === 0 ? (
            <EmptyChart label="No data." />
          ) : (
            <ByTehsilChart data={byTahsilData} />
          )}
        </ChartCard>
      </div>

      {/* Top employees */}
      <ChartCard
        title="Top employees by resolved count"
        icon={UserCheck}
        accent="emerald"
        subtitle={topEmployees.length > 0 ? `Top ${topEmployees.length}` : undefined}
      >
        {loading ? (
          <Skeleton className="h-[280px]" />
        ) : topEmployees.length === 0 ? (
          <EmptyChart label="No employees in scope." />
        ) : (
          <TopEmployeesChart data={topEmployees} />
        )}
      </ChartCard>

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RecentActivityList
          title="Latest complaints"
          icon={ClipboardList}
          accent="amber"
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
          accent="brand"
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
          accent="emerald"
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

/* -------------------------------------------------------------------------- */
/*  Local presentational helpers                                              */
/* -------------------------------------------------------------------------- */

const CHART_ACCENT_BG: Record<"brand" | "amber" | "emerald", string> = {
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon: import("lucide-react").LucideIcon;
  accent?: "brand" | "amber" | "emerald";
  className?: string;
  children: React.ReactNode;
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  accent = "brand",
  className,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            CHART_ACCENT_BG[accent],
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-sm">{title}</CardTitle>
          {subtitle && (
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
      {label}
    </div>
  );
}
