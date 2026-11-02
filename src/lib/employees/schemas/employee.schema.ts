import { z } from "zod";
import type { EmployeeFormValues } from "@/lib/employees/types";
import { normalizeEmployeeDate } from "@/lib/employees/utils/employee-date";

export const employeeFormSchema = z.custom<EmployeeFormValues>().superRefine((values, context) => {
  for (const field of ["name", "department", "title"] as const) {
    if (!values[field].trim()) context.addIssue({ code: "custom", path: [field], message: "common.validation.required" });
  }
  if (!Number.isInteger(values.branch.id) || values.branch.id <= 0) {
    context.addIssue({ code: "custom", path: ["branch"], message: "employees.form.validation.branchRequired" });
  }
  for (const field of ["startDate", "endDate"] as const) {
    try { normalizeEmployeeDate(values[field]); }
    catch { context.addIssue({ code: "custom", path: [field], message: "employees.form.validation.invalidDate" }); }
  }
});
