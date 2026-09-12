import { DEFAULT_LOAN_LIST_PARAMS, type LoanListParams } from "@/lib/accounting/loans/types";
import type { TableFilterRowState } from "@/lib/table/filter-types";

export type LoanReportFormFilters = {
  employeeId: string;
  dateFrom: string;
  dateTo: string;
  status: string;
};

function filterRow(field: string, operator: string, value: string): TableFilterRowState {
  return {
    id: field,
    join: "and",
    field,
    operator,
    value,
  };
}

/** Map the Reports loan form onto the same filters the loans print action sends. */
export function buildLoanReportListParams(filters: LoanReportFormFilters): LoanListParams {
  const filterRows: TableFilterRowState[] = [];
  const employeeId = filters.employeeId.trim();
  const dateFrom = filters.dateFrom.slice(0, 10);
  const dateTo = filters.dateTo.slice(0, 10);
  const status = filters.status.trim();

  if (employeeId) {
    filterRows.push(filterRow("employee.id", "eq", employeeId));
  }

  if (dateFrom && dateTo) {
    filterRows.push(filterRow("openedAtRange", "eq", `${dateFrom} to ${dateTo}`));
  } else if (dateFrom) {
    filterRows.push(filterRow("openedAt", "gte", dateFrom));
  } else if (dateTo) {
    filterRows.push(filterRow("openedAt", "lte", dateTo));
  }

  if (status && status !== "all") {
    filterRows.push(filterRow("status", "eq", status));
  }

  return {
    ...DEFAULT_LOAN_LIST_PARAMS,
    page: 1,
    limit: 1,
    ...(filterRows.length > 0 ? { filterRows } : {}),
  };
}
