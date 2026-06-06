export type EmployeeStatus = "active" | "inactive";

export type Employee = {
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  title: string;
  role: string;
  branch: "NY" | "RD" | "";
  status: EmployeeStatus;
};

export function getEmployeeFullName(employee: Employee): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export function getEmployeeLabel(employee: Employee): string {
  return `${getEmployeeFullName(employee)} · ${employee.role}`;
}
