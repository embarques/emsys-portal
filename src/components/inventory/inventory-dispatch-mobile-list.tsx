"use client";

import { ChevronLeft, ChevronRight, Plus, Truck } from "lucide-react";

import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { InventoryDispatchMobileRow } from "@/components/inventory/inventory-dispatch-mobile-row";
import { Button } from "@/components/ui/button";
import type { InventoryItem } from "@/lib/inventory/types/catalog";
import type { InventoryDispatch } from "@/lib/inventory/types/documents";
import { useTranslation } from "@/lib/i18n";

type InventoryDispatchMobileListProps = {
  query: string;
  pageRows: InventoryDispatch[];
  items: InventoryItem[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onOpen: (dispatch: InventoryDispatch) => void;
  onAddDispatch: () => void;
};

export function InventoryDispatchMobileList({
  query,
  pageRows,
  items,
  isLoading,
  page,
  totalPages,
  onQueryChange,
  onPageChange,
  onOpen,
  onAddDispatch,
}: InventoryDispatchMobileListProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-5 overflow-x-hidden md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-normal text-foreground">{t("inventory.submenus.dispatches")}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t("inventory.pages.dispatches")}</p>
        </div>
        <Button type="button" size="icon" className="size-12 shrink-0 rounded-2xl" onClick={onAddDispatch}>
          <Plus className="size-6" />
          <span className="sr-only">{t("inventory.actions.newDispatch")}</span>
        </Button>
      </div>

      <TableSearchInput
        value={query}
        onChange={(value) => {
          onQueryChange(value);
          onPageChange(1);
        }}
        placeholder={t("inventory.search.dispatches")}
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
            icon={Truck}
            title={t("inventory.loading.dispatches.title")}
            description={t("inventory.loading.dispatches.description")}
            columns={[
              t("inventory.columns.item"),
              t("inventory.form.fields.quantityDispatched"),
              t("inventory.columns.date"),
            ]}
          />
        ) : pageRows.length > 0 ? (
          pageRows.map((dispatch) => (
            <InventoryDispatchMobileRow
              key={dispatch.id}
              dispatch={dispatch}
              item={items.find((entry) => entry.id === dispatch.itemId)}
              onOpen={onOpen}
            />
          ))
        ) : (
          <p className="py-8 text-center text-muted-foreground">{t("inventory.empty.dispatches")}</p>
        )}
      </div>
    </section>
  );
}
