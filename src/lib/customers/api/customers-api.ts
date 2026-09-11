import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { logApiErrorDev, normalizeApiError } from "@/lib/api/api-error";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery, type ApiListFieldFilter } from "@/lib/api/list-query";
import {
  buildStripeStyleSearchBody,
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
  expandCustomerTypeSearchNode,
  appendCustomerTypeFilterGroup,
  isCustomerTypeFilterActive,
  portalCustomerTypeToApiFilterValue,
  portalCustomerTypeToApiWriteValue,
  CUSTOMER_TYPE_RECEIVER,
  CUSTOMER_TYPE_SENDER,
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
  type CustomerCoreAddress,
  type CustomerFormValues,
  DEFAULT_CUSTOMER_LIST_PARAMS,
  normalizeCustomerType,
  resolveCustomerBranchId,
  normalizeCustomerAddresses,
  normalizeCustomerFormValues,
  getCustomerPrimaryCoreAddress,
  coreAddressHasContent,
  validateCustomerFormValues,
  type CustomerListParams,
  type CustomerSearchResult,
} from "@/lib/customers/types";
import { fetchBranches } from "@/lib/branches/api/branches-api";
import {
  CUSTOMER_BAR_OR_SEARCH_FIELDS,
  CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS,
} from "@/lib/customers/search-fields";
import { resolvePartyPickerSearchMatch } from "@/lib/customers/utils/address-utils";
import {
  buildApiPhonesPayload,
  getPhoneAtDisplayIndex,
  getPrimaryPhoneNumber,
  normalizeRecordPhonesFromApi,
} from "@/lib/phones/phones";
import type { RecordPhone, RecordPhoneWritePayload } from "@/lib/phones/types";

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
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  location?: ApiGeoLocation | null;
  verification?: ApiAddressVerification | null;
  isPrimary?: boolean;
  is_primary?: boolean;
};

type ApiBranch = {
  id?: number;
  name?: string;
  code?: string;
};

type ApiUser = {
  id?: number | string;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiCustomer = {
  id?: string;
  oldID?: number;
  name?: string;
  customerType?: number;
  CustomerType?: number;
  phone1?: string;
  phone2?: string;
  phones?: RecordPhone[];
  email?: string;
  active?: boolean;
  IDNumber?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  accountBalance?: number;
  branch?: ApiBranch;
  /** Canonical audit actor — `core.User { id, name }`. */
  createdBy?: ApiUser | string | number | null;
  updatedBy?: ApiUser | string | number | null;
  /** @deprecated Prefer `createdBy.id`. Read-only fallback until backend migration finishes. */
  createdByID?: number;
  address?: ApiAddress;
  addresses?: ApiAddress[];
  receivers?: string[];
};

/** POST/PUT /customers — see API_PAYLOADS.md and live Customer schema (`phones[]`, `addresses[]`). */
type ApiCustomerWritePayload = {
  name: string;
  customerType: number;
  phone1: string;
  phone2?: string;
  phones?: RecordPhoneWritePayload[];
  active: boolean;
  email?: string;
  IDNumber?: string;
  notes?: string;
  accountBalance?: number;
  address?: ApiAddressPayload;
  addresses?: ApiAddressPayload[];
  branch: ApiBranchDtoPayload;
  receivers?: string[];
  id?: string;
  createdAt?: string;
  updatedAt?: string;
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

/**
 * Customer `accountBalance` is a stored API field (see CUSTOMER_BACKEND_CONFIRMATION /
 * API_PAYLOADS). Do not derive it from invoices, payments, or journals.
 */
function readAccountBalance(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readAuditActor(value: unknown) {
  if (value == null) return null;

  // Legacy plain-string actor → `name` (docs target is core.User, not bare strings).
  if (typeof value === "string") {
    const name = value.trim();
    return name ? { id: "", name } : null;
  }

  // Legacy numeric-only actor → `id`.
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return { id: String(value), name: "" };
  }

  if (typeof value !== "object") return null;

  const user = value as ApiUser;
  const id = String(user.id ?? "").trim();
  // Canonical field is `name`; fold compatibility aliases into that field.
  const name = String(user.name ?? user.fullName ?? user.userName ?? "").trim();

  if (!id && !name) return null;

  return { id, name };
}

/** Read-only fallback for deprecated `createdByID` until rows are backfilled to `createdBy`. */
function readLegacyCreatedById(value: unknown) {
  const id = readNumericId(value as number | string | undefined);
  if (id == null || id <= 0) return null;
  return { id: String(id), name: "" };
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

function normalizeAddress(raw?: ApiAddress, isPrimary = false): CustomerCoreAddress {
  const address = raw ?? {};
  const primaryFlag = raw?.isPrimary ?? raw?.is_primary;

  return {
    id: String(address.id ?? "").trim() || undefined,
    address1: String(address.address1 ?? "").trim(),
    address2: String(address.address2 ?? "").trim(),
    apartment: String(address.apartment ?? "").trim(),
    city: String(address.city ?? "").trim(),
    state: String(address.state ?? "").trim(),
    zipcode: String(address.zipcode ?? "").trim(),
    country: String(address.country ?? "").trim(),
    location: normalizeAddressLocation(address.location),
    verification: normalizeAddressVerification(address.verification),
    isPrimary: primaryFlag === true || isPrimary,
  };
}

function normalizeCustomerAddressesFromApi(item: ApiCustomer): CustomerCoreAddress[] {
  const fromArray = Array.isArray(item.addresses)
    ? item.addresses.map((entry) => normalizeAddress(entry)).filter(coreAddressHasContent)
    : [];

  if (fromArray.length > 0) {
    return normalizeCustomerAddresses(fromArray);
  }

  const legacy = normalizeAddress(item.address, true);
  return coreAddressHasContent(legacy) ? [legacy] : [];
}

type TransactionPartyAddressHolder = {
  address?: ApiAddress;
  addresses?: ApiAddress[];
};

/** Transaction snapshot from `party.address` only — not `party.addresses[]`. */
export function normalizeTransactionPartyAddresses(
  raw?: TransactionPartyAddressHolder | null,
): CustomerCoreAddress[] | null {
  if (!raw?.address || typeof raw.address !== "object") {
    return null;
  }

  const snapshot = normalizeAddress(raw.address, true);
  return coreAddressHasContent(snapshot) ? [snapshot] : null;
}

/**
 * Pickup/invoice parties carry a single address snapshot at create time (API PR #150).
 * Prefer `raw.address`; never hydrate the full customer address book from `addresses[]`.
 */
export function withTransactionPartyAddressSnapshot<T extends { addresses: CustomerCoreAddress[] }>(
  party: T,
  raw: unknown,
): T {
  const snapshotAddresses =
    raw && typeof raw === "object"
      ? normalizeTransactionPartyAddresses(raw as TransactionPartyAddressHolder)
      : null;

  return { ...party, addresses: snapshotAddresses ?? [] };
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

export function normalizeApiCustomer(raw: unknown): Customer | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiCustomer;
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  const addresses = normalizeCustomerAddressesFromApi(item);
  const branch = normalizeBranch(item.branch);

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
    accountBalance: readAccountBalance(item.accountBalance),
    branch,
    createdBy: readAuditActor(item.createdBy) ?? readLegacyCreatedById(item.createdByID),
    updatedBy: readAuditActor(item.updatedBy),
    addresses,
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

/** POST /customers/search — filters + sort in body; pagination in query string. */
function buildCustomerSearchBody(params: CustomerListParams) {
  return buildStripeStyleSearchBody({
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
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.CUSTOMERS,
    page: params.page ?? DEFAULT_CUSTOMER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_CUSTOMER_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasCustomerListFilters(params),
    buildGetQuery: () => buildCustomersQuery(params),
    buildSearchBody: () => buildCustomerSearchBody(params),
    normalize: normalizePaginatedCustomers,
  });
}

/** API wire codes for portal branches when `/branches` is unavailable. */
const CUSTOMER_BRANCH_API_CODES: Record<number, string> = {
  1: "NY",
  2: "RD",
};

function buildCustomerAddressWriteEntry(
  address: CustomerCoreAddress,
  scalarsOnly: boolean,
): ApiAddressPayload | undefined {
  const input = scalarsOnly
    ? {
        address1: address.address1,
        address2: address.address2,
        apartment: address.apartment,
        city: address.city,
        state: address.state,
        zipcode: address.zipcode,
        country: address.country,
      }
    : address;

  const payload = buildApiAddressPayload(input);
  if (!payload) return undefined;

  return {
    ...payload,
    isPrimary: address.isPrimary,
  };
}

function buildCustomerAddressesWritePayload(
  values: CustomerFormValues,
  scalarsOnly: boolean,
): ApiAddressPayload[] {
  const normalized = normalizeCustomerAddresses(values.addresses);
  const withContent = normalized.filter(coreAddressHasContent);
  if (withContent.length === 0) return [];

  return withContent
    .map((entry) => buildCustomerAddressWriteEntry(entry, scalarsOnly))
    .filter((entry): entry is ApiAddressPayload => entry != null);
}

async function resolveCustomerWriteBranch(branch: CustomerBranch): Promise<CustomerBranch> {
  try {
    const branches = await fetchBranches({ page: 1, limit: 100 });
    const match = branches.items.find((entry) => entry.id === branch.id);
    if (match?.code?.trim()) {
      return {
        id: match.id,
        name: match.name?.trim() || branch.name,
        code: match.code.trim(),
      };
    }
  } catch (error) {
    logApiErrorDev(error, { step: "resolveCustomerWriteBranch", branchId: branch.id });
  }

  const apiCode = CUSTOMER_BRANCH_API_CODES[branch.id];
  if (apiCode) {
    const defaults =
      CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.id === branch.id) ?? CUSTOMER_PORTAL_BRANCHES[0];
    return {
      id: defaults.id,
      name: defaults.label,
      code: apiCode,
    };
  }

  return branch;
}

function buildCustomerWritePayload(
  values: CustomerFormValues,
  options: { customerId?: string; addressScalarsOnly?: boolean } = {},
): ApiCustomerWritePayload {
  validateCustomerFormValues(values);

  const name = values.name.trim();
  const phones = buildApiPhonesPayload(values.phones);
  const phone1 = getPrimaryPhoneNumber(values.phones);
  const phone2 = getPhoneAtDisplayIndex(values.phones, 1);
  const email = values.email.trim();
  const idNumber = values.IDNumber.trim();
  const notes = values.notes.trim();
  const scalarsOnly = options.addressScalarsOnly === true;
  const addressesPayload = buildCustomerAddressesWritePayload(values, scalarsOnly);

  const payload: ApiCustomerWritePayload = {
    name,
    customerType: portalCustomerTypeToApiWriteValue(normalizeCustomerType(values.customerType)),
    phone1,
    phones,
    active: true,
    branch: buildApiBranchDto(values.branch),
  };

  if (phone2) {
    payload.phone2 = phone2;
  }

  if (email) {
    payload.email = email;
  }

  if (idNumber) {
    payload.IDNumber = idNumber;
  }

  if (notes) {
    payload.notes = notes;
  }

  // Round-trip the stored API balance (display-only in UI). Never invent a ledger total.
  if (Number.isFinite(values.accountBalance)) {
    payload.accountBalance = values.accountBalance;
  }

  if (addressesPayload.length > 0) {
    payload.addresses = addressesPayload;
  }

  if (options.customerId) {
    payload.id = options.customerId;
  }

  if (values.oldID != null && values.oldID > 0) {
    payload.oldID = values.oldID;
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

async function applyCustomerAddressMetadataAfterCreate(
  customer: Customer,
  address: CustomerCoreAddress,
): Promise<Customer> {
  let result = customer;
  const { location, verification } = address;

  if (location) {
    try {
      result = await updateCustomerAddressLocation(result.id, location);
    } catch (error) {
      logApiErrorDev(error, { step: "createCustomer.addressLocation", customerId: result.id });
    }
  }

  if (verification) {
    try {
      result = await updateCustomerAddressGoogleVerification(result.id, verification);
    } catch (error) {
      logApiErrorDev(error, { step: "createCustomer.addressVerification", customerId: result.id });
    }
  }

  return result;
}

export async function createCustomer(values: CustomerFormValues): Promise<Customer> {
  const syncedValues = normalizeCustomerFormValues(values);
  const branch = await resolveCustomerWriteBranch(syncedValues.branch);
  const payload = buildCustomerWritePayload(
    { ...syncedValues, branch },
    { addressScalarsOnly: true },
  );

  if (process.env.NODE_ENV === "development") {
    console.debug("[EMSYS customer create]", payload);
  }

  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.CUSTOMERS,
    payload,
  );

  assertMutationSuccess(response, "Unable to create customer.");

  const customer = await resolveCreatedCustomer(syncedValues, response);
  return applyCustomerAddressMetadataAfterCreate(
    customer,
    getCustomerPrimaryCoreAddress(syncedValues),
  );
}

export async function updateCustomer(
  customerId: string,
  values: CustomerFormValues,
): Promise<Customer> {
  const syncedValues = normalizeCustomerFormValues(values);
  const branch = await resolveCustomerWriteBranch(syncedValues.branch);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.CUSTOMERS}/${customerId}`,
    buildCustomerWritePayload({ ...syncedValues, branch }, { customerId }),
  );

  assertMutationSuccess(response, "Unable to update customer.");

  // Always reload the full customer. Mutation envelopes often omit addresses[],
  // which would wipe the party address summary on appointment/invoice forms.
  return fetchCustomerById(customerId);
}

export async function deleteCustomer(customerId: string): Promise<void> {
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.CUSTOMERS}/${customerId}`,
  );

  assertMutationSuccess(response, "Unable to delete customer.");
}

function isCustomerAlreadyDeletedError(error: unknown): boolean {
  const { message, status } = normalizeApiError(error);
  return status === 404 || /customer not found/i.test(message);
}

export type DeleteCustomersResult = {
  deletedIds: string[];
  failedMessage?: string;
};

export async function deleteCustomers(customerIds: string[]): Promise<DeleteCustomersResult> {
  const uniqueIds = [...new Set(customerIds.map((id) => id.trim()).filter(Boolean))];
  const deletedIds: string[] = [];
  let failedMessage: string | undefined;

  for (const customerId of uniqueIds) {
    try {
      await deleteCustomer(customerId);
      deletedIds.push(customerId);
    } catch (error) {
      if (isCustomerAlreadyDeletedError(error)) {
        deletedIds.push(customerId);
        continue;
      }
      failedMessage = normalizeApiError(error).message;
    }
  }

  return { deletedIds, failedMessage };
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

export type CustomerAutocompleteParams = {
  q: string;
  customerType: "sender" | "receiver";
  limit?: number;
};

/**
 * Party picker search — `POST /customers/search` with
 * `CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS` (`addresses.*` paths), matching any
 * address in `addresses[]`. Preserves `matchedAddressId` for the UI.
 */
export async function fetchCustomerAutocomplete(
  params: CustomerAutocompleteParams,
): Promise<CustomerSearchResult[]> {
  const query = params.q.trim();
  if (!query) return [];

  const limit = params.limit ?? 20;
  const customerType =
    params.customerType === "receiver" ? CUSTOMER_TYPE_RECEIVER : CUSTOMER_TYPE_SENDER;

  const result = await fetchCustomers({
    ...DEFAULT_CUSTOMER_LIST_PARAMS,
    limit,
    search: { value: query },
    customerType,
    orFields: CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS,
  });

  return result.items.map((customer) => ({
    customer,
    ...resolvePartyPickerSearchMatch(customer, query),
  }));
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
