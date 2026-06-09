import type { Employee } from "./types";
import { createEmployeeBranchFromPortal, createEmptyEmployeeAddress } from "./types";

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 1,
    name: "MIGUEL",
    department: "driver",
    title: "supervisor",
    active: true,
    startDate: "2024-01-01T08:00:00Z",
    endDate: "",
    branch: createEmployeeBranchFromPortal("usa"),
    address: {
      ...createEmptyEmployeeAddress("US"),
      city: "NEW YORK",
    },
    phone1: "",
    phone2: "",
    email: "",
    cost: 0,
    loanAmountOwed: 0,
    loanBalanceUpdated: "",
    totalLoanGiven: 0,
    totalPaymentReceived: 0,
    user: null,
    createdAt: "",
    updatedAt: "",
  },
];

export function cloneEmployees(): Employee[] {
  return structuredClone(MOCK_EMPLOYEES);
}

export function getEmployeeById(employeeId: string): Employee | undefined {
  return MOCK_EMPLOYEES.find((employee) => String(employee.id) === employeeId);
}
