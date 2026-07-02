import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import type { Employee } from "@/lib/employees/types";

export function buildTransactionAssigneeOptions(employees: Employee[]): SearchableSelectOption[] {
  return [...employees]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((employee) => ({
      value: String(employee.id),
      label: employee.name,
      keywords: [employee.name, employee.department, employee.title],
    }));
}

export function getTransactionAssigneeSelectValue(employeeId?: number): string {
  return employeeId ? String(employeeId) : "";
}

export function getTransactionAssigneeDisplayName(
  employeeName?: string,
  employeeGroupName?: string,
): string {
  return employeeName?.trim() || employeeGroupName?.trim() || "";
}
