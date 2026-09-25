"use client";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";

type RoleMobileSelectionToolbarProps = {
  selectedCount: number;
  canViewOrEdit: boolean;
  deleteDisabled?: boolean;
  onClear: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function RoleMobileSelectionToolbar({
  selectedCount,
  canViewOrEdit,
  deleteDisabled = false,
  onClear,
  onView,
  onEdit,
  onDelete,
}: RoleMobileSelectionToolbarProps) {
  return (
    <TableSelectionBar
      selectedCount={selectedCount}
      onClear={onClear}
      onView={onView}
      onEdit={onEdit}
      viewDisabled={!canViewOrEdit}
      editDisabled={!canViewOrEdit}
      onDelete={onDelete}
      deleteDisabled={deleteDisabled}
    />
  );
}
