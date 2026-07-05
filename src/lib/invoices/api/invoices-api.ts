import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { buildApiListQuery, resolveApiListSort } from "@/lib/api/list-query";
import {
  buildApiFilterNodeFromTableRows,
  buildApiSearchPaginationQuery,
  createTextSearchFilter,
  hasListTextSearch,
  isApiSearchFilter,
  resolveApiSearchSort,
  resolveSearchField,
  resolveSearchOperator,
  type ApiSearchFilterGroup,
  type StripeStyleSearchBody,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { buildApiAddressPayload, buildApiBranchDto } from "@/lib/api/payloads";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { coerceCustomerTypeFromApi } from "@/lib/customers/customer-type";
import { CUSTOMER_TYPE_RECEIVER, CUSTOMER_TYPE_SENDER, createRecordId, type Customer } from "@/lib/customers/types";
import { getPhoneAtDisplayIndex, getPrimaryPhoneNumber } from "@/lib/phones/phones";
import { INVOICE_TABLE_FILTER_FIELDS } from "@/lib/invoices/filter-fields";
import { expandInvoiceFilterNode } from "@/lib/invoices/invoice-filters";
import { createInvoiceBarSearchFilterGroup } from "@/lib/invoices/search-fields";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import { formatPickupCommentSummary } from "@/lib/orders/display";
import {
  createEmptyOrderParty,
  type OrderParty,
} from "@/lib/orders/types";
import {
  computeInvoiceBalance,
  DEFAULT_INVOICE_LIST_PARAMS,
  getInvoiceBalanceAmount,
  mapPaidRegionToPaymentLocation,
  mapPaymentLocationToPaidRegion,
  normalizeApiInvoiceMoney,
  resolveLineLabelCount,
  resolveLineTotal,
  type Invoice,
  type InvoiceBranch,
  type InvoiceComment,
  type InvoiceFormValues,
  type InvoiceLineItem,
  type InvoiceLineItemBarcode,
  type InvoiceLineItemFormValues,
  type InvoiceListParams,
} from "@/lib/invoices/types";
import type { TableFilterRowState } from "@/lib/table/filter-builder";

const INVOICE_LIST_SEARCH_FIELD = "number";

type ApiAddress = {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
};

type ApiInvoicePhone = {
  type?: string;
  number?: string;
  displayNumber?: string;
};

type ApiInvoiceParty = {
  id?: string;
  oldID?: number;
  name?: string;
  phones?: ApiInvoicePhone[];
  address?: ApiAddress;
};

type ApiInvoiceUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiInvoiceContainer = {
  id?: number;
  name?: string;
};

type ApiInvoiceComment = {
  description?: string;
  purpose?: string;
  quantity?: number;
  unit?: string;
};

type ApiInvoicePickup = {
  id?: number | string;
  comments?: ApiInvoiceComment[];
};

type ApiInvoiceBarcodeStatus = {
  id?: number;
  name?: string;
};

type ApiInvoiceBarcodeContainer = {
  id?: number | string;
  name?: string;
};

type ApiInvoiceBarcodeDelivery = {
  id?: number | string;
  name?: string;
};

type ApiInvoiceBarcode = {
  id?: number | string;
  number?: string;
  status?: ApiInvoiceBarcodeStatus;
  container?: ApiInvoiceBarcodeContainer;
  delivery?: ApiInvoiceBarcodeDelivery;
  scanDate?: string;
};

type ApiInvoiceDetail = {
  id?: string;
  name?: string;
  description?: string;
  quantity?: number;
  labels?: number;
  price?: number;
  cost?: number;
  total?: number;
  barcodes?: ApiInvoiceBarcode[];
};

type ApiInvoice = {
  id?: string;
  oldID?: number;
  number?: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  paidRegion?: string;
  paidStatus?: string;
  cost?: number;
  payment?: number;
  balance?: number;
  discount?: number;
  branch?: InvoiceBranch;
  user?: ApiInvoiceUser;
  employee?: ApiInvoiceUser;
  container?: ApiInvoiceContainer;
  pickup?: ApiInvoicePickup;
  comments?: ApiInvoiceComment[];
  sender?: ApiInvoiceParty;
  receiver?: ApiInvoiceParty;
  invoiceDetails?: ApiInvoiceDetail[];
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function readStringId(value: unknown): string | undefined {
  if (value == null) return undefined;
  const id = String(value).trim();
  return id || undefined;
}

function toInvoiceDateValue(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return new Date().toISOString().slice(0, 10);
  return trimmed.slice(0, 10);
}

function readInvoiceCreatedBy(user: unknown): string {
  if (!user || typeof user !== "object") return DEFAULT_CREATED_BY;
  const entry = user as ApiInvoiceUser;
  return String(entry.fullName ?? entry.userName ?? entry.name ?? "").trim() || DEFAULT_CREATED_BY;
}

function normalizeApiInvoiceParty(raw: unknown): OrderParty {
  if (!raw || typeof raw !== "object") {
    const empty = createEmptyOrderParty();
    return {
      id: empty.id,
      name: "",
      phones: [],
      addresses: [],
      orderAddressId: empty.orderAddressId,
    };
  }

  const party = raw as ApiInvoiceParty;
  const addressId = createRecordId();
  const address = party.address;

  const addresses =
    address && typeof address === "object"
      ? [
          {
            id: addressId,
            streetAddress: String(address.address1 ?? "").trim(),
            apt: String(address.address2 ?? "").trim() || undefined,
            city: String(address.city ?? "").trim(),
            state: String(address.state ?? "").trim(),
            provinceCountry: String(address.country ?? "").trim(),
            zipCode: String(address.zipcode ?? "").trim(),
            isPrimary: true,
          },
        ]
      : [];

  const id = readStringId(party.id) ?? createRecordId();
  const phones = Array.isArray(party.phones)
    ? party.phones
        .map((phone) => {
          const number = String(phone.number ?? "").trim();
          if (!number) return null;

          const displayNumber = String(phone.displayNumber ?? "").trim();
          const label = String(phone.type ?? "").trim();

          return {
            id: createRecordId(),
            number,
            ...(displayNumber ? { displayNumber } : {}),
            ...(label ? { label } : {}),
          };
        })
        .filter((phone): phone is NonNullable<typeof phone> => phone != null)
    : [];

  return {
    id,
    clientId: id,
    name: String(party.name ?? "").trim() || "—",
    phones,
    addresses,
    orderAddressId: addresses[0]?.id ?? addressId,
  };
}

function normalizeInvoiceBarcodes(raw: unknown): InvoiceLineItemBarcode[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry): InvoiceLineItemBarcode | null => {
      const barcode = entry as ApiInvoiceBarcode;
      const number = String(barcode.number ?? "").trim();
      if (!number) return null;

      const statusName = String(barcode.status?.name ?? "").trim();
      const containerName = String(barcode.container?.name ?? "").trim();
      const deliveryName = String(barcode.delivery?.name ?? "").trim();
      const scanDate = String(barcode.scanDate ?? "").trim();

      return {
        id: barcode.id != null ? String(barcode.id) : createRecordId(),
        number,
        statusId: typeof barcode.status?.id === "number" ? barcode.status.id : undefined,
        statusName: statusName || undefined,
        containerId: barcode.container?.id != null ? String(barcode.container.id) : undefined,
        containerName: containerName || undefined,
        deliveryId: barcode.delivery?.id != null ? String(barcode.delivery.id) : undefined,
        deliveryName: deliveryName || undefined,
        scanDate: scanDate || undefined,
      };
    })
    .filter((barcode): barcode is InvoiceLineItemBarcode => barcode != null);
}

function normalizeInvoiceLineItems(raw: unknown): InvoiceLineItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((entry) => {
    const detail = entry as ApiInvoiceDetail;
    const quantity = Number(detail.quantity ?? 0);
    const total = Number(detail.total ?? 0);
    // The API often sends only `total` (no per-unit `price`); derive the unit
    // price from the total / quantity so the Unit column is not shown as $0.00.
    const explicitPrice = detail.price != null ? Number(detail.price) : undefined;
    const lineTotal = Number.isFinite(total) && total !== 0
      ? total
      : quantity * (explicitPrice ?? 0);
    const unitPrice =
      explicitPrice != null && Number.isFinite(explicitPrice)
        ? explicitPrice
        : quantity > 0
          ? Math.round((lineTotal / quantity) * 100) / 100
          : 0;
    const apiId = readStringId(detail.id);
    const description = String(detail.description ?? "").trim();
    const itemName = String(detail.name ?? "").trim() || description || "Line item";

    return {
      id: apiId ?? createRecordId(),
      apiId,
      itemName,
      description: description || undefined,
      quantity,
      labelCount: Number(detail.labels ?? 0),
      unitPrice,
      lineTotal,
      barcodes: normalizeInvoiceBarcodes(detail.barcodes),
    };
  });
}

function normalizeInvoiceComments(raw: unknown): InvoiceComment[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      const comment = entry as ApiInvoiceComment;
      const description = String(comment.description ?? "").trim();
      const purpose = String(comment.purpose ?? "").trim();
      const unit = String(comment.unit ?? "").trim();
      const quantity = Number(comment.quantity ?? 0);

      const summary = formatPickupCommentSummary({
        description,
        purpose,
        unit,
        quantity: Number.isFinite(quantity) ? quantity : 0,
      });

      if (!summary || summary === "—") return null;

      return {
        id: createRecordId(),
        description: summary,
        createdAt: "",
        createdBy: "",
      } satisfies InvoiceComment;
    })
    .filter((comment): comment is InvoiceComment => comment != null);
}

function normalizeInvoice(raw: unknown): Invoice | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiInvoice;
  const invoiceId = readStringId(item.id);
  if (!invoiceId) return null;

  const paidRegion = String(item.paidRegion ?? "").trim();
  const lineItems = normalizeInvoiceLineItems(item.invoiceDetails);
  const { cost, discount, amountPaid, balance } = normalizeApiInvoiceMoney(item);

  return {
    invoiceId,
    invoiceNumber: String(item.number ?? "").trim(),
    date: toInvoiceDateValue(String(item.date ?? "")),
    containerId: item.container?.id != null ? String(item.container.id) : "",
    containerName: String(item.container?.name ?? "").trim() || undefined,
    paymentLocation: mapPaidRegionToPaymentLocation(paidRegion),
    paidRegion: paidRegion || undefined,
    paidStatus: String(item.paidStatus ?? "").trim() || undefined,
    cost: cost || undefined,
    branch: item.branch,
    pickupId: item.pickup?.id != null ? String(item.pickup.id) : undefined,
    sender: normalizeApiInvoiceParty(item.sender),
    receiver: normalizeApiInvoiceParty(item.receiver),
    lineItems,
    comments: normalizeInvoiceComments(item.comments ?? item.pickup?.comments),
    activity: [],
    payments: [],
    discount,
    amountPaid,
    balance,
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readInvoiceCreatedBy(item.employee ?? item.user),
    updatedAt: String(item.updatedAt ?? "").trim(),
  };
}

function normalizePaginatedInvoices(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<Invoice> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeInvoice).filter((invoice): invoice is Invoice => invoice != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function buildInvoiceSearchFilterGroups(params: InvoiceListParams): ApiSearchFilterGroup[] {
  const groups: ApiSearchFilterGroup[] = [];

  if (params.search?.value.trim()) {
    if (params.search.field) {
      const explicitFilter = createTextSearchFilter(
        resolveSearchField(params.search, INVOICE_LIST_SEARCH_FIELD),
        params.search.value,
        resolveSearchOperator(params.search),
      );
      if (explicitFilter) {
        groups.push({ operator: "and", filters: [explicitFilter] });
      }
    } else {
      const orGroup = createInvoiceBarSearchFilterGroup(params.search.value);
      if (orGroup) {
        groups.push(orGroup);
      }
    }
  }

  const rowFilterNode = buildApiFilterNodeFromTableRows(
    params.filterRows ?? [],
    INVOICE_TABLE_FILTER_FIELDS,
  );
  const expandedRowFilter = rowFilterNode ? expandInvoiceFilterNode(rowFilterNode) : null;

  if (expandedRowFilter) {
    if (isApiSearchFilter(expandedRowFilter)) {
      groups.push({ operator: "and", filters: [expandedRowFilter] });
    } else {
      groups.push(expandedRowFilter);
    }
  }

  if (params.paymentLocation && params.paymentLocation !== "all") {
    groups.push({
      operator: "and",
      filters: [
        {
          field: "paidRegion",
          operator: "eq",
          value: mapPaymentLocationToPaidRegion(params.paymentLocation),
        },
      ],
    });
  }

  return groups;
}

function hasInvoiceListFilters(params: InvoiceListParams): boolean {
  return (
    hasListTextSearch(params.search) ||
    (params.filterRows ?? []).some((row) => isCompleteFilterRow(row, INVOICE_TABLE_FILTER_FIELDS)) ||
    Boolean(params.paymentLocation && params.paymentLocation !== "all")
  );
}

function shouldUseInvoiceSearch(params: InvoiceListParams): boolean {
  return hasInvoiceListFilters(params);
}

function resolveInvoicesSort(params: InvoiceListParams): string | undefined {
  return resolveApiListSort(params.sort);
}

function buildInvoicesQuery(params: InvoiceListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_INVOICE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_INVOICE_LIST_PARAMS.limit,
    offset: params.offset,
    sort: resolveInvoicesSort(params) ?? DEFAULT_INVOICE_LIST_PARAMS.sort,
  });
}

/** POST /invoices/search — URL pagination; filters + sort in body only. */
function buildInvoiceSearchBody(params: InvoiceListParams): StripeStyleSearchBody {
  const body: StripeStyleSearchBody = {};

  const sortSpecs = resolveApiSearchSort(params.sort ?? DEFAULT_INVOICE_LIST_PARAMS.sort);
  if (sortSpecs) {
    body.sort = sortSpecs;
  }

  const filterGroups = buildInvoiceSearchFilterGroups(params);
  if (filterGroups.length === 0) {
    return body;
  }

  if (filterGroups.length === 1) {
    body.filters = filterGroups;
    return body;
  }

  body.operator = "and";
  body.filters = filterGroups;
  return body;
}

function parseInvoicePathId(invoiceId: string): string {
  const id = invoiceId.trim();
  if (!id) {
    throw new Error("Invalid invoice ID.");
  }
  return id;
}

export async function fetchInvoices(params: InvoiceListParams = {}): Promise<PaginatedResult<Invoice>> {
  if (shouldUseInvoiceSearch(params)) {
    const page = params.page ?? DEFAULT_INVOICE_LIST_PARAMS.page;
    const limit = params.limit ?? DEFAULT_INVOICE_LIST_PARAMS.limit;
    const offset = params.offset ?? (page - 1) * limit;
    const paginationQuery = buildApiSearchPaginationQuery({ page, limit, offset });

    const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
      `${API_ENDPOINTS.INVOICES}/search?${paginationQuery}`,
      buildInvoiceSearchBody(params),
    );

    return normalizePaginatedInvoices(response);
  }

  const query = buildInvoicesQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.INVOICES}?${query}`,
  );

  return normalizePaginatedInvoices(response);
}

/**
 * The EMSYS API does not expose a money-sum aggregation for invoices (the
 * `subtotal` envelope field is a filtered match count, not a balance total),
 * so the full outstanding balance is computed by paginating through every
 * matching invoice and summing each balance client-side.
 */
const INVOICE_BALANCE_PAGE_LIMIT = 200;
const INVOICE_BALANCE_MAX_PAGES = 100;

export async function fetchInvoiceBalanceTotal(
  filterRows: TableFilterRowState[] = [],
): Promise<number> {
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  let fetched = 0;
  let sum = 0;

  while (fetched < total && page <= INVOICE_BALANCE_MAX_PAGES) {
    const result = await fetchInvoices({
      ...DEFAULT_INVOICE_LIST_PARAMS,
      page,
      limit: INVOICE_BALANCE_PAGE_LIMIT,
      filterRows,
    });

    total = result.total;
    for (const invoice of result.items) {
      sum += getInvoiceBalanceAmount(invoice);
    }

    fetched += result.items.length;
    if (result.items.length === 0) break;
    page += 1;
  }

  return Math.round(sum * 100) / 100;
}

export async function fetchInvoiceById(invoiceId: string): Promise<Invoice> {
  const id = parseInvoicePathId(invoiceId);
  const response = await apiClient.get<ApiInvoice | PaginatedApiEnvelope<ApiInvoice>>(
    `${API_ENDPOINTS.INVOICES}/${id}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiInvoice>).data
      : response;

  const invoice = normalizeInvoice(raw);
  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  return invoice;
}

export type InvoiceWriteContext = {
  employee: {
    id: number;
    name: string;
    userName?: string;
    fullName?: string;
  };
  branch: InvoiceBranch;
  container: {
    id: number;
    name: string;
  };
};

type ApiInvoiceCustomerWriteRef = {
  id?: string;
  name: string;
  customerType: number;
  phone1: string;
  phone2?: string;
  email?: string;
  IDNumber?: string;
  address?: ReturnType<typeof buildApiAddressPayload>;
};

type ApiInvoiceDetailWriteRef = {
  id?: string;
  name: string;
  description?: string;
  quantity: number;
  labels: number;
  price: number;
  total: number;
};

type ApiInvoiceWritePayload = {
  number: string;
  date: string;
  branch: ReturnType<typeof buildApiBranchDto>;
  cost: number;
  payment: number;
  balance: number;
  discount: number;
  surcharge: number;
  paidRegion: string;
  paidStatus: string;
  employee: InvoiceWriteContext["employee"];
  container: InvoiceWriteContext["container"];
  sender: ApiInvoiceCustomerWriteRef;
  receiver?: ApiInvoiceCustomerWriteRef;
  pickup?: { id: string | number };
  invoiceDetails: ApiInvoiceDetailWriteRef[];
  isVoid?: boolean;
};

function buildInvoiceCustomerWriteRef(
  customer: Customer,
  fallbackType: number,
): ApiInvoiceCustomerWriteRef {
  const name = customer.name.trim();
  const phone1 = getPrimaryPhoneNumber(customer.phones);
  const phone2 = getPhoneAtDisplayIndex(customer.phones, 1);
  const email = customer.email.trim();
  const idNumber = customer.IDNumber.trim();
  const address = buildApiAddressPayload(customer.address);
  const customerType = customer.customerType ?? fallbackType;

  const payload: ApiInvoiceCustomerWriteRef = {
    name,
    customerType: coerceCustomerTypeFromApi(customerType || fallbackType),
    phone1,
  };

  if (customer.id.trim()) {
    payload.id = customer.id.trim();
  }

  if (email) payload.email = email;
  if (idNumber) payload.IDNumber = idNumber;
  if (phone2) payload.phone2 = phone2;
  if (address) payload.address = address;

  return payload;
}

function buildInvoiceDetailWriteRef(
  lineItem: InvoiceLineItemFormValues,
  index: number,
): ApiInvoiceDetailWriteRef {
  const name = lineItem.itemName.trim();
  if (!name) {
    throw new Error(`Line item ${index + 1}: description is required.`);
  }

  const quantity = Number(lineItem.quantity);
  const labels = resolveLineLabelCount(lineItem);
  const price = Number(lineItem.unitPrice);
  const total = resolveLineTotal(lineItem);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Line item ${index + 1}: quantity must be greater than 0.`);
  }

  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`Line item ${index + 1}: unit price must be 0 or greater.`);
  }

  const detail: ApiInvoiceDetailWriteRef = {
    name,
    quantity,
    labels,
    price: Math.round(price * 100) / 100,
    total: Math.round(total * 100) / 100,
  };

  const description = lineItem.itemId.trim();
  if (description) {
    detail.description = description;
  }

  const persistedId = lineItem.id.trim();
  if (/^[a-f\d]{24}$/i.test(persistedId)) {
    detail.id = persistedId;
  }

  return detail;
}

function deriveInvoicePaidStatus(cost: number, discount: number, payment: number, balance: number): string {
  if (payment <= 0) return "UNPAID";
  if (balance <= 0 || payment >= Math.max(0, cost - discount)) return "PAID";
  return "PARTIAL";
}

function buildInvoiceWritePayload(
  values: InvoiceFormValues,
  context: InvoiceWriteContext,
  options: { isUpdate?: boolean } = {},
): ApiInvoiceWritePayload {
  const invoiceNumber = values.invoiceNumber.trim();
  if (!invoiceNumber) {
    throw new Error("Invoice number is required.");
  }

  if (!values.date.trim()) {
    throw new Error("Date is required.");
  }

  if (!values.sender) {
    throw new Error("Sender is required.");
  }

  const lineItems = values.lineItems.filter(
    (item) => item.itemName.trim() || item.itemId || resolveLineTotal(item) > 0,
  );

  if (lineItems.length === 0) {
    throw new Error("At least one line item is required.");
  }

  const invoiceDetails = lineItems.map((item, index) => buildInvoiceDetailWriteRef(item, index));
  const cost = Math.round(invoiceDetails.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  const discount = Number(values.discount);
  const payment = Number(values.amountPaid);

  if (!Number.isFinite(discount) || discount < 0) {
    throw new Error("Discount must be 0 or greater.");
  }

  if (!Number.isFinite(payment) || payment < 0) {
    throw new Error("Amount paid must be 0 or greater.");
  }

  const balance = Math.max(0, computeInvoiceBalance(cost, discount, payment));

  const payload: ApiInvoiceWritePayload = {
    number: invoiceNumber,
    date: values.date.trim().slice(0, 10),
    branch: buildApiBranchDto(context.branch),
    cost,
    payment: Math.round(payment * 100) / 100,
    balance,
    discount: Math.round(discount * 100) / 100,
    surcharge: 0,
    paidRegion: mapPaymentLocationToPaidRegion(values.paymentLocation),
    paidStatus: deriveInvoicePaidStatus(cost, discount, payment, balance),
    employee: {
      id: context.employee.id,
      name: context.employee.name.trim() || DEFAULT_CREATED_BY,
      ...(context.employee.userName?.trim() ? { userName: context.employee.userName.trim() } : {}),
      ...(context.employee.fullName?.trim() ? { fullName: context.employee.fullName.trim() } : {}),
    },
    container: {
      id: context.container.id,
      name: context.container.name.trim() || String(context.container.id),
    },
    sender: buildInvoiceCustomerWriteRef(values.sender, CUSTOMER_TYPE_SENDER),
    invoiceDetails,
  };

  if (values.receiver) {
    payload.receiver = buildInvoiceCustomerWriteRef(values.receiver, CUSTOMER_TYPE_RECEIVER);
  }

  const pickupId = values.pickupId.trim();
  if (pickupId) {
    payload.pickup = { id: pickupId };
  }

  if (options.isUpdate) {
    payload.isVoid = false;
  }

  return payload;
}

function extractInvoiceFromMutationResponse(data: unknown): Invoice | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeInvoice(data);
  }

  return null;
}

async function resolveSavedInvoice(
  invoiceId: string | null,
  response: ApiMutationEnvelope<unknown>,
): Promise<Invoice> {
  const fromResponse = extractInvoiceFromMutationResponse(response.data ?? response);
  if (fromResponse) return fromResponse;

  if (invoiceId) {
    return fetchInvoiceById(invoiceId);
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to save invoice.");
}

export async function createInvoice(
  values: InvoiceFormValues,
  context: InvoiceWriteContext,
): Promise<Invoice> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.INVOICES,
    buildInvoiceWritePayload(values, context),
  );

  assertMutationSuccess(response, "Unable to create invoice.");

  const created = extractInvoiceFromMutationResponse(response.data ?? response);
  return resolveSavedInvoice(created?.invoiceId ?? null, response);
}

export async function updateInvoice(
  invoiceId: string,
  values: InvoiceFormValues,
  context: InvoiceWriteContext,
): Promise<Invoice> {
  const id = parseInvoicePathId(invoiceId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVOICES}/${id}`,
    buildInvoiceWritePayload(values, context, { isUpdate: true }),
  );

  assertMutationSuccess(response, "Unable to update invoice.");

  return resolveSavedInvoice(id, response);
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  const id = parseInvoicePathId(invoiceId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVOICES}/${id}`,
  );

  assertMutationSuccess(response, "Unable to delete invoice.");
}

export async function deleteInvoices(invoiceIds: string[]): Promise<void> {
  await Promise.all(invoiceIds.map((invoiceId) => deleteInvoice(invoiceId)));
}
