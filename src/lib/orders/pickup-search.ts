import {
  createTextSearchFilter,
  type ApiSearchFilter,
  type ApiSearchFilterGroup,
  type ApiSearchFilterNode,
  type ApiSearchOperator,
} from "@/lib/api/search-query";

/** POST /pickups/search global bar OR fields — one term, same value on each filter. */
export const PICKUP_BAR_OR_FIELDS = [
  "sender.name",
  "receivers.name",
  "sender.phone",
  "receivers.phone",
  "sender.address",
  "receivers.address",
  "comments",
] as const;

/**
 * Map legacy / invalid pickup search field paths to canonical API alias fields.
 * @see POST /pickups/search pickup search contract (dev)
 */
export function resolvePickupSearchField(field: string): string {
  const trimmed = field.trim();
  if (!trimmed) return trimmed;

  if (trimmed === "user.name") return "createdBy.name";
  if (trimmed === "employee") return "employee.name";
  if (trimmed === "sector") return "sector.name";
  if (trimmed === "receiver") return "receivers.name";

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

  if (trimmed === "comment") return "comments";

  return trimmed;
}

/**
 * POST /pickups/search global bar OR group.
 * API adds completed=false by default (incomplete pickups only).
 */
export function createPickupBarSearchFilterGroup(value: string): ApiSearchFilterGroup | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const filters: ApiSearchFilter[] = PICKUP_BAR_OR_FIELDS.map((field) => ({
    field,
    operator: "contains",
    value: trimmed,
  }));

  return { operator: "or", filters };
}

export function createPickupTextSearchFilter(
  field: string,
  value: string,
  operator: ApiSearchOperator = "contains",
): ApiSearchFilterNode | null {
  return createTextSearchFilter(resolvePickupSearchField(field), value, operator);
}
