import { formatCoreAddressLine } from "@/lib/customers/display";
import {
  getCustomerPrimaryCoreAddress,
  isAddressVerified,
  type AddressGeoLocation,
} from "@/lib/customers/types";

import type { Order } from "@/lib/orders/types";

export type PickupMapStop = {
  orderId: number;
  orderRecordId: string;
  lat: number;
  lng: number;
  senderName: string;
  addressLine: string;
  routeId?: string;
  routeName?: string;
  completed: boolean;
};

export type PickupMapBuildResult = {
  stops: PickupMapStop[];
};

function readMapCoordinates(location: AddressGeoLocation | null | undefined): { lat: number; lng: number } | null {
  const coordinates = location?.coordinates;
  if (!coordinates || coordinates.length !== 2) return null;

  const [lng, lat] = coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

/** True when the pickup sender has a verified address with map coordinates. */
export function isOrderMappable(order: Order): boolean {
  const address = getCustomerPrimaryCoreAddress(order.sender);
  if (!isAddressVerified(address)) return false;
  return readMapCoordinates(address.location) !== null;
}

/** Build a map stop from a pickup, or null when the sender address is unverified or lacks coordinates. */
export function getOrderPickupMapStop(order: Order, orderRecordId: string): PickupMapStop | null {
  const address = getCustomerPrimaryCoreAddress(order.sender);
  if (!isAddressVerified(address)) return null;

  const coordinates = readMapCoordinates(address.location);
  if (!coordinates) return null;

  return {
    orderId: order.id,
    orderRecordId,
    lat: coordinates.lat,
    lng: coordinates.lng,
    senderName: order.sender.name.trim(),
    addressLine: formatCoreAddressLine(address),
    routeId: order.routeId,
    routeName: order.routeName,
    completed: order.completed,
  };
}

/** Build map stops from verified sender addresses only; all other pickups are ignored. */
export function buildPickupMapStops(
  orders: Order[],
  getRecordId: (order: Order) => string,
): PickupMapBuildResult {
  const stops: PickupMapStop[] = [];

  for (const order of orders) {
    const stop = getOrderPickupMapStop(order, getRecordId(order));
    if (stop) {
      stops.push(stop);
    }
  }

  return { stops };
}
