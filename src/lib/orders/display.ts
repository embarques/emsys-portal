import { formatAddressLine } from "@/lib/customers/display";
import { getEmployeeGroupLabel, getTruckName } from "@/lib/route-assignments/display";
import { getRouteAssignmentById } from "@/lib/route-assignments/mock-data";
import { getBranchLabel } from "@/lib/trucks/display";
import { getContainerLabel } from "@/lib/invoices/display";
import type { Order, OrderBranch, OrderComment, OrderCommentPurpose, OrderParty } from "./types";
import { ORDER_COMMENT_PURPOSES, getOrderPartyAddress } from "./types";

export function getOrderBranchLabel(branch: OrderBranch): string {
  return getBranchLabel(branch);
}

export function getCommentPurposeLabel(purpose: OrderCommentPurpose): string {
  return ORDER_COMMENT_PURPOSES.find((entry) => entry.value === purpose)?.label ?? purpose;
}

export function formatOrderDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function truncateOrderId(orderId: string): string {
  return orderId.length > 12 ? `${orderId.slice(0, 8)}…` : orderId;
}

export function formatOrderId(order: Pick<Order, "orderId" | "oldID">): string {
  if (order.oldID > 0) return `#${order.oldID}`;
  return truncateOrderId(order.orderId);
}

export function formatOrderPartySummary(party: OrderParty): string {
  const address = getOrderPartyAddress(party);
  const addressLine = address ? formatAddressLine(address) : "—";
  return `${party.name} · ${addressLine}`;
}

export function formatOrderCommentSummary(comment: OrderComment): string {
  const label = getCommentPurposeLabel(comment.purpose);

  switch (comment.purpose) {
    case "make_estimate":
    case "collect_payment":
      return comment.note ? `${label}: ${comment.note}` : label;
    case "take_box":
    case "take_barrel":
    case "take_tape":
    case "pickup_box":
    case "pickup_barrel":
      return `${label} × ${comment.quantity}`;
    case "take_other":
    case "pickup_other":
      return comment.description
        ? `${label} × ${comment.quantity} (${comment.description})`
        : `${label} × ${comment.quantity}`;
    case "general_comment":
      return comment.text;
    default:
      return label;
  }
}

export function formatOrderCommentsSummary(order: Order, limit = 2): string {
  if (order.comments.length === 0) return "—";
  const visible = order.comments.slice(0, limit).map(formatOrderCommentSummary);
  const suffix = order.comments.length > limit ? ` (+${order.comments.length - limit})` : "";
  return `${visible.join("; ")}${suffix}`;
}

export function getRouteName(routeId: string, routes: { routeId: string; name: string }[]): string {
  const route = routes.find((entry) => entry.routeId === routeId);
  return route?.name ?? "Unknown route";
}

export function getRouteAssignmentLabel(routeAssignmentId: string): string {
  if (!routeAssignmentId) return "—";
  const assignment = getRouteAssignmentById(routeAssignmentId);
  if (!assignment) return "Unknown assignment";
  return `${assignment.name} · ${formatOrderDate(assignment.date)} · ${getTruckName(assignment.truckId)}`;
}

export function orderMatchesQuery(
  order: Order,
  query: string,
  routes: { routeId: string; name: string; branch: OrderBranch }[]
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const partyText = [order.sender, ...order.receivers]
    .map((party) => {
      const address = getOrderPartyAddress(party);
      return [
        party.name,
        party.documentId ?? "",
        party.phones.map((phone) => phone.number).join(" "),
        address ? formatAddressLine(address) : "",
      ].join(" ");
    })
    .join(" ");

  return [
    order.orderId,
    order.date,
    getContainerLabel(order.containerId),
    getOrderBranchLabel(order.pending),
    getOrderBranchLabel(order.branch),
    getRouteName(order.routeId, routes),
    getRouteAssignmentLabel(order.routeAssignmentId),
    partyText,
    order.comments.map(formatOrderCommentSummary).join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeOrderKpis(orders: Order[]) {
  return {
    total: orders.length,
    usa: orders.filter((order) => order.branch === "usa").length,
    dr: orders.filter((order) => order.branch === "dr").length,
    pending: orders.filter((order) => !order.completed).length,
  };
}

export function getOrderPartyAddressLine(party: OrderParty, index = 0): string {
  const address = party.addresses[index];
  return address ? formatAddressLine(address) : "—";
}

export function getOrderPartyPhone(party: OrderParty, index = 0): string {
  const phone = party.phones[index];
  if (!phone) return "—";
  return phone.label ? `${phone.label}: ${phone.number}` : phone.number;
}

export function getOrderReceiverSummary(order: Order): string {
  const receiver = order.receivers[0];
  return receiver?.name ?? "—";
}

export function getOrderReceiverAddressLine(order: Order): string {
  const receiver = order.receivers[0];
  return receiver ? getOrderPartyAddressLine(receiver, 0) : "—";
}

export function getOrderCompletedLabel(completed: boolean): string {
  return completed ? "Completed" : "Pending";
}
