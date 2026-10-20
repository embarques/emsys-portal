"use client";

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
  rows: TableFilterRowState[];
  fields: TableFilterFieldDefinition[];
  dynamicOptions?: Record<string, TableFilterFieldOption[]>;
  resultSummary?: string;
  onRowsChange: (rows: TableFilterRowState[]) => void;
  onClearAll?: () => void;
};

/** Standard directory filter dropdown body: presets, clear-all, and the row builder. */
export function TableAdvancedFilterPanel({
  presetScope,
  open,
  rows,
  fields,
  dynamicOptions,
  resultSummary,
  onRowsChange,
  onClearAll,
}: TableAdvancedFilterPanelProps) {
  return (
    <TableFilterPanel
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
    </TableFilterPanel>
  );
}
