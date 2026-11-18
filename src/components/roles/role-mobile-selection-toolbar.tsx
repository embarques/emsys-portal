"use client";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";

type RoleMobileSelectionToolbarProps = {
  selectedIds: string[];
  pageRowIds: string[];
  totalCount?: number;
  canViewOrEdit: boolean;
  deleteDisabled?: boolean;
  onSelectedIdsChange: (ids: string[]) => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function RoleMobileSelectionToolbar({
  selectedIds,
  pageRowIds,
  totalCount,
  canViewOrEdit,
  deleteDisabled = false,
  onSelectedIdsChange,
  onEdit,
  onDelete,
}: RoleMobileSelectionToolbarProps) {
  return (
    <TableSelectionToolbar
      selectedIds={selectedIds}
      pageRowIds={pageRowIds}
      totalCount={totalCount}
      onSelectedIdsChange={onSelectedIdsChange}
      onEdit={onEdit}
      editDisabled={!canViewOrEdit}
      onDelete={onDelete}
      deleteDisabled={deleteDisabled}
    />
  );
}
