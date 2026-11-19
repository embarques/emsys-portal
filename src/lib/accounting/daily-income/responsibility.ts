import { PERMISSIONS, permissionKey } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";
import { dailyRouteSupervisors, resolveDailyRouteSupervisor } from "./assignee";
import type { DailyIncomeJournalValues } from "./types";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

/** Only these financial transactions have the new explicit assignment policy. */
export function responsibilityPermission(type: string): Permission | null {
  if (type === "INVOICE") return PERMISSIONS.invoiceResponsibilityAssign;
  return ["INITIAL-PAYMENT", "PAYMENT", "REFUND", "DISCOUNT", "SURCHARGE"].includes(type)
    ? PERMISSIONS.paymentResponsibilityAssign : null;
}

/** Preserve ordinary full invoice search for users who already have company access. */
export function needsCompanyPaymentLookup(type: string, discovery: boolean, permissions: Permission[], canViewInvoices: boolean): boolean {
  if (type !== "PAYMENT" && !(discovery && type === "INITIAL-PAYMENT")) return false;
  const grants = new Set(permissions.map(permissionKey));
  const routeScoped = grants.has("daily_route_work:canoperatedailyroute") && !grants.has("daily_route_work:canmanagedailyrouterecords");
  return !canViewInvoices || routeScoped;
}

export function canSelectResponsibleRoute(route: ActiveRoute, canAssign: boolean, ownEmployeeId?: number): boolean {
  const supervisors = dailyRouteSupervisors(route);
  return canAssign || Boolean(ownEmployeeId && supervisors.length === 1 && supervisors[0].id === ownEmployeeId);
}

/** Self attribution stays omitted on the wire; the API resolves the active link. */
export function selfResponsibility(): Pick<DailyIncomeJournalValues,
  "assigneeSource" | "employeeId" | "employeeName" | "routeId" | "routeName" |
  "routeCrewId" | "routeCrewName" | "supervisorId" | "supervisorName" | "employeeGroupId" | "employeeGroupName"> {
  return { assigneeSource: "creator", employeeId: undefined, employeeName: "",
    routeId: undefined, routeName: "", routeCrewId: undefined, routeCrewName: "",
    supervisorId: undefined, supervisorName: "", employeeGroupId: undefined, employeeGroupName: "" };
}

/** Initial-payment default only; callers retain an explicitly chosen collector. */
export function paymentDefaultsFromInvoiceResponsibility(
  selection: NonNullable<DailyIncomeJournalValues["invoiceResponsibility"]>,
  routes: ActiveRoute[],
) {
  const route = routes.find((entry) => entry.id === selection.dailyRouteId);
  const supervisor = route ? resolveDailyRouteSupervisor(route) : null;
  const assigneeSource: NonNullable<DailyIncomeJournalValues["assigneeSource"]> = selection.dailyRouteId ? "route" : selection.employee ? "employee" : "creator";
  return {
    ...selfResponsibility(),
    assigneeSource,
    employeeId: selection.employee?.id,
    employeeName: selection.employee?.name ?? "",
    routeId: selection.dailyRouteId,
    routeName: route?.name ?? "",
    supervisorId: supervisor?.id,
    supervisorName: supervisor?.name ?? "",
  };
}
