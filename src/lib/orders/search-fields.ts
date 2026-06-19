/**
 * Orders search bar — POST /pickups/search OR + contains across sender and receiver fields.
 * Pagination, filters, and sort in body (same pattern as all directory views).
 */
export const ORDER_BAR_OR_SEARCH_FIELDS = [
  "sender.name",
  "sender.phone1",
  "sender.address.address1",
  "sender.address.city",
  "sender.address.state",
  "sender.address.zipcode",
  "receiver.name",
  "receiver.phone1",
  "receiver.address.address1",
] as const;

export type OrderBarOrSearchField = (typeof ORDER_BAR_OR_SEARCH_FIELDS)[number];
