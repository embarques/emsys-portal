"use client";

import { ChevronLeft, ChevronRight, PackageCheck, Plus } from "lucide-react";

import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { InventoryReceiptMobileRow } from "@/components/inventory/inventory-receipt-mobile-row";
import { Button } from "@/components/ui/button";
import type { InventoryReceipt } from "@/lib/inventory/types/documents";
import type { InventoryItem } from "@/lib/inventory/types/catalog";
import type { InventorySupplier } from "@/lib/inventory/types/suppliers";
import { useTranslation } from "@/lib/i18n";

type InventoryReceiptMobileListProps = {
  query: string;
  pageRows: InventoryReceipt[];
  items: InventoryItem[];
  suppliers: InventorySupplier[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onOpen: (receipt: InventoryReceipt) => void;
  onAddReceipt: () => void;
  onEdit?: (receipt: InventoryReceipt) => void;
  onDelete?: (receipt: InventoryReceipt) => void;
};

export function InventoryReceiptMobileList({
  query,
  pageRows,
  items,
  suppliers,
  isLoading,
  page,
  totalPages,
  onQueryChange,
  onPageChange,
  onOpen,
  onAddReceipt,
  onEdit,
  onDelete,
}: InventoryReceiptMobileListProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-5 overflow-x-hidden md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-normal text-foreground">{t("inventory.submenus.receipts")}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t("inventory.pages.receipts")}</p>
        </div>
        <Button type="button" size="icon" className="size-12 shrink-0 rounded-2xl" onClick={onAddReceipt}>
          <Plus className="size-6" />
          <span className="sr-only">{t("inventory.actions.newReceipt")}</span>
        </Button>
      </div>

      <TableSearchInput
        value={query}
        onChange={(value) => {
          onQueryChange(value);
          onPageChange(1);
        }}
        placeholder={t("inventory.search.receipts")}
        inputClassName="h-14 rounded-2xl text-base"
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
            icon={PackageCheck}
            title={t("inventory.loading.receipts.title")}
            description={t("inventory.loading.receipts.description")}
            columns={[
              t("inventory.columns.item"),
              t("inventory.form.fields.quantityReceived"),
              t("inventory.columns.supplier"),
            ]}
          />
        ) : pageRows.length > 0 ? (
          pageRows.map((receipt) => (
            <InventoryReceiptMobileRow
              key={receipt.id}
              receipt={receipt}
              item={items.find((entry) => entry.id === receipt.itemId)}
              supplier={suppliers.find((entry) => entry.id === receipt.supplierId)}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        ) : (
          <p className="py-8 text-center text-muted-foreground">{t("inventory.empty.receipts")}</p>
        )}
      </div>
    </section>
  );
}
