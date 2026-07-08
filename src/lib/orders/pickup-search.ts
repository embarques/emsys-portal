import {
  createTextSearchFilter,
  type ApiSearchFilter,
  type ApiSearchFilterGroup,
  type ApiSearchFilterNode,
  type ApiSearchOperator,
} from "@/lib/api/search-query";
import { normalizeStoredPhone } from "@/lib/utils/phone";

/** Whole-address alias fields for POST /pickups/search global bar search. */
export const PICKUP_BAR_NAME_FIELDS = ["sender.name", "receivers.name"] as const;

export const PICKUP_BAR_ADDRESS_FIELDS = ["sender.address", "receivers.address"] as const;

export const PICKUP_BAR_PHONE_FIELDS = ["sender.phone", "receivers.phone"] as const;

/** Optional bar search field — not in the base API examples but supported by POST /pickups/search. */
export const PICKUP_BAR_COMMENT_FIELDS = ["comments"] as const;

function searchTermHasLetters(value: string): boolean {
  return /[a-zA-Z]/.test(value);
}

/**
 * Map legacy pickup search field paths to current API alias fields.
 * Global bar search must not send receiver.* or sender.address.* subfield paths.
 */
export function resolvePickupSearchField(field: string): string {
  const trimmed = field.trim();
  if (!trimmed) return trimmed;

  if (trimmed === "user.name") return "createdBy.name";

  if (trimmed.startsWith("receiver.address.")) return "receivers.address";
  if (trimmed.startsWith("sender.address.")) return "sender.address";

  if (trimmed.startsWith("receiver.")) {
    return trimmed.replace(/^receiver\./, "receivers.");
  }

  if (trimmed === "sender.phone1" || trimmed === "sender.phone2" || trimmed === "sender.phones.number") {
    return "sender.phone";
  }

  if (
    trimmed === "receivers.phone1" ||
    trimmed === "receivers.phone2" ||
    trimmed === "receivers.phones.number"
  ) {
    return "receivers.phone";
  }

  return trimmed;
}

/**
 * POST /pickups/search global bar OR group.
 *
 * - Whole-address aliases only (`sender.address`, `receivers.address`) — no per-subfield paths.
 * - Text terms (letters present): name + address (+ comments); omit phone filters.
 * - Digit-only terms: name + address + phone (digits only in phone filters).
 */
export function createPickupBarSearchFilterGroup(value: string): ApiSearchFilterGroup | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const filters: ApiSearchFilter[] = [];
  const includePhone = !searchTermHasLetters(trimmed);
  const phoneDigits = normalizeStoredPhone(trimmed);

  for (const field of PICKUP_BAR_NAME_FIELDS) {
    filters.push({ field, operator: "contains", value: trimmed });
  }

  for (const field of PICKUP_BAR_ADDRESS_FIELDS) {
    filters.push({ field, operator: "contains", value: trimmed });
  }

  for (const field of PICKUP_BAR_COMMENT_FIELDS) {
    filters.push({ field, operator: "contains", value: trimmed });
  }

  if (includePhone && phoneDigits) {
    for (const field of PICKUP_BAR_PHONE_FIELDS) {
      filters.push({ field, operator: "contains", value: phoneDigits });
    }
  }

  if (filters.length === 0) return null;

  return { operator: "or", filters };
}

/** Explicit pickup search/filter leaf with legacy field resolution and phone normalization. */
export function createPickupTextSearchFilter(
  field: string,
  value: string,
  operator: ApiSearchOperator = "contains",
): ApiSearchFilterNode | null {
  return createTextSearchFilter(resolvePickupSearchField(field), value, operator);
}
