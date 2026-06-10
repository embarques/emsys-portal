import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import {
  buildApiListQuery,
  getPrimarySortField,
  resolveApiListSort,
  type ApiListFieldFilter,
} from "@/lib/api/list-query";
import {
  buildApiAddressPayload,
  buildApiBranchRef,
  type ApiAddressPayload,
  type ApiBranchRefPayload,
} from "@/lib/api/payloads";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { normalizeApiCustomer } from "@/lib/customers/api/customers-api";
import type { Customer } from "@/lib/customers/types";
import { CUSTOMER_PORTAL_BRANCHES } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
import { normalizeApiUser } from "@/lib/users/api/users-api";
import type { User } from "@/lib/users/types";
import { normalizeStoredPhone } from "@/lib/utils/phone";
import {
  DEFAULT_ORDER_LIST_PARAMS,
  type Order,
  type OrderFormValues,
  type OrderListParams,
  type OrderSearchOperator,
  type PickupBranch,
  type PickupComment,
  type PickupSector,
} from "@/lib/orders/types";

type ApiAddress = {
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
};

type ApiBranchRef = {
  id?: number;
  code?: string;
  name?: string;
};

type ApiSectorRef = {
  id?: number;
  name?: string;
};

type ApiComment = {
  purpose?: string;
  unit?: string;
  quantity?: number;
  description?: string;
};

type ApiPickup = {
  id?: number;
  oldID?: number;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  completed?: boolean;
  user?: Record<string, unknown>;
  branch?: ApiBranchRef;
  employee?: Record<string, unknown>;
  sender?: Record<string, unknown>;
  receiver?: Record<string, unknown>;
  receivers?: Record<string, unknown>[];
  purpose?: string;
  comments?: ApiComment[];
  sector?: ApiSectorRef;
};

type ApiPickupCustomerRef = {
  name: string;
  customerType: number;
  phone1: string;
  email?: string;
  IDNumber?: string;
  phone2?: string;
  id?: string;
  oldID?: number;
  address?: ApiAddressPayload;
};

type ApiPickupEmployeeRef = {
  id: number;
  name?: string;
  phone1?: string;
  active?: boolean;
};

/** POST/PUT /pickups — see API_PAYLOADS.md */
type ApiPickupWritePayload = {
  date: string;
  branch: ApiBranchRefPayload;
  sender: ApiPickupCustomerRef;
  receiver?: ApiPickupCustomerRef;
  purpose?: string;
  comments?: ApiComment[];
  sector?: { id: number; name?: string };
  employee?: ApiPickupEmployeeRef;
  completed?: boolean;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

type ApiPickupSearchFilter = {
  field: string;
  operator: OrderSearchOperator;
  value: string;
};

type ApiSearchBody = {
  page: number;
  limit: number;
  offset: number;
  sort?: string;
  query?: {
    and: ApiPickupSearchFilter[];
  };
};

const EMPTY_CUSTOMER: Customer = {
  id: "",
  oldID: 0,
  name: "—",
  customerType: null,
  phone1: "",
  phone2: "",
  email: "",
  active: true,
  IDNumber: "",
  createdAt: "",
  updatedAt: "",
  notes: "",
  accountBalance: 0,
  branch: {
    id: 1,
    name: "USA",
    code: "NY",
    address: {
      address1: "",
      address2: "",
      apartment: "",
      city: "",
      state: "",
      zipcode: "",
      country: "US",
    },
    phone1: "",
    logo: "",
    settings: {
      labelPrefix: "",
      invoiceCreatedThruIncomeStatement: false,
      printLabelCount: false,
      roundDecimalPlaces: 0,
      defaultLabelStatus: 0,
      s3Profile: "",
      s3BucketName: "",
      s3BucketFolder: "",
      s3ShareLinkExpireMinutes: 0,
      imageResampleBy: 0,
    },
  },
  createdByID: null,
  address: {
    address1: "",
    address2: "",
    apartment: "",
    city: "",
    state: "",
    zipcode: "",
    country: "US",
  },
  addresses: [],
};

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeIsoDate(value: string | undefined): string {
  return String(value ?? "").trim();
}

function normalizePickupBranch(raw?: ApiBranchRef): PickupBranch {
  const branch = raw ?? {};
  const id = readNumericId(branch.id) ?? 1;
  const defaults = CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.id === id) ?? CUSTOMER_PORTAL_BRANCHES[0];

  return {
    id,
    name: String(branch.name ?? defaults.label).trim(),
    code: String(branch.code ?? defaults.code).trim(),
  };
}

function normalizePickupSector(raw?: ApiSectorRef): PickupSector | null {
  const id = readNumericId(raw?.id);
  if (id == null || id <= 0) return null;

  return {
    id,
    name: String(raw?.name ?? "").trim() || "—",
  };
}

function normalizePickupComment(raw: ApiComment): PickupComment {
  return {
    purpose: String(raw.purpose ?? "").trim(),
    unit: String(raw.unit ?? "").trim(),
    quantity: Number(raw.quantity ?? 0),
    description: String(raw.description ?? "").trim(),
  };
}

function normalizePickupCustomer(raw: unknown, fallbackName: string): Customer {
  const customer = normalizeApiCustomer(raw);
  if (customer) return customer;

  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_CUSTOMER, name: fallbackName };
  }

  const item = raw as Record<string, unknown>;
  const name = String(item.name ?? fallbackName).trim() || fallbackName;

  return {
    ...EMPTY_CUSTOMER,
    id: String(item.id ?? "").trim(),
    oldID: readNumericId(item.oldID as number | string | undefined) ?? 0,
    name,
    phone1: normalizeStoredPhone(String(item.phone1 ?? "")),
    phone2: normalizeStoredPhone(String(item.phone2 ?? "")),
    email: String(item.email ?? "").trim(),
  };
}

function normalizePickupEmployee(raw: unknown): Employee | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Record<string, unknown>;
  const id = readNumericId(item.id as number | string | undefined);
  if (id == null || id <= 0) return null;

  const branch = normalizePickupBranch(item.branch as ApiBranchRef | undefined);

  return {
    id,
    name: String(item.name ?? "").trim(),
    title: String(item.title ?? "").trim(),
    department: String(item.department ?? "").trim(),
    phone1: normalizeStoredPhone(String(item.phone1 ?? "")),
    phone2: normalizeStoredPhone(String(item.phone2 ?? "")),
    email: String(item.email ?? "").trim(),
    active: item.active !== false,
    startDate: String(item.startDate ?? "").trim(),
    endDate: String(item.endDate ?? "").trim(),
    createdAt: String(item.createdAt ?? "").trim(),
    updatedAt: String(item.updatedAt ?? "").trim(),
    branch,
    user: item.user != null ? normalizeApiUser(item.user) : null,
    address: {
      address1: "",
      address2: "",
      apartment: "",
      city: "",
      state: "",
      zipcode: "",
      country: "",
    },
    totalLoanGiven: 0,
    totalPaymentReceived: 0,
    loanAmountOwed: 0,
    loanBalanceUpdated: "",
    cost: 0,
  };
}

function normalizePickupUser(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;
  return normalizeApiUser(raw);
}

function normalizeOrder(raw: unknown): Order | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiPickup;
  const id = readNumericId(item.id);
  if (id == null || id <= 0) return null;

  const receiverRaw = item.receiver ?? (Array.isArray(item.receivers) ? item.receivers[0] : null);
  const comments = Array.isArray(item.comments) ? item.comments.map(normalizePickupComment) : [];

  return {
    id,
    oldID: readNumericId(item.oldID) ?? 0,
    date: normalizeIsoDate(item.date),
    createdAt: normalizeIsoDate(item.createdAt),
    updatedAt: normalizeIsoDate(item.updatedAt),
    completed: item.completed === true,
    user: normalizePickupUser(item.user),
    branch: normalizePickupBranch(item.branch),
    employee: normalizePickupEmployee(item.employee),
    sender: normalizePickupCustomer(item.sender, "Sender"),
    receiver: receiverRaw ? normalizePickupCustomer(receiverRaw, "Receiver") : null,
    purpose: String(item.purpose ?? "").trim(),
    comments,
    sector: normalizePickupSector(item.sector),
  };
}

function normalizePaginatedOrders(payload: PaginatedApiEnvelope<unknown[] | unknown | null>): PaginatedResult<Order> {
  const rawData = payload.data;
  const items = Array.isArray(rawData)
    ? rawData.map(normalizeOrder).filter((order): order is Order => order != null)
    : rawData
      ? [normalizeOrder(rawData)].filter((order): order is Order => order != null)
      : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function buildSearchFilters(params: OrderListParams): ApiPickupSearchFilter[] {
  const filters: ApiPickupSearchFilter[] = [];

  if (params.search?.value.trim()) {
    filters.push({
      field: params.search.field,
      operator: params.search.operator,
      value: params.search.value.trim(),
    });
  }

  if (params.completed !== undefined && params.completed !== "all") {
    filters.push({
      field: "completed",
      operator: "eq",
      value: String(params.completed),
    });
  }

  if (params.branch !== undefined && params.branch !== "all") {
    filters.push({
      field: "branch.id",
      operator: "eq",
      value: String(params.branch),
    });
  }

  return filters;
}

function hasGetFieldTriplet(params: OrderListParams): boolean {
  return (
    Boolean(params.search?.value.trim()) ||
    (params.completed !== undefined && params.completed !== "all")
  );
}

function shouldUsePickupSearch(params: OrderListParams): boolean {
  if (!params.search?.value.trim()) return false;

  return [
    "sender.name",
    "sender.phone1",
    "sender.oldID",
    "receiver.name",
    "receiver.phone1",
    "receiver.oldID",
    "purpose",
    "sector.id",
    "branch.id",
    "employee.id",
    "user.id",
  ].includes(params.search.field);
}

function shouldOmitOrdersSort(params: OrderListParams): boolean {
  const limit = params.limit ?? DEFAULT_ORDER_LIST_PARAMS.limit;
  const primarySort = getPrimarySortField(params.sort ?? DEFAULT_ORDER_LIST_PARAMS.sort);

  return primarySort === "date" && limit > 1 && !hasGetFieldTriplet(params);
}

function resolveOrderListFilter(params: OrderListParams): ApiListFieldFilter | undefined {
  if (params.search?.value.trim()) {
    return {
      field: params.search.field,
      operator: params.search.operator,
      value: params.search.value.trim(),
    };
  }

  if (params.completed !== undefined && params.completed !== "all") {
    return { field: "completed", operator: "eq", value: String(params.completed) };
  }

  if (params.branch !== undefined && params.branch !== "all") {
    return { field: "branch.id", operator: "eq", value: String(params.branch) };
  }

  return undefined;
}

function resolveOrdersSort(params: OrderListParams): string | undefined {
  if (shouldOmitOrdersSort(params)) {
    return undefined;
  }

  return resolveApiListSort(params.sort ?? DEFAULT_ORDER_LIST_PARAMS.sort);
}

function buildOrdersQuery(params: OrderListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_ORDER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_ORDER_LIST_PARAMS.limit,
    offset: params.offset,
    sort: resolveOrdersSort(params),
    filter: resolveOrderListFilter(params),
  });
}

function buildSearchBody(params: OrderListParams): ApiSearchBody {
  const page = params.page ?? DEFAULT_ORDER_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ORDER_LIST_PARAMS.limit;
  const offset = params.offset ?? (page - 1) * limit;

  const body: ApiSearchBody = {
    page,
    limit,
    offset,
    sort: resolveOrdersSort(params),
  };

  const filters = buildSearchFilters(params);
  if (filters.length > 0) {
    body.query = { and: filters };
  }

  return body;
}

export async function fetchOrders(params: OrderListParams = {}): Promise<PaginatedResult<Order>> {
  if (shouldUsePickupSearch(params)) {
    const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
      `${API_ENDPOINTS.PICKUPS}/search`,
      buildSearchBody(params),
    );
    return normalizePaginatedOrders(response);
  }

  const query = buildOrdersQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.PICKUPS}?${query}`,
  );

  return normalizePaginatedOrders(response);
}

function resolvePickupBranchRef(branchId: number): ApiBranchRefPayload {
  const config =
    CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.id === branchId) ?? CUSTOMER_PORTAL_BRANCHES[0];

  return buildApiBranchRef({ id: config.id, code: config.code });
}

function buildPickupCustomerRef(customer: Customer): ApiPickupCustomerRef {
  const name = customer.name.trim();
  const phone1 = normalizeStoredPhone(customer.phone1);
  const email = customer.email.trim();
  const idNumber = customer.IDNumber.trim();
  const phone2 = normalizeStoredPhone(customer.phone2);
  const address = buildApiAddressPayload(customer.address);

  const payload: ApiPickupCustomerRef = {
    name,
    customerType: customer.customerType ?? 1,
    phone1,
  };

  if (customer.id.trim()) {
    payload.id = customer.id.trim();
  }

  if (customer.oldID > 0) {
    payload.oldID = customer.oldID;
  }

  if (email) {
    payload.email = email;
  }

  if (idNumber) {
    payload.IDNumber = idNumber;
  }

  if (phone2) {
    payload.phone2 = phone2;
  }

  if (address) {
    payload.address = address;
  }

  return payload;
}

function buildApiCommentsFromFormValues(values: OrderFormValues): ApiComment[] {
  if (values.comments.length === 0) {
    return [{ purpose: "", unit: "", quantity: 0, description: "" }];
  }

  return values.comments.map((comment) => ({
    purpose: comment.purpose.trim(),
    unit: comment.unit.trim(),
    quantity: Number.isFinite(Number(comment.quantity)) ? Number(comment.quantity) : 0,
    description: comment.description.trim(),
  }));
}

function buildPickupWritePayload(values: OrderFormValues): ApiPickupWritePayload {
  if (!values.sender) {
    throw new Error("Sender is required.");
  }

  const date = values.date.trim() || new Date().toISOString().slice(0, 10);
  const purpose = values.purpose.trim();
  const comments = buildApiCommentsFromFormValues(values);

  const payload: ApiPickupWritePayload = {
    date,
    branch: resolvePickupBranchRef(values.branchId),
    sender: buildPickupCustomerRef(values.sender),
  };

  if (purpose) {
    payload.purpose = purpose;
  }

  if (comments.length > 0) {
    payload.comments = comments;
  }

  if (values.receiver) {
    payload.receiver = buildPickupCustomerRef(values.receiver);
  }

  if (values.sectorId !== "" && values.sectorId > 0) {
    payload.sector = { id: values.sectorId };
  }

  if (values.employeeId !== "" && values.employeeId > 0) {
    payload.employee = { id: values.employeeId };
  }

  if (values.id > 0) {
    payload.completed = values.completed;
  }

  return payload;
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

function extractOrderFromMutationResponse(data: unknown): Order | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeOrder(data);
  }

  return null;
}

function extractCreatedOrderId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;

  if (typeof data === "string" || typeof data === "number") {
    const id = String(data).trim();
    return id || null;
  }

  const order = extractOrderFromMutationResponse(data);
  return order ? String(order.id) : null;
}

async function resolveCreatedOrder(values: OrderFormValues, response: ApiMutationEnvelope<unknown>): Promise<Order> {
  const createdId = extractCreatedOrderId(response);
  if (createdId) {
    return fetchOrderById(createdId);
  }

  const order = extractOrderFromMutationResponse(response.data);
  if (order) {
    return order;
  }

  const senderName = values.sender?.name.trim();
  if (senderName) {
    const matches = await fetchOrders({
      page: 1,
      limit: 1,
      search: {
        field: "sender.name",
        operator: "eq",
        value: senderName,
      },
    });

    const matchedOrder = matches.items[0];
    if (matchedOrder) {
      return matchedOrder;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create pickup.");
}

export async function fetchOrderById(orderId: string): Promise<Order> {
  const response = await apiClient.get<ApiPickup | PaginatedApiEnvelope<ApiPickup>>(
    `${API_ENDPOINTS.PICKUPS}/${orderId}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiPickup>).data
      : response;

  const order = normalizeOrder(raw);
  if (!order) {
    throw new Error("Pickup not found.");
  }

  return order;
}

export async function createOrder(values: OrderFormValues): Promise<Order> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.PICKUPS,
    buildPickupWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create pickup.");

  return resolveCreatedOrder(values, response);
}

export async function updateOrder(orderId: string, values: OrderFormValues): Promise<Order> {
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUPS}/${orderId}`,
    buildPickupWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to update pickup.");

  const updatedOrder = extractOrderFromMutationResponse(response.data);
  if (updatedOrder) {
    return fetchOrderById(String(updatedOrder.id));
  }

  return fetchOrderById(orderId);
}

export async function deleteOrder(orderId: string): Promise<void> {
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(`${API_ENDPOINTS.PICKUPS}/${orderId}`);
  assertMutationSuccess(response, "Unable to delete pickup.");
}

export async function deleteOrders(orderIds: string[]): Promise<void> {
  await Promise.all(orderIds.map((orderId) => deleteOrder(orderId)));
}
