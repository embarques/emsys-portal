import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
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

type ApiAddressWritePayload = {
  address1: string;
  address2: string;
  apartment: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
};

type ApiBranchSettingsWritePayload = {
  LabelPrefix: string;
  InvoiceCreatedThruIncomeStatement: boolean;
  PrintLabelCount: boolean;
  RoundDecimalPlaces: number;
  DefaultLabelStatus: number;
  S3Profile: string;
  S3BucketName: string;
  S3BucketFolder: string;
  S3ShareLinkExpireMinutes: number;
  ImageResampleBy: number;
};

type ApiBranchWritePayload = {
  id: number;
  name: string;
  code: string;
  address: ApiAddressWritePayload;
  phone1: string;
  logo: string;
  settings: ApiBranchSettingsWritePayload;
};

type ApiCustomerWritePayload = {
  active: boolean;
  address: ApiAddressWritePayload;
  addresses: ApiAddressWritePayload[];
  branch: ApiBranchWritePayload;
  customerType?: number;
  createdAt: string;
  createdByID: number;
  email: string;
  IDNumber: string;
  id: string;
  name: string;
  notes: string;
  accountBalance: number;
  oldID: number;
  phone1: string;
  phone2: string;
  updatedAt: string;
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

/** GET /customers — list with field/operator/value search plus optional chip filters. */
function buildCustomersQuery(params: CustomerListParams): string {
  const page = params.page ?? DEFAULT_CUSTOMER_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_CUSTOMER_LIST_PARAMS.limit;
  const searchParams = new URLSearchParams({
    page: String(page),
    start: String((page - 1) * limit),
    limit: String(limit),
    sortField: params.sortField ?? DEFAULT_CUSTOMER_LIST_PARAMS.sortField,
    sortDirection: params.sortDirection ?? DEFAULT_CUSTOMER_LIST_PARAMS.sortDirection,
  });

  if (params.search?.value.trim()) {
    const search = normalizeCustomerSearchFilter({
      ...params.search,
      value: params.search.value.trim(),
    });

    searchParams.set("field", toApiCustomerSearchField(search.field));
    searchParams.set("operator", search.operator);
    searchParams.set("value", search.value);
  } else if (params.active !== undefined && params.active !== "all") {
    searchParams.set("field", "active");
    searchParams.set("operator", "eq");
    searchParams.set("value", String(params.active));
  } else if (params.branch !== undefined && params.branch !== "all") {
    searchParams.set("field", "branch.id");
    searchParams.set("operator", "eq");
    searchParams.set("value", String(params.branch));
  } else if (params.customerType !== undefined && params.customerType !== "all") {
    searchParams.set("field", "customerType");
    searchParams.set("operator", "eq");
    searchParams.set("value", String(params.customerType));
  }

  if (params.active !== undefined && params.active !== "all") {
    searchParams.set("active", String(params.active));
  }

  if (params.branch !== undefined && params.branch !== "all") {
    searchParams.set("branchId", String(params.branch));
  }

  if (params.customerType !== undefined && params.customerType !== "all") {
    searchParams.set("customerType", String(params.customerType));
  }

  return searchParams.toString();
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

function buildAddressWritePayload(address: CustomerCoreAddress): ApiAddressWritePayload {
  return {
    address1: address.address1.trim(),
    address2: address.address2.trim(),
    apartment: address.apartment.trim(),
    city: address.city.trim(),
    state: address.state.trim(),
    zipcode: address.zipcode.trim(),
    country: address.country.trim(),
  };
}

function buildBranchSettingsWritePayload(settings: CustomerBranchSettings): ApiBranchSettingsWritePayload {
  return {
    LabelPrefix: settings.labelPrefix,
    InvoiceCreatedThruIncomeStatement: settings.invoiceCreatedThruIncomeStatement,
    PrintLabelCount: settings.printLabelCount,
    RoundDecimalPlaces: settings.roundDecimalPlaces,
    DefaultLabelStatus: settings.defaultLabelStatus,
    S3Profile: settings.s3Profile,
    S3BucketName: settings.s3BucketName,
    S3BucketFolder: settings.s3BucketFolder,
    S3ShareLinkExpireMinutes: settings.s3ShareLinkExpireMinutes,
    ImageResampleBy: settings.imageResampleBy,
  };
}

function buildBranchWritePayload(branch: CustomerBranch): ApiBranchWritePayload {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    address: buildAddressWritePayload(branch.address),
    phone1: normalizeStoredPhone(branch.phone1),
    logo: branch.logo,
    settings: buildBranchSettingsWritePayload(branch.settings),
  };
}

function buildCustomerWritePayload(
  values: CustomerFormValues,
  options: { customerId?: string } = {},
): ApiCustomerWritePayload {
  validateCustomerFormValues(values);

  const name = values.name.trim();

  const addresses =
    values.addresses.length > 0
      ? values.addresses.map(buildAddressWritePayload)
      : [buildAddressWritePayload(values.address)];

  const payload: ApiCustomerWritePayload = {
    active: values.active,
    address: addresses[0] ?? buildAddressWritePayload(values.address),
    addresses,
    branch: buildBranchWritePayload(values.branch),
    createdAt: values.createdAt,
    createdByID: values.createdByID ?? 0,
    email: values.email.trim(),
    IDNumber: values.IDNumber.trim(),
    id: options.customerId ?? "",
    name,
    notes: values.notes.trim(),
    accountBalance: Number.isFinite(values.accountBalance) ? values.accountBalance : 0,
    oldID: values.oldID,
    phone1: normalizeStoredPhone(values.phone1),
    phone2: normalizeStoredPhone(values.phone2),
    updatedAt: values.updatedAt,
  };

  if (values.customerType != null) {
    payload.customerType = values.customerType;
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
