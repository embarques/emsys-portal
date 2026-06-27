import {
  createOrTextSearchFilterGroup,
  type ApiSearchFilterGroup,
} from "@/lib/api/search-query";

export const DELIVERY_BAR_OR_SEARCH_FIELDS = [
  "name",
  "container.name",
  "container.containerNumber",
  "employeeGroup.name",
] as const;

export function createDeliveryBarSearchFilterGroup(value: string): ApiSearchFilterGroup | null {
  return createOrTextSearchFilterGroup(value, [...DELIVERY_BAR_OR_SEARCH_FIELDS]);
}
