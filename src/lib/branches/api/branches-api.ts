import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { buildApiListQuery, type ApiListFieldFilter } from "@/lib/api/list-query";
import {
  buildApiSearchBody,
  createTextSearchFilter,
  hasListTextSearch,
  resolveSearchField,
  resolveSearchOperator,
  type ApiSearchFilter,
} from "@/lib/api/search-query";
import {
  buildApiAddressPayload,
  type ApiAddressPayload,
  type ApiBranchSettingsPayload,
} from "@/lib/api/payloads";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  DEFAULT_BRANCH_LIST_PARAMS,
  createEmptyBranchSettings,
  type Branch,
  type BranchAddress,
  type BranchFormValues,
  type BranchListParams,
  type BranchSettings,
} from "@/lib/branches/types";
import { normalizeStoredPhone } from "@/lib/utils/phone";

const BRANCH_LIST_SEARCH_FIELD = "name";

type ApiAddress = {
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  country?: string;
  state?: string;
  zipcode?: string;
};

type ApiBranchSettings = {
  DefaultLabelStatus?: number;
  ImageResampleBy?: number;
  InvoiceCreatedThruIncomeStatement?: boolean;
  LabelPrefix?: string;
  PrintLabelCount?: boolean;
  RoundDecimalPlaces?: number;
  S3BucketFolder?: string;
  S3BucketName?: string;
  S3Profile?: string;
  S3ShareLinkExpireMinutes?: number;
  defaultLabelStatus?: number;
  imageResampleBy?: number;
  invoiceCreatedThruIncomeStatement?: boolean;
  labelPrefix?: string;
  printLabelCount?: boolean;
  roundDecimalPlaces?: number;
  s3BucketFolder?: string;
  s3BucketName?: string;
  s3Profile?: string;
  s3ShareLinkExpireMinutes?: number;
};

type ApiBranch = {
  id?: number;
  name?: string;
  code?: string;
  type?: string;
  phone1?: string;
  phone2?: string;
  logo?: string;
  disclaimer?: string;
  created?: string;
  address?: ApiAddress;
  settings?: ApiBranchSettings;
};

/** POST/PUT /branches — see API_PAYLOADS.md */
type ApiBranchWritePayload = {
  name: string;
  type: string;
  code: string;
  phone1: string;
  phone2?: string;
  disclaimer?: string;
  logo?: string;
  address?: ApiAddressPayload;
  settings?: ApiBranchSettingsPayload;
  id?: number;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeAddress(raw?: ApiAddress): BranchAddress {
  const address = raw ?? {};

  return {
    address1: String(address.address1 ?? "").trim(),
    address2: String(address.address2 ?? "").trim(),
    apartment: String(address.apartment ?? "").trim(),
    city: String(address.city ?? "").trim(),
    country: String(address.country ?? "").trim(),
    state: String(address.state ?? "").trim(),
    zipcode: String(address.zipcode ?? "").trim(),
  };
}

function normalizeBranchSettings(raw?: ApiBranchSettings): BranchSettings {
  const settings = raw ?? {};
  const defaults = createEmptyBranchSettings();

  return {
    defaultLabelStatus: Number(settings.DefaultLabelStatus ?? settings.defaultLabelStatus ?? defaults.defaultLabelStatus),
    imageResampleBy: Number(settings.ImageResampleBy ?? settings.imageResampleBy ?? defaults.imageResampleBy),
    invoiceCreatedThruIncomeStatement:
      settings.InvoiceCreatedThruIncomeStatement === true || settings.invoiceCreatedThruIncomeStatement === true,
    labelPrefix: String(settings.LabelPrefix ?? settings.labelPrefix ?? "").trim(),
    printLabelCount: settings.PrintLabelCount === true || settings.printLabelCount === true,
    roundDecimalPlaces: Number(settings.RoundDecimalPlaces ?? settings.roundDecimalPlaces ?? defaults.roundDecimalPlaces),
    s3BucketFolder: String(settings.S3BucketFolder ?? settings.s3BucketFolder ?? "").trim(),
    s3BucketName: String(settings.S3BucketName ?? settings.s3BucketName ?? "").trim(),
    s3Profile: String(settings.S3Profile ?? settings.s3Profile ?? "").trim(),
    s3ShareLinkExpireMinutes: Number(
      settings.S3ShareLinkExpireMinutes ?? settings.s3ShareLinkExpireMinutes ?? defaults.s3ShareLinkExpireMinutes,
    ),
  };
}

function normalizeBranch(raw: unknown): Branch | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiBranch;
  const id = readNumericId(item.id);
  if (id == null || id <= 0) return null;

  return {
    id,
    name: String(item.name ?? "").trim(),
    code: String(item.code ?? "").trim(),
    type: String(item.type ?? "").trim(),
    phone1: normalizeStoredPhone(String(item.phone1 ?? "")),
    phone2: normalizeStoredPhone(String(item.phone2 ?? "")),
    logo: String(item.logo ?? "").trim(),
    disclaimer: String(item.disclaimer ?? "").trim(),
    created: String(item.created ?? "").trim(),
    address: normalizeAddress(item.address),
    settings: normalizeBranchSettings(item.settings),
  };
}

function normalizePaginatedBranches(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<Branch> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeBranch).filter((branch): branch is Branch => branch != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function buildBranchSearchFilters(params: BranchListParams): ApiSearchFilter[] {
  const filters: ApiSearchFilter[] = [];

  if (params.search?.value.trim()) {
    const textFilter = createTextSearchFilter(
      resolveSearchField(params.search, BRANCH_LIST_SEARCH_FIELD),
      params.search.value,
      resolveSearchOperator(params.search),
    );
    if (textFilter) {
      filters.push(textFilter);
    }
  }

  if (params.type && params.type !== "all") {
    filters.push({ field: "type", operator: "eq", value: params.type });
  }

  return filters;
}

function resolveBranchListFilter(params: BranchListParams): ApiListFieldFilter | undefined {
  if (params.type && params.type !== "all") {
    return { field: "type", operator: "eq", value: params.type };
  }

  return undefined;
}

function buildBranchesQuery(params: BranchListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_BRANCH_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_BRANCH_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_BRANCH_LIST_PARAMS.sort,
    filter: resolveBranchListFilter(params),
  });
}

function buildBranchSettingsPayload(settings: BranchSettings): ApiBranchSettingsPayload | undefined {
  const payload: ApiBranchSettingsPayload = {};

  if (settings.labelPrefix.trim()) {
    payload.labelPrefix = settings.labelPrefix.trim();
  }

  if (settings.roundDecimalPlaces > 0) {
    payload.roundDecimalPlaces = settings.roundDecimalPlaces;
  }

  if (settings.defaultLabelStatus > 0) {
    payload.defaultLabelStatus = settings.defaultLabelStatus;
  }

  if (settings.invoiceCreatedThruIncomeStatement) {
    payload.invoiceCreatedThruIncomeStatement = true;
  }

  if (settings.printLabelCount) {
    payload.printLabelCount = true;
  }

  if (settings.imageResampleBy > 0) {
    payload.imageResampleBy = settings.imageResampleBy;
  }

  if (settings.s3Profile.trim()) {
    payload.s3Profile = settings.s3Profile.trim();
  }

  if (settings.s3BucketName.trim()) {
    payload.s3BucketName = settings.s3BucketName.trim();
  }

  if (settings.s3BucketFolder.trim()) {
    payload.s3BucketFolder = settings.s3BucketFolder.trim();
  }

  if (settings.s3ShareLinkExpireMinutes > 0) {
    payload.s3ShareLinkExpireMinutes = settings.s3ShareLinkExpireMinutes;
  }

  return Object.keys(payload).length > 0 ? payload : undefined;
}

function buildBranchWritePayload(
  values: BranchFormValues,
  options: { branchId?: number } = {},
): ApiBranchWritePayload {
  const name = values.name.trim();
  if (!name) throw new Error("Branch name is required.");

  const phone2 = normalizeStoredPhone(values.phone2);
  const disclaimer = values.disclaimer.trim();
  const logo = values.logo.trim();
  const address = buildApiAddressPayload(values.address);
  const settings = buildBranchSettingsPayload(values.settings);

  const payload: ApiBranchWritePayload = {
    name,
    type: values.type.trim(),
    code: values.code.trim(),
    phone1: normalizeStoredPhone(values.phone1),
  };

  if (options.branchId != null) {
    payload.id = options.branchId;
  }

  if (phone2) {
    payload.phone2 = phone2;
  }

  if (disclaimer) {
    payload.disclaimer = disclaimer;
  }

  if (logo) {
    payload.logo = logo;
  }

  if (address) {
    payload.address = address;
  }

  if (settings) {
    payload.settings = settings;
  }

  return payload;
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

function extractBranchFromMutationResponse(data: unknown): Branch | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeBranch(data);
  }
  return null;
}

function extractCreatedBranchId(response: ApiMutationEnvelope<unknown>): number | null {
  const data = response.data;

  if (typeof data === "number" && Number.isFinite(data)) {
    return data;
  }

  if (typeof data === "string") {
    const id = Number(data.trim());
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  const branch = extractBranchFromMutationResponse(data);
  return branch?.id ?? null;
}

function parseBranchPathId(branchId: string | number): number {
  const numericId = readNumericId(branchId);
  if (numericId == null || numericId <= 0) {
    throw new Error("Invalid branch ID.");
  }
  return numericId;
}

async function resolveCreatedBranch(
  values: BranchFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<Branch> {
  const createdId = extractCreatedBranchId(response);
  if (createdId) {
    return fetchBranchById(createdId);
  }

  const branch = extractBranchFromMutationResponse(response.data);
  if (branch) {
    return branch;
  }

  const name = values.name.trim();
  if (name) {
    const matches = await fetchBranches({
      page: 1,
      limit: 1,
      search: { field: "name", operator: "eq", value: name },
    });

    const matchedBranch = matches.items[0];
    if (matchedBranch) {
      return matchedBranch;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create branch.");
}

function buildBranchSearchBody(params: BranchListParams) {
  return buildApiSearchBody({
    page: params.page ?? DEFAULT_BRANCH_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_BRANCH_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_BRANCH_LIST_PARAMS.sort,
    filters: buildBranchSearchFilters(params),
  });
}

export async function fetchBranches(params: BranchListParams = {}): Promise<PaginatedResult<Branch>> {
  if (hasListTextSearch(params.search)) {
    const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
      `${API_ENDPOINTS.BRANCHES}/search`,
      buildBranchSearchBody(params),
    );

    return normalizePaginatedBranches(response);
  }

  const query = buildBranchesQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.BRANCHES}?${query}`,
  );

  return normalizePaginatedBranches(response);
}

export async function fetchBranchById(branchId: string | number): Promise<Branch> {
  const numericId = parseBranchPathId(branchId);
  const response = await apiClient.get<ApiBranch | PaginatedApiEnvelope<ApiBranch>>(
    `${API_ENDPOINTS.BRANCHES}/${numericId}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiBranch>).data
      : response;

  const branch = normalizeBranch(raw);
  if (!branch) {
    throw new Error("Branch not found.");
  }

  return branch;
}

export async function createBranch(values: BranchFormValues): Promise<Branch> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.BRANCHES,
    buildBranchWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create branch.");

  return resolveCreatedBranch(values, response);
}

export async function updateBranch(branchId: string | number, values: BranchFormValues): Promise<Branch> {
  const numericId = parseBranchPathId(branchId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.BRANCHES}/${numericId}`,
    buildBranchWritePayload(values, { branchId: numericId }),
  );

  assertMutationSuccess(response, "Unable to update branch.");

  const updatedBranch = extractBranchFromMutationResponse(response.data);
  if (updatedBranch) {
    return updatedBranch;
  }

  return fetchBranchById(numericId);
}

export async function deleteBranch(branchId: string | number): Promise<void> {
  const numericId = parseBranchPathId(branchId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.BRANCHES}/${numericId}`,
  );

  assertMutationSuccess(response, "Unable to delete branch.");
}

export async function deleteBranches(branchIds: Array<string | number>): Promise<void> {
  await Promise.all(branchIds.map((branchId) => deleteBranch(branchId)));
}
