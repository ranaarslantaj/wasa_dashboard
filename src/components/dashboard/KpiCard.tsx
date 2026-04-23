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
}

const ACCENT_BG: Record<KpiAccent, string> = {
  brand: "bg-brand-50 dark:bg-brand-900/30",
  amber: "bg-amber-50 dark:bg-amber-900/30",
  emerald: "bg-emerald-50 dark:bg-emerald-900/30",
  red: "bg-red-50 dark:bg-red-900/30",
  slate: "bg-slate-100 dark:bg-slate-800",
};

const ACCENT_TEXT: Record<KpiAccent, string> = {
  brand: "text-brand-600 dark:text-brand-300",
  amber: "text-amber-600 dark:text-amber-300",
  emerald: "text-emerald-600 dark:text-emerald-300",
  red: "text-red-600 dark:text-red-300",
  slate: "text-slate-600 dark:text-slate-300",
};

function KpiCardBase({
  label,
  value,
  subtext,
  icon: Icon,
  accent = "brand",
}: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {label}
            </p>
            <p className="text-2xl font-semibold mt-1 text-slate-900 dark:text-slate-100">
              {value}
            </p>
            {subtext && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
                {subtext}
              </p>
            )}
          </div>
          <div className={cn("rounded-lg p-2 shrink-0", ACCENT_BG[accent])}>
            <Icon className={cn("h-5 w-5", ACCENT_TEXT[accent])} aria-hidden />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const KpiCard = memo(KpiCardBase);
KpiCard.displayName = "KpiCard";

export default KpiCard;
