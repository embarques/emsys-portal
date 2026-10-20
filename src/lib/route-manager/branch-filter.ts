import { getVehiclePortalBranch } from "@/lib/vehicles/types";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { ROUTE_TABLE_FILTER_FIELDS } from "@/lib/route-manager/filter-fields";

import { getRouteBranchCode, type Route } from "./types";

export function normalizeRouteBranchCode(branch?: string): string {
  return getVehiclePortalBranch(branch ?? "");
}

export function routeMatchesBranchCode(route: Route, branchCode?: string): boolean {
  const filter = branchCode?.trim();
  if (!filter) return true;

  const routeBranch = normalizeRouteBranchCode(getRouteBranchCode(route));
  const filterBranch = normalizeRouteBranchCode(filter);
  return routeBranch === filterBranch;
}

export function isRouteListFiltered(params: {
  search?: { value?: string };
  filterRows?: TableFilterRowState[];
  branchCode?: string;
}): boolean {
  return (
    Boolean(params.branchCode?.trim()) ||
    Boolean(params.search?.value?.trim()) ||
    (params.filterRows ?? []).some((row) => isCompleteFilterRow(row, ROUTE_TABLE_FILTER_FIELDS))
  );
}
