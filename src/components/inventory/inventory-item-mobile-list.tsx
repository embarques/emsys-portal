"use client";

import {
  ChevronLeft,
  ChevronRight,
  Filter,
  PackageCheck,
  Plus,
  SlidersHorizontal,
  Truck,
  Warehouse,
} from "lucide-react";

import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { InventoryItemMobileRow } from "@/components/inventory/inventory-item-mobile-row";
import { InventoryItemMobileSelectionToolbar } from "@/components/inventory/inventory-item-mobile-selection-toolbar";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  getInventoryCategoryOptions,
  getInventoryLocationOptions,
  getInventoryStatusOptions,
} from "@/lib/inventory/display";
import type { InventoryFilterState, InventoryItem } from "@/lib/inventory/types";
import { useTranslation } from "@/lib/i18n";

type InventoryItemMobileListProps = {
  filters: InventoryFilterState;
  filtersOpen: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  items: InventoryItem[];
  pageItems: InventoryItem[];
  selectedIds: string[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onFiltersOpenChange: (open: boolean) => void;
  onFiltersChange: (filters: InventoryFilterState) => void;
  onResetFilters: () => void;
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
  filters,
  filtersOpen,
  hasActiveFilters,
  activeFilterCount,
  items,
  pageItems,
  selectedIds,
  isLoading,
  page,
  totalPages,
  onFiltersOpenChange,
  onFiltersChange,
  onResetFilters,
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

  function updateFilters(nextFilters: InventoryFilterState) {
    onFiltersChange(nextFilters);
    onPageChange(1);
  }

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

      <div className="flex items-center gap-3">
        <TableSearchInput
          value={filters.query}
          onChange={(query) => updateFilters({ ...filters, query })}
          placeholder={t("inventory.search.items")}
          className="flex-1"
          inputClassName="h-14 rounded-2xl text-base"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative size-14 shrink-0 rounded-full"
          onClick={() => onFiltersOpenChange(!filtersOpen)}
        >
          <Filter className="size-6 text-primary" />
          {activeFilterCount > 0 ? (
            <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
          <span className="sr-only">{t("common.table.filter")}</span>
        </Button>
      </div>

      {filtersOpen ? (
        <div className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
          <SearchableSelect
            aria-label={t("inventory.filters.status")}
            value={filters.status}
            onValueChange={(status) => updateFilters({ ...filters, status: status as InventoryFilterState["status"] })}
            searchPlaceholder={t("inventory.filters.allStatuses")}
            options={[{ value: "all", label: t("inventory.filters.allStatuses") }, ...getInventoryStatusOptions(t)]}
            mobileSheet
          />
          <SearchableSelect
            aria-label={t("inventory.filters.location")}
            value={filters.location}
            onValueChange={(location) =>
              updateFilters({ ...filters, location: location as InventoryFilterState["location"] })
            }
            searchPlaceholder={t("inventory.filters.allLocations")}
            options={[{ value: "all", label: t("inventory.filters.allLocations") }, ...getInventoryLocationOptions(t)]}
            mobileSheet
          />
          <SearchableSelect
            aria-label={t("inventory.filters.category")}
            value={filters.category}
            onValueChange={(category) =>
              updateFilters({ ...filters, category: category as InventoryFilterState["category"] })
            }
            searchPlaceholder={t("inventory.filters.allCategories")}
            options={[{ value: "all", label: t("inventory.filters.allCategories") }, ...getInventoryCategoryOptions(t)]}
            mobileSheet
          />
          {hasActiveFilters ? (
            <Button type="button" variant="outline" className="h-12 w-full rounded-xl" onClick={onResetFilters}>
              {t("common.table.clearAll")}
            </Button>
          ) : null}
        </div>
      ) : null}

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
              t("inventory.columns.sku"),
              t("inventory.columns.item"),
              t("inventory.columns.available"),
              t("inventory.columns.location"),
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
