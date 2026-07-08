"use client";

import { type ReactNode } from "react";
import { ListChecks, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableSelectionActionDivider } from "@/components/app-shell/table-selection-action-group";
import { useTranslation } from "@/lib/i18n";
import { canSelectAllOthers, selectAllOthers } from "@/lib/table/selection";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

type TableSelectionToolbarProps = {
  selectedIds: string[];
  pageRowIds: string[];
  /** Total selectable records (across pages). Falls back to the current page count. */
  totalCount?: number;
  onSelectedIdsChange: (ids: string[]) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Feature-specific bulk actions rendered between Edit and Delete. */
  actions?: ReactNode;
  canEdit?: boolean;
  canDelete?: boolean;
  deleteDisabled?: boolean;
  className?: string;
};

/**
 * Selection action bar that sticks to the top of the viewport (just below the
 * app topbar) while rows are selected and the table scrolls underneath.
 *
 * Grouped by purpose:
 *  - Left "selection island": what's selected + how to manage the selection.
 *  - Right "record actions": operations performed on the selected records,
 *    with the destructive action split off on its own.
 */
export function TableSelectionToolbar({
  selectedIds,
  pageRowIds,
  totalCount,
  onSelectedIdsChange,
  onEdit,
  onDelete,
  actions,
  canEdit = true,
  canDelete = true,
  deleteDisabled = false,
  className,
}: TableSelectionToolbarProps) {
  const { t } = useTranslation();

  if (selectedIds.length === 0) return null;

  const total = totalCount ?? pageRowIds.length;

  const showEdit = Boolean(onEdit && canEdit);
  const editDisabled = selectedIds.length !== 1;
  const showDelete = Boolean(onDelete && canDelete);
  const othersAvailable = canSelectAllOthers(pageRowIds, selectedIds);
  const hasRecordActions = Boolean(showEdit || actions || showDelete);

  return (
    <div
      role="toolbar"
      aria-label={`${selectedIds.length} selected`}
      className={cn(
        "sticky top-20 z-30 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-primary/[0.06] px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-primary/[0.05] sm:px-6",
        "animate-in fade-in slide-in-from-top-2 duration-200",
        className,
      )}
    >
      {/* Selection status + selection management */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          aria-label={t("common.table.clearSelection")}
          title={t("common.table.clearSelection")}
          onClick={() => onSelectedIdsChange([])}
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
          {t("common.table.selected", { count: selectedIds.length, total })}
        </span>
        <span className="mx-1 h-5 w-px bg-primary/20" aria-hidden />
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          disabled={!othersAvailable}
          onClick={() => onSelectedIdsChange(selectAllOthers(pageRowIds, selectedIds))}
        >
          <ListChecks className="h-4 w-4" />
          <span className="whitespace-nowrap">{t("common.table.selectAllOthers")}</span>
        </Button>
      </div>

      {/* Record actions: operate on the selected rows */}
      {hasRecordActions ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
          {actions && (showEdit || showDelete) ? <TableSelectionActionDivider /> : null}
          {showEdit ? (
            <Button
              variant="outline"
              size="sm"
              disabled={editDisabled}
              className={cn("whitespace-nowrap", tableSelectionActionStyles.edit)}
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
              {t("common.actions.edit")}
            </Button>
          ) : null}
          {showDelete ? (
            <Button
              variant="outline"
              size="sm"
              disabled={deleteDisabled}
              className={cn("whitespace-nowrap", tableSelectionActionStyles.delete)}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              {t("common.actions.delete")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
