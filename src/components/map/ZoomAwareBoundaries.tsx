"use client";

import { useState } from "react";
import { Polygon, useMap, useMapEvents } from "react-leaflet";

import {
  DISTRICT_BOUNDARIES,
  DISTRICT_BOUNDARY_STYLES,
  TEHSIL_BOUNDARIES,
  TEHSIL_BOUNDARIES_BY_DISTRICT,
  TEHSIL_BOUNDARY_STYLES,
  ZOOM_THRESHOLDS,
} from "@/constants/boundaries";
import { getDistrictsForDivision } from "@/constants/geography";
import type { AdminScope } from "@/types";

export interface ZoomAwareBoundariesProps {
  /** When false, suppress all polygons (heatmap-only view, etc.). */
  showBoundary: boolean;
  adminScope: AdminScope | null;
}

/**
 * Renders district + tehsil polygons filtered by the admin's scope and the
 * current map zoom. Mirrors the WeWatch reference implementation, ported to TS.
 *
 * Layer rules:
 *  - province / fullAccess: districts at low zoom, tehsils at high zoom.
 *  - division / district / tehsil: always show their domain; tehsils also kick
 *    in once the user is zoomed in (zoom >= 8).
 *  - At zoom >= 12 we draw a faint dashed district outline so deep-zoom users
 *    still get geographic context.
 *  - A tehsil-level admin who zooms out past zoom 8 still sees their own
 *    tehsil polygon so they never lose bearings.
 */
export function ZoomAwareBoundaries({
  showBoundary,
  adminScope,
}: ZoomAwareBoundariesProps) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState<number>(map.getZoom());

  useMapEvents({
    zoomend: () => setCurrentZoom(map.getZoom()),
  });

  if (!showBoundary || !adminScope) return null;

  const isUnrestricted = adminScope.fullAccess || adminScope.accessLevel === "province";
  const { division, district, tehsil: lockedTehsil } = adminScope;

  const showDistricts = isUnrestricted
    ? currentZoom < ZOOM_THRESHOLDS.TEHSIL_SWITCH
    : true;

  const showTehsils = isUnrestricted
    ? currentZoom >= ZOOM_THRESHOLDS.TEHSIL_SWITCH
    : currentZoom >= 8;

  const filteredDistricts = Object.entries(DISTRICT_BOUNDARIES).filter(
    ([name]) => {
      if (isUnrestricted) return true;
      if (adminScope.accessLevel === "division") {
        return getDistrictsForDivision(division).includes(name);
      }
      if (
        adminScope.accessLevel === "district" ||
        adminScope.accessLevel === "tehsil"
      ) {
        return name === district;
      }
      return false;
    },
  );

  const filteredTehsilGroups = Object.entries(TEHSIL_BOUNDARIES_BY_DISTRICT).filter(
    ([distName]) => {
      if (isUnrestricted) return true;
      if (adminScope.accessLevel === "division") {
        return getDistrictsForDivision(division).includes(distName);
      }
      if (adminScope.accessLevel === "district") return distName === district;
      if (adminScope.accessLevel === "tehsil") return distName === district;
      return false;
    },
  );

  return (
    <>
      {showDistricts &&
        filteredDistricts.map(([name, boundary]) => (
          <Polygon
            key={`district-${name}`}
            positions={boundary}
            pathOptions={{
              ...DISTRICT_BOUNDARY_STYLES[name],
              fillOpacity: showTehsils ? 0.05 : 0.12,
            }}
          />
        ))}

      {showTehsils &&
        filteredTehsilGroups.map(([, tehsils]) =>
          Object.entries(tehsils).map(([tehName, boundary]) => {
            if (
              adminScope.accessLevel === "tehsil" &&
              lockedTehsil &&
              tehName !== lockedTehsil
            ) {
              return null;
            }
            const style =
              TEHSIL_BOUNDARY_STYLES[tehName] ?? {
                color: "#475569",
                weight: 1,
                opacity: 0.5,
                fillColor: "#94a3b8",
                fillOpacity: 0.18,
                dashArray: "",
              };
            return (
              <Polygon
                key={`tehsil-${tehName}`}
                positions={boundary}
                pathOptions={style}
              />
            );
          }),
        )}

      {currentZoom >= 12 &&
        filteredDistricts.map(([name, boundary]) => (
          <Polygon
            key={`district-outline-${name}`}
            positions={boundary}
            pathOptions={{
              color: DISTRICT_BOUNDARY_STYLES[name]?.color ?? "#64748b",
              weight: 1.5,
              opacity: 0.3,
              fillColor: "transparent",
              fillOpacity: 0,
              dashArray: "8, 6",
            }}
          />
        ))}

      {currentZoom < 8 &&
        adminScope.accessLevel === "tehsil" &&
        lockedTehsil &&
        TEHSIL_BOUNDARIES[lockedTehsil] && (
          <Polygon
            positions={TEHSIL_BOUNDARIES[lockedTehsil]}
            pathOptions={
              TEHSIL_BOUNDARY_STYLES[lockedTehsil] ?? {
                color: "#475569",
                weight: 1,
                opacity: 0.5,
                fillColor: "#94a3b8",
                fillOpacity: 0.18,
              }
            }
          />
        )}
    </>
  );
}

export default ZoomAwareBoundaries;
