"use client";

import type { ReactNode } from "react";

import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import { TableFilterPanel } from "@/components/app-shell/table-directory-toolbar";
import type {
  TableFilterFieldDefinition,
  TableFilterFieldOption,
  TableFilterRowState,
} from "@/lib/table/filter-builder";

type TableAdvancedFilterPanelProps = {
  /** Saved-preset scope, typically the feature/table name. */
  presetScope: string;
  open: boolean;
  isLoading?: boolean;
  rows: TableFilterRowState[];
  fields: TableFilterFieldDefinition[];
  dynamicOptions?: Record<string, TableFilterFieldOption[]>;
  resultSummary?: string;
  onRowsChange: (rows: TableFilterRowState[]) => void;
  onClearAll?: () => void;
  /** Extra controls rendered below the advanced filter builder (e.g. route employee). */
  children?: ReactNode;
};

/** Standard directory filter dropdown body: presets, clear-all, and the row builder. */
export function TableAdvancedFilterPanel({
  presetScope,
  open,
  isLoading,
  rows,
  fields,
  dynamicOptions,
  resultSummary,
  onRowsChange,
  onClearAll,
  children,
}: TableAdvancedFilterPanelProps) {
  return (
    <TableFilterPanel
      isLoading={isLoading}
      resultSummary={resultSummary}
      presets={{ storageKey: presetScope, rows, fields, onApply: onRowsChange }}
      onClearAll={onClearAll}
    >
      <TableAdvancedFilterBuilder
        open={open}
        rows={rows}
        fields={fields}
        dynamicOptions={dynamicOptions}
        onChange={onRowsChange}
      />
      {children}
    </TableFilterPanel>
  );
}
