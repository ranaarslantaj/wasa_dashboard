"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastPayload {
  type: ToastType;
  title: string;
  description?: string;
}

export interface ActiveToast extends ToastPayload {
  id: string;
}

export interface ToastContextValue {
  toasts: ActiveToast[];
  show: (t: ToastPayload) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const generateId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const show = useCallback((t: ToastPayload): string => {
    const id = generateId();
    const toast: ActiveToast = { ...t, id };
    setToasts((prev) => [toast, ...prev]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, show, dismiss, clear }),
    [toasts, show, dismiss, clear]
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

export function useToasts(): {
  toasts: ActiveToast[];
  dismiss: (id: string) => void;
} {
  const { toasts, dismiss } = useToast();
  return { toasts, dismiss };
}
