import type { RouteType } from "@/lib/pickup-delivery-routes/types";

export const DELIVERY_BRANCH_CODE = "RD";

export type ActiveRoutesDirectoryVariant = {
  id: "pickup" | "delivery" | "daily";
  /** When omitted, the directory lists pickup and delivery daily routes together. */
  routeType?: RouteType;
  showRouteTypeField: boolean;
  showContainerField: boolean;
  formFeature: string;
  baseHref: string;
  columnVisibilityKey: string;
  copyPrefix: "pickupRoutes" | "deliveryRoutes" | "dailyRoutes";
  /** When set, the schedule form locks the branch (and route list) to this code. */
  fixedBranchCode?: string;
};

export const DAILY_ROUTES_DIRECTORY_VARIANT: ActiveRoutesDirectoryVariant = {
  id: "daily",
  showRouteTypeField: false,
  showContainerField: true,
  formFeature: "daily-routes",
  baseHref: "/daily-routes",
  columnVisibilityKey: "daily-routes-v1",
  copyPrefix: "dailyRoutes",
};

export const PICKUP_ROUTES_DIRECTORY_VARIANT: ActiveRoutesDirectoryVariant = {
  id: "pickup",
  routeType: "pickup",
  showRouteTypeField: false,
  showContainerField: false,
  formFeature: "daily-routes",
  baseHref: "/daily-routes",
  columnVisibilityKey: "pickup-routes-v2",
  copyPrefix: "pickupRoutes",
};

export const DELIVERY_ROUTES_DIRECTORY_VARIANT: ActiveRoutesDirectoryVariant = {
  id: "delivery",
  routeType: "delivery",
  showRouteTypeField: false,
  showContainerField: true,
  formFeature: "daily-routes",
  baseHref: "/daily-routes",
  columnVisibilityKey: "delivery-routes-v1",
  copyPrefix: "deliveryRoutes",
  fixedBranchCode: DELIVERY_BRANCH_CODE,
};
