"use client";

import { Archive } from "lucide-react";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { useTranslation } from "@/lib/i18n";

type InventoryItemMobileSelectionToolbarProps = {
  selectedCount: number;
  canEdit: boolean;
  onClear: () => void;
  onEdit?: () => void;
  onDeactivate?: () => void;
};

export function InventoryItemMobileSelectionToolbar({
  selectedCount,
  canEdit,
  onClear,
  onEdit,
  onDeactivate,
}: InventoryItemMobileSelectionToolbarProps) {
  const { t } = useTranslation();
  return (
    <TableSelectionBar
      selectedCount={selectedCount}
      onClear={onClear}
      onEdit={onEdit}
      editDisabled={!canEdit}
      onDelete={onDeactivate}
      deleteLabel={t("inventory.actions.deactivate")}
      deleteIcon={<Archive className="size-4" />}
    />
  );
}
