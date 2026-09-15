import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import type { Employee } from "@/lib/employees/types";

export function useEmployeeLabels() {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      active: (active: boolean) =>
        t(active ? "employees.enums.status.active" : "employees.enums.status.inactive"),
      branch: (employee: Pick<Employee, "branch" | "address">) =>
        employee.branch.name || employee.branch.code || t("common.empty.dash"),
      branchLabel: (employee: Pick<Employee, "branch" | "address">) =>
        [employee.branch.name, employee.branch.code].filter(Boolean).join(" · ") || t("common.empty.dash"),
      department: (value: string) => value.trim() || t("common.empty.dash"),
      title: (value: string) => value.trim() || t("common.empty.dash"),
    }),
    [t],
  );
}
