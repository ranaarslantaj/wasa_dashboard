"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import L, { type LatLngBoundsLiteral, type LatLngTuple } from "leaflet";
import { subDays } from "date-fns";

import { useAuth } from "@/context/AuthContext";
import { useActiveFilters } from "@/context/FilterContext";
import { useComplaints, type ComplaintsFilters } from "@/hooks/useComplaints";
import { WASA_CATEGORIES } from "@/constants/wasaCategories";
import { STATUS_BADGE, STATUS_LABELS } from "@/constants/statuses";
import {
  DEFAULT_MAP_CONFIG,
  DISTRICT_BOUNDARIES,
  DISTRICT_MAP_CONFIG,
  DIVISION_MAP_CONFIG,
  TEHSIL_BOUNDARIES,
} from "@/constants/boundaries";
import { getDistrictsForDivision } from "@/constants/geography";
import { derivePriority } from "@/lib/derivePriority";
import { cn } from "@/lib/cn";
import type { Complaint, ComplaintStatus, ComplaintPriority } from "@/types";

import { ComplaintDetailModal } from "@/components/complaints/ComplaintDetailModal";
import { ComplaintMarker } from "./ComplaintMarker";
import { HeatLayer } from "./HeatLayer";
import { ZoomAwareBoundaries } from "./ZoomAwareBoundaries";
import {
  MapLayerToggle,
  type MapLayerDescriptor,
} from "./MapLayerToggle";

let iconPatched = false;
const patchLeafletIcons = (): void => {
  if (iconPatched) return;
  iconPatched = true;
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
    ._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
  });
};

type StatusLayerKey = "action_required" | "action_taken" | "irrelevant";

interface EnabledState {
  all: boolean;
  action_required: boolean;
  action_taken: boolean;
  irrelevant: boolean;
  heatmap: boolean;
  boundaries: boolean;
}

const STATUS_LAYER_COLORS: Record<StatusLayerKey, string> = {
  action_required: "#F59E0B",
  action_taken: "#10B981",
  irrelevant: "#EF4444",
};

const PRIORITY_INTENSITY: Record<ComplaintPriority, number> = {
  low: 0.3,
  medium: 0.5,
  high: 0.8,
  critical: 1.0,
};

export function LiveMapClient() {
  useEffect(() => {
    patchLeafletIcons();
  }, []);

  const { adminScope } = useAuth();
  const f = useActiveFilters();
  // Falls back to "last 90 days" only when the user picked nothing AND we
  // didn't explicitly disable. Set to `null` to truly skip the date filter.
  const defaultFrom = useMemo(() => subDays(new Date(), 90), []);

  /**
   * Initial map view derived from the admin's scope so each admin lands on
   * their own region instead of always seeing all of Punjab.
   *
   * Where a polygon is available we compute exact bounds and let MapContainer's
   * `bounds` prop fit them with padding — that gives a "polygon fills the
   * frame" look (e.g. Lodhran district admin sees the full district + its
   * tehsils with a comfortable margin).
   */
  const initialView = useMemo<{
    center: LatLngTuple;
    zoom: number;
    bounds?: LatLngBoundsLiteral;
    maxZoom?: number;
  }>(() => {
    const polygonsToUse: LatLngTuple[][] = [];

    if (adminScope && !adminScope.fullAccess) {
      if (adminScope.accessLevel === "tehsil" && adminScope.tehsil) {
        const p = TEHSIL_BOUNDARIES[adminScope.tehsil];
        if (p) polygonsToUse.push(p);
      } else if (
        (adminScope.accessLevel === "district" ||
          adminScope.accessLevel === "tehsil") &&
        adminScope.district
      ) {
        const p = DISTRICT_BOUNDARIES[adminScope.district];
        if (p) polygonsToUse.push(p);
      } else if (
        adminScope.accessLevel === "division" &&
        adminScope.division
      ) {
        for (const d of getDistrictsForDivision(adminScope.division)) {
          const p = DISTRICT_BOUNDARIES[d];
          if (p) polygonsToUse.push(p);
        }
      }
    }

    if (polygonsToUse.length > 0) {
      const flat: LatLngTuple[] = polygonsToUse.flat();
      const lats = flat.map((p) => p[0]);
      const lngs = flat.map((p) => p[1]);
      const sw: LatLngTuple = [Math.min(...lats), Math.min(...lngs)];
      const ne: LatLngTuple = [Math.max(...lats), Math.max(...lngs)];
      const center: LatLngTuple = [
        (sw[0] + ne[0]) / 2,
        (sw[1] + ne[1]) / 2,
      ];
      const isTehsil = adminScope?.accessLevel === "tehsil";
      const isDivision = adminScope?.accessLevel === "division";
      return {
        center,
        zoom: isTehsil ? 13 : isDivision ? 10 : 11,
        bounds: [sw, ne],
        maxZoom: isTehsil ? 14 : isDivision ? 10 : 12,
      };
    }

    // No polygon available — fall back to the static configs.
    if (
      adminScope &&
      !adminScope.fullAccess &&
      (adminScope.accessLevel === "tehsil" ||
        adminScope.accessLevel === "district") &&
      adminScope.district &&
      DISTRICT_MAP_CONFIG[adminScope.district]
    ) {
      return DISTRICT_MAP_CONFIG[adminScope.district];
    }
    if (adminScope?.accessLevel === "division") return DIVISION_MAP_CONFIG;
    return DEFAULT_MAP_CONFIG;
  }, [adminScope]);

  const [enabled, setEnabled] = useState<EnabledState>({
    all: true,
    action_required: true,
    action_taken: true,
    irrelevant: true,
    heatmap: false,
    boundaries: true,
  });

  /**
   * Recenter / zoom the map whenever the user narrows the geographic filter.
   * Tehsil → fit to that tehsil polygon; District → district polygon; Division
   * → union of all that division's district polygons; cleared → admin's
   * scope-based default. Falls back gracefully when no polygon is on file.
   */
  const focusBoundsKey = `${f.division}|${f.district}|${f.tehsil}`;

  // Leaflet measures the container size when it initializes. If our wrapper
  // hasn't laid out by then (Tailwind classes applied late, dynamic import
  // hydration, etc.) the map renders blank. Force an invalidateSize() after
  // mount so tiles paint correctly.
  const mapRef = useRef<LeafletMap | null>(null);
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const id = window.setTimeout(() => m.invalidateSize(), 50);
    return () => window.clearTimeout(id);
  }, []);

  // React to user-driven scope changes (filter dropdowns) — refit the view.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const polygons: LatLngTuple[][] = [];

    if (f.tehsil && TEHSIL_BOUNDARIES[f.tehsil]) {
      polygons.push(TEHSIL_BOUNDARIES[f.tehsil]);
    } else if (f.district && DISTRICT_BOUNDARIES[f.district]) {
      polygons.push(DISTRICT_BOUNDARIES[f.district]);
    } else if (f.division) {
      const divDistricts = getDistrictsForDivision(f.division);
      for (const d of divDistricts) {
        if (DISTRICT_BOUNDARIES[d]) polygons.push(DISTRICT_BOUNDARIES[d]);
      }
    }

    if (polygons.length > 0) {
      const flat: LatLngTuple[] = polygons.flat();
      const lats = flat.map((p) => p[0]);
      const lngs = flat.map((p) => p[1]);
      const sw: LatLngTuple = [Math.min(...lats), Math.min(...lngs)];
      const ne: LatLngTuple = [Math.max(...lats), Math.max(...lngs)];
      m.flyToBounds([sw, ne], {
        padding: [30, 30],
        duration: 0.6,
        maxZoom: f.tehsil ? 14 : f.district ? 12 : 10,
      });
      return;
    }

    // No filter narrowing — fall back to the admin's initial view (no animation)
    if (initialView.bounds) {
      m.flyToBounds(initialView.bounds, {
        padding: [30, 30],
        duration: 0.5,
        maxZoom: initialView.maxZoom ?? 12,
      });
    } else {
      m.flyTo(initialView.center, initialView.zoom, { duration: 0.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBoundsKey]);

  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const handleViewComplaint = (c: Complaint): void => {
    setSelectedComplaint(c);
    setModalOpen(true);
  };
  const closeModal = (): void => setModalOpen(false);

  const toggleLayer = (id: string): void => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id as keyof EnabledState] }));
  };
  const toggleHeatmap = (): void => {
    setEnabled((prev) => ({ ...prev, heatmap: !prev.heatmap }));
  };
  const toggleBoundaries = (): void => {
    setEnabled((prev) => ({ ...prev, boundaries: !prev.boundaries }));
  };

  const baseFilters = useMemo(
    () => ({
      scopeDistricts: f.scopeDistricts,
      district: f.district || undefined,
      tahsil: f.tehsil || undefined,
      uc: f.uc || undefined,
      wasaCategory: f.wasaCategory || undefined,
      routingStrategy: f.routing || undefined,
      assignee: f.assignee || undefined,
      dateFrom: f.dateFrom ?? defaultFrom,
      dateTo: f.dateTo ?? new Date(),
      limit: 500,
    }),
    [
      f.scopeDistricts,
      f.district,
      f.tehsil,
      f.uc,
      f.wasaCategory,
      f.routing,
      f.assignee,
      f.dateFrom,
      f.dateTo,
      defaultFrom,
    ]
  );

  const buildFilters = (
    key: StatusLayerKey
  ): ComplaintsFilters | null => {
    if (!enabled.all || !enabled[key]) return null;
    return { ...baseFilters, complaintStatus: key };
  };

  const actionRequiredFilters = useMemo<ComplaintsFilters | null>(
    () => buildFilters("action_required"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseFilters, enabled.all, enabled.action_required]
  );
  const actionTakenFilters = useMemo<ComplaintsFilters | null>(
    () => buildFilters("action_taken"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseFilters, enabled.all, enabled.action_taken]
  );
  const irrelevantFilters = useMemo<ComplaintsFilters | null>(
    () => buildFilters("irrelevant"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseFilters, enabled.all, enabled.irrelevant]
  );

  const { data: actionRequired, refetch: refetchActionRequired } =
    useComplaints(actionRequiredFilters);
  const { data: actionTaken, refetch: refetchActionTaken } =
    useComplaints(actionTakenFilters);
  const { data: irrelevant, refetch: refetchIrrelevant } =
    useComplaints(irrelevantFilters);

  const refetchAll = (): void => {
    refetchActionRequired();
    refetchActionTaken();
    refetchIrrelevant();
  };

  // Read coordinates tolerantly — newer citizen-app docs use `complainCoordinates`,
  // older or hand-seeded docs may use `coordinates` or top-level `lat/lng`.
  const readCoords = (
    c: Complaint,
  ): { lat: number; lng: number } | null => {
    const candidates = [
      c.complainCoordinates,
      (c as Complaint & { coordinates?: { lat?: number; lng?: number } }).coordinates,
      (c as Complaint & { actionCoordinates?: { lat?: number | null; lng?: number | null } })
        .actionCoordinates,
    ];
    for (const co of candidates) {
      const lat = co?.lat;
      const lng = co?.lng;
      if (typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    return null;
  };

  const allMarkers = useMemo<Complaint[]>(() => {
    const byId = new Map<string, Complaint>();
    for (const c of [...actionRequired, ...actionTaken, ...irrelevant]) {
      byId.set(c.id, c);
    }
    return Array.from(byId.values()).filter((c) => readCoords(c) !== null);
  }, [actionRequired, actionTaken, irrelevant]);

  const heatPoints = useMemo<[number, number, number][]>(
    () =>
      allMarkers
        .map<[number, number, number] | null>((c) => {
          const co = readCoords(c);
          if (!co) return null;
          return [
            co.lat,
            co.lng,
            PRIORITY_INTENSITY[derivePriority(c.wasaCategory)] ?? 0.3,
          ];
        })
        .filter((p): p is [number, number, number] => p !== null),
    [allMarkers]
  );

  const layers: MapLayerDescriptor[] = [
    {
      id: "all",
      label: "All complaints",
      count: allMarkers.length,
      color: "#0ea5e9",
      enabled: enabled.all,
    },
    {
      id: "action_required",
      label: STATUS_LABELS.action_required,
      count: actionRequired.length,
      color: STATUS_LAYER_COLORS.action_required,
      enabled: enabled.action_required,
    },
    {
      id: "action_taken",
      label: STATUS_LABELS.action_taken,
      count: actionTaken.length,
      color: STATUS_LAYER_COLORS.action_taken,
      enabled: enabled.action_taken,
    },
    {
      id: "irrelevant",
      label: STATUS_LABELS.irrelevant,
      count: irrelevant.length,
      color: STATUS_LAYER_COLORS.irrelevant,
      enabled: enabled.irrelevant,
    },
  ];

  return (
    <div className="space-y-3">
      <MapLayerToggle
        layers={layers}
        onToggle={toggleLayer}
        heatmapEnabled={enabled.heatmap}
        onHeatmapToggle={toggleHeatmap}
        boundariesEnabled={enabled.boundaries}
        onBoundariesToggle={toggleBoundaries}
      />
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
        style={{ height: "calc(100vh - 200px)", minHeight: 480 }}
      >
        <MapContainer
          {...(initialView.bounds
            ? {
                bounds: initialView.bounds,
                boundsOptions: {
                  padding: [30, 30],
                  maxZoom: initialView.maxZoom ?? 12,
                },
              }
            : {
                center: initialView.center,
                zoom: initialView.zoom,
              })}
          scrollWheelZoom
          ref={(instance) => {
            mapRef.current = instance ?? null;
          }}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ZoomAwareBoundaries
            showBoundary={enabled.boundaries}
            adminScope={adminScope}
          />

          {allMarkers.map((c) => (
            <ComplaintMarker
              key={c.id}
              complaint={c}
              onView={handleViewComplaint}
            />
          ))}

          {enabled.heatmap && heatPoints.length > 0 && (
            <HeatLayer points={heatPoints} />
          )}
        </MapContainer>

        <div className="absolute bottom-4 left-4 z-[1000] max-w-[15rem] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            WASA categories
          </div>
          <ul className="space-y-1">
            {WASA_CATEGORIES.map((cat) => (
              <li
                key={cat.value}
                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden
                />
                <span className="truncate">{cat.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip
          label={STATUS_LABELS.action_required}
          count={actionRequired.length}
          status="action_required"
        />
        <StatusChip
          label={STATUS_LABELS.action_taken}
          count={actionTaken.length}
          status="action_taken"
        />
        <StatusChip
          label={STATUS_LABELS.irrelevant}
          count={irrelevant.length}
          status="irrelevant"
        />
      </div>

      <ComplaintDetailModal
        complaint={selectedComplaint}
        open={modalOpen}
        onClose={closeModal}
        onMutated={refetchAll}
      />
    </div>
  );
}

interface StatusChipProps {
  label: string;
  count: number;
  status: ComplaintStatus;
}

function StatusChip({ label, count, status }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        STATUS_BADGE[status]
      )}
    >
      <span>{label}</span>
      <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:bg-slate-900/60 dark:text-slate-100">
        {count}
      </span>
    </span>
  );
}

export default LiveMapClient;
