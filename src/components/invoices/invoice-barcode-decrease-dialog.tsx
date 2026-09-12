"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import type {
  InvoiceBarcodeDecreaseNeed,
  InvoiceBarcodeDeletionSelection,
} from "@/lib/invoices/barcode-sync";
import { areBarcodeDecreaseSelectionsComplete } from "@/lib/invoices/barcode-sync";
import { cn } from "@/lib/utils";

type InvoiceBarcodeDecreaseDialogProps = {
  open: boolean;
  decreases: InvoiceBarcodeDecreaseNeed[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (selections: InvoiceBarcodeDeletionSelection) => void;
};

function barcodeKey(barcode: InvoiceBarcodeDecreaseNeed["barcodes"][number]): string {
  return barcode.barcodeId?.trim() || barcode.id.trim() || barcode.number.trim();
}

export function InvoiceBarcodeDecreaseDialog({
  open,
  decreases,
  onOpenChange,
  onConfirm,
}: InvoiceBarcodeDecreaseDialogProps) {
  const { t } = useTranslation();
  const [selections, setSelections] = useState<InvoiceBarcodeDeletionSelection>({});

  useEffect(() => {
    if (!open) {
      setSelections({});
      return;
    }
    const initial: InvoiceBarcodeDeletionSelection = {};
    for (const entry of decreases) {
      initial[entry.lineItemId] = [];
    }
    setSelections(initial);
  }, [open, decreases]);

  const plan = useMemo(
    () => ({ decreases, increases: [], descriptionUpdates: [], deletedLineItems: [] }),
    [decreases],
  );
  const canConfirm = areBarcodeDecreaseSelectionsComplete(plan, selections);

  function toggle(lineItemId: string, barcodeId: string, checked: boolean, removeCount: number) {
    setSelections((current) => {
      const existing = current[lineItemId] ?? [];
      if (checked) {
        if (existing.includes(barcodeId) || existing.length >= removeCount) return current;
        return { ...current, [lineItemId]: [...existing, barcodeId] };
      }
      return { ...current, [lineItemId]: existing.filter((id) => id !== barcodeId) };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("invoices.barcodeSync.decreaseTitle")}</DialogTitle>
          <DialogDescription>{t("invoices.barcodeSync.decreaseDescription")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {decreases.map((entry) => {
            const selected = selections[entry.lineItemId] ?? [];
            return (
              <div key={entry.lineItemId} className="space-y-2 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{entry.description || t("common.empty.dash")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("invoices.barcodeSync.decreasePick", {
                      remove: entry.removeCount,
                      from: entry.currentCount,
                      to: entry.nextCount,
                    })}
                  </p>
                </div>
                <ul className="space-y-1">
                  {entry.barcodes.map((barcode) => {
                    const id = barcodeKey(barcode);
                    const checked = selected.includes(id);
                    const disableUnchecked = !checked && selected.length >= entry.removeCount;
                    return (
                      <li key={id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
                            disableUnchecked && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-4 rounded border"
                            checked={checked}
                            disabled={disableUnchecked}
                            onChange={(event) =>
                              toggle(entry.lineItemId, id, event.target.checked, entry.removeCount)
                            }
                          />
                          <span className="font-mono text-xs">{barcode.number || id}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="button" disabled={!canConfirm} onClick={() => onConfirm(selections)}>
            {t("invoices.barcodeSync.confirmDelete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
