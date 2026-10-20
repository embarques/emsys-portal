import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";

export type InventorySearchFilter = ApiListTextSearch;

export type InventoryListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: InventorySearchFilter;
  itemId?: string;
  supplierId?: string;
  holderId?: string;
};

export const DEFAULT_INVENTORY_ITEM_LIST_PARAMS = {
  page: 1,
  limit: 200,
  sort: "name:asc",
} as const satisfies Pick<InventoryListParams, "page" | "limit" | "sort">;

export const DEFAULT_INVENTORY_STOCK_LIST_PARAMS = {
  page: 1,
  limit: 500,
  sort: "itemId:asc",
} as const satisfies Pick<InventoryListParams, "page" | "limit" | "sort">;

export const DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS = {
  page: 1,
  limit: 200,
  sort: "receivedAt:desc",
} as const satisfies Pick<InventoryListParams, "page" | "limit" | "sort">;

export const DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS = {
  page: 1,
  limit: 200,
  sort: "dispatchedAt:desc",
} as const satisfies Pick<InventoryListParams, "page" | "limit" | "sort">;

export const DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS = {
  page: 1,
  limit: 200,
  sort: "companyName:asc",
} as const satisfies Pick<InventoryListParams, "page" | "limit" | "sort">;

export const DEFAULT_INVENTORY_HOLDER_LIST_PARAMS = {
  page: 1,
  limit: 200,
  sort: "displayName:asc",
} as const satisfies Pick<InventoryListParams, "page" | "limit" | "sort">;

export function createInventorySearchFilter(value: string): InventorySearchFilter | undefined {
  return createListTextSearch(value);
}
