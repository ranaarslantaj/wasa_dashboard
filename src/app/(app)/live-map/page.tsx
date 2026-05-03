"use client";

import dynamic from "next/dynamic";
import { PageLoader } from "@/components/ui/PageLoader";
import { PageFilterBar } from "@/components/filters/PageFilterBar";

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
    <div className="space-y-3">
      <PageFilterBar compact />
      <LiveMapClient />
    </div>
  );
}
