export type EmployeeTitle = {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
export type EmployeeTitleFormValues = Pick<EmployeeTitle, "name" | "active">;
export function titleToFormValues(value: EmployeeTitle): EmployeeTitleFormValues {
  return { name: value.name, active: value.active };
}
