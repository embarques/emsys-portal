import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { parseMoneyFormInput } from "@/lib/accounting/daily-income/money-input";

export type CheckStatus = "OUTSTANDING" | "CLEARED";

export type CheckInvoiceRef = {
  id: string;
  number: string;
  cost?: number;
  discount?: number;
  payment?: number;
  balance?: number;
};

export type Check = {
  id: string;
  status: CheckStatus;
  checkNumber: string;
  refNumber: string;
  paymentAmount: number;
  datePosted: string;
  clearedAt: string;
  invoice: CheckInvoiceRef;
  journalId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type CheckFormValues = {
  invoiceId: string;
  invoiceNumber: string;
  checkNumber: string;
  paymentAmount: string;
  refNumber: string;
  datePosted: string;
  status: CheckStatus;
  clearedAt: string;
};

export type CheckSearchFilter = ApiListTextSearch;

export type CheckListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: CheckSearchFilter;
};

export const DEFAULT_CHECK_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "createdAt:desc",
} as const satisfies Pick<CheckListParams, "page" | "limit" | "sort">;

export function todayCheckDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyCheckForm(): CheckFormValues {
  return {
    invoiceId: "",
    invoiceNumber: "",
    checkNumber: "",
    paymentAmount: "",
    refNumber: "",
    datePosted: todayCheckDateInputValue(),
    status: "OUTSTANDING",
    clearedAt: "",
  };
}

export function checkStatusI18nKey(status: CheckStatus): "outstanding" | "cleared" {
  return status === "CLEARED" ? "cleared" : "outstanding";
}

export function checkToFormValues(check: Check): CheckFormValues {
  return {
    invoiceId: check.invoice.id,
    invoiceNumber: check.invoice.number,
    checkNumber: check.checkNumber,
    paymentAmount: Number.isFinite(check.paymentAmount) ? String(check.paymentAmount) : "",
    refNumber: check.refNumber,
    datePosted: check.datePosted.slice(0, 10),
    status: check.status,
    clearedAt: check.clearedAt.slice(0, 10),
  };
}

export function areCheckFormValuesEquivalent(left: CheckFormValues, right: CheckFormValues): boolean {
  return areFormValuesEquivalent(left, right);
}

export function parseCheckPaymentAmount(value: string): number | null {
  const amount = parseMoneyFormInput(value);
  if (amount == null || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function createCheckSearchFilter(value: string): CheckSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildCheckListParams(input: {
  page: number;
  limit?: number;
  query: string;
  sort?: ApiListSortInput;
}): CheckListParams {
  const params: CheckListParams = {
    ...DEFAULT_CHECK_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_CHECK_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_CHECK_LIST_PARAMS.sort,
  };

  const search = createCheckSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  return params;
}
