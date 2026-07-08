/**
 * Pickup party address search paths for POST /pickups/search.
 * Transaction parties expose a singular `address` object on sender/receiver.
 */
export function buildPickupPartyAddressSearchFields(
  party: "sender" | "receiver",
  ...parts: readonly string[]
): string[] {
  return parts.map((part) => `${party}.address.${part}`);
}

/** Bar + filter OR paths for sender street-level address matching. */
export const ORDER_SENDER_ADDRESS_LINE_SEARCH_FIELDS = buildPickupPartyAddressSearchFields(
  "sender",
  "address1",
  "address2",
  "apartment",
);

/** Bar + filter OR paths for receiver street-level address matching. */
export const ORDER_RECEIVER_ADDRESS_LINE_SEARCH_FIELDS = buildPickupPartyAddressSearchFields(
  "receiver",
  "address1",
  "address2",
  "apartment",
);

/** Bar + filter OR paths for sender city / state / postal code matching. */
export const ORDER_SENDER_ADDRESS_LOCALITY_SEARCH_FIELDS = buildPickupPartyAddressSearchFields(
  "sender",
  "city",
  "state",
  "zipcode",
);

/** Bar + filter OR paths for receiver city / state / postal code matching. */
export const ORDER_RECEIVER_ADDRESS_LOCALITY_SEARCH_FIELDS = buildPickupPartyAddressSearchFields(
  "receiver",
  "city",
  "state",
  "zipcode",
);

/** All sender address fields used in unscoped pickup directory search. */
export const ORDER_SENDER_BAR_ADDRESS_SEARCH_FIELDS = [
  ...ORDER_SENDER_ADDRESS_LINE_SEARCH_FIELDS,
  ...ORDER_SENDER_ADDRESS_LOCALITY_SEARCH_FIELDS,
];

/** All receiver address fields used in unscoped pickup directory search. */
export const ORDER_RECEIVER_BAR_ADDRESS_SEARCH_FIELDS = [
  ...ORDER_RECEIVER_ADDRESS_LINE_SEARCH_FIELDS,
  ...ORDER_RECEIVER_ADDRESS_LOCALITY_SEARCH_FIELDS,
];
