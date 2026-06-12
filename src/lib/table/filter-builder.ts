import {
  FILTER_OPERATOR_LABELS,
  type TableFilterFieldDefinition,
  type TableFilterFieldOption,
  type TableFilterOperator,
  type TableFilterRowState,
} from "@/lib/table/filter-types";

export type {
  TableFilterFieldDefinition,
  TableFilterFieldOption,
  TableFilterRowJoin,
  TableFilterRowState,
} from "@/lib/table/filter-types";

export { FILTER_OPERATOR_LABELS, TABLE_FILTER_JOIN_OPTIONS } from "@/lib/table/filter-types";

export function createFilterRowId(): string {
  return crypto.randomUUID();
}

export function createEmptyFilterRow(): TableFilterRowState {
  return {
    id: createFilterRowId(),
    join: "and",
    field: "",
    operator: "",
    value: "",
  };
}

export function createDefaultFilterRows(): TableFilterRowState[] {
  return [];
}

export function isCompleteFilterRow(
  row: TableFilterRowState,
  fields?: TableFilterFieldDefinition[],
): boolean {
  let operator = row.operator.trim();

  if (!operator && fields) {
    const definition = resolveFilterFieldDefinition(fields, row.field);
    if (definition && definition.operators.length === 1) {
      operator = resolveDefaultFilterOperator(definition);
    }
  }

  return Boolean(row.field.trim() && operator && row.value.trim());
}

export function countCompleteFilterRows(
  rows: TableFilterRowState[],
  fields?: TableFilterFieldDefinition[],
): number {
  return rows.filter((row) => isCompleteFilterRow(row, fields)).length;
}

export function resolveDefaultFilterOperator(definition: TableFilterFieldDefinition): string {
  return definition.operators[0] ?? "eq";
}

export function resolveFilterOperatorLabel(
  definition: TableFilterFieldDefinition | undefined,
  operator: string,
): string {
  if (!definition) return operator;
  if (definition.valueType === "range") return "in range";

  const operatorKey = operator as TableFilterOperator;
  return (FILTER_OPERATOR_LABELS[operatorKey] ?? operator).toLowerCase();
}

export function formatTableFilterRowsLogic(
  rows: TableFilterRowState[],
  fields: TableFilterFieldDefinition[],
  dynamicOptions: Record<string, TableFilterFieldOption[]> = {},
): string | null {
  const parts: string[] = [];

  rows.forEach((row) => {
    if (!isCompleteFilterRow(row, fields)) return;

    const definition = resolveFilterFieldDefinition(fields, row.field);
    const fieldLabel = definition?.label ?? row.field;
    const operatorLabel = resolveFilterOperatorLabel(definition, row.operator);

    let valueLabel = row.value;
    const valueOptions = resolveFilterRowOptions(definition, dynamicOptions);
    const selectedOption = valueOptions.find((option) => option.value === row.value);
    if (selectedOption) {
      valueLabel = selectedOption.label;
    }

    const clause = `${fieldLabel} ${operatorLabel} “${valueLabel}”`;

    if (parts.length === 0) {
      parts.push(clause);
      return;
    }

    parts.push(`${row.join === "or" ? "OR" : "AND"} ${clause}`);
  });

  return parts.length > 0 ? parts.join(" ") : null;
}

export function resolveFilterFieldDefinition(
  fields: TableFilterFieldDefinition[],
  fieldKey: string,
): TableFilterFieldDefinition | undefined {
  return fields.find((entry) => entry.field === fieldKey);
}

export function resolveFilterRowOptions(
  definition: TableFilterFieldDefinition | undefined,
  dynamicOptions: Record<string, TableFilterFieldOption[]>,
): TableFilterFieldOption[] {
  if (!definition) return [];

  if (definition.options?.length) {
    return definition.options;
  }

  if (definition.optionsSource) {
    return dynamicOptions[definition.optionsSource] ?? [];
  }

  return [];
}

export function normalizeFilterRowForField(
  row: TableFilterRowState,
  fields: TableFilterFieldDefinition[],
): TableFilterRowState {
  const definition = resolveFilterFieldDefinition(fields, row.field);
  if (!definition) {
    return { ...row, operator: "", value: "" };
  }

  return {
    ...row,
    field: definition.field,
    operator: definition.operators.length === 1 ? resolveDefaultFilterOperator(definition) : "",
    value: "",
  };
}

export function updateTableFilterRow(
  rows: TableFilterRowState[],
  rowId: string,
  patch: Partial<TableFilterRowState>,
  fields: TableFilterFieldDefinition[],
): TableFilterRowState[] {
  return rows.map((row) => {
    if (row.id !== rowId) return row;

    if (patch.field !== undefined && patch.field !== row.field) {
      if (!patch.field) {
        return { ...row, field: "", operator: "", value: "" };
      }

      return normalizeFilterRowForField({ ...row, field: patch.field }, fields);
    }

    if (patch.operator !== undefined && patch.operator !== row.operator) {
      return { ...row, operator: patch.operator, value: "" };
    }

    return { ...row, ...patch };
  });
}

export function removeTableFilterRow(
  rows: TableFilterRowState[],
  rowId: string,
): TableFilterRowState[] {
  return rows.filter((row) => row.id !== rowId);
}

export function addTableFilterRow(rows: TableFilterRowState[]): TableFilterRowState[] {
  return [...rows, createEmptyFilterRow()];
}

export function resolveSeededFilterRowsOnOpen(
  rows: TableFilterRowState[],
  options: {
    open: boolean;
    wasOpen: boolean;
    seedEmptyRowWhenOpen?: boolean;
  },
): TableFilterRowState[] | null {
  const seedEmptyRowWhenOpen = options.seedEmptyRowWhenOpen ?? true;

  if (seedEmptyRowWhenOpen && options.open && !options.wasOpen && rows.length === 0) {
    return [createEmptyFilterRow()];
  }

  return null;
}
