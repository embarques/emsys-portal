"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, ListChecks, Loader2, MapPin, Route as RouteIcon, RouteOff, Square, X } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
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
import {
  AssignAppointmentRouteDialog,
  sharedAppointmentDate,
} from "@/components/orders/assign-appointment-route-dialog";
import {
  getGoogleMapsCoreApi,
  importGoogleMapsLibrary,
  isGoogleMapsConfigured,
  loadGoogleMaps,
} from "@/lib/maps/load-google-maps";
import { normalizeApiError } from "@/lib/api/axios";
import { formatOrderRouteName } from "@/lib/orders/display";
import { useOrders } from "@/lib/orders/hooks/use-orders";
import {
  buildOrderListParams,
  getOrderRecordId,
  type Order,
  type OrderFilterState,
  type OrderListParams,
} from "@/lib/orders/types";
import { buildPickupMapStops, type PickupMapStop } from "@/lib/orders/utils/pickup-map";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { canSelectAllOthers, selectAllOthers } from "@/lib/table/selection";
import { useTranslation } from "@/lib/i18n";
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
};

type GoogleMarker = {
  addListener: (event: string, handler: () => void) => void;
  setIcon: (icon: unknown) => void;
  setMap: (map: GoogleMapInstance | null) => void;
  setZIndex: (zIndex: number) => void;
};

type GoogleMapsCore = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  Marker: new (options: Record<string, unknown>) => GoogleMarker;
  SymbolPath: { CIRCLE: number };
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
  getRouteByKey: (routeId: string | undefined) => ActiveRoute | undefined;
  onUnassignRoute: (orders: Order[]) => Promise<void>;
  isUnassigning: boolean;
};

function buildMarkerIcon(
  maps: GoogleMapsCore,
  options: { selected: boolean; hasRoute: boolean },
) {
  const { selected, hasRoute } = options;

  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: hasRoute ? "#7c3aed" : "#2563eb",
    fillOpacity: 1,
    strokeColor: selected ? "#ea580c" : "#ffffff",
    strokeWeight: selected ? 4 : 2,
    scale: selected ? 12 : 9,
  };
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
  getRouteByKey,
  onUnassignRoute,
  isUnassigning,
}: OrdersMapViewProps) {
  const { t } = useTranslation();
  const { notifyError } = useFeedback();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const mapsLibRef = useRef<GoogleMapsCore | null>(null);
  const markersRef = useRef<MarkerBinding[]>([]);
  const initializedSelectionRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [assignRouteOpen, setAssignRouteOpen] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);
  /** Map-local selection, independent from the table selection that seeded the map. */
  const [mapSelectedIds, setMapSelectedIds] = useState<string[]>([]);

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

  const baseIds = useMemo(() => mappedStops.map((stop) => stop.orderRecordId), [mappedStops]);
  const selectedStops = useMemo(
    () => mappedStops.filter((stop) => mapSelectedIds.includes(stop.orderRecordId)),
    [mappedStops, mapSelectedIds],
  );
  const selectedAssignedStops = useMemo(
    () => selectedStops.filter((stop) => Boolean(stop.routeId?.trim())),
    [selectedStops],
  );

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

    if (!isGoogleMapsConfigured()) {
      setMapError(t("orders.map.errors.notConfigured"));
      return;
    }

    let cancelled = false;

    async function initMap() {
      try {
        await loadGoogleMaps();
        await importGoogleMapsLibrary("maps");
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
  }, [active, t]);

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
          hasRoute: Boolean(stop.routeId?.trim()),
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
  }, [active, mapReady, mappedStops]);

  // Repaint marker styling when the map selection (or plotted set) changes.
  useEffect(() => {
    const maps = mapsLibRef.current;
    if (!maps) return;

    for (const binding of markersRef.current) {
      const selected = mapSelectedIds.includes(binding.stop.orderRecordId);
      binding.marker.setIcon(
        buildMarkerIcon(maps, {
          selected,
          hasRoute: Boolean(binding.stop.routeId?.trim()),
        }),
      );
      binding.marker.setZIndex(selected ? 2 : 1);
    }
  }, [mapSelectedIds, mappedStops]);

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

  const isMutating = isUnassigning;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border shadow-md ring-1 ring-black/5 bg-card dark:ring-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
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
                <span>{t("orders.map.clickToSelect")}</span>
              )
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <TableSelectionActionGroup aria-label={t("common.table.selectionActionsGroup")}>
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
            <TableSelectionActionGroup aria-label={t("orders.actions.routeGroup")}>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedStops.length === 0 || isMutating}
                onClick={openAssignRouteDialog}
              >
                <RouteIcon className="h-4 w-4" />
                {t("orders.actions.assignRoute")}
              </Button>
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

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative min-h-[min(72vh,48rem)] flex-1">
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

            <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full bg-blue-600 ring-1 ring-blue-900/40")} />
                  {t("orders.map.legend.unassigned")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full bg-violet-600 ring-1 ring-violet-900/40")} />
                  {t("orders.map.legend.assigned")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-orange-500")} />
                  {t("orders.map.legend.selected")}
                </span>
              </div>
            </div>
          </div>

          {mappedStops.length > 0 ? (
            <aside className="flex w-full shrink-0 flex-col border-t border-border bg-muted/25 lg:w-80 lg:border-l lg:border-t-0 lg:shadow-[-6px_0_16px_-8px_rgba(0,0,0,0.12)] dark:lg:shadow-[-6px_0_16px_-8px_rgba(0,0,0,0.45)]">
              <div className="border-b border-border bg-muted/50 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">{t("orders.map.mappedStopsTitle")}</h3>
                <p className="text-xs text-foreground/70">
                  {t("common.table.selected", {
                    count: selectedStops.length,
                    total: mappedStops.length,
                  })}
                </p>
              </div>
              <ul className="max-h-[min(40vh,24rem)] flex-1 space-y-2 overflow-y-auto p-3 lg:max-h-none">
                {mappedStops.map((stop) => {
                  const selected = mapSelectedIds.includes(stop.orderRecordId);
                  const assigned = Boolean(stop.routeId?.trim());
                  return (
                    <li key={stop.orderRecordId}>
                      <button
                        type="button"
                        onClick={() => toggleMapSelection(stop.orderRecordId)}
                        aria-pressed={selected}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left shadow-sm ring-1 transition",
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
                          <span className="block text-sm font-semibold leading-snug text-foreground">
                            {stop.senderName}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-foreground/75">
                            {stop.addressLine}
                          </span>
                          <span className="mt-1 inline-flex items-center gap-1.5">
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                assigned ? "bg-violet-600" : "bg-blue-600",
                              )}
                              aria-hidden
                            />
                            <span className="text-xs text-foreground/70">
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
                    </li>
                  );
                })}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>

      <AssignAppointmentRouteDialog
        open={assignRouteOpen}
        onOpenChange={setAssignRouteOpen}
        pickupIds={selectedStops.map((stop) => stop.orderId)}
        defaultDate={sharedAppointmentDate(
          selectedStops.map((stop) => orderByRecordId.get(stop.orderRecordId)?.date),
        )}
      />

      <Dialog
        open={unassignOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setUnassignOpen(false);
        }}
      >
        <DialogContent className="z-[70]" onOpenAutoFocus={(event) => event.preventDefault()}>
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
            <Button variant="outline" onClick={() => setUnassignOpen(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmUnassign()}
              disabled={isUnassigning}
            >
              <RouteOff className="h-4 w-4" />
              {t("orders.actions.unassignRoute")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
