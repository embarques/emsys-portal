"use client";

import { cn } from "@/lib/utils";

/**
 * Shared chrome for secondary/embedded tables (history, results, view sheets,
 * form panels). Do not use on route directory DataTables.
 */

export const compactTableClassName =
  "w-max min-w-full border-separate border-spacing-0 text-left text-xs";

export const compactTableHeadRowClassName =
  "border-b bg-muted/40 text-muted-foreground";

export const compactTableHeadClassName =
  "sticky top-0 z-[1] whitespace-nowrap border-b border-border bg-muted px-2 py-1.5 text-left font-medium";

export const compactTableCellClassName =
  "whitespace-nowrap px-2 py-1 text-foreground";

export const compactTableCellWrapClassName =
  "min-w-[10rem] px-2 py-1 leading-snug text-foreground [overflow-wrap:anywhere]";

export const compactTableRowClassName =
  "border-b last:border-b-0 even:bg-muted/25";

export const compactTableShellClassName =
  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card";

export const compactTableCaptionClassName =
  "shrink-0 border-t border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground";

type CompactTableScrollProps = {
  children: React.ReactNode;
  className?: string;
  /** Accessible name when no visible caption is linked. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/** Keyboard-focusable overflow region for compact secondary tables. */
export function CompactTableScroll({
  children,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: CompactTableScrollProps) {
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn("min-h-0 overflow-auto", className)}
    >
      {children}
    </div>
  );
}
