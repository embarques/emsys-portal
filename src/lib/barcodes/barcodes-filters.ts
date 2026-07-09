import {
  coerceTypedLeafFilter,
  isApiSearchFilter,
  MULTI_VALUE_OPERATORS,
  type ApiSearchFilter,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";

const STRING_ID_OPERATORS: ReadonlySet<string> = new Set(["contains", "startsWith"]);
const NUMERIC_COMPARE_OPERATORS: ReadonlySet<string> = new Set([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
]);
const ID_REF_FIELDS: ReadonlySet<string> = new Set(["id", "createdBy.id", "updatedBy.id"]);

function expandBarcodeIdRefFilter(filter: ApiSearchFilter): ApiSearchFilter | null {
  if (STRING_ID_OPERATORS.has(filter.operator)) {
    const value = String(filter.value).trim();
    if (!value) return null;
    return { field: filter.field, operator: filter.operator, value };
  }

  if (NUMERIC_COMPARE_OPERATORS.has(filter.operator) || MULTI_VALUE_OPERATORS.has(filter.operator)) {
    return coerceTypedLeafFilter(filter, { numericFields: ID_REF_FIELDS });
  }

  return coerceTypedLeafFilter(filter, { numericFields: ID_REF_FIELDS });
}

function expandBarcodeLeafFilter(filter: ApiSearchFilter): ApiSearchFilterNode | null {
  if (ID_REF_FIELDS.has(filter.field)) {
    return expandBarcodeIdRefFilter(filter);
  }

  return coerceTypedLeafFilter(filter, { numericFields: new Set() });
}

export function expandBarcodeFilterNode(node: ApiSearchFilterNode): ApiSearchFilterNode | null {
  if (isApiSearchFilter(node)) {
    return expandBarcodeLeafFilter(node);
  }

  const filters = node.filters
    .map((entry) => expandBarcodeFilterNode(entry))
    .filter((entry): entry is ApiSearchFilterNode => entry != null);

  if (filters.length === 0) return null;

  return {
    operator: node.operator,
    filters,
  };
}
