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
import type { AdminScope, RoutingStrategy } from "@/types";

/* -------------------------------------------------------------------------- */
/*                               Public types                                 */
/* -------------------------------------------------------------------------- */

export interface FilterContextValue {
  // Raw filter state
  selectedProvince: string;
  selectedDivision: string;
  selectedDistrict: string;
  /** Tehsil from the admin's scope vocabulary; mapped to `tahsil` when querying complaints. */
  selectedTehsil: string;
  selectedUC: string;
  /** WASA sub-category (no_water | sewerage_blockage | manhole_cover | …). */
  selectedWasaCategory: string;
  /** complaintStatus value (action_required | action_taken | irrelevant). */
  selectedStatus: string;
  /** routingStrategy filter. '' = both, 'DEPT_DASHBOARD', or 'UC_MC_AUTO'. */
  selectedRouting: "" | RoutingStrategy;
  selectedAssignee: string;
  dateRange: { from: Date | null; to: Date | null };
  search: string;

  // Setters
  setSelectedProvince: (v: string) => void;
  setSelectedDivision: (v: string) => void;
  setSelectedDistrict: (v: string) => void;
  setSelectedTehsil: (v: string) => void;
  setSelectedUC: (v: string) => void;
  setSelectedWasaCategory: (v: string) => void;
  setSelectedStatus: (v: string) => void;
  setSelectedRouting: (v: "" | RoutingStrategy) => void;
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
  wasaCategory: string;
  status: string;
  routing: "" | RoutingStrategy;
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
  selectedWasaCategory: string;
  selectedStatus: string;
  selectedRouting: "" | RoutingStrategy;
  selectedAssignee: string;
  selectedUC: string;
  dateFrom: string | null;
  dateTo: string | null;
  search: string;
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
      selectedWasaCategory: (parsed.selectedWasaCategory as string) ?? "",
      selectedStatus: (parsed.selectedStatus as string) ?? "",
      selectedRouting: (parsed.selectedRouting as "" | RoutingStrategy) ?? "",
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
    /* ignore */
  }
};

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

const resolveInitialGeography = (
  scope: AdminScope | null,
  persisted: PersistedShape | null,
): {
  province: string;
  division: string;
  district: string;
  tehsil: string;
} => {
  if (!scope) {
    return {
      province: persisted?.selectedProvince ?? DEFAULT_PROVINCE,
      division: persisted?.selectedDivision ?? "",
      district: persisted?.selectedDistrict ?? "",
      tehsil: persisted?.selectedTehsil ?? "",
    };
  }
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
      return {
        province: scopeProvince,
        division: persisted?.selectedDivision ?? "",
        district: persisted?.selectedDistrict ?? "",
        tehsil: persisted?.selectedTehsil ?? "",
      };
    case "division":
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
      return { province: scopeProvince, division: "", district: "", tehsil: "" };
  }
};

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { adminScope } = useAuth();
  const persistedRef = useRef<PersistedShape | null>(isBrowser() ? readPersisted() : null);

  const initialGeo = useMemo(
    () => resolveInitialGeography(adminScope, persistedRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [selectedProvince, setSelectedProvinceState] = useState<string>(initialGeo.province);
  const [selectedDivision, setSelectedDivisionState] = useState<string>(initialGeo.division);
  const [selectedDistrict, setSelectedDistrictState] = useState<string>(initialGeo.district);
  const [selectedTehsil, setSelectedTehsilState] = useState<string>(initialGeo.tehsil);

  const [selectedUC, setSelectedUC] = useState<string>(persistedRef.current?.selectedUC ?? "");
  const [selectedWasaCategory, setSelectedWasaCategory] = useState<string>(
    persistedRef.current?.selectedWasaCategory ?? "",
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(
    persistedRef.current?.selectedStatus ?? "",
  );
  const [selectedRouting, setSelectedRouting] = useState<"" | RoutingStrategy>(
    persistedRef.current?.selectedRouting ?? "",
  );
  const [selectedAssignee, setSelectedAssignee] = useState<string>(
    persistedRef.current?.selectedAssignee ?? "",
  );
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>(() => ({
    from: parseDate(persistedRef.current?.dateFrom ?? null),
    to: parseDate(persistedRef.current?.dateTo ?? null),
  }));
  const [search, setSearch] = useState<string>(persistedRef.current?.search ?? "");

  /* Scope sync (null -> value or scope change) ------------------------------ */
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
      setSelectedProvinceState((prev) => prev || geo.province);
      return;
    }
    setSelectedProvinceState(geo.province);
    if (
      adminScope.accessLevel === "division" ||
      adminScope.accessLevel === "district" ||
      adminScope.accessLevel === "tehsil"
    ) {
      setSelectedDivisionState(geo.division);
    }
    if (adminScope.accessLevel === "district" || adminScope.accessLevel === "tehsil") {
      setSelectedDistrictState(geo.district);
    }
    if (adminScope.accessLevel === "tehsil") {
      setSelectedTehsilState(geo.tehsil);
    }
  }, [adminScope]);

  const provinceLocked = useMemo<boolean>(() => {
    if (!adminScope) return false;
    if (adminScope.fullAccess) return false;
    return true;
  }, [adminScope]);

  const divisionLocked = useMemo<boolean>(() => isDivisionLocked(adminScope), [adminScope]);
  const districtLocked = useMemo<boolean>(() => isDistrictLocked(adminScope), [adminScope]);
  const tehsilLocked = useMemo<boolean>(() => isTehsilLocked(adminScope), [adminScope]);

  const availableProvinces = useMemo<string[]>(() => {
    if (!adminScope || adminScope.fullAccess) return [...PROVINCES];
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
    return adminScope.division ? [adminScope.division] : [];
  }, [adminScope, selectedProvince]);

  /**
   * Division-level fix (spec §4 / §8): division admins MUST see only districts in their division.
   */
  const availableDistricts = useMemo<string[]>(() => {
    if (!adminScope || adminScope.fullAccess) {
      if (selectedDivision) return getDistrictsForDivision(selectedDivision);
      return getAllDistrictsForProvince(selectedProvince || DEFAULT_PROVINCE);
    }
    if (adminScope.accessLevel === "province") {
      const province = adminScope.province || DEFAULT_PROVINCE;
      if (selectedDivision) return getDistrictsForDivision(selectedDivision);
      return getAllDistrictsForProvince(province);
    }
    if (adminScope.accessLevel === "division") {
      return getDistrictsForDivision(adminScope.division ?? "");
    }
    return adminScope.district ? [adminScope.district] : [];
  }, [adminScope, selectedProvince, selectedDivision]);

  const availableTehsils = useMemo<string[]>(() => {
    if (adminScope && !adminScope.fullAccess && adminScope.accessLevel === "tehsil") {
      return adminScope.tehsil ? [adminScope.tehsil] : [];
    }
    if (selectedDistrict) return getTehsilsForDistrict(selectedDistrict);
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

  const scopeDistricts = useMemo<string[]>(() => getScopeDistricts(adminScope), [adminScope]);

  const setSelectedProvince = useCallback(
    (v: string) => {
      if (provinceLocked) return;
      setSelectedProvinceState(v);
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
      setSelectedTehsilState("");
      setSelectedUC("");
    },
    [districtLocked],
  );
  const setSelectedTehsil = useCallback(
    (v: string) => {
      if (tehsilLocked) return;
      setSelectedTehsilState(v);
      setSelectedUC("");
    },
    [tehsilLocked],
  );

  useEffect(() => {
    if (districtLocked) return;
    if (!selectedDistrict) return;
    if (!availableDistricts.includes(selectedDistrict)) {
      setSelectedDistrictState("");
      setSelectedTehsilState("");
      setSelectedUC("");
    }
  }, [availableDistricts, selectedDistrict, districtLocked]);

  useEffect(() => {
    if (tehsilLocked) return;
    if (!selectedTehsil) return;
    if (!availableTehsils.includes(selectedTehsil)) {
      setSelectedTehsilState("");
      setSelectedUC("");
    }
  }, [availableTehsils, selectedTehsil, tehsilLocked]);

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

  const resetFilters = useCallback(() => {
    setSelectedWasaCategory("");
    setSelectedStatus("");
    setSelectedRouting("");
    setSelectedAssignee("");
    setSelectedUC("");
    setDateRange({ from: null, to: null });
    setSearch("");
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

  useEffect(() => {
    const payload: PersistedShape = {
      selectedWasaCategory,
      selectedStatus,
      selectedRouting,
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
    selectedWasaCategory,
    selectedStatus,
    selectedRouting,
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

  const value = useMemo<FilterContextValue>(
    () => ({
      selectedProvince,
      selectedDivision,
      selectedDistrict,
      selectedTehsil,
      selectedUC,
      selectedWasaCategory,
      selectedStatus,
      selectedRouting,
      selectedAssignee,
      dateRange,
      search,
      setSelectedProvince,
      setSelectedDivision,
      setSelectedDistrict,
      setSelectedTehsil,
      setSelectedUC,
      setSelectedWasaCategory,
      setSelectedStatus,
      setSelectedRouting,
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
      selectedWasaCategory,
      selectedStatus,
      selectedRouting,
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

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};

export const useFilters = (): FilterContextValue => {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within a FilterProvider");
  return ctx;
};

export const useActiveFilters = (): ActiveFiltersSnapshot => {
  const f = useFilters();
  return useMemo<ActiveFiltersSnapshot>(
    () => ({
      province: f.selectedProvince,
      division: f.selectedDivision,
      district: f.selectedDistrict,
      tehsil: f.selectedTehsil,
      uc: f.selectedUC,
      wasaCategory: f.selectedWasaCategory,
      status: f.selectedStatus,
      routing: f.selectedRouting,
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
      f.selectedWasaCategory,
      f.selectedStatus,
      f.selectedRouting,
      f.selectedAssignee,
      f.dateRange.from,
      f.dateRange.to,
      f.search,
      f.scopeDistricts,
    ],
  );
};
