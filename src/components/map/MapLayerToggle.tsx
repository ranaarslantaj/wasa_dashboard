"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Flame, Layers } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MapLayerDescriptor {
  id: string;
  label: string;
  count: number;
  color: string;
  enabled: boolean;
}

export interface MapLayerToggleProps {
  layers: MapLayerDescriptor[];
  onToggle: (id: string) => void;
  heatmapEnabled: boolean;
  onHeatmapToggle: () => void;
}

export function MapLayerToggle({
  layers,
  onToggle,
  heatmapEnabled,
  onHeatmapToggle,
}: MapLayerToggleProps) {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  return (
    <div
      className={cn(
        "absolute top-4 left-4 z-[1000] w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg",
        "dark:border-slate-800 dark:bg-slate-900",
        collapsed && "w-auto"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Layers className="h-4 w-4" aria-hidden />
          {!collapsed && <span>Layers</span>}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label={collapsed ? "Expand layer panel" : "Collapse layer panel"}
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronUp className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-3 space-y-1.5">
          {layers.map((layer) => (
            <label
              key={layer.id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                "hover:bg-slate-50 dark:hover:bg-slate-800/60"
              )}
            >
              <input
                type="checkbox"
                checked={layer.enabled}
                onChange={() => onToggle(layer.id)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
              />
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: layer.color }}
                aria-hidden
              />
              <span className="flex-1 truncate text-slate-800 dark:text-slate-200">
                {layer.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {layer.count}
              </span>
            </label>
          ))}

          <div className="my-2 border-t border-slate-200 dark:border-slate-800" />

          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
              "hover:bg-slate-50 dark:hover:bg-slate-800/60"
            )}
          >
            <input
              type="checkbox"
              checked={heatmapEnabled}
              onChange={onHeatmapToggle}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <Flame
              className="h-4 w-4 text-orange-500"
              aria-hidden
            />
            <span className="flex-1 text-slate-800 dark:text-slate-200">
              Heatmap
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

export default MapLayerToggle;
