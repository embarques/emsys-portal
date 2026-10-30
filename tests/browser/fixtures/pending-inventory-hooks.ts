type Call = { url: string; body?: unknown; headers?: Record<string, string> };
declare global {
  interface Window {
    readOnly?: boolean;
    searches?: Call[];
    reconciliations?: Call[];
    failReconcile?: boolean;
  }
}

const rows = [
  {
    id: "disp-1", dispatchedAt: "2026-10-26T13:00:00Z", ageDays: 2,
    holder: { id: "truck_3", type: "VEHICLE", displayName: "Truck 3" },
    assigneeEmployee: { id: "12", name: "Ana Pérez" }, dailyRoute: { id: "r1", name: "2026-10-26_Truck_Ana" },
    dispatchedQuantity: 40, reconciledQuantity: 5, outstandingQuantity: 35,
    lines: [
      { id: "line-1", item: { id: "box", name: "Small box" }, dispatchedQuantity: 30, reconciledQuantity: 5, outstandingQuantity: 25 },
      { id: "line-2", item: { id: "barrel", name: "Barrel" }, dispatchedQuantity: 10, reconciledQuantity: 0, outstandingQuantity: 10 },
    ],
  },
  {
    id: "disp-2", dispatchedAt: "2026-10-27T15:00:00Z", ageDays: 1,
    holder: { id: "emp_14", type: "EMPLOYEE", displayName: "Ben Ruiz" },
    assigneeEmployee: null, dailyRoute: null,
    dispatchedQuantity: 12, reconciledQuantity: 0, outstandingQuantity: 12,
    lines: [
      { id: "line-3", item: { id: "tape", name: "Tape" }, dispatchedQuantity: 4, reconciledQuantity: 0, outstandingQuantity: 4 },
      { id: "line-4", item: { id: "wrap", name: "Bubble wrap" }, dispatchedQuantity: 4, reconciledQuantity: 0, outstandingQuantity: 4 },
      { id: "line-5", item: { id: "label", name: "Labels" }, dispatchedQuantity: 4, reconciledQuantity: 0, outstandingQuantity: 4 },
    ],
  },
];

export const apiClient = {
  post: async (url: string, body: unknown, config?: { headers?: Record<string, string> }) => {
    if (url.endsWith("/search")) {
      window.searches = [...(window.searches ?? []), { url, body }];
      return { success: true, data: rows, total: rows.length };
    }
    window.reconciliations = [...(window.reconciliations ?? []), { url, body, headers: config?.headers }];
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (window.failReconcile) throw new Error("Reconciliation failed");
    return { success: true };
  },
  get: async () => ({ success: true, data: [{
    id: "rec-1", recordedAt: "2026-10-27T10:00:00Z", performedBy: { id: 3, name: "Office" },
    lines: [{ dispatchLineId: "line-1", outcome: "SOLD", quantity: 5, revenueMinor: 6000 }],
  }] }),
};
export function normalizeApiError(error: unknown) { return { message: error instanceof Error ? error.message : "Error" }; }
export function useAuth() {
  return {
    companyId: "company-1", loading: false, roleLoading: false,
    hasPermission: (name: string) => !(window.readOnly && name === "canReconcileInventoryDispatch"),
  };
}
export function useFeedback() { return { notifySuccess: () => {}, notifyError: () => {} }; }
export function useInventoryHolders() {
  return { isLoading: false, data: [
    { id: "wh_1", type: "WAREHOUSE", displayName: "Main warehouse", isActive: true },
    { id: "truck_3", type: "VEHICLE", displayName: "Truck 3", isActive: true },
    { id: "emp_14", type: "EMPLOYEE", displayName: "Ben Ruiz", isActive: true },
  ] };
}
