import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { buildApiListQuery, type ApiListFieldFilter } from "@/lib/api/list-query";
import {
  buildApiAddressPayload,
  buildApiBranchDto,
  type ApiAddressPayload,
  type ApiBranchDtoPayload,
} from "@/lib/api/payloads";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  CUSTOMER_PORTAL_BRANCHES,
  type Customer,
  type CustomerBranch,
  type CustomerBranchSettings,
  type CustomerCoreAddress,
  type CustomerFormValues,
  DEFAULT_CUSTOMER_LIST_PARAMS,
  normalizeCustomerSearchFilter,
  validateCustomerFormValues,
  toApiCustomerSearchField,
  type CustomerListParams,
} from "@/lib/customers/types";
import { normalizeStoredPhone } from "@/lib/utils/phone";

type ApiAddress = {
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
};

type ApiBranchSettings = {
  LabelPrefix?: string;
  InvoiceCreatedThruIncomeStatement?: boolean;
  PrintLabelCount?: boolean;
  RoundDecimalPlaces?: number;
  DefaultLabelStatus?: number;
  S3Profile?: string;
  S3BucketName?: string;
  S3BucketFolder?: string;
  S3ShareLinkExpireMinutes?: number;
  ImageResampleBy?: number;
  labelPrefix?: string;
  invoiceCreatedThruIncomeStatement?: boolean;
  printLabelCount?: boolean;
  roundDecimalPlaces?: number;
  defaultLabelStatus?: number;
  s3Profile?: string;
  s3BucketName?: string;
  s3BucketFolder?: string;
  s3ShareLinkExpireMinutes?: number;
  imageResampleBy?: number;
};

type ApiBranch = {
  id?: number;
  name?: string;
  code?: string;
  address?: ApiAddress;
  phone1?: string;
  logo?: string;
  settings?: ApiBranchSettings;
};

type ApiCustomer = {
  id?: string;
  oldID?: number;
  name?: string;
  customerType?: number;
  phone1?: string;
  phone2?: string;
  email?: string;
  active?: boolean;
  IDNumber?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  accountBalance?: number;
  branch?: ApiBranch;
  createdByID?: number;
  address?: ApiAddress;
  addresses?: ApiAddress[];
};

/** POST/PUT /customers — see API_PAYLOADS.md */
type ApiCustomerWritePayload = {
  name: string;
  customerType: number;
  phone1: string;
  active: boolean;
  email?: string;
  IDNumber?: string;
  phone2?: string;
  notes?: string;
  accountBalance?: number;
  address?: ApiAddressPayload;
  branch: ApiBranchDtoPayload;
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

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeAddress(raw?: ApiAddress): CustomerCoreAddress {
  const address = raw ?? {};

  return {
    address1: String(address.address1 ?? "").trim(),
    address2: String(address.address2 ?? "").trim(),
    apartment: String(address.apartment ?? "").trim(),
    city: String(address.city ?? "").trim(),
    state: String(address.state ?? "").trim(),
    zipcode: String(address.zipcode ?? "").trim(),
    country: String(address.country ?? "").trim(),
  };
}

function normalizeBranchSettings(raw?: ApiBranchSettings): CustomerBranchSettings {
  const settings = raw ?? {};

  return {
    labelPrefix: String(settings.LabelPrefix ?? settings.labelPrefix ?? "").trim(),
    invoiceCreatedThruIncomeStatement:
      settings.InvoiceCreatedThruIncomeStatement === true || settings.invoiceCreatedThruIncomeStatement === true,
    printLabelCount: settings.PrintLabelCount === true || settings.printLabelCount === true,
    roundDecimalPlaces: Number(settings.RoundDecimalPlaces ?? settings.roundDecimalPlaces ?? 0),
    defaultLabelStatus: Number(settings.DefaultLabelStatus ?? settings.defaultLabelStatus ?? 0),
    s3Profile: String(settings.S3Profile ?? settings.s3Profile ?? "").trim(),
    s3BucketName: String(settings.S3BucketName ?? settings.s3BucketName ?? "").trim(),
    s3BucketFolder: String(settings.S3BucketFolder ?? settings.s3BucketFolder ?? "").trim(),
    s3ShareLinkExpireMinutes: Number(
      settings.S3ShareLinkExpireMinutes ?? settings.s3ShareLinkExpireMinutes ?? 0,
    ),
    imageResampleBy: Number(settings.ImageResampleBy ?? settings.imageResampleBy ?? 0),
  };
}

function normalizeBranch(raw?: ApiBranch, fallbackCountry?: string): CustomerBranch {
  const branch = raw ?? {};
  const id = readNumericId(branch.id) ?? 1;
  const defaults = CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.id === id) ?? CUSTOMER_PORTAL_BRANCHES[0];

  return {
    id,
    name: String(branch.name ?? defaults.label).trim(),
    code: String(branch.code ?? defaults.code).trim(),
    address: normalizeAddress(branch.address ?? { country: fallbackCountry }),
    phone1: normalizeStoredPhone(String(branch.phone1 ?? "")),
    logo: String(branch.logo ?? "").trim(),
    settings: normalizeBranchSettings(branch.settings),
  };
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

export function normalizeApiCustomer(raw: unknown): Customer | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiCustomer;
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  const address = normalizeAddress(item.address);
  const addresses = Array.isArray(item.addresses)
    ? item.addresses.map(normalizeAddress).filter(coreAddressHasContent)
    : coreAddressHasContent(address)
      ? [address]
      : [];
  const primaryAddress = addresses[0] ?? address;
  const branch = normalizeBranch(item.branch, primaryAddress.country);

  return {
    id,
    oldID: readNumericId(item.oldID) ?? 0,
    name: String(item.name ?? "").trim(),
    customerType: readNumericId(item.customerType) ?? null,
    phone1: normalizeStoredPhone(String(item.phone1 ?? "")),
    phone2: normalizeStoredPhone(String(item.phone2 ?? "")),
    email: String(item.email ?? "").trim(),
    active: item.active !== false,
    IDNumber: String(item.IDNumber ?? "").trim(),
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
    notes: String(item.notes ?? "").trim(),
    accountBalance: Number(item.accountBalance ?? 0),
    branch,
    createdByID: readNumericId(item.createdByID) ?? null,
    address: primaryAddress,
    addresses,
  };
}

function normalizePaginatedCustomers(
  payload: PaginatedApiEnvelope<unknown[]>,
): PaginatedResult<Customer> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeApiCustomer).filter((customer): customer is Customer => customer != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function resolveCustomerListFilter(params: CustomerListParams): ApiListFieldFilter | undefined {
  if (params.search?.value.trim()) {
    const search = normalizeCustomerSearchFilter({
      ...params.search,
      value: params.search.value.trim(),
    });

    return {
      field: toApiCustomerSearchField(search.field),
      operator: search.operator,
      value: search.value,
    };
  }

  if (params.active !== undefined && params.active !== "all") {
    return { field: "active", operator: "eq", value: String(params.active) };
  }

  if (params.branch !== undefined && params.branch !== "all") {
    return { field: "branch.id", operator: "eq", value: String(params.branch) };
  }

  if (params.customerType !== undefined && params.customerType !== "all") {
    return { field: "customerType", operator: "eq", value: String(params.customerType) };
  }

  return undefined;
}

/** GET /customers — page, limit, sort, and optional field/operator/value filter. */
function buildCustomersQuery(params: CustomerListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_CUSTOMER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_CUSTOMER_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_CUSTOMER_LIST_PARAMS.sort,
    filter: resolveCustomerListFilter(params),
  });
}

export async function fetchCustomers(
  params: CustomerListParams = {},
): Promise<PaginatedResult<Customer>> {
  const query = buildCustomersQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.CUSTOMERS}?${query}`,
  );

  return normalizePaginatedCustomers(response);
}

function buildCustomerWritePayload(
  values: CustomerFormValues,
  options: { customerId?: string } = {},
): ApiCustomerWritePayload {
  validateCustomerFormValues(values);

  const name = values.name.trim();
  const phone1 = normalizeStoredPhone(values.phone1);
  const phone2 = normalizeStoredPhone(values.phone2);
  const email = values.email.trim();
  const idNumber = values.IDNumber.trim();
  const notes = values.notes.trim();
  const primaryAddress = buildApiAddressPayload(values.address);

  const payload: ApiCustomerWritePayload = {
    name,
    customerType: values.customerType ?? 1,
    phone1,
    active: values.active,
    branch: buildApiBranchDto(values.branch),
  };

  if (email) {
    payload.email = email;
  }

  if (idNumber) {
    payload.IDNumber = idNumber;
  }

  if (phone2) {
    payload.phone2 = phone2;
  }

  if (notes) {
    payload.notes = notes;
  }

  if (Number.isFinite(values.accountBalance) && values.accountBalance !== 0) {
    payload.accountBalance = values.accountBalance;
  }

  if (primaryAddress) {
    payload.address = primaryAddress;
  }

  if (options.customerId) {
    payload.id = options.customerId;
  }

  if (values.createdByID != null && values.createdByID > 0) {
    payload.createdByID = values.createdByID;
  }

  if (values.oldID > 0) {
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

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
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
