import {
  resolveApiListSort,
  type ApiListSortInput,
  type SortDirection,
} from "@/lib/api/list-query";
import type { TableFilterFieldDefinition, TableFilterRowState } from "@/lib/table/filter-builder";
import { normalizeApiSearchValueForField } from "@/lib/utils/phone";

export type ApiSearchOperator =
  | "eq"
  | "neq"
  | "contains"
  | "startsWith"
  | "in"
  | "notIn"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export type ApiSearchFilter = {
  field: string;
  operator: string;
  value: string | number | boolean;
};

export type ApiSearchFilterGroup = {
  operator: "and" | "or";
  filters: ApiSearchFilterNode[];
};

export type ApiSearchFilterNode = ApiSearchFilter | ApiSearchFilterGroup;

export type ApiSearchQueryNode = ApiSearchFilter | ApiSearchQuery;

/** EMSYS POST /search query tree — see API-Query-Usage.md */
export type ApiSearchQuery = {
  and?: ApiSearchQueryNode[];
  or?: ApiSearchQueryNode[];
};

/** POST /<resource>/search body — see API-Query-Usage.md and API_PAYLOADS.md */
export type ApiSearchBody = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: string;
  query?: ApiSearchQuery;
  /** Legacy flat filter for single-field searches. */
  field?: string;
  operator?: string;
  value?: string | number | boolean;
  /** Nested AND/OR filter groups — see API_PAYLOADS.md POST /search. */
  filters?: ApiSearchFilterGroup[];
  /** @deprecated Prefer page/limit/offset query params. */
  pagination?: { page: number; offset: number; limit: number };
};

export type ListTextSearch = {
  value: string;
};

/** Optional field/operator overrides for programmatic callers (autocomplete, forms). */
export type ApiListTextSearch = ListTextSearch & {
  field?: string;
  operator?: ApiSearchOperator;
};

export type BuildApiSearchBodyOptions = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  /** Flat leaf filters combined with AND in a single group. */
  filters?: ApiSearchFilter[];
  /** Stripe-style nested filter groups (ANDed together at the root). */
  filterGroups?: ApiSearchFilterGroup[];
};

export function createListTextSearch(value: string): ListTextSearch | undefined {
  const trimmed = value.trim();
  return trimmed ? { value: trimmed } : undefined;
}

export function createApiListTextSearch(
  value: string,
  field?: string,
  operator: ApiSearchOperator = "contains",
): ApiListTextSearch | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return field ? { value: trimmed, field, operator } : { value: trimmed };
}

export function resolveSearchField(
  search: ApiListTextSearch | undefined,
  defaultField: string,
): string {
  return search?.field?.trim() || defaultField;
}

export function resolveSearchOperator(
  search: ApiListTextSearch | undefined,
  defaultOperator: ApiSearchOperator = "contains",
): ApiSearchOperator {
  return search?.operator ?? defaultOperator;
}

export function createTextSearchFilter(
  field: string,
  value: string,
  operator: ApiSearchOperator = "contains",
): ApiSearchFilter | null {
  const trimmed = value.trim();
  if (!trimmed || !field.trim()) return null;

  return {
    field: field.trim(),
    operator,
    value: normalizeApiSearchValueForField(field, trimmed),
  };
}

export function isApiSearchFilter(node: ApiSearchFilterNode): node is ApiSearchFilter {
  return "field" in node && !("filters" in node);
}

export function createOrTextSearchFilterGroup(
  value: string,
  fields: string[],
  operator: ApiSearchOperator = "contains",
): ApiSearchFilterGroup | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const filters: ApiSearchFilter[] = [];

  for (const field of fields) {
    const normalizedField = field.trim();
    if (!normalizedField) continue;

    if (normalizedField === "oldID") {
      if (/^\d+$/.test(trimmed)) {
        filters.push({ field: normalizedField, operator: "eq", value: trimmed });
      }
      continue;
    }

    filters.push({
      field: normalizedField,
      operator,
      value: normalizeApiSearchValueForField(normalizedField, trimmed),
    });
  }

  if (filters.length === 0) return null;

  return { operator: "or", filters };
}

export function resolveApiSearchSort(sort?: ApiListSortInput): ApiSearchSortSpec[] | undefined {
  if (!sort) return undefined;

  if (typeof sort === "string") {
    const specs = sort
      .split(",")
      .map((entry) => {
        const trimmed = entry.trim();
        if (!trimmed) return null;

        const [field, direction] = trimmed.split(":");
        const normalizedField = field?.trim();
        if (!normalizedField) return null;

        const spec: ApiSearchSortSpec = { field: normalizedField };
        if (direction === "asc" || direction === "desc") {
          spec.direction = direction;
        }

        return spec;
      })
      .filter((entry): entry is ApiSearchSortSpec => entry != null);

    return specs.length > 0 ? specs : undefined;
  }

  const entries = Array.isArray(sort) ? sort : [sort];
  const specs: ApiSearchSortSpec[] = [];

  for (const entry of entries) {
    const field = entry.field.trim();
    if (!field) continue;

    specs.push({
      field,
      direction: entry.direction ?? "asc",
    });
  }

  return specs.length > 0 ? specs : undefined;
}

export type ApiSearchSortSpec = {
  field: string;
  direction?: SortDirection;
};

function filterNodeToQueryNode(node: ApiSearchFilterNode): ApiSearchQueryNode {
  if (isApiSearchFilter(node)) {
    return {
      field: node.field,
      operator: node.operator,
      value: node.value,
    };
  }

  const children = node.filters.map(filterNodeToQueryNode);
  return node.operator === "or" ? { or: children } : { and: children };
}

function filterGroupsToQuery(groups: ApiSearchFilterGroup[]): ApiSearchQuery | undefined {
  if (groups.length === 0) return undefined;
  if (groups.length === 1) {
    return filterNodeToQueryNode(groups[0]) as ApiSearchQuery;
  }

  return {
    and: groups.map((group) => filterNodeToQueryNode(group) as ApiSearchQuery),
  };
}

/**
 * POST /<resource>/search body — nested AND/OR filter groups (Stripe-style).
 * Pagination is passed via URL query (`page`, `offset`, `limit`).
 * See API-Query-Usage.md and API_PAYLOADS.md.
 */
export type StripeStyleSearchBody = {
  field?: string;
  operator?: "and" | "or";
  value?: string | number | boolean;
  filters?: ApiSearchFilterNode[];
  pagination?: {
    page: number;
    offset: number;
    limit: number;
  };
  sort?: ApiSearchSortSpec[];
};

export function buildStripeStyleSearchBody(options: {
  sort?: ApiListSortInput;
  filterGroups?: ApiSearchFilterGroup[];
}): StripeStyleSearchBody {
  const body: StripeStyleSearchBody = {};

  const sortSpecs = resolveApiSearchSort(options.sort);
  if (sortSpecs) {
    body.sort = sortSpecs;
  }

  const filterGroups = options.filterGroups ?? [];
  if (filterGroups.length === 0) {
    return body;
  }

  if (filterGroups.length === 1 && filterGroups[0].operator === "and") {
    body.operator = filterGroups[0].operator;
    body.filters = filterGroups[0].filters;
    return body;
  }

  body.operator = "and";
  body.filters = filterGroups;

  return body;
}

export function buildApiSearchPaginationQuery(options: {
  page?: number;
  limit?: number;
  offset?: number;
}): string {
  const page = options.page ?? 1;
  const limit = options.limit ?? 40;
  const offset = options.offset ?? (page - 1) * limit;

  return new URLSearchParams({
    page: String(page),
    limit: String(limit),
    offset: String(offset),
  }).toString();
}

function hasApiSearchFilterValue(value: string | number | boolean): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return value !== "";
}

export function buildApiSearchBody(options: BuildApiSearchBodyOptions): ApiSearchBody {
  const page = options.page ?? 1;
  const limit = options.limit ?? 40;
  const offset = options.offset ?? (page - 1) * limit;

  const body: ApiSearchBody = {
    page,
    limit,
    offset,
  };

  const sort = resolveApiListSort(options.sort);
  if (sort) {
    body.sort = sort;
  }

  const leafFilters = (options.filters ?? []).filter(
    (filter) => filter.field.trim() && hasApiSearchFilterValue(filter.value),
  );

  const filterGroups: ApiSearchFilterGroup[] = [...(options.filterGroups ?? [])];

  if (leafFilters.length > 0) {
    filterGroups.push({ operator: "and", filters: leafFilters });
  }

  const query = filterGroupsToQuery(filterGroups);
  if (!query) {
    return body;
  }

  if (
    filterGroups.length === 1 &&
    filterGroups[0].operator === "and" &&
    filterGroups[0].filters.length === 1 &&
    isApiSearchFilter(filterGroups[0].filters[0])
  ) {
    const onlyFilter = filterGroups[0].filters[0];
    body.field = onlyFilter.field;
    body.operator = onlyFilter.operator;
    body.value = onlyFilter.value;
  }

  body.query = query;
  body.filters = filterGroups;
  return body;
}

export function hasListTextSearch(search: ListTextSearch | undefined): boolean {
  return Boolean(search?.value.trim());
}

function mergeFilterNodesWithJoin(
  left: ApiSearchFilterNode,
  join: "and" | "or",
  right: ApiSearchFilterNode,
): ApiSearchFilterGroup {
  if (join === "and" && "filters" in left && left.operator === "and") {
    return { operator: "and", filters: [...left.filters, right] };
  }

  if (join === "or" && "filters" in left && left.operator === "or") {
    return { operator: "or", filters: [...left.filters, right] };
  }

  return { operator: join, filters: [left, right] };
}

function resolveTableFilterRowToApiNode(
  row: TableFilterRowState,
  fieldDefinitions?: TableFilterFieldDefinition[],
): ApiSearchFilterNode | null {
  const fieldKey = row.field.trim();
  const definition = fieldDefinitions?.find((entry) => entry.field === fieldKey);
  const operator =
    row.operator.trim() ||
    (definition && definition.operators.length === 1 ? definition.operators[0] : "");

  if (!fieldKey || !operator || !row.value.trim()) return null;

  if (definition?.queryFields?.length) {
    const filters: ApiSearchFilter[] = definition.queryFields.map((field) => ({
      field,
      operator,
      value: normalizeApiSearchValueForField(field, row.value),
    }));

    if (filters.length === 0) return null;
    if (filters.length === 1) return filters[0];
    return { operator: "or", filters };
  }

  const normalizedValue =
    fieldKey === "customerType" ? Number(row.value.trim()) : normalizeApiSearchValueForField(fieldKey, row.value);

  return {
    field: fieldKey,
    operator,
    value: normalizedValue,
  };
}

/** Converts completed table filter rows into flat leaf filters (legacy AND-only). */
export function buildApiFiltersFromTableRows(
  rows: TableFilterRowState[],
  fieldDefinitions?: TableFilterFieldDefinition[],
): ApiSearchFilter[] {
  return rows.flatMap((row) => {
    const node = resolveTableFilterRowToApiNode(row, fieldDefinitions);
    if (!node) return [];
    if ("filters" in node) {
      return node.filters.filter(isApiSearchFilter);
    }
    return [node];
  });
}

/** Builds a nested AND/OR filter tree from completed table rows (left-associative). */
export function buildApiFilterNodeFromTableRows(
  rows: TableFilterRowState[],
  fieldDefinitions?: TableFilterFieldDefinition[],
): ApiSearchFilterNode | null {
  const completed: { join: "and" | "or"; filter: ApiSearchFilterNode }[] = [];

  rows.forEach((row, index) => {
    const filter = resolveTableFilterRowToApiNode(row, fieldDefinitions);
    if (!filter) return;

    completed.push({
      join: index === 0 ? "and" : row.join,
      filter,
    });
  });

  if (completed.length === 0) return null;
  if (completed.length === 1) return completed[0].filter;

  let result: ApiSearchFilterNode = completed[0].filter;

  for (let index = 1; index < completed.length; index += 1) {
    result = mergeFilterNodesWithJoin(result, completed[index].join, completed[index].filter);
  }

  return result;
}
