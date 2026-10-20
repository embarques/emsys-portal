"use client";

import { Archive, ArchiveRestore, Ban, Pencil, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

type InventoryRecordActionsProps = {
  onEdit?: () => void;
  editLabel?: string;
  /** Catalog records: deactivate when active, reactivate when inactive. */
  isActive?: boolean;
  onToggleActive?: () => void;
  /** Draft documents: post to the ledger or cancel the draft. */
  onPost?: () => void;
  onCancelDraft?: () => void;
  disabled?: boolean;
};

/** View-sheet footer for inventory records (replaces delete, which the API does not offer). */
export function InventoryRecordActions({
  onEdit,
  editLabel,
  isActive = true,
  onToggleActive,
  onPost,
  onCancelDraft,
  disabled = false,
}: InventoryRecordActionsProps) {
  const { t } = useTranslation();
  if (!onEdit && !onToggleActive && !onPost && !onCancelDraft) return null;

  return (
    <div className="shrink-0 border-t border-border bg-card px-6 py-4">
      <div className="flex flex-wrap gap-2">
        {onPost ? (
          <Button className="flex-1" disabled={disabled} onClick={onPost}>
            <Send className="h-4 w-4" />
            {t("inventory.actions.post")}
          </Button>
        ) : null}
        {onEdit ? (
          <Button className="flex-1" variant={onPost ? "outline" : "default"} disabled={disabled} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {editLabel ?? t("common.actions.edit")}
          </Button>
        ) : null}
        {onCancelDraft ? (
          <Button
            variant="outline"
            disabled={disabled}
            className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onCancelDraft}
          >
            <Ban className="h-4 w-4" />
            {t("inventory.actions.cancelDraft")}
          </Button>
        ) : null}
        {onToggleActive ? (
          <Button
            variant="outline"
            disabled={disabled}
            className={
              isActive ? "border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive" : undefined
            }
            onClick={onToggleActive}
          >
            {isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
            {t(isActive ? "inventory.actions.deactivate" : "inventory.actions.reactivate")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
