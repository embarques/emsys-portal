"use client";

import { useMemo, useState } from "react";

import { TableDirectoryTabs } from "@/components/app-shell/table-directory-tabs";
import { Badge } from "@/components/ui/badge";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAuditDate, formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import {
  getAvailableQuantity,
  getCategoryLabel,
  getLocationLabel,
  getMovementDirectionLabel,
  getReferenceTypeLabel,
  getStatusBadgeClass,
  getStatusLabel,
} from "@/lib/inventory/display";
import type { getInventoryStoreSnapshot } from "@/lib/inventory/mock-store";
import type { InventoryItem } from "@/lib/inventory/types";

type InventorySnapshot = ReturnType<typeof getInventoryStoreSnapshot>;

type InventoryViewSheetProps = {
  item: InventoryItem | null;
  snapshot: InventorySnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
};

type DetailTab = "movements" | "receipts" | "dispatches";

export function InventoryViewSheet({
  item,
  snapshot,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: InventoryViewSheetProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DetailTab>("movements");

  const movements = useMemo(
    () =>
      item
        ? snapshot.movements
            .filter((movement) => movement.itemId === item.id)
            .sort((a, b) => b.movementDate.localeCompare(a.movementDate))
        : [],
    [item, snapshot.movements],
  );

  const itemReceipts = useMemo(() => {
    if (!item) return [];
    const receiptIds = new Set(
      movements.filter((movement) => movement.referenceType === "receipt").map((movement) => movement.referenceId),
    );
    return snapshot.receipts.filter((receipt) => receiptIds.has(receipt.id));
  }, [item, movements, snapshot.receipts]);

  const itemDispatches = useMemo(() => {
    if (!item) return [];
    const dispatchIds = new Set(
      movements.filter((movement) => movement.referenceType === "dispatch").map((movement) => movement.referenceId),
    );
    return snapshot.dispatches.filter((dispatch) => dispatchIds.has(dispatch.id));
  }, [item, movements, snapshot.dispatches]);

  if (!item) return null;

  const tabs = [
    { id: "movements" as const, label: t("inventory.view.movementHistory") },
    { id: "receipts" as const, label: t("inventory.view.receipts") },
    { id: "dispatches" as const, label: t("inventory.view.dispatches") },
  ];

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent className="sm:max-w-xl">
        <RecordViewSheetHeader
          title={item.name}
          description={item.sku}
          meta={
            <>
              <Badge className={getStatusBadgeClass(item.status)}>{getStatusLabel(item.status)}</Badge>
              <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.view.stock")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.location")} value={getLocationLabel(item.location)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.onHand")} value={`${item.quantity} ${item.unit}`} />
            <RecordViewSheetDetailRow label={t("inventory.form.fields.reserved")} value={`${item.reserved} ${item.unit}`} />
            <RecordViewSheetDetailRow
              label={t("inventory.columns.available")}
              value={`${getAvailableQuantity(item)} ${item.unit}`}
            />
            <RecordViewSheetDetailRow
              label={t("inventory.columns.reorderLevel")}
              value={`${item.reorderLevel} ${item.unit}`}
            />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateCreated")} value={formatAuditDate(item.createdAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userCreated")} value={item.createdBy} />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateModified")} value={formatAuditDate(item.updatedAt)} />
          </RecordViewSheetSection>

          {item.notes ? (
            <RecordViewSheetSection title={t("inventory.form.sections.notes")} padding="relaxed">
              <p className="text-sm leading-relaxed text-foreground">{item.notes}</p>
            </RecordViewSheetSection>
          ) : null}

          <div className="border-b">
            <TableDirectoryTabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} aria-label={t("inventory.view.movementHistory")} />
          </div>

          {activeTab === "movements" ? (
            <RecordViewSheetSection title={t("inventory.view.movementHistory")} padding="relaxed">
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("inventory.empty.movements")}</p>
              ) : (
                <div className="space-y-3">
                  {movements.map((movement) => (
                    <div key={movement.id} className="rounded-md border border-border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{getMovementDirectionLabel(movement.direction, t)}</span>
                        <span>
                          {movement.direction === "ADJUSTMENT" && movement.adjustmentSign === "decrease" ? "−" : "+"}
                          {movement.quantity}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatAuditDateTime(movement.movementDate)} · {getReferenceTypeLabel(movement.referenceType, t)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </RecordViewSheetSection>
          ) : null}

          {activeTab === "receipts" ? (
            <RecordViewSheetSection title={t("inventory.view.receipts")} padding="relaxed">
              {itemReceipts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("inventory.empty.receipts")}</p>
              ) : (
                <div className="space-y-3">
                  {itemReceipts.map((receipt) => {
                    const line = snapshot.receiptLines.find(
                      (entry) => entry.receiptId === receipt.id && entry.itemId === item.id,
                    );
                    return (
                      <div key={receipt.id} className="rounded-md border border-border px-3 py-2 text-sm">
                        <div className="font-medium">{receipt.source}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatAuditDateTime(receipt.receiptDate)} · {line?.quantity ?? 0} {item.unit}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </RecordViewSheetSection>
          ) : null}

          {activeTab === "dispatches" ? (
            <RecordViewSheetSection title={t("inventory.view.dispatches")} padding="relaxed">
              {itemDispatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("inventory.empty.dispatches")}</p>
              ) : (
                <div className="space-y-3">
                  {itemDispatches.map((dispatch) => {
                    const line = snapshot.dispatchLines.find(
                      (entry) => entry.dispatchId === dispatch.id && entry.itemId === item.id,
                    );
                    const recipient = snapshot.recipients.find((entry) => entry.id === dispatch.recipientId);
                    return (
                      <div key={dispatch.id} className="rounded-md border border-border px-3 py-2 text-sm">
                        <div className="font-medium">{recipient?.name ?? dispatch.recipientId}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatAuditDateTime(dispatch.dispatchDate)} · {line?.quantity ?? 0} {item.unit} · {dispatch.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </RecordViewSheetSection>
          ) : null}
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("inventory.actions.editItem")}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
