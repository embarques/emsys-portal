"use client";

import { useMemo } from "react";

import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import { getReferenceTypeLabel } from "@/lib/inventory/display";
import type { getInventoryStoreSnapshot } from "@/lib/inventory/mock-store";
import type { InventoryItem } from "@/lib/inventory/types";
import type { InventoryReceipt } from "@/lib/inventory/types/documents";

type InventorySnapshot = ReturnType<typeof getInventoryStoreSnapshot>;

type InventoryReceiptViewSheetProps = {
  receipt: InventoryReceipt | null;
  snapshot: InventorySnapshot;
  items: InventoryItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InventoryReceiptViewSheet({
  receipt,
  snapshot,
  items,
  open,
  onOpenChange,
}: InventoryReceiptViewSheetProps) {
  const { t } = useTranslation();
  if (!receipt) return null;

  const lines = snapshot.receiptLines.filter((line) => line.receiptId === receipt.id);
  const movements = snapshot.movements.filter(
    (movement) => movement.referenceType === "receipt" && movement.referenceId === receipt.id,
  );

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader title={receipt.source} description={t("inventory.references.receipt")} />
        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.form.sections.header")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.date")} value={formatAuditDateTime(receipt.receiptDate)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.receivedBy")} value={receipt.receivedBy} />
            {receipt.notes ? (
              <RecordViewSheetDetailRow label={t("inventory.form.fields.notes")} value={receipt.notes} />
            ) : null}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("inventory.view.lines")}>
            {lines.map((line) => {
              const item = items.find((entry) => entry.id === line.itemId);
              return (
                <RecordViewSheetDetailRow
                  key={line.id}
                  label={item?.name ?? line.itemId}
                  value={`${line.quantity} ${item?.unit ?? ""}`}
                />
              );
            })}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("inventory.view.movements")}>
            {movements.map((movement) => (
              <RecordViewSheetDetailRow
                key={movement.id}
                label={getReferenceTypeLabel(movement.referenceType, t)}
                value={`${movement.id} · +${movement.quantity}`}
              />
            ))}
          </RecordViewSheetSection>
        </RecordViewSheetBody>
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
