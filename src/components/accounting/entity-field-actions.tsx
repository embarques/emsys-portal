"use client";

import { Pencil, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

type EntityFieldActionsProps = {
  hasSelection: boolean;
  onAdd: () => void;
  onEdit: () => void;
};

export function EntityFieldActions({ hasSelection, onAdd, onEdit }: EntityFieldActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={onAdd}
      >
        <UserPlus className="size-3.5" />
        {t("accounting.dailyIncome.form.partyActions.new")}
      </Button>
      {hasSelection ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
          {t("accounting.dailyIncome.form.partyActions.edit")}
        </Button>
      ) : null}
    </div>
  );
}
