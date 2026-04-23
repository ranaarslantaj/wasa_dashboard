"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  PROVINCES,
  getDivisionsForProvince,
  getDistrictsForDivision,
  getTehsilsForDistrict,
  getAllDistrictsForProvince,
} from "@/constants/geography";
import {
  getScopeDistricts,
  isDistrictLocked,
  isTehsilLocked,
  isDivisionLocked,
} from "@/lib/scope";
import type { AdminScope } from "@/types";

/* -------------------------------------------------------------------------- */
/*                               Public types                                 */
/* -------------------------------------------------------------------------- */

export interface FilterContextValue {
  // Raw filter state
  selectedProvince: string;
  selectedDivision: string;
  selectedDistrict: string;
  selectedTehsil: string;
  selectedUC: string;
  selectedComplaintType: string;
  selectedStatus: string;
  selectedPriority: string;
  selectedAssignee: string;
  dateRange: { from: Date | null; to: Date | null };
  search: string;

  // Setters
  setSelectedProvince: (v: string) => void;
  setSelectedDivision: (v: string) => void;
  setSelectedDistrict: (v: string) => void;
  setSelectedTehsil: (v: string) => void;
  setSelectedUC: (v: string) => void;
  setSelectedComplaintType: (v: string) => void;
  setSelectedStatus: (v: string) => void;
  setSelectedPriority: (v: string) => void;
  setSelectedAssignee: (v: string) => void;
  setDateRange: (v: { from: Date | null; to: Date | null }) => void;
  setSearch: (v: string) => void;
  resetFilters: () => void;

  // Derived / scope-aware lookups
  availableProvinces: string[];
  availableDivisions: string[];
  availableDistricts: string[];
  availableTehsils: string[];
  scopeDistricts: string[];

  // Lock flags
  provinceLocked: boolean;
  divisionLocked: boolean;
  districtLocked: boolean;
  tehsilLocked: boolean;
}

export interface ActiveFiltersSnapshot {
  province: string;
  division: string;
  district: string;
  tehsil: string;
  uc: string;
  complaintType: string;
  status: string;
  priority: string;
  assignee: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  search: string;
  scopeDistricts: string[];
}

/* -------------------------------------------------------------------------- */
/*                              Session persistence                           */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "wasa_filters";

interface PersistedShape {
  selectedComplaintType: string;
  selectedStatus: string;
  selectedPriority: string;
  selectedAssignee: string;
  selectedUC: string;
  dateFrom: string | null;
  dateTo: string | null;
  search: string;
  // Non-locked geography only; locked fields are re-applied from the scope on mount.
  selectedProvince: string | null;
  selectedDivision: string | null;
  selectedDistrict: string | null;
  selectedTehsil: string | null;
}

const DEFAULT_PROVINCE = "Punjab";

const isBrowser = (): boolean => typeof window !== "undefined";

const parseDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const readPersisted = (): PersistedShape | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedShape> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      selectedComplaintType: (parsed.selectedComplaintType as string) ?? "",
      selectedStatus: (parsed.selectedStatus as string) ?? "",
      selectedPriority: (parsed.selectedPriority as string) ?? "",
      selectedAssignee: (parsed.selectedAssignee as string) ?? "",
      selectedUC: (parsed.selectedUC as string) ?? "",
      dateFrom: (parsed.dateFrom as string | null) ?? null,
      dateTo: (parsed.dateTo as string | null) ?? null,
      search: (parsed.search as string) ?? "",
      selectedProvince: (parsed.selectedProvince as string | null) ?? null,
      selectedDivision: (parsed.selectedDivision as string | null) ?? null,
      selectedDistrict: (parsed.selectedDistrict as string | null) ?? null,
      selectedTehsil: (parsed.selectedTehsil as string | null) ?? null,
    };
  } catch {
    return null;
  }
};

const writePersisted = (payload: PersistedShape): void => {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / privacy-mode errors
  }
};

/* -------------------------------------------------------------------------- */
/*                                  Context                                   */
/* -------------------------------------------------------------------------- */

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

/**
 * Resolves the initial geography state from the admin scope.
 *
 * CRITICAL: Locked scope fields come directly from the scope; persisted values
 * for locked fields are ignored so we can never re-hydrate a wider scope than
 * the user is entitled to see. This is part of the division-level fix
 * (see spec §4 and §8).
 */
const resolveInitialGeography = (
  scope: AdminScope | null,
  persisted: PersistedShape | null,
): {
  province: string;
  division: string;
  district: string;
  tehsil: string;
} => {
  // No scope yet — fall back to persisted or defaults.
  if (!scope) {
    return {
      province: persisted?.selectedProvince ?? DEFAULT_PROVINCE,
      division: persisted?.selectedDivision ?? "",
      district: persisted?.selectedDistrict ?? "",
      tehsil: persisted?.selectedTehsil ?? "",
    };
  }

  // Full access: everything unlocked, default to Punjab unless user previously picked something.
  if (scope.fullAccess) {
    return {
      province: persisted?.selectedProvince ?? DEFAULT_PROVINCE,
      division: persisted?.selectedDivision ?? "",
      district: persisted?.selectedDistrict ?? "",
      tehsil: persisted?.selectedTehsil ?? "",
    };
  }

  const scopeProvince = scope.province || DEFAULT_PROVINCE;

  switch (scope.accessLevel) {
    case "province":
      // Province locked to scope; division/district/tehsil free-but-constrained.
      return {
        province: scopeProvince,
        division: persisted?.selectedDivision ?? "",
        district: persisted?.selectedDistrict ?? "",
        tehsil: persisted?.selectedTehsil ?? "",
      };
    case "division":
      // Province + Division are locked — always sourced from scope, never persisted.
      return {
        province: scopeProvince,
        division: scope.division ?? "",
        district: persisted?.selectedDistrict ?? "",
        tehsil: persisted?.selectedTehsil ?? "",
      };
    case "district":
      return {
        province: scopeProvince,
        division: scope.division ?? "",
        district: scope.district ?? "",
        tehsil: persisted?.selectedTehsil ?? "",
      };
    case "tehsil":
      return {
        province: scopeProvince,
        division: scope.division ?? "",
        district: scope.district ?? "",
        tehsil: scope.tehsil ?? "",
      };
    default:
      return {
        province: scopeProvince,
        division: "",
        district: "",
        tehsil: "",
      };
  }
};

/* -------------------------------------------------------------------------- */
/*                                 Provider                                   */
/* -------------------------------------------------------------------------- */

export const FilterProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { adminScope } = useAuth();

  // Read persisted state once on mount.
  const persistedRef = useRef<PersistedShape | null>(
    isBrowser() ? readPersisted() : null,
  );

  // --- Geography state (initialized from scope + persistence) ----------------
  const initialGeo = useMemo(
    () => resolveInitialGeography(adminScope, persistedRef.current),
    // resolved once on first render; adminScope sync handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [selectedProvince, setSelectedProvinceState] = useState<string>(
    initialGeo.province,
  );
  const [selectedDivision, setSelectedDivisionState] = useState<string>(
    initialGeo.division,
  );
  const [selectedDistrict, setSelectedDistrictState] = useState<string>(
    initialGeo.district,
  );
  const [selectedTehsil, setSelectedTehsilState] = useState<string>(
    initialGeo.tehsil,
  );

  // --- Non-geographic filter state ------------------------------------------
  const [selectedUC, setSelectedUC] = useState<string>(
    persistedRef.current?.selectedUC ?? "",
  );
  const [selectedComplaintType, setSelectedComplaintType] = useState<string>(
    persistedRef.current?.selectedComplaintType ?? "",
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(
    persistedRef.current?.selectedStatus ?? "",
  );
  const [selectedPriority, setSelectedPriority] = useState<string>(
    persistedRef.current?.selectedPriority ?? "",
  );
  const [selectedAssignee, setSelectedAssignee] = useState<string>(
    persistedRef.current?.selectedAssignee ?? "",
  );
  const [dateRange, setDateRange] = useState<{
    from: Date | null;
    to: Date | null;
  }>(() => ({
    from: parseDate(persistedRef.current?.dateFrom ?? null),
    to: parseDate(persistedRef.current?.dateTo ?? null),
  }));
  const [search, setSearch] = useState<string>(
    persistedRef.current?.search ?? "",
  );

  /* -------------------------------------------------------------------- */
  /*                       Scope sync (null -> value)                     */
  /* -------------------------------------------------------------------- */
  // When the admin scope transitions from null to a value (login) or changes,
  // re-apply locked fields from scope. We deliberately overwrite any persisted
  // locked field so a previously-wider selection can never leak through.
  const prevScopeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const scopeKey = adminScope
      ? [
          adminScope.accessLevel,
          adminScope.province,
          adminScope.division ?? "",
          adminScope.district ?? "",
          adminScope.tehsil ?? "",
          adminScope.fullAccess ? "1" : "0",
        ].join("|")
      : null;

    if (scopeKey === prevScopeKeyRef.current) return;
    prevScopeKeyRef.current = scopeKey;

    if (!adminScope) return;

    const geo = resolveInitialGeography(adminScope, persistedRef.current);

    if (adminScope.fullAccess) {
      // Full access — nothing is locked, but still align province default.
      setSelectedProvinceState((prev) => prev || geo.province);
      return;
    }

    // Always overwrite locked fields with scope-derived values.
    setSelectedProvinceState(geo.province);

    if (
      adminScope.accessLevel === "division" ||
      adminScope.accessLevel === "district" ||
      adminScope.accessLevel === "tehsil"
    ) {
      setSelectedDivisionState(geo.division);
    }
    if (
      adminScope.accessLevel === "district" ||
      adminScope.accessLevel === "tehsil"
    ) {
      setSelectedDistrictState(geo.district);
    }
    if (adminScope.accessLevel === "tehsil") {
      setSelectedTehsilState(geo.tehsil);
    }
  }, [adminScope]);

  /* -------------------------------------------------------------------- */
  /*                            Derived lookups                           */
  /* -------------------------------------------------------------------- */

  const provinceLocked = useMemo<boolean>(() => {
    if (!adminScope) return false;
    if (adminScope.fullAccess) return false;
    // All non-full-access admins are locked to their province.
    return true;
  }, [adminScope]);

  const divisionLocked = useMemo<boolean>(
    () => isDivisionLocked(adminScope),
    [adminScope],
  );

  const districtLocked = useMemo<boolean>(
    () => isDistrictLocked(adminScope),
    [adminScope],
  );

  const tehsilLocked = useMemo<boolean>(
    () => isTehsilLocked(adminScope),
    [adminScope],
  );

  const availableProvinces = useMemo<string[]>(() => {
    if (!adminScope || adminScope.fullAccess) return [...PROVINCES];
    if (adminScope.accessLevel === "province") {
      return [adminScope.province || DEFAULT_PROVINCE];
    }
    // Division / district / tehsil admins are locked to a single province.
    return [adminScope.province || DEFAULT_PROVINCE];
  }, [adminScope]);

  const availableDivisions = useMemo<string[]>(() => {
    if (!adminScope || adminScope.fullAccess) {
      return getDivisionsForProvince(selectedProvince || DEFAULT_PROVINCE);
    }
    if (adminScope.accessLevel === "province") {
      return getDivisionsForProvince(
        selectedProvince || adminScope.province || DEFAULT_PROVINCE,
      );
    }
    // division / district / tehsil — locked to the scope's division.
    return adminScope.division ? [adminScope.division] : [];
  }, [adminScope, selectedProvince]);

  /**
   * CRITICAL (division-level fix, spec §4 / §8):
   *
   * Division-level admins MUST only see districts inside their scope division
   * (`getDistrictsForDivision(scope.division)`) — NEVER the raw DISTRICTS list
   * or all-districts-for-province. Regressing this is a privilege-escalation
   * bug; every district dropdown in the app pulls from this array.
   */
  const availableDistricts = useMemo<string[]>(() => {
    // Full access: use the selected division if present, else all districts in province.
    if (!adminScope || adminScope.fullAccess) {
      if (selectedDivision) return getDistrictsForDivision(selectedDivision);
      return getAllDistrictsForProvince(selectedProvince || DEFAULT_PROVINCE);
    }

    // Province admin: same shape as full-access, constrained to scope.province.
    if (adminScope.accessLevel === "province") {
      const province = adminScope.province || DEFAULT_PROVINCE;
      if (selectedDivision) return getDistrictsForDivision(selectedDivision);
      return getAllDistrictsForProvince(province);
    }

    // Division admin: ONLY districts in the scope's division.
    // Do NOT fall back to all-districts-for-province or raw DISTRICTS here.
    if (adminScope.accessLevel === "division") {
      return getDistrictsForDivision(adminScope.division ?? "");
    }

    // District / tehsil: single-district scope.
    return adminScope.district ? [adminScope.district] : [];
  }, [adminScope, selectedProvince, selectedDivision]);

  const availableTehsils = useMemo<string[]>(() => {
    // Tehsil admin is pinned to their single tehsil regardless of selection.
    if (adminScope && !adminScope.fullAccess && adminScope.accessLevel === "tehsil") {
      return adminScope.tehsil ? [adminScope.tehsil] : [];
    }

    // If the user narrowed to a specific district, show only that district's tehsils.
    if (selectedDistrict) {
      return getTehsilsForDistrict(selectedDistrict);
    }

    // Otherwise, union of tehsils across all districts they're allowed to see.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of availableDistricts) {
      for (const t of getTehsilsForDistrict(d)) {
        if (!seen.has(t)) {
          seen.add(t);
          out.push(t);
        }
      }
    }
    return out;
  }, [adminScope, selectedDistrict, availableDistricts]);

  // scopeDistricts is consumed verbatim by hooks for Firestore `where('district','in', ...)`.
  const scopeDistricts = useMemo<string[]>(
    () => getScopeDistricts(adminScope),
    [adminScope],
  );

  /* -------------------------------------------------------------------- */
  /*                    Cascading setters & auto-clearing                 */
  /* -------------------------------------------------------------------- */

  const setSelectedProvince = useCallback(
    (v: string) => {
      if (provinceLocked) return;
      setSelectedProvinceState(v);
      // Province change invalidates downstream selections.
      setSelectedDivisionState("");
      setSelectedDistrictState("");
      setSelectedTehsilState("");
      setSelectedUC("");
    },
    [provinceLocked],
  );

  const setSelectedDivision = useCallback(
    (v: string) => {
      if (divisionLocked) return;
      setSelectedDivisionState(v);
      // Changing the division clears district and tehsil (and UC).
      setSelectedDistrictState("");
      setSelectedTehsilState("");
      setSelectedUC("");
    },
    [divisionLocked],
  );

  const setSelectedDistrict = useCallback(
    (v: string) => {
      if (districtLocked) return;
      setSelectedDistrictState(v);
      // Changing the district clears tehsil and UC.
      setSelectedTehsilState("");
      setSelectedUC("");
    },
    [districtLocked],
  );

  const setSelectedTehsil = useCallback(
    (v: string) => {
      if (tehsilLocked) return;
      setSelectedTehsilState(v);
      // Changing the tehsil clears UC.
      setSelectedUC("");
    },
    [tehsilLocked],
  );

  // Auto-clear invalid district when scope/division changes and current
  // selection is no longer in availableDistricts. Locked districts are exempt.
  useEffect(() => {
    if (districtLocked) return;
    if (!selectedDistrict) return;
    if (!availableDistricts.includes(selectedDistrict)) {
      setSelectedDistrictState("");
      setSelectedTehsilState("");
      setSelectedUC("");
    }
  }, [availableDistricts, selectedDistrict, districtLocked]);

  // Auto-clear invalid tehsil when scope/district changes.
  useEffect(() => {
    if (tehsilLocked) return;
    if (!selectedTehsil) return;
    if (!availableTehsils.includes(selectedTehsil)) {
      setSelectedTehsilState("");
      setSelectedUC("");
    }
  }, [availableTehsils, selectedTehsil, tehsilLocked]);

  // Auto-clear invalid division when scope/province changes.
  useEffect(() => {
    if (divisionLocked) return;
    if (!selectedDivision) return;
    if (availableDivisions.length > 0 && !availableDivisions.includes(selectedDivision)) {
      setSelectedDivisionState("");
      setSelectedDistrictState("");
      setSelectedTehsilState("");
      setSelectedUC("");
    }
  }, [availableDivisions, selectedDivision, divisionLocked]);

  // Auto-clear invalid province when scope changes.
  useEffect(() => {
    if (provinceLocked) return;
    if (!selectedProvince) return;
    if (availableProvinces.length > 0 && !availableProvinces.includes(selectedProvince)) {
      setSelectedProvinceState(availableProvinces[0] ?? DEFAULT_PROVINCE);
      setSelectedDivisionState("");
      setSelectedDistrictState("");
      setSelectedTehsilState("");
      setSelectedUC("");
    }
  }, [availableProvinces, selectedProvince, provinceLocked]);

  /* -------------------------------------------------------------------- */
  /*                              resetFilters                            */
  /* -------------------------------------------------------------------- */

  const resetFilters = useCallback(() => {
    // Clear all non-geographic filters.
    setSelectedComplaintType("");
    setSelectedStatus("");
    setSelectedPriority("");
    setSelectedAssignee("");
    setSelectedUC("");
    setDateRange({ from: null, to: null });
    setSearch("");

    // Reset geography to scope-derived baseline; locked fields stay pinned.
    const scope = adminScope;

    if (!scope || scope.fullAccess) {
      setSelectedProvinceState(DEFAULT_PROVINCE);
      setSelectedDivisionState("");
      setSelectedDistrictState("");
      setSelectedTehsilState("");
      return;
    }

    const province = scope.province || DEFAULT_PROVINCE;
    setSelectedProvinceState(province);

    switch (scope.accessLevel) {
      case "province":
        setSelectedDivisionState("");
        setSelectedDistrictState("");
        setSelectedTehsilState("");
        break;
      case "division":
        setSelectedDivisionState(scope.division ?? "");
        setSelectedDistrictState("");
        setSelectedTehsilState("");
        break;
      case "district":
        setSelectedDivisionState(scope.division ?? "");
        setSelectedDistrictState(scope.district ?? "");
        setSelectedTehsilState("");
        break;
      case "tehsil":
        setSelectedDivisionState(scope.division ?? "");
        setSelectedDistrictState(scope.district ?? "");
        setSelectedTehsilState(scope.tehsil ?? "");
        break;
      default:
        break;
    }
  }, [adminScope]);

  /* -------------------------------------------------------------------- */
  /*                         Persist to sessionStorage                    */
  /* -------------------------------------------------------------------- */
  useEffect(() => {
    // Persist unlocked fields + non-geo filters. Locked fields are re-sourced
    // from scope on next mount to guard against cross-login leakage.
    const payload: PersistedShape = {
      selectedComplaintType,
      selectedStatus,
      selectedPriority,
      selectedAssignee,
      selectedUC,
      dateFrom: dateRange.from ? dateRange.from.toISOString() : null,
      dateTo: dateRange.to ? dateRange.to.toISOString() : null,
      search,
      selectedProvince: provinceLocked ? null : selectedProvince,
      selectedDivision: divisionLocked ? null : selectedDivision,
      selectedDistrict: districtLocked ? null : selectedDistrict,
      selectedTehsil: tehsilLocked ? null : selectedTehsil,
    };
    writePersisted(payload);
  }, [
    selectedComplaintType,
    selectedStatus,
    selectedPriority,
    selectedAssignee,
    selectedUC,
    dateRange,
    search,
    selectedProvince,
    selectedDivision,
    selectedDistrict,
    selectedTehsil,
    provinceLocked,
    divisionLocked,
    districtLocked,
    tehsilLocked,
  ]);

  /* -------------------------------------------------------------------- */
  /*                               Context value                          */
  /* -------------------------------------------------------------------- */

  const value = useMemo<FilterContextValue>(
    () => ({
      selectedProvince,
      selectedDivision,
      selectedDistrict,
      selectedTehsil,
      selectedUC,
      selectedComplaintType,
      selectedStatus,
      selectedPriority,
      selectedAssignee,
      dateRange,
      search,

      setSelectedProvince,
      setSelectedDivision,
      setSelectedDistrict,
      setSelectedTehsil,
      setSelectedUC,
      setSelectedComplaintType,
      setSelectedStatus,
      setSelectedPriority,
      setSelectedAssignee,
      setDateRange,
      setSearch,
      resetFilters,

      availableProvinces,
      availableDivisions,
      availableDistricts,
      availableTehsils,
      scopeDistricts,

      provinceLocked,
      divisionLocked,
      districtLocked,
      tehsilLocked,
    }),
    [
      selectedProvince,
      selectedDivision,
      selectedDistrict,
      selectedTehsil,
      selectedUC,
      selectedComplaintType,
      selectedStatus,
      selectedPriority,
      selectedAssignee,
      dateRange,
      search,
      setSelectedProvince,
      setSelectedDivision,
      setSelectedDistrict,
      setSelectedTehsil,
      resetFilters,
      availableProvinces,
      availableDivisions,
      availableDistricts,
      availableTehsils,
      scopeDistricts,
      provinceLocked,
      divisionLocked,
      districtLocked,
      tehsilLocked,
    ],
  );

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
};

/* -------------------------------------------------------------------------- */
/*                                   Hooks                                    */
/* -------------------------------------------------------------------------- */

export const useFilters = (): FilterContextValue => {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return ctx;
};

/**
 * Convenience hook returning a flat snapshot of the currently active filters
 * plus `scopeDistricts` — suitable for passing straight into a Firestore hook.
 */
export const useActiveFilters = (): ActiveFiltersSnapshot => {
  const f = useFilters();
  return useMemo<ActiveFiltersSnapshot>(
    () => ({
      province: f.selectedProvince,
      division: f.selectedDivision,
      district: f.selectedDistrict,
      tehsil: f.selectedTehsil,
      uc: f.selectedUC,
      complaintType: f.selectedComplaintType,
      status: f.selectedStatus,
      priority: f.selectedPriority,
      assignee: f.selectedAssignee,
      dateFrom: f.dateRange.from,
      dateTo: f.dateRange.to,
      search: f.search,
      scopeDistricts: f.scopeDistricts,
    }),
    [
      f.selectedProvince,
      f.selectedDivision,
      f.selectedDistrict,
      f.selectedTehsil,
      f.selectedUC,
      f.selectedComplaintType,
      f.selectedStatus,
      f.selectedPriority,
      f.selectedAssignee,
      f.dateRange.from,
      f.dateRange.to,
      f.search,
      f.scopeDistricts,
    ],
  );
};
