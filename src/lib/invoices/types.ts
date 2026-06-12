import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { INVOICE_TABLE_FILTER_FIELDS } from "@/lib/invoices/filter-fields";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";
import {
  createEmptyOrderParty,
  normalizeOrderParty,
  orderPartyToFormValues,
  todayDateInputValue,
  type OrderParty,
  type OrderPartyFormValues,
} from "@/lib/orders/types";

export type InvoicePaymentLocation = "usa" | "dr";

export type InvoiceLineItem = {
  id: string;
  itemId?: string;
  itemName: string;
  quantity: number;
  labelCount: number;
  unitPrice: number;
  lineTotal: number;
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
  oldID?: number;
  date: string;
  containerId: string;
  containerName?: string;
  paymentLocation: InvoicePaymentLocation;
  paidRegion?: string;
  paidStatus?: string;
  cost?: number;
  branch?: InvoiceBranch;
  sender: OrderParty;
  receiver: OrderParty;
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
};

export type InvoiceFormValues = {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  containerId: string;
  paymentLocation: InvoicePaymentLocation;
  sender: OrderPartyFormValues;
  receiver: OrderPartyFormValues;
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

/** GET /invoices?page=1&limit=40&offset=0&sort=number:desc */
export const DEFAULT_INVOICE_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "number:desc",
} as const satisfies Pick<InvoiceListParams, "page" | "limit" | "sort">;

export function getInvoiceRecordId(invoice: Pick<Invoice, "invoiceId">): string {
  return invoice.invoiceId;
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
}): InvoiceListParams {
  const params: InvoiceListParams = {
    ...DEFAULT_INVOICE_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_INVOICE_LIST_PARAMS.limit,
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
    labelCount: "0",
    unitPrice: "",
  };
}

export function createEmptyInvoiceForm(createdBy = DEFAULT_CREATED_BY): InvoiceFormValues {
  return {
    invoiceId: createInvoiceId(),
    invoiceNumber: "",
    date: todayDateInputValue(),
    containerId: "",
    paymentLocation: "usa",
    sender: createEmptyOrderParty(),
    receiver: createEmptyOrderParty(),
    lineItems: [createEmptyInvoiceLineItem()],
    discount: "0",
    amountPaid: "0",
    createdBy,
  };
}

export type InvoiceFormSubmitResult = {
  error: string | null;
  nextInvoiceNumber?: string;
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

function normalizeLineItem(values: InvoiceLineItemFormValues, index: number): InvoiceLineItem {
  const quantity = Number(values.quantity);
  const labelCount = Number(values.labelCount);
  const unitPrice = Number(values.unitPrice);

  if (!values.itemName.trim()) {
    throw new Error(`Line item ${index + 1}: item name is required.`);
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
    lineTotal: computeLineTotal(quantity, unitPrice),
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
  };
}

export function invoiceToFormValues(invoice: Invoice): InvoiceFormValues {
  return {
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date.slice(0, 10),
    containerId: invoice.containerId,
    paymentLocation: invoice.paymentLocation,
    sender: orderPartyToFormValues(invoice.sender),
    receiver: orderPartyToFormValues(invoice.receiver),
    lineItems: invoice.lineItems.length > 0 ? invoice.lineItems.map(invoiceLineItemToFormValues) : [createEmptyInvoiceLineItem()],
    discount: invoice.discount.toFixed(2),
    amountPaid: invoice.amountPaid.toFixed(2),
    createdBy: invoice.createdBy,
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

  const sender = normalizeOrderParty(values.sender, "Sender");
  const receiver = normalizeOrderParty(values.receiver, "Receiver");

  return {
    invoiceId: values.invoiceId,
    invoiceNumber: values.invoiceNumber.trim(),
    date: values.date,
    containerId: values.containerId,
    paymentLocation: values.paymentLocation,
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
