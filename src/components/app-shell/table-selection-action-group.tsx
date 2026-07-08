"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type TableSelectionActionGroupProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/** Segmented control wrapper for related bulk-selection toolbar actions. */
export function TableSelectionActionGroup({
  children,
  className,
  "aria-label": ariaLabel,
}: TableSelectionActionGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-md border border-border bg-background shadow-xs",
        "[&>button]:rounded-none [&>button]:border-0 [&>button]:shadow-none",
        "[&>button:not(:last-child)]:border-r [&>button:not(:last-child)]:border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TableSelectionActionDivider() {
  return <span className="mx-1 hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden />;
}
