"use client";

import { Archive } from "lucide-react";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useTranslation } from "@/lib/i18n";

type InventoryItemMobileSelectionToolbarProps = {
  selectedIds: string[];
  pageRowIds: string[];
  totalCount?: number;
  canEdit: boolean;
  onSelectedIdsChange: (ids: string[]) => void;
  onEdit?: () => void;
  onDeactivate?: () => void;
};

export function InventoryItemMobileSelectionToolbar({
  selectedIds,
  pageRowIds,
  totalCount,
  canEdit,
  onSelectedIdsChange,
  onEdit,
  onDeactivate,
}: InventoryItemMobileSelectionToolbarProps) {
  const { t } = useTranslation();
  return (
    <TableSelectionToolbar
      selectedIds={selectedIds}
      pageRowIds={pageRowIds}
      totalCount={totalCount}
      onSelectedIdsChange={onSelectedIdsChange}
      onEdit={onEdit}
      editDisabled={!canEdit}
      onDelete={onDeactivate}
      deleteLabel={t("inventory.actions.deactivate")}
      deleteIcon={<Archive className="size-4" />}
    />
  );
}
