"use client";

import { X } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Shared styles for the label-row “Clear selection” control used with inline selects. */
export const clearSelectionButtonClassName =
  "flex min-h-9 shrink-0 items-center gap-1 rounded-md px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

type ClearSelectionButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

/** Label-row clear control for inline `SearchableSelect` / option-button fields. */
export function ClearSelectionButton({ onClick, disabled, className }: ClearSelectionButtonProps) {
  const { t } = useTranslation();
  const label = t("common.ui.clearSelection");

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(clearSelectionButtonClassName, className)}
    >
      <X aria-hidden="true" className="size-3" />
      {label}
    </button>
  );
}
