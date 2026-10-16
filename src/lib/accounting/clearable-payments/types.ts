import type { ApiTableRecord } from "@/lib/table/api-table-fields";
import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { parseMoneyFormInput } from "@/lib/accounting/daily-income/money-input";

export type ClearablePaymentStatus = "OUTSTANDING" | "CLEARED";

export type ClearablePaymentInvoiceRef = {
  id: string;
  number: string;
  cost?: number;
  discount?: number;
  payment?: number;
  balance?: number;
};

export type ClearablePayment = ApiTableRecord & {
  id: string;
  status: ClearablePaymentStatus;
  /** External payment reference (Zelle / deposit / card). Keep as string. */
  paymentReference: string;
  /** Internal transaction reference. */
  refNumber: string;
  paymentAmount: number;
  datePosted: string;
  clearedAt: string;
  invoice: ClearablePaymentInvoiceRef;
  journalId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type ClearablePaymentFormValues = {
  invoiceId: string;
  invoiceNumber: string;
  paymentReference: string;
  paymentAmount: string;
  refNumber: string;
  datePosted: string;
  status: ClearablePaymentStatus;
  clearedAt: string;
};

export type ClearablePaymentSearchFilter = ApiListTextSearch;

export type ClearablePaymentListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: ClearablePaymentSearchFilter;
};

export const DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "createdAt:desc",
} as const satisfies Pick<ClearablePaymentListParams, "page" | "limit" | "sort">;

export function todayClearablePaymentDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyClearablePaymentForm(): ClearablePaymentFormValues {
  return {
    invoiceId: "",
    invoiceNumber: "",
    paymentReference: "",
    paymentAmount: "",
    refNumber: "",
    datePosted: todayClearablePaymentDateInputValue(),
    status: "OUTSTANDING",
    clearedAt: "",
  };
}

export function clearablePaymentStatusI18nKey(
  status: ClearablePaymentStatus,
): "outstanding" | "cleared" {
  return status === "CLEARED" ? "cleared" : "outstanding";
}

export function clearablePaymentToFormValues(payment: ClearablePayment): ClearablePaymentFormValues {
  return {
    invoiceId: payment.invoice.id,
    invoiceNumber: payment.invoice.number,
    paymentReference: payment.paymentReference,
    paymentAmount: Number.isFinite(payment.paymentAmount) ? String(payment.paymentAmount) : "",
    refNumber: payment.refNumber,
    datePosted: payment.datePosted.slice(0, 10),
    status: payment.status,
    clearedAt: payment.clearedAt.slice(0, 10),
  };
}

export function areClearablePaymentFormValuesEquivalent(
  left: ClearablePaymentFormValues,
  right: ClearablePaymentFormValues,
): boolean {
  return areFormValuesEquivalent(left, right);
}

export function parseClearablePaymentAmount(value: string): number | null {
  const amount = parseMoneyFormInput(value);
  if (amount == null || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function createClearablePaymentSearchFilter(value: string): ClearablePaymentSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildClearablePaymentListParams(input: {
  page: number;
  limit?: number;
  query: string;
  sort?: ApiListSortInput;
}): ClearablePaymentListParams {
  const params: ClearablePaymentListParams = {
    ...DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS.sort,
  };

  const search = createClearablePaymentSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  return params;
}
