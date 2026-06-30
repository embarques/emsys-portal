import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildAdvancedSearchBody,
  buildApiSearchPaginationQuery,
  buildStripeStyleSearchBody,
} from "@/lib/api/search-query";
import {
  EMPTY_DAILY_INCOME_SUMMARY,
  isZellePaymentMethod,
  requiresBankAccount,
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
  type DailyIncomePartyRef,
  type DailyIncomeStatement,
  type DailyIncomeStatementValues,
  type DailyIncomeSummary,
  type IncomeStatementSummaryDetail,
  type IncomeStatementSummaryTotal,
  type IncomeStatementSummaryTotals,
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

function assertChartAccountMutation(payload: unknown, fallback: string) {
  const envelope = objectValue(payload);
  if (envelope.success !== true) {
    throw new Error(stringValue(envelope.message || envelope.error) || fallback);
  }
}

function unwrapChartAccountList(payload: unknown): unknown[] {
  const data = objectValue(payload).data;
  return Array.isArray(data) ? data : [];
}

function unwrapChartAccountEntity(payload: unknown): unknown {
  const envelope = objectValue(payload);
  return firstDefined(envelope.data, payload);
}

function normalizePartyRef(value: unknown): DailyIncomePartyRef | undefined {
  const raw = objectValue(value);
  const id = firstDefined(raw.id, raw._id);
  const name = stringValue(firstDefined(raw.name, raw.displayName));
  if (id == null || id === "" || !name) return undefined;
  return { id: typeof id === "number" ? id : String(id), name };
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
    currency: stringValue(raw.currency) || "USD",
    rate: numberValue(raw.rate),
    container: normalizeLookup(raw.container),
  };
}

function normalizeJournal(value: unknown): DailyIncomeJournal | null {
  const raw = objectValue(value);
  const id = stringValue(firstDefined(raw.id, raw._id));
  if (!id) return null;
  const invoice = objectValue(raw.invoice);
  const accountLines = Array.isArray(raw.accounts)
    ? raw.accounts.map((value) => {
        const account = objectValue(value);
        return {
          id: numberValue(firstDefined(account.id, account._id)),
          name: stringValue(account.name),
          type: stringValue(account.type),
          debit: numberValue(account.debit),
          credit: numberValue(account.credit),
        };
      })
    : [];
  const primaryLine = accountLines.find((account) => !["CASH ON HAND", "ACCOUNTS RECEIVABLE"].includes(account.name));
  const sourceLine = accountLines.find((account) => account.credit > 0 && account.id !== primaryLine?.id);
  return {
    id,
    incomeStatementId: numberValue(firstDefined(raw.incomeStatementId, objectValue(raw.incomeStatement).id)),
    date: stringValue(raw.date).slice(0, 10),
    transactionType: (stringValue(firstDefined(raw.transactionType, raw.transType)) || "SALES") as JournalTransactionType,
    amount: numberValue(firstDefined(raw.transactionAmount, raw.amount)),
    refNumber: stringValue(raw.refNumber),
    description: stringValue(raw.description),
    currency: stringValue(raw.currency),
    rate: numberValue(raw.rate),
    employee: normalizeLookup(raw.employee),
    account: normalizeLookup(raw.account) ?? (primaryLine ? normalizeLookup(primaryLine) : undefined),
    paymentAccount: normalizeLookup(raw.paymentAccount),
    sourceAccount: normalizeLookup(raw.sourceAccount) ?? (sourceLine ? normalizeLookup(sourceLine) : undefined),
    paymentMethod: normalizeLookup(raw.paymentMethod),
    zelleTransactionDate: stringValue(raw.zelleTransactionDate).slice(0, 10) || undefined,
    zelleTransactionName: stringValue(raw.zelleTransactionName) || undefined,
    accounts: accountLines,
    invoice: Object.keys(invoice).length
      ? {
          id: firstDefined(invoice.id, invoice._id) as string | number | undefined,
          number: stringValue(invoice.number),
          cost: numberValue(invoice.cost),
          payment: numberValue(invoice.payment),
          balance: numberValue(invoice.balance),
          sender: normalizePartyRef(invoice.sender),
          receiver: normalizePartyRef(invoice.receiver),
        }
      : undefined,
    createdAt: stringValue(raw.createdAt) || undefined,
  };
}

function normalizeSummary(value: unknown): DailyIncomeSummary {
  const raw = objectValue(value);
  return {
    totalGeneral: numberValue(raw.totalGeneral),
    invoice: numberValue(firstDefined(raw.invoice, raw.invoicePayments, raw.invoices)),
    accountsReceivable: numberValue(firstDefined(raw.accountsReceivable, raw.accountReceivables)),
    totalIncome: numberValue(raw.totalIncome),
    expense: numberValue(firstDefined(raw.expense, raw.expenses)),
    totalCash: numberValue(raw.totalCash),
    cash: numberValue(raw.cash),
    check: numberValue(raw.check),
    creditCard: numberValue(firstDefined(raw.creditCard, raw.creditCards)),
    deposit: numberValue(firstDefined(raw.deposit, raw.deposits)),
    zelle: numberValue(raw.zelle),
  };
}

function computeJournalSummary(items: DailyIncomeJournal[]): DailyIncomeSummary {
  const summary = { ...EMPTY_DAILY_INCOME_SUMMARY };

  for (const item of items) {
    if (item.transactionType === "INITIAL-PAYMENT" || item.transactionType === "PAYMENT") {
      summary.invoice += item.amount;
    }

    const expenseLines = item.accounts.filter((account) => account.type === "EXPENSE");
    if (expenseLines.length > 0) {
      summary.expense += expenseLines.reduce((total, account) => total + account.debit, 0);
    } else if (item.transactionType === "EXPENSE") {
      summary.expense += item.amount;
    }

    for (const account of item.accounts) {
      if (account.name === "ACCOUNTS RECEIVABLE") {
        summary.accountsReceivable += account.debit - account.credit;
      }
    }

    if (!["INITIAL-PAYMENT", "PAYMENT", "SALES"].includes(item.transactionType)) {
      continue;
    }

    const paymentMethod = item.paymentMethod?.name.trim().replaceAll("_", "-").toUpperCase();
    if (paymentMethod === "CASH") summary.cash += item.amount;
    else if (paymentMethod === "CHECK") summary.check += item.amount;
    else if (paymentMethod === "DEPOSIT") summary.deposit += item.amount;
    else if (paymentMethod === "ZELLE") summary.zelle += item.amount;
    else summary.creditCard += item.amount;
  }

  summary.totalIncome = summary.cash + summary.check + summary.deposit + summary.zelle + summary.creditCard;
  summary.totalGeneral = summary.invoice + summary.accountsReceivable;
  summary.totalCash = summary.cash - summary.expense;
  return summary;
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

export async function fetchIncomeStatementById(id: number) {
  if (!id) return null;
  const payload = await apiClient.get<ApiEnvelope>(`${API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENT}/${id}`);
  return normalizeIncomeStatement(unwrap(payload));
}

function normalizeSummaryDetail(value: unknown): IncomeStatementSummaryDetail | null {
  const raw = objectValue(value);
  const header = stringValue(raw.header);
  if (!header) return null;
  return { header, value: numberValue(raw.value) };
}

function normalizeSummaryTotal(value: unknown): IncomeStatementSummaryTotal | null {
  const raw = objectValue(value);
  const header = stringValue(raw.header);
  if (!header) return null;
  const details = Array.isArray(raw.details)
    ? raw.details
        .map(normalizeSummaryDetail)
        .filter((item): item is IncomeStatementSummaryDetail => item != null)
    : undefined;
  return {
    header,
    value: numberValue(raw.value),
    details: details?.length ? details : undefined,
  };
}

export async function fetchIncomeStatementSummaryTotals(
  incomeStatementId: number,
): Promise<IncomeStatementSummaryTotals | null> {
  if (!incomeStatementId) return null;
  const payload = await apiClient.get<ApiEnvelope>(
    `${API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENT}/${incomeStatementId}/summary-total`,
  );
  const envelope = objectValue(payload);
  if (envelope.success === false) {
    throw new Error(stringValue(envelope.message || envelope.error) || "Unable to load summary totals.");
  }
  const raw = objectValue(unwrap(payload));
  const totals = (Array.isArray(raw.totals) ? raw.totals : unwrapArray(payload))
    .map(normalizeSummaryTotal)
    .filter((item): item is IncomeStatementSummaryTotal => item != null);
  return {
    currency: stringValue(raw.currency) || "USD",
    rate: numberValue(raw.rate, 1),
    totals,
  };
}

export async function fetchIncomeStatement(branchId: number, date: string) {
  if (!branchId || !date) return null;
  const isoDate = date.slice(0, 10);

  try {
    const listQuery = buildApiListQuery({
      page: 1,
      limit: 500,
      sort: { field: "date", direction: "desc" },
    });
    const listPayload = await apiClient.get<ApiEnvelope>(
      `${API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENTS}?${listQuery}`,
    );
    for (const row of unwrapArray(listPayload)) {
      const statement = normalizeIncomeStatement(row);
      if (
        statement &&
        statement.date.slice(0, 10) === isoDate &&
        statement.branch?.id === branchId
      ) {
        return statement;
      }
    }
  } catch {
    // Fall through to POST /search.
  }

  const paginationQuery = buildApiSearchPaginationQuery({ page: 1, limit: 1, offset: 0 });
  const payload = await apiClient.post<ApiEnvelope>(
    `${API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENTS}/search?${paginationQuery}`,
    buildStripeStyleSearchBody({
      sort: { field: "date", direction: "desc" },
      filterGroups: [
        {
          operator: "and",
          filters: [
            { field: "branch.id", operator: "eq", value: branchId },
            { field: "date", operator: "eq", value: isoDate },
          ],
        },
      ],
    }),
  );
  return normalizeIncomeStatement(unwrapArray(payload)[0]);
}

function incomeStatementPayload(values: DailyIncomeStatementValues) {
  return {
    date: `${values.date}T00:00:00Z`,
    branch: { id: values.branchId, code: values.branchCode, name: values.branchName },
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
  const payload = await apiClient.post<ApiEnvelope>(
    `${API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENT}/${statement.id}/${open ? "open" : "close"}`,
  );
  assertMutation(payload, `Unable to ${open ? "open" : "close"} daily income statement.`);
  return normalizeIncomeStatement(unwrapArray(payload)[0] ?? unwrap(payload));
}

function parseJournalSearchRows(payload: unknown): unknown[] {
  const envelope = objectValue(payload);
  if (Array.isArray(envelope.data)) return envelope.data;
  const unwrapped = unwrap(payload);
  if (Array.isArray(unwrapped)) return unwrapped;
  const nested = objectValue(unwrapped);
  if (Array.isArray(nested.journals)) return nested.journals;
  return [];
}

export async function fetchDailyIncomeJournals(params: DailyIncomeJournalListParams): Promise<DailyIncomeJournalList> {
  if (!params.incomeStatementId) {
    return { items: [], summary: EMPTY_DAILY_INCOME_SUMMARY, page: 1, resultsPerPage: params.limit ?? 20, total: 0 };
  }
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const summaryFetchLimit = 500;

  const payload = await apiClient.post<ApiEnvelope>(
    `${API_ENDPOINTS.ACCOUNTING_JOURNALS}/search`,
    buildAdvancedSearchBody({
      page: 1,
      limit: summaryFetchLimit,
      sort: { field: "createdAt", direction: "desc" },
      filters: [{ field: "incomeStatement.id", operator: "eq", value: params.incomeStatementId }],
    }),
  );

  const envelope = objectValue(payload);
  let items = parseJournalSearchRows(payload)
    .map(normalizeJournal)
    .filter((item): item is DailyIncomeJournal => item != null);

  const search = params.query?.trim().toLowerCase();
  if (search) {
    items = items.filter((item) =>
      [item.refNumber, item.description, item.transactionType, item.employee?.name, item.invoice?.number]
        .some((value) => value?.toLowerCase().includes(search)),
    );
  }

  const total = search ? items.length : numberValue(envelope.total, items.length);
  const offset = (page - 1) * limit;
  const pageItems = items.slice(offset, offset + limit);

  return {
    items: pageItems,
    summary: computeJournalSummary(items),
    page,
    resultsPerPage: limit,
    total,
  };
}

function journalPayload(statement: DailyIncomeStatement, values: DailyIncomeJournalValues) {
  if (!statement.id) {
    throw new Error("A daily closeout id is required to save a transaction.");
  }

  const invoiceRelated = ["INITIAL-PAYMENT", "PAYMENT", "DISCOUNT", "SURCHARGE"].includes(values.transactionType);
  const accountRelated = ["EXPENSE", "SALES", "TRANSFER", "LOAN"].includes(values.transactionType);
  const sourceAccountRelated = ["EXPENSE", "TRANSFER", "LOAN"].includes(values.transactionType);
  const bankAccountRequired = requiresBankAccount(values.paymentMethodName);

  if (bankAccountRequired && (!values.paymentAccountId || values.paymentAccountType !== "BANK")) {
    throw new Error("Select a bank account for this payment method.");
  }

  const invoice =
    values.transactionType === "INITIAL-PAYMENT" && values.invoiceNumber?.trim()
      ? {
          number: values.invoiceNumber.trim(),
          cost: values.invoiceCost,
          discount: 0,
        }
      : undefined;

  return {
    incomeStatementId: statement.id,
    incomeStatement: { id: statement.id },
    date: statement.date,
    transactionType: values.transactionType,
    amount: values.amount,
    refNumber: values.refNumber,
    description: values.description,
    currency: statement.currency,
    rate: statement.rate,
    employee: values.employeeId
      ? { id: values.employeeId, name: values.employeeName ?? "" }
      : undefined,
    account: accountRelated && values.accountId
      ? { id: values.accountId, name: values.accountName, type: values.accountType }
      : undefined,
    paymentAccount: bankAccountRequired && values.paymentAccountId
      ? { id: values.paymentAccountId, name: values.paymentAccountName, type: values.paymentAccountType }
      : undefined,
    sourceAccount: sourceAccountRelated && values.sourceAccountId
      ? { id: values.sourceAccountId, name: values.sourceAccountName, type: values.sourceAccountType }
      : undefined,
    invoiceId: values.transactionType !== "INITIAL-PAYMENT" && invoiceRelated && values.invoiceId
      ? values.invoiceId
      : undefined,
    invoice,
    sender: values.transactionType === "INITIAL-PAYMENT" && values.senderId
      ? { id: values.senderId, name: values.senderName ?? "" }
      : undefined,
    receiver: values.transactionType === "INITIAL-PAYMENT" && values.receiverId
      ? { id: values.receiverId, name: values.receiverName ?? "" }
      : undefined,
    paymentMethod: values.paymentMethodId
      ? { id: values.paymentMethodId, name: values.paymentMethodName }
      : undefined,
    ...(isZellePaymentMethod(values.paymentMethodName)
      ? {
          zelleTransactionDate: values.zelleTransactionDate,
          zelleTransactionName: values.zelleTransactionName,
        }
      : {}),
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
  const listQuery = buildApiListQuery({
    page,
    limit,
    sort: { field: "createdAt", direction: "desc" },
    filter: params.type ? { field: "type", operator: "eq", value: params.type } : undefined,
  });
  const search = params.query?.trim();
  const query = search ? `${listQuery}&search=${encodeURIComponent(search)}` : listQuery;
  const payload = await apiClient.get<ApiEnvelope>(`${API_ENDPOINTS.CHART_ACCOUNTS}?${query}`);
  const envelope = objectValue(payload);
  const items = unwrapChartAccountList(payload)
    .map(normalizeAccount)
    .filter((item): item is ChartAccount => item != null);
  return {
    items,
    page: numberValue(envelope.page, page),
    resultsPerPage: numberValue(firstDefined(envelope.resultsPerPage, envelope.results_per_page), limit),
    total: numberValue(envelope.total, items.length),
  };
}

export async function fetchAccountingPaymentMethods(): Promise<AccountingLookup[]> {
  return [
    { id: 1, name: "CASH" },
    { id: 2, name: "DEPOSIT" },
    { id: 3, name: "CHECK" },
    { id: 4, name: "ZELLE" },
    { id: 5, name: "CREDIT-CARD" },
  ];
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
  const payload = await apiClient.post<ApiEnvelope>(API_ENDPOINTS.CHART_ACCOUNTS, accountPayload(values));
  assertChartAccountMutation(payload, "Unable to create account.");
  const result = normalizeAccount(unwrapChartAccountEntity(payload));
  if (!result) throw new Error("The API did not return the created account.");
  return result;
}

export async function updateChartAccount(id: number, values: ChartAccountValues) {
  const payload = await apiClient.put<ApiEnvelope>(
    `${API_ENDPOINTS.CHART_ACCOUNTS}/${id}`,
    accountPayload(values),
  );
  assertChartAccountMutation(payload, "Unable to update account.");
  const result = normalizeAccount(unwrapChartAccountEntity(payload));
  if (!result) throw new Error("The API did not return the updated account.");
  return result;
}

export async function deleteChartAccount(id: number) {
  const payload = await apiClient.delete<ApiEnvelope>(`${API_ENDPOINTS.CHART_ACCOUNTS}/${id}`);
  assertChartAccountMutation(payload, "Unable to delete account.");
}
