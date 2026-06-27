import {
  isApiSearchFilter,
  type ApiSearchFilter,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";

const NUMERIC_FIELDS = new Set(["id", "branch.id", "role.id"]);
const BOOLEAN_FIELDS = new Set(["active"]);

/** Numeric/boolean user fields ignore string values server-side, so coerce them. */
function coerceLeafFilter(filter: ApiSearchFilter): ApiSearchFilter | null {
  if (NUMERIC_FIELDS.has(filter.field)) {
    const numeric = Number(String(filter.value).trim());
    if (!Number.isFinite(numeric)) return null;
    return { field: filter.field, operator: filter.operator, value: numeric };
  }

  if (BOOLEAN_FIELDS.has(filter.field)) {
    return { field: filter.field, operator: filter.operator, value: String(filter.value).trim() === "true" };
  }

  return filter;
}

export function expandUserFilterNode(node: ApiSearchFilterNode): ApiSearchFilterNode | null {
  if (isApiSearchFilter(node)) {
    return coerceLeafFilter(node);
  }

  const filters = node.filters
    .map((entry) => expandUserFilterNode(entry))
    .filter((entry): entry is ApiSearchFilterNode => entry != null);

  if (filters.length === 0) return null;

  return { operator: node.operator, filters };
}
