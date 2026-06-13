/**
 * Customer directory search bar — POST /customers/search OR + contains.
 * Standard advanced-search body with `operator`, `filters`, and `sort`.
 * Pagination is passed via URL query params.
 */
export const CUSTOMER_BAR_OR_SEARCH_FIELDS = [
  "name",
  "phones.number",
  "address.address1",
  "address.city",
  "address.state",
  "address.zipcode",
] as const;

export type CustomerBarOrSearchField = (typeof CUSTOMER_BAR_OR_SEARCH_FIELDS)[number];
