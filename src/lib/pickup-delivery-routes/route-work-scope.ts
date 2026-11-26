import type { RouteWorkScopeState } from "@/components/pickup-delivery-routes/route-work-scope-filter";

export type ResolvedRouteWorkScope = {
  routeEmployee: string | null;
  scopedRouteId: string | null;
  scopeKey: string;
  hasScopeFilter: boolean;
};

/**
 * Assignment scope must key off identities, never display names.
 * "Jonathan A" and "Jonathan B" are different employees; only their ids may filter.
 */
export function isExactRouteEmployeeId(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const id = Number(trimmed);
  return Number.isInteger(id) && id > 0 && id <= 65535;
}

/** Daily-route scope uses the vehicle-route document id (ObjectId hex), not the generated name. */
export function isExactDailyRouteId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value.trim());
}

export function resolveRouteWorkScope(
  canViewOthers: boolean,
  scope: RouteWorkScopeState,
): ResolvedRouteWorkScope {
  if (!canViewOthers) {
    return {
      routeEmployee: "me",
      scopedRouteId: null,
      scopeKey: "me",
      hasScopeFilter: false,
    };
  }

  const value = scope.value.trim();
  if (scope.mode === "supervisor" && isExactRouteEmployeeId(value)) {
    return {
      routeEmployee: value,
      scopedRouteId: null,
      scopeKey: `supervisor:${value}`,
      hasScopeFilter: true,
    };
  }

  if (scope.mode === "dailyRoute" && isExactDailyRouteId(value)) {
    // Omit routeEmployee so broad-view grants are not collapsed back to “me”
    // while the route.id filter limits rows to that daily route only.
    return {
      routeEmployee: null,
      scopedRouteId: value,
      scopeKey: `dailyRoute:${value}`,
      hasScopeFilter: true,
    };
  }

  return {
    routeEmployee: "me",
    scopedRouteId: null,
    scopeKey: "me",
    hasScopeFilter: false,
  };
}
