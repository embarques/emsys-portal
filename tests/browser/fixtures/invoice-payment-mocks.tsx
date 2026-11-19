import React from "react";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { UseFormSetValue, UseFormWatch } from "react-hook-form";

const methods = [{ id: 1, name: "CASH" }];
const routes = { items: [] };
export function useResponsibilityAccess(type: string) {
  return { ready: true, canAssign: !location.hash.includes("self") || type === "INVOICE", ownEmployee: { id: 5 } };
}
export function useAuth() { return { hasPermission: () => true }; }
export function useFeedback() { return { notifySuccess: () => {}, notifyError: (error: string) => { document.getElementById("error")!.textContent = error; } }; }
export function useEmployees() { return { data: { items: [] } }; }
export function useActiveRoutePicker() { return { data: routes }; }
export function useChartAccounts() { return { data: routes }; }
export function useAccountingPaymentMethods() { return { data: methods }; }
export function useCreateDailyIncomeJournal() {
  return { isPending: false, mutateAsync: async ({ values }: { values: DailyIncomeJournalValues }) => {
    document.getElementById("posted")!.textContent = JSON.stringify(values);
    return { id: "posted", amount: values.amount, employee: { id: values.employeeId }, invoice: { number: "00042" } };
  } };
}

// Replace the large field layout only. The tested form retains its production RHF,
// Zod validation, defaults, effects, navigation snapshot and submission handler.
export function RegisterInvoiceTransactionFields({ watch, setValue }: {
  watch: UseFormWatch<DailyIncomeJournalValues>; setValue: UseFormSetValue<DailyIncomeJournalValues>;
}) {
  return <>
    <output id="collector">{watch("employeeId") ?? "self"}</output>
    <button type="button" onClick={() => { setValue("assigneeSource", "employee", { shouldValidate: true }); setValue("employeeId", 99, { shouldValidate: true }); setValue("employeeName", "Collector", { shouldValidate: true }); }}>Choose collector</button>
    <label>Amount<input value={watch("amount") ?? 0} onChange={(event) => setValue("amount", Number(event.target.value))} /></label>
  </>;
}
