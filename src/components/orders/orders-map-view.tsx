"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  CheckSquare,
  Eraser,
  ListChecks,
  ListOrdered,
  Loader2,
  MapPin,
  Route as RouteIcon,
  RouteOff,
  Sparkles,
  Square,
  Truck,
  X,
} from "lucide-react";

import { BranchForm } from "@/components/branches/branch-form";
import { useUpdateBranch } from "@/lib/branches/hooks/use-branches";
import { branchToFormValues, areBranchFormValuesEquivalent, type Branch, type BranchFormValues } from "@/lib/branches/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import {
  TableSelectionActionDivider,
  TableSelectionActionGroup,
} from "@/components/app-shell/table-selection-action-group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RouteEndpointsDialog } from "@/components/orders/route-endpoints-dialog";
import type { RouteEndpointLocations } from "@/lib/orders/schemas/route-endpoints.schema";
import { AssignAppointmentRouteDialog } from "@/components/orders/assign-appointment-route-dialog";
import {
  getGoogleMapsCoreApi,
  importGoogleMapsLibrary,
  loadGoogleMaps,
} from "@/lib/maps/load-google-maps";
import { normalizeApiError } from "@/lib/api/axios";
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
import type { PickupOrderNumberUpdate } from "@/lib/orders/api/orders-api";
import { formatOrderRouteName } from "@/lib/orders/display";
import { useFinalizePickupRouteOrder, useOrders } from "@/lib/orders/hooks/use-orders";
import { BranchDepotRequiredError, useOptimizeAppointmentRoute } from "@/lib/orders/hooks/use-optimize-appointment-route";
import {
  AppointmentRouteOptimizationError,
  type AppointmentRouteOptimizationPlan,
  formatRouteDistance,
  planAppointmentRouteOptimization,
  resolveAppointmentRouteOptimizationErrorMessage,
  type AppointmentRouteStopOrder,
} from "@/lib/orders/utils/appointment-route-optimization";
import {
  buildOrderListParams,
  getOrderRecordId,
  type Order,
  type OrderFilterState,
  type OrderListParams,
} from "@/lib/orders/types";
import { buildPickupMapStops, type PickupMapStop } from "@/lib/orders/utils/pickup-map";
import { assignManualStopNumber } from "@/lib/route-optimizer/stop-numbers";
import { buildPickupRouteColors, getPickupRouteColor } from "@/lib/orders/utils/pickup-map-colors";
import { buildPickupTruckMarkerUrl } from "@/lib/orders/utils/pickup-map-marker";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { canSelectAllOthers, selectAllOthers } from "@/lib/table/selection";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { useTranslation } from "@/lib/i18n";
import { useGoogleMapsApiKey } from "@/lib/company/hooks/use-current-company";
import { cn } from "@/lib/utils";

const MAP_ORDERS_LIMIT = 500;
const DEFAULT_MAP_CENTER = { lat: 40.7128, lng: -74.006 };
const DEFAULT_MAP_ZOOM = 11;

/** Clean street map: hide points of interest, business labels, and transit. */
const PLAIN_MAP_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station", stylers: [{ visibility: "off" }] },
] as const;

type LatLngLiteral = { lat: number; lng: number };

type LatLngBoundsLiteral = {
  north: number;
  south: number;
  east: number;
  west: number;
};

type GoogleMapInstance = {
  fitBounds: (bounds: LatLngBoundsLiteral, padding?: number) => void;
  setCenter: (center: LatLngLiteral) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
  addListener: (event: string, handler: () => void) => { remove: () => void };
};

type GoogleMarker = {
  addListener: (event: string, handler: () => void) => void;
  setIcon: (icon: unknown) => void;
  setLabel: (label: unknown) => void;
  setMap: (map: GoogleMapInstance | null) => void;
  setTitle: (title: string) => void;
  setZIndex: (zIndex: number) => void;
};

type GoogleMapsCore = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  Marker: new (options: Record<string, unknown>) => GoogleMarker;
  Point: new (x: number, y: number) => { x: number; y: number };
  Size: new (width: number, height: number) => { width: number; height: number };
};

type MarkerBinding = {
  marker: GoogleMarker;
  stop: PickupMapStop;
};

export type OrdersMapViewProps = {
  active: boolean;
  filters: OrderFilterState;
  sort: OrderListParams["sort"];
  /** Fixed set of orders mapped from the orders/pickups table selection. */
  baseSelectedIds: string[];
  /** Optimized stop numbers carried over from the appointments table, if any. */
  initialStopOrder?: AppointmentRouteStopOrder | null;
  /** Set when opened for a daily route; stop ordering (manual or optimized) is offered only then. */
  dailyRouteId?: string | null;
  onStopOrderChange?: (stopOrder: AppointmentRouteStopOrder | null) => void;
  getRouteByKey: (routeId: string | undefined) => ActiveRoute | undefined;
  onUnassignRoute: (orders: Order[]) => Promise<void>;
  isUnassigning: boolean;
};

function buildMarkerIcon(
  maps: GoogleMapsCore,
  options: { selected: boolean; color: string; size?: number },
) {
  const { selected, color, size = 36 } = options;
  const scale = size / 48;

  return {
    url: buildPickupTruckMarkerUrl(color, selected),
    scaledSize: new maps.Size(size, size),
    anchor: new maps.Point(size / 2, size / 2),
    // Keep stop numbers inside the cargo area, clear of the cab and wheels.
    labelOrigin: new maps.Point(17 * scale, 22 * scale),
  };
}

function buildMarkerLabel(stopNumber: number | undefined, size = 36) {
  if (stopNumber === undefined) return null;

  return {
    text: String(stopNumber),
    color: "#111827",
    fontSize: `${(stopNumber >= 100 ? 9 : 11) * size / 48}px`,
    fontWeight: "700",
  };
}

function getStopNumber(
  stop: PickupMapStop,
  stopOrder: AppointmentRouteStopOrder | null,
): number | undefined {
  if (!stopOrder || stop.routeId?.trim() !== stopOrder.routeId) return undefined;
  return stopOrder.stopNumbers[stop.orderRecordId];
}

function buildStopsBoundsLiteral(stops: PickupMapStop[]): LatLngBoundsLiteral | null {
  if (stops.length === 0) return null;

  let north = stops[0].lat;
  let south = stops[0].lat;
  let east = stops[0].lng;
  let west = stops[0].lng;

  for (const stop of stops) {
    north = Math.max(north, stop.lat);
    south = Math.min(south, stop.lat);
    east = Math.max(east, stop.lng);
    west = Math.min(west, stop.lng);
  }

  return { north, south, east, west };
}

export function OrdersMapView({
  active,
  filters,
  sort,
  baseSelectedIds,
  initialStopOrder = null,
  dailyRouteId = null,
  onStopOrderChange,
  getRouteByKey,
  onUnassignRoute,
  isUnassigning,
}: OrdersMapViewProps) {
  const { t, locale } = useTranslation();
  const googleMapsApiKey = useGoogleMapsApiKey();
  const { notifyError, notifySuccess } = useFeedback();
  const optimizeRouteMutation = useOptimizeAppointmentRoute();
  const { hasPermission } = useAuth();
  const canUpdateBranch = hasPermission(PERMISSIONS.branchesUpdate.name, PERMISSIONS.branchesUpdate.resourceType);
  const [depotBranch, setDepotBranch] = useState<Branch | null>(null);
  const [depotError, setDepotError] = useState<string | null>(null);
  const updateDepotBranch = useUpdateBranch();

  async function saveDepotBranch(values: BranchFormValues) {
    if (!depotBranch || updateDepotBranch.isPending) return;
    if (!values.address.location) { setDepotError(t("orders.optimize.errors.branchAddressMissing")); return; }
    if (areBranchFormValuesEquivalent(values, branchToFormValues(depotBranch))) { setDepotBranch(null); return; }
    try {
      await updateDepotBranch.mutateAsync({ branchId: depotBranch.id, values });
      setDepotBranch(null);
      setDepotError(null);
    } catch (error) { setDepotError(normalizeApiError(error).message); }
  }
  const finalizeRouteOrderMutation = useFinalizePickupRouteOrder();
  const [endpointPlan, setEndpointPlan] = useState<AppointmentRouteOptimizationPlan | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const mapsLibRef = useRef<GoogleMapsCore | null>(null);
  const markersRef = useRef<MarkerBinding[]>([]);
  const initializedSelectionRef = useRef(false);
  const stopListRef = useRef<HTMLUListElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [markerSize, setMarkerSize] = useState(36);
  const [mapError, setMapError] = useState<string | null>(null);
  const [assignRouteOpen, setAssignRouteOpen] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);
  /** Map-local selection, independent from the table selection that seeded the map. */
  const [mapSelectedIds, setMapSelectedIds] = useState<string[]>([]);
  /** Draft order for this browser session; saved to the API only via Finalize route order. */
  const [stopOrder, setStopOrder] = useState<AppointmentRouteStopOrder | null>(initialStopOrder);
  const [stopOrderSource, setStopOrderSource] = useState(initialStopOrder);
  if (stopOrderSource !== initialStopOrder) {
    setStopOrderSource(initialStopOrder);
    setStopOrder(initialStopOrder);
  }

  const mapListParams = useMemo(
    () =>
      buildOrderListParams({
        page: 1,
        limit: MAP_ORDERS_LIMIT,
        query: filters.query,
        rows: filters.rows,
        sort,
      }),
    [filters.query, filters.rows, sort],
  );

  const { data, isLoading, isError } = useOrders(mapListParams);
  const orders = useMemo(() => data?.items ?? [], [data?.items]);

  const orderByRecordId = useMemo(() => {
    const lookup = new Map<string, Order>();
    for (const order of orders) {
      lookup.set(getOrderRecordId(order), order);
    }
    return lookup;
  }, [orders]);

  const { stops: allStops } = useMemo(
    () => buildPickupMapStops(orders, getOrderRecordId),
    [orders],
  );

  /** Fixed set plotted on the map: verified stops from the table selection. */
  const mappedStops = useMemo(
    () => allStops.filter((stop) => baseSelectedIds.includes(stop.orderRecordId)),
    [allStops, baseSelectedIds],
  );

  const routeColors = useMemo(
    () => buildPickupRouteColors(mappedStops.map((stop) => stop.routeId)),
    [mappedStops],
  );
  const routeLegend = useMemo(
    () => {
      const names = new Map(mappedStops.map((stop) => [stop.routeId?.trim(), stop.routeName]));
      return [...routeColors].map(([routeId, color]) => ({ routeId, color, routeName: names.get(routeId) }));
    },
    [mappedStops, routeColors],
  );

  const baseIds = useMemo(() => mappedStops.map((stop) => stop.orderRecordId), [mappedStops]);
  const selectedStops = useMemo(
    () => mappedStops.filter((stop) => mapSelectedIds.includes(stop.orderRecordId)),
    [mappedStops, mapSelectedIds],
  );
  const selectedAssignRouteAppointments = useMemo(
    () =>
      selectedStops.map((stop) => ({
        id: stop.orderId,
        date: stop.date,
        completed: stop.completed,
        branch: stop.branch,
      })),
    [selectedStops],
  );
  const selectedAssignedStops = useMemo(
    () => selectedStops.filter((stop) => Boolean(stop.routeId?.trim())),
    [selectedStops],
  );
  /** Optimizing needs 2+ stops, every one assigned to the same route. */
  const selectionOnSingleRoute = useMemo(() => {
    if (selectedStops.length < 2) return false;
    const routeId = selectedStops[0].routeId?.trim();
    return Boolean(routeId) && selectedStops.every((stop) => stop.routeId?.trim() === routeId);
  }, [selectedStops]);

  /** Stop numbers apply only while the stop is still on the optimized route. */
  const stopNumbers = useMemo(() => {
    const lookup = new Map<string, number>();
    for (const stop of mappedStops) {
      const stopNumber = getStopNumber(stop, stopOrder);
      if (stopNumber !== undefined) lookup.set(stop.orderRecordId, stopNumber);
    }
    return lookup;
  }, [mappedStops, stopOrder]);

  const listedStops = useMemo(() => {
    if (stopNumbers.size === 0) return mappedStops;
    return [...mappedStops].sort(
      (left, right) =>
        (stopNumbers.get(left.orderRecordId) ?? Number.POSITIVE_INFINITY) -
        (stopNumbers.get(right.orderRecordId) ?? Number.POSITIVE_INFINITY),
    );
  }, [mappedStops, stopNumbers]);

  const allBaseSelected = baseIds.length > 0 && baseIds.every((id) => mapSelectedIds.includes(id));
  const othersAvailable = canSelectAllOthers(baseIds, mapSelectedIds);

  function toggleMapSelection(orderRecordId: string) {
    setMapSelectedIds((current) =>
      current.includes(orderRecordId)
        ? current.filter((id) => id !== orderRecordId)
        : [...current, orderRecordId],
    );
  }

  // Default every mapped stop to selected on first load, then keep selection pruned to the plotted set.
  useEffect(() => {
    const ids = mappedStops.map((stop) => stop.orderRecordId);
    if (ids.length === 0) {
      initializedSelectionRef.current = false;
      setMapSelectedIds((prev) => (prev.length ? [] : prev));
      return;
    }
    if (!initializedSelectionRef.current) {
      initializedSelectionRef.current = true;
      setMapSelectedIds(ids);
      return;
    }
    setMapSelectedIds((prev) => prev.filter((id) => ids.includes(id)));
  }, [mappedStops]);

  useEffect(() => {
    if (!active) {
      setMapReady(false);
      setMapError(null);
      return;
    }

    if (!googleMapsApiKey) {
      setMapError(t("orders.map.errors.notConfigured"));
      return;
    }

    let cancelled = false;

    async function initMap() {
      try {
        await loadGoogleMaps(googleMapsApiKey);
        await importGoogleMapsLibrary("maps", googleMapsApiKey);
        const maps = getGoogleMapsCoreApi() as GoogleMapsCore | null;
        if (!maps) {
          throw new Error(t("orders.map.errors.loadFailed"));
        }
        if (cancelled || !mapContainerRef.current) return;

        mapsLibRef.current = maps;
        const map = new maps.Map(mapContainerRef.current, {
          center: DEFAULT_MAP_CENTER,
          zoom: DEFAULT_MAP_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          // Let one-finger swipes scroll the mobile workspace; two fingers pan the map.
          gestureHandling: window.matchMedia("(max-width: 1023px)").matches ? "cooperative" : "greedy",
          clickableIcons: false,
          styles: PLAIN_MAP_STYLES,
        });
        mapRef.current = map;
        setMapReady(true);
        setMapError(null);
      } catch (error) {
        if (cancelled) return;
        setMapError(error instanceof Error ? error.message : t("orders.map.errors.loadFailed"));
      }
    }

    void initMap();

    return () => {
      cancelled = true;
      for (const binding of markersRef.current) {
        binding.marker.setMap(null);
      }
      markersRef.current = [];
      mapRef.current = null;
      mapsLibRef.current = null;
      setMapReady(false);
    };
  }, [active, t, googleMapsApiKey]);

  // Plot all mapped stops once per base change; selection styling is handled separately.
  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsLibRef.current;
    if (!active || !mapReady || !map || !maps) return;

    for (const binding of markersRef.current) {
      binding.marker.setMap(null);
    }
    markersRef.current = [];

    for (const stop of mappedStops) {
      const marker = new maps.Marker({
        map,
        position: { lat: stop.lat, lng: stop.lng },
        title: stop.senderName,
        icon: buildMarkerIcon(maps, {
          selected: false,
          color: getPickupRouteColor(routeColors, stop.routeId),
        }),
        zIndex: 1,
      });

      marker.addListener("click", () => toggleMapSelection(stop.orderRecordId));

      markersRef.current.push({ marker, stop });
    }

    if (mappedStops.length === 1) {
      map.setCenter({ lat: mappedStops[0].lat, lng: mappedStops[0].lng });
      map.setZoom(14);
      return;
    }

    const bounds = buildStopsBoundsLiteral(mappedStops);
    if (bounds) {
      map.fitBounds(bounds, 56);
    } else {
      map.setCenter(DEFAULT_MAP_CENTER);
      map.setZoom(DEFAULT_MAP_ZOOM);
    }
  }, [active, mapReady, mappedStops, routeColors]);

  // Scale the existing truck artwork without rebuilding markers or refetching stops.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const updateSize = () => {
      const zoom = map.getZoom() ?? DEFAULT_MAP_ZOOM;
      setMarkerSize(Math.max(18, Math.min(64, 36 * 2 ** ((zoom - DEFAULT_MAP_ZOOM) / 4))));
    };
    updateSize();
    const listener = map.addListener("zoom_changed", updateSize);
    return () => listener.remove();
  }, [mapReady]);

  // Repaint marker styling when the map selection, plotted set, or stop order changes.
  useEffect(() => {
    const maps = mapsLibRef.current;
    if (!maps) return;

    for (const binding of markersRef.current) {
      const selected = mapSelectedIds.includes(binding.stop.orderRecordId);
      const stopNumber = stopNumbers.get(binding.stop.orderRecordId);
      binding.marker.setIcon(
        buildMarkerIcon(maps, {
          selected,
          size: markerSize,
          color: getPickupRouteColor(routeColors, binding.stop.routeId),
        }),
      );
      binding.marker.setLabel(buildMarkerLabel(stopNumber, markerSize));
      binding.marker.setTitle(
        stopNumber !== undefined
          ? t("orders.optimize.stopTitle", { number: stopNumber, name: binding.stop.senderName })
          : binding.stop.senderName,
      );
      binding.marker.setZIndex(selected ? 2 : 1);
    }
  }, [mapReady, markerSize, mapSelectedIds, mappedStops, routeColors, stopNumbers, t]);

  function openAssignRouteDialog() {
    if (selectedStops.length === 0) return;
    setAssignRouteOpen(true);
  }

  function openUnassignDialog() {
    if (selectedAssignedStops.length === 0) return;
    setUnassignOpen(true);
  }

  async function confirmUnassign() {
    if (selectedAssignedStops.length === 0) return;

    const ordersToClear = selectedAssignedStops
      .map((stop) => orderByRecordId.get(stop.orderRecordId))
      .filter((order): order is Order => Boolean(order));

    if (ordersToClear.length === 0) return;

    try {
      await onUnassignRoute(ordersToClear);
      setUnassignOpen(false);
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  function updateStopOrder(next: AppointmentRouteStopOrder | null) {
    setStopOrder(next);
    onStopOrderChange?.(next);
  }

  /** Manual entry: an empty value removes the stop's number; others shift to close gaps. */
  function setManualStopNumber(stop: PickupMapStop, rawValue: string): boolean {
    if (!dailyRouteId || stop.routeId?.trim() !== dailyRouteId) return false;

    const trimmed = rawValue.trim();
    const position = trimmed === "" ? null : Number(trimmed);
    if (position !== null && (!Number.isInteger(position) || position < 1)) return false;
    if (position === (stopNumbers.get(stop.orderRecordId) ?? null)) return true;

    const next = assignManualStopNumber(
      Object.fromEntries(stopNumbers),
      stop.orderRecordId,
      position,
    );
    updateStopOrder(
      Object.keys(next).length > 0
        ? { routeId: dailyRouteId, stopNumbers: next, totalDistanceMeters: null }
        : null,
    );
    return true;
  }

  /** Runs after the list re-sorts and inputs remount, so "next" reflects the updated stop order. */
  function focusNextStopNumberInput(orderRecordId: string) {
    requestAnimationFrame(() => {
      const inputs = Array.from(
        stopListRef.current?.querySelectorAll<HTMLInputElement>("input[data-stop-number-input]") ?? [],
      );
      const index = inputs.findIndex((input) => input.dataset.stopNumberInput === orderRecordId);
      const next = index >= 0 ? inputs[index + 1] : undefined;
      if (!next) return;
      next.focus();
      next.select();
    });
  }

  async function optimizeSelectedRoute() {
    if (!routeOrderingEnabled || optimizeRouteMutation.isPending) return;
    const ordersToOptimize = selectedStops
      .map((stop) => orderByRecordId.get(stop.orderRecordId))
      .filter((order): order is Order => Boolean(order));

    const { plan, issue } = planAppointmentRouteOptimization(ordersToOptimize);
    if (!plan) {
      notifyError(t(`orders.optimize.errors.${issue}`));
      return;
    }

    try {
      const result = await optimizeRouteMutation.mutateAsync(plan);
      updateStopOrder(result);
      notifyOptimizedRoute(result);
    } catch (mutationError) {
      if (mutationError instanceof BranchDepotRequiredError && canUpdateBranch) {
        setDepotBranch(mutationError.branch);
        setDepotError(null);
        return;
      }
      if (mutationError instanceof AppointmentRouteOptimizationError && mutationError.code === "branchCoordinatesMissing") {
        setEndpointPlan(plan);
        return;
      }
      notifyError(resolveAppointmentRouteOptimizationErrorMessage(mutationError, t));
    }
  }

  async function optimizeWithEndpoints(endpoints: RouteEndpointLocations) {
    if (!endpointPlan || endpointPlan.routeId !== dailyRouteId || optimizeRouteMutation.isPending) return;
    try {
      const result = await optimizeRouteMutation.mutateAsync({ ...endpointPlan, endpoints });
      updateStopOrder(result);
      notifyOptimizedRoute(result);
      setEndpointPlan(null);
    } catch (mutationError) {
      notifyError(resolveAppointmentRouteOptimizationErrorMessage(mutationError, t));
    }
  }

  async function finalizeRouteOrder() {
    if (!routeOrderingEnabled || !everyRouteStopNumbered || finalizeRouteOrderMutation.isPending) return;

    const updates: PickupOrderNumberUpdate[] = [];
    for (const [orderRecordId, orderNumber] of stopNumbers) {
      const order = orderByRecordId.get(orderRecordId);
      if (order && order.orderNumber !== orderNumber) {
        updates.push({ pickupId: order.id, orderNumber });
      }
    }

    if (updates.length === 0) {
      notifySuccess(t("common.form.noChanges"));
      return;
    }

    try {
      const result = await finalizeRouteOrderMutation.mutateAsync(updates);
      reportBulkSettled({
        result,
        total: updates.length,
        t,
        notifyError,
        onSucceeded: (count) => {
          notifySuccess(
            count === 1
              ? t("orders.optimize.finalizeSuccess", { count })
              : t("orders.optimize.finalizeSuccess_plural", { count }),
          );
        },
        onAllFailed: notifyError,
        onDone: () => {},
      });
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  function notifyOptimizedRoute(result: AppointmentRouteStopOrder) {
    const count = Object.keys(result.stopNumbers).length;
    const distance = formatRouteDistance(result.totalDistanceMeters ?? 0, locale);
    notifySuccess(
      count === 1
        ? t("orders.optimize.success", { count, distance })
        : t("orders.optimize.success_plural", { count, distance }),
    );
  }

  const routeOrderingEnabled = Boolean(dailyRouteId);
  const routeStops = mappedStops.filter((stop) => stop.routeId?.trim() === dailyRouteId);
  const everyRouteStopNumbered =
    routeStops.length > 0 && routeStops.every((stop) => stopNumbers.has(stop.orderRecordId));
  const isOptimizing = optimizeRouteMutation.isPending;
  const isFinalizing = finalizeRouteOrderMutation.isPending;
  const isMutating = isUnassigning || isOptimizing || isFinalizing;

  return (
    <>
      <div className="flex min-h-0 shrink-0 flex-col overflow-visible rounded-xl lg:flex-1 lg:shrink lg:overflow-hidden border border-border shadow-md ring-1 ring-black/5 bg-card dark:ring-white/10">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 font-medium text-foreground shadow-sm">
              <MapPin className="h-3.5 w-3.5" />
              {t("orders.map.stopsShown", { count: mappedStops.length })}
            </span>
            {mappedStops.length > 0 ? (
              selectedStops.length > 0 ? (
                <span className="font-medium text-primary">
                  {t("common.table.selected", {
                    count: selectedStops.length,
                    total: mappedStops.length,
                  })}
                </span>
              ) : (
                <span>{t(routeOrderingEnabled ? "orders.map.dailyRouteSelectionHint" : "orders.map.clickToSelect")}</span>
              )
            ) : null}
            {stopNumbers.size > 0 && stopOrder ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 font-medium text-violet-700 dark:text-violet-300">
                {stopOrder.totalDistanceMeters !== null ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    {t("orders.optimize.totalDistance", {
                      distance: formatRouteDistance(stopOrder.totalDistanceMeters, locale),
                    })}
                  </>
                ) : (
                  <>
                    <ListOrdered className="h-3.5 w-3.5" />
                    {t("orders.optimize.manualOrder")}
                  </>
                )}
              </span>
            ) : null}
          </div>

          <div className="flex min-w-0 w-full flex-wrap items-center gap-2 lg:w-auto [&_button]:min-h-11 lg:[&_button]:min-h-8">
            <TableSelectionActionGroup
              className="max-w-full flex-wrap [&>button]:min-w-0 [&>button]:flex-1 [&>button]:whitespace-normal [&>button]:px-2 [&>button]:text-xs sm:[&>button]:text-sm"
              aria-label={t("common.table.selectionActionsGroup")}
            >
              <Button
                variant="outline"
                size="sm"
                disabled={baseIds.length === 0 || allBaseSelected}
                onClick={() => setMapSelectedIds(baseIds)}
              >
                <CheckSquare className="h-4 w-4" />
                {t("common.table.selectAll")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={mapSelectedIds.length === 0}
                onClick={() => setMapSelectedIds([])}
              >
                <X className="h-4 w-4" />
                {t("common.table.deselectAll")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!othersAvailable}
                onClick={() => setMapSelectedIds(selectAllOthers(baseIds, mapSelectedIds))}
              >
                <ListChecks className="h-4 w-4" />
                {t("common.table.selectAllOthers")}
              </Button>
            </TableSelectionActionGroup>
            <TableSelectionActionDivider />
            {routeOrderingEnabled ? (
              <TableSelectionActionGroup aria-label={t("orders.map.legend.stopOrder")}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectionOnSingleRoute || isMutating}
                  onClick={() => void optimizeSelectedRoute()}
                  className={tableSelectionActionStyles.optimize}
                >
                  {isOptimizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isOptimizing ? t("orders.actions.optimizingRoute") : t("orders.actions.optimizeRoute")}
                </Button>
                {stopNumbers.size > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => updateStopOrder(null)}
                  >
                    <Eraser className="h-4 w-4" />
                    {t("orders.optimize.clearOrder")}
                  </Button>
                ) : null}
              </TableSelectionActionGroup>
            ) : null}
            {routeOrderingEnabled ? <TableSelectionActionDivider /> : null}
            <TableSelectionActionGroup aria-label={t("orders.actions.routeGroup")}>
              {!routeOrderingEnabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedStops.length === 0 || isMutating}
                  onClick={openAssignRouteDialog}
                >
                  <RouteIcon className="h-4 w-4" />
                  {t("orders.actions.assignRoute")}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                disabled={selectedAssignedStops.length === 0 || isMutating}
                onClick={openUnassignDialog}
                className="bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300"
              >
                <RouteOff className="h-4 w-4" />
                {t("orders.actions.unassignRoute")}
              </Button>
            </TableSelectionActionGroup>
          </div>
        </div>

        <div className="flex min-h-0 flex-col lg:flex-1 lg:flex-row">
          <div className="relative h-[clamp(15rem,35dvh,22rem)] min-w-0 shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
            <div ref={mapContainerRef} className="absolute inset-0 bg-muted" aria-label={t("orders.map.title")} />
            <div className="pointer-events-none absolute inset-0 z-[5] rounded-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" />

            {isLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 text-sm shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("orders.map.loading")}
                </div>
              </div>
            ) : null}

            {!isLoading && isError ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 px-6 text-center text-sm text-destructive">
                {t("orders.map.errors.loadOrdersFailed")}
              </div>
            ) : null}

            {!isLoading && !isError && mapError ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 px-6 text-center text-sm text-destructive">
                {mapError}
              </div>
            ) : null}

            {!isLoading && !isError && !mapError && mappedStops.length === 0 ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 px-6 text-center text-sm text-muted-foreground">
                {t("orders.map.empty")}
              </div>
            ) : null}

            <div className="absolute bottom-4 left-4 z-10 max-h-32 max-w-[calc(100%-2rem)] overflow-y-auto rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex flex-wrap items-center gap-3">
                {!routeOrderingEnabled ? (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <Truck className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                      {t("orders.map.legend.unassigned")}
                    </span>
                    {routeLegend.map(({ routeId, routeName, color }) => (
                      <span key={routeId} className="inline-flex items-center gap-1.5">
                        <Truck className="h-4 w-4 shrink-0" style={{ color }} aria-hidden="true" />
                        {formatOrderRouteName({ routeId, routeName }, getRouteByKey(routeId), t)}
                      </span>
                    ))}
                  </>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="h-4 w-4 shrink-0 text-blue-600 [filter:drop-shadow(1px_0_0_#ea580c)_drop-shadow(-1px_0_0_#ea580c)_drop-shadow(0_1px_0_#ea580c)_drop-shadow(0_-1px_0_#ea580c)]" aria-hidden="true" />
                  {t("orders.map.legend.selected")}
                </span>
                {stopNumbers.size > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold leading-none text-white">
                      1
                    </span>
                    {t("orders.map.legend.stopOrder")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {mappedStops.length > 0 ? (
            <aside className="flex min-h-0 w-full flex-col overflow-visible border-t border-border bg-muted/25 lg:w-80 lg:shrink-0 lg:overflow-hidden lg:border-l lg:border-t-0 lg:shadow-[-6px_0_16px_-8px_rgba(0,0,0,0.12)] dark:lg:shadow-[-6px_0_16px_-8px_rgba(0,0,0,0.45)]">
              <div className="shrink-0 border-b border-border bg-muted/50 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">{t("orders.map.mappedStopsTitle")}</h3>
                <p className="min-w-0 break-words text-xs text-foreground/70">
                  {t("common.table.selected", {
                    count: selectedStops.length,
                    total: mappedStops.length,
                  })}
                </p>
              </div>
              <ul ref={stopListRef} className="min-h-0 space-y-2 p-3 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain" tabIndex={0} aria-label={t("orders.map.mappedStopsTitle")}>
                {listedStops.map((stop) => {
                  const selected = mapSelectedIds.includes(stop.orderRecordId);
                  const assigned = Boolean(stop.routeId?.trim());
                  const stopNumber = stopNumbers.get(stop.orderRecordId);
                  const routeColor = getPickupRouteColor(routeColors, stop.routeId);
                  const numberable =
                    routeOrderingEnabled && stop.routeId?.trim() === dailyRouteId;
                  return (
                    <li key={stop.orderRecordId} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => toggleMapSelection(stop.orderRecordId)}
                        aria-pressed={selected}
                        className={cn(
                          "flex min-w-0 flex-1 items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left shadow-sm ring-1 transition",
                          selected
                            ? "border-orange-500/60 bg-orange-500/[0.06] ring-orange-500/25"
                            : "border-border bg-background ring-black/5 hover:bg-muted/50 dark:ring-white/10",
                        )}
                      >
                        {selected ? (
                          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                        ) : (
                          <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-semibold leading-snug text-foreground">
                            {stop.senderName}
                          </span>
                          <span className="mt-0.5 block break-words text-xs leading-relaxed text-foreground/75">
                            {stop.addressLine}
                          </span>
                          <span className="mt-1 inline-flex max-w-full items-start gap-1.5">
                            {stopNumber !== undefined ? (
                              <span
                                className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white"
                                style={{ backgroundColor: routeColor }}
                                aria-label={t("orders.optimize.stopNumber", { number: stopNumber })}
                              >
                                {stopNumber}
                              </span>
                            ) : (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: routeColor }}
                                aria-hidden
                              />
                            )}
                            <span className="min-w-0 break-words text-xs text-foreground/70">
                              {assigned
                                ? formatOrderRouteName(
                                    { routeId: stop.routeId, routeName: stop.routeName },
                                    getRouteByKey(stop.routeId),
                                    t,
                                  )
                                : t("orders.map.legend.unassigned")}
                            </span>
                          </span>
                        </span>
                      </button>
                      {numberable ? (
                        <label className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background px-1.5 py-1.5 shadow-sm">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/60">
                            {t("orders.optimize.stopNumberShort")}
                          </span>
                          <input
                            // Remount when the number changes elsewhere so the field never shows a stale draft.
                            key={`${stop.orderRecordId}:${stopNumber ?? ""}`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={mappedStops.length}
                            defaultValue={stopNumber ?? ""}
                            disabled={isMutating}
                            data-stop-number-input={stop.orderRecordId}
                            aria-label={t("orders.optimize.stopNumberInput", { name: stop.senderName })}
                            className="h-11 w-full rounded-md lg:h-7 border border-input bg-transparent px-1 text-center text-sm font-semibold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            onBlur={(event) => {
                              if (!setManualStopNumber(stop, event.currentTarget.value)) {
                                event.currentTarget.value = stopNumber?.toString() ?? "";
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                                focusNextStopNumberInput(stop.orderRecordId);
                              }
                            }}
                          />
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {routeOrderingEnabled ? (
                <div className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:bg-muted/50 lg:pb-3">
                  <Button
                    size="sm"
                    className="min-h-11 w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70 lg:min-h-8"
                    disabled={!everyRouteStopNumbered || isMutating}
                    onClick={() => void finalizeRouteOrder()}
                  >
                    {isFinalizing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCheck className="h-4 w-4" />
                    )}
                    {isFinalizing ? t("orders.optimize.finalizingOrder") : t("orders.optimize.finalizeOrder")}
                  </Button>
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      </div>

      {endpointPlan && endpointPlan.routeId === dailyRouteId ? (
        <RouteEndpointsDialog
          onClose={() => setEndpointPlan(null)}
          onSubmit={optimizeWithEndpoints}
          isPending={isOptimizing}
        />
      ) : null}

      <AssignAppointmentRouteDialog
        open={assignRouteOpen}
        onOpenChange={setAssignRouteOpen}
        appointments={selectedAssignRouteAppointments}
      />

      <Dialog open={Boolean(depotBranch)} onOpenChange={(open) => { if (!open && !updateDepotBranch.isPending) setDepotBranch(null); }}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>{t("branches.form.editTitle")}</DialogTitle>
            <DialogDescription>{t("orders.optimize.errors.branchAddressMissing")}</DialogDescription>
          </DialogHeader>
          {depotBranch ? <BranchForm initialValues={branchToFormValues(depotBranch)} isEditing
            submitLabel={t("common.actions.saveChanges")} isSubmitting={updateDepotBranch.isPending}
            externalError={depotError} onSubmit={saveDepotBranch} onCancel={() => setDepotBranch(null)} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={unassignOpen}
        onOpenChange={(nextOpen) => {
          if (isUnassigning) return;
          setUnassignOpen(nextOpen);
        }}
      >
        <DialogContent
          className="z-[70]"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => {
            if (isUnassigning) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (isUnassigning) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("orders.dialogs.clearRouteTitle")}</DialogTitle>
            <DialogDescription>
              {selectedAssignedStops.length === 1
                ? t("orders.dialogs.clearRouteDescription", {
                    count: selectedAssignedStops.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("orders.dialogs.clearRouteDescription_plural", {
                    count: selectedAssignedStops.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnassignOpen(false)}
              disabled={isUnassigning}
            >
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton
              isPending={isUnassigning}
              onClick={() => void confirmUnassign()}
              label={t("orders.actions.unassignRoute")}
              pendingLabel={t("orders.actions.clearingRoute")}
              icon={RouteOff}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
