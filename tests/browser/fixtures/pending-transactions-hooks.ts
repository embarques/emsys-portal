export function useAuth() {
  return { companyId: "company-a", hasPermission: (name: string) => name !== "canReconcileJournal" || !window.readOnly };
}
export function useAccountingQueryEnabled() { return true; }
export function normalizeApiError(error: Error) { return { message: error.message }; }
const journals = [
  { id: "j1", date: "2026-10-30", transactionType: "PAYMENT", transactionAmount: 100, refNumber: "R1", currency: "USD", employee: { id: 1, name: "Ana" }, paymentMethod: { name: "CASH" }, accounts: [{ id: 1, name: "Sales", type: "INCOME", debit: 0, credit: 100 }] },
  { id: "j2", date: "2026-10-30", transactionType: "EXPENSE", transactionAmount: 25, refNumber: "R2", currency: "USD", employee: { id: 1, name: "Ana" }, paymentMethod: { name: "CASH" }, accounts: [{ id: 2, name: "Fuel", type: "EXPENSE", debit: 25, credit: 0 }] },
  { id: "j3", date: "2026-10-29", transactionType: "PAYMENT", transactionAmount: 50, refNumber: "R3", currency: "USD", employee: { id: 2, name: "Luis" }, paymentMethod: { name: "CHECK" }, accounts: [] },
];
export const apiClient = {
  async post(url: string, body: { ids?: string[]; requestId?: string; pagination?: { page: number } }) {
    (window.calls ??= []).push({ url, body });
    if (url.endsWith("/summary")) {
      const rows = journals.filter(row => body.ids?.includes(row.id));
      const income = rows.filter(row => row.transactionType === "PAYMENT").reduce((sum, row) => sum + row.transactionAmount, 0);
      const expenses = rows.filter(row => row.transactionType === "EXPENSE").reduce((sum, row) => sum + row.transactionAmount, 0);
      return { success: true, data: [{ currency: "USD", income, expenses, net: income - expenses, count: rows.length }] };
    }
    if (url.endsWith("/reconcile")) {
      if (window.failReconcile) { window.failReconcile = false; throw new Error("Temporary reconciliation failure"); }
      window.reconciled = body.ids;
      return { success: true, data: { reconciled: body.ids, reconciledAt: "2026-10-30T12:00:00Z" } };
    }
    return { success: true, data: (body.pagination?.page === 2 ? [journals[1]] : [journals[0], journals[2]]).filter(row => !window.reconciled?.includes(row.id)), total: window.reconciled?.length ? 1 : 41 };
  },
};
declare global {
  interface Window { readOnly?: boolean; failReconcile?: boolean; reconciled?: string[]; calls?: Array<{ url: string; body: unknown }>; }
}
