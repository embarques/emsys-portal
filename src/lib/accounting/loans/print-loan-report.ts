import { generateLoanReport } from "@/lib/reports/api/reports-api";
import type { ReportResult } from "@/lib/reports/types";
import { buildLoanReportFilters } from "@/lib/accounting/loans/api";
import type { LoanListParams } from "@/lib/accounting/loans/types";

export async function printLoanReport(params: LoanListParams): Promise<ReportResult> {
  return generateLoanReport({
    type: "loan",
    collection: "loans",
    filters: buildLoanReportFilters(params),
    operator: "and",
  });
}

export function openLoanReportUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
