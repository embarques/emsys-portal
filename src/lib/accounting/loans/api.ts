import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  buildAdvancedSearchBody,
  createOrTextSearchFilterGroup,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import { LOAN_TABLE_FILTER_FIELDS } from "@/lib/accounting/loans/filter-fields";
import { expandLoanFilterNode } from "@/lib/accounting/loans/loan-filters";
import {
  EMPTY_LOAN_SUMMARY,
  type Loan,
  type LoanAccountRef,
  type LoanBranchRef,
  type LoanCreateValues,
  type LoanEmployeeRef,
  type LoanListParams,
  type LoanListResult,
  type LoanPaymentValues,
  type LoanStatus,
  type LoanSummary,
  type LoanTransaction,
  type LoanTransactionType,
} from "@/lib/accounting/loans/types";

type ApiEnvelope = {
  data?: unknown;
  response?: unknown;
  page?: number;
  resultsPerPage?: number;
  results_per_page?: number;
  total?: number;
  success?: boolean;
  message?: string;
  error?: string;
};

const LOAN_SEARCH_FIELDS = [
  "employee.name",
  "description",
  "referenceNumber",
  "loanAccount.name",
  "loanAccount.displayName",
];

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function unwrap(payload: unknown): unknown {
  const envelope = objectValue(payload);
  return firstDefined(envelope.data, envelope.response, payload);
}

function unwrapArray(payload: unknown): unknown[] {
  const value = unwrap(payload);
  if (Array.isArray(value)) return value;
  const raw = objectValue(value);
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.loans)) return raw.loans;
  if (Array.isArray(raw.transactions)) return raw.transactions;
  return [];
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function assertMutation(payload: unknown, fallback: string) {
  const envelope = objectValue(payload);
  if (envelope.success === false) {
    throw new Error(stringValue(envelope.message || envelope.error) || fallback);
  }
}

function normalizeEmployee(value: unknown): LoanEmployeeRef {
  const raw = objectValue(value);
  return {
    id: numberValue(firstDefined(raw.id, raw._id)),
    name: stringValue(firstDefined(raw.name, raw.displayName)),
  };
}

function normalizeBranch(value: unknown): LoanBranchRef | undefined {
  const raw = objectValue(value);
  const id = numberValue(firstDefined(raw.id, raw._id));
  const code = stringValue(raw.code);
  const name = stringValue(raw.name);
  if (!id && !code && !name) return undefined;
  return { id, code, name };
}

function normalizeAccount(value: unknown): LoanAccountRef | undefined {
  const raw = objectValue(value);
  const id = numberValue(firstDefined(raw.id, raw._id));
  const name = stringValue(firstDefined(raw.name, raw.displayName, raw.code));
  if (!id && !name) return undefined;
  return {
    id,
    name,
    code: stringValue(raw.code) || undefined,
    displayName: stringValue(raw.displayName) || undefined,
    type: stringValue(raw.type) || undefined,
  };
}

function normalizeLoanStatus(value: unknown): LoanStatus {
  const status = stringValue(value).toUpperCase();
  if (status === "PAID" || status === "VOID") return status;
  return "ACTIVE";
}

function normalizeLoanTransactionType(value: unknown): LoanTransactionType {
  return stringValue(value).toUpperCase() === "PAYMENT" ? "PAYMENT" : "ISSUE";
}

export function normalizeLoan(value: unknown): Loan | null {
  const raw = objectValue(value);
  const id = stringValue(firstDefined(raw.id, raw._id));
  if (!id) return null;
  const principalAmount = numberValue(firstDefined(raw.principalAmount, raw.originalAmount, raw.amount));
  const paidAmount = numberValue(firstDefined(raw.paidAmount, raw.totalPaid));
  const balance = numberValue(firstDefined(raw.balance, raw.currentBalance), Math.max(0, principalAmount - paidAmount));
  return {
    id,
    employee: normalizeEmployee(raw.employee),
    branch: normalizeBranch(raw.branch),
    incomeStatement: normalizeAccount(raw.incomeStatement),
    loanAccount: normalizeAccount(raw.loanAccount),
    principalAmount,
    paidAmount,
    balance,
    status: normalizeLoanStatus(raw.status),
    description: stringValue(raw.description),
    referenceNumber: stringValue(firstDefined(raw.referenceNumber, raw.refNumber)),
    openedAt: stringValue(firstDefined(raw.openedAt, raw.transactionDate, raw.date, raw.createdAt)).slice(0, 10),
    lastActivityAt: stringValue(firstDefined(raw.lastActivityAt, raw.updatedAt, raw.createdAt)).slice(0, 10),
    createdAt: stringValue(raw.createdAt),
    createdBy: stringValue(firstDefined(objectValue(raw.createdBy).name, raw.createdBy)) || undefined,
    updatedAt: stringValue(raw.updatedAt) || undefined,
    updatedBy: stringValue(firstDefined(objectValue(raw.updatedBy).name, raw.updatedBy)) || undefined,
  };
}

function normalizeLoanTransaction(value: unknown): LoanTransaction | null {
  const raw = objectValue(value);
  const id = stringValue(firstDefined(raw.id, raw._id));
  if (!id) return null;
  return {
    id,
    loanId: stringValue(firstDefined(raw.loanId, objectValue(raw.loan).id, objectValue(raw.loan)._id)),
    journalEntryId: stringValue(firstDefined(raw.journalEntryId, objectValue(raw.journalEntry).id)) || undefined,
    type: normalizeLoanTransactionType(raw.type),
    amount: numberValue(raw.amount),
    assetAccount: normalizeAccount(firstDefined(raw.assetAccount, raw.sourceAccount, raw.receivedAccount)),
    transactionDate: stringValue(firstDefined(raw.transactionDate, raw.date, raw.createdAt)).slice(0, 10),
    referenceNumber: stringValue(firstDefined(raw.referenceNumber, raw.refNumber)),
    description: stringValue(raw.description),
    createdAt: stringValue(raw.createdAt),
    createdBy: stringValue(firstDefined(objectValue(raw.createdBy).name, raw.createdBy)) || undefined,
  };
}

function normalizeSummary(value: unknown, items: Loan[]): LoanSummary {
  const raw = objectValue(value);
  if (Object.keys(raw).length === 0) {
    return {
      outstandingBalance: items.reduce((sum, loan) => sum + loan.balance, 0),
      loanedInRange: items.reduce((sum, loan) => sum + loan.principalAmount, 0),
      paidInRange: items.reduce((sum, loan) => sum + loan.paidAmount, 0),
      activeLoans: items.filter((loan) => loan.status === "ACTIVE").length,
    };
  }
  return {
    outstandingBalance: numberValue(firstDefined(raw.outstandingBalance, raw.balance)),
    loanedInRange: numberValue(firstDefined(raw.loanedInRange, raw.principalAmount)),
    paidInRange: numberValue(firstDefined(raw.paidInRange, raw.paidAmount)),
    activeLoans: numberValue(raw.activeLoans),
  };
}

function buildLoanFilterGroups(params: LoanListParams) {
  const filterGroups = [];
  const searchGroup = createOrTextSearchFilterGroup(params.search?.value ?? "", LOAN_SEARCH_FIELDS);
  if (searchGroup) filterGroups.push(searchGroup);

  const rowFilters: ApiSearchFilterNode[] = (params.filterRows ?? [])
    .filter((row) => isCompleteFilterRow(row, LOAN_TABLE_FILTER_FIELDS))
    .map((row) => ({
      field: row.field,
      operator: row.operator || "eq",
      value: row.value,
    }))
    .map(expandLoanFilterNode)
    .filter((entry): entry is ApiSearchFilterNode => entry != null);

  if (rowFilters.length > 0) {
    filterGroups.push({ operator: "and" as const, filters: rowFilters });
  }

  return filterGroups;
}

export function buildLoanReportFilters(params: LoanListParams): ApiSearchFilterNode[] {
  const body = buildAdvancedSearchBody({
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    filterGroups: buildLoanFilterGroups(params),
  });
  return body.filters;
}

export async function fetchLoans(params: LoanListParams): Promise<LoanListResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const payload = await apiClient.post<ApiEnvelope>(
    `${API_ENDPOINTS.ACCOUNTING_LOANS}/search`,
    buildAdvancedSearchBody({
      page,
      limit,
      sort: params.sort,
      filterGroups: buildLoanFilterGroups(params),
    }),
  );
  const envelope = objectValue(payload);
  const unwrapped = objectValue(unwrap(payload));
  const items = unwrapArray(payload).map(normalizeLoan).filter((loan): loan is Loan => loan != null);
  return {
    items,
    summary: normalizeSummary(firstDefined(unwrapped.summary, envelope.summary), items),
    page: numberValue(envelope.page, page),
    resultsPerPage: numberValue(firstDefined(envelope.resultsPerPage, envelope.results_per_page), limit),
    total: numberValue(envelope.total, items.length),
  };
}

export async function fetchLoan(id: string): Promise<Loan | null> {
  if (!id) return null;
  const payload = await apiClient.get<ApiEnvelope>(`${API_ENDPOINTS.ACCOUNTING_LOAN}/${encodeURIComponent(id)}`);
  return normalizeLoan(unwrap(payload));
}

export async function fetchLoanTransactions(id: string): Promise<LoanTransaction[]> {
  if (!id) return [];
  const payload = await apiClient.get<ApiEnvelope>(
    `${API_ENDPOINTS.ACCOUNTING_LOAN}/${encodeURIComponent(id)}/transactions`,
  );
  return unwrapArray(payload)
    .map(normalizeLoanTransaction)
    .filter((transaction): transaction is LoanTransaction => transaction != null);
}

export async function createLoan(values: LoanCreateValues): Promise<Loan | null> {
  const payload = await apiClient.post<ApiEnvelope>(API_ENDPOINTS.ACCOUNTING_LOAN, {
    employee: values.employeeId ? { id: values.employeeId, name: values.employeeName ?? "" } : undefined,
    loanAccount: values.loanAccountId
      ? { id: values.loanAccountId, name: values.loanAccountName ?? "", type: values.loanAccountType }
      : undefined,
    sourceAccount: values.sourceAccountId
      ? { id: values.sourceAccountId, name: values.sourceAccountName ?? "", type: values.sourceAccountType }
      : undefined,
    principalAmount: values.principalAmount,
    transactionDate: values.transactionDate,
    referenceNumber: values.referenceNumber,
    description: values.description,
  });
  assertMutation(payload, "Unable to create loan.");
  const data = objectValue(unwrap(payload));
  return normalizeLoan(firstDefined(data.loan, unwrapArray(payload)[0], data));
}

export async function recordLoanPayment(values: LoanPaymentValues): Promise<Loan | null> {
  const endpoint =
    values.allocationMode === "specific-loan" && values.loanId
      ? `${API_ENDPOINTS.ACCOUNTING_LOAN}/${encodeURIComponent(values.loanId)}/payments`
      : `${API_ENDPOINTS.ACCOUNTING_LOAN}/payments`;
  const payload = await apiClient.post<ApiEnvelope>(endpoint, {
    employee: values.employeeId ? { id: values.employeeId, name: values.employeeName ?? "" } : undefined,
    allocationMode: values.allocationMode,
    loanId: values.loanId,
    receivedAccount: values.receivedAccountId
      ? { id: values.receivedAccountId, name: values.receivedAccountName ?? "", type: values.receivedAccountType }
      : undefined,
    amount: values.amount,
    transactionDate: values.transactionDate,
    referenceNumber: values.referenceNumber,
    description: values.description,
  });
  assertMutation(payload, "Unable to record loan payment.");
  const data = objectValue(unwrap(payload));
  const loans = Array.isArray(data.loans) ? data.loans : unwrapArray(payload);
  return normalizeLoan(loans[0] ?? data.loan ?? data);
}

export { EMPTY_LOAN_SUMMARY };
