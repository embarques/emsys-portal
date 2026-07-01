import {
  coerceTypedLeafFilter,
  isApiSearchFilter,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";

const NUMERIC_FIELDS: ReadonlySet<string> = new Set(["id", "branch.id", "role.id"]);
const BOOLEAN_FIELDS: ReadonlySet<string> = new Set(["active"]);

export function expandUserFilterNode(node: ApiSearchFilterNode): ApiSearchFilterNode | null {
  if (isApiSearchFilter(node)) {
    return coerceTypedLeafFilter(node, {
      numericFields: NUMERIC_FIELDS,
      booleanFields: BOOLEAN_FIELDS,
    });
  }

  const filters = node.filters
    .map((entry) => expandUserFilterNode(entry))
    .filter((entry): entry is ApiSearchFilterNode => entry != null);

  if (filters.length === 0) return null;

  return { operator: node.operator, filters };
}
