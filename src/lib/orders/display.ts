import { formatCoreAddressLine } from "@/lib/customers/display";
import { formatPrimaryPhonesDisplayOrDash, getPhoneDisplayAtIndex } from "@/lib/phones/phones";
import { getBranchLabel } from "@/lib/vehicles/display";
import type { Route } from "@/lib/route-manager/types";
import { truncateObjectId } from "@/lib/route-manager/display";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import {
  formatActiveRouteReferenceLabel,
} from "@/lib/pickup-delivery-routes/display";
import type { Customer } from "@/lib/customers/types";
import { getCustomerPrimaryCoreAddress } from "@/lib/customers/types";
import type { TableFilterFieldOption } from "@/lib/table/filter-types";
import type { User } from "@/lib/users/types";
import type { TranslateFn } from "@/lib/feedback/messages";

import {
  compileOrderCommentsParagraph,
  formatOrderCommentSentence,
  orderCommentToFormValues,
  type Order,
  type PickupComment,
} from "./types";

type RouteLabelSource = Pick<Route, "name" | "date" | "vehicle">;

export function getOrderBranchLabel(branch: Order["branch"]): string {
  return branch.name.trim() || getBranchLabel(branch.code);
}

export function formatOrderDate(date: string): string {
  const trimmed = date?.trim();
  if (!trimmed) return "—";

  const parsed = parseOrderDateValue(trimmed);
  if (!parsed) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

const ORDER_DATE_LOCALE_TAGS: Record<string, string> = {
  en: "en-US",
  es: "es-US",
};

function parseOrderDateValue(date: string): Date | null {
  const parsed = date.includes("T")
    ? new Date(date)
    : new Date(`${date.slice(0, 10)}T12:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** e.g. "Tuesday July 6 2026" — weekday, month, day, and year without commas. */
export function formatOrderDateWithWeekday(date: string, locale = "en"): string {
  const trimmed = date?.trim();
  if (!trimmed) return "—";

  const parsed = parseOrderDateValue(trimmed);
  if (!parsed) return "—";

  const parts = new Intl.DateTimeFormat(ORDER_DATE_LOCALE_TAGS[locale] ?? "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(parsed);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return [lookup.weekday, lookup.month, lookup.day, lookup.year].filter(Boolean).join(" ");
}

export function formatOrderId(order: Pick<Order, "id">): string {
  return String(order.id);
}

export function formatCustomerPartySummary(customer: Customer): string {
  const addressLine = getCustomerAddressLine(customer);
  return `${customer.name} · ${addressLine}`;
}

/**
 * Formats a route manager assignment for display (accounting and legacy callers).
 * Pickup orders use `formatOrderRouteName` with a scheduled pickup vehicle route.
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
  scheduledRoute?: ActiveRoute | null,
  t?: (key: string) => string,
): string {
  if (!order.routeId && !order.routeName) return "—";

  if (scheduledRoute) {
    return formatActiveRouteReferenceLabel(scheduledRoute, t);
  }

  const embeddedName = order.routeName?.trim();
  if (embeddedName && embeddedName !== order.routeId) {
    return embeddedName;
  }

  return order.routeId ? truncateObjectId(order.routeId) : "—";
}

export function formatPickupCommentSummary(comment: PickupComment): string {
  const sentence = formatOrderCommentSentence(orderCommentToFormValues(comment));
  if (sentence) return sentence;

  const description = comment.description.trim();
  return description || "—";
}

export function formatOrderCommentsSummary(order: Order): string {
  return compileOrderCommentsParagraph(order.comments.map(orderCommentToFormValues)) || "—";
}

export function getOrderCreatedByDisplayName(user: Order["createdBy"]): string {
  if (!user) return "";
  return user.name.trim();
}

export function formatUserSummary(user: Order["createdBy"]): string {
  const name = getOrderCreatedByDisplayName(user);
  if (name) return name;
  if (!user) return "—";
  return String(user.id);
}

/** Created-by filter options for POST /pickups/search (`createdBy.name` field). */
export function buildOrderCreatedByFilterOptions(users: User[]): TableFilterFieldOption[] {
  const seen = new Set<string>();
  const options: TableFilterFieldOption[] = [];

  for (const user of users) {
    const name = getOrderCreatedByDisplayName(user);
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
  return formatCoreAddressLine(getCustomerPrimaryCoreAddress(customer)) || "—";
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

export function getOrderCompletedLabel(completed: boolean, t?: TranslateFn): string {
  if (t) {
    return t(completed ? "orders.status.completed" : "orders.status.pending");
  }
  return completed ? "Completed" : "Pending";
}
