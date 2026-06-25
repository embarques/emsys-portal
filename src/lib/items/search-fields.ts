/** POST /invoice-descriptions/search — OR bar search across item fields. */
export const ITEM_BAR_OR_SEARCH_FIELDS = ["name"] as const;

export type ItemBarOrSearchField = (typeof ITEM_BAR_OR_SEARCH_FIELDS)[number];
