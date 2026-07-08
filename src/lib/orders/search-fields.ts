import {
  ORDER_RECEIVER_BAR_ADDRESS_SEARCH_FIELDS,
  ORDER_SENDER_BAR_ADDRESS_SEARCH_FIELDS,
} from "@/lib/orders/address-search-fields";

/** Matches any phone on the pickup party (`phones[]` plus legacy scalars). */
export const ORDER_SENDER_PHONE_SEARCH_FIELDS = [
  "sender.phones.number",
  "sender.phone1",
  "sender.phone2",
] as const;

export const ORDER_RECEIVER_PHONE_SEARCH_FIELDS = [
  "receiver.phones.number",
  "receiver.phone1",
  "receiver.phone2",
] as const;

/**
 * Pickups directory bar search — POST /pickups/search OR + contains.
 * Mirrors customer directory search: name, any phone, and full address (line + locality).
 */
export const ORDER_BAR_OR_SEARCH_FIELDS = [
  "sender.name",
  ...ORDER_SENDER_PHONE_SEARCH_FIELDS,
  ...ORDER_SENDER_BAR_ADDRESS_SEARCH_FIELDS,
  "receiver.name",
  ...ORDER_RECEIVER_PHONE_SEARCH_FIELDS,
  ...ORDER_RECEIVER_BAR_ADDRESS_SEARCH_FIELDS,
] as const;

export type OrderBarOrSearchField = (typeof ORDER_BAR_OR_SEARCH_FIELDS)[number];
