"use client";

import { useEffect, useRef, useState } from "react";
import {
  Edit2,
  MoreHorizontal,
  PowerOff,
  Power,
  Trash2,
  UserCog,
} from "lucide-react";
import {
  ScrollableTable,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTimeAgo } from "@/lib/formatters";
import { DEPARTMENTS } from "@/constants/departments";
import type { WasaEmployee } from "@/types";
import { cn } from "@/lib/cn";

export interface EmployeesTableProps {
  employees: WasaEmployee[];
  loading: boolean;
  onEdit: (e: WasaEmployee) => void;
  onToggleActive: (e: WasaEmployee) => void;
  onDelete: (e: WasaEmployee) => void;
}

const DEPARTMENT_LABEL: Record<string, string> = DEPARTMENTS.reduce(
  (acc, d) => {
    acc[d.value] = d.label;
    return acc;
  },
  {} as Record<string, string>,
);

/** Workload colour: green <5, amber 5–9, red 10+. */
const workloadBadgeClass = (n: number): string => {
  if (n >= 10)
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  if (n >= 5)
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
};

interface RowActionsProps {
  employee: WasaEmployee;
  onEdit: (e: WasaEmployee) => void;
  onToggleActive: (e: WasaEmployee) => void;
  onDelete: (e: WasaEmployee) => void;
}

function RowActions({
  employee,
  onEdit,
  onToggleActive,
  onDelete,
}: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit(employee);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Edit2 className="h-4 w-4" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onToggleActive(employee);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {employee.active ? (
              <>
                <PowerOff className="h-4 w-4" aria-hidden />
                Deactivate
              </>
            ) : (
              <>
                <Power className="h-4 w-4" aria-hidden />
                Activate
              </>
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete(employee);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function EmployeesTable({
  employees,
  loading,
  onEdit,
  onToggleActive,
  onDelete,
}: EmployeesTableProps) {
  if (loading) {
    return (
      <ScrollableTable>
        <div className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4">
              <Skeleton height={20} />
            </div>
          ))}
        </div>
      </ScrollableTable>
    );
  }

  if (!employees.length) {
    return (
      <ScrollableTable>
        <EmptyState
          icon={UserCog}
          title="No employees found"
          description="Try adjusting filters or add a new employee."
        />
      </ScrollableTable>
    );
  }

  return (
    <ScrollableTable>
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Designation</TH>
            <TH>Department</TH>
            <TH>Email</TH>
            <TH>Phone</TH>
            <TH>District / Tehsil</TH>
            <TH className="text-right">Active</TH>
            <TH className="text-right">Resolved</TH>
            <TH>Status</TH>
            <TH>Last Login</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {employees.map((emp) => {
            const workload = emp.currentAssignments ?? 0;
            return (
              <TR key={emp.id}>
                <TD className="font-medium text-slate-900 dark:text-slate-100">
                  {emp.name || "-"}
                </TD>
                <TD>{emp.designation || "-"}</TD>
                <TD>{DEPARTMENT_LABEL[emp.department] ?? emp.department ?? "-"}</TD>
                <TD className="max-w-[220px] truncate" title={emp.email}>
                  {emp.email || "-"}
                </TD>
                <TD>{emp.phone || "-"}</TD>
                <TD>
                  <div className="flex flex-col leading-tight">
                    <span className="text-slate-900 dark:text-slate-100">
                      {emp.district || "-"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {emp.tehsil || "-"}
                    </span>
                  </div>
                </TD>
                <TD className="text-right">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-medium",
                      workloadBadgeClass(workload),
                    )}
                  >
                    {workload}
                  </span>
                </TD>
                <TD className="text-right tabular-nums">
                  {emp.totalResolved ?? 0}
                </TD>
                <TD>
                  {emp.active ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="default">Inactive</Badge>
                  )}
                </TD>
                <TD className="text-xs text-slate-500 dark:text-slate-400">
                  {emp.lastLogin ? formatTimeAgo(emp.lastLogin) : "Never"}
                </TD>
                <TD className="text-right">
                  <RowActions
                    employee={emp}
                    onEdit={onEdit}
                    onToggleActive={onToggleActive}
                    onDelete={onDelete}
                  />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </ScrollableTable>
  );
}

export default EmployeesTable;
