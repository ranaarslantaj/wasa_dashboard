"use client";

import { useToasts } from "@/context/ToastContext";
import { Toast } from "./Toast";

export function ToastHost() {
  const { toasts, dismiss } = useToasts();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

export default ToastHost;
