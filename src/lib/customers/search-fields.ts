import { CUSTOMER_BAR_ADDRESS_SEARCH_FIELDS } from "@/lib/customers/address-search-fields";

/** Matches any phone on the customer (`phones[]` plus legacy scalars). */
export const CUSTOMER_PHONE_SEARCH_FIELDS = ["phones.number", "phone1", "phone2"] as const;

/**
 * Customer directory search bar — POST /customers/search OR + contains.
 * Street search uses `addresses.address1`, which matches any `addresses[]` entry.
 */
export const CUSTOMER_BAR_OR_SEARCH_FIELDS = [
  "name",
  ...CUSTOMER_PHONE_SEARCH_FIELDS,
  ...CUSTOMER_BAR_ADDRESS_SEARCH_FIELDS,
] as const;

export type CustomerBarOrSearchField = (typeof CUSTOMER_BAR_OR_SEARCH_FIELDS)[number];

/**
 * Sender/receiver party picker — POST /customers/search OR + contains.
 * Same address scope as the directory bar: any `addresses[]` entry via `addresses.*`.
 */
export const CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS = [
  "name",
  ...CUSTOMER_PHONE_SEARCH_FIELDS,
  ...CUSTOMER_BAR_ADDRESS_SEARCH_FIELDS,
] as const;

export type CustomerPartyPickerOrSearchField =
  (typeof CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS)[number];
