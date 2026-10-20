"use client";

import { Ban, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

export type InventoryDocumentCommand = "post" | "cancel";

type InventoryDocumentCommandDialogProps = {
  command: InventoryDocumentCommand | null;
  /** Locale key prefix, e.g. `inventory.commands.receipt`. */
  copyKey: string;
  label: string;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

/** Confirms posting (irreversible ledger movement) or cancelling a draft. */
export function InventoryDocumentCommandDialog({
  command,
  copyKey,
  label,
  isPending,
  onConfirm,
  onOpenChange,
}: InventoryDocumentCommandDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={command !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{command ? t(`${copyKey}.${command}Title`) : ""}</DialogTitle>
          <DialogDescription>{command ? t(`${copyKey}.${command}Description`, { name: label }) : ""}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {t("common.actions.close")}
          </Button>
          {command === "post" ? (
            <Button disabled={isPending} onClick={onConfirm}>
              <Send className="h-4 w-4" />
              {isPending ? t("common.actions.saving") : t("inventory.actions.post")}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={isPending}
              className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onConfirm}
            >
              <Ban className="h-4 w-4" />
              {isPending ? t("common.actions.saving") : t("inventory.actions.cancelDraft")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
