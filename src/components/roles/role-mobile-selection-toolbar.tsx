"use client";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";

type RoleMobileSelectionToolbarProps = {
  selectedIds: string[];
  pageRowIds: string[];
  totalCount?: number;
  canViewOrEdit: boolean;
  deleteDisabled?: boolean;
  onSelectedIdsChange: (ids: string[]) => void;
  onView: () => void;
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
  onView,
  onEdit,
  onDelete,
}: RoleMobileSelectionToolbarProps) {
  return (
    <TableSelectionToolbar
      selectedIds={selectedIds}
      pageRowIds={pageRowIds}
      totalCount={totalCount}
      onSelectedIdsChange={onSelectedIdsChange}
      onView={onView}
      onEdit={onEdit}
      viewDisabled={!canViewOrEdit}
      editDisabled={!canViewOrEdit}
      onDelete={onDelete}
      deleteDisabled={deleteDisabled}
    />
  );
}
