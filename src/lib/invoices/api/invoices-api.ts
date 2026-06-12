import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { buildApiListQuery, resolveApiListSort } from "@/lib/api/list-query";
import {
  buildApiFilterNodeFromTableRows,
  buildApiSearchPaginationQuery,
  buildStripeStyleSearchBody,
  createTextSearchFilter,
  hasListTextSearch,
  isApiSearchFilter,
  resolveSearchField,
  resolveSearchOperator,
  type ApiSearchFilterGroup,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";
import { INVOICE_TABLE_FILTER_FIELDS } from "@/lib/invoices/filter-fields";
import { expandInvoiceFilterNode } from "@/lib/invoices/invoice-filters";
import { createInvoiceBarSearchFilterGroup } from "@/lib/invoices/search-fields";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import {
  createEmptyOrderParty,
  type OrderParty,
} from "@/lib/orders/types";
import {
  DEFAULT_INVOICE_LIST_PARAMS,
  mapPaidRegionToPaymentLocation,
  mapPaymentLocationToPaidRegion,
  normalizeApiInvoiceMoney,
  type Invoice,
  type InvoiceBranch,
  type InvoiceLineItem,
  type InvoiceListParams,
} from "@/lib/invoices/types";

const INVOICE_LIST_SEARCH_FIELD = "number";

type ApiAddress = {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
};

type ApiInvoiceParty = {
  id?: string;
  oldID?: number;
  name?: string;
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

type ApiInvoiceDetail = {
  name?: string;
  quantity?: number;
  labels?: number;
  price?: number;
  total?: number;
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
  container?: ApiInvoiceContainer;
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

  return {
    id,
    clientId: party.oldID != null ? String(party.oldID) : undefined,
    name: String(party.name ?? "").trim() || "—",
    phones: [],
    addresses,
    orderAddressId: addresses[0]?.id ?? addressId,
  };
}

function normalizeInvoiceLineItems(raw: unknown): InvoiceLineItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((entry) => {
    const detail = entry as ApiInvoiceDetail;
    const quantity = Number(detail.quantity ?? 0);
    const unitPrice = Number(detail.price ?? 0);
    const lineTotal = Number(detail.total ?? quantity * unitPrice);

    return {
      id: createRecordId(),
      itemName: String(detail.name ?? "").trim() || "Line item",
      quantity,
      labelCount: Number(detail.labels ?? 0),
      unitPrice,
      lineTotal,
    };
  });
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
    oldID: item.oldID,
    date: toInvoiceDateValue(String(item.date ?? "")),
    containerId: item.container?.id != null ? String(item.container.id) : "",
    containerName: String(item.container?.name ?? "").trim() || undefined,
    paymentLocation: mapPaidRegionToPaymentLocation(paidRegion),
    paidRegion: paidRegion || undefined,
    paidStatus: String(item.paidStatus ?? "").trim() || undefined,
    cost: cost || undefined,
    branch: item.branch,
    sender: normalizeApiInvoiceParty(item.sender),
    receiver: normalizeApiInvoiceParty(item.receiver),
    lineItems,
    comments: [],
    activity: [],
    payments: [],
    discount,
    amountPaid,
    balance,
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readInvoiceCreatedBy(item.user),
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
    sort: resolveInvoicesSort(params),
  });
}

function buildInvoiceSearchBody(params: InvoiceListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort,
    filterGroups: buildInvoiceSearchFilterGroups(params),
  });
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string): void {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
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
