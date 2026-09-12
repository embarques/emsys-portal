import { generateIncomeReport } from "@/lib/reports/api/reports-api";
import type { ReportRequest, ReportResult } from "@/lib/reports/types";

export function buildIncomeReportRequest(
  statementId: number,
  options?: { employeeId?: number | null },
): ReportRequest {
  const request: ReportRequest = {
    type: "income",
    collection: "income_statements",
    values: [String(statementId)],
    lookupField: "id",
  };

  const employeeId = options?.employeeId;
  if (employeeId != null && employeeId > 0) {
    request.operator = "and";
    request.filters = [{ field: "employee.id", operator: "eq", value: employeeId }];
  }

  return request;
}

export async function printIncomeReport(
  statementId: number,
  options?: { employeeId?: number | null },
): Promise<ReportResult> {
  return generateIncomeReport(buildIncomeReportRequest(statementId, options));
}

export function openIncomeReportUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
