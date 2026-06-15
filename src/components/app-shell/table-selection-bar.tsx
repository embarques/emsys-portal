"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { canSelectAllOthers, selectAllOthers } from "@/lib/table/selection";
import { cn } from "@/lib/utils";

type TableSelectionBarProps = {
  selectedIds: string[];
  pageRowIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  deleteDisabled?: boolean;
  className?: string;
};

export function TableSelectionBar({
  selectedIds,
  pageRowIds,
  onSelectedIdsChange,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  deleteDisabled = false,
  className,
}: TableSelectionBarProps) {
  if (selectedIds.length === 0) return null;

  const showEdit = selectedIds.length === 1 && onEdit && canEdit;
  const showDelete = onDelete && canDelete;
  const othersAvailable = canSelectAllOthers(pageRowIds, selectedIds);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-primary/15 bg-primary/[0.04] px-4 py-2 sm:px-6",
        className,
      )}
    >
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
        {selectedIds.length} selected
      </span>

      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <Button variant="ghost" size="sm" onClick={() => onSelectedIdsChange([])}>
          Clear selection
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!othersAvailable}
          onClick={() => onSelectedIdsChange(selectAllOthers(pageRowIds, selectedIds))}
        >
          Select all others
        </Button>
        {showEdit || showDelete ? (
          <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
        ) : null}
        {showEdit ? (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
        {showDelete ? (
          <Button
            variant="outline"
            size="sm"
            disabled={deleteDisabled}
            className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete selected
          </Button>
        ) : null}
      </div>
    </div>
  );
}
