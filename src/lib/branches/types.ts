import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { createDefaultRecordPhones } from "@/lib/phones/phones";
import type { RecordPhone } from "@/lib/phones/types";

export type BranchAddress = {
  address1: string;
  address2: string;
  apartment: string;
  city: string;
  country: string;
  state: string;
  zipcode: string;
};

export type BranchSettings = {
  defaultLabelStatus: number;
  imageResampleBy: number;
  invoiceCreatedThruIncomeStatement: boolean;
  labelPrefix: string;
  printLabelCount: boolean;
  roundDecimalPlaces: number;
  s3BucketFolder: string;
  s3BucketName: string;
  s3Profile: string;
  s3ShareLinkExpireMinutes: number;
};

export type Branch = {
  id: number;
  name: string;
  code: string;
  type: string;
  phones: RecordPhone[];
  logo: string;
  disclaimer: string;
  createdAt: string;
  address: BranchAddress;
  settings: BranchSettings;
};

export type BranchFormValues = {
  id: number;
  name: string;
  code: string;
  type: string;
  phones: RecordPhone[];
  logo: string;
  disclaimer: string;
  address: BranchAddress;
  settings: BranchSettings;
};

export type BranchSearchOperator = "eq" | "neq" | "contains" | "startsWith";

/**
 * Fields the EMSYS API allows in branch search/filter queries. This list is
 * authoritative — the API rejects any other field with HTTP 400.
 * (e.g. `disclaimer`, `address.country`, `settings.labelPrefix`
 * are NOT searchable; use `phones.number`, `address.zipcode`, etc.)
 */
export type BranchSearchField =
  | "id"
  | "name"
  | "code"
  | "type"
  | "address.city"
  | "address.state"
  | "address.zipcode"
  | "phones.number"
  | "phones.type"
  | "phones.isPrimary"
  | "createdAt"
  | "updatedAt"
  | "createdBy.id"
  | "createdBy.name"
  | "updatedBy.id"
  | "updatedBy.name";

export type BranchSearchFilter = ApiListTextSearch;

export type BranchFilterState = {
  query: string;
  rows: TableFilterRowState[];
};

export type BranchListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: BranchSearchFilter;
  filterRows?: TableFilterRowState[];
  /** @deprecated Use filterRows */
  type?: string;
};

/** GET /branches?page=1&limit=50&offset=0&sort=name:asc */
export const DEFAULT_BRANCH_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "name:asc",
} as const satisfies Pick<BranchListParams, "page" | "limit" | "sort">;

export const BRANCH_SEARCH_FIELDS: { value: BranchSearchField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "code", label: "Code" },
  { value: "type", label: "Type" },
  { value: "phones.number", label: "Phone" },
  { value: "address.city", label: "City" },
  { value: "address.state", label: "State" },
  { value: "address.zipcode", label: "Zip code" },
];

export const BRANCH_SEARCH_OPERATORS: { value: BranchSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
];

export function createEmptyBranchAddress(): BranchAddress {
  return {
    address1: "",
    address2: "",
    apartment: "",
    city: "",
    country: "",
    state: "",
    zipcode: "",
  };
}

export function createEmptyBranchSettings(): BranchSettings {
  return {
    defaultLabelStatus: 1,
    imageResampleBy: 0,
    invoiceCreatedThruIncomeStatement: false,
    labelPrefix: "",
    printLabelCount: false,
    roundDecimalPlaces: 2,
    s3BucketFolder: "",
    s3BucketName: "",
    s3Profile: "",
    s3ShareLinkExpireMinutes: 0,
  };
}

export function createEmptyBranchForm(): BranchFormValues {
  return {
    id: 0,
    name: "",
    code: "",
    type: "",
    phones: createDefaultRecordPhones(),
    logo: "",
    disclaimer: "",
    address: createEmptyBranchAddress(),
    settings: createEmptyBranchSettings(),
  };
}

export function createBranchSearchFilter(value: string): BranchSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildBranchListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  sort?: ApiListSortInput;
}): BranchListParams {
  const params: BranchListParams = {
    ...DEFAULT_BRANCH_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_BRANCH_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_BRANCH_LIST_PARAMS.sort,
  };

  const search = createBranchSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter((row) => isCompleteFilterRow(row));
  if (completeRows.length > 0) {
    params.filterRows = completeRows;
  }

  return params;
}

export function branchToFormValues(branch: Branch): BranchFormValues {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    type: branch.type,
    phones: branch.phones.map((phone) => ({ ...phone })),
    logo: branch.logo,
    disclaimer: branch.disclaimer,
    address: { ...branch.address },
    settings: { ...branch.settings },
  };
}

export function areBranchFormValuesEquivalent(
  left: BranchFormValues,
  right: BranchFormValues,
): boolean {
  return areFormValuesEquivalent(left, right);
}
