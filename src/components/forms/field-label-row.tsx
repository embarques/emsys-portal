"use client";

import type { ReactNode } from "react";

import { ClearSelectionButton } from "@/components/forms/clear-selection-button";
import { cn } from "@/lib/utils";

type FieldLabelRowProps = {
  children: ReactNode;
  /** When true, renders the shared “Clear selection” control on the right. */
  showClear?: boolean;
  onClear?: () => void;
  clearDisabled?: boolean;
  /** Extra actions on the right (e.g. New / Edit), after clear when both are present. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Standard field title row: label on the left, optional clear + actions on the right.
 * Matches the inline-select “Clear selection” placement used across accounting forms.
 */
export function FieldLabelRow({
  children,
  showClear = false,
  onClear,
  clearDisabled,
  actions,
  className,
}: FieldLabelRowProps) {
  return (
    <div className={cn("flex min-h-9 items-center justify-between gap-2", className)}>
      <div className="min-w-0">{children}</div>
      {showClear || actions ? (
        <div className="flex shrink-0 items-center gap-1">
          {showClear && onClear ? (
            <ClearSelectionButton onClick={onClear} disabled={clearDisabled} />
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
