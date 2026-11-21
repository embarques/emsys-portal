import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { TransactionAssigneeSelect } from "@/components/accounting/transaction-assignee-select";
import { InvoiceResponsibilitySelect } from "@/components/accounting/invoice-responsibility-select";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import type { Employee } from "@/lib/employees/types";

const routes = [...[5, 99].map((id) => ({
  id: String(id), name: id === 5 ? "My route" : "Other route", date: new Date().toISOString().slice(0, 10),
  active: true, routeType: "pickup", branch: { id: 1, code: "NY" },
  employees: [{ id, name: `Supervisor ${id}`, role: "supervisor" }],
})), { id: "ambiguous", name: "Ambiguous route", date: new Date().toISOString().slice(0, 10),
  active: true, routeType: "pickup", branch: { id: 1, code: "NY" },
  employees: [{ id: 5, name: "Supervisor 5", role: "supervisor" }, { id: 99, name: "Supervisor 99", role: "supervisor" }],
}] as ActiveRoute[];

function Fixture() {
  const [values, setValues] = useState<Record<string, string | number | undefined>>({ assigneeSource: "creator" });
  const [invoice, setInvoice] = useState<NonNullable<DailyIncomeJournalValues["invoiceResponsibility"]>>({});
  const canAssign = location.hash.includes("assign");
  const split = location.hash.includes("split");
  const employees = [{ id: 5, name: "Self", department: "", title: "", active: true, branch: { id: 1 } }, { id: 99, name: "Other employee", department: "", title: "", active: true, branch: { id: 1 } }] as Employee[];
  return <main>{split ? <section aria-label="Invoice responsibility"><InvoiceResponsibilitySelect value={invoice} onChange={setInvoice} employees={employees} dailyRoutes={routes} branchId={1} /></section> : null}
    <section aria-label="Payment responsibility"><TransactionAssigneeSelect
    guided singleColumn canAssignResponsibility={split ? location.hash.includes("payment-grant") : canAssign} ownEmployeeId={5}
    readOnly={location.hash.includes("readonly")} employeeName={location.hash.includes("readonly") ? "Saved responsible person" : undefined}
    employees={[{ id: 5, name: "Self", department: "", title: "", active: true, branch: { id: 1 } }, { id: 99, name: "Other employee", department: "", title: "", active: true, branch: { id: 1 } }] as Employee[]}
    dailyRoutes={routes} statementBranchId={1}
    assigneeSource={values.assigneeSource as "creator" | "route" | "employee"}
    routeId={values.routeId as string | undefined} routeName={values.routeName as string | undefined}
    employeeId={values.employeeId as number | undefined} supervisorId={values.supervisorId as number | undefined} supervisorName={values.supervisorName as string | undefined}
    setValue={(name, value) => setValues((current) => ({ ...current, [name]: value }))}
  /></section><output id="values">{JSON.stringify(split ? { invoice, payment: values } : values)}</output></main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
