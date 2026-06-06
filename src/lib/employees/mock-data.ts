import type { Employee } from "./types";

export const MOCK_EMPLOYEES: Employee[] = [
  {
    employeeId: "emp-001",
    firstName: "Carlos",
    lastName: "Ramírez",
    department: "Operations",
    title: "Dispatch Lead",
    role: "dispatcher",
    branch: "NY",
    status: "active",
  },
  {
    employeeId: "emp-002",
    firstName: "María",
    lastName: "López",
    department: "Warehouse",
    title: "Inventory Supervisor",
    role: "warehouse",
    branch: "NY",
    status: "active",
  },
  {
    employeeId: "emp-003",
    firstName: "James",
    lastName: "Miller",
    department: "Fleet",
    title: "Driver",
    role: "driver",
    branch: "NY",
    status: "active",
  },
  {
    employeeId: "emp-004",
    firstName: "Ana",
    lastName: "Martínez",
    department: "Customer Service",
    title: "Client Support",
    role: "support",
    branch: "RD",
    status: "active",
  },
  {
    employeeId: "emp-005",
    firstName: "Luis",
    lastName: "Fernández",
    department: "Fleet",
    title: "Driver",
    role: "driver",
    branch: "RD",
    status: "active",
  },
  {
    employeeId: "emp-006",
    firstName: "Sarah",
    lastName: "Chen",
    department: "Operations",
    title: "Route Planner",
    role: "planner",
    branch: "NY",
    status: "inactive",
  },
  {
    employeeId: "emp-007",
    firstName: "Pedro",
    lastName: "Gómez",
    department: "Warehouse",
    title: "Loader",
    role: "warehouse",
    branch: "RD",
    status: "active",
  },
  {
    employeeId: "emp-008",
    firstName: "Emily",
    lastName: "Johnson",
    department: "Administration",
    title: "Office Manager",
    role: "admin",
    branch: "NY",
    status: "active",
  },
];

export function cloneEmployees(): Employee[] {
  return MOCK_EMPLOYEES.map((employee) => ({ ...employee }));
}

export function getEmployeeById(employeeId: string): Employee | undefined {
  return MOCK_EMPLOYEES.find((employee) => employee.employeeId === employeeId);
}
