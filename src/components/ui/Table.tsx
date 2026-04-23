import {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

export function Table({
  className,
  ...rest
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn(
        "min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm",
        className
      )}
      {...rest}
    />
  );
}

export function THead({
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("bg-slate-50 dark:bg-slate-900/60", className)}
      {...rest}
    />
  );
}

export function TBody({
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn(
        "divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900",
        className
      )}
      {...rest}
    />
  );
}

export function TR({
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "hover:bg-slate-50 dark:hover:bg-slate-800/50",
        className
      )}
      {...rest}
    />
  );
}

export function TH({
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide text-xs",
        className
      )}
      {...rest}
    />
  );
}

export function TD({
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-slate-700 dark:text-slate-200",
        className
      )}
      {...rest}
    />
  );
}

export function ScrollableTable({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800",
        className
      )}
      {...rest}
    />
  );
}

export default Table;
