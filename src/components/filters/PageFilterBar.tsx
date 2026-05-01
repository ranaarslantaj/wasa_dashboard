"use client";

import { useMemo } from "react";
import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { useFilters } from "@/context/FilterContext";
import { COMPLAINT_STATUSES } from "@/constants/statuses";
import { WASA_CATEGORIES } from "@/constants/wasaCategories";
import { cn } from "@/lib/cn";

export interface PageFilterBarProps {
  /** Optional override class on the wrapping <Card> */
  className?: string;
  /** Hide individual filter slots when not needed by the host page. */
  show?: {
    district?: boolean;
    tehsil?: boolean;
    wasaCategory?: boolean;
    status?: boolean;
    routing?: boolean;
    search?: boolean;
  };
}

const ROUTING_OPTIONS = [
  { value: "", label: "All routings" },
  { value: "DEPT_DASHBOARD", label: "Dept Queue" },
  { value: "UC_MC_AUTO", label: "UC/MC Auto" },
];

/**
 * Scope-aware shared filter bar driven by FilterContext. Drop it on any page
 * that consumes `useActiveFilters()` and the changes propagate everywhere.
 */
export function PageFilterBar({ className, show }: PageFilterBarProps) {
  const f = useFilters();

  const showDistrict = show?.district !== false;
  const showTehsil = show?.tehsil !== false;
  const showWasaCategory = show?.wasaCategory !== false;
  const showStatus = show?.status !== false;
  const showRouting = show?.routing !== false;
  const showSearch = show?.search !== false;

  const districtOptions = useMemo(
    () => [
      { value: "", label: "All districts" },
      ...f.availableDistricts.map((d) => ({ value: d, label: d })),
    ],
    [f.availableDistricts],
  );

  const tehsilOptions = useMemo(
    () => [
      { value: "", label: "All tehsils" },
      ...f.availableTehsils.map((t) => ({ value: t, label: t })),
    ],
    [f.availableTehsils],
  );

  const wasaOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...WASA_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
    ],
    [],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: "All statuses" },
      ...COMPLAINT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    ],
    [],
  );

  const hasActive =
    f.selectedDistrict ||
    f.selectedTehsil ||
    f.selectedWasaCategory ||
    f.selectedStatus ||
    f.selectedRouting ||
    f.search ||
    f.selectedAssignee ||
    f.dateRange.from ||
    f.dateRange.to;

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
          )}
        >
          {showDistrict && (
            <FilterSlot label="District">
              <Dropdown
                value={f.selectedDistrict}
                onChange={f.setSelectedDistrict}
                options={districtOptions}
                locked={f.districtLocked}
              />
            </FilterSlot>
          )}
          {showTehsil && (
            <FilterSlot label="Tehsil">
              <Dropdown
                value={f.selectedTehsil}
                onChange={f.setSelectedTehsil}
                options={tehsilOptions}
                locked={f.tehsilLocked}
              />
            </FilterSlot>
          )}
          {showWasaCategory && (
            <FilterSlot label="Category">
              <Dropdown
                value={f.selectedWasaCategory}
                onChange={f.setSelectedWasaCategory}
                options={wasaOptions}
              />
            </FilterSlot>
          )}
          {showStatus && (
            <FilterSlot label="Status">
              <Dropdown
                value={f.selectedStatus}
                onChange={f.setSelectedStatus}
                options={statusOptions}
              />
            </FilterSlot>
          )}
          {showRouting && (
            <FilterSlot label="Routing">
              <Dropdown
                value={f.selectedRouting}
                onChange={(v) =>
                  f.setSelectedRouting(v as "" | "DEPT_DASHBOARD" | "UC_MC_AUTO")
                }
                options={ROUTING_OPTIONS}
              />
            </FilterSlot>
          )}
          {showSearch && (
            <FilterSlot label="Search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="text"
                  value={f.search}
                  onChange={(e) => f.setSearch(e.target.value)}
                  placeholder="ID, name, phone, address"
                  className="block w-full rounded-lg border-slate-300 bg-white pl-8 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </FilterSlot>
          )}
        </div>

        {hasActive && (
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={f.resetFilters}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Reset filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FilterSlot({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

export default PageFilterBar;
