export function useIsGoogleMapsConfigured() { return false; }
export function useWorkspaceTabs() { return { openFormTab: () => {} }; }
export function useApplyCustomerOnTabReturn() {
  return { markPendingPartyEdit: () => {}, markPendingPartyAdd: () => {} };
}
export function useSenderOrderHistory() {
  return { data: { items: [] }, isLoading: false, isError: false, error: null };
}
export function useEmployees() { return { data: { items: [] }, isFetching: false }; }
