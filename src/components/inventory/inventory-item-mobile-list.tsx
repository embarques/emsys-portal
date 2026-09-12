"use client";

import { ChevronLeft, ChevronRight, PackageCheck, Plus, SlidersHorizontal, Truck, Warehouse } from "lucide-react";

import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { InventoryItemMobileRow } from "@/components/inventory/inventory-item-mobile-row";
import { InventoryItemMobileSelectionToolbar } from "@/components/inventory/inventory-item-mobile-selection-toolbar";
import { Button } from "@/components/ui/button";
import type { InventoryItem } from "@/lib/inventory/types";
import { useTranslation } from "@/lib/i18n";

type InventoryItemMobileListProps = {
  query: string;
  items: InventoryItem[];
  pageItems: InventoryItem[];
  selectedIds: string[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onOpen: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem | InventoryItem[]) => void;
  onSelectedIdsChange: (ids: string[]) => void;
  onNewReceipt: () => void;
  onNewDispatch: () => void;
  onAdjustStock: () => void;
  onAddItem: () => void;
};

export function InventoryItemMobileList({
  query,
  items,
  pageItems,
  selectedIds,
  isLoading,
  page,
  totalPages,
  onQueryChange,
  onPageChange,
  onOpen,
  onEdit,
  onDelete,
  onSelectedIdsChange,
  onNewReceipt,
  onNewDispatch,
  onAdjustStock,
  onAddItem,
}: InventoryItemMobileListProps) {
  const { t } = useTranslation();
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const selectionMode = selectedIds.length > 0;

  function toggleSelected(itemId: string, checked: boolean) {
    onSelectedIdsChange(checked ? [...selectedIds, itemId] : selectedIds.filter((id) => id !== itemId));
  }

  return (
    <section className="space-y-5 overflow-x-hidden md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-normal text-foreground">{t("inventory.submenus.items")}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t("inventory.pages.items")}</p>
        </div>
        <Button type="button" size="icon" className="size-12 shrink-0 rounded-2xl" onClick={onAddItem}>
          <Plus className="size-6" />
          <span className="sr-only">{t("inventory.actions.addItem")}</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" onClick={onNewReceipt}>
          <PackageCheck className="size-5" />
          <span className="sr-only">{t("inventory.actions.newReceipt")}</span>
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" onClick={onNewDispatch}>
          <Truck className="size-5" />
          <span className="sr-only">{t("inventory.actions.newDispatch")}</span>
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" onClick={onAdjustStock}>
          <SlidersHorizontal className="size-5" />
          <span className="sr-only">{t("inventory.actions.adjustStock")}</span>
        </Button>
      </div>

      <TableSearchInput
        value={query}
        onChange={(value) => {
          onQueryChange(value);
          onPageChange(1);
        }}
        placeholder={t("inventory.search.items")}
        inputClassName="h-14 rounded-2xl text-base"
      />

      <InventoryItemMobileSelectionToolbar
        selectedCount={selectedIds.length}
        canEdit={selectedIds.length === 1}
        onClear={() => onSelectedIdsChange([])}
        onEdit={() => {
          const item = selectedItems[0];
          if (item) onEdit(item);
        }}
        onDelete={() => onDelete(selectedItems)}
      />

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="size-4" />
          {t("common.actions.previous")}
        </Button>
        <p className="text-sm font-medium text-muted-foreground">
          {t("common.pagination.pageOf", { current: page, total: totalPages })}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          {t("common.actions.next")}
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="rounded-3xl border border-border bg-card px-4 shadow-sm">
        {isLoading ? (
          <DirectoryTableLoader
            icon={Warehouse}
            title={t("inventory.loading.items.title")}
            description={t("inventory.loading.items.description")}
            columns={[
              t("inventory.columns.item"),
              t("inventory.columns.quantityLeft"),
              t("inventory.columns.reorderThreshold"),
            ]}
          />
        ) : pageItems.length > 0 ? (
          pageItems.map((item) => (
            <InventoryItemMobileRow
              key={item.id}
              item={item}
              selected={selectedIds.includes(item.id)}
              selectionMode={selectionMode}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleSelected={toggleSelected}
            />
          ))
        ) : (
          <p className="py-8 text-center text-muted-foreground">{t("inventory.empty.items")}</p>
        )}
      </div>
    </section>
  );
}
