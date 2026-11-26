"use client";

import { Fragment, useState, type ReactNode } from "react";
import { EmployeePicker } from "@/components/employees/employee-picker";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";

export function RouteWorklist({ canViewOthers, children }: {
  canViewOthers: boolean;
  children: (employee: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [employee, setEmployee] = useState("");
  const scope = canViewOthers && employee ? employee : "me";
  return <>
    {canViewOthers && <div className="mb-3 max-w-sm">
      <label className="text-sm font-medium" htmlFor="route-worklist-employee">{t("orders.routeWorkEmployee")}</label>
      {hasPermission(PERMISSIONS.employeesView.name, PERMISSIONS.employeesView.resourceType)
        ? <EmployeePicker id="route-worklist-employee" value={employee} onChange={setEmployee} placeholder={t("orders.myRouteWork")} />
        : <input id="route-worklist-employee" className="flex h-9 w-full rounded-md border px-3" type="number" min={1} max={65535}
            placeholder={t("orders.myRouteWork")} onBlur={(event) => {
              const input = event.currentTarget;
              if (input.reportValidity()) setEmployee(input.value);
            }} />}
    </div>}
    <Fragment key={scope}>{children(scope)}</Fragment>
  </>;
}
