"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export interface RecentActivityItem {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
  href?: string;
}

export interface RecentActivityListProps {
  title: string;
  items: RecentActivityItem[];
  emptyLabel: string;
  icon: LucideIcon;
  /** Optional accent for the header icon. Defaults to slate. */
  accent?: "brand" | "amber" | "emerald" | "red" | "slate";
  /** Optional href for the "view all" footer link. Defaults to /complaints. */
  viewAllHref?: string;
}

const ACCENT: Record<NonNullable<RecentActivityListProps["accent"]>, string> = {
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function RecentActivityList({
  title,
  items,
  emptyLabel,
  icon: Icon,
  accent = "slate",
  viewAllHref = "/complaints",
}: RecentActivityListProps) {
  const shown = items.slice(0, 5);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg",
              ACCENT[accent],
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        {shown.length > 0 && (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            View all <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {shown.length === 0 ? (
          <div className="flex h-full min-h-[140px] items-center justify-center rounded-lg border border-dashed border-slate-200 px-3 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {emptyLabel}
          </div>
        ) : (
          <ul className="space-y-1">
            {shown.map((item) => {
              const row = (
                <div className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      accent === "amber" && "bg-amber-500",
                      accent === "emerald" && "bg-emerald-500",
                      accent === "red" && "bg-red-500",
                      accent === "brand" && "bg-brand-500",
                      accent === "slate" && "bg-slate-400",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.primary}
                    </p>
                    {item.secondary && (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {item.secondary}
                      </p>
                    )}
                  </div>
                  {item.meta && (
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500">
                      {item.meta}
                    </span>
                  )}
                </div>
              );
              return (
                <li key={item.id}>
                  {item.href ? <Link href={item.href}>{row}</Link> : row}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default RecentActivityList;
