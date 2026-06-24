import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";

/** EMSYS invoice description (a.k.a. item) from GET /invoice-descriptions. */
export type Item = {
  /** Stringified numeric API id. */
  itemId: string;
  /** API `name` field — the item description shown in the catalog. */
  description: string;
  price: number;
  createdAt: string;
  updatedAt: string;
};

export type ItemFormValues = {
  itemId: string;
  description: string;
  price: string;
};

export type ItemSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type ItemSearchField = "id" | "name" | "price";

export type ItemSearchFilter = ApiListTextSearch;

export type ItemFilterState = {
  query: string;
};

export type ItemListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: ItemSearchFilter;
};

/** GET /invoice-descriptions?page=1&limit=50&offset=0&sort=name:asc */
export const DEFAULT_ITEM_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "name:asc",
} as const satisfies Pick<ItemListParams, "page" | "limit" | "sort">;

export function createEmptyItemForm(): ItemFormValues {
  return {
    itemId: "",
    description: "",
    price: "",
  };
}

export function itemToFormValues(item: Item): ItemFormValues {
  return {
    itemId: item.itemId,
    description: item.description,
    price: item.price > 0 ? item.price.toFixed(2) : "",
  };
}

export function createItemSearchFilter(value: string): ItemSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildItemListParams(input: {
  page: number;
  limit?: number;
  query: string;
  sort?: ApiListSortInput;
}): ItemListParams {
  const params: ItemListParams = {
    ...DEFAULT_ITEM_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_ITEM_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_ITEM_LIST_PARAMS.sort,
  };

  const search = createItemSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  return params;
}

export function validateItemFormValues(values: ItemFormValues): void {
  if (!values.description.trim()) {
    throw new Error("Description is required.");
  }

  const price = Number(values.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a valid number greater than or equal to 0.");
  }
}
