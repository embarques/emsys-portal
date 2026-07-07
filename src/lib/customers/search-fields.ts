import { CUSTOMER_BAR_ADDRESS_SEARCH_FIELDS } from "@/lib/customers/address-search-fields";

/** Matches any phone on the customer (`phones[]` plus legacy scalars). */
export const CUSTOMER_PHONE_SEARCH_FIELDS = ["phones.number", "phone1", "phone2"] as const;

/**
 * Customer directory search bar — POST /customers/search OR + contains.
 * Street search uses virtual `address.address1`, which matches any `addresses[].address1`.
 */
export const CUSTOMER_BAR_OR_SEARCH_FIELDS = [
  "name",
  ...CUSTOMER_PHONE_SEARCH_FIELDS,
  ...CUSTOMER_BAR_ADDRESS_SEARCH_FIELDS,
] as const;

export type CustomerBarOrSearchField = (typeof CUSTOMER_BAR_OR_SEARCH_FIELDS)[number];

/**
 * Sender/receiver picker search (order form) — POST /customers/search OR + contains.
 * Matches by customer name, any phone, or any address line.
 */
export const CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS = [
  "name",
  ...CUSTOMER_PHONE_SEARCH_FIELDS,
  ...CUSTOMER_BAR_ADDRESS_SEARCH_FIELDS,
] as const;

export type CustomerPartyPickerOrSearchField =
  (typeof CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS)[number];
