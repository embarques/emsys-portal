export function useCurrentUser() {
  return { data: { branch: { id: 1, name: "New York" } }, isError: false };
}
export function useCloseoutCalendar() {
  return { data: { today: "2026-10-26", serverTimezone: "America/New_York" }, isError: false };
}
export function useCreateIncomeStatement() {
  return {
    isPending: false, isError: false,
    async mutateAsync(values: Record<string, unknown>) {
      const host = window as unknown as { closeoutRequests?: Record<string, unknown>[] };
      host.closeoutRequests = [...(host.closeoutRequests ?? []), values];
      return { id: 72, date: "2026-10-26", status: "OPEN", branch: { id: 1, name: "New York" }, currency: values.currency, rate: values.rate };
    },
  };
}

export function useBranchPicker() {
 const code = (window as unknown as { closeoutBranch?: string }).closeoutBranch ?? "RD";
 return { data: { items: [{ id: 1, code, name: code === "RD" ? "Dominican Republic" : "New York" }] }, isError: false };
}
