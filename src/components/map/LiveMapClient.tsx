"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import { subDays } from "date-fns";

import { useActiveFilters } from "@/context/FilterContext";
import { useComplaints, type ComplaintsFilters } from "@/hooks/useComplaints";
import { WASA_CATEGORIES } from "@/constants/wasaCategories";
import { STATUS_BADGE, STATUS_LABELS } from "@/constants/statuses";
import { derivePriority } from "@/lib/derivePriority";
import { cn } from "@/lib/cn";
import type { Complaint, ComplaintStatus, ComplaintPriority } from "@/types";

import { ComplaintDetailModal } from "@/components/complaints/ComplaintDetailModal";
import { ComplaintMarker } from "./ComplaintMarker";
import { HeatLayer } from "./HeatLayer";
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

const DEFAULT_CENTER: [number, number] = [31.1704, 72.7097];
const DEFAULT_ZOOM = 7;

export function LiveMapClient() {
  useEffect(() => {
    patchLeafletIcons();
  }, []);

  const f = useActiveFilters();
  const defaultFrom = useMemo(() => subDays(new Date(), 7), []);

  const [enabled, setEnabled] = useState<EnabledState>({
    all: true,
    action_required: true,
    action_taken: false,
    irrelevant: false,
    heatmap: false,
  });

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

  const allMarkers = useMemo<Complaint[]>(() => {
    const byId = new Map<string, Complaint>();
    for (const c of [...actionRequired, ...actionTaken, ...irrelevant]) {
      byId.set(c.id, c);
    }
    return Array.from(byId.values()).filter(
      (c) =>
        typeof c.complainCoordinates?.lat === "number" &&
        typeof c.complainCoordinates?.lng === "number"
    );
  }, [actionRequired, actionTaken, irrelevant]);

  const heatPoints = useMemo<[number, number, number][]>(
    () =>
      allMarkers.map((c) => [
        c.complainCoordinates.lat,
        c.complainCoordinates.lng,
        PRIORITY_INTENSITY[derivePriority(c.wasaCategory)] ?? 0.3,
      ]),
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
