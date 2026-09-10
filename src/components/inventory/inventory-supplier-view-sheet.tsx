"use client";

import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatInventoryDate, formatInventoryMoney, formatSupplierList, formatSupplierPhones, getInventoryItemLabel } from "@/lib/inventory/display";
import { useTranslation } from "@/lib/i18n";
import type { getInventoryStoreSnapshot } from "@/lib/inventory/mock-store";
import type { InventorySupplier } from "@/lib/inventory/types/suppliers";

type InventorySnapshot = ReturnType<typeof getInventoryStoreSnapshot>;

type InventorySupplierViewSheetProps = {
  supplier: InventorySupplier | null;
  snapshot: InventorySnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (supplier: InventorySupplier) => void;
  onDelete: (supplier: InventorySupplier) => void;
};

export function InventorySupplierViewSheet({
  supplier,
  snapshot,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: InventorySupplierViewSheetProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  if (!supplier) return null;

  const receipts = snapshot.receipts
    .filter((receipt) => receipt.supplierId === supplier.id)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader title={supplier.companyName} description={t("inventory.submenus.suppliers")} />
        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.form.sections.supplier")}>
            <RecordViewSheetDetailRow
              label={t("inventory.form.fields.contactNames")}
              value={formatSupplierList(supplier.contactNames) || dash}
            />
            <RecordViewSheetDetailRow
              label={t("inventory.form.fields.addresses")}
              value={formatSupplierList(supplier.addresses) || dash}
            />
            <RecordViewSheetDetailRow
              label={t("inventory.form.fields.phones")}
              value={formatSupplierPhones(supplier) || dash}
            />
            <RecordViewSheetDetailRow
              label={t("inventory.form.fields.emails")}
              value={formatSupplierList(supplier.emails) || dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("inventory.view.receipts")}>
            {receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("inventory.empty.receipts")}</p>
            ) : (
              receipts.map((receipt) => {
                const item = snapshot.items.find((entry) => entry.id === receipt.itemId);
                return (
                  <RecordViewSheetDetailRow
                    key={receipt.id}
                    label={item ? getInventoryItemLabel(item) : receipt.itemId}
                    value={`${receipt.quantity} · ${formatInventoryMoney(receipt.averageCost)} · ${formatInventoryDate(receipt.receivedAt)}`}
                  />
                );
              })
            )}
          </RecordViewSheetSection>
        </RecordViewSheetBody>
        <RecordViewSheetActions
          editLabel={t("inventory.form.editSupplierTitle")}
          onEdit={() => onEdit(supplier)}
          onDelete={() => onDelete(supplier)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
