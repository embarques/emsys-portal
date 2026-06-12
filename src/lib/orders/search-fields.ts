/**
 * Orders search bar — POST /pickups/search OR + contains across sender and receiver fields.
 */
export const ORDER_BAR_OR_SEARCH_FIELDS = [
  "sender.name",
  "sender.phones.number",
  "sender.phone1",
  "sender.address.address1",
  "sender.address.address2",
  "receiver.name",
  "receiver.phones.number",
  "receiver.phone1",
  "receiver.address.address1",
  "receiver.address.address2",
] as const;

export type OrderBarOrSearchField = (typeof ORDER_BAR_OR_SEARCH_FIELDS)[number];
