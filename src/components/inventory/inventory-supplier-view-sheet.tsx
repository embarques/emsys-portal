"use client";

import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { InventoryRecordActions } from "@/components/inventory/inventory-record-actions";
import { InventoryActiveBadge, InventoryDocumentStatusBadge } from "@/components/inventory/inventory-status-badge";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  formatInventoryDateTime,
  formatInventoryMinor,
  formatSupplierList,
  summarizeDocumentLines,
} from "@/lib/inventory/display";
import { useTranslation } from "@/lib/i18n";
import { sumReceiptLinesMinor } from "@/lib/inventory/types/documents";
import type { InventorySnapshot } from "@/lib/inventory/types/snapshot";
import type { InventorySupplier } from "@/lib/inventory/types/suppliers";
import { formatPhoneForDisplay } from "@/lib/utils/phone";

type InventorySupplierViewSheetProps = {
  supplier: InventorySupplier | null;
  snapshot: InventorySnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (supplier: InventorySupplier) => void;
  onToggleActive?: (supplier: InventorySupplier) => void;
};

export function InventorySupplierViewSheet({
  supplier,
  snapshot,
  open,
  onOpenChange,
  onEdit,
  onToggleActive,
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
            <RecordViewSheetDetailRow label={t("inventory.columns.status")} value={<InventoryActiveBadge isActive={supplier.isActive} />} />
            <RecordViewSheetDetailRow
              label={t("inventory.form.fields.addresses")}
              value={formatSupplierList(supplier.addresses) || dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("inventory.form.sections.contacts")}>
            {supplier.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{dash}</p>
            ) : (
              supplier.contacts.map((contact, index) => (
                <RecordViewSheetDetailRow
                  key={`${contact.name}-${index}`}
                  label={contact.name || t("inventory.form.contactNumber", { number: index + 1 })}
                  value={formatSupplierList([contact.phone ? formatPhoneForDisplay(contact.phone) : "", contact.email]) || dash}
                />
              ))
            )}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("inventory.view.receipts")}>
            {receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("inventory.empty.receipts")}</p>
            ) : (
              receipts.map((receipt) => (
                <div key={receipt.id} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{summarizeDocumentLines(receipt.lines, snapshot.items)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatInventoryDateTime(receipt.receivedAt)} · {formatInventoryMinor(sumReceiptLinesMinor(receipt.lines))}
                    </p>
                  </div>
                  <InventoryDocumentStatusBadge status={receipt.status} />
                </div>
              ))
            )}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("inventory.view.audit")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.dateCreated")} value={formatAuditDateTime(supplier.createdAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userCreated")} value={supplier.createdBy || dash} />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateModified")} value={formatAuditDateTime(supplier.updatedAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userModified")} value={supplier.updatedBy || dash} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>
        <InventoryRecordActions
          editLabel={t("inventory.form.editSupplierTitle")}
          onEdit={onEdit ? () => onEdit(supplier) : undefined}
          isActive={supplier.isActive}
          onToggleActive={onToggleActive ? () => onToggleActive(supplier) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
