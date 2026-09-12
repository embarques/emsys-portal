"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableFilterSelect } from "@/components/app-shell/table-filter-select";
import { useTranslation } from "@/lib/i18n";
import {
  addTableFilterRow,
  formatTableFilterRowsLogic,
  removeTableFilterRow,
  resolveFilterFieldDefinition,
  resolveFilterRowOptions,
  updateTableFilterRow,
  type TableFilterFieldDefinition,
  type TableFilterFieldOption,
  type TableFilterRowState,
} from "@/lib/table/filter-builder";
import { getFilterOperatorLabels, getTableFilterJoinOptions } from "@/lib/table/filter-labels";
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
  const { t } = useTranslation();
  const filterOperatorLabels = getFilterOperatorLabels(t);
  const filterJoinOptions = getTableFilterJoinOptions(t);

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
        {t("common.table.combineFiltersHint", {
          and: t("common.filterOperators.and"),
          or: t("common.filterOperators.or"),
        })}
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
          <div key={row.id} className="flex min-w-0 items-center gap-2">
            {index === 0 ? (
              <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("common.table.where")}
              </span>
            ) : (
              <TableFilterSelect
                aria-label={`Filter join ${index + 1}`}
                className="w-[4.75rem] shrink-0 flex-none px-2 text-xs font-semibold uppercase tracking-wide"
                value={row.join}
                options={filterJoinOptions}
                onChange={(value) =>
                  updateRow(row.id, { join: value as TableFilterRowState["join"] })
                }
              />
            )}

            <TableFilterSelect
              aria-label={`Filter field ${index + 1}`}
              className="w-[7rem] shrink-0 flex-none"
              value={row.field}
              placeholder={t("common.table.field")}
              mutedWhenEmpty
              options={fields.map((field) => ({ value: field.field, label: field.label }))}
              onChange={(value) => updateRow(row.id, { field: value })}
            />

            {usesRange ? (
              <span className="inline-flex h-9 w-[7.25rem] shrink-0 items-center rounded-md border border-input bg-muted/40 px-3 text-xs font-medium text-muted-foreground">
                {t("common.table.inRange")}
              </span>
            ) : (
              <TableFilterSelect
                aria-label={`Filter condition ${index + 1}`}
                className="w-[7.25rem] shrink-0 flex-none"
                value={row.operator}
                placeholder={t("common.table.condition")}
                mutedWhenEmpty
                disabled={!canPickOperator}
                options={operators.map((operator) => ({
                  value: operator,
                  label: filterOperatorLabels[operator],
                }))}
                onChange={(value) => updateRow(row.id, { operator: value })}
              />
            )}

            {usesSelect ? (
              <TableFilterSelect
                aria-label={`Filter value ${index + 1}`}
                className="min-w-0 flex-1"
                value={row.value}
                placeholder={t("common.table.value")}
                mutedWhenEmpty
                disabled={!canPickValue}
                options={valueOptions}
                onChange={(value) => updateRow(row.id, { value })}
              />
            ) : (
              <Input
                aria-label={`Filter value ${index + 1}`}
                className="h-9 min-w-0 flex-1 shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                value={row.value}
                disabled={!canPickValue}
                placeholder={canPickValue ? (definition?.placeholder ?? t("common.table.enterValue")) : t("common.table.value")}
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
        {t("common.table.newFilter")}
      </button>

      {filterLogicPreview ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("common.table.queryLogic")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{filterLogicPreview}</p>
        </div>
      ) : null}
    </div>
  );
}
