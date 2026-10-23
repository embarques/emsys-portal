import { fetchBranches } from "@/lib/branches/api/branches-api";
import { fetchContainers } from "@/lib/containers/api/containers-api";
import { DEFAULT_CONTAINER_LIST_PARAMS } from "@/lib/containers/types";
import { fetchEmployeeByUserId } from "@/lib/employees/api/employees-api";
import {
  AssignedInvoiceContextError,
  resolveAssignedInvoiceContext,
  type AssignedInvoiceContext,
} from "@/lib/invoices/assigned-invoice";
import { fetchPickupDailyRoutesForEmployee } from "@/lib/pickup-delivery-routes/api/pickup-delivery-routes-api";
import { fetchCurrentUser } from "@/lib/users/api/users-api";

export async function fetchAssignedInvoiceContext(date: string): Promise<AssignedInvoiceContext> {
  const currentUser = await fetchCurrentUser();
  const employee = await fetchEmployeeByUserId(currentUser.id);
  if (!employee) throw new AssignedInvoiceContextError("employeeNotLinked");

  const [routes, containers, branches] = await Promise.all([
    fetchPickupDailyRoutesForEmployee(employee.id, date),
    fetchContainers({ ...DEFAULT_CONTAINER_LIST_PARAMS, limit: 1 }),
    // Branch type only refines office vs warehouse; the employee's department still decides.
    fetchBranches({ page: 1, limit: 200 })
      .then((result) => result.items)
      .catch(() => []),
  ]);

  return resolveAssignedInvoiceContext({
    date,
    currentUser,
    employee,
    routes,
    latestContainer: containers.items[0] ?? null,
    branches,
  });
}
