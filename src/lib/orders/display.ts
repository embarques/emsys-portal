import { formatCoreAddressLine } from "@/lib/customers/display";
import { formatPrimaryPhonesDisplayOrDash, getPhoneDisplayAtIndex } from "@/lib/phones/phones";
import { getBranchLabel } from "@/lib/vehicles/display";
import type { Route } from "@/lib/route-manager/types";
import type { Customer } from "@/lib/customers/types";
import type { TableFilterFieldOption } from "@/lib/table/filter-types";
import type { User } from "@/lib/users/types";
import type { Order, PickupComment } from "./types";

type RouteLabelSource = Pick<Route, "name" | "date" | "vehicle">;

export function getOrderBranchLabel(branch: Order["branch"]): string {
  return branch.name.trim() || getBranchLabel(branch.code);
}

export function formatOrderDate(date: string): string {
  const trimmed = date?.trim();
  if (!trimmed) return "—";

  const parsed = trimmed.includes("T")
    ? new Date(trimmed)
    : new Date(`${trimmed.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatOrderId(order: Pick<Order, "id">): string {
  return String(order.id);
}

export function formatCustomerPartySummary(customer: Customer): string {
  const addressLine = getCustomerAddressLine(customer);
  return `${customer.name} · ${addressLine}`;
}

/**
 * Formats a route for display. The route catalog now comes from the
 * live API, so callers resolve the assignment (e.g. via a TanStack Query picker
 * lookup) and pass it in. Without a resolved assignment the raw id is shown.
 */
export function getRouteLabel(
  routeId: string,
  assignment?: RouteLabelSource,
): string {
  if (!routeId) return "—";
  if (!assignment) return routeId;
  return `${assignment.name} · ${formatOrderDate(assignment.date)} · ${assignment.vehicle.name || assignment.vehicle.id}`;
}

export function formatOrderRoute(
  order: Pick<Order, "routeId">,
  assignment?: RouteLabelSource,
): string {
  if (!order.routeId) return "—";
  return getRouteLabel(order.routeId, assignment);
}

export function formatOrderRouteName(
  order: Pick<Order, "routeId" | "routeName">,
  assignment?: Pick<Route, "name">,
): string {
  if (!order.routeId && !order.routeName) return "—";
  return assignment?.name.trim() || order.routeName?.trim() || order.routeId || "—";
}

export function formatPickupCommentSummary(comment: PickupComment): string {
  const description = comment.description.trim();
  if (description) return description;

  const purpose = comment.purpose.trim();
  if (purpose && purpose.toLowerCase() !== "comment") return purpose;

  const metadata = [
    comment.unit ? `unit: ${comment.unit}` : "",
    comment.quantity > 0 ? `qty: ${comment.quantity}` : "",
  ].filter(Boolean);

  return metadata.join(" · ") || "—";
}

export function formatOrderCommentsSummary(order: Order, limit = 2): string {
  if (order.comments.length === 0) return "—";
  const visible = order.comments.slice(0, limit).map(formatPickupCommentSummary);
  const suffix = order.comments.length > limit ? ` (+${order.comments.length - limit})` : "";
  return `${visible.join("; ")}${suffix}`;
}

export function getOrderUserDisplayName(user: Order["user"]): string {
  if (!user) return "";
  return user.name.trim();
}

export function formatUserSummary(user: Order["user"]): string {
  const name = getOrderUserDisplayName(user);
  if (name) return name;
  if (!user) return "—";
  return String(user.id);
}

/** Created-by filter options for POST /pickups/search (`createdBy.name` field). */
export function buildOrderCreatedByFilterOptions(users: User[]): TableFilterFieldOption[] {
  const seen = new Set<string>();
  const options: TableFilterFieldOption[] = [];

  for (const user of users) {
    const name = getOrderUserDisplayName(user);
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    options.push({ value: name, label: name });
  }

  return options;
}

export function formatEmployeeSummary(employee: Order["employee"]): string {
  if (!employee) return "—";
  return employee.name.trim() || String(employee.id);
}

export function getCustomerAddressLine(customer: Customer): string {
  return formatCoreAddressLine(customer.address) || "—";
}

export function getCustomerPhone(customer: Customer, index = 0): string {
  if (index === 0) {
    return formatPrimaryPhonesDisplayOrDash(customer.phones);
  }

  const display = getPhoneDisplayAtIndex(customer.phones, index);
  return display || "—";
}

export function getReceiverSummary(order: Order): string {
  return order.receiver?.name.trim() || "—";
}

export function getReceiverAddressLine(order: Order): string {
  return order.receiver ? getCustomerAddressLine(order.receiver) : "—";
}

export function computeOrderKpis(orders: Order[]) {
  return {
    total: orders.length,
    usa: orders.filter((order) => ["NY", "USA"].includes(order.branch.code.trim().toUpperCase())).length,
    dr: orders.filter((order) => ["DR", "RD", "DO"].includes(order.branch.code.trim().toUpperCase())).length,
    pending: orders.filter((order) => !order.completed).length,
  };
}

export function getOrderCompletedLabel(completed: boolean): string {
  return completed ? "Completed" : "Pending";
}
