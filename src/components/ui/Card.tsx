import { createElement, HTMLAttributes, ReactNode, JSX } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: keyof JSX.IntrinsicElements;
  children?: ReactNode;
}

export function Card({
  as = "div",
  className,
  children,
  ...rest
}: CardProps) {
  return createElement(
    as,
    {
      className: cn(
        "rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900",
        className
      ),
      ...rest,
    },
    children
  );
}

export function CardHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 pt-5 pb-3", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold text-slate-900 dark:text-slate-100",
        className
      )}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "mt-1 text-sm text-slate-500 dark:text-slate-400",
        className
      )}
      {...rest}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-slate-200 dark:border-slate-800",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
