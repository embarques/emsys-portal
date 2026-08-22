import type { ApiListSortInput } from "@/lib/api/list-query";
import type { ApiListTextSearch } from "@/lib/api/search-query";
import type { AccountingLookup } from "@/lib/accounting/daily-income/types";
import type { TableFilterRowState } from "@/lib/table/filter-builder";

export type LoanStatus = "ACTIVE" | "PAID" | "VOID";

export type LoanTransactionType = "ISSUE" | "PAYMENT";

export type LoanAccountRef = AccountingLookup & {
  type?: string;
};

export type LoanEmployeeRef = {
  id: number;
  name: string;
};

export type LoanBranchRef = {
  id: number;
  name: string;
  code: string;
};

export type Loan = {
  id: string;
  employee: LoanEmployeeRef;
  branch?: LoanBranchRef;
  incomeStatement?: AccountingLookup;
  loanAccount?: LoanAccountRef;
  principalAmount: number;
  paidAmount: number;
  balance: number;
  status: LoanStatus;
  description: string;
  referenceNumber: string;
  openedAt: string;
  lastActivityAt: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type LoanTransaction = {
  id: string;
  loanId: string;
  journalEntryId?: string;
  type: LoanTransactionType;
  amount: number;
  assetAccount?: LoanAccountRef;
  transactionDate: string;
  referenceNumber: string;
  description: string;
  createdAt: string;
  createdBy?: string;
};

export type LoanSummary = {
  outstandingBalance: number;
  loanedInRange: number;
  paidInRange: number;
  activeLoans: number;
};

export type LoanListResult = {
  items: Loan[];
  summary: LoanSummary;
  page: number;
  resultsPerPage: number;
  total: number;
};

export type LoanListParams = {
  page?: number;
  limit?: number;
  sort?: ApiListSortInput;
  search?: ApiListTextSearch;
  filterRows?: TableFilterRowState[];
};

export type LoanCreateValues = {
  employeeId: number;
  employeeName?: string;
  loanAccountId: number;
  loanAccountName?: string;
  sourceAccountId: number;
  sourceAccountName?: string;
  principalAmount: number;
  transactionDate: string;
  referenceNumber: string;
  description: string;
};

export type LoanPaymentAllocationMode = "oldest-first" | "specific-loan";

export type LoanPaymentValues = {
  employeeId: number;
  employeeName?: string;
  allocationMode: LoanPaymentAllocationMode;
  loanId?: string;
  receivedAccountId: number;
  receivedAccountName?: string;
  amount: number;
  transactionDate: string;
  referenceNumber: string;
  description: string;
};

export const DEFAULT_LOAN_LIST_PARAMS = {
  page: 1,
  limit: 20,
  sort: "lastActivityAt:desc",
} as const satisfies Pick<LoanListParams, "page" | "limit" | "sort">;

export const EMPTY_LOAN_SUMMARY: LoanSummary = {
  outstandingBalance: 0,
  loanedInRange: 0,
  paidInRange: 0,
  activeLoans: 0,
};
