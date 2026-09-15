export type EmployeeDepartment = {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
export type EmployeeDepartmentFormValues = Pick<EmployeeDepartment, "name" | "active">;
export function departmentToFormValues(value: EmployeeDepartment): EmployeeDepartmentFormValues {
  return { name: value.name, active: value.active };
}
