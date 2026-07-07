/**
 * Customer directory search bar — POST /customers/search OR + contains.
 * Pagination, filters, and sort in body (same pattern as all directory views).
 */
export const CUSTOMER_BAR_OR_SEARCH_FIELDS = [
  "name",
  "phones.number",
  "addresses.address1",
  "addresses.city",
  "addresses.state",
  "addresses.zipcode",
] as const;

export type CustomerBarOrSearchField = (typeof CUSTOMER_BAR_OR_SEARCH_FIELDS)[number];

/**
 * Sender/receiver picker search (order form) — POST /customers/search OR + contains.
 * Matches by customer name, primary street address, or phone number.
 */
export const CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS = [
  "name",
  "addresses.address1",
  "phones.number",
] as const;

export type CustomerPartyPickerOrSearchField =
  (typeof CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS)[number];
