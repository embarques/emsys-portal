import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  EMPTY_DAILY_INCOME_SUMMARY,
  type AccountingLookup,
  type ChartAccount,
  type ChartAccountList,
  type ChartAccountListParams,
  type ChartAccountType,
  type ChartAccountValues,
  type DailyIncomeJournal,
  type DailyIncomeJournalList,
  type DailyIncomeJournalListParams,
  type DailyIncomeJournalValues,
  type DailyIncomeStatement,
  type DailyIncomeStatementValues,
  type DailyIncomeSummary,
  type JournalTransactionType,
} from "@/lib/accounting/daily-income/types";

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

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value).trim();
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
  return Array.isArray(value) ? value : [];
}

function assertMutation(payload: unknown, fallback: string) {
  const envelope = objectValue(payload);
  if (envelope.success === false) {
    throw new Error(stringValue(envelope.message || envelope.error) || fallback);
  }
}

function normalizeLookup(value: unknown): AccountingLookup | undefined {
  const raw = objectValue(value);
  const id = numberValue(firstDefined(raw.id, raw._id));
  const name = stringValue(firstDefined(raw.name, raw.displayName, raw.code));
  if (!id && !name) return undefined;
  return {
    id,
    name,
    code: stringValue(raw.code) || undefined,
    displayName: stringValue(raw.displayName) || undefined,
  };
}

function normalizeIncomeStatement(value: unknown): DailyIncomeStatement | null {
  const raw = objectValue(value);
  const id = numberValue(firstDefined(raw.id, raw._id));
  if (!id) return null;
  const status = stringValue(raw.status).toUpperCase();
  return {
    id,
    date: stringValue(raw.date).slice(0, 10),
    status: status === "CLOSED" || status === "CLOSE" ? "CLOSED" : "OPEN",
    branch: normalizeLookup(raw.branch),
    currency: stringValue(raw.currency) || "DOLLAR",
    rate: numberValue(raw.rate),
    container: normalizeLookup(raw.container),
  };
}

function normalizeJournal(value: unknown): DailyIncomeJournal | null {
  const raw = objectValue(value);
  const id = stringValue(firstDefined(raw.id, raw._id));
  if (!id) return null;
  const invoice = objectValue(raw.invoice);
  return {
    id,
    incomeStatementId: numberValue(firstDefined(raw.incomeStatementId, objectValue(raw.incomeStatement).id)),
    date: stringValue(raw.date).slice(0, 10),
    transactionType: (stringValue(firstDefined(raw.transactionType, raw.transType)) || "SALES") as JournalTransactionType,
    amount: numberValue(raw.amount),
    refNumber: stringValue(raw.refNumber),
    description: stringValue(raw.description),
    currency: stringValue(raw.currency),
    rate: numberValue(raw.rate),
    employee: normalizeLookup(raw.employee),
    account: normalizeLookup(raw.account),
    sourceAccount: normalizeLookup(raw.sourceAccount),
    paymentMethod: normalizeLookup(raw.paymentMethod),
    invoice: Object.keys(invoice).length
      ? {
          id: firstDefined(invoice.id, invoice._id) as string | number | undefined,
          number: stringValue(invoice.number),
          cost: numberValue(invoice.cost),
          payment: numberValue(invoice.payment),
          balance: numberValue(invoice.balance),
        }
      : undefined,
    createdAt: stringValue(raw.createdAt) || undefined,
  };
}

function normalizeSummary(value: unknown): DailyIncomeSummary {
  const raw = objectValue(value);
  return {
    totalGeneral: numberValue(raw.totalGeneral),
    invoice: numberValue(raw.invoice),
    accountsReceivable: numberValue(raw.accountsReceivable),
    totalIncome: numberValue(raw.totalIncome),
    expense: numberValue(raw.expense),
    totalCash: numberValue(raw.totalCash),
    cash: numberValue(raw.cash),
    check: numberValue(raw.check),
    creditCard: numberValue(raw.creditCard),
    deposit: numberValue(raw.deposit),
    zelle: numberValue(raw.zelle),
  };
}

function normalizeAccount(value: unknown): ChartAccount | null {
  const raw = objectValue(value);
  const id = numberValue(firstDefined(raw.id, raw._id));
  if (!id) return null;
  const displayName = stringValue(firstDefined(raw.displayName, raw.name));
  return {
    id,
    name: stringValue(raw.name) || displayName,
    displayName,
    type: (stringValue(objectValue(raw.type).id || raw.type) || "ASSET") as ChartAccountType,
    description: stringValue(raw.description),
    branch: normalizeLookup(raw.branch),
    parentAccount: normalizeLookup(raw.parentAccount),
    systemAccount: raw.systemAccount === true,
    branchAccount: raw.branchAccount === true,
  };
}

function queryString(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.toString();
}

export async function fetchIncomeStatement(branchCode: string, date: string) {
  if (!branchCode || !date) return null;
  const query = queryString({
    page: 1,
    results_per_page: 1,
    date: `eq:${date}:date`,
    "branch.code": branchCode,
  });
  const payload = await apiClient.get<ApiEnvelope>(`${API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENTS}?${query}`);
  return normalizeIncomeStatement(unwrapArray(payload)[0]);
}

function incomeStatementPayload(values: DailyIncomeStatementValues) {
  return {
    date: values.date,
    status: "OPEN",
    branch: { id: values.branchId, code: values.branchCode },
    currency: values.currency,
    rate: values.rate,
  };
}

export async function createIncomeStatement(values: DailyIncomeStatementValues) {
  const payload = await apiClient.post<ApiEnvelope>(
    API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENT,
    incomeStatementPayload(values),
  );
  assertMutation(payload, "Unable to create daily income statement.");
  const result = normalizeIncomeStatement(unwrapArray(payload)[0] ?? unwrap(payload));
  if (!result) throw new Error("The API did not return the created daily income statement.");
  return result;
}

export async function updateIncomeStatement(id: number, values: DailyIncomeStatementValues) {
  const payload = await apiClient.put<ApiEnvelope>(
    `${API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENT}/${id}`,
    { id, ...incomeStatementPayload(values) },
  );
  assertMutation(payload, "Unable to update daily income statement.");
  return normalizeIncomeStatement(unwrapArray(payload)[0] ?? unwrap(payload));
}

export async function setIncomeStatementStatus(statement: DailyIncomeStatement, open: boolean) {
  const payload = await apiClient.put<ApiEnvelope>(
    `${API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENT}/status/${statement.id}`,
    { id: statement.id, date: statement.date, status: open ? "open" : "close" },
  );
  assertMutation(payload, `Unable to ${open ? "open" : "close"} daily income statement.`);
  return normalizeIncomeStatement(unwrapArray(payload)[0] ?? unwrap(payload));
}

export async function fetchDailyIncomeJournals(params: DailyIncomeJournalListParams): Promise<DailyIncomeJournalList> {
  if (!params.incomeStatementId) {
    return { items: [], summary: EMPTY_DAILY_INCOME_SUMMARY, page: 1, resultsPerPage: params.limit ?? 20, total: 0 };
  }
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const query = queryString({
    page,
    results_per_page: limit,
    "incomeStatement._id": `eq:${params.incomeStatementId}:num`,
    "employee._id": params.employeeId ? `eq:${params.employeeId}:num` : undefined,
    search: params.query?.trim() || undefined,
    sort_by: "createdAt",
    order: "desc",
  });
  const payload = await apiClient.get<ApiEnvelope>(`${API_ENDPOINTS.ACCOUNTING_JOURNALS}?${query}`);
  const envelope = objectValue(payload);
  const unwrapped = unwrap(payload);
  const first = Array.isArray(unwrapped) ? objectValue(unwrapped[0]) : objectValue(unwrapped);
  const rows = Array.isArray(first.journals) ? first.journals : Array.isArray(unwrapped) ? unwrapped : [];
  const items = rows.map(normalizeJournal).filter((item): item is DailyIncomeJournal => item != null);
  return {
    items,
    summary: first.summary ? normalizeSummary(first.summary) : EMPTY_DAILY_INCOME_SUMMARY,
    page: numberValue(envelope.page, page),
    resultsPerPage: numberValue(firstDefined(envelope.resultsPerPage, envelope.results_per_page), limit),
    total: numberValue(firstDefined(envelope.total, first.total), items.length),
  };
}

function journalPayload(statement: DailyIncomeStatement, values: DailyIncomeJournalValues) {
  const invoiceRelated = ["INITIAL-PAYMENT", "PAYMENT", "DISCOUNT", "SURCHARGE"].includes(values.transactionType);
  const accountRelated = ["EXPENSE", "SALES", "ACCOUNT-TRANSFER", "LOAN"].includes(values.transactionType);
  const sourceAccountRelated = ["EXPENSE", "ACCOUNT-TRANSFER", "LOAN"].includes(values.transactionType);

  return {
    incomeStatementId: statement.id,
    date: statement.date,
    transactionType: values.transactionType,
    amount: values.amount,
    refNumber: values.refNumber,
    description: values.description,
    currency: statement.currency,
    rate: statement.rate,
    employee: values.employeeId ? { id: values.employeeId, name: values.employeeName } : undefined,
    account: accountRelated && values.accountId
      ? { id: values.accountId, name: values.accountName, displayName: values.accountName }
      : undefined,
    sourceAccount: sourceAccountRelated && values.sourceAccountId
      ? { id: values.sourceAccountId, name: values.sourceAccountName, displayName: values.sourceAccountName }
      : undefined,
    invoice: invoiceRelated && values.invoiceId ? { id: values.invoiceId, number: values.invoiceNumber } : undefined,
    paymentMethod: values.paymentMethodId
      ? { id: values.paymentMethodId, name: values.paymentMethodName }
      : undefined,
  };
}

export async function createDailyIncomeJournal(statement: DailyIncomeStatement, values: DailyIncomeJournalValues) {
  const payload = await apiClient.post<ApiEnvelope>(API_ENDPOINTS.ACCOUNTING_JOURNAL, journalPayload(statement, values));
  assertMutation(payload, "Unable to create transaction.");
  return normalizeJournal(unwrapArray(payload)[0] ?? unwrap(payload));
}

export async function updateDailyIncomeJournal(id: string, statement: DailyIncomeStatement, values: DailyIncomeJournalValues) {
  const payload = await apiClient.put<ApiEnvelope>(
    `${API_ENDPOINTS.ACCOUNTING_JOURNAL}/${encodeURIComponent(id)}`,
    { id, ...journalPayload(statement, values) },
  );
  assertMutation(payload, "Unable to update transaction.");
  return normalizeJournal(unwrapArray(payload)[0] ?? unwrap(payload));
}

export async function deleteDailyIncomeJournal(id: string) {
  const payload = await apiClient.delete<ApiEnvelope>(`${API_ENDPOINTS.ACCOUNTING_JOURNAL}/${encodeURIComponent(id)}`);
  assertMutation(payload, "Unable to delete transaction.");
}

export async function fetchChartAccounts(params: ChartAccountListParams = {}): Promise<ChartAccountList> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const query = queryString({
    page,
    results_per_page: limit,
    search: params.query?.trim() || undefined,
    sort_by: "createdAt",
    order: "desc",
  });
  const payload = await apiClient.get<ApiEnvelope>(`${API_ENDPOINTS.ACCOUNTING_ACCOUNTS}?${query}`);
  const envelope = objectValue(payload);
  const items = unwrapArray(payload).map(normalizeAccount).filter((item): item is ChartAccount => item != null);
  return {
    items,
    page: numberValue(envelope.page, page),
    resultsPerPage: numberValue(firstDefined(envelope.resultsPerPage, envelope.results_per_page), limit),
    total: numberValue(envelope.total, items.length),
  };
}

export async function fetchAccountingPaymentMethods(): Promise<AccountingLookup[]> {
  const query = queryString({ page: 1, results_per_page: 200 });
  const payload = await apiClient.get<ApiEnvelope>(`${API_ENDPOINTS.ACCOUNTING_PAYMENT_METHODS}?${query}`);
  return unwrapArray(payload)
    .map(normalizeLookup)
    .filter((item): item is AccountingLookup => item != null);
}

function accountPayload(values: ChartAccountValues) {
  return {
    name: values.displayName,
    displayName: values.displayName,
    type: values.type,
    description: values.description,
    branch: values.branchId ? { id: values.branchId, code: values.branchCode } : undefined,
    parentAccount: values.parentAccountId
      ? { id: values.parentAccountId, displayName: values.parentAccountName }
      : undefined,
  };
}

export async function createChartAccount(values: ChartAccountValues) {
  const payload = await apiClient.post<ApiEnvelope>(API_ENDPOINTS.ACCOUNTING_ACCOUNT, accountPayload(values));
  assertMutation(payload, "Unable to create account.");
  return normalizeAccount(unwrapArray(payload)[0] ?? unwrap(payload));
}

export async function updateChartAccount(id: number, values: ChartAccountValues) {
  const payload = await apiClient.put<ApiEnvelope>(`${API_ENDPOINTS.ACCOUNTING_ACCOUNT}/${id}`, accountPayload(values));
  assertMutation(payload, "Unable to update account.");
  return normalizeAccount(unwrapArray(payload)[0] ?? unwrap(payload));
}

export async function deleteChartAccount(id: number) {
  const payload = await apiClient.delete<ApiEnvelope>(`${API_ENDPOINTS.ACCOUNTING_ACCOUNT}/${id}`);
  assertMutation(payload, "Unable to delete account.");
}
