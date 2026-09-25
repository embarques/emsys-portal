"use client";

import { ListChecks } from "lucide-react";

import { TableSelectionBar, type TableSelectionBarProps } from "@/components/app-shell/table-selection-bar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { canSelectAllOthers, selectAllOthers } from "@/lib/table/selection";

type TableSelectionToolbarProps = Omit<TableSelectionBarProps, "selectedCount" | "onClear" | "selectionActions"> & {
  selectedIds: string[];
  pageRowIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
};

export function TableSelectionToolbar({
  selectedIds,
  pageRowIds,
  onSelectedIdsChange,
  totalCount,
  ...props
}: TableSelectionToolbarProps) {
  const { t } = useTranslation();

  return (
    <TableSelectionBar
      {...props}
      selectedCount={selectedIds.length}
      totalCount={totalCount ?? pageRowIds.length}
      onClear={() => onSelectedIdsChange([])}
      selectionActions={
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          disabled={!canSelectAllOthers(pageRowIds, selectedIds)}
          onClick={() => onSelectedIdsChange(selectAllOthers(pageRowIds, selectedIds))}
        >
          <ListChecks className="h-4 w-4" />
          <span className="whitespace-nowrap">{t("common.table.selectAllOthers")}</span>
        </Button>
      }
    />
  );
}
