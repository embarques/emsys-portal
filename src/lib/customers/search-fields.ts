/**
 * Customer directory search bar — POST /customers/search OR + contains.
 * Stripe-style `filters` groups; pagination via URL query params.
 */
export const CUSTOMER_BAR_OR_SEARCH_FIELDS = [
  "name",
  "email",
  "IDNumber",
  "phones.number",
  "address.address1",
  "address.city",
  "address.state",
  "address.zipcode",
] as const;

export type CustomerBarOrSearchField = (typeof CUSTOMER_BAR_OR_SEARCH_FIELDS)[number];
