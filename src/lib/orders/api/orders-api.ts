import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  DEFAULT_ORDER_LIST_PARAMS,
  PORTAL_BRANCH_TO_ID,
  branchIdToPortal,
  type Order,
  type OrderComment,
  type OrderCommentPurpose,
  type OrderFormValues,
  type OrderListParams,
  type OrderParty,
  type OrderPartyFormValues,
  type OrderSearchFilter,
  type OrderSearchOperator,
} from "@/lib/orders/types";
import { createRecordId } from "@/lib/customers/types";
import type { CustomerAddress, CustomerPhone } from "@/lib/customers/types";

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

type ApiUserRef = {
  id?: number;
  name?: string;
};

type ApiSender = {
  id?: string;
  oldID?: number;
  name?: string;
  customerType?: number;
  phone1?: string;
  phone2?: string;
  email?: string;
  address?: ApiAddress;
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
  user?: ApiUserRef;
  branch?: ApiBranchRef;
  employee?: Record<string, unknown>;
  sender?: ApiSender;
  receivers?: ApiSender[];
  purpose?: string;
  comments?: ApiComment[];
  sector?: ApiSectorRef;
  containerId?: string;
  routeId?: string;
  dispatchId?: string;
};

type ApiPickupWritePayload = {
  date: string;
  completed: boolean;
  branch: { id: number };
  sender: {
    id?: string;
    oldID?: number;
    name: string;
    phone1?: string;
    phone2?: string;
    email?: string;
    address: ApiAddress;
  };
  receivers?: ApiPickupWritePayload["sender"][];
  purpose: string;
  comments: ApiComment[];
  sector: { id: number };
  containerId?: string;
  routeId?: string;
  dispatchId?: string;
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
  start: number;
  limit: number;
  sortField: string;
  sortDirection: "asc" | "desc";
  query?: {
    and: ApiPickupSearchFilter[];
  };
};

const EMPTY_CUSTOMER_ID = "000000000000000000000000";

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeIsoDate(value: string | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return trimmed;
}

function normalizeSenderAddress(raw?: ApiAddress, fallbackId?: string): CustomerAddress {
  const address = raw ?? {};
  const id = fallbackId ?? createRecordId();

  return {
    id,
    streetAddress: String(address.address1 ?? "").trim(),
    apt: String(address.apartment ?? address.address2 ?? "").trim() || undefined,
    city: String(address.city ?? "").trim(),
    state: String(address.state ?? "").trim() || undefined,
    provinceCountry: String(address.country ?? "").trim() || undefined,
    zipCode: String(address.zipcode ?? "").trim() || undefined,
    isPrimary: true,
  };
}

function normalizeSenderPhones(sender: ApiSender): CustomerPhone[] {
  const phones: CustomerPhone[] = [];

  if (sender.phone1?.trim()) {
    phones.push({ id: createRecordId(), number: sender.phone1.trim(), label: "Phone 1" });
  }

  if (sender.phone2?.trim()) {
    phones.push({ id: createRecordId(), number: sender.phone2.trim(), label: "Phone 2" });
  }

  return phones;
}

function isLinkedCustomerId(value: string | undefined): value is string {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== EMPTY_CUSTOMER_ID);
}

function normalizeOrderParty(sender: ApiSender, label: string): OrderParty {
  const address = normalizeSenderAddress(sender.address);
  const phones = normalizeSenderPhones(sender);
  const name = String(sender.name ?? "").trim() || label;

  return {
    id: createRecordId(),
    clientId: isLinkedCustomerId(sender.id) ? sender.id : undefined,
    name,
    documentId: sender.oldID ? String(sender.oldID) : undefined,
    email: sender.email?.trim() || undefined,
    phones: phones.length > 0 ? phones : [{ id: createRecordId(), number: "—" }],
    addresses: [address],
    orderAddressId: address.id,
  };
}

function mapApiCommentPurpose(raw?: string): OrderCommentPurpose {
  const purpose = raw?.trim().toLowerCase();

  switch (purpose) {
    case "estimate":
      return "make_estimate";
    case "payment":
      return "collect_payment";
    case "pickup":
      return "pickup_box";
    case "take":
      return "take_box";
    case "comment":
    default:
      return "general_comment";
  }
}

function normalizeOrderComment(raw: ApiComment, index: number): OrderComment {
  const id = createRecordId();
  const purpose = mapApiCommentPurpose(raw.purpose);
  const description = String(raw.description ?? "").trim();
  const quantity = Number(raw.quantity ?? 0);
  const unit = String(raw.unit ?? "").trim().toLowerCase();

  if (purpose === "general_comment" || description) {
    return { id, purpose: "general_comment", text: description || unit || "—" };
  }

  if (quantity > 0) {
    if (unit.includes("barrel")) {
      return purpose === "pickup_box"
        ? { id, purpose: "pickup_barrel", quantity }
        : { id, purpose: "take_barrel", quantity };
    }

    if (unit.includes("tape")) {
      return { id, purpose: "take_tape", quantity };
    }

    if (unit.includes("other")) {
      return purpose === "pickup_box"
        ? { id, purpose: "pickup_other", quantity, description: description || undefined }
        : { id, purpose: "take_other", quantity, description: description || undefined };
    }

    return purpose === "pickup_box"
      ? { id, purpose: "pickup_box", quantity }
      : { id, purpose: "take_box", quantity };
  }

  return { id, purpose: "make_estimate", note: description || undefined };
}

function normalizeOrder(raw: unknown): Order | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiPickup;
  const id = readNumericId(item.id);
  if (id == null || id <= 0) return null;

  const branchId = readNumericId(item.branch?.id) ?? 1;
  const branch = branchIdToPortal(branchId, item.branch?.code);
  const sender = item.sender ? normalizeOrderParty(item.sender, "Sender") : normalizeOrderParty({}, "Sender");
  const receivers = Array.isArray(item.receivers)
    ? item.receivers.map((receiver, index) => normalizeOrderParty(receiver, `Receiver ${index + 1}`))
    : [];
  const comments = Array.isArray(item.comments)
    ? item.comments.map((comment, index) => normalizeOrderComment(comment, index))
    : [];

  return {
    orderId: String(id),
    oldID: readNumericId(item.oldID) ?? 0,
    sender,
    receivers,
    date: normalizeIsoDate(item.date),
    containerId: String(item.containerId ?? "").trim(),
    pending: branch,
    branch,
    branchId,
    routeId: String(item.routeId ?? "").trim(),
    routeAssignmentId: String(item.dispatchId ?? "").trim(),
    comments,
    completed: item.completed === true,
    purpose: String(item.purpose ?? "").trim(),
    sectorId: readNumericId(item.sector?.id) ?? null,
    sectorName: String(item.sector?.name ?? "").trim(),
    createdAt: normalizeIsoDate(item.createdAt),
    createdBy: String(item.user?.name ?? "").trim() || "—",
    updatedAt: normalizeIsoDate(item.updatedAt),
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

/** Nested sender/purpose filters must use POST /pickups/search. */
function shouldUsePickupSearch(params: OrderListParams): boolean {
  if (params.search?.value.trim()) {
    return ["sender.name", "sender.phone1", "sender.oldID", "purpose"].includes(
      params.search.field,
    );
  }

  return false;
}

/**
 * EMSYS GET /pickups rejects sortField=date when limit > 1 unless field/operator/value
 * is also present. Omit date sort in that case — the API default order matches date asc.
 */
function appendGetSortParams(searchParams: URLSearchParams, params: OrderListParams): void {
  const limit = params.limit ?? DEFAULT_ORDER_LIST_PARAMS.limit;
  const sortField = params.sortField ?? DEFAULT_ORDER_LIST_PARAMS.sortField;
  const sortDirection = params.sortDirection ?? DEFAULT_ORDER_LIST_PARAMS.sortDirection;

  if (sortField === "date" && limit > 1 && !hasGetFieldTriplet(params)) {
    return;
  }

  searchParams.set("sortField", sortField);
  searchParams.set("sortDirection", sortDirection);
}

function buildOrdersQuery(params: OrderListParams): string {
  const page = params.page ?? DEFAULT_ORDER_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ORDER_LIST_PARAMS.limit;
  const searchParams = new URLSearchParams({
    page: String(page),
    start: String((page - 1) * limit),
    limit: String(limit),
  });

  appendGetSortParams(searchParams, params);

  if (params.search?.value.trim()) {
    searchParams.set("field", params.search.field);
    searchParams.set("operator", params.search.operator);
    searchParams.set("value", params.search.value.trim());
  } else if (params.completed !== undefined && params.completed !== "all") {
    searchParams.set("field", "completed");
    searchParams.set("operator", "eq");
    searchParams.set("value", String(params.completed));
  }

  if (params.branch !== undefined && params.branch !== "all") {
    searchParams.set("branchId", String(params.branch));
  }

  return searchParams.toString();
}

function buildSearchBody(params: OrderListParams): ApiSearchBody {
  const page = params.page ?? DEFAULT_ORDER_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ORDER_LIST_PARAMS.limit;

  const body: ApiSearchBody = {
    page,
    start: (page - 1) * limit,
    limit,
    sortField: params.sortField ?? DEFAULT_ORDER_LIST_PARAMS.sortField,
    sortDirection: params.sortDirection ?? DEFAULT_ORDER_LIST_PARAMS.sortDirection,
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

function buildApiAddressFromParty(party: OrderParty | OrderPartyFormValues): ApiAddress {
  const address = party.addresses.find((entry) => entry.id === party.orderAddressId) ?? party.addresses[0];

  return {
    address1: address?.streetAddress?.trim() ?? "",
    apartment: address?.apt?.trim() ?? "",
    city: address?.city?.trim() ?? "",
    state: address?.state?.trim() ?? "",
    zipcode: address?.zipCode?.trim() ?? "",
    country: address?.provinceCountry?.trim() ?? "US",
  };
}

function buildPurposeFromFormValues(values: OrderFormValues): string {
  const purposes = new Set<string>();

  for (const comment of values.comments) {
    switch (comment.purpose) {
      case "make_estimate":
        purposes.add("ESTIMATE");
        break;
      case "collect_payment":
        purposes.add("PAYMENT");
        break;
      case "general_comment":
        purposes.add("COMMENT");
        break;
      case "take_box":
      case "take_barrel":
      case "take_tape":
      case "take_other":
        purposes.add("TAKE");
        break;
      case "pickup_box":
      case "pickup_barrel":
      case "pickup_other":
        purposes.add("PICKUP");
        break;
      default:
        break;
    }
  }

  if (purposes.size === 0) {
    purposes.add("PICKUP");
  }

  return Array.from(purposes).join(",");
}

function buildApiCommentsFromFormValues(values: OrderFormValues): ApiComment[] {
  if (values.comments.length === 0) {
    return [{ purpose: "comment", unit: "", quantity: 0, description: "" }];
  }

  return values.comments.map((comment) => {
    if (comment.purpose === "general_comment") {
      return {
        purpose: "comment",
        unit: "",
        quantity: 0,
        description: comment.text.trim(),
      };
    }

    if (comment.purpose === "make_estimate" || comment.purpose === "collect_payment") {
      return {
        purpose: comment.purpose === "make_estimate" ? "estimate" : "payment",
        unit: "",
        quantity: 0,
        description: comment.note.trim(),
      };
    }

    const quantity = Number(comment.quantity);
    const unit = comment.purpose.includes("barrel")
      ? "barrel"
      : comment.purpose.includes("tape")
        ? "tape"
        : comment.purpose.includes("other")
          ? "other"
          : "box";

    return {
      purpose: comment.purpose.startsWith("pickup") ? "pickup" : "take",
      unit,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      description: comment.description.trim(),
    };
  });
}

function buildPickupWritePayload(values: OrderFormValues): ApiPickupWritePayload {
  const branchId = PORTAL_BRANCH_TO_ID[values.branch] ?? 1;
  const date = values.date ? `${values.date}T00:00:00Z` : new Date().toISOString();

  return {
    date,
    completed: values.completed,
    branch: { id: branchId },
    sender: {
      id: values.sender.clientId.trim() || undefined,
      name: values.sender.name.trim(),
      phone1: values.sender.phones[0]?.number?.trim() ?? "",
      phone2: values.sender.phones[1]?.number?.trim() ?? "",
      email: values.sender.email.trim() || undefined,
      address: buildApiAddressFromParty(values.sender),
    },
    receivers: values.receivers.map((receiver) => ({
      id: receiver.clientId.trim() || undefined,
      name: receiver.name.trim(),
      phone1: receiver.phones[0]?.number?.trim() ?? "",
      phone2: receiver.phones[1]?.number?.trim() ?? "",
      email: receiver.email.trim() || undefined,
      address: buildApiAddressFromParty(receiver),
    })),
    purpose: buildPurposeFromFormValues(values),
    comments: buildApiCommentsFromFormValues(values),
    sector: { id: 1 },
    containerId: values.containerId.trim() || undefined,
    routeId: values.routeId.trim() || undefined,
    dispatchId: values.routeAssignmentId.trim() || undefined,
  };
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
  return order?.orderId ?? null;
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

  const matches = await fetchOrders({
    page: 1,
    limit: 1,
    search: {
      field: "sender.name",
      operator: "eq",
      value: values.sender.name.trim(),
    },
  });

  const matchedOrder = matches.items[0];
  if (matchedOrder) {
    return matchedOrder;
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create order.");
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
    throw new Error("Order not found.");
  }

  return order;
}

export async function createOrder(values: OrderFormValues): Promise<Order> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.PICKUPS,
    buildPickupWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create order.");

  return resolveCreatedOrder(values, response);
}

export async function updateOrder(orderId: string, values: OrderFormValues): Promise<Order> {
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUPS}/${orderId}`,
    buildPickupWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to update order.");

  const updatedOrder = extractOrderFromMutationResponse(response.data);
  if (updatedOrder) {
    return fetchOrderById(updatedOrder.orderId);
  }

  return fetchOrderById(orderId);
}

export async function updateOrderRouteAssignment(orderId: string, routeAssignmentId: string): Promise<Order> {
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(`${API_ENDPOINTS.PICKUPS}/${orderId}`, {
    dispatchId: routeAssignmentId,
  });

  assertMutationSuccess(response, "Unable to update route assignment.");

  return fetchOrderById(orderId);
}

export async function deleteOrder(orderId: string): Promise<void> {
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(`${API_ENDPOINTS.PICKUPS}/${orderId}`);
  assertMutationSuccess(response, "Unable to delete order.");
}

export async function deleteOrders(orderIds: string[]): Promise<void> {
  await Promise.all(orderIds.map((orderId) => deleteOrder(orderId)));
}
