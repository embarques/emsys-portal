import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { InvoiceFormValues } from "./types";

export function invoiceSelfResponsibility(): Pick<InvoiceFormValues, "pickupSource" | "pickupEmployeeId" | "pickupEmployeeName" | "routeId" | "routeCrewId" | "routeCrewName" | "officeBranchId" | "officeBranchName"> {
  return { pickupSource: "creator", pickupEmployeeId: "", pickupEmployeeName: "", routeId: "", routeCrewId: "", routeCrewName: "", officeBranchId: "", officeBranchName: "" };
}

/** Merchandise assignment is sent separately from every payment's collector. */
export function buildInvoiceResponsibilityInput(values: InvoiceFormValues): NonNullable<DailyIncomeJournalValues["invoiceResponsibility"]> {
  if (values.pickupSource === "route" && values.routeId.trim()) return { dailyRouteId: values.routeId.trim() };
  const id = Number(values.pickupEmployeeId);
  if ((values.pickupSource === "office" || values.pickupSource === "warehouse") && Number.isInteger(id) && id > 0) {
    return { employee: { id, name: values.pickupEmployeeName.trim() } };
  }
  return {};
}
