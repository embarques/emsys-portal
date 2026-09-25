"use client";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { UserX } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

type UserMobileSelectionToolbarProps = {
  selectedCount: number;
  canEdit: boolean;
  disabled?: boolean;
  onClear: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
};

export function UserMobileSelectionToolbar({
  selectedCount,
  canEdit,
  disabled = false,
  onClear,
  onEdit,
  onDeactivate,
}: UserMobileSelectionToolbarProps) {
  const { t } = useTranslation();
  return (
    <TableSelectionBar
      selectedCount={selectedCount}
      onClear={onClear}
      onEdit={onEdit}
      editDisabled={!canEdit || disabled}
      onDelete={onDeactivate}
      deleteDisabled={disabled}
      deleteLabel={t("users.view.deactivate")}
      deleteIcon={<UserX className="h-4 w-4" />}
    />
  );
}
