"use client";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import type { Employee } from "@/lib/employees/types";

type EmployeeMobileSelectionToolbarProps = {
  selectedIds: string[];
  totalCount: number;
  singleSelectedEmployee?: Employee;
  isSaving: boolean;
  onClearSelection: () => void;
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDeleteSelected: () => void;
};

export function EmployeeMobileSelectionToolbar({
  selectedIds,
  totalCount,
  singleSelectedEmployee,
  isSaving,
  onClearSelection,
  onView,
  onEdit,
  onDeleteSelected,
}: EmployeeMobileSelectionToolbarProps) {
  return (
    <TableSelectionBar
      selectedCount={selectedIds.length}
      totalCount={totalCount}
      onClear={onClearSelection}
      onView={() => singleSelectedEmployee && onView(singleSelectedEmployee)}
      onEdit={() => singleSelectedEmployee && onEdit(singleSelectedEmployee)}
      viewDisabled={!singleSelectedEmployee}
      editDisabled={!singleSelectedEmployee}
      onDelete={onDeleteSelected}
      deleteDisabled={isSaving}
    />
  );
}
