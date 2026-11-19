import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { TransactionAssigneeSelect } from "@/components/accounting/transaction-assignee-select";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import type { Employee } from "@/lib/employees/types";

const routes = [5, 99].map((id) => ({
  id: String(id), name: id === 5 ? "My route" : "Other route", date: new Date().toISOString().slice(0, 10),
  active: true, routeType: "pickup", branch: { id: 1, code: "NY" },
  employees: [{ id, name: `Supervisor ${id}`, role: "supervisor" }],
})) as ActiveRoute[];

function Fixture() {
  const [values, setValues] = useState<Record<string, string | number | undefined>>({ assigneeSource: "creator" });
  const canAssign = location.hash.includes("assign");
  return <main><TransactionAssigneeSelect
    guided singleColumn canAssignResponsibility={canAssign} ownEmployeeId={5}
    readOnly={location.hash.includes("readonly")} employeeName={location.hash.includes("readonly") ? "Saved responsible person" : undefined}
    employees={[{ id: 5, name: "Self", department: "", title: "", active: true, branch: { id: 1 } }, { id: 99, name: "Other employee", department: "", title: "", active: true, branch: { id: 1 } }] as Employee[]}
    dailyRoutes={routes} statementBranchId={1}
    assigneeSource={values.assigneeSource as "creator" | "route" | "employee"}
    routeId={values.routeId as string | undefined} routeName={values.routeName as string | undefined}
    employeeId={values.employeeId as number | undefined} supervisorId={values.supervisorId as number | undefined}
    setValue={(name, value) => setValues((current) => ({ ...current, [name]: value }))}
  /><output id="values">{JSON.stringify(values)}</output></main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
