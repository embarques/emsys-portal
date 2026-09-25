"use client";

import { type ReactNode } from "react";
import { Eye, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableSelectionActionDivider } from "@/components/app-shell/table-selection-action-group";
import { useTranslation } from "@/lib/i18n";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

export type TableSelectionBarProps = {
  selectedCount: number;
  onClear: () => void;
  selectionActions?: ReactNode;
  /** Total selectable records (across pages). Falls back to the selected count. */
  totalCount?: number;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Feature-specific bulk actions rendered before View/Edit/Delete. */
  actions?: ReactNode;
  /**
   * Hide View/Edit/Delete. Prefer hiding only actions to the left of an
   * expanded group so View/Edit/Delete (to the right) stay available.
   */
  hideStandardActions?: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  viewDisabled?: boolean;
  editDisabled?: boolean;
  deleteDisabled?: boolean;
  deleteLabel?: string;
  deleteIcon?: ReactNode;
  className?: string;
};

/**
 * Selection action bar that sticks to the top of the viewport (just below the
 * app topbar) while rows are selected and the table scrolls underneath.
 *
 * Grouped by purpose:
 *  - Left "selection island": what's selected + how to manage the selection.
 *  - Right "record actions": operations performed on the selected records,
 *    with View/Edit/Delete kept together in a stable order.
 */
export function TableSelectionBar({
  selectedCount,
  onClear,
  selectionActions,
  totalCount,
  onView,
  onEdit,
  onDelete,
  actions,
  hideStandardActions = false,
  canView = true,
  canEdit = true,
  canDelete = true,
  viewDisabled = false,
  editDisabled = false,
  deleteDisabled = false,
  deleteLabel,
  deleteIcon,
  className,
}: TableSelectionBarProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  const total = totalCount ?? selectedCount;

  const showView = Boolean(onView && canView && !hideStandardActions);
  const showEdit = Boolean(onEdit && canEdit && !hideStandardActions);
  const showDelete = Boolean(onDelete && canDelete && !hideStandardActions);
  const hasRecordActions = Boolean(showView || showEdit || actions || showDelete);

  return (
    <div
      role="toolbar"
      aria-label={t("common.table.selectionActionsGroup")}
      className={cn(
        "sticky top-20 z-30 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-primary/[0.06] px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-primary/[0.05] sm:px-6",
        "animate-in fade-in slide-in-from-top-2 duration-200",
        className,
      )}
    >
      {/* Selection status + selection management */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          aria-label={t("common.table.clearSelection")}
          title={t("common.table.clearSelection")}
          onClick={onClear}
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
          {t("common.table.selected", { count: selectedCount, total })}
        </span>
        {selectionActions ? (
          <>
            <span className="mx-1 h-5 w-px bg-primary/20" aria-hidden />
            {selectionActions}
          </>
        ) : null}
      </div>

      {/* Record actions: operate on the selected rows */}
      {hasRecordActions ? (
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {actions ? <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">{actions}</div> : null}
          {actions && (showView || showEdit || showDelete) ? <TableSelectionActionDivider /> : null}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {showView ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedCount !== 1 || viewDisabled}
                className={cn("whitespace-nowrap", tableSelectionActionStyles.view)}
                onClick={onView}
              >
                <Eye className="h-4 w-4" />
                {t("common.actions.view")}
              </Button>
            ) : null}
            {showEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedCount !== 1 || editDisabled}
                className={cn("whitespace-nowrap", tableSelectionActionStyles.edit)}
                onClick={onEdit}
              >
                <Pencil className="h-4 w-4" />
                {t("common.actions.edit")}
              </Button>
            ) : null}
            {showDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deleteDisabled}
                className={cn("whitespace-nowrap", tableSelectionActionStyles.delete)}
                onClick={onDelete}
              >
                {deleteIcon ?? <Trash2 className="h-4 w-4" />}
                {deleteLabel ?? t("common.actions.delete")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
