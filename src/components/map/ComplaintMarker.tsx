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
import { COMPLAINT_TYPE_FALLBACK } from "@/constants/complaintTypes";
import { formatTimeAgo } from "@/lib/formatters";
import type { Complaint } from "@/types";

export interface ComplaintMarkerProps {
  complaint: Complaint;
  onView: (c: Complaint) => void;
}

function buildDivIcon(color: string, letter: string): L.DivIcon {
  return L.divIcon({
    className: "wasa-complaint-marker",
    html: `<div style="
      width: 28px; height: 28px;
      background: ${color};
      border: 2px solid #fff;
      border-radius: 9999px;
      box-shadow: 0 2px 6px rgba(15,23,42,0.35);
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      font-weight: 600;
      font-size: 12px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      line-height: 1;
    ">${letter}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function ComplaintMarkerImpl({ complaint, onView }: ComplaintMarkerProps) {
  const typeMeta =
    COMPLAINT_TYPE_FALLBACK[complaint.complaintType] ?? {
      label: complaint.complaintType || "Complaint",
      color: "#64748b",
      icon: "MapPin",
    };

  const letter = (typeMeta.label || "?").trim().charAt(0).toUpperCase() || "?";

  const icon = useMemo(
    () => buildDivIcon(typeMeta.color, letter),
    [typeMeta.color, letter]
  );

  const lat = complaint.coordinates?.lat;
  const lng = complaint.coordinates?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const locationLine = [complaint.district, complaint.tehsil, complaint.ucName]
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
                backgroundColor: `${typeMeta.color}20`,
                color: typeMeta.color,
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: typeMeta.color }}
                aria-hidden
              />
              {typeMeta.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase",
                STATUS_BADGE[complaint.status]
              )}
            >
              {STATUS_LABELS[complaint.status]}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase",
                PRIORITY_BADGE[complaint.priority]
              )}
            >
              {PRIORITY_LABELS[complaint.priority]}
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
