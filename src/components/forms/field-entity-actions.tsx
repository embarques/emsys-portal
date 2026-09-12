"use client";

import type { LucideIcon } from "lucide-react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Shared class for label-row create/edit actions (appointments Sender/Receiver style). */
export const fieldEntityActionClassName =
  "h-7 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground";

type FieldEntityActionsProps = {
  onAdd: () => void;
  /** When set with hasSelection, shows Pencil + Edit. */
  onEdit?: () => void;
  hasSelection?: boolean;
  /**
   * When provided, render `icon + New` (appointment pattern).
   * When omitted, render `addLabel` (e.g. "Add item") with the same text styling.
   */
  addIcon?: LucideIcon;
  /** Required when `addIcon` is omitted. Ignored when `addIcon` is set. */
  addLabel?: string;
  newLabel?: string;
  editLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function FieldEntityActions({
  onAdd,
  onEdit,
  hasSelection = false,
  addIcon: AddIcon,
  addLabel,
  newLabel,
  editLabel,
  disabled = false,
  className,
}: FieldEntityActionsProps) {
  const { t } = useTranslation();
  const resolvedNewLabel = newLabel ?? t("common.form.fieldActions.new");
  const resolvedEditLabel = editLabel ?? t("common.form.fieldActions.edit");
  const addText = AddIcon ? resolvedNewLabel : (addLabel ?? resolvedNewLabel);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={fieldEntityActionClassName}
        onClick={onAdd}
        disabled={disabled}
      >
        {AddIcon ? <AddIcon className="size-3.5" /> : null}
        {addText}
      </Button>
      {hasSelection && onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={fieldEntityActionClassName}
          onClick={onEdit}
          disabled={disabled}
        >
          <Pencil className="size-3.5" />
          {resolvedEditLabel}
        </Button>
      ) : null}
    </div>
  );
}
