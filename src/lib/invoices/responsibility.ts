import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";
import type { InvoiceFormValues } from "./types";
import type { InvoiceWriteContext } from "./api/invoices-api";

export function invoiceSelfResponsibility(): Pick<InvoiceFormValues, "pickupSource" | "pickupEmployeeId" | "pickupEmployeeName" | "routeId" | "routeCrewId" | "routeCrewName" | "officeBranchId" | "officeBranchName"> {
  return { pickupSource: "creator", pickupEmployeeId: "", pickupEmployeeName: "", routeId: "", routeCrewId: "", routeCrewName: "", officeBranchId: "", officeBranchName: "" };
}

/** Use the committed journal party, never the user's stale pre-registration selection. */
export function applyRegisteredInvoiceResponsibility(values: InvoiceFormValues, journal: DailyIncomeJournal): InvoiceFormValues {
  const route = journal.route;
  if (route?.id) return { ...values, ...invoiceSelfResponsibility(), pickupSource: "route",
    routeId: String(route.id), routeCrewName: route.name ?? "" };
  if (journal.employee?.id) return { ...values, ...invoiceSelfResponsibility(),
    pickupSource: values.pickupSource === "warehouse" ? "warehouse" : "office",
    pickupEmployeeId: String(journal.employee.id), pickupEmployeeName: journal.employee.name ?? "" };
  return { ...values, ...invoiceSelfResponsibility() };
}

/** The posting response already contains the party; completion needs no directory lookup. */
export function registeredInvoicePickupAssignment(values: InvoiceFormValues, journal: DailyIncomeJournal): InvoiceWriteContext["pickupAssignment"] {
  if (journal.route?.id) return { source: "route", dailyRoute: { id: String(journal.route.id), name: journal.route.name } };
  if (journal.employee?.id) return { source: values.pickupSource === "warehouse" ? "warehouse" : "office",
    pickupEmployee: { id: journal.employee.id, name: journal.employee.name } };
  return undefined;
}
