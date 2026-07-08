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
  children,
  className,
  "aria-label": ariaLabel,
}: TableSelectionExpandableActionGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-md border border-border bg-background shadow-xs",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
        className="rounded-none border-0 shadow-none"
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
              "[&>button]:rounded-none [&>button]:border-0 [&>button]:whitespace-nowrap [&>button]:shadow-none",
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
