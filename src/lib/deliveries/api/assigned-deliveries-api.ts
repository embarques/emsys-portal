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

/** The API returns all tenant CONDUCE barcodes with delivery-view permission; no employee link is required. */
export function fetchAssignedDeliveryBarcodesPage(
  params: CatalogPageParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<AssignedDeliveryBarcode>> {
  return fetchCatalogPage(
    {
      endpoint: API_ENDPOINTS.DELIVERIES_ASSIGNED_BARCODES,
      client: {
        get: (url, config) => apiClient.get(url, { ...config, signal }),
        post: (url, data, config) => apiClient.post(url, data, { ...config, signal }),
      },
      barOrSearchFields: ASSIGNED_DELIVERY_BAR_OR_SEARCH_FIELDS,
      filterFields: ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS,
      expandNode: expandAssignedDeliveryFilterNode,
      fixedFilters: [ASSIGNED_ROUTE_FILTER],
      parseRows: parseAssignedDeliveryBarcodes,
    },
    params,
  );
}
