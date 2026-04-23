import { CSSProperties } from "react";
import { cn } from "@/lib/cn";

export interface SkeletonProps {
  className?: string;
  height?: string | number;
  width?: string | number;
  style?: CSSProperties;
}

export function Skeleton({ className, height, width, style }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton", className)}
      style={{ height, width, ...style }}
      aria-hidden
    />
  );
}

export default Skeleton;
