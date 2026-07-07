"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Filter } from "lucide-react";

import { ColumnVisibilityMenu } from "@/components/app-shell/column-visibility-menu";
import { FilterPresetMenu } from "@/components/app-shell/filter-preset-menu";
import type { TableColumnLayout } from "@/components/app-shell/use-column-visibility";
import { useTranslation } from "@/lib/i18n";
import type { TableFilterFieldDefinition, TableFilterRowState } from "@/lib/table/filter-types";
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
  const { t } = useTranslation();
  const hasActiveFilters = activeCount > 0;
  const filterToggleAction = open ? t("common.table.hideFilters") : t("common.table.showFilters");
  const activeFiltersSummaryKey =
    activeCount === 1 ? "common.table.activeFiltersSummary_one" : "common.table.activeFiltersSummary_other";

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
        {t("common.table.filter")}
      </button>
      <div className="w-px self-stretch bg-border/80" aria-hidden />
      <button
        type="button"
        className="flex min-w-[2rem] items-center justify-center px-2 text-foreground outline-none hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        aria-label={
          hasActiveFilters
            ? t(activeFiltersSummaryKey, {
                count: activeCount,
                action: filterToggleAction,
              })
            : filterToggleAction
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
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!open || !containerRef.current) {
      setPanelPosition(null);
      return;
    }

    function updatePosition() {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.min(704, window.innerWidth - 16);
      const top = rect.bottom + 6;
      let left = rect.left;

      if (left + width > window.innerWidth - 8) {
        left = window.innerWidth - 8 - width;
      }

      left = Math.max(8, left);
      setPanelPosition({ top, left, width });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      // Dropdowns inside the panel (e.g. filter selects) render in their own
      // portal outside panelRef. Ignore interactions with those so picking an
      // option doesn't close the whole filter panel.
      if (
        target instanceof Element &&
        target.closest("[data-radix-popper-content-wrapper]")
      ) {
        return;
      }

      onOpenChange(false);
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

  const panel =
    open && children && panelPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id="table-filter-panel"
            role="dialog"
            aria-label={t("common.table.tableFiltersAria")}
            className="fixed z-[100]"
            style={{
              top: panelPosition.top,
              left: panelPosition.left,
              width: panelPosition.width,
            }}
          >
            {children}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={containerRef} className="relative shrink-0">
        <TableFilterToggle open={open} onOpenChange={onOpenChange} activeCount={activeCount} />
      </div>
      {panel}
    </>
  );
}

type TableDirectoryToolbarProps = {
  search: ReactNode;
  /** Compact count/summary shown inline beside search (keeps toolbar one row tall). */
  searchSummary?: string;
  filtersOpen?: boolean;
  onFiltersOpenChange?: (open: boolean) => void;
  activeFilterCount?: number;
  showFilterToggle?: boolean;
  filterPanel?: ReactNode;
  columnLayout?: TableColumnLayout;
};

export function TableDirectoryToolbar({
  search,
  searchSummary,
  filtersOpen = false,
  onFiltersOpenChange,
  activeFilterCount = 0,
  showFilterToggle = true,
  filterPanel,
  columnLayout,
}: TableDirectoryToolbarProps) {
  const showFilter = showFilterToggle && onFiltersOpenChange;
  const showRightCluster = searchSummary || columnLayout;

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 basis-[min(100%,18rem)]">
        <div className="min-w-0 w-full">{search}</div>
        {showFilter ? (
          <TableFilterDropdown
            open={filtersOpen}
            onOpenChange={onFiltersOpenChange}
            activeCount={activeFilterCount}
          >
            {filterPanel}
          </TableFilterDropdown>
        ) : null}
      </div>

      {showRightCluster ? (
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          {searchSummary ? (
            <span
              className="hidden shrink-0 items-center rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground sm:inline-flex"
              aria-live="polite"
            >
              {searchSummary}
            </span>
          ) : null}
          {columnLayout ? <ColumnVisibilityMenu columnLayout={columnLayout} /> : null}
        </div>
      ) : null}
    </div>
  );
}

type TableFilterPanelPresets = {
  /** Unique localStorage scope for saved presets, typically the feature name. */
  storageKey: string;
  /** Current advanced-filter rows to capture when saving a preset. */
  rows: TableFilterRowState[];
  /** Field definitions used to determine whether the current rows are saveable. */
  fields?: TableFilterFieldDefinition[];
  /** Applies a selected preset's rows. */
  onApply: (rows: TableFilterRowState[]) => void;
};

type TableFilterPanelProps = {
  title?: string;
  resultSummary?: string;
  onClearAll?: () => void;
  presets?: TableFilterPanelPresets;
  children: ReactNode;
  className?: string;
};

export function TableFilterPanel({
  title,
  resultSummary,
  onClearAll,
  presets,
  children,
  className,
}: TableFilterPanelProps) {
  const { t } = useTranslation();
  const panelTitle = title ?? t("common.table.filters");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-semibold leading-none">{panelTitle}</h3>
          {resultSummary ? (
            <p className="text-xs text-muted-foreground">{resultSummary}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {presets ? (
            <FilterPresetMenu
              storageKey={presets.storageKey}
              rows={presets.rows}
              fields={presets.fields}
              onApply={presets.onApply}
            />
          ) : null}
          {onClearAll ? (
            <button
              type="button"
              className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={onClearAll}
            >
              {t("common.table.clearAll")}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="max-h-[min(24rem,70vh)] space-y-4 overflow-x-auto overflow-y-auto p-4"
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
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-12 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("common.table.where")}
        </span>
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-14">{children}</div>
    </div>
  );
}
