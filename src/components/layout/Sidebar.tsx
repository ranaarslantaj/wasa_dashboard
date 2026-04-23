"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Droplets, LogOut, X } from "lucide-react";
import { NAV_ITEMS } from "@/constants/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { admin, hasFullAccess, logout } = useAuth();

  const items = NAV_ITEMS.filter(
    (item) => !item.superAdminOnly || hasFullAccess
  );

  const isActive = (path: string): boolean =>
    pathname === path || pathname.startsWith(path + "/");

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  };

  const handleNavClick = () => {
    if (open) onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out",
          "dark:border-slate-800 dark:bg-slate-900",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Droplets className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                WASA
              </div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                Admin Panel
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-600/10 dark:text-brand-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User card */}
        {admin && (
          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {admin.name}
              </div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                {admin.email}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              leftIcon={<LogOut className="h-4 w-4" aria-hidden />}
              className="w-full justify-start"
            >
              Sign out
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}

export default Sidebar;
