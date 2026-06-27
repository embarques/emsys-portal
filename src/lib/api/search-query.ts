import {
  type ApiListSortInput,
  type SortDirection,
} from "@/lib/api/list-query";
import {
  isCompleteFilterRow,
  type TableFilterFieldDefinition,
  type TableFilterRowState,
} from "@/lib/table/filter-builder";
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

/**
 * The strict API validates value types per field: numeric fields require JSON
 * numbers, boolean fields require JSON booleans, and `in`/`notIn` require JSON
 * arrays. Strings are only valid for string fields.
 */
export type ApiSearchFilterValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>;

export type ApiSearchFilter = {
  field: string;
  operator: string;
  value: ApiSearchFilterValue;
};

export type ApiSearchFilterGroup = {
  operator: "and" | "or";
  filters: ApiSearchFilterNode[];
};

export type ApiSearchFilterNode = ApiSearchFilter | ApiSearchFilterGroup;

export type ApiSearchSortSpec = {
  field: string;
  direction?: SortDirection;
};

export type AdvancedSearchPagination = {
  page: number;
  limit: number;
  offset: number;
};

/** POST /<resource>/search request body — same shape for every route. */
export type AdvancedSearchBody = {
  operator: "and" | "or";
  filters: ApiSearchFilterNode[];
  pagination: AdvancedSearchPagination;
  sort: ApiSearchSortSpec[];
};

export type BuildAdvancedSearchBodyOptions = {
  page?: number;
  limit?: number;
  sort?: ApiListSortInput;
  /** Flat leaf filters combined with AND in a single group. */
  filters?: ApiSearchFilter[];
  /** Nested filter groups combined at the root `filters` array. */
  filterGroups?: ApiSearchFilterGroup[];
};

/** @deprecated Use AdvancedSearchBody */
export type ApiSearchBody = AdvancedSearchBody;

/** @deprecated Use BuildAdvancedSearchBodyOptions */
export type BuildApiSearchBodyOptions = BuildAdvancedSearchBodyOptions;

/**
 * POST /<resource>/search body when pagination is passed via URL query.
 * Used by fetchPaginatedResourceList (branches, vehicles, etc.).
 */
export type StripeStyleSearchBody = {
  operator?: "and" | "or";
  filters?: ApiSearchFilterNode[];
  sort?: ApiSearchSortSpec[];
};

export type ListTextSearch = {
  value: string;
};

/** Optional field/operator overrides for programmatic callers (autocomplete, forms). */
export type ApiListTextSearch = ListTextSearch & {
  field?: string;
  operator?: ApiSearchOperator;
};

function hasApiSearchFilterValue(value: ApiSearchFilterValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return value !== "";
}

/** Membership operators require JSON arrays under the strict API contract. */
export const MULTI_VALUE_OPERATORS: ReadonlySet<string> = new Set(["in", "notIn"]);

function splitMultiValue(value: ApiSearchFilterValue): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Coerces a leaf filter to the JSON types the strict API expects:
 * numeric fields → numbers, boolean fields → booleans, and `in`/`notIn` → arrays.
 * Returns null when the value cannot satisfy the field's required type.
 */
export function coerceTypedLeafFilter(
  filter: ApiSearchFilter,
  options: {
    numericFields?: ReadonlySet<string>;
    booleanFields?: ReadonlySet<string>;
  },
): ApiSearchFilter | null {
  const isNumeric = options.numericFields?.has(filter.field) ?? false;
  const isBoolean = options.booleanFields?.has(filter.field) ?? false;

  if (MULTI_VALUE_OPERATORS.has(filter.operator)) {
    const parts = splitMultiValue(filter.value);
    if (parts.length === 0) return null;

    if (isNumeric) {
      const numbers = parts
        .map((part) => Number(part))
        .filter((entry) => Number.isFinite(entry));
      if (numbers.length === 0) return null;
      return { field: filter.field, operator: filter.operator, value: numbers };
    }

    if (isBoolean) {
      return {
        field: filter.field,
        operator: filter.operator,
        value: parts.map((part) => part === "true"),
      };
    }

    return { field: filter.field, operator: filter.operator, value: parts };
  }

  if (isNumeric) {
    const numeric = Number(String(filter.value).trim());
    if (!Number.isFinite(numeric)) return null;
    return { field: filter.field, operator: filter.operator, value: numeric };
  }

  if (isBoolean) {
    return {
      field: filter.field,
      operator: filter.operator,
      value: String(filter.value).trim() === "true",
    };
  }

  return filter;
}

/** Recursively applies {@link coerceTypedLeafFilter} across an AND/OR node tree. */
export function coerceTypedFilterNode(
  node: ApiSearchFilterNode,
  options: {
    numericFields?: ReadonlySet<string>;
    booleanFields?: ReadonlySet<string>;
  },
): ApiSearchFilterNode | null {
  if (isApiSearchFilter(node)) {
    return coerceTypedLeafFilter(node, options);
  }

  const filters = node.filters
    .map((entry) => coerceTypedFilterNode(entry, options))
    .filter((entry): entry is ApiSearchFilterNode => entry != null);

  if (filters.length === 0) return null;

  return { operator: node.operator, filters };
}

function collectAdvancedSearchFilterGroups(
  options: BuildAdvancedSearchBodyOptions,
): ApiSearchFilterGroup[] {
  const leafFilters = (options.filters ?? []).filter(
    (filter) => filter.field.trim() && hasApiSearchFilterValue(filter.value),
  );

  const filterGroups: ApiSearchFilterGroup[] = [...(options.filterGroups ?? [])];

  if (leafFilters.length > 0) {
    filterGroups.push({ operator: "and", filters: leafFilters });
  }

  return filterGroups;
}

function resolveAdvancedSearchFilters(options: BuildAdvancedSearchBodyOptions): ApiSearchFilterNode[] {
  const filterGroups = collectAdvancedSearchFilterGroups(options);

  if (filterGroups.length === 0) {
    return [];
  }

  if (filterGroups.length === 1 && filterGroups[0].operator === "and") {
    return filterGroups[0].filters;
  }

  return filterGroups;
}

/** POST /<resource>/search body — unified signature for all routes. */
export function buildAdvancedSearchBody(
  options: BuildAdvancedSearchBodyOptions,
): AdvancedSearchBody {
  const page = options.page ?? 1;
  const limit = options.limit ?? 40;
  const offset = (page - 1) * limit;
  const pagination = { page, limit, offset };
  const sort = resolveApiSearchSort(options.sort) ?? [];
  const filterGroups = collectAdvancedSearchFilterGroups(options);

  // Bar search only: one OR group with no other constraints → root OR + flat leaf filters.
  if (filterGroups.length === 1 && filterGroups[0].operator === "or") {
    return {
      operator: "or",
      filters: filterGroups[0].filters,
      pagination,
      sort,
    };
  }

  return {
    operator: "and",
    filters: resolveAdvancedSearchFilters(options),
    pagination,
    sort,
  };
}

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

/** @deprecated Use buildAdvancedSearchBody */
export function buildApiSearchBody(options: BuildAdvancedSearchBodyOptions): AdvancedSearchBody {
  return buildAdvancedSearchBody(options);
}

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
  const normalizedValue = normalizeApiSearchValueForField(field, trimmed);
  if (!normalizedValue) return null;

  return {
    field: field.trim(),
    operator,
    value: normalizedValue,
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

    const normalizedValue = normalizeApiSearchValueForField(normalizedField, trimmed);
    if (!normalizedValue) continue;

    filters.push({
      field: normalizedField,
      operator,
      value: normalizedValue,
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
    const filters: ApiSearchFilter[] = definition.queryFields.flatMap((field) => {
      const normalizedValue = normalizeApiSearchValueForField(field, row.value);
      if (!normalizedValue) return [];

      return [{
        field,
        operator,
        value: normalizedValue,
      }];
    });

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

export function hasResourceListFilters(input: {
  search?: ListTextSearch;
  filterRows?: TableFilterRowState[];
  tableFilterFields?: TableFilterFieldDefinition[];
  hasChipFilters?: boolean;
}): boolean {
  return (
    hasListTextSearch(input.search) ||
    (input.filterRows ?? []).some((row) => isCompleteFilterRow(row, input.tableFilterFields)) ||
    Boolean(input.hasChipFilters)
  );
}

export function buildResourceSearchFilterGroups(input: {
  search?: ApiListTextSearch;
  barOrSearchFields: readonly string[];
  filterRows?: TableFilterRowState[];
  tableFilterFields: TableFilterFieldDefinition[];
  chipFilters?: ApiSearchFilter[];
  expandNode?: (node: ApiSearchFilterNode) => ApiSearchFilterNode | null;
}): ApiSearchFilterGroup[] {
  const groups: ApiSearchFilterGroup[] = [];
  const expandNode = input.expandNode ?? ((node: ApiSearchFilterNode) => node);

  if (input.search?.value.trim()) {
    if (input.search.field) {
      const explicitFilter = createTextSearchFilter(
        resolveSearchField(input.search, input.barOrSearchFields[0] ?? "name"),
        input.search.value,
        resolveSearchOperator(input.search),
      );
      if (explicitFilter) {
        groups.push({ operator: "and", filters: [explicitFilter] });
      }
    } else {
      const orGroup = createOrTextSearchFilterGroup(
        input.search.value,
        [...input.barOrSearchFields],
        "contains",
      );
      if (orGroup) {
        groups.push(orGroup);
      }
    }
  }

  const rowFilterNode = buildApiFilterNodeFromTableRows(
    input.filterRows ?? [],
    input.tableFilterFields,
  );
  const expandedRowFilter = rowFilterNode ? expandNode(rowFilterNode) : null;

  if (expandedRowFilter) {
    if (isApiSearchFilter(expandedRowFilter)) {
      groups.push({ operator: "and", filters: [expandedRowFilter] });
    } else {
      groups.push(expandedRowFilter);
    }
  }

  const chipFilters = input.chipFilters ?? [];
  if (chipFilters.length > 0) {
    groups.push({ operator: "and", filters: chipFilters });
  }

  return groups;
}
