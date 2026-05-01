"use client";

import { Flame, Layers, Map as MapIcon } from "lucide-react";
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
  boundariesEnabled?: boolean;
  onBoundariesToggle?: () => void;
  /** When true, render as a row above the map. Default rendering is the same. */
  className?: string;
}

/**
 * Horizontal layer-toggle bar. Rendered inline (above the map) — not floating
 * over it. Each layer is a clickable chip that lights up when active.
 */
export function MapLayerToggle({
  layers,
  onToggle,
  heatmapEnabled,
  onHeatmapToggle,
  boundariesEnabled,
  onBoundariesToggle,
  className,
}: MapLayerToggleProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-3 shadow-card",
        "dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Layers
        </div>

        {layers.map((layer) => (
          <Chip
            key={layer.id}
            active={layer.enabled}
            onClick={() => onToggle(layer.id)}
            color={layer.color}
            label={layer.label}
            count={layer.count}
          />
        ))}

        <div className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:inline-block" />

        <Chip
          active={heatmapEnabled}
          onClick={onHeatmapToggle}
          icon={<Flame className="h-3.5 w-3.5" aria-hidden />}
          label="Heatmap"
        />

        {onBoundariesToggle && (
          <Chip
            active={!!boundariesEnabled}
            onClick={onBoundariesToggle}
            icon={<MapIcon className="h-3.5 w-3.5" aria-hidden />}
            label="Boundaries"
          />
        )}
      </div>
    </div>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  count?: number;
  icon?: React.ReactNode;
}

function Chip({ active, onClick, label, color, count, icon }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-200"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
      )}
    >
      {color !== undefined && (
        <span
          className={cn(
            "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
            !active && "opacity-60",
          )}
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px] font-semibold",
            active
              ? "bg-brand-600/10 text-brand-700 dark:bg-brand-400/20 dark:text-brand-100"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export default MapLayerToggle;
