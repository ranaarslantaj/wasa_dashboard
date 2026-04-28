"use client";

import { cn } from "@/lib/cn";
import { WASA_CATEGORIES } from "@/constants/wasaCategories";

export interface CategoryQuickFiltersProps {
  counts: Record<string, number>;
  selected: string;
  onSelect: (v: string) => void;
  className?: string;
}

const chipBase =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors";

export function CategoryQuickFilters({
  counts,
  selected,
  onSelect,
  className,
}: CategoryQuickFiltersProps) {
  const totalCount = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto scrollbar-thin py-1",
        className
      )}
      role="tablist"
      aria-label="Quick filter by WASA category"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selected === ""}
        onClick={() => onSelect("")}
        className={cn(
          chipBase,
          selected === ""
            ? "bg-brand-600 text-white"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
        )}
      >
        <span>All</span>
        <span
          className={cn(
            "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            selected === ""
              ? "bg-white/20 text-white"
              : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"
          )}
        >
          {totalCount}
        </span>
      </button>
      {WASA_CATEGORIES.map((cat) => {
        const active = selected === cat.value;
        const count = counts[cat.value] ?? 0;
        return (
          <button
            key={cat.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(cat.value)}
            className={cn(
              chipBase,
              active
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
            title={cat.label}
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: cat.color }}
              aria-hidden
            />
            <span className="max-w-[12rem] truncate">{cat.label}</span>
            <span
              className={cn(
                "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                active
                  ? "bg-white/20 text-white"
                  : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default CategoryQuickFilters;
