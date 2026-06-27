import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";

/** Audit reference embedded on a memo pad (assigned server-side). */
export type MemoPadUserRef = {
  id: number | null;
  name: string;
};

/**
 * A memo pad record from the EMSYS API (`memo_pads` collection).
 *
 * `createdAt`, `updatedAt`, `createdBy`, and `updatedBy` are assigned
 * server-side; the client never sends them. Tenant isolation is handled by the
 * `x-company-id` header, so there is no `companyId` field.
 */
export type MemoPad = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: MemoPadUserRef | null;
  updatedBy: MemoPadUserRef | null;
};

/** Editable fields for the create/update form. */
export type MemoPadFormValues = {
  name: string;
  content: string;
};

export type MemoPadSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type MemoPadSearchField = "name" | "content" | "createdBy.name" | "updatedBy.name";

export type MemoPadSearchFilter = ApiListTextSearch;

export type MemoPadListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: MemoPadSearchFilter;
  filterRows?: TableFilterRowState[];
};

/** GET /memo-pads?page=1&limit=40&offset=0&sort=updatedAt:desc */
export const DEFAULT_MEMO_PAD_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "updatedAt:desc",
} as const satisfies Pick<MemoPadListParams, "page" | "limit" | "sort">;

export const MEMO_PAD_SEARCH_FIELDS: { value: MemoPadSearchField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "content", label: "Content" },
  { value: "createdBy.name", label: "Created by" },
  { value: "updatedBy.name", label: "Updated by" },
];

export const MEMO_PAD_SEARCH_OPERATORS: { value: MemoPadSearchOperator; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "startsWith", label: "Starts with" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
];

export function createEmptyMemoPadForm(): MemoPadFormValues {
  return { name: "", content: "" };
}

export function createMemoPadSearchFilter(value: string): MemoPadSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildMemoPadListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  sort?: ApiListSortInput;
}): MemoPadListParams {
  const params: MemoPadListParams = {
    ...DEFAULT_MEMO_PAD_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_MEMO_PAD_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_MEMO_PAD_LIST_PARAMS.sort,
  };

  const search = createMemoPadSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter((row) => isCompleteFilterRow(row));
  if (completeRows.length > 0) {
    params.filterRows = completeRows;
  }

  return params;
}

export function memoPadToFormValues(memoPad: MemoPad): MemoPadFormValues {
  return {
    name: memoPad.name,
    content: memoPad.content,
  };
}
