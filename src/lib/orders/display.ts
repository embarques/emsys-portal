import { formatCoreAddressLine } from "@/lib/customers/display";
import { getPhoneAtDisplayIndex, getPrimaryPhoneNumber } from "@/lib/phones/phones";
import { formatPhoneDisplayOrDash } from "@/lib/utils/phone";
import { getRouteAssignmentById } from "@/lib/route-assignments/mock-data";
import { getBranchLabel } from "@/lib/trucks/display";
import type { Customer } from "@/lib/customers/types";
import type { TableFilterFieldOption } from "@/lib/table/filter-types";
import type { User } from "@/lib/users/types";
import type { Order, PickupComment } from "./types";

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

export function formatOrderId(order: Pick<Order, "id" | "oldID">): string {
  if (order.oldID > 0) return `#${order.oldID}`;
  return String(order.id);
}

export function formatCustomerPartySummary(customer: Customer): string {
  const addressLine = getCustomerAddressLine(customer);
  return `${customer.name} · ${addressLine}`;
}

export function getRouteAssignmentLabel(routeAssignmentId: string): string {
  if (!routeAssignmentId) return "—";
  const assignment = getRouteAssignmentById(routeAssignmentId);
  if (!assignment) return routeAssignmentId;
  return `${assignment.name} · ${formatOrderDate(assignment.date)} · ${assignment.truck.name || assignment.truck.id}`;
}

export function formatOrderRouteAssignment(order: Pick<Order, "routeAssignmentId">): string {
  if (!order.routeAssignmentId) return "—";
  return getRouteAssignmentLabel(order.routeAssignmentId);
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
  return user.fullName.trim() || user.userName.trim();
}

export function formatUserSummary(user: Order["user"]): string {
  const name = getOrderUserDisplayName(user);
  if (name) return name;
  if (!user) return "—";
  return String(user.id);
}

/** Created-by filter options for POST /pickups/search (`user.name` field). */
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
  const phone = index === 0 ? getPrimaryPhoneNumber(customer.phones) : getPhoneAtDisplayIndex(customer.phones, index);
  return formatPhoneDisplayOrDash(phone);
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
