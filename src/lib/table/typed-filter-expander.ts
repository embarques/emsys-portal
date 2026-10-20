import {
  coerceTypedLeafFilter,
  isApiSearchFilter,
  type ApiSearchFilter,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";
import { parseTableFilterRange } from "@/lib/table/filter-range";

export type TypedFilterExpanderOptions = {
  /** Fields the strict API validates as JSON numbers. */
  numericFields?: readonly string[];
  /** Fields the strict API validates as JSON booleans. */
  booleanFields?: readonly string[];
  /** Synthetic range filter field → API field it expands to (`gte` start AND `lte` end). */
  rangeFields?: Readonly<Record<string, string>>;
};

/**
 * Builds an `expandNode` for `buildResourceSearchFilterGroups` that coerces
 * numeric/boolean values and expands synthetic `*Range` rows into gte/lte pairs.
 */
export function createTypedFilterExpander(options: TypedFilterExpanderOptions) {
  const coerceOptions = {
    numericFields: new Set(options.numericFields ?? []),
    booleanFields: new Set(options.booleanFields ?? []),
  };
  const rangeFields = options.rangeFields ?? {};

  function expandLeaf(filter: ApiSearchFilter): ApiSearchFilterNode | null {
    const rangeTarget = rangeFields[filter.field];
    if (rangeTarget) {
      const range = parseTableFilterRange(String(filter.value));
      if (!range) return null;
      return {
        operator: "and",
        filters: [
          { field: rangeTarget, operator: "gte", value: range.start },
          { field: rangeTarget, operator: "lte", value: range.end },
        ],
      };
    }

    return coerceTypedLeafFilter(filter, coerceOptions);
  }

  return function expandNode(node: ApiSearchFilterNode): ApiSearchFilterNode | null {
    if (isApiSearchFilter(node)) return expandLeaf(node);

    const filters = node.filters
      .map((entry) => expandNode(entry))
      .filter((entry): entry is ApiSearchFilterNode => entry != null);

    if (filters.length === 0) return null;
    return { operator: node.operator, filters };
  };
}
