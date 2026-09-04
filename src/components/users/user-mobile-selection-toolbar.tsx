"use client";

import { Edit, UserX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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

  if (selectedCount === 0) return null;

  return (
    <div className="rounded-3xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-bold text-foreground">
          {t("common.table.selected", { count: selectedCount, total: selectedCount })}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" onClick={onClear}>
            <X className="size-5" />
            <span className="sr-only">{t("common.table.clearSelection")}</span>
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" disabled={!canEdit || disabled} onClick={onEdit}>
            <Edit className="size-5" />
            <span className="sr-only">{t("common.actions.edit")}</span>
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl text-destructive" disabled={disabled} onClick={onDeactivate}>
            <UserX className="size-5" />
            <span className="sr-only">{t("users.view.deactivate")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
