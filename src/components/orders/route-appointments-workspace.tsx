"use client";

import { RouteWorklist } from "@/components/pickup-delivery-routes/route-worklist";
import { OrdersWorkspace } from "@/components/orders/orders-workspace";
import { OrdersMapWorkspace } from "@/components/orders/orders-map-workspace";
import { useRouteAppointmentsAccess } from "@/lib/orders/hooks/use-route-appointments-access";

export function RouteAppointmentsWorkspace() {
  const { scopeKey, canView, canViewAll } = useRouteAppointmentsAccess();
  return canView ? (
    <RouteWorklist key={scopeKey} canViewOthers={canViewAll} routeType="pickup">
      {(work) => (
        <OrdersWorkspace
          routeMode
          routeEmployee={work.routeEmployee}
          scopedRouteId={work.scopedRouteId}
          routeScopeFilter={work.scopeFilter}
          hasRouteScopeFilter={work.hasScopeFilter}
          onClearRouteScopeFilter={work.clearScopeFilter}
        />
      )}
    </RouteWorklist>
  ) : null;
}

export function RouteAppointmentsMapWorkspace() {
  const { scopeKey, canView } = useRouteAppointmentsAccess();
  return canView ? <OrdersMapWorkspace key={scopeKey} routeMode /> : null;
}
