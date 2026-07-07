/**
 * Customer address search paths for POST /customers/search.
 * The API exposes virtual `address.*` fields that match any entry in `addresses[]`
 * (primary and additional). Do not duplicate with `addresses.*` — that breaks OR search.
 */
export function buildCustomerAddressSearchFields(...parts: readonly string[]): string[] {
  return parts.map((part) => `address.${part}`);
}

/**
 * Bar + filter OR paths for street-level address matching.
 * `address.address1` is the API virtual field for `addresses[].address1` on any entry.
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
