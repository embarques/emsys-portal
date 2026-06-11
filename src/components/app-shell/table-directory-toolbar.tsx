"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown, Filter } from "lucide-react";

import { ColumnVisibilityMenu } from "@/components/app-shell/column-visibility-menu";
import type { TableColumnLayout } from "@/components/app-shell/use-column-visibility";
import { cn } from "@/lib/utils";

type TableFilterToggleProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount?: number;
  className?: string;
};

export function TableFilterToggle({
  open,
  onOpenChange,
  activeCount = 0,
  className,
}: TableFilterToggleProps) {
  const hasActiveFilters = activeCount > 0;

  return (
    <div
      className={cn(
        "relative inline-flex h-9 shrink-0 overflow-hidden rounded-md border shadow-xs",
        open || hasActiveFilters ? "border-primary/30 bg-primary/10" : "border-input bg-background",
        className,
      )}
    >
      <button
        type="button"
        className="flex items-center gap-2 px-3 text-sm font-medium text-foreground outline-none hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        aria-expanded={open}
        aria-controls="table-filter-panel"
        onClick={() => onOpenChange(!open)}
      >
        <Filter className="h-4 w-4" />
        Filter
      </button>
      <div className="w-px self-stretch bg-border/80" aria-hidden />
      <button
        type="button"
        className="flex min-w-[2rem] items-center justify-center px-2 text-foreground outline-none hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        aria-label={
          hasActiveFilters
            ? `${activeCount} active filter${activeCount === 1 ? "" : "s"}. ${open ? "Hide filters" : "Show filters"}`
            : open
              ? "Hide filters"
              : "Show filters"
        }
        onClick={() => onOpenChange(!open)}
      >
        {hasActiveFilters ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none tabular-nums text-primary-foreground">
            {activeCount}
          </span>
        ) : (
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        )}
      </button>
    </div>
  );
}

type TableFilterDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount?: number;
  children?: ReactNode;
};

function TableFilterDropdown({ open, onOpenChange, activeCount = 0, children }: TableFilterDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <TableFilterToggle open={open} onOpenChange={onOpenChange} activeCount={activeCount} />

      {open && children ? (
        <div
          id="table-filter-panel"
          className="absolute left-0 top-[calc(100%+0.375rem)] z-50 w-[min(44rem,calc(100vw-2rem))]"
          role="dialog"
          aria-label="Table filters"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type TableDirectoryToolbarProps = {
  search: ReactNode;
  filtersOpen?: boolean;
  onFiltersOpenChange?: (open: boolean) => void;
  activeFilterCount?: number;
  showFilterToggle?: boolean;
  filterPanel?: ReactNode;
  columnLayout?: TableColumnLayout;
};

export function TableDirectoryToolbar({
  search,
  filtersOpen = false,
  onFiltersOpenChange,
  activeFilterCount = 0,
  showFilterToggle = true,
  filterPanel,
  columnLayout,
}: TableDirectoryToolbarProps) {
  return (
    <div className="flex w-full flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex min-w-0 flex-col gap-1">{search}</div>
        {showFilterToggle && onFiltersOpenChange ? (
          <TableFilterDropdown
            open={filtersOpen}
            onOpenChange={onFiltersOpenChange}
            activeCount={activeFilterCount}
          >
            {filterPanel}
          </TableFilterDropdown>
        ) : null}
      </div>
      {columnLayout ? (
        <div className="shrink-0">
          <ColumnVisibilityMenu columnLayout={columnLayout} />
        </div>
      ) : null}
    </div>
  );
}

type TableFilterPanelProps = {
  title?: string;
  resultSummary?: string;
  onClearAll?: () => void;
  children: ReactNode;
  className?: string;
};

export function TableFilterPanel({
  title = "Filters",
  resultSummary,
  onClearAll,
  children,
  className,
}: TableFilterPanelProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-semibold leading-none">{title}</h3>
          {resultSummary ? (
            <p className="text-xs text-muted-foreground">{resultSummary}</p>
          ) : null}
        </div>
        {onClearAll ? (
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={onClearAll}
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div
        className="max-h-[min(24rem,70vh)] space-y-4 overflow-y-auto p-4"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

type TableFilterSectionProps = {
  label: string;
  children: ReactNode;
};

export function TableFilterSection({ label, children }: TableFilterSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-12 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Where
        </span>
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-14">{children}</div>
    </div>
  );
}
