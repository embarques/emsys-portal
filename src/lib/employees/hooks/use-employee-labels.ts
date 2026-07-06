import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { getEmployeePortalBranch } from "@/lib/employees/types";
import type { Employee } from "@/lib/employees/types";

export function useEmployeeLabels() {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      active: (active: boolean) =>
        t(active ? "employees.enums.status.active" : "employees.enums.status.inactive"),
      branch: (employee: Pick<Employee, "branch" | "address">) => {
        const portal = getEmployeePortalBranch(employee);
        return t(`employees.enums.branch.${portal}`);
      },
      branchLabel: (employee: Pick<Employee, "branch" | "address">) => {
        const portal = getEmployeePortalBranch(employee);
        const branchName = t(`employees.enums.branch.${portal}`);
        const details = [employee.branch.name, employee.branch.code].filter(Boolean).join(" · ");
        return details ? `${branchName} (${details})` : branchName;
      },
      department: (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return t("common.empty.dash");
        const key = `employees.enums.department.${trimmed}`;
        const translated = t(key);
        return translated !== key ? translated : value;
      },
      title: (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return t("common.empty.dash");
        const key = `employees.enums.title.${trimmed}`;
        const translated = t(key);
        return translated !== key ? translated : value;
      },
    }),
    [t],
  );
}
