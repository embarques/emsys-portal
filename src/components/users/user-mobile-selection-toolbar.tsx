"use client";

import { UserX } from "lucide-react";

import { EmployeeUserLink } from "@/components/employees/employee-user-link";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useTranslation } from "@/lib/i18n";

type UserMobileSelectionToolbarProps = {
  singleSelectedUser?: {id: number; name: string};
  selectedIds: string[];
  pageRowIds: string[];
  totalCount?: number;
  canEdit: boolean;
  disabled?: boolean;
  onSelectedIdsChange: (ids: string[]) => void;
  onEdit: () => void;
  onDeactivate: () => void;
};

export function UserMobileSelectionToolbar({
  singleSelectedUser,
  selectedIds,
  pageRowIds,
  totalCount,
  canEdit,
  disabled = false,
  onSelectedIdsChange,
  onEdit,
  onDeactivate,
}: UserMobileSelectionToolbarProps) {
  const { t } = useTranslation();
  return (
    <TableSelectionToolbar
      actions={singleSelectedUser && <EmployeeUserLink key={singleSelectedUser.id} side="user" id={singleSelectedUser.id} name={singleSelectedUser.name} />}
      selectedIds={selectedIds}
      pageRowIds={pageRowIds}
      totalCount={totalCount}
      onSelectedIdsChange={onSelectedIdsChange}
      onEdit={onEdit}
      editDisabled={!canEdit || disabled}
      onDelete={onDeactivate}
      deleteDisabled={disabled}
      deleteLabel={t("users.view.deactivate")}
      deleteIcon={<UserX className="h-4 w-4" />}
    />
  );
}
