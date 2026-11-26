"use client";

import { useState, type ReactNode } from "react";

import {
  RouteWorkScopeFilter,
  type RouteWorkScopeState,
} from "@/components/pickup-delivery-routes/route-work-scope-filter";
import {
  resolveRouteWorkScope,
} from "@/lib/pickup-delivery-routes/route-work-scope";
import type { RouteType } from "@/lib/pickup-delivery-routes/types";

export type RouteWorklistChildProps = {
  /**
   * API `routeEmployee` scope.
   * - `"me"` — default assigned work
   * - employee id — supervisor/employee filter (exact id, never name)
   * - `null` — omit param (daily-route filter with broad view permission)
   */
  routeEmployee: string | null;
  /** Injected `route.id` equality filter when scoping to a daily route. */
  scopedRouteId: string | null;
  /** Stable remount / query-key fragment for the active scope. */
  scopeKey: string;
  /** Filter-panel control placed below advanced filters when the user can view others. */
  scopeFilter: ReactNode;
  /** True when mode + value are both set (scoped away from default “my work”). */
  hasScopeFilter: boolean;
  clearScopeFilter: () => void;
};

const EMPTY_SCOPE: RouteWorkScopeState = { mode: "", value: "" };

export {
  isExactDailyRouteId,
  isExactRouteEmployeeId,
  resolveRouteWorkScope,
} from "@/lib/pickup-delivery-routes/route-work-scope";

export function RouteWorklist({
  canViewOthers,
  routeType,
  children,
}: {
  canViewOthers: boolean;
  routeType: RouteType;
  children: (props: RouteWorklistChildProps) => ReactNode;
}) {
  const [scope, setScope] = useState<RouteWorkScopeState>(EMPTY_SCOPE);
  const resolved = resolveRouteWorkScope(canViewOthers, scope);
  // Keep the workspace mounted when scope changes so the filter panel does not
  // remount/re-open from leftover session handoff state. Selection resets via
  // query-key / selection-reset keyed on scopeKey in the child.
  const scopeFilter = canViewOthers ? (
    <RouteWorkScopeFilter routeType={routeType} value={scope} onChange={setScope} />
  ) : null;

  return children({
    ...resolved,
    scopeFilter,
    clearScopeFilter: () => setScope(EMPTY_SCOPE),
  });
}
