import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { buildApiListQuery, type ApiListFieldFilter } from "@/lib/api/list-query";
import {
  buildAdvancedSearchBody,
  buildApiFilterNodeFromTableRows,
  coerceTypedLeafFilter,
  createOrTextSearchFilterGroup,
  createTextSearchFilter,
  hasListTextSearch,
  isApiSearchFilter,
  resolveSearchField,
  resolveSearchOperator,
  type ApiSearchFilterGroup,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import { CUSTOMER_TABLE_FILTER_FIELDS } from "@/lib/customers/filter-fields";
import {
  coerceCustomerTypeFromApi,
  expandCustomerTypeSearchNode,
  appendCustomerTypeFilterGroup,
  isCustomerTypeFilterActive,
  portalCustomerTypeToApiFilterValue,
  portalCustomerTypeToApiWriteValue,
} from "@/lib/customers/customer-type";
import { expandCustomerCountrySearchNode } from "@/lib/customers/customer-country";
import {
  buildApiAddressPayload,
  buildApiAddressVerificationPayload,
  buildApiBranchDto,
  buildApiGeoLocationPayload,
  type ApiAddressPayload,
  type ApiBranchDtoPayload,
} from "@/lib/api/payloads";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import {
  type AddressGeoLocation,
  type AddressVerification,
  CUSTOMER_PORTAL_BRANCHES,
  type Customer,
  type CustomerBranch,
  type CustomerAddressLabel,
  type CustomerCoreAddress,
  type CustomerFormValues,
  DEFAULT_CUSTOMER_LIST_PARAMS,
  normalizeCustomerType,
  resolveCustomerBranchId,
  syncCustomerFormAddresses,
  validateCustomerFormValues,
  type CustomerListParams,
  type CustomerSearchMatchField,
  type CustomerSearchResult,
} from "@/lib/customers/types";
import { CUSTOMER_BAR_OR_SEARCH_FIELDS } from "@/lib/customers/search-fields";
import { buildApiPhonesPayload, normalizeRecordPhonesFromApi } from "@/lib/phones/phones";
import type { RecordPhone } from "@/lib/phones/types";

type ApiGeoLocation = {
  type?: string;
  coordinates?: unknown;
};

type ApiAddressVerification = {
  is_verified?: boolean;
  isVerified?: boolean;
  verified_at?: string;
  verifiedAt?: string;
};

type ApiAddress = {
  id?: string;
  label?: string;
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  isPrimary?: boolean;
  is_primary?: boolean;
  active?: boolean;
  location?: ApiGeoLocation | null;
  verification?: ApiAddressVerification | null;
};

type ApiCustomerSearchResult = {
  customer?: ApiCustomer;
  matchedBy?: string;
  matched_by?: string;
  matchedAddressId?: string;
  matched_address_id?: string;
};

type ApiBranch = {
  id?: number;
  name?: string;
  code?: string;
};

type ApiCustomer = {
  id?: string;
  oldID?: number;
  name?: string;
  customerType?: number;
  CustomerType?: number;
  phones?: RecordPhone[];
  email?: string;
  active?: boolean;
  IDNumber?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  accountBalance?: number;
  branch?: ApiBranch;
  createdByID?: number;
  addresses?: ApiAddress[];
  addressCount?: number;
  addressesCount?: number;
  address_count?: number;
  receivers?: string[];
};

/** POST/PUT /customers — see API_PAYLOADS.md */
type ApiCustomerAddressWritePayload = ApiAddressPayload & {
  id?: string;
  label?: string;
  isPrimary?: boolean;
  active?: boolean;
  phone?: string;
};

/** POST/PUT /customers — see API_PAYLOADS.md */
type ApiCustomerWritePayload = {
  name: string;
  customerType: number;
  phones: RecordPhone[];
  active: boolean;
  email?: string;
  IDNumber?: string;
  notes?: string;
  accountBalance?: number;
  addresses?: ApiCustomerAddressWritePayload[];
  branch: ApiBranchDtoPayload;
  receivers?: string[];
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByID?: number;
  oldID?: number;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

const CUSTOMER_NUMERIC_FIELDS: ReadonlySet<string> = new Set(["branch.id"]);

/** Coerces numeric customer leaf fields to JSON numbers (branch.id is numeric). */
function coerceCustomerNumericNode(node: ApiSearchFilterNode): ApiSearchFilterNode {
  if (isApiSearchFilter(node)) {
    if (!CUSTOMER_NUMERIC_FIELDS.has(node.field)) return node;
    return coerceTypedLeafFilter(node, { numericFields: CUSTOMER_NUMERIC_FIELDS }) ?? node;
  }

  return {
    operator: node.operator,
    filters: node.filters.map(coerceCustomerNumericNode),
  };
}

function expandCustomerSearchNode(node: ApiSearchFilterNode): ApiSearchFilterNode {
  return coerceCustomerNumericNode(
    expandCustomerCountrySearchNode(expandCustomerTypeSearchNode(node)),
  );
}

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readCustomerTypeFromApi(raw?: ApiCustomer): number | null {
  const value = raw?.customerType ?? raw?.CustomerType;
  if (value == null) return null;

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAddressLocation(raw?: ApiGeoLocation | null): AddressGeoLocation | null {
  if (!raw || !Array.isArray(raw.coordinates) || raw.coordinates.length < 2) return null;

  const longitude = Number(raw.coordinates[0]);
  const latitude = Number(raw.coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  return { type: "Point", coordinates: [longitude, latitude] };
}

function normalizeAddressVerification(
  raw?: ApiAddressVerification | null,
): AddressVerification | null {
  if (!raw) return null;

  const isVerified = raw.is_verified ?? raw.isVerified;
  if (isVerified == null) return null;

  return {
    isVerified: isVerified === true,
    verifiedAt: String(raw.verified_at ?? raw.verifiedAt ?? "").trim(),
  };
}

function normalizeAddressLabel(raw?: string): CustomerCoreAddress["label"] | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;

  const allowed: CustomerAddressLabel[] = [
    "Primary",
    "Home",
    "Work",
    "Billing",
    "Delivery",
    "Other",
  ];

  for (const entry of allowed) {
    if (entry.toLowerCase() === value.toLowerCase()) {
      return entry;
    }
  }

  return undefined;
}

function normalizeAddress(raw?: ApiAddress): CustomerCoreAddress {
  const address = raw ?? {};

  return {
    id: String(address.id ?? "").trim() || undefined,
    label: normalizeAddressLabel(address.label),
    address1: String(address.address1 ?? "").trim(),
    address2: String(address.address2 ?? "").trim(),
    apartment: String(address.apartment ?? "").trim(),
    city: String(address.city ?? "").trim(),
    state: String(address.state ?? "").trim(),
    zipcode: String(address.zipcode ?? address.zipCode ?? "").trim(),
    country: String(address.country ?? "").trim(),
    phone: String(address.phone ?? "").trim() || undefined,
    isPrimary: address.isPrimary === true || address.is_primary === true,
    active: address.active !== false,
    location: normalizeAddressLocation(address.location),
    verification: normalizeAddressVerification(address.verification),
  };
}

function normalizeBranch(raw?: ApiBranch): CustomerBranch {
  const branch = raw ?? {};
  const id = resolveCustomerBranchId({ id: readNumericId(branch.id), code: branch.code });
  const defaults = CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.id === id) ?? CUSTOMER_PORTAL_BRANCHES[0];

  return {
    id,
    name: String(branch.name ?? defaults.label).trim(),
    code: String(branch.code ?? defaults.code).trim(),
  };
}

function normalizeReceivers(raw?: string[]): string[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

function coreAddressHasContent(address: CustomerCoreAddress): boolean {
  return [
    address.address1,
    address.address2,
    address.apartment,
    address.city,
    address.state,
    address.zipcode,
    address.country,
  ].some((value) => value.trim());
}

function readAddressCount(raw: ApiCustomer): number | undefined {
  const value = raw.addressCount ?? raw.addressesCount ?? raw.address_count;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.floor(value);
}

function buildApiCustomerAddressWritePayload(
  address: CustomerCoreAddress,
): ApiCustomerAddressWritePayload | undefined {
  const base = buildApiAddressPayload(address);
  if (!base) return undefined;

  const payload: ApiCustomerAddressWritePayload = { ...base };
  const id = address.id?.trim();
  if (id) payload.id = id;

  const label = address.label?.trim();
  if (label) payload.label = label;

  payload.isPrimary = address.isPrimary === true;
  payload.active = address.active !== false;

  const phone = address.phone?.trim();
  if (phone) payload.phone = phone;

  return payload;
}

function buildCustomerAddressesWritePayload(
  values: CustomerFormValues,
): ApiCustomerAddressWritePayload[] {
  const synced = syncCustomerFormAddresses(values);

  return synced.addresses
    .filter(coreAddressHasContent)
    .map(buildApiCustomerAddressWritePayload)
    .filter((entry): entry is ApiCustomerAddressWritePayload => entry != null);
}

export function normalizeApiCustomer(raw: unknown): Customer | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiCustomer;
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  const addresses = Array.isArray(item.addresses)
    ? item.addresses.map(normalizeAddress).filter(coreAddressHasContent)
    : [];
  const branch = normalizeBranch(item.branch);

  const addressCount = readAddressCount(item);

  return {
    id,
    oldID: readNumericId(item.oldID) ?? null,
    name: String(item.name ?? "").trim(),
    customerType: readCustomerTypeFromApi(item),
    phones: normalizeRecordPhonesFromApi(item),
    email: String(item.email ?? "").trim(),
    active: item.active !== false,
    IDNumber: String(item.IDNumber ?? "").trim(),
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
    notes: String(item.notes ?? "").trim(),
    accountBalance: Number(item.accountBalance ?? 0),
    branch,
    createdByID: readNumericId(item.createdByID) ?? null,
    addresses,
    addressCount,
    receivers: normalizeReceivers(item.receivers),
  };
}

function normalizePaginatedCustomers(
  payload: PaginatedApiEnvelope<unknown[]>,
  options: { isFiltered?: boolean } = {},
): PaginatedResult<Customer> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeApiCustomer).filter((customer): customer is Customer => customer != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, options),
  };
}

function hasCustomerChipFilters(params: CustomerListParams): boolean {
  return (
    (params.branch !== undefined && params.branch !== "all") ||
    isCustomerTypeFilterActive(params.customerType)
  );
}

function resolveCustomerTypeListFilter(params: CustomerListParams): ApiListFieldFilter | undefined {
  if (!isCustomerTypeFilterActive(params.customerType)) return undefined;

  return {
    field: "customerType",
    operator: "eq",
    value: String(portalCustomerTypeToApiFilterValue(params.customerType)),
  };
}

function resolveCustomerGetFilter(params: CustomerListParams): ApiListFieldFilter | undefined {
  const completeRows = (params.filterRows ?? []).filter((row) => isCompleteFilterRow(row));
  if (completeRows.length !== 1) return undefined;

  const rowFilterNode = buildApiFilterNodeFromTableRows(completeRows, CUSTOMER_TABLE_FILTER_FIELDS);
  if (!rowFilterNode) return undefined;

  const expanded = expandCustomerSearchNode(rowFilterNode);
  if (!isApiSearchFilter(expanded)) return undefined;

  return {
    field: expanded.field,
    operator: expanded.operator,
    value: String(expanded.value),
  };
}

function shouldUseCustomerPostSearch(params: CustomerListParams): boolean {
  return hasCustomerListFilters(params);
}

function hasCustomerListFilters(params: CustomerListParams): boolean {
  return (
    hasListTextSearch(params.search) ||
    (params.filterRows ?? []).some((row) => isCompleteFilterRow(row)) ||
    hasCustomerChipFilters(params)
  );
}

function buildCustomerSearchFilterGroups(params: CustomerListParams): ApiSearchFilterGroup[] {
  const groups: ApiSearchFilterGroup[] = [];

  if (params.search?.value.trim()) {
    if (params.search.field) {
      const explicitFilter = createTextSearchFilter(
        resolveSearchField(params.search, "name"),
        params.search.value,
        resolveSearchOperator(params.search),
      );
      if (explicitFilter) {
        groups.push({ operator: "and", filters: [explicitFilter] });
      }
    } else {
      const orGroup = createOrTextSearchFilterGroup(
        params.search.value,
        [...(params.orFields ?? CUSTOMER_BAR_OR_SEARCH_FIELDS)],
        "contains",
      );
      if (orGroup) {
        groups.push(orGroup);
      }
    }
  }

  const rowFilterNode = buildApiFilterNodeFromTableRows(
    params.filterRows ?? [],
    CUSTOMER_TABLE_FILTER_FIELDS,
  );
  const expandedRowFilter = rowFilterNode ? expandCustomerSearchNode(rowFilterNode) : null;
  const chipFilters: ApiSearchFilterNode[] = [];

  if (expandedRowFilter) {
    if (isApiSearchFilter(expandedRowFilter)) {
      groups.push({ operator: "and", filters: [expandedRowFilter] });
    } else {
      groups.push(expandedRowFilter);
    }
  }

  if (params.branch !== undefined && params.branch !== "all") {
    const branchId = Number(params.branch);
    if (Number.isFinite(branchId)) {
      chipFilters.push({ field: "branch.id", operator: "eq", value: branchId });
    }
  }

  if (isCustomerTypeFilterActive(params.customerType)) {
    appendCustomerTypeFilterGroup(groups, params.customerType);
  }

  if (chipFilters.length > 0) {
    groups.push({ operator: "and", filters: chipFilters });
  }

  return groups;
}

/** POST /customers/search — unified advanced-search body. */
function buildCustomerSearchBody(params: CustomerListParams) {
  return buildAdvancedSearchBody({
    page: params.page ?? DEFAULT_CUSTOMER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_CUSTOMER_LIST_PARAMS.limit,
    sort: params.sort ?? DEFAULT_CUSTOMER_LIST_PARAMS.sort,
    filterGroups: buildCustomerSearchFilterGroups(params),
  });
}

function appendCustomerChipParams(query: string, params: CustomerListParams): string {
  const searchParams = new URLSearchParams(query);

  if (params.branch !== undefined && params.branch !== "all") {
    searchParams.set("branchId", String(params.branch));
  }

  return searchParams.toString();
}

/** GET /customers — unfiltered list and legacy single-filter fallback. */
function buildCustomersQuery(params: CustomerListParams): string {
  const query = buildApiListQuery({
    page: params.page ?? DEFAULT_CUSTOMER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_CUSTOMER_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_CUSTOMER_LIST_PARAMS.sort,
    filter: resolveCustomerGetFilter(params) ?? resolveCustomerTypeListFilter(params),
  });

  return appendCustomerChipParams(query, params);
}

export async function fetchCustomers(
  params: CustomerListParams = {},
): Promise<PaginatedResult<Customer>> {
  const isFiltered = hasCustomerListFilters(params);

  if (shouldUseCustomerPostSearch(params)) {
    const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
      `${API_ENDPOINTS.CUSTOMERS}/search`,
      buildCustomerSearchBody(params),
    );

    return normalizePaginatedCustomers(response, { isFiltered: true });
  }

  const query = buildCustomersQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.CUSTOMERS}?${query}`,
  );

  return normalizePaginatedCustomers(response, { isFiltered });
}

function buildCustomerWritePayload(
  values: CustomerFormValues,
  options: { customerId?: string } = {},
): ApiCustomerWritePayload {
  validateCustomerFormValues(values);

  const name = values.name.trim();
  const phones = buildApiPhonesPayload(values.phones);
  const email = values.email.trim();
  const idNumber = values.IDNumber.trim();
  const notes = values.notes.trim();
  const addresses = buildCustomerAddressesWritePayload(values);

  const payload: ApiCustomerWritePayload = {
    name,
    customerType: portalCustomerTypeToApiWriteValue(normalizeCustomerType(values.customerType)),
    phones,
    active: true,
    branch: buildApiBranchDto(values.branch),
  };

  if (email) {
    payload.email = email;
  }

  if (idNumber) {
    payload.IDNumber = idNumber;
  }

  if (notes) {
    payload.notes = notes;
  }

  if (addresses.length > 0) {
    payload.addresses = addresses;
  }

  if (options.customerId) {
    payload.id = options.customerId;
  }

  if (values.oldID != null && values.oldID > 0) {
    payload.oldID = values.oldID;
  }

  if (values.createdByID != null && values.createdByID > 0) {
    payload.createdByID = values.createdByID;
  }

  if (options.customerId) {
    if (values.createdAt.trim()) {
      payload.createdAt = values.createdAt;
    }

    if (values.updatedAt.trim()) {
      payload.updatedAt = values.updatedAt;
    }
  }

  return payload;
}


function extractCustomerFromMutationResponse(data: unknown): Customer | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeApiCustomer(data);
  }

  return null;
}

function extractCreatedCustomerId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;

  if (typeof data === "string") {
    const id = data.trim();
    return id || null;
  }

  const customer = extractCustomerFromMutationResponse(data);
  return customer?.id ?? null;
}

async function resolveCreatedCustomer(
  values: CustomerFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<Customer> {
  const createdId = extractCreatedCustomerId(response);
  if (createdId) {
    return fetchCustomerById(createdId);
  }

  const customer = extractCustomerFromMutationResponse(response.data);
  if (customer) {
    return customer;
  }

  const name = values.name.trim();
  if (name) {
    const matches = await fetchCustomers({
      page: 1,
      limit: 1,
      search: { field: "name", operator: "eq", value: name },
    });

    const matchedCustomer = matches.items[0];
    if (matchedCustomer) {
      return matchedCustomer;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create customer.");
}

export async function createCustomer(values: CustomerFormValues): Promise<Customer> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.CUSTOMERS,
    buildCustomerWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create customer.");

  return resolveCreatedCustomer(values, response);
}

export async function updateCustomer(
  customerId: string,
  values: CustomerFormValues,
): Promise<Customer> {
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.CUSTOMERS}/${customerId}`,
    buildCustomerWritePayload(values, { customerId }),
  );

  assertMutationSuccess(response, "Unable to update customer.");

  const updatedCustomer = extractCustomerFromMutationResponse(response.data);
  if (updatedCustomer) {
    return updatedCustomer;
  }

  return fetchCustomerById(customerId);
}

export async function deleteCustomer(customerId: string): Promise<void> {
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.CUSTOMERS}/${customerId}`,
  );

  assertMutationSuccess(response, "Unable to delete customer.");
}

export async function deleteCustomers(customerIds: string[]): Promise<void> {
  await Promise.all(customerIds.map((customerId) => deleteCustomer(customerId)));
}

/**
 * PUT /customers/{id}/address/location — atomically set the primary address
 * GeoJSON location without touching the rest of the customer record.
 */
export async function updateCustomerAddressLocation(
  customerId: string,
  location: AddressGeoLocation,
): Promise<Customer> {
  const payload = buildApiGeoLocationPayload(location);
  if (!payload) {
    throw new Error("A valid location with [longitude, latitude] is required.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.CUSTOMERS}/${customerId}/address/location`,
    payload,
  );

  assertMutationSuccess(response, "Unable to update address location.");

  return extractCustomerFromMutationResponse(response.data) ?? fetchCustomerById(customerId);
}

/**
 * PUT /customers/{id}/address/google-verification — atomically set the primary
 * address Google verification metadata.
 */
export async function updateCustomerAddressGoogleVerification(
  customerId: string,
  verification: AddressVerification,
): Promise<Customer> {
  const payload = buildApiAddressVerificationPayload(verification);
  if (!payload) {
    throw new Error("Verification metadata is required.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.CUSTOMERS}/${customerId}/address/google-verification`,
    payload,
  );

  assertMutationSuccess(response, "Unable to update address verification.");

  return extractCustomerFromMutationResponse(response.data) ?? fetchCustomerById(customerId);
}

export async function fetchCustomerById(customerId: string): Promise<Customer> {
  const response = await apiClient.get<ApiCustomer | PaginatedApiEnvelope<ApiCustomer>>(
    `${API_ENDPOINTS.CUSTOMERS}/${customerId}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiCustomer>).data
      : response;

  const customer = normalizeApiCustomer(raw);
  if (!customer) {
    throw new Error("Customer not found.");
  }

  return customer;
}

const CUSTOMER_SEARCH_MATCH_FIELDS: CustomerSearchMatchField[] = [
  "name",
  "phone",
  "idNumber",
  "email",
  "address",
];

function normalizeCustomerSearchMatchField(raw?: string): CustomerSearchMatchField | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;

  return CUSTOMER_SEARCH_MATCH_FIELDS.find(
    (field) => field.toLowerCase() === value.toLowerCase(),
  );
}

function normalizeCustomerSearchResult(raw: unknown): CustomerSearchResult | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiCustomerSearchResult;
  const customer = normalizeApiCustomer(item.customer ?? raw);
  if (!customer) return null;

  const matchedBy = normalizeCustomerSearchMatchField(item.matchedBy ?? item.matched_by);
  const matchedAddressId = String(item.matchedAddressId ?? item.matched_address_id ?? "").trim();

  return {
    customer,
    matchedBy,
    matchedAddressId: matchedAddressId || undefined,
  };
}

export type CustomerAutocompleteParams = {
  q: string;
  customerType: "sender" | "receiver";
  limit?: number;
};

/** GET /customers/autocomplete — address-aware customer search for party pickers. */
export async function fetchCustomerAutocomplete(
  params: CustomerAutocompleteParams,
): Promise<CustomerSearchResult[]> {
  const query = params.q.trim();
  if (!query) return [];

  const limit = params.limit ?? 20;

  const searchParams = new URLSearchParams({
    q: query,
    customerType: params.customerType,
    limit: String(limit),
  });

  try {
    const response = await apiClient.get<
      ApiCustomerSearchResult[] | PaginatedApiEnvelope<ApiCustomerSearchResult[]>
    >(`${API_ENDPOINTS.CUSTOMERS_AUTOCOMPLETE}?${searchParams.toString()}`);

    const rawItems = Array.isArray(response)
      ? response
      : Array.isArray((response as PaginatedApiEnvelope<ApiCustomerSearchResult[]>).data)
        ? ((response as PaginatedApiEnvelope<ApiCustomerSearchResult[]>).data ?? [])
        : [];

    return rawItems
      .map(normalizeCustomerSearchResult)
      .filter((entry): entry is CustomerSearchResult => entry != null);
  } catch {
    const customerType = params.customerType === "sender" ? 1 : 2;
    const fallback = await fetchCustomers({
      ...DEFAULT_CUSTOMER_LIST_PARAMS,
      limit,
      search: { field: "name", operator: "contains", value: query },
      customerType,
    });

    return fallback.items.map((customer) => ({ customer }));
  }
}
