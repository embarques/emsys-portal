"use client";

import { Eye, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Employee } from "@/lib/employees/types";
import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();

  if (selectedIds.length === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-sm">
      <p className="min-w-0 text-lg font-bold">
        {t("common.table.selected", { count: selectedIds.length, total: totalCount })}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={onClearSelection}>
          <X className="size-4" />
          {t("common.table.clearAll")}
        </Button>
        {singleSelectedEmployee ? (
          <>
            <Button
              variant="outline"
              size="icon"
              className="size-10"
              onClick={() => onView(singleSelectedEmployee)}
              aria-label={t("common.actions.view")}
            >
              <Eye className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-10"
              onClick={() => onEdit(singleSelectedEmployee)}
              aria-label={t("common.actions.edit")}
            >
              <Pencil className="size-4" />
            </Button>
          </>
        ) : null}
        <Button
          variant="outline"
          size="icon"
          className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDeleteSelected}
          disabled={isSaving}
          aria-label={t("common.actions.delete")}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
