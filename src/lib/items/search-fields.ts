/**
 * POST /invoice-descriptions/search — OR bar search across item fields.
 *
 * The backend accepts `contains` against `name`, `id`, and `price` (numeric
 * fields match as stringified values), so the free-text bar searches all three.
 */
export const ITEM_BAR_OR_SEARCH_FIELDS = ["name", "id", "price"] as const;

export type ItemBarOrSearchField = (typeof ITEM_BAR_OR_SEARCH_FIELDS)[number];
