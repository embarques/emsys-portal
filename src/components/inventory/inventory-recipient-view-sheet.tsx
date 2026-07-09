"use client";

import { useMemo } from "react";

import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import { getRecipientTypeLabel } from "@/lib/inventory/display";
import type { getInventoryStoreSnapshot } from "@/lib/inventory/mock-store";
import type { InventoryRecipient } from "@/lib/inventory/types/recipients";

type InventorySnapshot = ReturnType<typeof getInventoryStoreSnapshot>;

type InventoryRecipientViewSheetProps = {
  recipient: InventoryRecipient | null;
  snapshot: InventorySnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (recipient: InventoryRecipient) => void;
  onDelete: (recipient: InventoryRecipient) => void;
};

export function InventoryRecipientViewSheet({
  recipient,
  snapshot,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: InventoryRecipientViewSheetProps) {
  const { t } = useTranslation();
  if (!recipient) return null;

  const dispatches = snapshot.dispatches
    .filter((dispatch) => dispatch.recipientId === recipient.id)
    .sort((a, b) => b.dispatchDate.localeCompare(a.dispatchDate));

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader title={recipient.name} description={getRecipientTypeLabel(recipient.type, t)} />
        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.form.sections.recipient")}>
            {recipient.contactInfo ? (
              <RecordViewSheetDetailRow label={t("inventory.columns.contact")} value={recipient.contactInfo} />
            ) : null}
            {recipient.address ? (
              <RecordViewSheetDetailRow label={t("inventory.columns.address")} value={recipient.address} />
            ) : null}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("inventory.view.dispatchHistory")}>
            {dispatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("inventory.empty.dispatches")}</p>
            ) : (
              dispatches.map((dispatch) => {
                const lines = snapshot.dispatchLines.filter((line) => line.dispatchId === dispatch.id);
                const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0);
                return (
                  <RecordViewSheetDetailRow
                    key={dispatch.id}
                    label={formatAuditDateTime(dispatch.dispatchDate)}
                    value={`${totalQty} units · ${dispatch.status}${dispatch.invoiceNumber ? ` · ${dispatch.invoiceNumber}` : ""}`}
                  />
                );
              })
            )}
          </RecordViewSheetSection>
        </RecordViewSheetBody>
        <RecordViewSheetActions
          editLabel={t("inventory.form.editRecipientTitle")}
          onEdit={() => onEdit(recipient)}
          onDelete={() => onDelete(recipient)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
