/**
 * Pickups directory bar search — POST /pickups/search OR + contains.
 * Paths must match EMSYS API search validation (see API-Query-Usage.md).
 */
export const ORDER_BAR_OR_SEARCH_FIELDS = [
  "sender.name",
  "sender.phone1",
  "sender.address.city",
  "sender.address.state",
  "sender.address.zipcode",
  "receiver.name",
  "receiver.phone1",
] as const;

export type OrderBarOrSearchField = (typeof ORDER_BAR_OR_SEARCH_FIELDS)[number];
