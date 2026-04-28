"use client";

import { AlarmClock } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/cn";
import { tsToDate } from "@/lib/firebase";
import { isOverdue } from "@/lib/derivePriority";

export interface OverdueChipProps {
  createdAt: Timestamp | Date | null | undefined;
  complaintStatus: string | null | undefined;
  hours?: number;
  className?: string;
}

export function OverdueChip({
  createdAt,
  complaintStatus,
  hours = 72,
  className,
}: OverdueChipProps) {
  const date = tsToDate(createdAt as Timestamp | Date | null | undefined);
  if (!isOverdue(date, complaintStatus, hours)) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold",
        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        className
      )}
      title={`Overdue (>${hours}h pending)`}
    >
      <AlarmClock className="h-3 w-3" aria-hidden />
      Overdue
    </span>
  );
}

export default OverdueChip;
