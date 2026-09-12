export type InventoryItemRef = {
  id: string;
  item: string;
};

export type InventorySupplierRef = {
  id: string;
  companyName: string;
};

export type ReceiptFormValues = {
  itemId: string;
  quantity: string;
  averageCost: string;
  supplierId: string;
  receivedAt: string;
};

export type InventoryReceipt = {
  id: string;
  itemId: string;
  item?: InventoryItemRef;
  quantity: number;
  averageCost: number;
  supplierId: string;
  supplier?: InventorySupplierRef;
  receivedAt: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type InventoryDispatchAssigneeSource = "employee" | "route";

/** Employee or daily vehicle-route. Same shape as invoice `receivedBy`. */
export type InventoryDispatchTo = {
  id: string | number;
  name: string;
  route?: { id: string | number; name: string };
};

export type DispatchFormValues = {
  itemId: string;
  quantity: string;
  incomeGained: string;
  dispatchedAt: string;
  /** Portal-only so the form can pick employee vs route. Do not persist. */
  assigneeSource: InventoryDispatchAssigneeSource;
  employeeId: string;
  employeeName: string;
  routeId: string;
  routeName: string;
  routeCrewId: string;
  routeCrewName: string;
};

export type InventoryDispatch = {
  id: string;
  itemId: string;
  item?: InventoryItemRef;
  quantity: number;
  incomeGained: number;
  dispatchedAt: string;
  dispatchedTo: InventoryDispatchTo;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export function createEmptyReceiptForm(receivedAt = ""): ReceiptFormValues {
  return {
    itemId: "",
    quantity: "",
    averageCost: "",
    supplierId: "",
    receivedAt,
  };
}

export function receiptToFormValues(receipt: InventoryReceipt): ReceiptFormValues {
  return {
    itemId: receipt.itemId,
    quantity: String(receipt.quantity),
    averageCost: receipt.averageCost > 0 ? String(receipt.averageCost) : "",
    supplierId: receipt.supplierId,
    receivedAt: receipt.receivedAt.slice(0, 10),
  };
}

export function createEmptyDispatchForm(dispatchedAt = ""): DispatchFormValues {
  return {
    itemId: "",
    quantity: "",
    incomeGained: "",
    dispatchedAt,
    assigneeSource: "employee",
    employeeId: "",
    employeeName: "",
    routeId: "",
    routeName: "",
    routeCrewId: "",
    routeCrewName: "",
  };
}

export function dispatchToFormValues(dispatch: InventoryDispatch): DispatchFormValues {
  const isRoute = isInventoryDispatchToRoute(dispatch.dispatchedTo);
  return {
    ...createEmptyDispatchForm(dispatch.dispatchedAt.slice(0, 10)),
    itemId: dispatch.itemId,
    quantity: String(dispatch.quantity),
    incomeGained: dispatch.incomeGained > 0 ? String(dispatch.incomeGained) : "",
    assigneeSource: isRoute ? "route" : "employee",
    ...(isRoute
      ? {
          routeId: String(dispatch.dispatchedTo.id),
          routeName: dispatch.dispatchedTo.name,
          routeCrewId: dispatch.dispatchedTo.route ? String(dispatch.dispatchedTo.route.id) : "",
          routeCrewName: dispatch.dispatchedTo.route?.name ?? "",
        }
      : {
          employeeId: String(dispatch.dispatchedTo.id),
          employeeName: dispatch.dispatchedTo.name,
        }),
  };
}

function looksLikeDailyRouteId(id: unknown): boolean {
  if (id == null || id === "") return false;
  return /^[a-f\d]{24}$/i.test(String(id).trim());
}

export function isInventoryDispatchToRoute(value: InventoryDispatchTo): boolean {
  return Boolean(value.route) || looksLikeDailyRouteId(value.id);
}

export function getInventoryDispatchToLabel(value: InventoryDispatchTo | null | undefined): string {
  return value?.name?.trim() || "";
}

export function dispatchedToFromFormValues(values: DispatchFormValues): InventoryDispatchTo | null {
  if (values.assigneeSource === "route") {
    const routeId = values.routeId.trim();
    if (!routeId) return null;
    const crewId = values.routeCrewId.trim();
    return {
      id: routeId,
      name: values.routeName.trim() || routeId,
      ...(crewId
        ? { route: { id: crewId, name: values.routeCrewName.trim() || crewId } }
        : {}),
    };
  }

  const employeeId = values.employeeId.trim();
  if (!employeeId) return null;
  const numericId = Number(employeeId);
  return {
    id: Number.isFinite(numericId) ? numericId : employeeId,
    name: values.employeeName.trim() || employeeId,
  };
}
