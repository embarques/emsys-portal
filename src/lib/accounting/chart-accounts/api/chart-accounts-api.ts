import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery, type ApiListFieldFilter } from "@/lib/api/list-query";
import {
  buildStripeStyleSearchBody,
  createOrTextSearchFilterGroup,
  hasListTextSearch,
  type ApiSearchFilterGroup,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import {
  DEFAULT_CHART_ACCOUNT_LIST_PARAMS,
  type ChartAccount,
  type ChartAccountList,
  type ChartAccountListParams,
  type ChartAccountRef,
  type ChartAccountType,
  type ChartAccountValues,
} from "@/lib/accounting/chart-accounts/types";

type ApiUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiBranchRef = {
  id?: number;
  name?: string;
  code?: string;
};

type ApiAccountRef = {
  id?: number;
  name?: string;
  displayName?: string;
};

type ApiChartAccount = {
  id?: number;
  name?: string;
  displayName?: string;
  type?: string;
  description?: string;
  branch?: ApiBranchRef | null;
  parentAccount?: ApiAccountRef | null;
  systemAccount?: boolean;
  branchAccount?: boolean;
  default?: boolean;
  createdAt?: string;
  createdBy?: ApiUser | string;
  updatedAt?: string;
  updatedBy?: ApiUser | string;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

const CHART_ACCOUNT_SEARCH_FIELDS = [
  "displayName",
  "name",
  "description",
  "type",
  "branch.code",
  "branch.name",
  "parentAccount.name",
] as const;

const CHART_ACCOUNT_TYPES = new Set<ChartAccountType>([
  "ASSET",
  "EXPENSE",
  "REVENUE",
  "BANK",
  "LOAN",
]);

function readUserName(user: unknown): string {
  if (!user) return "";
  if (typeof user === "string") return user.trim();
  if (typeof user === "object") {
    const entry = user as ApiUser;
    return String(entry.fullName ?? entry.userName ?? entry.name ?? "").trim();
  }
  return "";
}

function normalizeAccountRef(raw: unknown): ChartAccountRef | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const ref = raw as ApiAccountRef & ApiBranchRef;
  const id = Number(ref.id);
  const name = String(ref.name ?? ref.displayName ?? "").trim();
  const displayName = String(ref.displayName ?? ref.name ?? "").trim();
  const code = String(ref.code ?? "").trim();
  if (!Number.isFinite(id) || id <= 0) return undefined;
  return {
    id,
    name: name || displayName || String(id),
    displayName: displayName || name || undefined,
    code: code || undefined,
  };
}

function normalizeChartAccountType(value: unknown): ChartAccountType {
  const normalized = String(value ?? "").trim().toUpperCase();
  return CHART_ACCOUNT_TYPES.has(normalized as ChartAccountType)
    ? (normalized as ChartAccountType)
    : "ASSET";
}

function normalizeChartAccount(raw: unknown): ChartAccount | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiChartAccount;
  const id = Number(item.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const displayName = String(item.displayName ?? item.name ?? "").trim();
  const name = String(item.name ?? displayName).trim();

  return {
    id,
    name: name || displayName || String(id),
    displayName: displayName || name || String(id),
    type: normalizeChartAccountType(item.type),
    description: String(item.description ?? "").trim(),
    branch: normalizeAccountRef(item.branch),
    parentAccount: normalizeAccountRef(item.parentAccount),
    systemAccount: item.systemAccount === true,
    branchAccount: item.branchAccount === true,
    default: item.default === true,
    createdAt: String(item.createdAt ?? "").trim() || undefined,
    createdBy: readUserName(item.createdBy) || DEFAULT_CREATED_BY,
    updatedAt: String(item.updatedAt ?? "").trim() || undefined,
    updatedBy: readUserName(item.updatedBy) || undefined,
  };
}

function normalizePaginatedChartAccounts(
  payload: PaginatedApiEnvelope<unknown[]>,
  context: { isFiltered?: boolean } = {},
): PaginatedResult<ChartAccount> {
  const items = Array.isArray(payload.data)
    ? payload.data
        .map(normalizeChartAccount)
        .filter((account): account is ChartAccount => account != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

function listSearchText(params: ChartAccountListParams): string {
  return params.search?.value?.trim() || params.query?.trim() || "";
}

function typeFilter(params: ChartAccountListParams): ApiListFieldFilter | null {
  if (!params.type) return null;
  return { field: "type", operator: "eq", value: params.type };
}

function hasChartAccountListFilters(params: ChartAccountListParams): boolean {
  return Boolean(listSearchText(params) || params.type);
}

function buildChartAccountSearchBody(params: ChartAccountListParams) {
  const filterGroups: ApiSearchFilterGroup[] = [];
  const searchText = listSearchText(params);

  if (searchText) {
    const searchGroup = createOrTextSearchFilterGroup(
      searchText,
      [...CHART_ACCOUNT_SEARCH_FIELDS],
      params.search?.operator ?? "contains",
    );
    if (searchGroup) {
      filterGroups.push(searchGroup);
    }
  }

  const type = typeFilter(params);
  if (type) {
    filterGroups.push({
      operator: "and",
      filters: [type],
    });
  }

  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_CHART_ACCOUNT_LIST_PARAMS.sort,
    filterGroups,
  });
}

function buildChartAccountListQuery(params: ChartAccountListParams): string {
  const page = params.page ?? DEFAULT_CHART_ACCOUNT_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_CHART_ACCOUNT_LIST_PARAMS.limit;

  return buildApiListQuery({
    page,
    limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_CHART_ACCOUNT_LIST_PARAMS.sort,
    filter: typeFilter(params),
  });
}

function assertChartAccountMutation(payload: unknown, fallback: string) {
  const envelope = payload as ApiMutationEnvelope;
  if (envelope.success !== true) {
    throw new Error(String(envelope.message ?? envelope.error ?? "").trim() || fallback);
  }
}

function accountPayload(values: ChartAccountValues) {
  return {
    name: values.displayName.trim(),
    displayName: values.displayName.trim(),
    type: values.type,
    description: values.description.trim(),
    branch: values.branchId
      ? { id: values.branchId, code: values.branchCode, name: values.branchCode }
      : undefined,
    parentAccount: values.parentAccountId
      ? { id: values.parentAccountId, name: values.parentAccountName?.trim() || undefined }
      : undefined,
  };
}

export async function fetchChartAccounts(
  params: ChartAccountListParams = {},
): Promise<ChartAccountList> {
  const page = params.page ?? DEFAULT_CHART_ACCOUNT_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_CHART_ACCOUNT_LIST_PARAMS.limit;
  const isFiltered = hasChartAccountListFilters(params);

  const result = await fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.CHART_ACCOUNTS,
    page,
    limit,
    offset: params.offset,
    isFiltered,
    buildGetQuery: () => buildChartAccountListQuery(params),
    buildSearchBody: () => buildChartAccountSearchBody(params),
    normalize: normalizePaginatedChartAccounts,
  });

  return {
    items: result.items,
    page: result.page,
    resultsPerPage: result.resultsPerPage,
    total: result.total,
  };
}

export async function createChartAccount(values: ChartAccountValues): Promise<ChartAccount> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.CHART_ACCOUNTS,
    accountPayload(values),
  );
  assertChartAccountMutation(response, "Unable to create account.");
  const account = normalizeChartAccount(response.data);
  if (!account) {
    throw new Error("The API did not return the created account.");
  }
  return account;
}

export async function updateChartAccount(
  id: number,
  values: ChartAccountValues,
): Promise<ChartAccount> {
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.CHART_ACCOUNTS}/${id}`,
    accountPayload(values),
  );
  assertChartAccountMutation(response, "Unable to update account.");
  const account = normalizeChartAccount(response.data);
  if (!account) {
    throw new Error("The API did not return the updated account.");
  }
  return account;
}

export async function deleteChartAccount(id: number): Promise<void> {
  const response = await apiClient.delete<ApiMutationEnvelope>(`${API_ENDPOINTS.CHART_ACCOUNTS}/${id}`);
  assertChartAccountMutation(response, "Unable to delete account.");
}
