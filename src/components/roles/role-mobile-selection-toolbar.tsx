"use client";

import { Edit, Eye, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

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
          <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" disabled={!canViewOrEdit} onClick={onView}>
            <Eye className="size-5" />
            <span className="sr-only">{t("common.actions.view")}</span>
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" disabled={!canViewOrEdit} onClick={onEdit}>
            <Edit className="size-5" />
            <span className="sr-only">{t("common.actions.edit")}</span>
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl text-destructive" disabled={deleteDisabled} onClick={onDelete}>
            <Trash2 className="size-5" />
            <span className="sr-only">{t("common.actions.delete")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
