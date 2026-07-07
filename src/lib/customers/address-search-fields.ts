/**
 * Customer address search paths on the `addresses[]` array.
 * POST /customers/search matches any embedded address entry via these fields.
 */
export function buildCustomerAddressSearchFields(...parts: readonly string[]): string[] {
  return parts.map((part) => `addresses.${part}`);
}

/** Bar + filter OR paths for street-level address matching. */
export const CUSTOMER_ADDRESS_LINE_SEARCH_FIELDS = buildCustomerAddressSearchFields(
  "address1",
  "address2",
  "apartment",
);

/** Bar + filter OR paths for city / state / postal code matching. */
export const CUSTOMER_ADDRESS_LOCALITY_SEARCH_FIELDS = buildCustomerAddressSearchFields(
  "city",
  "state",
  "zipcode",
);

/** All customer address fields used in unscoped directory search. */
export const CUSTOMER_BAR_ADDRESS_SEARCH_FIELDS = [
  ...CUSTOMER_ADDRESS_LINE_SEARCH_FIELDS,
  ...CUSTOMER_ADDRESS_LOCALITY_SEARCH_FIELDS,
];
