"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

export interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: PaginationProps) {
  const safeTotal = Math.max(1, totalPages);
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const atFirst = page <= 1;
  const atLast = page >= safeTotal;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-3 text-sm text-slate-600 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div>
        Showing <span className="font-medium text-slate-900 dark:text-slate-100">{start}</span>
        {"–"}
        <span className="font-medium text-slate-900 dark:text-slate-100">{end}</span> of{" "}
        <span className="font-medium text-slate-900 dark:text-slate-100">{totalCount}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Rows</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={atFirst}
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={atFirst}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-xs">
            Page <span className="font-medium text-slate-900 dark:text-slate-100">{page}</span> of{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">{safeTotal}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={atLast}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={atLast}
            onClick={() => onPageChange(safeTotal)}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Pagination;
