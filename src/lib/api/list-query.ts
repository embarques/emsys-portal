export type SortDirection = "asc" | "desc";

export type ApiListSortSpec = {
  field: string;
  direction?: SortDirection;
};

/** `name`, `name:asc`, or `[{ field: 'name', direction: 'asc' }, ...]` */
export type ApiListSortInput = string | ApiListSortSpec | ApiListSortSpec[];

export type ApiListFieldFilter = {
  field: string;
  operator: string;
  value: string;
};

export type BuildApiListQueryOptions = {
  page?: number;
  limit?: number;
  sort?: ApiListSortInput;
  filter?: ApiListFieldFilter | null;
};

export function sortBy(field: string, direction?: SortDirection): ApiListSortSpec {
  const trimmedField = field.trim();
  if (!trimmedField) {
    return { field: "" };
  }

  if (direction === "asc" || direction === "desc") {
    return { field: trimmedField, direction };
  }

  return { field: trimmedField };
}

export function sortFields(...entries: ApiListSortSpec[]): ApiListSortSpec[] {
  return entries.filter((entry) => entry.field.trim());
}

export function formatApiListSort(sort: ApiListSortInput): string {
  if (typeof sort === "string") {
    return sort.trim();
  }

  const entries = Array.isArray(sort) ? sort : [sort];

  return entries
    .map((entry) => {
      const field = entry.field.trim();
      if (!field) return "";

      const direction = entry.direction;
      if (direction === "asc" || direction === "desc") {
        return `${field}:${direction}`;
      }

      return field;
    })
    .filter(Boolean)
    .join(",");
}

export function resolveApiListSort(sort?: ApiListSortInput): string | undefined {
  if (!sort) return undefined;

  const formatted = formatApiListSort(sort);
  return formatted || undefined;
}

export function getPrimarySortField(sort?: ApiListSortInput): string | undefined {
  if (!sort) return undefined;

  if (typeof sort === "string") {
    const first = sort.split(",")[0]?.trim();
    if (!first) return undefined;
    return first.split(":")[0]?.trim() || undefined;
  }

  const first = Array.isArray(sort) ? sort[0] : sort;
  return first?.field?.trim() || undefined;
}

/**
 * Builds EMSYS list query strings:
 * `?page=1&limit=40&sort=name:asc&field=createdAt&operator=eq&value=2026-06-01`
 */
export function buildApiListQuery(options: BuildApiListQueryOptions): string {
  const searchParams = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 40),
  });

  const sort = resolveApiListSort(options.sort);
  if (sort) {
    searchParams.set("sort", sort);
  }

  const filter = options.filter;
  if (filter?.field.trim() && filter.value !== "") {
    searchParams.set("field", filter.field);
    searchParams.set("operator", filter.operator);
    searchParams.set("value", filter.value);
  }

  return searchParams.toString();
}
