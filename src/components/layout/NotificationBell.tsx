"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNotificationsOptional } from "@/context/NotificationContext";
import { NotificationDropdown } from "./NotificationDropdown";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const ctx = useNotificationsOptional();
  const unreadCount = ctx?.unreadCount ?? 0;
  const hasContext = ctx !== null;

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const display = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg",
          "bg-slate-100 text-slate-700 hover:bg-slate-200",
          "dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
          "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        )}
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white",
              "h-[18px]"
            )}
          >
            {display}
          </span>
        )}
      </button>
      {hasContext && (
        <NotificationDropdown open={open} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

export default NotificationBell;
