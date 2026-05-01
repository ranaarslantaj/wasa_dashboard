"use client";

import { memo, useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Phone } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
} from "@/constants/statuses";
import {
  wasaCategoryColor,
  wasaCategoryLabel,
} from "@/constants/wasaCategories";
import { derivePriority } from "@/lib/derivePriority";
import { formatTimeAgo } from "@/lib/formatters";
import type { Complaint } from "@/types";

export interface ComplaintMarkerProps {
  complaint: Complaint;
  onView: (c: Complaint) => void;
}

/**
 * Compact Google-Maps-style teardrop pin (18×26) with a clean white
 * circular hole at the head. Body color comes from the complaint's
 * WASA sub-category. Anchor sits at the tip (bottom-center).
 */
function buildDivIcon(color: string): L.DivIcon {
  const html = `
    <div style="position:relative;width:18px;height:26px;filter:drop-shadow(0 1.5px 2px rgba(15,23,42,0.4));">
      <svg viewBox="0 0 18 26" width="18" height="26" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9 1
             C 4.6 1 1 4.6 1 9
             C 1 15.5 9 25 9 25
             C 9 25 17 15.5 17 9
             C 17 4.6 13.4 1 9 1 Z"
          fill="${color}"
        />
        <circle cx="9" cy="9" r="3" fill="#ffffff" />
      </svg>
    </div>
  `;
  return L.divIcon({
    className: "wasa-complaint-pin",
    html,
    iconSize: [18, 26],
    iconAnchor: [9, 25],
    popupAnchor: [0, -22],
  });
}

const FALLBACK_COLOR = "#2563EB"; // brand-600 — always something WASA-coloured

function ComplaintMarkerImpl({ complaint, onView }: ComplaintMarkerProps) {
  const rawColor = wasaCategoryColor(complaint.wasaCategory);
  const categoryColor = complaint.wasaCategory ? rawColor : FALLBACK_COLOR;
  const categoryLabel = complaint.wasaCategory
    ? wasaCategoryLabel(complaint.wasaCategory)
    : "WASA Complaint";

  const icon = useMemo(
    () => buildDivIcon(categoryColor),
    [categoryColor],
  );

  // Tolerate legacy field shapes — `complainCoordinates`, `coordinates`,
  // or `actionCoordinates`.
  const cAny = complaint as Complaint & {
    coordinates?: { lat?: number; lng?: number };
    actionCoordinates?: { lat?: number | null; lng?: number | null };
  };
  const candidates = [
    complaint.complainCoordinates,
    cAny.coordinates,
    cAny.actionCoordinates,
  ];
  let lat: number | undefined;
  let lng: number | undefined;
  for (const co of candidates) {
    if (
      typeof co?.lat === "number" &&
      typeof co?.lng === "number" &&
      !isNaN(co.lat) &&
      !isNaN(co.lng)
    ) {
      lat = co.lat;
      lng = co.lng;
      break;
    }
  }
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const derivedPriority = derivePriority(complaint.wasaCategory);

  const locationLine = [
    complaint.district,
    complaint.tahsil,
    complaint.ucMcNumber || "—",
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup>
        <div className="min-w-[220px] text-sm">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${categoryColor}20`,
                color: categoryColor,
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: categoryColor }}
                aria-hidden
              />
              {categoryLabel}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase",
                STATUS_BADGE[complaint.complaintStatus]
              )}
            >
              {STATUS_LABELS[complaint.complaintStatus]}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase",
                PRIORITY_BADGE[derivedPriority]
              )}
            >
              {PRIORITY_LABELS[derivedPriority]}
            </span>
          </div>

          <div className="font-semibold text-slate-900 dark:text-slate-100">
            {complaint.complaintId || complaint.id}
          </div>

          {complaint.complainantName && (
            <div className="mt-1 text-slate-800 dark:text-slate-200">
              {complaint.complainantName}
            </div>
          )}
          {complaint.complainantPhone && (
            <a
              href={`tel:${complaint.complainantPhone}`}
              className="mt-0.5 flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              <Phone className="h-3 w-3" aria-hidden />
              {complaint.complainantPhone}
            </a>
          )}

          {locationLine && (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {locationLine}
            </div>
          )}

          <div className="mt-1 text-xs text-slate-400">
            {formatTimeAgo(complaint.createdAt)}
          </div>

          <div className="mt-3">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => onView(complaint)}
            >
              View Details
            </Button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export const ComplaintMarker = memo(ComplaintMarkerImpl);

export default ComplaintMarker;
