import {
  coerceTypedLeafFilter,
  isApiSearchFilter,
  type ApiSearchFilter,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";

const NUMERIC_FIELDS: ReadonlySet<string> = new Set(["id"]);

function expandBarcodeLeafFilter(filter: ApiSearchFilter): ApiSearchFilterNode | null {
  return coerceTypedLeafFilter(filter, { numericFields: NUMERIC_FIELDS });
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
