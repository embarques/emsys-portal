"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableFilterSelect } from "@/components/app-shell/table-filter-select";
import {
  addTableFilterRow,
  FILTER_OPERATOR_LABELS,
  formatTableFilterRowsLogic,
  removeTableFilterRow,
  resolveFilterFieldDefinition,
  resolveFilterRowOptions,
  TABLE_FILTER_JOIN_OPTIONS,
  updateTableFilterRow,
  type TableFilterFieldDefinition,
  type TableFilterFieldOption,
  type TableFilterRowState,
} from "@/lib/table/filter-builder";
import { useTableAdvancedFilterPanel } from "@/lib/table/hooks/use-table-advanced-filter-panel";
import { cn } from "@/lib/utils";

type TableAdvancedFilterBuilderProps = {
  rows: TableFilterRowState[];
  fields: TableFilterFieldDefinition[];
  dynamicOptions?: Record<string, TableFilterFieldOption[]>;
  onChange: (rows: TableFilterRowState[]) => void;
  /** When true and there are no rows, inserts one blank row to edit. */
  open?: boolean;
  seedEmptyRowWhenOpen?: boolean;
  className?: string;
};

export function TableAdvancedFilterBuilder({
  rows,
  fields,
  dynamicOptions = {},
  onChange,
  open = false,
  seedEmptyRowWhenOpen = true,
  className,
}: TableAdvancedFilterBuilderProps) {
  useTableAdvancedFilterPanel({
    rows,
    open,
    onRowsChange: onChange,
    seedEmptyRowWhenOpen,
  });

  if (fields.length === 0) return null;

  const filterLogicPreview = formatTableFilterRowsLogic(rows, fields, dynamicOptions);

  function updateRow(rowId: string, patch: Partial<TableFilterRowState>) {
    onChange(updateTableFilterRow(rows, rowId, patch, fields));
  }

  return (
    <div className={cn("space-y-3", className)} onMouseDown={(event) => event.stopPropagation()}>
      <p className="text-xs text-muted-foreground">
        Combine rows with <span className="font-medium text-foreground">AND</span> or{" "}
        <span className="font-medium text-foreground">OR</span> to build nested queries.
      </p>

      {rows.map((row, index) => {
        const definition = row.field ? resolveFilterFieldDefinition(fields, row.field) : undefined;
        const operators = definition?.operators ?? [];
        const valueOptions = resolveFilterRowOptions(definition, dynamicOptions);
        const usesRange = definition?.valueType === "range";
        const usesSelect = definition?.valueType === "select";
        const canPickOperator = Boolean(definition) && !usesRange;
        const canPickValue = Boolean(definition && (usesRange || row.operator));

        return (
          <div key={row.id} className="flex flex-wrap items-center gap-2">
            {index === 0 ? (
              <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Where
              </span>
            ) : (
              <TableFilterSelect
                aria-label={`Filter join ${index + 1}`}
                className="w-[4.75rem] shrink-0 px-2 text-xs font-semibold uppercase tracking-wide"
                value={row.join}
                options={TABLE_FILTER_JOIN_OPTIONS}
                onChange={(value) =>
                  updateRow(row.id, { join: value as TableFilterRowState["join"] })
                }
              />
            )}

            <TableFilterSelect
              aria-label={`Filter field ${index + 1}`}
              className="min-w-[8.5rem] max-w-[10rem]"
              value={row.field}
              placeholder="Field"
              placeholderDisabled={false}
              mutedWhenEmpty
              options={fields.map((field) => ({ value: field.field, label: field.label }))}
              onChange={(value) => updateRow(row.id, { field: value })}
            />

            {usesRange ? (
              <span className="inline-flex h-9 min-w-[8.5rem] max-w-[11rem] shrink-0 items-center rounded-md border border-input bg-muted/40 px-3 text-xs font-medium text-muted-foreground">
                In range
              </span>
            ) : (
              <TableFilterSelect
                aria-label={`Filter condition ${index + 1}`}
                className="min-w-[8.5rem] max-w-[11rem]"
                value={row.operator}
                placeholder="Condition"
                mutedWhenEmpty
                disabled={!canPickOperator}
                options={operators.map((operator) => ({
                  value: operator,
                  label: FILTER_OPERATOR_LABELS[operator],
                }))}
                onChange={(value) => updateRow(row.id, { operator: value })}
              />
            )}

            {usesSelect ? (
              <TableFilterSelect
                aria-label={`Filter value ${index + 1}`}
                className="min-w-[9rem] flex-[2]"
                value={row.value}
                placeholder="Value"
                mutedWhenEmpty
                disabled={!canPickValue}
                options={valueOptions}
                onChange={(value) => updateRow(row.id, { value })}
              />
            ) : (
              <Input
                aria-label={`Filter value ${index + 1}`}
                className="h-9 min-w-[9rem] flex-[2] shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                value={row.value}
                disabled={!canPickValue}
                placeholder={canPickValue ? (definition?.placeholder ?? "Enter value…") : "Value"}
                onChange={(event) => updateRow(row.id, { value: event.target.value })}
              />
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Remove filter ${index + 1}`}
              onClick={() => onChange(removeTableFilterRow(rows, row.id))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        onClick={() => onChange(addTableFilterRow(rows))}
      >
        <Plus className="h-4 w-4" />
        New filter
      </button>

      {filterLogicPreview ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Query logic
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{filterLogicPreview}</p>
        </div>
      ) : null}
    </div>
  );
}
