import { generateLoanReport } from "@/lib/reports/api/reports-api";
import type { ReportOutputFormat, ReportRequest, ReportResult } from "@/lib/reports/types";
import type { Loan } from "@/lib/accounting/loans/types";
import { downloadReportFile, openReportUrl } from "@/lib/reports/open-report";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function dateRangeFromLoans(loans: Loan[]): { start: string; end: string } {
  const today = todayIsoDate();
  let start = today;
  let end = today;

  for (const loan of loans) {
    const opened = (loan.openedAt || loan.lastActivityAt || today).slice(0, 10);
    const activity = (loan.lastActivityAt || loan.openedAt || today).slice(0, 10);
    if (opened && opened < start) start = opened;
    if (activity && activity > end) end = activity;
  }

  if (end < today) end = today;
  return { start, end };
}

/** Build the loan-statement payload for one selected loan (same shape as Reports). */
export function buildSelectedLoanReportRequest(loan: Loan): ReportRequest {
  return buildSelectedLoansReportRequest([loan], "pdf");
}

/**
 * Build print/export payload for selected loans.
 * PDF uses the same employee + date-range filters as the Reports workspace.
 * Excel uses selected numeric loan ids.
 */
export function buildSelectedLoansReportRequest(
  loans: Loan[],
  format: ReportOutputFormat = "pdf",
): ReportRequest {
  const values = loans.map((loan) => String(loan.id).trim()).filter(Boolean);

  if (format === "excel") {
    return {
      type: "loan",
      collection: "loans",
      values,
      lookupField: "id",
      format: "excel",
      language: "es",
    };
  }

  const employeeId = loans[0]?.employee.id;
  if (!employeeId) {
    throw new Error("Employee is required for the loan statement report.");
  }

  const { start, end } = dateRangeFromLoans(loans);
  const filters: NonNullable<ReportRequest["filters"]> = [
    { field: "employee.id", operator: "eq", value: employeeId },
  ];

  if (start === end) {
    filters.push({ field: "transactionDate", operator: "eq", value: start });
  } else {
    filters.push({ field: "transactionDate", operator: "gte", value: start });
    filters.push({ field: "transactionDate", operator: "lte", value: end });
  }

  // Keep selected ids when printing one or more loans so the API can scope the PDF.
  if (values.length === 1) {
    filters.push({ field: "id", operator: "eq", value: Number(values[0]) || values[0] });
  }

  return {
    type: "loan",
    collection: "loans",
    values,
    lookupField: "id",
    filters,
    operator: "and",
    format: "pdf",
    language: "es",
  };
}

export async function printSelectedLoanReport(loan: Loan): Promise<ReportResult> {
  return generateLoanReport(buildSelectedLoanReportRequest(loan));
}

export async function printSelectedLoansReport(loans: Loan[]): Promise<ReportResult> {
  return generateLoanReport(buildSelectedLoansReportRequest(loans, "pdf"));
}

export async function exportSelectedLoansExcel(loanIds: string[]): Promise<ReportResult> {
  return generateLoanReport({
    type: "loan",
    collection: "loans",
    values: loanIds.map((id) => String(id).trim()).filter(Boolean),
    lookupField: "id",
    format: "excel",
    language: "es",
  });
}

export function openLoanReportUrl(url: string) {
  openReportUrl(url);
}

export async function downloadLoanExcelReport(result: ReportResult) {
  await downloadReportFile(result.url, result.fileName || "prestamos.xlsx");
}
