"use client";

import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type KpiAccent = "brand" | "amber" | "emerald" | "red" | "slate";

export interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  accent?: KpiAccent;
  /** Compact (smaller, single-row) variant for secondary KPIs. */
  compact?: boolean;
}

const ACCENT_BG: Record<KpiAccent, string> = {
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const ACCENT_BAR: Record<KpiAccent, string> = {
  brand: "bg-brand-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
  slate: "bg-slate-400",
};

function KpiCardBase({
  label,
  value,
  subtext,
  icon: Icon,
  accent = "brand",
  compact = false,
}: KpiCardProps) {
  if (compact) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-3 p-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              ACCENT_BG[accent],
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {value}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden">
      {/* Top accent stripe */}
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-0.5",
          ACCENT_BAR[accent],
        )}
        aria-hidden
      />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="mt-1.5 text-3xl font-bold leading-none text-slate-900 dark:text-slate-100">
              {value}
            </p>
            {subtext && (
              <p className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {subtext}
              </p>
            )}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105",
              ACCENT_BG[accent],
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const KpiCard = memo(KpiCardBase);
KpiCard.displayName = "KpiCard";

export default KpiCard;
