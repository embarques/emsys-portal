import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { axiosInstance } from "@/lib/api/axios";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { buildApiListQuery, resolveApiListSort } from "@/lib/api/list-query";
import {
  buildApiFilterNodeFromTableRows,
  buildApiSearchPaginationQuery,
  buildStripeStyleSearchBody,
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
import { buildApiAddressPayload, buildApiBranchDto, type ApiAddressPayload } from "@/lib/api/payloads";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { coerceCustomerTypeFromApi } from "@/lib/customers/customer-type";
import { CUSTOMER_TYPE_RECEIVER, CUSTOMER_TYPE_SENDER, createRecordId, getCustomerPrimaryCoreAddress, type Customer } from "@/lib/customers/types";
import { getPhoneAtDisplayIndex, getPrimaryPhoneNumber } from "@/lib/phones/phones";
import { INVOICE_TABLE_FILTER_FIELDS } from "@/lib/invoices/filter-fields";
import { expandInvoiceFilterNode } from "@/lib/invoices/invoice-filters";
import { createInvoiceBarSearchFilterGroup } from "@/lib/invoices/search-fields";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import { parseLastSyncedAt } from "@/lib/legacy-sync/last-synced";
import { formatPickupCommentSummary } from "@/lib/orders/display";
import {
  createEmptyOrderParty,
  type OrderParty,
} from "@/lib/orders/types";
import {
  computeInvoiceBalance,
  createInvoiceSearchFilter,
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
  type LegacyInvoiceSyncPreview,
  type LegacyInvoiceSyncRequest,
  type LegacyInvoiceSyncResult,
  type LegacyInvoiceSyncSummary,
} from "@/lib/invoices/types";
import type { TableFilterRowState } from "@/lib/table/filter-builder";

const INVOICE_LIST_SEARCH_FIELD = "number";

type ApiAddress = {
  id?: string;
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
  isPrimary?: boolean;
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
  addresses?: ApiAddress[];
  email?: string;
  IDNumber?: string;
};

type ApiInvoiceUser = {
  id?: number | string;
  name?: string;
  userName?: string;
  fullName?: string;
  email?: string;
  uid?: string;
};

type ApiInvoiceReceivedBy = ApiInvoiceUser &
  ApiInvoiceRouteRef & {
    date?: string;
    routeType?: string;
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

type ApiInvoiceRouteRef = {
  id?: number | string;
  name?: string;
  routeId?: string;
  route?: ApiInvoiceRouteRef;
};

type ApiInvoiceBarcodeRoute = ApiInvoiceRouteRef;

type ApiInvoiceBarcode = {
  id?: number | string;
  barcodeId?: number | string;
  number?: string;
  status?: ApiInvoiceBarcodeStatus;
  container?: ApiInvoiceBarcodeContainer;
  delivery?: ApiInvoiceBarcodeDelivery;
  route?: ApiInvoiceBarcodeRoute;
  scanDate?: string;
  createdAt?: string;
  createdBy?: ApiInvoiceUser;
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
  barcode?: ApiInvoiceBarcode;
  barcodes?: ApiInvoiceBarcode[];
};

type ApiInvoice = {
  id?: string;
  oldID?: number;
  number?: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  legacySyncedAt?: string;
  paidRegion?: string;
  paidStatus?: string;
  cost?: number;
  payment?: number;
  balance?: number;
  discount?: number;
  branch?: InvoiceBranch;
  user?: ApiInvoiceUser;
  employee?: ApiInvoiceUser;
  receivedBy?: ApiInvoiceReceivedBy;
  createdBy?: ApiInvoiceUser;
  updatedBy?: ApiInvoiceUser;
  container?: ApiInvoiceContainer;
  officeBranch?: InvoiceBranch;
  pickupEmployee?: ApiInvoiceUser;
  pickupSource?: string;
  route?: ApiInvoiceRouteRef;
  routeCrew?: ApiInvoiceRouteRef;
  vehicleRoute?: ApiInvoiceRouteRef;
  pickup?: ApiInvoicePickup;
  comments?: ApiInvoiceComment[];
  sender?: ApiInvoiceParty;
  receiver?: ApiInvoiceParty | null;
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

function normalizeApiInvoicePartyAddresses(party: ApiInvoiceParty): OrderParty["addresses"] {
  const snapshotAddress = party.address;
  if (!snapshotAddress || typeof snapshotAddress !== "object") {
    return [];
  }

  const addressId = readStringId(snapshotAddress.id) ?? createRecordId();
  const streetAddress = String(snapshotAddress.address1 ?? "").trim();
  const apartment = String(snapshotAddress.apartment ?? "").trim();
  const address2 = String(snapshotAddress.address2 ?? "").trim();
  const city = String(snapshotAddress.city ?? "").trim();
  const state = String(snapshotAddress.state ?? "").trim();
  const zipCode = String(snapshotAddress.zipcode ?? "").trim();

  if (!streetAddress && !apartment && !address2 && !city && !state && !zipCode) {
    return [];
  }

  return [
    {
      id: addressId,
      streetAddress,
      apt: apartment || undefined,
      crossStreet: address2 || undefined,
      city,
      state,
      provinceCountry: String(snapshotAddress.country ?? "").trim(),
      zipCode,
      isPrimary: true,
    },
  ];
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
  const addresses = normalizeApiInvoicePartyAddresses(party);

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

  const documentId = String(party.IDNumber ?? "").trim();
  const email = String(party.email ?? "").trim();

  return {
    id,
    clientId: id,
    name: String(party.name ?? "").trim() || "—",
    documentId: documentId || undefined,
    email: email || undefined,
    phones,
    addresses,
    orderAddressId: addresses.find((address) => address.isPrimary)?.id ?? addresses[0]?.id ?? id,
  };
}

function normalizeApiInvoiceReceiver(item: ApiInvoice): OrderParty | null {
  if (!item.receiver) {
    return null;
  }

  return normalizeApiInvoiceParty(item.receiver);
}

function normalizeInvoiceBarcodes(raw: unknown): InvoiceLineItemBarcode[] {
  const entries = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];

  return entries
    .map((entry): InvoiceLineItemBarcode | null => {
      const barcode = entry as ApiInvoiceBarcode;
      const number = String(barcode.number ?? "").trim();
      if (!number) return null;

      const statusName = String(barcode.status?.name ?? "").trim();
      const containerName = String(barcode.container?.name ?? "").trim();
      const deliveryName = String(barcode.delivery?.name ?? "").trim();
      const routeName = String(barcode.route?.name ?? "").trim();
      const scanDate = String(barcode.scanDate ?? "").trim();
      const createdAt = String(barcode.createdAt ?? "").trim();
      const createdBy = readInvoiceCreatedBy(barcode.createdBy);

      const objectId =
        barcode.barcodeId != null && String(barcode.barcodeId).trim()
          ? String(barcode.barcodeId).trim()
          : typeof barcode.id === "string" &&
              /^[a-f\d]{24}$/i.test(barcode.id.trim())
            ? barcode.id.trim()
            : undefined;
      const packageSequence =
        typeof barcode.id === "number" && Number.isFinite(barcode.id)
          ? barcode.id
          : typeof barcode.id === "string" && /^\d+$/.test(barcode.id.trim())
            ? Number(barcode.id.trim())
            : undefined;

      return {
        id: objectId || (packageSequence != null ? String(packageSequence) : createRecordId()),
        barcodeId: objectId,
        packageSequence:
          packageSequence != null && Number.isFinite(packageSequence) ? packageSequence : undefined,
        number,
        statusId: typeof barcode.status?.id === "number" ? barcode.status.id : undefined,
        statusName: statusName || undefined,
        containerId: barcode.container?.id != null ? String(barcode.container.id) : undefined,
        containerName: containerName || undefined,
        deliveryId: barcode.delivery?.id != null ? String(barcode.delivery.id) : undefined,
        deliveryName: deliveryName || undefined,
        routeId: barcode.route?.id != null ? String(barcode.route.id) : undefined,
        routeName: routeName || undefined,
        scanDate: scanDate || undefined,
        createdAt: createdAt || undefined,
        createdBy: createdBy !== DEFAULT_CREATED_BY ? createdBy : undefined,
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
    // Write path stores catalog FK in `description` and human text in `name`.
    // Never treat a numeric catalog id as display copy.
    const rawDescription = String(detail.description ?? "").trim();
    const catalogItemId = /^\d+$/.test(rawDescription) ? rawDescription : undefined;
    const freeTextDescription = catalogItemId ? undefined : rawDescription || undefined;
    const itemName =
      String(detail.name ?? "").trim() || freeTextDescription || "Line item";

    return {
      id: apiId ?? createRecordId(),
      apiId,
      itemId: catalogItemId,
      itemName,
      description:
        freeTextDescription && freeTextDescription !== itemName
          ? freeTextDescription
          : undefined,
      quantity,
      labelCount: Number(detail.labels ?? 0),
      unitPrice,
      lineTotal,
      barcodes: normalizeInvoiceBarcodes(
        Array.isArray(detail.barcodes) && detail.barcodes.length > 0
          ? detail.barcodes
          : detail.barcode,
      ),
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

function readInvoiceRouteRef(
  raw?: ApiInvoiceRouteRef | null,
): { id?: string; name?: string } {
  if (!raw || typeof raw !== "object") return {};
  const id = raw.id != null ? String(raw.id).trim() : "";
  const name = String(raw.name ?? "").trim();
  return {
    ...(id ? { id } : {}),
    ...(name ? { name } : {}),
  };
}

function firstInvoiceRouteRef(
  ...candidates: Array<ApiInvoiceRouteRef | null | undefined>
): { id?: string; name?: string } {
  for (const candidate of candidates) {
    const ref = readInvoiceRouteRef(candidate);
    if (ref.id || ref.name) return ref;
  }
  return {};
}

function receivedByLooksLikeDailyRoute(raw?: ApiInvoiceReceivedBy | null): boolean {
  if (!raw || typeof raw !== "object") return false;
  if (raw.route && typeof raw.route === "object") return true;
  if (String(raw.routeType ?? "").trim()) return true;
  if (String(raw.date ?? "").trim()) return true;
  const id = raw.id != null ? String(raw.id).trim() : "";
  return /^[a-f\d]{24}$/i.test(id);
}

function isInvoiceReceivedByEmpty(raw?: ApiInvoiceReceivedBy | null): boolean {
  if (raw == null || typeof raw !== "object") return true;
  const id = raw.id != null ? String(raw.id).trim() : "";
  const name = String(raw.fullName ?? raw.userName ?? raw.name ?? "").trim();
  const hasNestedRoute = Boolean(raw.route && typeof raw.route === "object");
  const hasDate = Boolean(String(raw.date ?? "").trim());
  const hasRouteType = Boolean(String(raw.routeType ?? "").trim());
  return !id && !name && !hasNestedRoute && !hasDate && !hasRouteType;
}

function invoiceUserDisplayName(user?: ApiInvoiceUser | null): string | undefined {
  if (!user || typeof user !== "object") return undefined;
  const name = String(user.fullName ?? user.userName ?? user.name ?? "").trim();
  return name || undefined;
}

function inferEmployeePickupSource(officeBranch?: InvoiceBranch): Invoice["pickupSource"] {
  const type = String(officeBranch?.type ?? "").trim().toLowerCase();
  if (type === "warehouse") return "warehouse";
  return "office";
}

function resolveInvoiceReceivedBy(item: ApiInvoice): {
  pickupSource?: Invoice["pickupSource"];
  routeId?: string;
  routeName?: string;
  routeCrewId?: string;
  routeCrewName?: string;
  pickupEmployeeId?: string;
  pickupEmployeeName?: string;
} {
  const receivedBy = item.receivedBy;
  const receivedByEmpty = isInvoiceReceivedByEmpty(receivedBy);
  const receivedByIsRoute = !receivedByEmpty && receivedByLooksLikeDailyRoute(receivedBy);
  const receivedByIsEmployee = !receivedByEmpty && !receivedByIsRoute;

  const dailyRoute = receivedByIsRoute
    ? firstInvoiceRouteRef(receivedBy, item.vehicleRoute, item.route)
    : firstInvoiceRouteRef(item.vehicleRoute, item.route);
  const nestedCrew = firstInvoiceRouteRef(
    receivedByIsRoute ? receivedBy?.route : undefined,
    item.routeCrew,
    item.route?.route,
    item.vehicleRoute?.route,
  );

  const legacyEmployee = item.pickupEmployee ?? item.employee;
  const employeeRaw: ApiInvoiceUser | undefined = receivedByIsEmployee
    ? receivedBy
    : receivedByEmpty
      ? legacyEmployee
      : undefined;

  const employeeName = invoiceUserDisplayName(employeeRaw);
  const hasEmployee = Boolean(employeeRaw?.id != null || employeeName);
  const hasDaily = Boolean(dailyRoute.id || nestedCrew.id || dailyRoute.name);

  // Empty receivedBy → use legacy employee for Received by, even if a leftover route is present.
  const pickupSource = receivedByIsRoute
    ? "route"
    : hasEmployee
      ? inferEmployeePickupSource(item.officeBranch)
      : hasDaily
        ? "route"
        : undefined;

  return {
    pickupSource,
    routeId: dailyRoute.id,
    routeName: dailyRoute.name,
    routeCrewId: nestedCrew.id,
    routeCrewName: nestedCrew.name || dailyRoute.name,
    pickupEmployeeId: employeeRaw?.id != null ? String(employeeRaw.id) : undefined,
    pickupEmployeeName: employeeName,
  };
}

function normalizeInvoice(raw: unknown): Invoice | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiInvoice;
  const invoiceId = readStringId(item.id);
  if (!invoiceId) return null;

  const paidRegion = String(item.paidRegion ?? "").trim();
  const lineItems = normalizeInvoiceLineItems(item.invoiceDetails);
  const { cost, discount, amountPaid, balance } = normalizeApiInvoiceMoney(item);
  const receivedBy = resolveInvoiceReceivedBy(item);
  const officeBranchId = item.officeBranch?.id != null ? String(item.officeBranch.id) : undefined;
  const officeBranchName = String(item.officeBranch?.name ?? "").trim();

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
    pickupSource: receivedBy.pickupSource,
    officeBranchId,
    officeBranchName: officeBranchName || undefined,
    pickupEmployeeId: receivedBy.pickupEmployeeId,
    pickupEmployeeName: receivedBy.pickupEmployeeName,
    routeId: receivedBy.routeId,
    routeName: receivedBy.routeName,
    routeCrewId: receivedBy.routeCrewId,
    routeCrewName: receivedBy.routeCrewName,
    sender: normalizeApiInvoiceParty(item.sender),
    receiver: normalizeApiInvoiceReceiver(item),
    lineItems,
    comments: normalizeInvoiceComments(item.comments ?? item.pickup?.comments),
    activity: [],
    payments: [],
    discount,
    amountPaid,
    balance,
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readInvoiceCreatedBy(item.createdBy ?? item.user),
    updatedAt: String(item.updatedAt ?? "").trim(),
    legacySyncedAt: parseLastSyncedAt(item),
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

/**
 * Table column ids like `createdBy` are not valid /invoices/search sort fields.
 * The API only accepts nested paths (`createdBy.name`, `createdBy.id`).
 */
const INVOICE_SORT_FIELD_ALIASES: Record<string, string> = {
  createdBy: "createdBy.name",
  updatedBy: "updatedBy.name",
};

function aliasInvoiceSortField(field: string): string {
  const trimmed = field.trim();
  return INVOICE_SORT_FIELD_ALIASES[trimmed] ?? trimmed;
}

function aliasInvoiceSort(sort?: InvoiceListParams["sort"]): InvoiceListParams["sort"] {
  if (!sort) return sort;

  if (typeof sort === "string") {
    const aliased = sort
      .split(",")
      .map((entry) => {
        const trimmed = entry.trim();
        if (!trimmed) return "";
        const [field, direction] = trimmed.split(":");
        const mapped = aliasInvoiceSortField(field ?? "");
        if (!mapped) return "";
        return direction === "asc" || direction === "desc" ? `${mapped}:${direction}` : mapped;
      })
      .filter(Boolean)
      .join(",");
    return aliased || undefined;
  }

  const entries = Array.isArray(sort) ? sort : [sort];
  return entries.map((entry) => ({
    ...entry,
    field: aliasInvoiceSortField(entry.field),
  }));
}

function resolveInvoicesSort(params: InvoiceListParams): string | undefined {
  return resolveApiListSort(aliasInvoiceSort(params.sort) ?? params.sort);
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

  const sortSpecs = resolveApiSearchSort(
    aliasInvoiceSort(params.sort ?? DEFAULT_INVOICE_LIST_PARAMS.sort),
  );
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

function unwrapInvoiceApiRecord(response: unknown): ApiInvoice {
  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiInvoice>).data
      : response;

  if (!raw || typeof raw !== "object") {
    throw new Error("Invoice not found.");
  }

  return raw as ApiInvoice;
}

export async function fetchInvoiceById(invoiceId: string): Promise<Invoice> {
  const id = parseInvoicePathId(invoiceId);
  const response = await apiClient.get<ApiInvoice | PaginatedApiEnvelope<ApiInvoice>>(
    `${API_ENDPOINTS.INVOICES}/${id}`,
  );

  const invoice = normalizeInvoice(unwrapInvoiceApiRecord(response));
  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  return invoice;
}

export type InvoiceBarcodeLookup = {
  invoiceId: string;
  invoiceNumber: string;
  barcode: InvoiceLineItemBarcode;
};

function findBarcodeOnInvoice(
  invoice: Invoice,
  barcodeNumber: string,
): InvoiceBarcodeLookup | null {
  const needle = barcodeNumber.trim().toUpperCase();
  if (!needle) {
    return null;
  }

  for (const lineItem of invoice.lineItems) {
    for (const barcode of lineItem.barcodes ?? []) {
      if (barcode.number.trim().toUpperCase() === needle) {
        return {
          invoiceId: invoice.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          barcode,
        };
      }
    }
  }

  return null;
}

async function loadInvoiceWithBarcodes(invoice: Invoice): Promise<Invoice> {
  // List payloads often omit nested barcodes even when they exist on the detail.
  try {
    return await fetchInvoiceById(invoice.invoiceId);
  } catch {
    return invoice;
  }
}

/**
 * Locate an invoice-embedded barcode by its printed number.
 *
 * Labels created/managed on invoices often live only under `invoiceDetails`
 * (not `/barcodes`). Nested barcode-number filters are not reliably supported,
 * so Label manager can show a barcode while the scanner catalog lookup misses.
 * Fallback order:
 * 1. Nested search fields (fast path when the API allows them)
 * 2. Invoice text search for the barcode number
 * 3. Walk recent invoices and inspect line-item barcodes (same source as Label manager)
 */
export async function findInvoiceBarcodeByNumber(
  barcodeNumber: string,
): Promise<InvoiceBarcodeLookup | null> {
  const trimmed = barcodeNumber.trim();
  if (!trimmed) return null;

  const candidateFields = [
    "invoiceDetails.barcodes.number",
    "barcodes.number",
    "invoiceDetails.barcode.number",
  ] as const;

  const paginationQuery = buildApiSearchPaginationQuery({
    page: 1,
    limit: 5,
    offset: 0,
  });

  for (const field of candidateFields) {
    try {
      const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
        `${API_ENDPOINTS.INVOICES}/search?${paginationQuery}`,
        buildStripeStyleSearchBody({
          filterGroups: [
            {
              operator: "and",
              filters: [{ field, operator: "eq", value: trimmed }],
            },
          ],
        }),
      );

      const items = Array.isArray(response.data) ? response.data : [];
      for (const entry of items) {
        const summary = normalizeInvoice(entry);
        if (!summary) continue;

        const invoice = await loadInvoiceWithBarcodes(summary);
        const match = findBarcodeOnInvoice(invoice, trimmed);
        if (match) {
          return match;
        }
      }
    } catch {
      // Field not allowed or search failed — try the next candidate.
    }
  }

  try {
    const textSearch = await fetchInvoices({
      page: 1,
      limit: 25,
      search: createInvoiceSearchFilter(trimmed),
    });
    for (const summary of textSearch.items) {
      const invoice = await loadInvoiceWithBarcodes(summary);
      const match = findBarcodeOnInvoice(invoice, trimmed);
      if (match) {
        return match;
      }
    }
  } catch {
    // Fall through to recent-invoice walk.
  }

  const pageLimit = 20;
  const maxPages = 10;
  for (let page = 1; page <= maxPages; page += 1) {
    let list: Awaited<ReturnType<typeof fetchInvoices>>;
    try {
      list = await fetchInvoices({
        page,
        limit: pageLimit,
        sort: DEFAULT_INVOICE_LIST_PARAMS.sort,
      });
    } catch {
      break;
    }

    const detailedInvoices = await Promise.all(
      list.items.map((invoice) => loadInvoiceWithBarcodes(invoice)),
    );
    for (const invoice of detailedInvoices) {
      const match = findBarcodeOnInvoice(invoice, trimmed);
      if (match) {
        return match;
      }
    }

    if (list.items.length < pageLimit || page * pageLimit >= list.total) {
      break;
    }
  }

  return null;
}

/** Raw invoice record from `GET /invoices/{id}` — suitable for round-trip `PUT`. */
export async function fetchInvoiceApiRecord(invoiceId: string): Promise<ApiInvoice> {
  const id = parseInvoicePathId(invoiceId);
  const response = await apiClient.get<ApiInvoice | PaginatedApiEnvelope<ApiInvoice>>(
    `${API_ENDPOINTS.INVOICES}/${id}`,
  );

  return unwrapInvoiceApiRecord(response);
}

export type InvoiceEmbeddedBarcodePatch = {
  /** ObjectID `barcodeId`, or legacy numeric package-sequence id as string. */
  barcodeId: string;
  number: string;
  status: { id: number; name: string };
  container?: { id: number; name: string };
  route?: { id: string; name: string };
};

function listInvoiceDetailBarcodes(detail: ApiInvoiceDetail): ApiInvoiceBarcode[] {
  if (Array.isArray(detail.barcodes) && detail.barcodes.length > 0) {
    return detail.barcodes;
  }
  if (detail.barcode && typeof detail.barcode === "object") {
    return [detail.barcode];
  }
  return [];
}

function barcodeMatchesEmbeddedPatch(
  barcode: ApiInvoiceBarcode,
  patch: Pick<InvoiceEmbeddedBarcodePatch, "barcodeId" | "number">,
): boolean {
  const target = patch.barcodeId.trim();
  const patchNumber = patch.number.trim();

  if (target) {
    if (barcode.barcodeId != null && String(barcode.barcodeId).trim() === target) {
      return true;
    }
    if (barcode.id != null && String(barcode.id).trim() === target) {
      return true;
    }
  }

  // Last resort: human-readable number (print/report identity when ObjectIDs diverge).
  if (patchNumber && String(barcode.number ?? "").trim() === patchNumber) {
    return true;
  }

  return false;
}

/** Update barcodes nested under `invoiceDetails` via `PUT /invoices/{id}`. */
export async function patchInvoiceEmbeddedBarcodes(
  invoiceId: string,
  patches: InvoiceEmbeddedBarcodePatch[],
): Promise<void> {
  if (patches.length === 0) return;

  const invoice = await fetchInvoiceApiRecord(invoiceId);
  const remaining = [...patches];
  let matched = 0;

  for (const detail of invoice.invoiceDetails ?? []) {
    for (const barcode of listInvoiceDetailBarcodes(detail)) {
      const patchIndex = remaining.findIndex((patch) => barcodeMatchesEmbeddedPatch(barcode, patch));
      if (patchIndex < 0) continue;

      const patch = remaining[patchIndex]!;
      barcode.number = patch.number;
      barcode.status = patch.status;
      if (patch.container) {
        barcode.container = patch.container;
      }
      if (patch.route) {
        barcode.route = patch.route;
      }

      matched += 1;
      remaining.splice(patchIndex, 1);
    }
  }

  if (matched !== patches.length) {
    throw new Error("One or more barcodes were not found on the invoice.");
  }

  const id = parseInvoicePathId(invoiceId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVOICES}/${id}`,
    invoice,
  );

  assertMutationSuccess(response, "Unable to update invoice barcodes.");
}

/**
 * Remove nested barcodes from an invoice by ObjectID / package-sequence id,
 * then persist via `PUT /invoices/{id}`.
 */
export async function removeInvoiceEmbeddedBarcodes(
  invoiceId: string,
  barcodeIds: string[],
): Promise<number> {
  const targets = new Set(barcodeIds.map((id) => id.trim()).filter(Boolean));
  if (targets.size === 0) return 0;

  const invoice = await fetchInvoiceApiRecord(invoiceId);
  let removed = 0;

  for (const detail of invoice.invoiceDetails ?? []) {
    const list = listInvoiceDetailBarcodes(detail);
    if (list.length === 0) continue;

    const kept: ApiInvoiceBarcode[] = [];
    for (const barcode of list) {
      const objectId =
        barcode.barcodeId != null && String(barcode.barcodeId).trim()
          ? String(barcode.barcodeId).trim()
          : "";
      const packageId = barcode.id != null ? String(barcode.id).trim() : "";
      const hit =
        (objectId && targets.has(objectId)) ||
        (packageId && targets.has(packageId)) ||
        (barcode.number != null && targets.has(String(barcode.number).trim()));

      if (hit) {
        removed += 1;
        continue;
      }
      kept.push(barcode);
    }

    if (Array.isArray(detail.barcodes)) {
      detail.barcodes = kept;
    }
    if (detail.barcode && !kept.includes(detail.barcode)) {
      detail.barcode = kept[0];
    }
  }

  if (removed === 0) return 0;

  const id = parseInvoicePathId(invoiceId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVOICES}/${id}`,
    invoice,
  );
  assertMutationSuccess(response, "Unable to remove invoice barcodes.");
  return removed;
}

export type InvoiceWriteEmployeeRef = {
  id: number;
  name: string;
  userName?: string;
  fullName?: string;
};

export type InvoiceWriteRouteRef = {
  id: string;
  name: string;
};

export type InvoiceWriteContext = {
  employee?: InvoiceWriteEmployeeRef;
  branch: InvoiceBranch;
  container: {
    id: number;
    name: string;
  };
  incomeStatement?: {
    id: number;
  };
  pickupAssignment?: {
    source: InvoiceFormValues["pickupSource"];
    dailyRoute?: InvoiceWriteRouteRef;
    routeCrew?: InvoiceWriteRouteRef;
    pickupEmployee?: InvoiceWriteEmployeeRef;
    officeBranch?: InvoiceBranch;
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
  address?: ApiAddressPayload;
};

function buildInvoiceCustomerAddress(customer: Customer): ApiAddressPayload | undefined {
  const primary = getCustomerPrimaryCoreAddress(customer);
  return buildApiAddressPayload(primary);
}

type ApiInvoiceDetailWriteRef = {
  id?: string;
  name: string;
  description?: string;
  quantity: number;
  labels: number;
  price: number;
  total: number;
};

type ApiInvoiceRouteWriteRef = {
  id: string;
  name: string;
  route?: { id: string; name: string };
};

type ApiInvoiceReceivedByWrite =
  | InvoiceWriteEmployeeRef
  | (InvoiceWriteRouteRef & { route?: InvoiceWriteRouteRef });

type ApiInvoiceWritePayload = {
  number: string;
  date: string;
  incomeStatement?: { id: number };
  branch: ReturnType<typeof buildApiBranchDto>;
  cost: number;
  payment: number;
  balance: number;
  discount: number;
  surcharge: number;
  paidRegion: string;
  paidStatus: string;
  employee?: InvoiceWriteEmployeeRef | null;
  receivedBy?: ApiInvoiceReceivedByWrite | null;
  container: InvoiceWriteContext["container"];
  sender: ApiInvoiceCustomerWriteRef;
  receiver?: ApiInvoiceCustomerWriteRef;
  pickup?: { id: string | number };
  route?: ApiInvoiceRouteWriteRef | null;
  routeCrew?: InvoiceWriteRouteRef | null;
  pickupEmployee?: InvoiceWriteEmployeeRef | null;
  officeBranch?: ReturnType<typeof buildApiBranchDto> | null;
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
  const address = buildInvoiceCustomerAddress(customer);
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

function buildInvoiceEmployeeWriteRef(employee: InvoiceWriteEmployeeRef): InvoiceWriteEmployeeRef {
  return {
    id: employee.id,
    name: employee.name.trim() || DEFAULT_CREATED_BY,
    ...(employee.userName?.trim() ? { userName: employee.userName.trim() } : {}),
    ...(employee.fullName?.trim() ? { fullName: employee.fullName.trim() } : {}),
  };
}

function applyInvoicePickupAssignment(
  payload: ApiInvoiceWritePayload,
  assignment: InvoiceWriteContext["pickupAssignment"],
  isUpdate: boolean,
) {
  if (!assignment) return;

  if (assignment.source === "route") {
    const dailyRoute = assignment.dailyRoute;
    const routeCrew = assignment.routeCrew;
    const dailyRouteRef = dailyRoute
      ? {
          id: dailyRoute.id,
          name: dailyRoute.name.trim() || routeCrew?.name.trim() || dailyRoute.id,
          ...(routeCrew
            ? { route: { id: routeCrew.id, name: routeCrew.name.trim() || routeCrew.id } }
            : {}),
        }
      : null;

    payload.receivedBy = dailyRouteRef;
    payload.route = dailyRouteRef;
    payload.routeCrew = routeCrew
      ? { id: routeCrew.id, name: routeCrew.name.trim() || routeCrew.id }
      : isUpdate
        ? null
        : undefined;

    if (isUpdate) {
      payload.employee = null;
      payload.pickupEmployee = null;
      payload.officeBranch = null;
    }
    return;
  }

  const employee = assignment.pickupEmployee
    ? buildInvoiceEmployeeWriteRef(assignment.pickupEmployee)
    : null;
  payload.receivedBy = employee;
  payload.employee = employee;
  payload.pickupEmployee = employee;
  payload.officeBranch = assignment.officeBranch
    ? buildApiBranchDto(assignment.officeBranch)
    : isUpdate
      ? null
      : undefined;

  if (isUpdate) {
    payload.route = null;
    payload.routeCrew = null;
  }
}

function deriveInvoicePaidStatus(cost: number, discount: number, payment: number, balance: number): string {
  if (payment <= 0) return "UNPAID";
  if (balance <= 0 || payment >= Math.max(0, cost - discount)) return "PAID";
  return "PARTIAL";
}

function buildInvoiceWritePayload(
  values: InvoiceFormValues,
  context: InvoiceWriteContext,
  options: { isUpdate?: boolean; requireIncomeStatement?: boolean } = {},
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

  const incomeStatementId = context.incomeStatement?.id ?? 0;
  if (options.requireIncomeStatement && (!Number.isInteger(incomeStatementId) || incomeStatementId <= 0)) {
    throw new Error("A Daily Income statement is required.");
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

  const balance = computeInvoiceBalance(cost, discount, payment);
  if (balance < 0) {
    throw new Error("Balance cannot be negative.");
  }

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
    container: {
      id: context.container.id,
      name: context.container.name.trim() || String(context.container.id),
    },
    sender: buildInvoiceCustomerWriteRef(values.sender, CUSTOMER_TYPE_SENDER),
    invoiceDetails,
  };

  if (context.employee) {
    payload.employee = buildInvoiceEmployeeWriteRef(context.employee);
  }

  applyInvoicePickupAssignment(payload, context.pickupAssignment, Boolean(options.isUpdate));

  if (incomeStatementId > 0) {
    payload.incomeStatement = { id: incomeStatementId };
  }

  if (values.receiver) {
    payload.receiver = buildInvoiceCustomerWriteRef(values.receiver, CUSTOMER_TYPE_RECEIVER);
  }

  if (options.isUpdate) {
    const pickupId = values.pickupId.trim();
    if (pickupId) {
      payload.pickup = { id: pickupId };
    }
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
    // Income statement (Cuadre) is optional: skip when none is open, or link an open one.
    buildInvoiceWritePayload(values, context, { requireIncomeStatement: false }),
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

function normalizeLegacyInvoiceSyncSummary(raw: unknown): LegacyInvoiceSyncSummary {
  if (!raw || typeof raw !== "object") {
    return { imported: 0, updated: 0, skipped: 0, total: 0, processed: 0, start: 0, nextStart: 0, limit: 0 };
  }

  const item = raw as Record<string, unknown>;

  return {
    imported: Number(item.imported ?? 0),
    updated: Number(item.updated ?? 0),
    skipped: Number(item.skipped ?? 0),
    total: Number(item.total ?? 0),
    processed: Number(item.processed ?? 0),
    start: Number(item.start ?? 0),
    nextStart: Number(item.nextStart ?? 0),
    limit: Number(item.limit ?? 0),
    lastSyncedAt: parseLastSyncedAt(raw),
  };
}

function normalizeLegacyInvoiceSyncPreview(raw: unknown): LegacyInvoiceSyncPreview {
  if (!raw || typeof raw !== "object") {
    return { total: 0 };
  }

  const item = raw as Record<string, unknown>;
  return { total: Number(item.total ?? 0), lastSyncedAt: parseLastSyncedAt(raw) };
}

export async function previewLegacyInvoiceSync(): Promise<LegacyInvoiceSyncPreview> {
  const response = await axiosInstance.get<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVOICES}/legacy-sync/preview`,
    { useDirectApi: true },
  );

  assertMutationSuccess(response.data, "Unable to preview legacy invoice sync.");

  return normalizeLegacyInvoiceSyncPreview(response.data.data);
}

export async function syncLegacyInvoices(
  request: LegacyInvoiceSyncRequest = {},
): Promise<LegacyInvoiceSyncResult> {
  const params = new URLSearchParams();
  if (request.start != null) params.set("start", String(request.start));
  if (request.limit != null) params.set("limit", String(request.limit));
  const query = params.toString();
  const response = await axiosInstance.post<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVOICES}/legacy-sync${query ? `?${query}` : ""}`,
    undefined,
    { useDirectApi: true },
  );

  assertMutationSuccess(response.data, "Unable to sync legacy invoices.");

  return {
    message: response.data.message?.trim() || "Legacy invoices synced.",
    summary: normalizeLegacyInvoiceSyncSummary(response.data.data),
  };
}
