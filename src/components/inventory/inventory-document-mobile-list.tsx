"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

type InventoryDocumentMobileListProps<T extends { id: string }> = {
  title: string;
  description: string;
  addLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  loadingTitle: string;
  loadingDescription: string;
  loadingColumns: string[];
  icon: LucideIcon;
  query: string;
  pageRows: T[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onAdd?: () => void;
  renderRow: (row: T) => React.ReactNode;
};

export function InventoryDocumentMobileList<T extends { id: string }>({
  title,
  description,
  addLabel,
  searchPlaceholder,
  emptyMessage,
  loadingTitle,
  loadingDescription,
  loadingColumns,
  icon,
  query,
  pageRows,
  isLoading,
  page,
  totalPages,
  onQueryChange,
  onPageChange,
  onAdd,
  renderRow,
}: InventoryDocumentMobileListProps<T>) {
  const { t } = useTranslation();

  return (
    <section className="space-y-5 overflow-x-hidden md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-normal text-foreground">{title}</h1>
          <p className="mt-1 text-base text-muted-foreground">{description}</p>
        </div>
        {onAdd ? (
          <Button type="button" size="icon" className="size-12 shrink-0 rounded-2xl" onClick={onAdd}>
            <Plus className="size-6" />
            <span className="sr-only">{addLabel}</span>
          </Button>
        ) : null}
      </div>

      <TableSearchInput
        value={query}
        onChange={(value) => {
          onQueryChange(value);
          onPageChange(1);
        }}
        placeholder={searchPlaceholder}
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
          <DirectoryTableLoader icon={icon} title={loadingTitle} description={loadingDescription} columns={loadingColumns} />
        ) : pageRows.length > 0 ? (
          pageRows.map((row) => renderRow(row))
        ) : (
          <p className="py-8 text-center text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}
