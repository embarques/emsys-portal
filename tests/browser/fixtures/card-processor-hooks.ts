export function useAuth() { return { permissions: [], hasPermission: () => true }; }
export function useResponsibilityAccess() { return { ready: true, canAssign: true, ownEmployee: { id: 73 } }; }
export function useWorkspaceTabs() { return { tabs: [], openFormTab: () => {}, isDesktopTabs: true }; }
export function useApplyCustomerOnTabReturn() { return { markPendingPartyAdd: () => {}, markPendingPartyEdit: () => {} }; }
export const apiClient = {
  post: async (_url: string, body: Record<string, unknown>) => {
    document.getElementById("posted")!.textContent = JSON.stringify(body);
    return { success: true, data: { id: "card-journal", transactionType: "INITIAL-PAYMENT", transactionAmount: body.amount } };
  },
};
