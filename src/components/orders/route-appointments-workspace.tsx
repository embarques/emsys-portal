"use client";

import { OrdersWorkspace } from "@/components/orders/orders-workspace";
import { OrdersMapWorkspace } from "@/components/orders/orders-map-workspace";
import { useRouteAppointmentsAccess } from "@/lib/orders/hooks/use-route-appointments-access";

export function RouteAppointmentsWorkspace() {
  const { scopeKey, canView } = useRouteAppointmentsAccess();
  return canView ? <OrdersWorkspace key={scopeKey} routeMode /> : null;
}

export function RouteAppointmentsMapWorkspace() {
  const { scopeKey, canView } = useRouteAppointmentsAccess();
  return canView ? <OrdersMapWorkspace key={scopeKey} routeMode /> : null;
}
