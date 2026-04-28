"use client";

import { useState } from "react";
import { UserMinus2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface UnassignButtonProps {
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function UnassignButton({
  onConfirm,
  loading = false,
  size = "sm",
  className,
}: UnassignButtonProps) {
  const [confirming, setConfirming] = useState<boolean>(false);

  const handleConfirm = async (): Promise<void> => {
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size={size}
        disabled={loading}
        onClick={() => setConfirming(true)}
        leftIcon={<UserMinus2 className="h-4 w-4" />}
        className={className ? `${className} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20` : "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"}
      >
        Unassign
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1 dark:border-red-800 dark:bg-red-900/20">
      <span className="text-xs font-medium text-red-800 dark:text-red-200">
        Are you sure?
      </span>
      <Button
        variant="destructive"
        size="sm"
        loading={loading}
        onClick={handleConfirm}
      >
        Confirm
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={loading}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </span>
  );
}

export default UnassignButton;
