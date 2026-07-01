import type { ApiListSortInput } from "@/lib/api/list-query";
import type { ApiListTextSearch } from "@/lib/api/search-query";

export type ChartAccountType = "ASSET" | "EXPENSE" | "REVENUE" | "BANK" | "LOAN";

export type ChartAccountRef = {
  id: number;
  name: string;
  code?: string;
  displayName?: string;
};

export type ChartAccount = {
  id: number;
  name: string;
  displayName: string;
  type: ChartAccountType;
  description: string;
  branch?: ChartAccountRef;
  parentAccount?: ChartAccountRef;
  systemAccount: boolean;
  branchAccount: boolean;
  default: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
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
  offset?: number;
  sort?: ApiListSortInput;
  /** Bar search — uses POST /chart-accounts/search when set. */
  search?: ApiListTextSearch;
  /** @deprecated Prefer `search`. Kept for existing callers. */
  query?: string;
  type?: ChartAccountType;
};

export type ChartAccountList = {
  items: ChartAccount[];
  page: number;
  resultsPerPage: number;
  total: number;
};

export const DEFAULT_CHART_ACCOUNT_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "displayName:asc",
} as const satisfies ChartAccountListParams;

export const CHART_ACCOUNT_TYPES: { value: ChartAccountType; label: string }[] = [
  { value: "ASSET", label: "Asset" },
  { value: "EXPENSE", label: "Expense" },
  { value: "REVENUE", label: "Revenue" },
  { value: "BANK", label: "Bank" },
  { value: "LOAN", label: "Loan" },
];
