"use client";

import { ChevronLeft, ChevronRight, Plus, Building2 } from "lucide-react";

import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { InventorySupplierMobileRow } from "@/components/inventory/inventory-supplier-mobile-row";
import { InventoryItemMobileSelectionToolbar } from "@/components/inventory/inventory-item-mobile-selection-toolbar";
import { Button } from "@/components/ui/button";
import type { InventorySupplier } from "@/lib/inventory/types/suppliers";
import { useTranslation } from "@/lib/i18n";

type InventorySupplierMobileListProps = {
  query: string;
  suppliers: InventorySupplier[];
  pageRows: InventorySupplier[];
  selectedIds: string[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onOpen: (supplier: InventorySupplier) => void;
  onEdit?: (supplier: InventorySupplier) => void;
  onDelete?: (supplier: InventorySupplier | InventorySupplier[]) => void;
  onSelectedIdsChange: (ids: string[]) => void;
  onAddSupplier: () => void;
};

export function InventorySupplierMobileList({
  query,
  suppliers,
  pageRows,
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
  onAddSupplier,
}: InventorySupplierMobileListProps) {
  const { t } = useTranslation();
  const selectedSuppliers = suppliers.filter((supplier) => selectedIds.includes(supplier.id));
  const selectionMode = selectedIds.length > 0;

  function toggleSelected(supplierId: string, checked: boolean) {
    onSelectedIdsChange(checked ? [...selectedIds, supplierId] : selectedIds.filter((id) => id !== supplierId));
  }

  return (
    <section className="space-y-5 overflow-x-hidden md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-normal text-foreground">{t("inventory.submenus.suppliers")}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t("inventory.pages.suppliers")}</p>
        </div>
        <Button type="button" size="icon" className="size-12 shrink-0 rounded-2xl" onClick={onAddSupplier}>
          <Plus className="size-6" />
          <span className="sr-only">{t("inventory.actions.addSupplier")}</span>
        </Button>
      </div>

      <TableSearchInput
        value={query}
        onChange={(value) => {
          onQueryChange(value);
          onPageChange(1);
        }}
        placeholder={t("inventory.search.suppliers")}
        inputClassName="h-14 rounded-2xl text-base"
      />

      <InventoryItemMobileSelectionToolbar
        selectedCount={selectedIds.length}
        canEdit={selectedIds.length === 1}
        onClear={() => onSelectedIdsChange([])}
        onEdit={() => {
          const supplier = selectedSuppliers[0];
          if (supplier && onEdit) onEdit(supplier);
        }}
        onDelete={() => onDelete?.(selectedSuppliers)}
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
            icon={Building2}
            title={t("inventory.loading.suppliers.title")}
            description={t("inventory.loading.suppliers.description")}
            columns={[
              t("inventory.form.fields.companyName"),
              t("inventory.form.fields.contactNames"),
              t("inventory.form.fields.phones"),
            ]}
          />
        ) : pageRows.length > 0 ? (
          pageRows.map((supplier) => (
            <InventorySupplierMobileRow
              key={supplier.id}
              supplier={supplier}
              selected={selectedIds.includes(supplier.id)}
              selectionMode={selectionMode}
              onOpen={onOpen}
              onEdit={onEdit ?? (() => undefined)}
              onDelete={onDelete ?? (() => undefined)}
              onToggleSelected={toggleSelected}
            />
          ))
        ) : (
          <p className="py-8 text-center text-muted-foreground">{t("inventory.empty.suppliers")}</p>
        )}
      </div>
    </section>
  );
}
