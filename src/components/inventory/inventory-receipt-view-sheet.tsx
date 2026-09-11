"use client";

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
import { formatInventoryDate, formatInventoryMoney, getReceiptItemLabel, getReceiptSupplierLabel } from "@/lib/inventory/display";
import type { InventoryItem } from "@/lib/inventory/types";
import type { InventoryReceipt } from "@/lib/inventory/types/documents";
import type { InventorySupplier } from "@/lib/inventory/types/suppliers";

type InventoryReceiptViewSheetProps = {
  receipt: InventoryReceipt | null;
  items: InventoryItem[];
  suppliers: InventorySupplier[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InventoryReceiptViewSheet({
  receipt,
  items,
  suppliers,
  open,
  onOpenChange,
}: InventoryReceiptViewSheetProps) {
  const { t } = useTranslation();
  if (!receipt) return null;

  const itemLabel = getReceiptItemLabel(receipt, items);
  const supplierLabel = getReceiptSupplierLabel(receipt, suppliers);

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={itemLabel}
          description={t("inventory.references.receipt")}
        />
        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.form.sections.received")}>
            <RecordViewSheetDetailRow label={t("inventory.form.fields.quantityReceived")} value={String(receipt.quantity)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.averageCost")} value={formatInventoryMoney(receipt.averageCost)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.supplier")} value={supplierLabel} />
            <RecordViewSheetDetailRow label={t("inventory.columns.date")} value={formatInventoryDate(receipt.receivedAt)} />
          </RecordViewSheetSection>
          <RecordViewSheetSection title={t("inventory.view.audit")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.dateCreated")} value={formatAuditDateTime(receipt.createdAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userCreated")} value={receipt.createdBy} />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateModified")} value={formatAuditDateTime(receipt.updatedAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userModified")} value={receipt.updatedBy} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
