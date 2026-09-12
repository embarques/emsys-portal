import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { FALLBACK_BARCODE_STATUS_OPTIONS } from "@/lib/labels/types";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { BARCODE_TABLE_FILTER_FIELDS } from "@/lib/barcodes/filter-fields";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";

export type { Barcode } from "@/lib/labels/types";

export type BarcodeFormValues = {
  id: number;
  number: string;
  statusId: string;
  containerId: string;
};

export type BarcodeSearchFilter = ApiListTextSearch;

export type BarcodeFilterState = {
  query: string;
  rows: TableFilterRowState[];
};

export type BarcodeListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: BarcodeSearchFilter;
  filterRows?: TableFilterRowState[];
};

export const DEFAULT_BARCODE_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "id:desc",
} as const satisfies Pick<BarcodeListParams, "page" | "limit" | "sort">;

export function createEmptyBarcodeForm(): BarcodeFormValues {
  return {
    id: 0,
    number: "",
    statusId: String(FALLBACK_BARCODE_STATUS_OPTIONS[0]?.id ?? 1),
    containerId: "",
  };
}

export function createBarcodeSearchFilter(value: string): BarcodeSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildBarcodeListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  sort?: ApiListSortInput;
}): BarcodeListParams {
  const params: BarcodeListParams = {
    ...DEFAULT_BARCODE_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_BARCODE_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_BARCODE_LIST_PARAMS.sort,
  };

  const search = createBarcodeSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter((row) =>
    isCompleteFilterRow(row, BARCODE_TABLE_FILTER_FIELDS),
  );
  if (completeRows.length > 0) {
    params.filterRows = completeRows;
  }

  return params;
}

export function barcodeToFormValues(barcode: {
  id: number;
  number: string;
  status: { id?: number; name: string } | null;
  container: { id?: number; name: string } | null;
}): BarcodeFormValues {
  const statusId =
    barcode.status?.id != null && barcode.status.id > 0
      ? String(barcode.status.id)
      : String(
          FALLBACK_BARCODE_STATUS_OPTIONS.find(
            (option) => option.name.toUpperCase() === barcode.status?.name.trim().toUpperCase(),
          )?.id ?? FALLBACK_BARCODE_STATUS_OPTIONS[0]?.id ?? 1,
        );

  return {
    id: barcode.id,
    number: barcode.number,
    statusId,
    containerId: barcode.container?.id != null && barcode.container.id > 0 ? String(barcode.container.id) : "",
  };
}

export function areBarcodeFormValuesEquivalent(
  left: BarcodeFormValues,
  right: BarcodeFormValues,
): boolean {
  return areFormValuesEquivalent(left, right);
}

export function validateBarcodeFormValues(values: BarcodeFormValues): void {
  if (!values.number.trim()) {
    throw new Error("Barcode number is required.");
  }

  const statusId = Number(values.statusId);
  if (!Number.isFinite(statusId) || statusId <= 0) {
    throw new Error("Select a valid status.");
  }
}
