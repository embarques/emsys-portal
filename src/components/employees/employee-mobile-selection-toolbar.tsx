"use client";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import type { Employee } from "@/lib/employees/types";

type EmployeeMobileSelectionToolbarProps = {
  selectedIds: string[];
  pageRowIds: string[];
  totalCount: number;
  singleSelectedEmployee?: Employee;
  isSaving: boolean;
  onSelectedIdsChange: (ids: string[]) => void;
  onEdit: (employee: Employee) => void;
  onDeleteSelected: () => void;
};

export function EmployeeMobileSelectionToolbar({
  selectedIds,
  pageRowIds,
  totalCount,
  singleSelectedEmployee,
  isSaving,
  onSelectedIdsChange,
  onEdit,
  onDeleteSelected,
}: EmployeeMobileSelectionToolbarProps) {
  return (
    <TableSelectionToolbar
      selectedIds={selectedIds}
      pageRowIds={pageRowIds}
      totalCount={totalCount}
      onSelectedIdsChange={onSelectedIdsChange}
      onEdit={() => singleSelectedEmployee && onEdit(singleSelectedEmployee)}
      editDisabled={!singleSelectedEmployee}
      onDelete={onDeleteSelected}
      deleteDisabled={isSaving}
    />
  );
}
