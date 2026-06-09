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
  type CustomerListParams,
  type CustomerPortalBranch,
  type CustomerSearchFilter,
  portalBranchToId,
} from "@/lib/customers/types";

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
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  branch?: ApiBranch;
  createdByID?: number;
  address?: ApiAddress;
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
  branch: ApiBranchWritePayload;
  customerType?: number;
  createdAt: string;
  createdByID: number;
  id: string;
  name: string;
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
    phone1: String(branch.phone1 ?? "").trim(),
    logo: String(branch.logo ?? "").trim(),
    settings: normalizeBranchSettings(branch.settings),
  };
}

function normalizeCustomer(raw: unknown): Customer | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiCustomer;
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  const address = normalizeAddress(item.address);
  const branch = normalizeBranch(item.branch, address.country);

  return {
    id,
    oldID: readNumericId(item.oldID) ?? 0,
    name: String(item.name ?? "").trim(),
    customerType: readNumericId(item.customerType) ?? null,
    phone1: String(item.phone1 ?? "").trim(),
    phone2: String(item.phone2 ?? "").trim(),
    active: item.active !== false,
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
    branch,
    createdByID: readNumericId(item.createdByID) ?? null,
    address,
  };
}

function normalizePaginatedCustomers(
  payload: PaginatedApiEnvelope<unknown[]>,
): PaginatedResult<Customer> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeCustomer).filter((customer): customer is Customer => customer != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

type ApiListFilter = {
  field: string;
  operator: CustomerSearchFilter["operator"];
  value: string;
};

function buildApiListFilter(params: CustomerListParams): ApiListFilter | undefined {
  if (params.search?.value.trim()) {
    return {
      field: params.search.field,
      operator: params.search.operator,
      value: params.search.value.trim(),
    };
  }

  if (params.active !== undefined && params.active !== "all") {
    return {
      field: "active",
      operator: "eq",
      value: String(params.active),
    };
  }

  if (params.branch && params.branch !== "all") {
    return {
      field: "branch.id",
      operator: "eq",
      value: String(portalBranchToId(params.branch as CustomerPortalBranch)),
    };
  }

  if (params.customerType !== undefined && params.customerType !== "all") {
    return {
      field: "customerType",
      operator: "eq",
      value: String(params.customerType),
    };
  }

  return undefined;
}

/** GET /customers — Stripe-style list with optional field/operator/value filter and pagination. */
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

  const filter = buildApiListFilter(params);
  if (filter) {
    searchParams.set("field", filter.field);
    searchParams.set("operator", filter.operator);
    searchParams.set("value", filter.value);
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
    phone1: branch.phone1,
    logo: branch.logo,
    settings: buildBranchSettingsWritePayload(branch.settings),
  };
}

function buildCustomerWritePayload(
  values: CustomerFormValues,
  options: { customerId?: string } = {},
): ApiCustomerWritePayload {
  const name = values.name.trim();

  if (!name) throw new Error("Customer name is required.");

  const payload: ApiCustomerWritePayload = {
    active: values.active,
    address: buildAddressWritePayload(values.address),
    branch: buildBranchWritePayload(values.branch),
    createdAt: values.createdAt,
    createdByID: values.createdByID ?? 0,
    id: options.customerId ?? "",
    name,
    oldID: values.oldID,
    phone1: values.phone1.trim(),
    phone2: values.phone2.trim(),
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
    return normalizeCustomer(data);
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

  const customer = normalizeCustomer(raw);
  if (!customer) {
    throw new Error("Customer not found.");
  }

  return customer;
}
