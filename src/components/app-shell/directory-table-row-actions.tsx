"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

type DirectoryTableRowActionsProps<T> = {
  row: T;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  editDisabled?: boolean;
  deleteDisabled?: boolean;
};

export function DirectoryTableRowActions<T>({
  row,
  onEdit,
  onDelete,
  editDisabled = false,
  deleteDisabled = false,
}: DirectoryTableRowActionsProps<T>) {
  const { t } = useTranslation();

  if (!onEdit && !onDelete) return null;

  return (
    <div className="flex items-center gap-0.5">
      {onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          disabled={editDisabled}
          aria-label={t("common.actions.edit")}
          title={t("common.actions.edit")}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(row);
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={deleteDisabled}
          aria-label={t("common.actions.delete")}
          title={t("common.actions.delete")}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(row);
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
