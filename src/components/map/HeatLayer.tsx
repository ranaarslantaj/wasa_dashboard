"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export interface HeatLayerOptions {
  radius?: number;
  blur?: number;
  maxZoom?: number;
  max?: number;
  minOpacity?: number;
  gradient?: Record<number, string>;
}

export interface HeatLayerProps {
  points: [number, number, number?][];
  options?: HeatLayerOptions;
}

/**
 * Thin React wrapper around leaflet.heat's `L.heatLayer`. Must be rendered
 * inside a `<MapContainer>` so `useMap()` returns the live map instance.
 */
export function HeatLayer({ points, options }: HeatLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const layer = (L as any)
      .heatLayer(points, { radius: 25, blur: 15, maxZoom: 17, ...options })
      .addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, options]);

  return null;
}

export default HeatLayer;
