"use client";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";

type InventoryItemMobileSelectionToolbarProps = {
  selectedCount: number;
  canEdit: boolean;
  onClear: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function InventoryItemMobileSelectionToolbar({
  selectedCount,
  canEdit,
  onClear,
  onEdit,
  onDelete,
}: InventoryItemMobileSelectionToolbarProps) {
  return (
    <TableSelectionBar
      selectedCount={selectedCount}
      onClear={onClear}
      onEdit={onEdit}
      editDisabled={!canEdit}
      onDelete={onDelete}
    />
  );
}
