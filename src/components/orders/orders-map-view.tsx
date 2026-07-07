"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, ListChecks, Loader2, MapPin, Route as RouteIcon, X } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
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
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  assignRouteOptions: SearchableSelectOption[];
  assignRoutesLoading: boolean;
  getRouteByKey: (routeId: string | undefined) => ActiveRoute | undefined;
  onAssignRoute: (routeId: string, pickupIds: number[]) => Promise<void>;
  isAssigning: boolean;
};

function buildMarkerIcon(
  maps: GoogleMapsCore,
  options: { selected: boolean; hasRoute: boolean },
) {
  const { selected, hasRoute } = options;

  let fillColor = "#2563eb";
  if (hasRoute) fillColor = "#7c3aed";
  if (selected) fillColor = "#ea580c";

  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor,
    fillOpacity: 1,
    strokeColor: selected ? "#ffffff" : "#1e3a8a",
    strokeWeight: selected ? 2.5 : 1.5,
    scale: selected ? 11 : 9,
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
  selectedIds,
  onSelectedIdsChange,
  assignRouteOptions,
  assignRoutesLoading,
  getRouteByKey,
  onAssignRoute,
  isAssigning,
}: OrdersMapViewProps) {
  const { t } = useTranslation();
  const { notifyError } = useFeedback();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const mapsLibRef = useRef<GoogleMapsCore | null>(null);
  const markersRef = useRef<MarkerBinding[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [assignRouteOpen, setAssignRouteOpen] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState("");

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
  const orders = data?.items ?? [];

  const { stops } = useMemo(
    () => buildPickupMapStops(orders, getOrderRecordId),
    [orders],
  );

  const selectedStops = useMemo(
    () => stops.filter((stop) => selectedIds.includes(stop.orderRecordId)),
    [selectedIds, stops],
  );

  const stopIds = useMemo(() => stops.map((stop) => stop.orderRecordId), [stops]);
  const allStopsSelected = stopIds.length > 0 && stopIds.every((id) => selectedIds.includes(id));
  const othersAvailable = canSelectAllOthers(stopIds, selectedIds);

  useEffect(() => {
    if (stops.length === 0 && selectedIds.length > 0) {
      onSelectedIdsChange([]);
    }
  }, [onSelectedIdsChange, selectedIds.length, stops.length]);

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

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsLibRef.current;
    if (!active || !mapReady || !map || !maps) return;

    for (const binding of markersRef.current) {
      binding.marker.setMap(null);
    }
    markersRef.current = [];

    for (const stop of stops) {
      const position = { lat: stop.lat, lng: stop.lng };

      const selected = selectedIds.includes(stop.orderRecordId);
      const marker = new maps.Marker({
        map,
        position,
        title: stop.senderName,
        icon: buildMarkerIcon(maps, {
          selected,
          hasRoute: Boolean(stop.routeId?.trim()),
        }),
        zIndex: selected ? 2 : 1,
      });

      marker.addListener("click", () => {
        onSelectedIdsChange(
          selectedIds.includes(stop.orderRecordId)
            ? selectedIds.filter((id) => id !== stop.orderRecordId)
            : [...selectedIds, stop.orderRecordId],
        );
      });

      markersRef.current.push({ marker, stop });
    }

    if (stops.length === 1) {
      map.setCenter({ lat: stops[0].lat, lng: stops[0].lng });
      map.setZoom(14);
      return;
    }

    const bounds = buildStopsBoundsLiteral(stops);
    if (bounds) {
      map.fitBounds(bounds, 56);
    } else {
      map.setCenter(DEFAULT_MAP_CENTER);
      map.setZoom(DEFAULT_MAP_ZOOM);
    }
  }, [active, mapReady, onSelectedIdsChange, selectedIds, stops]);

  useEffect(() => {
    const maps = mapsLibRef.current;
    if (!maps) return;

    for (const binding of markersRef.current) {
      const selected = selectedIds.includes(binding.stop.orderRecordId);
      binding.marker.setIcon(
        buildMarkerIcon(maps, {
          selected,
          hasRoute: Boolean(binding.stop.routeId?.trim()),
        }),
      );
      binding.marker.setZIndex(selected ? 2 : 1);
    }
  }, [selectedIds]);

  function openAssignRouteDialog() {
    if (selectedStops.length === 0) return;
    setSelectedRouteId("");
    setAssignRouteOpen(true);
  }

  async function confirmAssignRoute() {
    if (selectedStops.length === 0 || !selectedRouteId) return;

    const pickupIds = selectedStops.map((stop) => stop.orderId);

    try {
      await onAssignRoute(selectedRouteId, pickupIds);
      setAssignRouteOpen(false);
      setSelectedRouteId("");
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 font-medium text-foreground shadow-sm">
              <MapPin className="h-3.5 w-3.5" />
              {t("orders.map.stopsShown", { count: stops.length })}
            </span>
            {selectedStops.length > 0 ? (
              <span className="font-medium text-primary">
                {t("common.table.selected", { count: selectedStops.length, total: stops.length })}
              </span>
            ) : (
              <span>{t("orders.map.clickToSelect")}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={stopIds.length === 0 || allStopsSelected}
              onClick={() => onSelectedIdsChange(stopIds)}
            >
              <CheckSquare className="h-4 w-4" />
              {t("common.table.selectAll")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.length === 0}
              onClick={() => onSelectedIdsChange([])}
            >
              <X className="h-4 w-4" />
              {t("common.table.deselectAll")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!othersAvailable}
              onClick={() => onSelectedIdsChange(selectAllOthers(stopIds, selectedIds))}
            >
              <ListChecks className="h-4 w-4" />
              {t("common.table.selectAllOthers")}
            </Button>
            <Button
              size="sm"
              disabled={selectedStops.length === 0 || isAssigning}
              onClick={openAssignRouteDialog}
            >
              <RouteIcon className="h-4 w-4" />
              {t("orders.actions.assignRoute")}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative min-h-[min(72vh,48rem)] flex-1">
            <div ref={mapContainerRef} className="absolute inset-0 bg-muted" aria-label={t("orders.map.title")} />

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

            {!isLoading && !isError && !mapError && stops.length === 0 ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 px-6 text-center text-sm text-muted-foreground">
                {t("orders.map.empty")}
              </div>
            ) : null}

            <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full bg-blue-600")} />
                  {t("orders.map.legend.unassigned")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full bg-violet-600")} />
                  {t("orders.map.legend.assigned")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full bg-orange-600 ring-2 ring-white")} />
                  {t("orders.map.legend.selected")}
                </span>
              </div>
            </div>
          </div>

          {selectedStops.length > 0 ? (
            <aside className="flex w-full shrink-0 flex-col border-t bg-background lg:w-80 lg:border-l lg:border-t-0">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">{t("orders.map.selectedStopsTitle")}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("orders.map.selected", { count: selectedStops.length })}
                </p>
              </div>
              <ul className="max-h-[min(40vh,24rem)] flex-1 space-y-0 overflow-y-auto lg:max-h-none">
                {selectedStops.map((stop) => (
                  <li key={stop.orderRecordId} className="border-b last:border-b-0">
                    <div className="flex items-start gap-2 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{stop.senderName}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {stop.addressLine}
                        </p>
                        {stop.routeId ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("orders.columns.route")}:{" "}
                            {formatOrderRouteName(
                              { routeId: stop.routeId, routeName: stop.routeName },
                              getRouteByKey(stop.routeId),
                              t,
                            )}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground"
                        aria-label={t("orders.map.removeStop", { name: stop.senderName })}
                        onClick={() =>
                          onSelectedIdsChange(
                            selectedIds.filter((id) => id !== stop.orderRecordId),
                          )
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>

      <Dialog
        open={assignRouteOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setAssignRouteOpen(false);
            setSelectedRouteId("");
          }
        }}
      >
        <DialogContent className="z-[70]" onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("orders.dialogs.assignRouteTitle")}</DialogTitle>
            <DialogDescription>
              {selectedStops.length === 1
                ? t("orders.dialogs.assignRouteDescription", { count: selectedStops.length })
                : t("orders.dialogs.assignRouteDescription_plural", { count: selectedStops.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="map-assign-route">{t("orders.columns.route")}</Label>
            <SearchableSelect
              id="map-assign-route"
              value={selectedRouteId}
              onValueChange={setSelectedRouteId}
              placeholder={t("orders.dialogs.selectRoute")}
              searchPlaceholder={t("orders.dialogs.searchRoutes")}
              loading={assignRoutesLoading}
              emptyMessage={
                assignRoutesLoading
                  ? t("orders.dialogs.loadingRoutes")
                  : t("orders.dialogs.noRoutesFound")
              }
              options={assignRouteOptions}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignRouteOpen(false);
                setSelectedRouteId("");
              }}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={() => void confirmAssignRoute()} disabled={!selectedRouteId || isAssigning}>
              <RouteIcon className="h-4 w-4" />
              {t("orders.actions.assignRoute")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
