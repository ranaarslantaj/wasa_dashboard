"use client";

import dynamic from "next/dynamic";
import { PageLoader } from "@/components/ui/PageLoader";

// Leaflet touches `window` at import time — load the map client-only.
const LiveMapClient = dynamic(
  () => import("@/components/map/LiveMapClient").then((m) => m.LiveMapClient),
  {
    ssr: false,
    loading: () => <PageLoader fullScreen={false} label="Loading map..." />,
  }
);

export default function LiveMapPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Live Map</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Geographic view of complaints with filters and heatmap. Defaults to
          the last 7 days.
        </p>
      </header>
      <LiveMapClient />
    </div>
  );
}
