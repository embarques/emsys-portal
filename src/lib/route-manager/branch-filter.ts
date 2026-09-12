import { getVehiclePortalBranch } from "@/lib/vehicles/types";

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
  branchCode?: string;
}): boolean {
  return Boolean(params.branchCode?.trim()) || Boolean(params.search?.value?.trim());
}
