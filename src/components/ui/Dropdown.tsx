"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  locked?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

const selectBase =
  "block w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed";

export function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  locked,
  className,
  id,
  name,
}: DropdownProps) {
  const isDisabled = disabled || locked;
  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        disabled={isDisabled}
        title={locked ? "Locked by your access scope" : undefined}
        className={cn(selectBase, locked && "pr-9", className)}
      >
        {placeholder && (
          <option value="" disabled={!value}>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {locked && (
        <Lock
          className="pointer-events-none absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      )}
    </div>
  );
}

export interface MultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelect({
  value,
  onChange,
  options,
  placeholder = "Select options",
  disabled,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = useMemo(() => {
    if (!value.length) return placeholder;
    return `${value.length} selected`;
  }, [value, placeholder]);

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
          "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
          "disabled:opacity-60 disabled:cursor-not-allowed"
        )}
      >
        <span className={cn(!value.length && "text-slate-400")}>{label}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {options.map((o) => {
            const checked = value.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                disabled={o.disabled}
                onClick={() => toggle(o.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                  o.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border",
                    checked
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-300 dark:border-slate-600"
                  )}
                >
                  {checked && <Check className="h-3 w-3" aria-hidden />}
                </span>
                <span>{o.label}</span>
              </button>
            );
          })}
          {!options.length && (
            <p className="px-2 py-1.5 text-sm text-slate-500">No options</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Dropdown;
