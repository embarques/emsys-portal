import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { CatalogPageParams } from "@/lib/api/fetch-catalog-page";
import { fetchCappedPage } from "@/lib/api/fetch-capped-page";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  createListTextSearch,
  hasResourceListFilters,
  type ApiSearchFilter,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import { COMPLAINT_BAR_OR_SEARCH_FIELDS, COMPLAINT_TABLE_FILTER_FIELDS } from "@/lib/complaints/filter-fields";
import {
  complaintCategorySchema,
  complaintInsightsSchema,
  complaintNotificationSchema,
  complaintSchema,
} from "@/lib/complaints/schemas/complaint.schema";
import type {
  Complaint,
  ComplaintAttachmentRequest,
  ComplaintCategory,
  ComplaintInsights,
  ComplaintIntakeRequest,
  ComplaintNotification,
  ComplaintPatch,
  ComplaintTarget,
} from "@/lib/complaints/types";
import { translateCurrent } from "@/lib/i18n/translate-current";

const endpoint = API_ENDPOINTS.COMPLAINTS;
/** The API rejects complaint pages larger than 100 records. */
const API_PAGE_LIMIT = 100;
const UNRESOLVED_FILTER: ApiSearchFilter = { field: "pending", operator: "eq", value: true };

function detailPath(id: string) {
  const trimmed = id.trim();
  if (!trimmed) throw new Error(translateCurrent("complaints.errors.missingId"));
  return `${endpoint}/${encodeURIComponent(trimmed)}`;
}

function versionHeaders(version: number) {
  return { headers: { "If-Match": `"${version}"` } };
}

function parseComplaint(response: ApiSuccessEnvelope<unknown>, fallbackKey: string): Complaint {
  assertMutationSuccess(response, translateCurrent(fallbackKey));
  return complaintSchema.parse(unwrapApiData(response));
}

/**
 * One API page (≤ 100 rows). Totals come from `total`: complaint `subtotal` uses the
 * legacy `total − limit × page` formula, so it is not a match count.
 */
function fetchComplaintApiPage(
  params: CatalogPageParams,
  fixedFilters: ApiSearchFilter[] = [],
): Promise<PaginatedResult<Complaint>> {
  const search = createListTextSearch(params.query ?? "");
  return fetchPaginatedResourceList({
    endpoint,
    page: params.page,
    limit: params.limit,
    isFiltered: hasResourceListFilters({
      search,
      filterRows: params.filterRows,
      tableFilterFields: COMPLAINT_TABLE_FILTER_FIELDS,
      hasChipFilters: fixedFilters.length > 0,
    }),
    buildGetQuery: () => buildApiListQuery({ page: params.page, limit: params.limit, sort: params.sort }),
    buildSearchBody: () =>
      buildStripeStyleSearchBody({
        sort: params.sort,
        filterGroups: buildResourceSearchFilterGroups({
          search,
          barOrSearchFields: COMPLAINT_BAR_OR_SEARCH_FIELDS,
          filterRows: params.filterRows,
          tableFilterFields: COMPLAINT_TABLE_FILTER_FIELDS,
          chipFilters: fixedFilters,
        }),
      }),
    normalize: (payload: PaginatedApiEnvelope<unknown>) => {
      assertMutationSuccess(payload, translateCurrent("complaints.errors.loadFailed"));
      const items = complaintSchema.array().parse(Array.isArray(payload.data) ? payload.data : []);
      return {
        items,
        page: payload.page ?? params.page,
        resultsPerPage: payload.resultsPerPage ?? items.length,
        total: typeof payload.total === "number" ? payload.total : items.length,
      };
    },
  });
}

/** One table page; larger page sizes are assembled from sequential 100-row API pages. */
export async function fetchComplaintsPage(
  params: CatalogPageParams,
  options: { unresolvedOnly?: boolean; signal?: AbortSignal } = {},
): Promise<PaginatedResult<Complaint>> {
  const fixedFilters = options.unresolvedOnly ? [UNRESOLVED_FILTER] : [];
  return fetchCappedPage(
    params,
    API_PAGE_LIMIT,
    (page, limit) => fetchComplaintApiPage({ ...params, page, limit }, fixedFilters),
    options.signal,
  );
}

/** Complaints the API flags `pending` (open, in progress or awaiting the customer). */
export async function fetchUnresolvedComplaintCount(): Promise<number> {
  const result = await fetchComplaintApiPage({ page: 1, limit: 1, sort: "createdAt:desc" }, [UNRESOLVED_FILTER]);
  return result.total;
}

export async function fetchComplaint(id: string, signal?: AbortSignal): Promise<Complaint> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(detailPath(id), { signal });
  return parseComplaint(response, "complaints.errors.loadFailed");
}

export async function fetchComplaintCategories(signal?: AbortSignal): Promise<ComplaintCategory[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(API_ENDPOINTS.COMPLAINT_CATEGORIES, { signal });
  assertMutationSuccess(response, translateCurrent("complaints.errors.categoriesFailed"));
  const data = response.data == null ? [] : unwrapApiData(response);
  return complaintCategorySchema.array().parse(Array.isArray(data) ? data : []).filter((category) => category.active);
}

export async function createComplaint(input: ComplaintIntakeRequest): Promise<Complaint> {
  const response = await apiClient.post<ApiSuccessEnvelope<unknown>>(endpoint, input);
  return parseComplaint(response, "complaints.errors.createFailed");
}

export async function patchComplaint(id: string, version: number, patch: ComplaintPatch): Promise<Complaint> {
  const response = await apiClient.patch<ApiSuccessEnvelope<unknown>>(detailPath(id), patch, versionHeaders(version));
  return parseComplaint(response, "complaints.errors.updateFailed");
}

export async function addComplaintNote(id: string, version: number, body: string): Promise<Complaint> {
  const response = await apiClient.post<ApiSuccessEnvelope<unknown>>(
    `${detailPath(id)}/events`,
    { body },
    versionHeaders(version),
  );
  return parseComplaint(response, "complaints.errors.updateFailed");
}

export async function replaceComplaintTargets(id: string, version: number, targets: ComplaintTarget[]): Promise<Complaint> {
  const response = await apiClient.put<ApiSuccessEnvelope<unknown>>(
    `${detailPath(id)}/targets`,
    { targets },
    versionHeaders(version),
  );
  return parseComplaint(response, "complaints.errors.updateFailed");
}

export async function addComplaintAttachment(id: string, version: number, attachment: ComplaintAttachmentRequest): Promise<Complaint> {
  const response = await apiClient.post<ApiSuccessEnvelope<unknown>>(
    `${detailPath(id)}/attachments`,
    attachment,
    versionHeaders(version),
  );
  return parseComplaint(response, "complaints.errors.updateFailed");
}

/** Category volume, employee targets, reopen count and mean resolution hours for inclusive UTC dates. */
export async function fetchComplaintInsights(from: string, to: string, signal?: AbortSignal): Promise<ComplaintInsights> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(`${endpoint}/insights`, { params: { from, to }, signal });
  assertMutationSuccess(response, translateCurrent("complaints.errors.insightsFailed"));
  return complaintInsightsSchema.parse(response.data ?? {});
}

/** Up to 100 complaints the current user has not acknowledged in the inbox. */
export async function fetchComplaintNotifications(signal?: AbortSignal): Promise<ComplaintNotification[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(`${endpoint}/notifications`, { signal });
  assertMutationSuccess(response, translateCurrent("complaints.errors.notificationsFailed"));
  const data = response.data == null ? [] : unwrapApiData(response);
  return complaintNotificationSchema.array().parse(Array.isArray(data) ? data : []);
}

export async function markComplaintNotificationRead(id: string): Promise<void> {
  const response = await apiClient.put<ApiSuccessEnvelope<unknown>>(`${endpoint}/notifications/${encodeURIComponent(id.trim())}/read`);
  assertMutationSuccess(response, translateCurrent("complaints.errors.updateFailed"));
}

export async function reopenComplaint(id: string, version: number, reason: string): Promise<Complaint> {
  const response = await apiClient.post<ApiSuccessEnvelope<unknown>>(
    `${detailPath(id)}/reopen`,
    { reason },
    versionHeaders(version),
  );
  return parseComplaint(response, "complaints.errors.updateFailed");
}
