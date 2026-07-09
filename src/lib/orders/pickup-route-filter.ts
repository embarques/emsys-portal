import { createFilterRowId } from "@/lib/table/filter-builder";
import type { TableFilterRowState } from "@/lib/table/filter-types";

/** Advanced filter rows for pickups assigned to a scheduled pickup route. */
export function buildPickupRouteFilterRows(routeId: string): TableFilterRowState[] {
  const id = routeId.trim();
  if (!id) return [];

  return [
    {
      id: createFilterRowId(),
      join: "and",
      field: "route.id",
      operator: "eq",
      value: id,
    },
  ];
}
