"use client";

import { type ComponentType, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
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
        // Match sibling `size="sm"` outline buttons (h-8) including the group border.
        "inline-flex h-8 items-stretch overflow-hidden rounded-md border border-border bg-background shadow-xs",
        "[&>button]:h-full [&>button]:min-h-0 [&>button]:rounded-none [&>button]:border-0 [&>button]:shadow-none",
        "[&>button:not(:last-child)]:border-r [&>button:not(:last-child)]:border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TableSelectionActionDivider() {
  return <span className="mx-1 hidden h-8 w-px shrink-0 bg-border sm:block" aria-hidden />;
}

type TableSelectionExpandableActionGroupProps = {
  /** Label shown on the always-visible toggle button. */
  label: string;
  /** Optional leading icon for the toggle button. */
  icon?: ComponentType<{ className?: string }>;
  /** Whether the related actions are revealed. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Disables the toggle button only. */
  disabled?: boolean;
  /** Match sibling action height; default stays compact for table toolbars. */
  size?: "default" | "sm";
  /** Stretch to the parent width (view-sheet footers). Default stays content-sized for toolbars. */
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/**
 * Segmented control that hides its related actions behind a toggle and
 * expands/collapses them horizontally, mirroring the vertical address pill.
 */
export function TableSelectionExpandableActionGroup({
  label,
  icon: Icon,
  expanded,
  onExpandedChange,
  disabled,
  size = "sm",
  fullWidth = false,
  children,
  className,
  "aria-label": ariaLabel,
}: TableSelectionExpandableActionGroupProps) {
  const heightClass = size === "sm" ? "h-8" : "h-9";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        // Match sibling outline buttons of the same size, including the group border.
        "inline-flex items-stretch overflow-hidden rounded-md border border-border bg-background shadow-xs",
        heightClass,
        fullWidth && "flex w-full min-w-0",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size={size}
        disabled={disabled}
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
        className={cn(
          "h-full min-h-0 rounded-none border-0 shadow-none",
          fullWidth && "min-w-0 flex-1 justify-start",
        )}
      >
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {label}
        <ChevronRight
          className={cn("h-4 w-4 transition-transform duration-200 ease-out", expanded && "rotate-180")}
          aria-hidden
        />
      </Button>
      <div
        className={cn(
          "grid transition-[grid-template-columns] duration-200 ease-out",
          expanded ? "grid-cols-[1fr]" : "grid-cols-[0fr]",
        )}
      >
        <div className="overflow-hidden" inert={!expanded ? true : undefined}>
          <div
            className={cn(
              "flex h-full items-stretch border-l border-border",
              "[&>button]:h-full [&>button]:min-h-0 [&>button]:rounded-none [&>button]:border-0 [&>button]:whitespace-nowrap [&>button]:shadow-none",
              "[&>button:not(:last-child)]:border-r [&>button:not(:last-child)]:border-border",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
