export type AccountingLookup = {
  id: number;
  name: string;
  code?: string;
  displayName?: string;
  type?: string;
};

export type DailyIncomePartyRef = {
  id: string | number;
  name: string;
  /** Nested crew/template route when the journal is posted under a daily vehicle-route. */
  route?: { id: string | number; name: string };
};

export type IncomeStatementStatus = "OPEN" | "CLOSED";

export type DailyIncomeStatement = {
  id: number;
  date: string;
  status: IncomeStatementStatus;
  branch?: AccountingLookup;
  currency: string;
  rate: number;
  container?: AccountingLookup;
};

export type DailyIncomeSummary = {
  totalGeneral: number;
  invoice: number;
  accountsReceivable: number;
  totalIncome: number;
  expense: number;
  totalCash: number;
  cash: number;
  check: number;
  creditCard: number;
  deposit: number;
  zelle: number;
};

export type IncomeStatementSummaryDetail = {
  header: string;
  value: number;
};

export type IncomeStatementSummaryTotal = {
  header: string;
  value: number;
  details?: IncomeStatementSummaryDetail[];
};

export type IncomeStatementSummaryTotals = {
  currency: string;
  rate: number;
  totals: IncomeStatementSummaryTotal[];
};

export type JournalTransactionType =
  | "INITIAL-PAYMENT"
  | "PAYMENT"
  | "DISCOUNT"
  | "SURCHARGE"
  | "EXPENSE"
  | "SALES"
  | "INVENTORY"
  | "TRANSFER"
  | "LOAN";

export type DailyIncomeAssigneeSource = "employee" | "route";

export type InventoryChangeDirection = "received" | "dispatched";

export type DailyIncomeJournal = {
  id: string;
  incomeStatementId: number;
  date: string;
  transactionType: JournalTransactionType;
  amount: number;
  refNumber: string;
  externalReferenceNumber?: string;
  description: string;
  currency: string;
  rate: number;
  employee?: AccountingLookup;
  employeeGroup?: DailyIncomePartyRef;
  /** Daily vehicle-route when the journal is posted under a route instead of an employee. */
  route?: DailyIncomePartyRef;
  account?: AccountingLookup;
  paymentAccount?: AccountingLookup;
  sourceAccount?: AccountingLookup;
  invoice?: {
    id?: string | number;
    number?: string;
    cost?: number;
    discount?: number;
    payment?: number;
    balance?: number;
    sender?: DailyIncomePartyRef;
    receiver?: DailyIncomePartyRef;
  };
  paymentMethod?: AccountingLookup;
  zelleTransactionDate?: string;
  zelleTransactionName?: string;
  /** Check number when payment method is CHECK. */
  checkNumber?: string;
  inventoryDirection?: InventoryChangeDirection;
  inventoryItemId?: string;
  inventoryItemName?: string;
  inventoryQuantity?: number;
  inventoryUnitPrice?: number;
  inventoryTotal?: number;
  inventorySupplierId?: string;
  inventorySupplierName?: string;
  accounts: Array<{
    id: number;
    name: string;
    type: string;
    debit: number;
    credit: number;
  }>;
  duplicatePaymentOverride?: boolean;
  createdAt?: string;
};

export type DailyIncomeJournalList = {
  items: DailyIncomeJournal[];
  summary: DailyIncomeSummary;
  page: number;
  resultsPerPage: number;
  total: number;
};

export type DailyIncomeJournalListParams = {
  incomeStatementId: number;
  page?: number;
  limit?: number;
  query?: string;
  employeeId?: number;
};

export type DailyIncomeStatementValues = {
  date: string;
  branchId: number;
  branchCode: string;
  branchName: string;
  currency: string;
  rate: number;
};

function normalizePaymentMethodName(name?: string | null): string {
  return name?.trim().replaceAll("_", "-").toUpperCase() ?? "";
}

/** Cash is the default method for new invoice and daily-income payments. */
export function isCashPaymentMethod(name?: string | null): boolean {
  return normalizePaymentMethodName(name) === "CASH";
}

export function findCashPaymentMethod(methods: AccountingLookup[]): AccountingLookup | undefined {
  return methods.find((method) => isCashPaymentMethod(method.name));
}

/** Resolve a saved payment method by id, then by name (API journals often omit or mismatch ids). */
export function matchPaymentMethod(
  methods: AccountingLookup[],
  id?: number,
  name?: string,
): AccountingLookup | undefined {
  if (id) {
    const byId = methods.find((method) => method.id === id);
    if (byId) return byId;
  }
  const normalized = normalizePaymentMethodName(name);
  if (!normalized) return undefined;
  return methods.find((method) => normalizePaymentMethodName(method.name) === normalized);
}

export function withDefaultCashPaymentMethod<T extends { paymentMethodId?: number; paymentMethodName?: string }>(
  values: T,
  paymentMethods: AccountingLookup[],
): T {
  if (values.paymentMethodId) return values;
  const cash = findCashPaymentMethod(paymentMethods);
  if (!cash) return values;
  return { ...values, paymentMethodId: cash.id, paymentMethodName: cash.name };
}

/** Zelle requires extra reconciliation fields to prevent duplicate payment posting. */
export function isZellePaymentMethod(name?: string | null): boolean {
  return normalizePaymentMethodName(name) === "ZELLE";
}

/** Check payments require the paper check number for reconciliation. */
export function isCheckPaymentMethod(name?: string | null): boolean {
  const normalized = normalizePaymentMethodName(name);
  return normalized === "CHECK" || normalized === "CHEQUE";
}

export function requiresBankAccount(name?: string | null): boolean {
  const normalizedName = normalizePaymentMethodName(name);
  return normalizedName === "DEPOSIT" || normalizedName === "ZELLE";
}

export type DailyIncomeJournalValues = {
  transactionType: JournalTransactionType;
  amount?: number;
  refNumber: string;
  externalReferenceNumber?: string;
  description: string;
  /** Portal-only: employee vs daily route. Do not persist. */
  assigneeSource?: DailyIncomeAssigneeSource;
  employeeId?: number;
  employeeName?: string;
  employeeGroupId?: string;
  employeeGroupName?: string;
  routeId?: string;
  routeName?: string;
  routeCrewId?: string;
  routeCrewName?: string;
  accountId?: number;
  accountName?: string;
  accountType?: string;
  paymentAccountId?: number;
  paymentAccountName?: string;
  paymentAccountType?: string;
  sourceAccountId?: number;
  sourceAccountName?: string;
  sourceAccountType?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceCost?: number;
  invoiceDiscount?: number;
  invoiceBalance?: number;
  includeSender?: boolean;
  includeReceiver?: boolean;
  senderId?: string;
  senderName?: string;
  receiverId?: string;
  receiverName?: string;
  paymentMethodId?: number;
  paymentMethodName?: string;
  zelleTransactionDate?: string;
  zelleTransactionName?: string;
  checkNumber?: string;
  /** Inventory change recorded with this journal. Posted with the closeout, not as a separate stock write. */
  inventoryDirection?: InventoryChangeDirection;
  inventoryItemId?: string;
  inventoryItemName?: string;
  inventoryQuantity?: number;
  inventoryUnitPrice?: number;
  inventoryTotal?: number;
  inventorySupplierId?: string;
  inventorySupplierName?: string;
};

export type {
  ChartAccount,
  ChartAccountList,
  ChartAccountListParams,
  ChartAccountRef,
  ChartAccountType,
  ChartAccountValues,
} from "@/lib/accounting/chart-accounts/types";

export const EMPTY_DAILY_INCOME_SUMMARY: DailyIncomeSummary = {
  totalGeneral: 0,
  invoice: 0,
  accountsReceivable: 0,
  totalIncome: 0,
  expense: 0,
  totalCash: 0,
  cash: 0,
  check: 0,
  creditCard: 0,
  deposit: 0,
  zelle: 0,
};
