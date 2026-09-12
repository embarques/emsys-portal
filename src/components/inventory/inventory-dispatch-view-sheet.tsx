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
import { formatInventoryDate, formatInventoryMoney, getInventoryDispatchToLabel, getDispatchItemLabel } from "@/lib/inventory/display";
import type { InventoryItem } from "@/lib/inventory/types";
import type { InventoryDispatch } from "@/lib/inventory/types/documents";

type InventoryDispatchViewSheetProps = {
  dispatch: InventoryDispatch | null;
  items: InventoryItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InventoryDispatchViewSheet({
  dispatch,
  items,
  open,
  onOpenChange,
}: InventoryDispatchViewSheetProps) {
  const { t } = useTranslation();
  if (!dispatch) return null;

  const itemLabel = getDispatchItemLabel(dispatch, items);

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={itemLabel}
          description={t("inventory.references.dispatch")}
        />
        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.form.sections.dispatched")}>
            <RecordViewSheetDetailRow label={t("inventory.form.fields.quantityDispatched")} value={String(dispatch.quantity)} />
            <RecordViewSheetDetailRow
              label={t("inventory.columns.dispatchedTo")}
              value={getInventoryDispatchToLabel(dispatch.dispatchedTo)}
            />
            <RecordViewSheetDetailRow label={t("inventory.columns.incomeGained")} value={formatInventoryMoney(dispatch.incomeGained)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.date")} value={formatInventoryDate(dispatch.dispatchedAt)} />
          </RecordViewSheetSection>
          <RecordViewSheetSection title={t("inventory.view.audit")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.dateCreated")} value={formatAuditDateTime(dispatch.createdAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userCreated")} value={dispatch.createdBy} />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateModified")} value={formatAuditDateTime(dispatch.updatedAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userModified")} value={dispatch.updatedBy} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
