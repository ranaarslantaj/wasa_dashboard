"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

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
}

export function RecentActivityList({
  title,
  items,
  emptyLabel,
  icon: Icon,
}: RecentActivityListProps) {
  const shown = items.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {emptyLabel}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((item) => {
              const row = (
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.primary}
                    </p>
                    {item.secondary && (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.secondary}
                      </p>
                    )}
                  </div>
                  {item.meta && (
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {item.meta}
                    </span>
                  )}
                </div>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="block rounded-md -mx-2 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
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
