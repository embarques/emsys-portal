export function useCurrentIncomeStatement(branchId: number) {
  return {
    data: branchId ? { id: 10, status: window.noCloseout ? "CLOSED" : "OPEN", businessDate: "2026-10-30" } : null,
    isFetching: false, isError: false, refetch: async () => {},
  };
}
export function normalizeApiError(error: Error) { return { message: error.message }; }
declare global { interface Window { noCloseout?: boolean; loanSubmissions?: unknown[]; loanSubmitFails?: boolean; } }
