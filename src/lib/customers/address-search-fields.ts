/**
 * Canonical customer address search paths for POST /customers/search.
 * MongoDB dot notation matches the field on any entry in `addresses[]`, so these
 * paths cover primary and additional addresses without compatibility aliases.
 */
export function buildCustomerAddressSearchFields(...parts: readonly string[]): string[] {
  return parts.map((part) => `addresses.${part}`);
}

/**
 * Bar + filter OR paths for street-level address matching.
 * `addresses.address1` matches `address1` on any entry in `addresses[]`.
 */
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
