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
  DEFAULT_USER_ACTIVITY_LIST_PARAMS,
  type UserActivity,
  type UserActivityListParams,
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
  quantity?: number | null;
  severity?: string;
};

function hasUserActivityListFilters(params: UserActivityListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
  });
}

function buildUserActivitySearchBody(params: UserActivityListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: USER_ACTIVITY_BAR_OR_SEARCH_FIELDS,
      tableFilterFields: [],
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
    activityId,
    timestamp: readString(item.timestamp ?? item.createdAt),
    user: normalizeUser(item.user),
    description,
    origin: readString(item.origin) || "unknown",
    entityId,
    quantity: normalizeQuantity(item.quantity),
    severity: normalizeSeverity(item.severity),
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
