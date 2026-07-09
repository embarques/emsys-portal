"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { getInventoryStoreSnapshot } from "@/lib/inventory/mock-store";
import type { InventoryItem } from "@/lib/inventory/types";
import type { InventoryDispatch } from "@/lib/inventory/types/documents";
import type { InventoryRecipient } from "@/lib/inventory/types/recipients";

type InventorySnapshot = ReturnType<typeof getInventoryStoreSnapshot>;

type InventoryDispatchViewSheetProps = {
  dispatch: InventoryDispatch | null;
  snapshot: InventorySnapshot;
  items: InventoryItem[];
  recipients: InventoryRecipient[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkSent: (dispatch: InventoryDispatch) => void | Promise<void>;
  onMarkConfirmed: (dispatch: InventoryDispatch) => void | Promise<void>;
};

export function InventoryDispatchViewSheet({
  dispatch,
  snapshot,
  items,
  recipients,
  open,
  onOpenChange,
  onMarkSent,
  onMarkConfirmed,
}: InventoryDispatchViewSheetProps) {
  const { t } = useTranslation();
  if (!dispatch) return null;

  const recipient = recipients.find((entry) => entry.id === dispatch.recipientId);
  const lines = snapshot.dispatchLines.filter((line) => line.dispatchId === dispatch.id);

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={recipient?.name ?? dispatch.recipientId}
          description={t("inventory.references.dispatch")}
          meta={<Badge variant="outline">{dispatch.status}</Badge>}
        />
        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.form.sections.header")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.date")} value={formatAuditDateTime(dispatch.dispatchDate)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.dispatchedBy")} value={dispatch.dispatchedBy} />
            <RecordViewSheetDetailRow label={t("inventory.columns.invoiceNumber")} value={dispatch.invoiceNumber ?? "—"} />
            {dispatch.notes ? (
              <RecordViewSheetDetailRow label={t("inventory.form.fields.notes")} value={dispatch.notes} />
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

          <RecordViewSheetSection title={t("inventory.view.dispatchHistory")}>
            {dispatch.status === "pending" ? (
              <Button size="sm" onClick={() => onMarkSent(dispatch)}>
                {t("inventory.actions.markSent")}
              </Button>
            ) : null}
            {dispatch.status === "sent" ? (
              <Button size="sm" variant="outline" onClick={() => onMarkConfirmed(dispatch)}>
                {t("inventory.actions.markConfirmed")}
              </Button>
            ) : null}
          </RecordViewSheetSection>
        </RecordViewSheetBody>
        <RecordViewSheetActions />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
