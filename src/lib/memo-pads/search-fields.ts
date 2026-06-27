/**
 * Memo pad directory search bar — POST /memo-pads/search OR + contains.
 * Pagination, filters, and sort live in the request body (same pattern as all
 * directory views).
 */
export const MEMO_PAD_BAR_OR_SEARCH_FIELDS = ["name", "content"] as const;

export type MemoPadBarOrSearchField = (typeof MEMO_PAD_BAR_OR_SEARCH_FIELDS)[number];
