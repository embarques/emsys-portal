export type AccountingLookup = {
  id: number;
  name: string;
  code?: string;
  displayName?: string;
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

export type JournalTransactionType =
  | "INITIAL-PAYMENT"
  | "PAYMENT"
  | "DISCOUNT"
  | "SURCHARGE"
  | "EXPENSE"
  | "SALES"
  | "TRANSFER"
  | "LOAN";

export type DailyIncomeJournal = {
  id: string;
  incomeStatementId: number;
  date: string;
  transactionType: JournalTransactionType;
  amount: number;
  refNumber: string;
  description: string;
  currency: string;
  rate: number;
  employee?: AccountingLookup;
  account?: AccountingLookup;
  sourceAccount?: AccountingLookup;
  invoice?: {
    id?: string | number;
    number?: string;
    cost?: number;
    payment?: number;
    balance?: number;
  };
  paymentMethod?: AccountingLookup;
  accounts: Array<{
    id: number;
    name: string;
    type: string;
    debit: number;
    credit: number;
  }>;
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

export type DailyIncomeJournalValues = {
  transactionType: JournalTransactionType;
  amount: number;
  refNumber: string;
  description: string;
  employeeId?: number;
  employeeName?: string;
  accountId?: number;
  accountName?: string;
  accountType?: string;
  sourceAccountId?: number;
  sourceAccountName?: string;
  sourceAccountType?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  paymentMethodId?: number;
  paymentMethodName?: string;
};

export type ChartAccountType = "ASSET" | "EXPENSE" | "REVENUE" | "BANK" | "LOAN";

export type ChartAccount = {
  id: number;
  name: string;
  displayName: string;
  type: ChartAccountType;
  description: string;
  branch?: AccountingLookup;
  parentAccount?: AccountingLookup;
  systemAccount: boolean;
  branchAccount: boolean;
};

export type ChartAccountValues = {
  displayName: string;
  type: ChartAccountType;
  description: string;
  branchId?: number;
  branchCode?: string;
  parentAccountId?: number;
  parentAccountName?: string;
};

export type ChartAccountListParams = {
  page?: number;
  limit?: number;
  query?: string;
};

export type ChartAccountList = {
  items: ChartAccount[];
  page: number;
  resultsPerPage: number;
  total: number;
};

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
