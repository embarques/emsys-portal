import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { axiosInstance } from "@/lib/api/axios";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import {
  buildApiListQuery,
  resolveApiListSort,
} from "@/lib/api/list-query";
import {
  buildApiFilterNodeFromTableRows,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
  isApiSearchFilter,
  resolveSearchOperator,
  type ApiSearchFilterGroup,
} from "@/lib/api/search-query";
import { ORDER_TABLE_FILTER_FIELDS } from "@/lib/orders/filter-fields";
import { expandOrderFilterNode } from "@/lib/orders/order-filters";
import { parseLastSyncedAt } from "@/lib/legacy-sync/last-synced";
import {
  createPickupBarSearchFilterGroup,
  createPickupTextSearchFilter,
  resolvePickupSearchField,
} from "@/lib/orders/pickup-search";
import { type TableFilterRowState } from "@/lib/table/filter-builder";
import {
  buildApiAddressPayload,
  buildApiBranchDto,
  type ApiAddressPayload,
  type ApiBranchDtoPayload,
} from "@/lib/api/payloads";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { normalizeApiCustomer, withTransactionPartyAddressSnapshot } from "@/lib/customers/api/customers-api";
import { coerceCustomerTypeFromApi } from "@/lib/customers/customer-type";
import type { Customer } from "@/lib/customers/types";
import { CUSTOMER_PORTAL_BRANCHES, getCustomerPrimaryCoreAddress, type CustomerCoreAddress } from "@/lib/customers/types";
import { buildApiPhonesPayload, createDefaultRecordPhones, normalizeRecordPhonesFromApi } from "@/lib/phones/phones";
import type { RecordPhoneWritePayload } from "@/lib/phones/types";
import type { Employee } from "@/lib/employees/types";
import { normalizeApiUser } from "@/lib/users/api/users-api";
import type { User } from "@/lib/users/types";
import {
  DEFAULT_ORDER_LIST_PARAMS,
  deriveOrderPurpose,
  formatOrderCommentSentence,
  getOrderPartyAddressAtIndex,
  orderCommentPurposeRequiresItem,
  resolveOrderCommentUnit,
  toApiCommentPurpose,
  type Order,
  type OrderFormValues,
  type OrderListParams,
  type PickupBranch,
  type PickupComment,
  type PickupSector,
} from "@/lib/orders/types";

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
  completedAt?: string;
  completedBy?: Record<string, unknown>;
  legacySyncStatus?: string;
  legacySyncError?: string;
  legacySyncedAt?: string;
  createdBy?: Record<string, unknown>;
  updatedBy?: Record<string, unknown>;
  branch?: ApiBranchRef;
  employee?: Record<string, unknown>;
  sender?: Record<string, unknown>;
  receiver?: Record<string, unknown>;
  receivers?: Record<string, unknown>[];
  purpose?: string;
  comments?: ApiComment[];
  sector?: ApiSectorRef;
  route?: ApiRouteRef | null;
  routeNumber?: number;
  routeAssignmentId?: string;
};

type ApiRouteRef = {
  id?: string | number;
  name?: string;
};

type ApiPickupCustomerRef = {
  name: string;
  customerType: number;
  phones?: RecordPhoneWritePayload[];
  email?: string;
  IDNumber?: string;
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
  branch: ApiBranchDtoPayload;
  sender: ApiPickupCustomerRef;
  receiver?: ApiPickupCustomerRef;
  purpose?: string;
  comments?: ApiComment[];
  sector?: { id: number; name?: string };
  employee?: ApiPickupEmployeeRef;
  completed?: boolean;
  route?: ApiRouteRef | null;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

export type LegacyPickupSyncSummary = {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  lastSyncedAt?: string;
};

export type LegacyPickupSyncResult = {
  message: string;
  summary: LegacyPickupSyncSummary;
};

export type LegacyPickupSyncPreview = {
  total: number;
  lastSyncedAt?: string;
};


/** Pickup field holding the sender's customer id, used to load a sender's pickup history. */
const SENDER_HISTORY_FILTER_FIELD = "sender.id";

/** Default number of historical pickups loaded for a sender. */
const SENDER_HISTORY_LIMIT = 50;

/** Default number of pickups shown for a scheduled pickup route. */
const ROUTE_PICKUPS_LIMIT = 50;

const EMPTY_CUSTOMER: Customer = {
  id: "",
  oldID: null,
  name: "—",
  customerType: null,
  phones: createDefaultRecordPhones(),
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
  },
  createdBy: null,
  updatedBy: null,
  addresses: [],
  receivers: [],
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
  if (customer) {
    return withTransactionPartyAddressSnapshot(customer, raw);
  }

  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_CUSTOMER, name: fallbackName };
  }

  const item = raw as Record<string, unknown>;
  const name = String(item.name ?? fallbackName).trim() || fallbackName;

  return withTransactionPartyAddressSnapshot(
    {
      ...EMPTY_CUSTOMER,
      id: String(item.id ?? "").trim(),
      name,
      phones: normalizeRecordPhonesFromApi(item),
      email: String(item.email ?? "").trim(),
    },
    raw,
  );
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
    phones: normalizeRecordPhonesFromApi(item),
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

  const item = raw as Record<string, unknown>;
  const pickupName = String(item.name ?? "").trim();
  const user = normalizeApiUser(raw);

  if (!user) return null;

  if (!pickupName || user.name.trim()) {
    return user;
  }

  return {
    ...user,
    name: pickupName,
  };
}

function normalizePickupRouteRef(raw: unknown): { id: string; name: string } | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiRouteRef;
  const id = String(item.id ?? "").trim();
  const name = String(item.name ?? "").trim();
  if (!id && !name) return null;

  return { id, name };
}

function normalizeOrder(raw: unknown): Order | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiPickup;
  const id = readNumericId(item.id);
  if (id == null || id <= 0) return null;

  const receiverRaw = item.receiver ?? (Array.isArray(item.receivers) ? item.receivers[0] : null);
  const comments = Array.isArray(item.comments) ? item.comments.map(normalizePickupComment) : [];
  // Live pickups expose the scheduled vehicle-route as `route: { id }` only.
  // Do not fall back to legacy `routeAssignmentId` — that field is for `/routes`
  // templates and can keep showing a route after `route: null` clears the assignment.
  const routeRef = normalizePickupRouteRef(item.route);

  return {
    id,
    date: normalizeIsoDate(item.date),
    createdAt: normalizeIsoDate(item.createdAt),
    updatedAt: normalizeIsoDate(item.updatedAt),
    completed: item.completed === true,
    legacySyncStatus: String(item.legacySyncStatus ?? "").trim() || undefined,
    legacySyncError: String(item.legacySyncError ?? "").trim() || undefined,
    legacySyncedAt: normalizeIsoDate(item.legacySyncedAt),
    createdBy: normalizePickupUser(item.createdBy),
    updatedBy: normalizePickupUser(item.updatedBy),
    branch: normalizePickupBranch(item.branch),
    employee: normalizePickupEmployee(item.employee),
    sender: normalizePickupCustomer(item.sender, "Sender"),
    receiver: receiverRaw ? normalizePickupCustomer(receiverRaw, "Receiver") : null,
    purpose: String(item.purpose ?? "").trim(),
    comments,
    sector: normalizePickupSector(item.sector),
    /** Vehicle-route record id (`GET /vehicle-routes`, `routeType: pickup`), not `/routes`. */
    routeId: routeRef?.id || undefined,
    routeName: routeRef?.name || undefined,
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

function buildOrderSearchFilterGroups(params: OrderListParams): ApiSearchFilterGroup[] {
  const groups: ApiSearchFilterGroup[] = [];

  if (params.search?.value.trim()) {
    const trimmed = params.search.value.trim();

    if (params.search.field) {
      const explicitFilter = createPickupTextSearchFilter(
        resolvePickupSearchField(params.search.field),
        trimmed,
        resolveSearchOperator(params.search),
      );
      if (explicitFilter) {
        if (isApiSearchFilter(explicitFilter)) {
          groups.push({ operator: "and", filters: [explicitFilter] });
        } else {
          groups.push(explicitFilter);
        }
      }
    } else {
      const orGroup = createPickupBarSearchFilterGroup(trimmed);
      if (orGroup) {
        groups.push(orGroup);
      }
    }
  }

  const rowFilterNode = buildApiFilterNodeFromTableRows(
    params.filterRows ?? [],
    ORDER_TABLE_FILTER_FIELDS,
  );
  const expandedRowFilter = rowFilterNode ? expandOrderFilterNode(rowFilterNode) : null;

  if (expandedRowFilter) {
    if (isApiSearchFilter(expandedRowFilter)) {
      groups.push({ operator: "and", filters: [expandedRowFilter] });
    } else {
      groups.push(expandedRowFilter);
    }
  }

  return groups;
}

function hasOrderListFilters(params: OrderListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
    filterRows: params.filterRows,
    tableFilterFields: ORDER_TABLE_FILTER_FIELDS,
  });
}

function aliasOrdersSortField(field: string): string {
  return field.trim() === "createdBy" ? "createdBy.name" : field.trim();
}

function aliasOrdersSort(sort?: OrderListParams["sort"]): OrderListParams["sort"] {
  if (typeof sort !== "string") return sort;

  const aliased = sort
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();
      if (!trimmed) return "";
      const [field, direction] = trimmed.split(":");
      const mapped = aliasOrdersSortField(field ?? "");
      if (!mapped) return "";
      return direction === "asc" || direction === "desc" ? `${mapped}:${direction}` : mapped;
    })
    .filter(Boolean)
    .join(",");

  return aliased || undefined;
}

function resolveOrdersSort(params: OrderListParams): string | undefined {
  return resolveApiListSort(aliasOrdersSort(params.sort) ?? params.sort);
}

function buildOrdersQuery(params: OrderListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_ORDER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_ORDER_LIST_PARAMS.limit,
    offset: params.offset,
    sort: resolveOrdersSort(params) ?? DEFAULT_ORDER_LIST_PARAMS.sort,
  });
}

function buildPickupSearchBody(params: OrderListParams) {
  return buildStripeStyleSearchBody({
    sort: aliasOrdersSort(params.sort ?? DEFAULT_ORDER_LIST_PARAMS.sort),
    filterGroups: buildOrderSearchFilterGroups(params),
  });
}

/**
 * List pickups from EMSYS API.
 * - Unfiltered: GET /pickups?page&offset&limit
 * - Search/filters: POST /pickups/search
 */
export async function fetchOrders(params: OrderListParams = {}): Promise<PaginatedResult<Order>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.PICKUPS,
    page: params.page ?? DEFAULT_ORDER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_ORDER_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasOrderListFilters(params),
    buildGetQuery: () => buildOrdersQuery(params),
    buildSearchBody: () => buildPickupSearchBody(params),
    normalize: normalizePaginatedOrders,
  });
}

/**
 * Pickup history for a single sender.
 * `GET /pickups?field=sender.id&operator=eq&value=<customerId>&sort=date:desc`
 *
 * Returns the sender's previous and current pickups so the order form/view can
 * show them without relying on the client-side orders list page.
 */
export async function fetchSenderOrderHistory(
  senderId: string,
  options: { limit?: number } = {},
): Promise<PaginatedResult<Order>> {
  const trimmedId = senderId.trim();
  if (!trimmedId) {
    return { items: [], page: 1, resultsPerPage: 0, total: 0 };
  }

  const query = buildApiListQuery({
    page: 1,
    limit: options.limit ?? SENDER_HISTORY_LIMIT,
    sort: DEFAULT_ORDER_LIST_PARAMS.sort,
    filter: {
      field: SENDER_HISTORY_FILTER_FIELD,
      operator: "eq",
      value: trimmedId,
    },
  });

  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.PICKUPS}?${query}`,
  );

  return normalizePaginatedOrders(response);
}

/**
 * Pickups assigned to a scheduled pickup route.
 * `POST /pickups/search` with `route.id eq <vehicle_route_id>`.
 */
export async function fetchPickupsByRoute(
  routeId: string,
  options: { page?: number; limit?: number } = {},
): Promise<PaginatedResult<Order>> {
  const trimmedRouteId = routeId.trim();
  if (!trimmedRouteId) {
    return { items: [], page: 1, resultsPerPage: 0, total: 0 };
  }

  const result = await fetchOrders({
    page: options.page ?? 1,
    limit: options.limit ?? ROUTE_PICKUPS_LIMIT,
    sort: DEFAULT_ORDER_LIST_PARAMS.sort,
    filterRows: buildRoutePickupsFilter(trimmedRouteId),
  });

  return {
    ...result,
    items: result.items.map((order) => ({
      ...order,
      routeId: order.routeId?.trim() || trimmedRouteId,
    })),
  };
}

/** Load every pickup assigned to a route, paging through search results. */
export async function fetchAllPickupsByRoute(routeId: string): Promise<Order[]> {
  const trimmedRouteId = routeId.trim();
  if (!trimmedRouteId) return [];

  const limit = 100;
  let page = 1;
  const items: Order[] = [];
  let total = 0;

  while (true) {
    const result = await fetchPickupsByRoute(trimmedRouteId, { page, limit });
    items.push(...result.items);
    total = result.total;
    if (items.length >= total || result.items.length === 0) break;
    page += 1;
  }

  return items;
}

/** Load every pickup assigned to any of the given scheduled routes. */
export async function fetchAllPickupsByRoutes(routeIds: string[]): Promise<Order[]> {
  const uniqueRouteIds = [...new Set(routeIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueRouteIds.length === 0) return [];

  const batches = await Promise.all(uniqueRouteIds.map((routeId) => fetchAllPickupsByRoute(routeId)));
  const byId = new Map<number, Order>();

  for (const batch of batches) {
    for (const order of batch) {
      byId.set(order.id, order);
    }
  }

  return [...byId.values()];
}

function buildRoutePickupsFilter(routeId: string): TableFilterRowState[] {
  return [
    {
      id: "route-id",
      join: "and",
      field: "route.id",
      operator: "eq",
      value: routeId,
    },
  ];
}

/**
 * Assign appointments to a scheduled vehicle route via
 * `PUT /pickups/route/{routeId}` with `{ pickupIds }` (Swagger AssignRouteRequest).
 */
export async function assignPickupsToRoute(
  vehicleRouteId: string,
  pickupIds: number[],
): Promise<void> {
  const id = vehicleRouteId.trim();
  if (!id) {
    throw new Error("A valid appointment route is required.");
  }

  if (pickupIds.length === 0) {
    throw new Error("Select at least one appointment to assign.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUP_ROUTES}/${id}`,
    { pickupIds },
  );

  assertMutationSuccess(response, "Unable to assign appointment route.");
}

function unwrapPickupApiRecord(response: unknown): ApiPickup {
  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiPickup>).data
      : response;

  if (!raw || typeof raw !== "object") {
    throw new Error("Pickup not found.");
  }

  return raw as ApiPickup;
}

/** Raw pickup record from `GET /pickups/{id}` — suitable for round-trip `PUT`. */
export async function fetchPickupApiRecord(orderId: string): Promise<ApiPickup> {
  const id = orderId.trim();
  if (!id) {
    throw new Error("A valid pickup is required.");
  }

  const response = await apiClient.get<ApiPickup | PaginatedApiEnvelope<ApiPickup>>(
    `${API_ENDPOINTS.PICKUPS}/${id}`,
  );

  return unwrapPickupApiRecord(response);
}

/**
 * Round-trip the live GET body and apply a small patch for updates that still
 * send a fuller pickup model (e.g. toggling `completed`).
 *
 * Route unassign uses `DELETE /pickups/{id}/route` instead — `PUT /pickups/{id}`
 * is JSON merge-aware (`route: null` also clears), and
 * `PUT /pickups/route/{routeId}` is additive (empty `pickupIds` is rejected).
 */
const PICKUP_UPDATE_OMIT_KEYS = new Set([
  "id",
  "oldID",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
  "legacySyncStatus",
  "legacySyncError",
  "legacySyncedAt",
  "routeAssignmentId",
  "completedAt",
  "completedBy",
]);

function buildPickupUpdatePayloadFromApiRecord(
  record: ApiPickup,
  patch: { completed?: boolean } = {},
): Record<string, unknown> {
  const raw = record as Record<string, unknown>;
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (PICKUP_UPDATE_OMIT_KEYS.has(key)) continue;
    if (value === undefined) continue;
    payload[key] = value;
  }

  // Pickup update model uses `receivers[]`; some reads still expose singular `receiver`.
  if (!payload.receivers && raw.receiver) {
    payload.receivers = [raw.receiver];
  }
  delete payload.receiver;

  if (!payload.sender || typeof payload.sender !== "object") {
    throw new Error("Appointment sender is required.");
  }

  if (typeof patch.completed === "boolean") {
    payload.completed = patch.completed;
  }

  return payload;
}

/** PUT /pickups/{id} using the live Pickup record + patch. */
async function putPickupWithLiveRecordPatch(
  orderId: string,
  patch: { completed?: boolean },
  fallbackMessage = "Unable to update appointment.",
): Promise<void> {
  const pickupId = orderId.trim();
  const record = await fetchPickupApiRecord(pickupId);
  const payload = buildPickupUpdatePayloadFromApiRecord(record, patch);

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUPS}/${pickupId}`,
    payload,
  );

  assertMutationSuccess(response, fallbackMessage);
}

/**
 * Unassign an appointment from its scheduled route.
 *
 * Prefer the dedicated endpoint: `DELETE /pickups/{id}/route` clears `route`
 * (and `routeNumber`) without rewriting the pickup payload. `PUT` with
 * `route: null` also works now that updates are JSON merge-aware.
 */
export async function clearPickupRouteAssignment(order: Order): Promise<void> {
  if (order.id <= 0) {
    throw new Error("A valid appointment is required.");
  }

  const pickupId = String(order.id);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUPS}/${pickupId}/route`,
  );
  assertMutationSuccess(response, "Unable to clear appointment route.");
}

/** Remove route assignments from the given appointments. */
export async function clearPickupRouteAssignments(orders: Order[]): Promise<number> {
  const eligibleOrders = orders.filter((order) => order.id > 0);
  if (eligibleOrders.length === 0) {
    throw new Error("Select at least one appointment to remove from the route.");
  }

  await Promise.all(eligibleOrders.map((order) => clearPickupRouteAssignment(order)));
  return eligibleOrders.length;
}

/** Remove route assignments from the given appointments. */
export async function unassignOrdersFromRoutes(orders: Order[]): Promise<number> {
  return clearPickupRouteAssignments(orders);
}

/** Remove route assignments from the selected appointments on a route. */
export async function unassignPickupsFromRoute(orders: Order[]): Promise<number> {
  return clearPickupRouteAssignments(orders);
}

/** Remove every appointment from a scheduled appointment route. */
export async function unassignAllPickupsFromRoute(routeId: string): Promise<number> {
  const trimmedRouteId = routeId.trim();
  if (!trimmedRouteId) {
    throw new Error("A valid appointment route is required.");
  }

  const pickups = await fetchAllPickupsByRoute(trimmedRouteId);
  return clearPickupRouteAssignments(pickups);
}

function resolvePickupBranchRef(branchId: number): ApiBranchDtoPayload {
  const config =
    CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.id === branchId) ?? CUSTOMER_PORTAL_BRANCHES[0];

  return buildApiBranchDto({
    id: config.id,
    code: config.code,
    name: config.label,
  });
}

function buildPickupCustomerRef(
  customer: Customer,
  selectedAddress?: CustomerCoreAddress,
): ApiPickupCustomerRef {
  const name = customer.name.trim();
  const email = customer.email.trim();
  const idNumber = customer.IDNumber.trim();
  const phones = buildApiPhonesPayload(customer.phones).filter((phone) => phone.number.trim());
  const address = buildApiAddressPayload(
    selectedAddress ?? getCustomerPrimaryCoreAddress(customer),
  );

  const payload: ApiPickupCustomerRef = {
    name,
    customerType: coerceCustomerTypeFromApi(customer.customerType),
  };

  if (phones.length > 0) {
    payload.phones = phones;
  }

  if (customer.id.trim()) {
    payload.id = customer.id.trim();
  }

  if (email) {
    payload.email = email;
  }

  if (idNumber) {
    payload.IDNumber = idNumber;
  }

  if (address) {
    payload.address = address;
  }

  return payload;
}

function buildApiCommentsFromFormValues(values: OrderFormValues): ApiComment[] {
  // Skip blank rows (e.g. the empty comment the editor pre-focuses for the next entry).
  const comments = values.comments.filter((comment) => comment.purpose.trim());

  if (comments.length === 0) {
    return [{ purpose: "", unit: "", quantity: 0, description: "" }];
  }

  return comments.map((comment) => {
    const requiresItem = orderCommentPurposeRequiresItem(comment.purpose);
    const quantity = Number(comment.quantity);

    return {
      purpose: toApiCommentPurpose(comment.purpose),
      unit: resolveOrderCommentUnit(comment),
      quantity: requiresItem && Number.isFinite(quantity) ? quantity : 0,
      description: formatOrderCommentSentence(comment),
    };
  });
}

function buildPickupWritePayload(values: OrderFormValues): ApiPickupWritePayload {
  if (!values.sender) {
    throw new Error("Sender is required.");
  }

  const date = values.date.trim() || new Date().toISOString().slice(0, 10);
  const purpose = deriveOrderPurpose(values.comments);
  const comments = buildApiCommentsFromFormValues(values);

  const payload: ApiPickupWritePayload = {
    date,
    branch: resolvePickupBranchRef(values.branchId),
    sender: buildPickupCustomerRef(
      values.sender,
      getOrderPartyAddressAtIndex(values.sender, values.senderAddressIndex),
    ),
  };

  if (purpose) {
    payload.purpose = purpose;
  }

  if (comments.length > 0) {
    payload.comments = comments;
  }

  if (values.receiver) {
    payload.receiver = buildPickupCustomerRef(
      values.receiver,
      getOrderPartyAddressAtIndex(values.receiver, values.receiverAddressIndex),
    );
  }

  if (values.sectorId !== "" && values.sectorId > 0) {
    payload.sector = { id: values.sectorId };
  }

  if (values.employeeId !== "" && values.employeeId > 0) {
    payload.employee = { id: values.employeeId };
  }

  if (values.id > 0 && values.completed) {
    payload.completed = true;
  }

  return payload;
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
  const order = normalizeOrder(await fetchPickupApiRecord(orderId));
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

/** Mark an appointment complete/incomplete via full live Pickup PUT + `completed` patch. */
export async function setOrderCompleted(order: Order, completed: boolean): Promise<void> {
  if (order.id <= 0) {
    throw new Error("A valid appointment is required.");
  }

  const pickupId = String(order.id);
  await putPickupWithLiveRecordPatch(
    pickupId,
    { completed },
    completed ? "Unable to mark appointment complete." : "Unable to mark appointment incomplete.",
  );

  const after = await fetchOrderById(pickupId);
  if (after.completed !== completed) {
    throw new Error(
      completed ? "Unable to mark appointment complete." : "Unable to mark appointment incomplete.",
    );
  }
}

export async function setOrdersCompleted(orders: Order[], completed: boolean): Promise<void> {
  await Promise.all(orders.map((order) => setOrderCompleted(order, completed)));
}

function normalizeLegacySyncSummary(raw: unknown): LegacyPickupSyncSummary {
  if (!raw || typeof raw !== "object") {
    return { imported: 0, updated: 0, skipped: 0, total: 0 };
  }

  const item = raw as Record<string, unknown>;

  return {
    imported: Number(item.imported ?? 0),
    updated: Number(item.updated ?? 0),
    skipped: Number(item.skipped ?? 0),
    total: Number(item.total ?? 0),
    lastSyncedAt: parseLastSyncedAt(raw),
  };
}

function normalizeLegacySyncPreview(raw: unknown): LegacyPickupSyncPreview {
  if (!raw || typeof raw !== "object") {
    return { total: 0 };
  }

  const item = raw as Record<string, unknown>;
  return { total: Number(item.total ?? 0), lastSyncedAt: parseLastSyncedAt(raw) };
}

export async function previewLegacyPickupSync(): Promise<LegacyPickupSyncPreview> {
  const response = await axiosInstance.get<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUPS}/legacy-sync/preview`,
    { useDirectApi: true },
  );

  assertMutationSuccess(response.data, "Unable to preview legacy pickup sync.");

  return normalizeLegacySyncPreview(response.data.data);
}

export async function syncLegacyPickups(): Promise<LegacyPickupSyncResult> {
  const response = await axiosInstance.post<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUPS}/legacy-sync`,
    undefined,
    { useDirectApi: true },
  );

  assertMutationSuccess(response.data, "Unable to sync legacy pickups.");

  return {
    message: response.data.message?.trim() || "Legacy pickups synced.",
    summary: normalizeLegacySyncSummary(response.data.data),
  };
}

export async function retryOrderLegacySync(orderId: string): Promise<Order> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUPS}/${orderId}/legacy-sync/retry`,
  );

  assertMutationSuccess(response, "Unable to retry legacy pickup sync.");

  const order = extractOrderFromMutationResponse(response.data);
  if (order) {
    return order;
  }

  return fetchOrderById(orderId);
}
