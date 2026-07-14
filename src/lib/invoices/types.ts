import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { INVOICE_TABLE_FILTER_FIELDS } from "@/lib/invoices/filter-fields";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import {
  createRecordId,
  getCustomerAddresses,
  getCustomerPhones,
  type Customer,
} from "@/lib/customers/types";
import {
  todayDateInputValue,
  type OrderParty,
} from "@/lib/orders/types";

export type InvoicePaymentLocation = "usa" | "dr";

/** Where the pickup was handled: on a route, or by an employee at a warehouse or office. */
export type InvoicePickupSource = "route" | "warehouse" | "office";

export const INVOICE_PICKUP_SOURCES = [
  { value: "route" as const, labelKey: "invoices.form.fields.pickupSourceRoute" },
  { value: "warehouse" as const, labelKey: "invoices.form.fields.pickupSourceWarehouse" },
  { value: "office" as const, labelKey: "invoices.form.fields.pickupSourceOffice" },
] as const;

/** Warehouse and office pickups are attributed to an employee instead of a route. */
export function isInvoiceEmployeePickupSource(source: InvoicePickupSource): boolean {
  return source === "warehouse" || source === "office";
}

/** @deprecated Use InvoicePickupSource */
export type InvoiceRouteSource = InvoicePickupSource;

/** @deprecated Use INVOICE_PICKUP_SOURCES */
export const INVOICE_ROUTE_SOURCES = INVOICE_PICKUP_SOURCES;

/** @deprecated Use isInvoiceEmployeePickupSource */
export function isInvoiceDropoffSource(source: InvoicePickupSource): boolean {
  return isInvoiceEmployeePickupSource(source);
}

export type InvoiceLineItemBarcode = {
  id: string;
  /** Canonical `/barcodes` id when the API exposes it separately from the embedded record id. */
  barcodeId?: string;
  number: string;
  statusId?: number;
  statusName?: string;
  containerId?: string;
  containerName?: string;
  deliveryId?: string;
  deliveryName?: string;
  scanDate?: string;
};

export type InvoiceLineItem = {
  id: string;
  /** Real backend invoice-detail id when loaded from the API. */
  apiId?: string;
  itemId?: string;
  itemName: string;
  description?: string;
  quantity: number;
  labelCount: number;
  unitPrice: number;
  lineTotal: number;
  /** Real barcodes attached to this line item from the API. */
  barcodes?: InvoiceLineItemBarcode[];
};

export type InvoiceComment = {
  id: string;
  description: string;
  createdAt: string;
  createdBy: string;
};

export type InvoiceActivityAction =
  | "created"
  | "updated"
  | "payment"
  | "discount_change"
  | "comment_added";

export type InvoiceActivityEntry = {
  id: string;
  invoiceId: string;
  action: InvoiceActivityAction;
  message: string;
  timestamp: string;
  performedBy: string;
  success: boolean;
};

export type InvoicePaymentMethod =
  | "cash"
  | "check"
  | "credit_card"
  | "debit_card"
  | "wire_transfer"
  | "zelle"
  | "ach"
  | "other";

export type InvoicePayment = {
  id: string;
  invoiceId: string;
  description: string;
  amount: number;
  paymentMethod: InvoicePaymentMethod;
  referenceNumber: string;
  createdAt: string;
  createdBy: string;
};

export type InvoicePaymentInput = {
  description: string;
  amount: number;
  paymentMethod: InvoicePaymentMethod;
  referenceNumber: string;
};

export type Invoice = {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  /** Linked pickup/order id from the pickups (orders) table. */
  pickupId?: string;
  containerId: string;
  containerName?: string;
  paymentLocation: InvoicePaymentLocation;
  /** Linked scheduled pickup route id (`vehicle-routes` with `routeType: pickup`). */
  routeId?: string;
  routeName?: string;
  /** Warehouse/office branch when the pickup was created in-house instead of on a route. */
  officeBranchId?: string;
  officeBranchName?: string;
  /** Employee who created the pickup when `officeBranchId` is set. */
  pickupEmployeeId?: string;
  pickupEmployeeName?: string;
  pickupSource?: InvoicePickupSource;
  paidRegion?: string;
  paidStatus?: string;
  cost?: number;
  branch?: InvoiceBranch;
  sender: OrderParty;
  receiver: OrderParty | null;
  lineItems: InvoiceLineItem[];
  comments: InvoiceComment[];
  activity: InvoiceActivityEntry[];
  payments: InvoicePayment[];
  discount: number;
  amountPaid: number;
  balance?: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type InvoiceBranch = {
  id: number;
  name: string;
  code: string;
};

export type InvoiceLineItemFormValues = {
  id: string;
  itemId: string;
  itemName: string;
  quantity: string;
  labelCount: string;
  unitPrice: string;
  lineTotal: string;
  /** Labels default to the quantity until the user edits them directly. */
  labelsManual: boolean;
  /** Total defaults to unit price × quantity until the user edits it directly. */
  totalManual: boolean;
};

export type InvoiceFormValues = {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  pickupId: string;
  containerId: string;
  paymentLocation: InvoicePaymentLocation;
  pickupSource: InvoicePickupSource;
  routeId: string;
  officeBranchId: string;
  officeBranchName: string;
  pickupEmployeeId: string;
  pickupEmployeeName: string;
  senderId: string;
  sender: Customer | null;
  receiverId: string;
  receiver: Customer | null;
  lineItems: InvoiceLineItemFormValues[];
  discount: string;
  amountPaid: string;
  createdBy: string;
};

export type InvoiceFilterState = {
  query: string;
  rows: TableFilterRowState[];
  paymentLocation: InvoicePaymentLocation | "all";
};

export type InvoiceSearchFilter = ApiListTextSearch;

export type InvoiceListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: InvoiceSearchFilter;
  filterRows?: TableFilterRowState[];
  paymentLocation?: InvoicePaymentLocation | "all";
};

/** GET /invoices?page=1&limit=50&offset=0&sort=number:desc */
export const DEFAULT_INVOICE_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "number:desc",
} as const satisfies Pick<InvoiceListParams, "page" | "limit" | "sort">;

export function getInvoiceRecordId(invoice: Pick<Invoice, "invoiceId">): string {
  return invoice.invoiceId;
}

export function getInvoicePrimaryReceiver(
  invoice: Pick<Invoice, "receiver">,
): OrderParty | undefined {
  return invoice.receiver ?? undefined;
}

export function getInvoicePrimaryReceiverName(invoice: Pick<Invoice, "receiver">): string {
  return invoice.receiver?.name?.trim() || "—";
}

export function createInvoiceSearchFilter(value: string): InvoiceSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildInvoiceListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  paymentLocation: InvoiceFilterState["paymentLocation"];
  sort?: ApiListSortInput;
}): InvoiceListParams {
  const params: InvoiceListParams = {
    ...DEFAULT_INVOICE_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_INVOICE_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_INVOICE_LIST_PARAMS.sort,
  };

  const search = createInvoiceSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter((row) =>
    isCompleteFilterRow(row, INVOICE_TABLE_FILTER_FIELDS),
  );
  if (completeRows.length > 0) {
    params.filterRows = completeRows;
  }

  if (input.paymentLocation !== "all") {
    params.paymentLocation = input.paymentLocation;
  }

  return params;
}

export function mapPaidRegionToPaymentLocation(paidRegion: string): InvoicePaymentLocation {
  const normalized = paidRegion.trim().toLowerCase();
  if (normalized === "rd" || normalized === "dr" || normalized === "do") {
    return "dr";
  }
  return "usa";
}

export function mapPaymentLocationToPaidRegion(location: InvoicePaymentLocation): string {
  return location === "dr" ? "RD" : "NY";
}

export function getInvoiceTotal(invoice: Invoice): number {
  if (invoice.lineItems.length > 0) {
    return computeInvoiceSubtotal(invoice.lineItems);
  }
  return Number(invoice.cost ?? 0);
}

function readApiMoney(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return undefined;
  return Math.round(amount * 100) / 100;
}

/** Maps EMSYS list/detail money fields (`payment` vs `balance`) into portal totals. */
export function normalizeApiInvoiceMoney(input: {
  cost?: unknown;
  discount?: unknown;
  payment?: unknown;
  balance?: unknown;
}): { cost: number; discount: number; amountPaid: number; balance: number } {
  const cost = readApiMoney(input.cost) ?? 0;
  const discount = readApiMoney(input.discount) ?? 0;
  const payment = readApiMoney(input.payment);
  const apiBalance = readApiMoney(input.balance);

  if (payment != null && apiBalance != null) {
    return {
      cost,
      discount,
      amountPaid: payment,
      balance: Math.max(0, apiBalance),
    };
  }

  if (payment != null) {
    return {
      cost,
      discount,
      amountPaid: payment,
      balance: Math.max(0, computeInvoiceBalance(cost, discount, payment)),
    };
  }

  if (apiBalance != null) {
    const balance = Math.max(0, apiBalance);
    const amountPaid = Math.max(0, Math.round((cost - discount - balance) * 100) / 100);
    return { cost, discount, amountPaid, balance };
  }

  const balance = Math.max(0, computeInvoiceBalance(cost, discount, 0));
  return { cost, discount, amountPaid: 0, balance };
}

export function getInvoiceBalanceAmount(invoice: Invoice): number {
  if (invoice.balance != null && Number.isFinite(invoice.balance)) {
    return Math.max(0, Math.round(invoice.balance * 100) / 100);
  }
  return Math.max(0, computeInvoiceBalance(getInvoiceTotal(invoice), invoice.discount, invoice.amountPaid));
}

export const INVOICE_PAYMENT_LOCATIONS: { value: InvoicePaymentLocation; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

export const INVOICE_PAYMENT_METHODS: { value: InvoicePaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "wire_transfer", label: "Wire transfer" },
  { value: "zelle", label: "Zelle" },
  { value: "ach", label: "ACH" },
  { value: "other", label: "Other" },
];

export function createInvoiceId(): string {
  return createRecordId();
}

export function createInvoiceComment(description: string, createdBy = DEFAULT_CREATED_BY): InvoiceComment {
  return {
    id: createRecordId(),
    description: description.trim(),
    createdAt: new Date().toISOString(),
    createdBy: createdBy.trim() || DEFAULT_CREATED_BY,
  };
}

export function computeTotalPayments(payments: InvoicePayment[]): number {
  return Math.round(payments.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100;
}

export function createInvoicePayment(
  invoiceId: string,
  input: InvoicePaymentInput,
  createdBy = DEFAULT_CREATED_BY
): InvoicePayment {
  if (!input.description.trim()) {
    throw new Error("Payment description is required.");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  return {
    id: createRecordId(),
    invoiceId,
    description: input.description.trim(),
    amount: Math.round(input.amount * 100) / 100,
    paymentMethod: input.paymentMethod,
    referenceNumber: input.referenceNumber.trim(),
    createdAt: new Date().toISOString(),
    createdBy: createdBy.trim() || DEFAULT_CREATED_BY,
  };
}

export function createEmptyInvoiceLineItem(): InvoiceLineItemFormValues {
  return {
    id: createRecordId(),
    itemId: "",
    itemName: "",
    quantity: "1",
    labelCount: "1",
    unitPrice: "",
    lineTotal: "",
    labelsManual: false,
    totalManual: false,
  };
}

export function createEmptyInvoiceForm(createdBy = DEFAULT_CREATED_BY): InvoiceFormValues {
  return {
    invoiceId: createInvoiceId(),
    invoiceNumber: "",
    date: todayDateInputValue(),
    pickupId: "",
    containerId: "",
    paymentLocation: "usa",
    pickupSource: "route",
    routeId: "",
    officeBranchId: "",
    officeBranchName: "",
    pickupEmployeeId: "",
    pickupEmployeeName: "",
    senderId: "",
    sender: null,
    receiverId: "",
    receiver: null,
    lineItems: [createEmptyInvoiceLineItem()],
    discount: "0",
    amountPaid: "0",
    createdBy,
  };
}

export type InvoiceFormSubmitResult = {
  error: string | null;
  nextInvoiceNumber?: string;
  savedInvoiceId?: string;
};

export function resetInvoiceFormForNextEntry(
  previous: InvoiceFormValues,
  nextInvoiceNumber = ""
): InvoiceFormValues {
  const empty = createEmptyInvoiceForm(previous.createdBy);

  return {
    ...empty,
    date: previous.date,
    containerId: previous.containerId,
    paymentLocation: previous.paymentLocation,
    pickupSource: previous.pickupSource,
    routeId: previous.routeId,
    officeBranchId: previous.officeBranchId,
    officeBranchName: previous.officeBranchName,
    pickupEmployeeId: previous.pickupEmployeeId,
    pickupEmployeeName: previous.pickupEmployeeName,
    invoiceNumber: nextInvoiceNumber,
  };
}

export function computeLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function computeInvoiceSubtotal(lineItems: InvoiceLineItem[]): number {
  return Math.round(lineItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
}

export function computeInvoiceBalance(subtotal: number, discount: number, amountPaid: number): number {
  return Math.round((subtotal - discount - amountPaid) * 100) / 100;
}

/** Total defaults to unit price × quantity but can be overridden directly. */
export function resolveLineTotal(values: InvoiceLineItemFormValues): number {
  const quantity = Number(values.quantity);
  const unitPrice = Number(values.unitPrice);
  const parsedTotal = Number(values.lineTotal);

  if (values.totalManual && values.lineTotal.trim() !== "" && Number.isFinite(parsedTotal)) {
    return Math.round(parsedTotal * 100) / 100;
  }

  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return computeLineTotal(quantity, unitPrice);
}

/** Whether a line item row has enough data to count toward invoice validation. */
export function hasInvoiceLineItemContent(values: InvoiceLineItemFormValues): boolean {
  return Boolean(values.itemName.trim() || values.itemId || resolveLineTotal(values) > 0);
}

/** Labels default to the quantity but can be overridden directly. */
export function resolveLineLabelCount(values: InvoiceLineItemFormValues): number {
  const quantity = Number(values.quantity);
  const parsedLabels = Number(values.labelCount);

  if (values.labelsManual && values.labelCount.trim() !== "" && Number.isFinite(parsedLabels)) {
    return parsedLabels;
  }

  return Number.isFinite(quantity) ? quantity : 0;
}

function normalizeLineItem(values: InvoiceLineItemFormValues, index: number): InvoiceLineItem {
  const quantity = Number(values.quantity);
  const labelCount = resolveLineLabelCount(values);
  const unitPrice = Number(values.unitPrice);

  if (!values.itemName.trim()) {
    throw new Error(`Line item ${index + 1}: description is required.`);
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Line item ${index + 1}: quantity must be greater than 0.`);
  }

  if (!Number.isFinite(labelCount) || labelCount < 0) {
    throw new Error(`Line item ${index + 1}: label count must be 0 or greater.`);
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error(`Line item ${index + 1}: unit price must be 0 or greater.`);
  }

  return {
    id: values.id,
    itemId: values.itemId.trim() || undefined,
    itemName: values.itemName.trim(),
    quantity,
    labelCount,
    unitPrice,
    lineTotal: resolveLineTotal(values),
  };
}

export function invoiceLineItemToFormValues(item: InvoiceLineItem): InvoiceLineItemFormValues {
  return {
    id: item.id,
    itemId: item.itemId ?? "",
    itemName: item.itemName,
    quantity: String(item.quantity),
    labelCount: String(item.labelCount),
    unitPrice: item.unitPrice.toFixed(2),
    lineTotal: item.lineTotal.toFixed(2),
    labelsManual: true,
    totalManual: true,
  };
}

function orderPartyToInvoiceFormCustomer(party: OrderParty): Customer | null {
  if (!party.name.trim() && !party.clientId && !party.id) return null;

  const primaryAddressId = party.orderAddressId;
  const addresses = party.addresses
    .filter((address) =>
      [
        address.streetAddress,
        address.apt,
        address.crossStreet,
        address.city,
        address.state,
        address.zipCode,
        address.provinceCountry,
      ].some((value) => String(value ?? "").trim()),
    )
    .map((address) => ({
      address1: address.streetAddress.trim(),
      address2: address.crossStreet?.trim() ?? "",
      apartment: address.apt?.trim() ?? "",
      city: address.city.trim(),
      state: address.state?.trim() ?? "",
      zipcode: address.zipCode?.trim() ?? "",
      country: address.provinceCountry?.trim() ?? "",
      location: null,
      verification: null,
      isPrimary: address.id === primaryAddressId || address.isPrimary,
    }));

  const resolvedAddresses =
    addresses.length > 0
      ? addresses.map((entry, index) => ({
          ...entry,
          isPrimary: addresses.some((item) => item.isPrimary)
            ? entry.isPrimary
            : index === 0,
        }))
      : [];

  return {
    id: party.clientId ?? party.id,
    oldID: null,
    name: party.name.trim() || "—",
    customerType: null,
    phones: party.phones.map((phone, index) => ({
      type: "mobile",
      number: phone.number,
      displayNumber: phone.displayNumber ?? phone.number,
      isPrimary: index === 0,
    })),
    email: party.email?.trim() ?? "",
    active: true,
    IDNumber: party.documentId?.trim() ?? "",
    createdAt: "",
    updatedAt: "",
    notes: "",
    accountBalance: 0,
    branch: { id: 0, name: "", code: "" },
    createdBy: null,
    updatedBy: null,
    addresses: resolvedAddresses,
    receivers: [],
  };
}

function normalizeInvoicePickupSource(
  source: InvoicePickupSource | string | undefined,
  officeBranchId?: string,
): InvoicePickupSource {
  if (source === "route" || source === "warehouse" || source === "office") {
    return source;
  }

  if (source === "route-pickup" || source === "pickup-route") return "route";
  if (source === "warehouse-dropoff") return "warehouse";
  if (source === "office-dropoff" || source === "office") return "office";

  return officeBranchId ? "office" : "route";
}

export function invoiceToFormValues(invoice: Invoice): InvoiceFormValues {
  const sender = orderPartyToInvoiceFormCustomer(invoice.sender);
  const receiver = invoice.receiver ? orderPartyToInvoiceFormCustomer(invoice.receiver) : null;

  return {
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date.slice(0, 10),
    pickupId: invoice.pickupId ?? "",
    containerId: invoice.containerId,
    paymentLocation: invoice.paymentLocation,
    pickupSource: normalizeInvoicePickupSource(invoice.pickupSource, invoice.officeBranchId),
    routeId: invoice.routeId ?? "",
    officeBranchId: invoice.officeBranchId ?? "",
    officeBranchName: invoice.officeBranchName ?? "",
    pickupEmployeeId: invoice.pickupEmployeeId ?? "",
    pickupEmployeeName: invoice.pickupEmployeeName ?? "",
    senderId: invoice.sender.clientId ?? sender?.id ?? "",
    sender,
    receiverId: invoice.receiver?.clientId ?? receiver?.id ?? "",
    receiver,
    lineItems:
      invoice.lineItems.length > 0
        ? invoice.lineItems.map(invoiceLineItemToFormValues)
        : [createEmptyInvoiceLineItem()],
    discount: invoice.discount.toFixed(2),
    amountPaid: invoice.amountPaid.toFixed(2),
    createdBy: invoice.createdBy,
  };
}

/** Build an invoice party snapshot from a selected customer record. */
export function customerToInvoiceParty(customer: Customer): OrderParty {
  const addresses = getCustomerAddresses(customer);
  const primaryAddress = addresses.find((address) => address.isPrimary) ?? addresses[0];

  return {
    id: createRecordId(),
    clientId: customer.id,
    name: customer.name.trim(),
    documentId: customer.IDNumber.trim() || undefined,
    email: customer.email.trim() || undefined,
    phones: getCustomerPhones(customer),
    addresses,
    orderAddressId: primaryAddress?.id ?? "",
  };
}

export function formValuesToInvoice(
  values: InvoiceFormValues,
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string,
  comments: InvoiceComment[] = [],
  activity: InvoiceActivityEntry[] = [],
  payments: InvoicePayment[] = []
): Invoice {
  if (!values.invoiceNumber.trim()) {
    throw new Error("Invoice number is required.");
  }

  if (!values.containerId) {
    throw new Error("A container is required.");
  }

  if (!values.sender) {
    throw new Error("Sender is required.");
  }

  const lineItems = values.lineItems
    .filter((item) => item.itemName.trim() || item.itemId)
    .map((item, index) => normalizeLineItem(item, index));

  if (lineItems.length === 0) {
    throw new Error("At least one line item is required.");
  }

  const discount = Number(values.discount);
  const amountPaid = computeTotalPayments(payments);

  if (!Number.isFinite(discount) || discount < 0) {
    throw new Error("Discount must be 0 or greater.");
  }

  const sender = customerToInvoiceParty(values.sender);
  const receiver = values.receiver ? customerToInvoiceParty(values.receiver) : null;

  return {
    invoiceId: values.invoiceId,
    invoiceNumber: values.invoiceNumber.trim(),
    date: values.date,
    pickupId: values.pickupId.trim() || undefined,
    containerId: values.containerId,
    paymentLocation: values.paymentLocation,
    pickupSource: values.pickupSource,
    routeId: values.pickupSource === "route" ? values.routeId.trim() || undefined : undefined,
    officeBranchId: isInvoiceEmployeePickupSource(values.pickupSource) ? values.officeBranchId.trim() || undefined : undefined,
    officeBranchName: isInvoiceEmployeePickupSource(values.pickupSource) ? values.officeBranchName.trim() || undefined : undefined,
    pickupEmployeeId: isInvoiceEmployeePickupSource(values.pickupSource) ? values.pickupEmployeeId.trim() || undefined : undefined,
    pickupEmployeeName: isInvoiceEmployeePickupSource(values.pickupSource) ? values.pickupEmployeeName.trim() || undefined : undefined,
    sender,
    receiver,
    lineItems,
    comments: comments.map((comment) => ({ ...comment })),
    activity: activity.map((entry) => ({ ...entry })),
    payments: payments.map((payment) => ({ ...payment })),
    discount,
    amountPaid,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}

export function suggestNextInvoiceNumber(existing: Invoice[], date = new Date()): string {
  const year = date.getFullYear();
  const prefix = `INV-${year}-`;
  const sequences = existing
    .map((invoice) => invoice.invoiceNumber)
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number.parseInt(number.slice(prefix.length), 10))
    .filter((value) => Number.isFinite(value));

  const next = (sequences.length > 0 ? Math.max(...sequences) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export { getOrderPartyAddress } from "@/lib/orders/types";
