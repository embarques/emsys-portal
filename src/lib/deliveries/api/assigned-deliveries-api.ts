import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { fetchCatalogPage, type CatalogPageParams } from "@/lib/api/fetch-catalog-page";
import type { ApiSearchFilter } from "@/lib/api/search-query";
import type { PaginatedResult } from "@/lib/api/types";
import {
  ASSIGNED_DELIVERY_BAR_OR_SEARCH_FIELDS,
  ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS,
  expandAssignedDeliveryFilterNode,
} from "@/lib/deliveries/filter-fields";
import { parseAssignedDeliveryBarcodes } from "@/lib/deliveries/schemas/assigned-delivery-barcode.schema";
import type { AssignedDeliveryBarcode } from "@/lib/deliveries/types";

/**
 * The route ID is present on routed pieces even when the route has no name.
 */
const ASSIGNED_ROUTE_FILTER: ApiSearchFilter = { field: "route.id", operator: "neq", value: null };

type AssignedDeliveryScope = {
  /**
   * Employee crew scope (`me` or an id). Pass `null`/`undefined` to omit so
   * broad-view grants can be limited by `scopedRouteId` alone.
   */
  routeEmployee?: string | null;
  /** Limit results to one daily delivery vehicle-route. */
  scopedRouteId?: string | null;
};

/** The API returns all tenant CONDUCE barcodes with delivery-view permission; no employee link is required. */
export function fetchAssignedDeliveryBarcodesPage(
  params: CatalogPageParams,
  signal?: AbortSignal,
  scope: string | AssignedDeliveryScope = {},
): Promise<PaginatedResult<AssignedDeliveryBarcode>> {
  const resolved: AssignedDeliveryScope =
    typeof scope === "string" ? { routeEmployee: scope } : scope;
  const routeEmployeeRaw = resolved.routeEmployee?.trim() || undefined;
  // Exact employee id only — reject display names like "Jonathan A".
  const routeEmployee =
    !routeEmployeeRaw
      ? undefined
      : routeEmployeeRaw === "me"
        ? "me"
        : /^\d+$/.test(routeEmployeeRaw) &&
            Number(routeEmployeeRaw) > 0 &&
            Number(routeEmployeeRaw) <= 65535
          ? routeEmployeeRaw
          : undefined;
  const scopedRouteIdRaw = resolved.scopedRouteId?.trim() || undefined;
  const scopedRouteId =
    scopedRouteIdRaw && /^[a-f\d]{24}$/i.test(scopedRouteIdRaw) ? scopedRouteIdRaw : undefined;
  const fixedFilters: ApiSearchFilter[] = [];
  if (!routeEmployee && !scopedRouteId) {
    fixedFilters.push(ASSIGNED_ROUTE_FILTER);
  }
  if (scopedRouteId) {
    fixedFilters.push({ field: "route.id", operator: "eq", value: scopedRouteId });
  }

  return fetchCatalogPage(
    {
      endpoint: API_ENDPOINTS.DELIVERIES_ASSIGNED_BARCODES,
      client: {
        get: (url, config) =>
          apiClient.get(url, {
            ...config,
            signal,
            params: routeEmployee ? { routeEmployee } : undefined,
          }),
        post: (url, data, config) =>
          apiClient.post(url, data, {
            ...config,
            signal,
            params: routeEmployee ? { routeEmployee } : undefined,
          }),
      },
      barOrSearchFields: ASSIGNED_DELIVERY_BAR_OR_SEARCH_FIELDS,
      filterFields: ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS,
      expandNode: expandAssignedDeliveryFilterNode,
      fixedFilters: fixedFilters.length ? fixedFilters : undefined,
      parseRows: parseAssignedDeliveryBarcodes,
    },
    params,
  );
}
