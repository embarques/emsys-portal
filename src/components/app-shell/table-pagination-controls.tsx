"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import {
  parseTablePageSize,
  TABLE_PAGE_SIZE_ALL,
  TABLE_PAGE_SIZES,
  type TablePageSize,
} from "@/lib/table/page-size";
import { cn } from "@/lib/utils";

type TablePaginationControlsProps = {
  page: number;
  totalPages: number;
  pageSize: TablePageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: TablePageSize) => void;
  disabled?: boolean;
  /** Compact footer controls vs the larger mobile pager. */
  layout?: "footer" | "mobile";
};

export function TablePaginationControls({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  layout = "footer",
}: TablePaginationControlsProps) {
  const { t } = useTranslation();
  const isMobile = layout === "mobile";
  const pageSizeOptions = [
    ...TABLE_PAGE_SIZES.map((size) => ({
      value: String(size),
      label: String(size),
    })),
    { value: TABLE_PAGE_SIZE_ALL, label: t("common.pagination.all") },
  ];

  const pageSizeSelect = (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t("common.pagination.view")}</span>
      <div className={cn("shrink-0", isMobile ? "w-[6.5rem]" : "w-[5.75rem]")}>
        <SearchableSelect
          searchable={false}
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(parseTablePageSize(value))}
          options={pageSizeOptions}
          placeholder={t("common.pagination.view")}
          emptyMessage={t("common.pagination.pageSizeEmpty")}
          disabled={disabled}
          className={cn(
            "border border-input bg-background shadow-xs",
            isMobile
              ? "h-11 min-h-11 rounded-xl max-md:min-h-11"
              : "h-9 min-h-9 rounded-md max-md:min-h-9 max-md:rounded-md",
          )}
          aria-label={t("common.pagination.pageSize")}
        />
      </div>
    </div>
  );

  const pagerButtons = isMobile ? (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      <Button
        variant="outline"
        className="h-11 rounded-xl"
        disabled={page <= 1 || disabled}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        <ChevronLeft className="h-4 w-4" />
        {t("common.actions.previous")}
      </Button>
      <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
        {t("common.pagination.pageOf", { current: page, total: totalPages })}
      </span>
      <Button
        variant="outline"
        className="h-11 rounded-xl"
        disabled={page >= totalPages || disabled}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        {t("common.actions.next")}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  ) : (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1 || disabled}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        <ChevronLeft className="h-4 w-4" />
        {t("common.actions.previous")}
      </Button>
      <span className="px-2 text-sm text-muted-foreground">
        {t("common.pagination.pageOf", { current: page, total: totalPages })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages || disabled}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        {t("common.actions.next")}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">{pageSizeSelect}</div>
        {pagerButtons}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pageSizeSelect}
      {pagerButtons}
    </div>
  );
}
