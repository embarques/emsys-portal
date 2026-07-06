/**
 * Customer address search paths — primary `address.*` scalar plus `addresses[]` entries.
 * POST /customers/search accepts both so bar and advanced filters can match any address.
 */
export function buildCustomerAddressSearchFields(...parts: readonly string[]): string[] {
  return parts.flatMap((part) => [`address.${part}`, `addresses.${part}`]);
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
