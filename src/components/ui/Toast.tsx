"use client";

import { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

export interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const iconMap: Record<ToastType, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const borderMap: Record<ToastType, string> = {
  success: "border-l-green-500",
  error: "border-l-red-500",
  info: "border-l-brand-500",
  warning: "border-l-amber-500",
};

const iconColorMap: Record<ToastType, string> = {
  success: "text-green-500",
  error: "text-red-500",
  info: "text-brand-500",
  warning: "text-amber-500",
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = iconMap[toast.type];

  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        "min-w-[280px] max-w-sm rounded-xl border border-slate-200 border-l-4 bg-white p-3 shadow-card animate-slide-up",
        "dark:border-slate-800 dark:bg-slate-900",
        borderMap[toast.type]
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", iconColorMap[toast.type])}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {toast.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default Toast;
