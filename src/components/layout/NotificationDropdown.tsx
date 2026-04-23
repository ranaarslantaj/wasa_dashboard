"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/lib/formatters";
import { Button } from "@/components/ui";
import { useNotifications } from "@/context/NotificationContext";
import type { AppNotification } from "@/types";

export interface NotificationDropdownProps {
  open: boolean;
  onClose: () => void;
}

const priorityDotClass = (priority: unknown): string => {
  switch (priority) {
    case "critical":
      return "bg-red-600";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-amber-500";
    case "low":
      return "bg-emerald-500";
    default:
      return "bg-slate-400";
  }
};

const metaLine = (notif: AppNotification): string => {
  const data = notif.data ?? {};
  const district =
    typeof data.district === "string" && data.district.length > 0
      ? data.district
      : null;
  const tehsil =
    typeof data.tehsil === "string" && data.tehsil.length > 0
      ? data.tehsil
      : null;
  const parts = [district, tehsil].filter((v): v is string => Boolean(v));
  return parts.join(" · ");
};

export function NotificationDropdown({
  open,
  onClose,
}: NotificationDropdownProps) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    mute,
    setMute,
  } = useNotifications();

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleRowClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.complaintId) {
      router.push(`/complaints?complaintId=${notif.complaintId}`);
    }
    onClose();
  };

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Notifications"
      className={cn(
        "absolute right-0 top-full z-40 mt-2 w-80 sm:w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card",
        "dark:border-slate-800 dark:bg-slate-900 animate-fade-in"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Notifications
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            leftIcon={<CheckCheck className="h-3.5 w-3.5" aria-hidden />}
          >
            Mark all as read
          </Button>
          <button
            type="button"
            onClick={() => setMute(!mute)}
            aria-label={mute ? "Unmute notifications" : "Mute notifications"}
            aria-pressed={mute}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg",
              "text-slate-600 hover:bg-slate-100",
              "dark:text-slate-300 dark:hover:bg-slate-800",
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            )}
          >
            {mute ? (
              <BellOff className="h-4 w-4" aria-hidden />
            ) : (
              <Bell className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Bell
                className="h-5 w-5 text-slate-400 dark:text-slate-500"
                aria-hidden
              />
            </div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
              No new notifications
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              You&apos;re all caught up.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map((notif) => {
              const meta = metaLine(notif);
              return (
                <li key={notif.id}>
                  <button
                    type="button"
                    onClick={() => handleRowClick(notif)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                      "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                      !notif.read &&
                        "border-l-2 border-brand-500 bg-brand-50 dark:bg-brand-600/10"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full",
                        priorityDotClass(notif.data?.priority)
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {notif.title}
                        </div>
                        <div className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                          {formatTimeAgo(notif.createdAt)}
                        </div>
                      </div>
                      {meta && (
                        <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {meta}
                        </div>
                      )}
                      <div className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                        {notif.message}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-end border-t border-slate-200 px-2 py-1.5 dark:border-slate-800">
          <button
            type="button"
            onClick={clearAll}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              "text-red-600 hover:bg-red-50",
              "dark:text-red-400 dark:hover:bg-red-500/10"
            )}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
