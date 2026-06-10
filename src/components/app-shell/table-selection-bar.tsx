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
        "flex flex-col gap-3 border-b border-primary/15 bg-primary/5 px-6 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex min-w-[5.5rem] items-center justify-center rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          {selectedIds.length} selected
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onSelectedIdsChange([])}>
          Clear selection
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!othersAvailable}
          onClick={() => onSelectedIdsChange(selectAllOthers(pageRowIds, selectedIds))}
        >
          Select all others
        </Button>
        {showEdit ? (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
        {showDelete ? (
          <Button variant="destructive" size="sm" disabled={deleteDisabled} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete selected
          </Button>
        ) : null}
      </div>
    </div>
  );
}
