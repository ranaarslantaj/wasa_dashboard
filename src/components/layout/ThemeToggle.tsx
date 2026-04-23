"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, SunMedium } from "lucide-react";
import { cn } from "@/lib/cn";

type ThemeValue = "system" | "light" | "dark";

const ORDER: ThemeValue[] = ["system", "light", "dark"];

const NEXT_LABEL: Record<ThemeValue, string> = {
  system: "Switch to light theme",
  light: "Switch to dark theme",
  dark: "Switch to system theme",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800"
      />
    );
  }

  const current: ThemeValue =
    theme === "light" || theme === "dark" ? theme : "system";

  const handleClick = () => {
    const idx = ORDER.indexOf(current);
    const next = ORDER[(idx + 1) % ORDER.length];
    setTheme(next);
  };

  const Icon =
    current === "light" ? SunMedium : current === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={NEXT_LABEL[current]}
      aria-label={NEXT_LABEL[current]}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg",
        "bg-slate-100 text-slate-700 hover:bg-slate-200",
        "dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
        "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}

export default ThemeToggle;
