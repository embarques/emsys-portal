import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { CatalogPageParams } from "@/lib/api/fetch-catalog-page";
import { fetchCappedPage } from "@/lib/api/fetch-capped-page";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import { buildResourceSearchFilterGroups, buildStripeStyleSearchBody, createListTextSearch, hasResourceListFilters } from "@/lib/api/search-query";
import { resolvePaginatedListTotal, type PaginatedResult } from "@/lib/api/types";
import { CHANGE_REQUEST_BAR_OR_SEARCH_FIELDS, CHANGE_REQUEST_TABLE_FILTER_FIELDS } from "@/lib/change-requests/filter-fields";
export type ChangeResource = "pickup" | "invoice" | "journal" | "labels" | "inventory";
export type ChangeRequest = {
    id: string;
    resourceType: ChangeResource;
    resourceId: string;
    action: "UPDATE" | "VOID";
    reason: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    reviewedAt?: string;
    reviewReason?: string;
    originalValues?: Record<string, unknown>;
    proposedChanges?: Record<string, unknown>;
    requestedBy: {
        id: number;
        name: string;
    };
    reviewedBy?: {
        id: number;
        name: string;
    };
};
export type TargetContext = {
    resourceType: ChangeResource;
    resourceId: string;
    version: string;
    allowedActions: {
        request_update?: boolean;
        request_void?: boolean;
        approve_change?: boolean;
    };
};
export type NewChange = {
    requestId: string;
    resourceType: ChangeResource;
    resourceId: string;
    action: "UPDATE" | "VOID";
    expectedVersion: string;
    reason: string;
    proposedChanges?: Record<string, unknown>;
};
/** The API rejects change-request pages larger than 100 records. */
const API_PAGE_LIMIT = 100;

function fetchChangeRequestApiPage(params: CatalogPageParams, signal?: AbortSignal): Promise<PaginatedResult<ChangeRequest>> {
    const search = createListTextSearch(params.query ?? "");
    return fetchPaginatedResourceList({
        endpoint: API_ENDPOINTS.CHANGE_REQUESTS,
        page: params.page,
        limit: params.limit,
        signal,
        isFiltered: hasResourceListFilters({ search, filterRows: params.filterRows, tableFilterFields: CHANGE_REQUEST_TABLE_FILTER_FIELDS }),
        buildGetQuery: () => buildApiListQuery({ page: params.page, limit: params.limit, sort: params.sort }),
        buildSearchBody: () => buildStripeStyleSearchBody({
            sort: params.sort,
            filterGroups: buildResourceSearchFilterGroups({
                search,
                barOrSearchFields: CHANGE_REQUEST_BAR_OR_SEARCH_FIELDS,
                filterRows: params.filterRows,
                tableFilterFields: CHANGE_REQUEST_TABLE_FILTER_FIELDS,
            }),
        }),
        normalize: (payload, context) => {
            const items = Array.isArray(payload.data) ? payload.data as ChangeRequest[] : [];
            return {
                items,
                page: payload.page ?? params.page,
                resultsPerPage: payload.resultsPerPage ?? items.length,
                total: resolvePaginatedListTotal(payload, items.length, context),
            };
        },
    });
}

/** GET /change-requests when unfiltered, POST /change-requests/search for the search box or filter rows. */
export function fetchChangeRequestsPage(params: CatalogPageParams, signal?: AbortSignal) {
    return fetchCappedPage(params, API_PAGE_LIMIT, (page, limit) => fetchChangeRequestApiPage({ ...params, page, limit }, signal), signal);
}
export async function fetchChangeTarget(resourceType: ChangeResource, resourceId: string, signal?: AbortSignal) { return apiClient.get<{
    data: TargetContext;
}>(`${API_ENDPOINTS.CHANGE_REQUESTS}/target?${new URLSearchParams({ resourceType, resourceId })}`, { signal }); }
export async function createChange(input: NewChange) { return apiClient.post<{
    data: ChangeRequest;
}>(API_ENDPOINTS.CHANGE_REQUESTS, input); }
export async function reviewChange(input: {
    id: string;
    approve: boolean;
    reason: string;
    resourceType: ChangeResource;
}) { return apiClient.post<{
    data: ChangeRequest;
}>(`${API_ENDPOINTS.CHANGE_REQUESTS}/${encodeURIComponent(input.id)}/${input.approve ? "approve" : "reject"}`, { reason: input.reason }); }
