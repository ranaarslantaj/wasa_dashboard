"use client";

import { useMemo } from "react";
import {
  ScrollableTable,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ReportRow {
  key: string;
  label: string;
  total: number;
  action_required: number;
  action_taken: number;
  irrelevant: number;
  avgResolutionHours: number | null;
}

export interface ReportTableProps {
  rows: ReportRow[];
  loading: boolean;
  groupByLabel: string;
}

const formatHours = (h: number | null): string => {
  if (h === null || !Number.isFinite(h)) return "-";
  if (h < 1) return `${Math.max(0, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
};

export function ReportTable({ rows, loading, groupByLabel }: ReportTableProps) {
  const totals = useMemo(() => {
    const out = {
      total: 0,
      action_required: 0,
      action_taken: 0,
      irrelevant: 0,
      hoursSum: 0,
      hoursCount: 0,
    };
    for (const r of rows) {
      out.total += r.total;
      out.action_required += r.action_required;
      out.action_taken += r.action_taken;
      out.irrelevant += r.irrelevant;
      if (r.avgResolutionHours !== null) {
        // weight by resolved count for a proper aggregate
        out.hoursSum += r.avgResolutionHours * r.action_taken;
        out.hoursCount += r.action_taken;
      }
    }
    return out;
  }, [rows]);

  const avgTotal = totals.hoursCount > 0 ? totals.hoursSum / totals.hoursCount : null;

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No data to report"
        description="Adjust your filters or try a different grouping."
      />
    );
  }

  const numCell = "text-right tabular-nums";

  return (
    <ScrollableTable>
      <Table>
        <THead>
          <TR>
            <TH>{groupByLabel}</TH>
            <TH className={cn(numCell, "text-right")}>Total</TH>
            <TH className={cn(numCell, "text-right")}>Action Required</TH>
            <TH className={cn(numCell, "text-right")}>Resolved</TH>
            <TH className={cn(numCell, "text-right")}>Rejected</TH>
            <TH className={cn(numCell, "text-right")}>Avg Resolution</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.key}>
              <TD className="font-medium text-slate-900 dark:text-slate-100">
                {r.label}
              </TD>
              <TD className={numCell}>{r.total}</TD>
              <TD className={numCell}>{r.action_required}</TD>
              <TD className={numCell}>{r.action_taken}</TD>
              <TD className={numCell}>{r.irrelevant}</TD>
              <TD className={numCell}>{formatHours(r.avgResolutionHours)}</TD>
            </TR>
          ))}
          <TR className="bg-slate-50 font-semibold hover:bg-slate-50 dark:bg-slate-900/80 dark:hover:bg-slate-900/80">
            <TD className="text-slate-900 dark:text-slate-100">Total</TD>
            <TD className={numCell}>{totals.total}</TD>
            <TD className={numCell}>{totals.action_required}</TD>
            <TD className={numCell}>{totals.action_taken}</TD>
            <TD className={numCell}>{totals.irrelevant}</TD>
            <TD className={numCell}>{formatHours(avgTotal)}</TD>
          </TR>
        </TBody>
      </Table>
    </ScrollableTable>
  );
}

export default ReportTable;
