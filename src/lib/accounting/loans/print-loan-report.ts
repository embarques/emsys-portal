import { generateLoanReport } from "@/lib/reports/api/reports-api";
import type { ReportOutputFormat, ReportRequest, ReportResult } from "@/lib/reports/types";
import type { Loan } from "@/lib/accounting/loans/types";
import { downloadReportFile, openReportUrl } from "@/lib/reports/open-report";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Build the loan-statement payload for one selected loan (employee + period + loan id). */
export function buildSelectedLoanReportRequest(loan: Loan): ReportRequest {
  const today = todayIsoDate();
  const start = (loan.openedAt || loan.lastActivityAt || today).slice(0, 10);
  const activityEnd = (loan.lastActivityAt || today).slice(0, 10);
  const end = activityEnd > today ? activityEnd : today;

  return {
    type: "loan",
    collection: "loans",
    values: [loan.id],
    lookupField: "id",
    filters: [
      { field: "employee.id", operator: "eq", value: loan.employee.id },
      { field: "id", operator: "eq", value: Number(loan.id) || loan.id },
      { field: "transactionDate", operator: "gte", value: start },
      { field: "transactionDate", operator: "lte", value: end },
    ],
    operator: "and",
    format: "pdf",
    language: "es",
  };
}

/** Build print/export payload for one or more selected loan numeric ids. */
export function buildSelectedLoansReportRequest(
  loanIds: string[],
  format: ReportOutputFormat = "pdf",
): ReportRequest {
  const values = loanIds.map((id) => String(id).trim()).filter(Boolean);
  return {
    type: "loan",
    collection: "loans",
    values,
    lookupField: "id",
    format,
    language: "es",
  };
}

export async function printSelectedLoanReport(loan: Loan): Promise<ReportResult> {
  return generateLoanReport(buildSelectedLoanReportRequest(loan));
}

export async function printSelectedLoansReport(loanIds: string[]): Promise<ReportResult> {
  return generateLoanReport(buildSelectedLoansReportRequest(loanIds, "pdf"));
}

export async function exportSelectedLoansExcel(loanIds: string[]): Promise<ReportResult> {
  return generateLoanReport(buildSelectedLoansReportRequest(loanIds, "excel"));
}

export function openLoanReportUrl(url: string) {
  openReportUrl(url);
}

export async function downloadLoanExcelReport(result: ReportResult) {
  await downloadReportFile(result.url, result.fileName || "prestamos.xlsx");
}
