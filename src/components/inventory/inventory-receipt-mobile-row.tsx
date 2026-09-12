"use client";

import { Edit, PackageCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { formatInventoryDate, formatInventoryMoney, getReceiptItemLabel, getReceiptSupplierLabel } from "@/lib/inventory/display";
import type { InventoryItem } from "@/lib/inventory/types/catalog";
import type { InventoryReceipt } from "@/lib/inventory/types/documents";
import type { InventorySupplier } from "@/lib/inventory/types/suppliers";
import { useTranslation } from "@/lib/i18n";

type InventoryReceiptMobileRowProps = {
  receipt: InventoryReceipt;
  item?: InventoryItem;
  supplier?: InventorySupplier;
  onOpen: (receipt: InventoryReceipt) => void;
  onEdit?: (receipt: InventoryReceipt) => void;
  onDelete?: (receipt: InventoryReceipt) => void;
};

export function InventoryReceiptMobileRow({ receipt, item, supplier, onOpen, onEdit, onDelete }: InventoryReceiptMobileRowProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");

  return (
    <article className="border-b border-border/80 py-5 last:border-b-0">
      <button type="button" className="grid w-full min-w-0 grid-cols-[3.75rem_minmax(0,1fr)_auto] gap-3 text-left" onClick={() => onOpen(receipt)}>
        <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <PackageCheck className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xl font-bold leading-tight text-foreground">
            {getReceiptItemLabel(receipt, item ? [item] : [])}
          </span>
          <span className="mt-1 block text-base text-muted-foreground">{formatInventoryDate(receipt.receivedAt)}</span>
          <span className="mt-2 block truncate text-sm text-muted-foreground">
            {t("inventory.columns.supplier")}: {getReceiptSupplierLabel(receipt, supplier ? [supplier] : []) || dash}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-xl font-bold tabular-nums">{receipt.quantity}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{formatInventoryMoney(receipt.averageCost)}</span>
        </span>
      </button>
      {onEdit || onDelete ? (
        <div className="mt-4 flex justify-end gap-2">
          {onEdit ? <Button variant="outline" onClick={() => onEdit(receipt)}><Edit className="size-4" />{t("common.actions.edit")}</Button> : null}
          {onDelete ? <Button variant="outline" className="text-destructive" onClick={() => onDelete(receipt)}><Trash2 className="size-4" />{t("common.actions.delete")}</Button> : null}
        </div>
      ) : null}
    </article>
  );
}
