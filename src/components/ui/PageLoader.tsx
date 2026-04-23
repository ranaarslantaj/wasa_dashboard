"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PageLoaderProps {
  label?: string;
  fullScreen?: boolean;
  className?: string;
}

export function PageLoader({
  label,
  fullScreen = true,
  className,
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400",
        fullScreen ? "min-h-screen" : "py-16",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden />
      {label && <p className="text-sm font-medium">{label}</p>}
    </div>
  );
}

export default PageLoader;
