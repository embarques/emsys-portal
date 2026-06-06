"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AccountingEntry } from "@/lib/accounting/types";

type AccountingSectionRowActionsProps = {
  entry: AccountingEntry;
  onEdit?: (entry: AccountingEntry) => void;
  onDelete?: (entry: AccountingEntry) => void;
};

export function AccountingSectionRowActions({
  entry,
  onEdit,
  onDelete,
}: AccountingSectionRowActionsProps) {
  if (!onEdit && !onDelete) return null;

  return (
    <div className="flex justify-end gap-1">
      {onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(entry);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(entry);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
