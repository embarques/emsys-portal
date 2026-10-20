"use client";

import { useMemo, useState } from "react";

import { TableDirectoryTabs } from "@/components/app-shell/table-directory-tabs";
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
import { useTranslation } from "@/lib/i18n";
import {
  formatInventoryDateTime,
  formatInventoryMinor,
  getHolderNameById,
  getHolderTypeLabel,
  getStockConditionLabel,
  getSupplierNameById,
} from "@/lib/inventory/display";
import { summarizeItemStock, type InventoryItem } from "@/lib/inventory/types";
import type { InventorySnapshot } from "@/lib/inventory/types/snapshot";

type InventoryViewSheetProps = {
  item: InventoryItem | null;
  snapshot: InventorySnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (item: InventoryItem) => void;
  onToggleActive?: (item: InventoryItem) => void;
};

type DetailTab = "stock" | "receipts" | "dispatches";

export function InventoryViewSheet({
  item,
  snapshot,
  open,
  onOpenChange,
  onEdit,
  onToggleActive,
}: InventoryViewSheetProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const [activeTab, setActiveTab] = useState<DetailTab>("stock");

  const itemBalances = useMemo(
    () => (item ? snapshot.stock.filter((balance) => balance.itemId === item.id && balance.quantityOnHand !== 0) : []),
    [item, snapshot.stock],
  );
  const summary = useMemo(
    () => (item ? summarizeItemStock(itemBalances).get(item.id) : undefined),
    [item, itemBalances],
  );

  const itemReceipts = useMemo(
    () => (item ? snapshot.receipts.filter((receipt) => receipt.lines.some((line) => line.itemId === item.id)) : []),
    [item, snapshot.receipts],
  );

  const itemDispatches = useMemo(
    () => (item ? snapshot.dispatches.filter((dispatch) => dispatch.lines.some((line) => line.itemId === item.id)) : []),
    [item, snapshot.dispatches],
  );

  if (!item) return null;

  const tabs = [
    { id: "stock" as const, label: t("inventory.view.stockByHolder") },
    { id: "receipts" as const, label: t("inventory.view.receipts") },
    { id: "dispatches" as const, label: t("inventory.view.dispatches") },
  ];

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent className="sm:max-w-xl">
        <RecordViewSheetHeader title={item.name} description={item.sku || t("inventory.submenus.items")} />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.view.details")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.status")} value={<InventoryActiveBadge isActive={item.isActive} />} />
            <RecordViewSheetDetailRow label={t("inventory.columns.category")} value={item.category || dash} />
            <RecordViewSheetDetailRow label={t("inventory.form.fields.unit")} value={item.unitOfMeasure || dash} />
            <RecordViewSheetDetailRow
              label={t("inventory.form.fields.defaultSellingPrice")}
              value={formatInventoryMinor(item.defaultSellingPriceMinor)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("inventory.view.stock")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.available")} value={String(summary?.available ?? 0)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.quarantined")} value={String(summary?.quarantined ?? 0)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.reserved")} value={String(summary?.reserved ?? 0)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.reorderThreshold")} value={String(item.reorderThreshold)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateCreated")} value={formatAuditDateTime(item.createdAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userCreated")} value={item.createdBy || dash} />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateModified")} value={formatAuditDateTime(item.updatedAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userModified")} value={item.updatedBy || dash} />
          </RecordViewSheetSection>

          <div className="border-b">
            <TableDirectoryTabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} aria-label={t("inventory.view.stockByHolder")} />
          </div>

          {activeTab === "stock" ? (
            <RecordViewSheetSection title={t("inventory.view.stockByHolder")} padding="relaxed">
              {itemBalances.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("inventory.empty.stockByHolder")}</p>
              ) : (
                <div className="space-y-3">
                  {itemBalances.map((balance) => {
                    const holder = snapshot.holders.find((entry) => entry.id === balance.holderId);
                    return (
                      <div key={balance.id} className="rounded-md border border-border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{getHolderNameById(balance.holderId, snapshot.holders)}</span>
                          <span className="tabular-nums">{balance.quantityOnHand}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {[holder ? getHolderTypeLabel(holder.type, t) : "", getStockConditionLabel(balance.condition, t)]
                            .filter(Boolean)
                            .join(" · ")}
                          {balance.quantityReserved > 0
                            ? ` · ${t("inventory.columns.reserved")}: ${balance.quantityReserved}`
                            : ""}
                        </div>
                      </div>
                    );
                  })}
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
                    const line = receipt.lines.find((entry) => entry.itemId === item.id);
                    return (
                      <div key={receipt.id} className="rounded-md border border-border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{getSupplierNameById(receipt.supplierId, snapshot.suppliers)}</span>
                          <InventoryDocumentStatusBadge status={receipt.status} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatInventoryDateTime(receipt.receivedAt)} · {line?.quantity ?? 0} ·{" "}
                          {formatInventoryMinor(line?.unitCostMinor)}
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
                    const line = dispatch.lines.find((entry) => entry.itemId === item.id);
                    return (
                      <div key={dispatch.id} className="rounded-md border border-border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{getHolderNameById(dispatch.toHolderId, snapshot.holders)}</span>
                          <InventoryDocumentStatusBadge status={dispatch.status} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatInventoryDateTime(dispatch.dispatchedAt)} · {line?.quantity ?? 0} ·{" "}
                          {getHolderNameById(dispatch.fromHolderId, snapshot.holders)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </RecordViewSheetSection>
          ) : null}
        </RecordViewSheetBody>

        <InventoryRecordActions
          editLabel={t("inventory.actions.editItem")}
          onEdit={onEdit ? () => onEdit(item) : undefined}
          isActive={item.isActive}
          onToggleActive={onToggleActive ? () => onToggleActive(item) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
