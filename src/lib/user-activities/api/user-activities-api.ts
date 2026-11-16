import { USER_ACTIVITY_API_TABLE_FIELDS } from "@/lib/user-activities/table-fields";
import { captureApiTableFields } from "@/lib/table/api-table-fields";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import { USER_ACTIVITY_BAR_OR_SEARCH_FIELDS } from "@/lib/user-activities/search-fields";
import {
  expandUserActivityFilterNode,
  USER_ACTIVITY_TABLE_FILTER_FIELDS,
} from "@/lib/user-activities/filter-fields";
import {
  DEFAULT_USER_ACTIVITY_LIST_PARAMS,
  type UserActivity,
  type UserActivityListParams,
  type UserActivityRouteChange,
  type UserActivityRouteRef,
  type UserActivitySeverity,
  type UserActivityUser,
} from "@/lib/user-activities/types";

type ApiUser = {
  id?: number | string;
  name?: string;
  userName?: string;
  fullName?: string;
  email?: string;
};

type ApiUserActivity = {
  _id?: string;
  activityId?: string;
  id?: number | string;
  entityId?: string;
  recordId?: string;
  timestamp?: string;
  createdAt?: string;
  user?: ApiUser | string;
  description?: string;
  details?: string;
  activity?: string;
  origin?: string;
  eventType?: string;
  quantity?: number | null;
  severity?: string;
  barcodeRouteChange?: ApiBarcodeRouteChange | null;
};

type ApiRouteReference = {
  id?: string;
  name?: string;
  dailyRoute?: { date?: string; name?: string } | null;
};

type ApiBarcodeRouteChange = {
  barcodeId?: string;
  previous?: ApiRouteReference | null;
  next?: ApiRouteReference | null;
  previousTripNumber?: number | null;
};

function hasUserActivityListFilters(params: UserActivityListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
    filterRows: params.filterRows,
    tableFilterFields: USER_ACTIVITY_TABLE_FILTER_FIELDS,
  });
}

function buildUserActivitySearchBody(params: UserActivityListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: USER_ACTIVITY_BAR_OR_SEARCH_FIELDS,
      filterRows: params.filterRows,
      tableFilterFields: USER_ACTIVITY_TABLE_FILTER_FIELDS,
      expandNode: expandUserActivityFilterNode,
    }),
  });
}

function buildUserActivitiesQuery(params: UserActivityListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.sort,
  });
}

function readString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function readStringId(value: unknown): string | undefined {
  const id = readString(value);
  return id || undefined;
}

function normalizeSeverity(value: unknown): UserActivitySeverity {
  const raw = readString(value).toLowerCase();
  if (raw === "uncommon") return "uncommon";
  if (raw === "rare") return "rare";
  return "common";
}

/**
 * Map API `user` into display fields only.
 * Do not look up users or rewrite id/email — API owns actor consistency
 * (see APP_CONTEXT.md User Activity backend TODO).
 */
function normalizeUser(raw: ApiUser | string | undefined): UserActivityUser {
  if (!raw) return { id: "", name: "" };
  if (typeof raw === "string") {
    const name = raw.trim();
    return { id: "", name };
  }

  return {
    id: readStringId(raw.id) ?? "",
    name: readString(raw.fullName ?? raw.userName ?? raw.name ?? raw.email),
  };
}

function normalizeRouteRef(raw: ApiRouteReference | null | undefined): UserActivityRouteRef | null {
  if (!raw || typeof raw !== "object") return null;
  const id = readString(raw.id);
  const name = readString(raw.name) || readString(raw.dailyRoute?.name);
  if (!id && !name) return null;
  return { id, name, date: readString(raw.dailyRoute?.date) };
}

function normalizeRouteChange(raw: ApiBarcodeRouteChange | null | undefined): UserActivityRouteChange | null {
  if (!raw || typeof raw !== "object") return null;
  const previous = normalizeRouteRef(raw.previous);
  if (!previous) return null;
  const trip = Number(raw.previousTripNumber);
  return {
    barcodeId: readString(raw.barcodeId),
    previous,
    next: normalizeRouteRef(raw.next),
    previousTripNumber: Number.isInteger(trip) && trip > 0 ? trip : null,
  };
}

function normalizeQuantity(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Wire shape: entity reference is `id` (+ `origin`). Document key may be `_id`
 * or `activityId`. Fallbacks keep legacy/partial payloads renderable.
 */
export function normalizeUserActivity(raw: unknown): UserActivity | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiUserActivity;
  const documentId = readStringId(item._id) ?? readStringId(item.activityId);
  const entityId =
    readStringId(item.entityId) ??
    readStringId(item.recordId) ??
    (documentId ? readStringId(item.id) : undefined) ??
    readStringId(item.id) ??
    "";

  const activityId =
    documentId ??
    (entityId
      ? `activity:${readString(item.origin)}:${entityId}:${readString(item.timestamp ?? item.createdAt)}`
      : undefined);

  if (!activityId) return null;

  const description =
    readString(item.description) || readString(item.details) || readString(item.activity);

  return {
    ...captureApiTableFields(raw, USER_ACTIVITY_API_TABLE_FIELDS),
    activityId,
    timestamp: readString(item.timestamp ?? item.createdAt),
    user: normalizeUser(item.user),
    description,
    origin: readString(item.origin) || "unknown",
    eventType: readString(item.eventType),
    entityId,
    quantity: normalizeQuantity(item.quantity),
    severity: normalizeSeverity(item.severity),
    routeChange: normalizeRouteChange(item.barcodeRouteChange),
  };
}

function normalizePaginatedUserActivities(
  payload: PaginatedApiEnvelope<unknown[]>,
  context?: { isFiltered?: boolean },
): PaginatedResult<UserActivity> {
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const items = rows
    .map((row) => normalizeUserActivity(row))
    .filter((row): row is UserActivity => row != null);

  return {
    items,
    total: resolvePaginatedListTotal(payload, items.length, {
      isFiltered: context?.isFiltered,
    }),
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
  };
}

export async function fetchUserActivities(
  params: UserActivityListParams = {},
): Promise<PaginatedResult<UserActivity>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.USER_ACTIVITIES,
    page: params.page ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasUserActivityListFilters(params),
    buildGetQuery: () => buildUserActivitiesQuery(params),
    buildSearchBody: () => buildUserActivitySearchBody(params),
    normalize: normalizePaginatedUserActivities,
  });
}
