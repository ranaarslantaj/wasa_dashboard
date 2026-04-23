"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { NAV_ITEMS } from "@/constants/navigation";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/cn";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

export interface HeaderProps {
  onMenuClick: () => void;
}

const ACCESS_LABEL: Record<string, string> = {
  province: "Province Admin",
  division: "Division Admin",
  district: "District Admin",
  tehsil: "Tehsil Admin",
};

function getPageTitle(pathname: string): string {
  if (!pathname) return "Dashboard";
  const match = NAV_ITEMS.find(
    (item) =>
      pathname === item.path || pathname.startsWith(item.path + "/")
  );
  return match?.label ?? "Dashboard";
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname() ?? "";
  const { admin, adminScope, hasFullAccess } = useAuth();

  const title = useMemo(() => getPageTitle(pathname), [pathname]);

  const accessLevelLabel = hasFullAccess
    ? "Super Admin"
    : adminScope
    ? ACCESS_LABEL[adminScope.accessLevel] ?? "Admin"
    : "Admin";

  const scopeLocation = adminScope
    ? adminScope.tehsil ||
      adminScope.district ||
      adminScope.division ||
      adminScope.province
    : null;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:h-16 md:px-6",
        "dark:border-slate-800 dark:bg-slate-900"
      )}
    >
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100",
          "dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
        )}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100 md:text-lg">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />

        {admin && (
          <div
            className={cn(
              "flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700",
              "dark:bg-slate-800 dark:text-slate-200"
            )}
          >
            <span className="max-w-[10rem] truncate font-medium">
              {admin.name}
            </span>
            <span className="hidden sm:inline">
              <span className="mx-1.5 text-slate-400 dark:text-slate-500">
                &middot;
              </span>
              <span>{accessLevelLabel}</span>
              {scopeLocation && (
                <>
                  <span className="mx-1.5 text-slate-400 dark:text-slate-500">
                    &middot;
                  </span>
                  <span className="max-w-[8rem] truncate">{scopeLocation}</span>
                </>
              )}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
