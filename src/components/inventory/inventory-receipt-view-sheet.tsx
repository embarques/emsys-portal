"use client";

import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { InventoryConfirmationPanel } from "@/components/inventory/inventory-confirmation-panel";
import { InventoryRecordActions } from "@/components/inventory/inventory-record-actions";
import { InventoryDocumentStatusBadge } from "@/components/inventory/inventory-status-badge";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import {
  formatInventoryDateTime,
  formatInventoryMinor,
  getHolderNameById,
  getItemNameById,
  getSupplierNameById,
} from "@/lib/inventory/display";
import { useConfirmationActions } from "@/lib/inventory/hooks/use-confirmation-actions";
import type { InventoryItem } from "@/lib/inventory/types";
import type { ConfirmationActionOption } from "@/lib/inventory/utils/confirmations";
import { sumLineQuantities, sumReceiptLinesMinor, type InventoryReceipt } from "@/lib/inventory/types/documents";
import type { InventoryHolder } from "@/lib/inventory/types/holders";
import type { InventorySupplier } from "@/lib/inventory/types/suppliers";

type InventoryReceiptViewSheetProps = {
  receipt: InventoryReceipt | null;
  items: InventoryItem[];
  suppliers: InventorySupplier[];
  holders: InventoryHolder[];
  open: boolean;
  isBusy?: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (receipt: InventoryReceipt) => void;
  onPost?: (receipt: InventoryReceipt) => void;
  onCancelDraft?: (receipt: InventoryReceipt) => void;
  onConfirmationAction?: (receipt: InventoryReceipt, action: ConfirmationActionOption) => void;
};

const RECEIPT_PARTIES = ["WAREHOUSE"] as const;

export function InventoryReceiptViewSheet({
  receipt,
  items,
  suppliers,
  holders,
  open,
  isBusy = false,
  onOpenChange,
  onEdit,
  onPost,
  onCancelDraft,
  onConfirmationAction,
}: InventoryReceiptViewSheetProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const isPending = receipt?.status === "PENDING_CONFIRMATION";
  const confirmationActions = useConfirmationActions(isPending && onConfirmationAction ? receipt : null, RECEIPT_PARTIES);
  if (!receipt) return null;
  const isDraft = receipt.status === "DRAFT";
  const showConfirmations = isPending || receipt.status === "POSTED" || Boolean(receipt.rejection);

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={getSupplierNameById(receipt.supplierId, suppliers) || t("inventory.references.receipt")}
          description={t("inventory.references.receipt")}
        />
        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.form.sections.header")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.status")} value={<InventoryDocumentStatusBadge status={receipt.status} />} />
            <RecordViewSheetDetailRow label={t("inventory.columns.warehouse")} value={getHolderNameById(receipt.toHolderId, holders) || dash} />
            <RecordViewSheetDetailRow label={t("inventory.form.fields.receivedAt")} value={formatInventoryDateTime(receipt.receivedAt)} />
            {receipt.submittedAt ? (
              <RecordViewSheetDetailRow
                label={t("inventory.columns.submittedAt")}
                value={[formatInventoryDateTime(receipt.submittedAt), receipt.submittedBy].filter(Boolean).join(" · ")}
              />
            ) : null}
            <RecordViewSheetDetailRow label={t("inventory.columns.postedAt")} value={receipt.postedAt ? formatInventoryDateTime(receipt.postedAt) : dash} />
            <RecordViewSheetDetailRow label={t("inventory.columns.postedBy")} value={receipt.postedBy || dash} />
            <RecordViewSheetDetailRow label={t("inventory.form.fields.notes")} value={receipt.notes || dash} />
          </RecordViewSheetSection>
          {showConfirmations ? (
            <RecordViewSheetSection title={t("inventory.confirmations.title")}>
              <InventoryConfirmationPanel
                state={receipt}
                parties={RECEIPT_PARTIES}
                pending={isPending}
                actions={confirmationActions}
                disabled={isBusy}
                onAction={onConfirmationAction ? (action) => onConfirmationAction(receipt, action) : undefined}
              />
            </RecordViewSheetSection>
          ) : null}
          <RecordViewSheetSection title={t("inventory.view.lines")}>
            {receipt.lines.map((line, index) => (
              <RecordViewSheetDetailRow
                key={line.id ?? `${line.itemId}-${index}`}
                label={getItemNameById(line.itemId, items)}
                value={`${line.quantity} × ${formatInventoryMinor(line.unitCostMinor)} = ${formatInventoryMinor(line.quantity * line.unitCostMinor)}`}
              />
            ))}
            <RecordViewSheetDetailRow
              label={t("inventory.form.totalCost")}
              value={`${sumLineQuantities(receipt.lines)} · ${formatInventoryMinor(sumReceiptLinesMinor(receipt.lines))}`}
            />
          </RecordViewSheetSection>
          <RecordViewSheetSection title={t("inventory.view.audit")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.dateCreated")} value={formatAuditDateTime(receipt.createdAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userCreated")} value={receipt.createdBy || dash} />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateModified")} value={formatAuditDateTime(receipt.updatedAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userModified")} value={receipt.updatedBy || dash} />
          </RecordViewSheetSection>
          {!isDraft ? (
            <p className="px-6 pb-4 text-xs text-muted-foreground">
              {t(isPending ? "inventory.form.workflow.readOnlyPending" : "inventory.form.workflow.readOnlyPosted")}
            </p>
          ) : null}
        </RecordViewSheetBody>
        <InventoryRecordActions
          disabled={isBusy}
          onPost={isDraft && onPost ? () => onPost(receipt) : undefined}
          onEdit={isDraft && onEdit ? () => onEdit(receipt) : undefined}
          onCancelDraft={isDraft && onCancelDraft ? () => onCancelDraft(receipt) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
