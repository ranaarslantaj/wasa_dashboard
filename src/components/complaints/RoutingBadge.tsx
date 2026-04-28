"use client";

import { cn } from "@/lib/cn";

export interface RoutingBadgeProps {
  value: "UC_MC_AUTO" | "DEPT_DASHBOARD" | string;
  className?: string;
}

export function RoutingBadge({ value, className }: RoutingBadgeProps) {
  const isAuto = value === "UC_MC_AUTO";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium",
        isAuto
          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
          : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
        className
      )}
    >
      {isAuto ? "UC/MC Auto" : "Dept Queue"}
    </span>
  );
}

export default RoutingBadge;
