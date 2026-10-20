"use client";

import { Archive, ArchiveRestore } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

export type InventoryActiveToggleTarget<T> = { records: T[]; isActive: boolean } | null;

type InventoryActiveToggleDialogProps<T> = {
  target: InventoryActiveToggleTarget<T>;
  /** Locale key prefix, e.g. `inventory.deactivate.items`. */
  copyKey: string;
  getName: (record: T) => string;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

/** Items and suppliers are retired (not deleted) so posted documents keep their references. */
export function InventoryActiveToggleDialog<T>({
  target,
  copyKey,
  getName,
  isPending,
  onConfirm,
  onOpenChange,
}: InventoryActiveToggleDialogProps<T>) {
  const { t } = useTranslation();
  const action = target?.isActive ? "reactivate" : "deactivate";
  const count = target?.records.length ?? 0;
  const description =
    count === 1 && target
      ? t(`${copyKey}.${action}One`, { name: getName(target.records[0]!) })
      : t(`${copyKey}.${action}Many`, { count });

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target ? t(`${copyKey}.${action}Title`) : ""}</DialogTitle>
          <DialogDescription>{target ? description : ""}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            variant={target?.isActive ? "default" : "outline"}
            disabled={isPending}
            className={
              target?.isActive
                ? undefined
                : "border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
            }
            onClick={onConfirm}
          >
            {target?.isActive ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {isPending ? t("common.actions.saving") : t(`inventory.actions.${action}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
