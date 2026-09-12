"use client";

import { useMemo, useState } from "react";

import { TableDirectoryTabs } from "@/components/app-shell/table-directory-tabs";
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
import {
  formatInventoryDate,
  formatInventoryMoney,
  getInventoryDispatchToLabel,
  getMovementDirectionLabel,
  getReferenceTypeLabel,
} from "@/lib/inventory/display";
import type { InventoryItem } from "@/lib/inventory/types";
import type { InventorySnapshot } from "@/lib/inventory/types/snapshot";

type InventoryViewSheetProps = {
  item: InventoryItem | null;
  snapshot: InventorySnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: (item: InventoryItem) => void;
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

  const itemReceipts = useMemo(
    () => (item ? snapshot.receipts.filter((receipt) => receipt.itemId === item.id) : []),
    [item, snapshot.receipts],
  );

  const itemDispatches = useMemo(
    () => (item ? snapshot.dispatches.filter((dispatch) => dispatch.itemId === item.id) : []),
    [item, snapshot.dispatches],
  );

  if (!item) return null;

  const tabs = [
    { id: "movements" as const, label: t("inventory.view.movementHistory") },
    { id: "receipts" as const, label: t("inventory.view.receipts") },
    { id: "dispatches" as const, label: t("inventory.view.dispatches") },
  ];

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent className="sm:max-w-xl">
        <RecordViewSheetHeader title={item.item} description={t("inventory.submenus.items")} />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.view.stock")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.quantityLeft")} value={String(item.quantity)} />
            <RecordViewSheetDetailRow
              label={t("inventory.columns.reorderThreshold")}
              value={String(item.reorderThreshold)}
            />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateCreated")} value={formatAuditDateTime(item.createdAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userCreated")} value={item.createdBy} />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateModified")} value={formatAuditDateTime(item.updatedAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userModified")} value={item.updatedBy} />
          </RecordViewSheetSection>

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
                        {formatInventoryDate(movement.movementDate)} · {getReferenceTypeLabel(movement.referenceType, t)}
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
                    const supplier = receipt.supplier?.companyName
                      ?? snapshot.suppliers.find((entry) => entry.id === receipt.supplierId)?.companyName
                      ?? receipt.supplierId;
                    return (
                      <div key={receipt.id} className="rounded-md border border-border px-3 py-2 text-sm">
                        <div className="font-medium">{supplier}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatInventoryDate(receipt.receivedAt)} · {receipt.quantity} · {formatInventoryMoney(receipt.averageCost)}
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
                    const dispatchedTo = getInventoryDispatchToLabel(dispatch.dispatchedTo);
                    return (
                    <div key={dispatch.id} className="rounded-md border border-border px-3 py-2 text-sm">
                      <div className="font-medium">{formatInventoryMoney(dispatch.incomeGained)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatInventoryDate(dispatch.dispatchedAt)} · {dispatch.quantity}
                        {dispatchedTo ? ` · ${dispatchedTo}` : ""}
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
