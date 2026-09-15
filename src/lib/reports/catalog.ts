import type { ReportType } from "@/lib/reports/types";

export const REPORT_TYPE_ORDER = [
  "pickup",
  "delivery",
  "invoice",
  "label",
  "income",
  "journal",
  "loan",
  "customs-form",
  "customs-sender",
] as const satisfies readonly ReportType[];
