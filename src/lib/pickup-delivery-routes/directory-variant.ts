import type { RouteType } from "@/lib/pickup-delivery-routes/types";

export type ActiveRoutesDirectoryVariant = {
  id: "pickup" | "delivery";
  routeType: RouteType;
  showRouteTypeField: boolean;
  showContainerField: boolean;
  formFeature: string;
  baseHref: string;
  columnVisibilityKey: string;
  copyPrefix: "pickupRoutes" | "deliveryRoutes";
};

export const PICKUP_ROUTES_DIRECTORY_VARIANT: ActiveRoutesDirectoryVariant = {
  id: "pickup",
  routeType: "pickup",
  showRouteTypeField: false,
  showContainerField: false,
  formFeature: "pickup-routes",
  baseHref: "/pickup-routes",
  columnVisibilityKey: "pickup-routes-v1",
  copyPrefix: "pickupRoutes",
};

export const DELIVERY_ROUTES_DIRECTORY_VARIANT: ActiveRoutesDirectoryVariant = {
  id: "delivery",
  routeType: "delivery",
  showRouteTypeField: false,
  showContainerField: true,
  formFeature: "delivery-routes",
  baseHref: "/delivery-routes",
  columnVisibilityKey: "delivery-routes-v1",
  copyPrefix: "deliveryRoutes",
};
