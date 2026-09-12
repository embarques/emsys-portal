import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";

/** API-owned severity; frontend only displays it. */
export type UserActivitySeverity = "common" | "uncommon" | "rare";

export type UserActivityUser = {
  id: string;
  name: string;
};

/**
 * Standardized user activity row.
 *
 * API entity reference is `origin` + `id` (field name `id` on the wire).
 * The activity document’s own key is normalized to `activityId` so it does not
 * collide with the entity `id`.
 */
export type UserActivity = {
  activityId: string;
  timestamp: string;
  user: UserActivityUser;
  description: string;
  origin: string;
  /** Entity record id from API field `id` (paired with `origin`). */
  entityId: string;
  quantity: number | null;
  severity: UserActivitySeverity;
};

export type UserActivitySearchFilter = ApiListTextSearch;

export type UserActivityListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: UserActivitySearchFilter;
};

export const DEFAULT_USER_ACTIVITY_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "timestamp:desc",
} as const satisfies Pick<UserActivityListParams, "page" | "limit" | "sort">;

export function createUserActivitySearchFilter(value: string): UserActivitySearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildUserActivityListParams(input: {
  page: number;
  limit?: number;
  query: string;
  sort?: ApiListSortInput;
}): UserActivityListParams {
  const params: UserActivityListParams = {
    ...DEFAULT_USER_ACTIVITY_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.sort,
  };

  const search = createUserActivitySearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  return params;
}
