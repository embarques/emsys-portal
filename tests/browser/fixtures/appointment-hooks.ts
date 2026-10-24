export function useIsGoogleMapsConfigured() { return false; }
export function useWorkspaceTabs() {
  return {
    openFormTab: (tab: unknown) => {
      const target = window as unknown as { openedFormTabs?: unknown[] };
      target.openedFormTabs = [...(target.openedFormTabs ?? []), tab];
    },
  };
}
export function useApplyCustomerOnTabReturn() {
  return { markPendingPartyEdit: () => {}, markPendingPartyAdd: () => {} };
}
export function useSenderOrderHistory() {
  return { data: { items: [] }, isLoading: false, isError: false, error: null };
}
export function useEmployees() { return { data: { items: [] }, isFetching: false }; }
