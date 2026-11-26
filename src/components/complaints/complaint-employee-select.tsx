"use client";

import type { ComponentProps } from "react";
import { EmployeePicker } from "@/components/employees/employee-picker";
import { useTranslation } from "@/lib/i18n";

export function ComplaintEmployeeSelect(props: Omit<ComponentProps<typeof EmployeePicker>, "placeholder" | "searchPlaceholder" | "emptyMessage">) {
  const { t } = useTranslation();
  return <EmployeePicker {...props} placeholder={t("complaints.form.employeePlaceholder")}
    searchPlaceholder={t("complaints.form.employeeSearch")} emptyMessage={t("complaints.form.employeeEmpty")} />;
}
