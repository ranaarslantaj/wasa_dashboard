"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { rankEmployees, workloadBadgeClass } from "@/lib/smartAssignment";
import type { Complaint, WasaEmployee } from "@/types";

export interface AssignEmployeePickerProps {
  complaint: Complaint;
  employees: WasaEmployee[];
  loading: boolean;
  onAssign: (employeeId: string, notes: string) => Promise<void>;
  onCancel: () => void;
  /** Visual label for the primary button (e.g. "Reassign" instead of "Assign"). */
  submitLabel?: string;
}

export function AssignEmployeePicker({
  complaint,
  employees,
  loading,
  onAssign,
  onCancel,
  submitLabel = "Assign",
}: AssignEmployeePickerProps) {
  const [search, setSearch] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const ranked = useMemo(
    () => rankEmployees(employees, complaint),
    [employees, complaint]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return ranked;
    return ranked.filter((e) => {
      const hay = [e.name, e.designation, e.phone, e.department]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [ranked, search]);

  const handleSubmit = async (): Promise<void> => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    try {
      await onAssign(selectedId, notes.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, designation, or phone"
          className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
        {loading ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No matching employees"
            description="Try a different search or broaden your scope."
          />
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((e) => {
              const selected =
                selectedId !== "" && (selectedId === e.uid || selectedId === e.id);
              const workload = e.currentAssignments ?? 0;
              return (
                <li key={e.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                      selected && "bg-brand-50/60 dark:bg-brand-900/20"
                    )}
                  >
                    <input
                      type="radio"
                      name="assign-employee"
                      className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500"
                      checked={selected}
                      onChange={() => setSelectedId(e.uid || e.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {e.name}
                        </span>
                        {e.designation && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            · {e.designation}
                          </span>
                        )}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                            workloadBadgeClass(workload)
                          )}
                        >
                          {workload} active
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {e.department?.replace(/_/g, " ")}
                        {e.district ? ` · ${e.district}` : ""}
                        {e.tehsil ? ` · ${e.tehsil}` : ""}
                      </div>
                      {Array.isArray(e.specialization) && e.specialization.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {e.specialization.slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {s.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                      {e.reason.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {e.reason.map((r) => (
                            <span
                              key={r}
                              className="inline-flex items-center rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
          Assignment notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add optional instructions for the assignee"
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!selectedId}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export default AssignEmployeePicker;
