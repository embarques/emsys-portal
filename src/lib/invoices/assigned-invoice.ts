import { resolveUserBranchRef } from "@/lib/branches/user-branch";
import type { Branch } from "@/lib/branches/types";
import type { Container } from "@/lib/containers/types";
import type { Employee } from "@/lib/employees/types";
import type { InvoiceWriteContext, InvoiceWriteEmployeeRef } from "@/lib/invoices/api/invoices-api";
import type { InvoiceFormValues } from "@/lib/invoices/types";
import { isDeliveryBranchCode, type ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import type { User } from "@/lib/users/types";

type BranchRef = { id: number; code: string; name: string };

export type AssignedInvoiceReceivedBy =
  | {
      source: "route";
      dailyRoute: { id: string; name: string };
    }
  | {
      source: "office" | "warehouse";
      employee: InvoiceWriteEmployeeRef;
      officeBranch: BranchRef;
    };

/** Everything step 1 of the invoice wizard needs, resolved from the signed-in user. */
export type AssignedInvoiceContext = {
  date: string;
  container: { id: number; name: string };
  branch: BranchRef;
  receivedBy: AssignedInvoiceReceivedBy;
};

export type AssignedInvoiceContextErrorCode = "employeeNotLinked" | "noAssignment" | "noContainer";

export class AssignedInvoiceContextError extends Error {
  readonly code: AssignedInvoiceContextErrorCode;

  constructor(code: AssignedInvoiceContextErrorCode) {
    super(`Assigned invoice context unavailable: ${code}`);
    this.name = "AssignedInvoiceContextError";
    this.code = code;
  }
}

export function employeeToInvoiceWriteRef(
  employee: Pick<Employee, "id" | "name"> & { email?: string; user?: { email?: string } | null },
  fallbackName = "",
): InvoiceWriteEmployeeRef {
  const userName = employee.user?.email?.trim() || employee.email?.trim() || undefined;
  const fullName = employee.name.trim();

  return {
    id: employee.id,
    name: fullName || fallbackName,
    ...(userName ? { userName } : {}),
    ...(fullName ? { fullName } : {}),
  };
}

/** Same office/warehouse rules the invoice form uses to list pickup employees. */
export function resolveEmployeeOfficeSource(
  employee: Pick<Employee, "active" | "branch" | "department" | "title">,
  branchType: string,
): "office" | "warehouse" | null {
  if (!employee.active || isDeliveryBranchCode(employee.branch.code)) return null;

  const type = branchType.trim().toLowerCase();
  const isWarehouseRole =
    employee.department.trim().toLowerCase() === "warehouse" ||
    employee.title.trim().toLowerCase() === "warehouse";

  return type === "warehouse" || isWarehouseRole ? "warehouse" : "office";
}

export function findEmployeeDailyRoute(
  routes: ActiveRoute[],
  employeeId: number,
  date: string,
): ActiveRoute | null {
  const isoDate = date.trim().slice(0, 10);
  return (
    routes.find(
      (route) =>
        route.routeType === "pickup" &&
        route.active &&
        (route.date === isoDate || route.date.startsWith(isoDate)) &&
        !isDeliveryBranchCode(route.branch?.code) &&
        route.employees.some((member) => member.id === employeeId),
    ) ?? null
  );
}

function formatDailyRouteName(route: ActiveRoute): string {
  return (
    route.name.trim() ||
    route.employees.map((member) => member.name.trim()).filter(Boolean).join(", ") ||
    route.id
  );
}

/**
 * Resolves date, latest container and received-by for the signed-in user:
 * today's pickup daily route they crew, otherwise their office/warehouse.
 */
export function resolveAssignedInvoiceContext(input: {
  date: string;
  currentUser: Pick<User, "branch">;
  employee: Employee | null;
  routes: ActiveRoute[];
  latestContainer: Pick<Container, "id" | "name" | "containerNumber"> | null;
  branches: Pick<Branch, "id" | "code" | "name" | "type">[];
}): AssignedInvoiceContext {
  const { date, currentUser, employee, routes, latestContainer, branches } = input;
  if (!employee) throw new AssignedInvoiceContextError("employeeNotLinked");
  if (!latestContainer) throw new AssignedInvoiceContextError("noContainer");

  const route = findEmployeeDailyRoute(routes, employee.id, date);
  let receivedBy: AssignedInvoiceReceivedBy | null = null;

  if (route) {
    receivedBy = {
      source: "route",
      dailyRoute: { id: route.id, name: formatDailyRouteName(route) },
    };
  } else {
    const employeeBranch = branches.find((branch) => branch.id === employee.branch.id);
    const source = resolveEmployeeOfficeSource(employee, employeeBranch?.type ?? "");
    if (source) {
      receivedBy = {
        source,
        employee: employeeToInvoiceWriteRef(employee),
        officeBranch: {
          id: employee.branch.id,
          code: employee.branch.code,
          name: employee.branch.name,
        },
      };
    }
  }

  if (!receivedBy) throw new AssignedInvoiceContextError("noAssignment");

  const userBranch = resolveUserBranchRef(currentUser.branch, branches);
  return {
    date: date.trim().slice(0, 10),
    container: {
      id: latestContainer.id,
      name:
        latestContainer.name.trim() ||
        latestContainer.containerNumber.trim() ||
        String(latestContainer.id),
    },
    branch: {
      id: userBranch?.id || currentUser.branch.id,
      code: userBranch?.code || "",
      name: userBranch?.name || currentUser.branch.name,
    },
    receivedBy,
  };
}

export function applyAssignedInvoiceContext(
  values: InvoiceFormValues,
  context: AssignedInvoiceContext,
): InvoiceFormValues {
  const base: InvoiceFormValues = {
    ...values,
    date: context.date,
    containerId: String(context.container.id),
    pickupSource: context.receivedBy.source,
    routeId: "",
    routeCrewId: "",
    routeCrewName: "",
    officeBranchId: "",
    officeBranchName: "",
    pickupEmployeeId: "",
    pickupEmployeeName: "",
  };

  if (context.receivedBy.source === "route") {
    return {
      ...base,
      routeId: context.receivedBy.dailyRoute.id,
    };
  }

  const { employee, officeBranch } = context.receivedBy;
  return {
    ...base,
    pickupEmployeeId: String(employee.id),
    pickupEmployeeName: employee.name,
    officeBranchId: String(officeBranch.id),
    officeBranchName: `${officeBranch.code} — ${officeBranch.name}`.trim(),
  };
}

/** Write context from the resolved assignment, without re-reading it on save. */
export function buildAssignedInvoiceWriteContext(
  context: AssignedInvoiceContext,
): InvoiceWriteContext {
  const { receivedBy } = context;
  const pickupAssignment: InvoiceWriteContext["pickupAssignment"] =
    receivedBy.source === "route"
      ? { source: "route", dailyRoute: receivedBy.dailyRoute }
      : {
          source: receivedBy.source,
          pickupEmployee: receivedBy.employee,
          officeBranch: receivedBy.officeBranch,
        };

  return {
    employee: pickupAssignment.pickupEmployee,
    pickupAssignment,
    branch: context.branch,
    container: context.container,
  };
}
