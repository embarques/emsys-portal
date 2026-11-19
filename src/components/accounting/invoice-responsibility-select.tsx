"use client";

import { useEffect, useRef, useState } from "react";
import { TransactionAssigneeSelect } from "./transaction-assignee-select";
import { useResponsibilityAccess } from "@/lib/accounting/daily-income/use-responsibility-access";
import { canSelectResponsibleRoute } from "@/lib/accounting/daily-income/responsibility";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

type Selection = NonNullable<DailyIncomeJournalValues["invoiceResponsibility"]>;

export function InvoiceResponsibilitySelect({ value, onChange, employees, dailyRoutes, branchId }: {
  value: Selection; onChange: (value: Selection) => void; employees: Employee[]; dailyRoutes: ActiveRoute[]; branchId?: number | null;
}) {
  const access = useResponsibilityAccess("INVOICE");
  const [source, setSource] = useState<"creator" | "employee" | "route">(value.dailyRouteId ? "route" : value.employee ? "employee" : "creator");
  const sourceRef = useRef(source);
  const route = dailyRoutes.find((entry) => entry.id === value.dailyRouteId);
  useEffect(() => {
    if (!access.ready || access.canAssign || !value.employee && !value.dailyRouteId) return;
    if (route && canSelectResponsibleRoute(route, false, access.ownEmployee?.id)) return;
    onChange({});
  }, [access.ready, access.canAssign, access.ownEmployee?.id, onChange, route, value]);
  return <TransactionAssigneeSelect
    id="invoice-responsibility" singleColumn
    canAssignResponsibility={access.canAssign} ownEmployeeId={access.ownEmployee?.id}
    employees={employees} dailyRoutes={dailyRoutes} statementBranchId={branchId}
    assigneeSource={value.dailyRouteId ? "route" : value.employee ? "employee" : source}
    employeeId={value.employee?.id} employeeName={value.employee?.name}
    routeId={value.dailyRouteId} routeName={route?.name}
    setValue={(name, next) => {
      if (name === "assigneeSource" && (next === "creator" || next === "employee" || next === "route")) {
        setSource(next);
        sourceRef.current = next;
        onChange({});
      }
      if (name === "employeeId" && typeof next === "number") onChange({ employee: { id: next, name: employees.find((employee) => employee.id === next)?.name ?? "" } });
      if (name === "routeId" && typeof next === "string" && next) onChange({ dailyRouteId: next });
      if (next === undefined && (name === "employeeId" && sourceRef.current === "employee" || name === "routeId" && sourceRef.current === "route")) onChange({});
    }}
  />;
}
