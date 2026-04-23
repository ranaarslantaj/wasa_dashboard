"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import { subDays } from "date-fns";

import { useActiveFilters } from "@/context/FilterContext";
import { useComplaints, type ComplaintsFilters } from "@/hooks/useComplaints";
import { COMPLAINT_TYPE_FALLBACK } from "@/constants/complaintTypes";
import { STATUS_BADGE, STATUS_LABELS } from "@/constants/statuses";
import { cn } from "@/lib/cn";
import type { Complaint, ComplaintStatus } from "@/types";

import { ComplaintDetailModal } from "@/components/complaints/ComplaintDetailModal";
import { ComplaintMarker } from "./ComplaintMarker";
import { HeatLayer } from "./HeatLayer";
import {
  MapLayerToggle,
  type MapLayerDescriptor,
} from "./MapLayerToggle";

/* -------------------------------------------------------------------------- */
/*                            Icon default patch                              */
/* -------------------------------------------------------------------------- */
// Leaflet's bundled icon URLs are broken under modern bundlers; point them at
// the copies in /public/leaflet/ (see layout.tsx — leaflet CSS is loaded there).
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

/* -------------------------------------------------------------------------- */
/*                                 Layer keys                                 */
/* -------------------------------------------------------------------------- */

type StatusLayerKey = "pending" | "assigned" | "in_progress" | "resolved";

interface EnabledState {
  all: boolean;
  pending: boolean;
  assigned: boolean;
  in_progress: boolean;
  resolved: boolean;
  heatmap: boolean;
}

const STATUS_LAYER_COLORS: Record<StatusLayerKey, string> = {
  pending: "#64748b",
  assigned: "#3b82f6",
  in_progress: "#f59e0b",
  resolved: "#10b981",
};

/** Intensity weights for heatmap points by complaint priority. */
const PRIORITY_INTENSITY: Record<Complaint["priority"], number> = {
  low: 0.3,
  medium: 0.5,
  high: 0.8,
  critical: 1.0,
};

/** Punjab geographic centroid — matches the WeWatch default. */
const DEFAULT_CENTER: [number, number] = [31.1704, 72.7097];
const DEFAULT_ZOOM = 7;

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

export function LiveMapClient() {
  useEffect(() => {
    patchLeafletIcons();
  }, []);

  const f = useActiveFilters();

  // Default to the last 7 days on first mount (spec §6.2 — "keep initial load light").
  const defaultFrom = useMemo(() => subDays(new Date(), 7), []);

  const [enabled, setEnabled] = useState<EnabledState>({
    all: true,
    pending: true,
    assigned: true,
    in_progress: true,
    resolved: false,
    heatmap: false,
  });

  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const handleViewComplaint = (c: Complaint): void => {
    setSelectedComplaint(c);
    setModalOpen(true);
  };

  const closeModal = (): void => {
    setModalOpen(false);
  };

  const toggleLayer = (id: string): void => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id as keyof EnabledState] }));
  };

  const toggleHeatmap = (): void => {
    setEnabled((prev) => ({ ...prev, heatmap: !prev.heatmap }));
  };

  /* -------------------------------------------------------------------- */
  /*                         Per-layer filter builder                     */
  /* -------------------------------------------------------------------- */

  const baseFilters = useMemo(
    () => ({
      scopeDistricts: f.scopeDistricts,
      district: f.district || undefined,
      tehsil: f.tehsil || undefined,
      uc: f.uc || undefined,
      complaintType: f.complaintType || undefined,
      priority: f.priority || undefined,
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
      f.complaintType,
      f.priority,
      f.assignee,
      f.dateFrom,
      f.dateTo,
      defaultFrom,
    ]
  );

  const buildFilters = (
    key: StatusLayerKey,
    status: ComplaintStatus
  ): ComplaintsFilters | null => {
    // §19 rule 7: when a layer is off, pass `null` so the hook short-circuits.
    // The `all` master toggle must also be on for any sub-layer to fetch.
    if (!enabled.all || !enabled[key]) return null;
    return { ...baseFilters, status };
  };

  const pendingFilters = useMemo<ComplaintsFilters | null>(
    () => buildFilters("pending", "pending"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseFilters, enabled.all, enabled.pending]
  );
  const assignedFilters = useMemo<ComplaintsFilters | null>(
    () => buildFilters("assigned", "assigned"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseFilters, enabled.all, enabled.assigned]
  );
  const inProgressFilters = useMemo<ComplaintsFilters | null>(
    () => buildFilters("in_progress", "in_progress"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseFilters, enabled.all, enabled.in_progress]
  );
  const resolvedFilters = useMemo<ComplaintsFilters | null>(
    () => buildFilters("resolved", "resolved"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseFilters, enabled.all, enabled.resolved]
  );

  const { data: pending, refetch: refetchPending } =
    useComplaints(pendingFilters);
  const { data: assigned, refetch: refetchAssigned } =
    useComplaints(assignedFilters);
  const { data: inProgress, refetch: refetchInProgress } =
    useComplaints(inProgressFilters);
  const { data: resolved, refetch: refetchResolved } =
    useComplaints(resolvedFilters);

  const refetchAll = (): void => {
    refetchPending();
    refetchAssigned();
    refetchInProgress();
    refetchResolved();
  };

  /* -------------------------------------------------------------------- */
  /*                         Derived markers + heat                       */
  /* -------------------------------------------------------------------- */

  const allMarkers = useMemo<Complaint[]>(() => {
    const byId = new Map<string, Complaint>();
    for (const c of [...pending, ...assigned, ...inProgress, ...resolved]) {
      byId.set(c.id, c);
    }
    return Array.from(byId.values()).filter(
      (c) =>
        typeof c.coordinates?.lat === "number" &&
        typeof c.coordinates?.lng === "number"
    );
  }, [pending, assigned, inProgress, resolved]);

  const heatPoints = useMemo<[number, number, number][]>(
    () =>
      allMarkers.map((c) => [
        c.coordinates.lat,
        c.coordinates.lng,
        PRIORITY_INTENSITY[c.priority] ?? 0.3,
      ]),
    [allMarkers]
  );

  /* -------------------------------------------------------------------- */
  /*                         Layer toggle descriptors                     */
  /* -------------------------------------------------------------------- */

  const layers: MapLayerDescriptor[] = [
    {
      id: "all",
      label: "All complaints",
      count: allMarkers.length,
      color: "#0ea5e9",
      enabled: enabled.all,
    },
    {
      id: "pending",
      label: STATUS_LABELS.pending,
      count: pending.length,
      color: STATUS_LAYER_COLORS.pending,
      enabled: enabled.pending,
    },
    {
      id: "assigned",
      label: STATUS_LABELS.assigned,
      count: assigned.length,
      color: STATUS_LAYER_COLORS.assigned,
      enabled: enabled.assigned,
    },
    {
      id: "in_progress",
      label: STATUS_LABELS.in_progress,
      count: inProgress.length,
      color: STATUS_LAYER_COLORS.in_progress,
      enabled: enabled.in_progress,
    },
    {
      id: "resolved",
      label: STATUS_LABELS.resolved,
      count: resolved.length,
      color: STATUS_LAYER_COLORS.resolved,
      enabled: enabled.resolved,
    },
  ];

  const legendItems = Object.entries(COMPLAINT_TYPE_FALLBACK);

  /* -------------------------------------------------------------------- */
  /*                                 Render                               */
  /* -------------------------------------------------------------------- */

  return (
    <div className="space-y-3">
      <div className="relative">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          className="h-[calc(100vh-140px)] w-full overflow-hidden rounded-xl"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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

        <MapLayerToggle
          layers={layers}
          onToggle={toggleLayer}
          heatmapEnabled={enabled.heatmap}
          onHeatmapToggle={toggleHeatmap}
        />

        {/* -------- Bottom-left legend (complaint type colors) -------- */}
        <div className="absolute bottom-4 left-4 z-[1000] max-w-[15rem] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Complaint types
          </div>
          <ul className="space-y-1">
            {legendItems.map(([key, meta]) => (
              <li
                key={key}
                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span className="truncate">{meta.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* -------- Stats chips row -------- */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip
          label={STATUS_LABELS.pending}
          count={pending.length}
          status="pending"
        />
        <StatusChip
          label={STATUS_LABELS.assigned}
          count={assigned.length}
          status="assigned"
        />
        <StatusChip
          label={STATUS_LABELS.in_progress}
          count={inProgress.length}
          status="in_progress"
        />
        <StatusChip
          label={STATUS_LABELS.resolved}
          count={resolved.length}
          status="resolved"
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
