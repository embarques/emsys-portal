import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";

/** Existing unscoped legacy keys are isolated by the auth-context cache reset. */
export async function invalidateJournalLifecycle(client: QueryClient, companyId: string | null, input: { id: string; invoiceId?: string; noteOnly?: boolean }) {
  const journalViews = new Set(["journals", "journal-summary", "outstanding-journal-count", "pending-journals", "pending-journal-summary", "financial-activity", "financial-history"]);
  const financialViews = new Set(["income-statement", "income-statement-by-id", "income-statement-summary-total", "current-closeout", "closeout-calendar", "closeout-journal-count", "open-income-statements", "checks", "check", "checks-outstanding", "zelle-payments", "zelle-payments-outstanding", "deposits", "deposits-outstanding", "credit-card-payments", "credit-card-payments-outstanding"]);
  await Promise.all([
    client.invalidateQueries({ predicate: query => {
      if (query.queryKey[0] !== "accounting") return false;
      const section = String(query.queryKey[1]);
      if (section === "journal") return query.queryKey[2] === input.id;
      if (journalViews.has(section)) return section === "journals" || query.queryKey.includes(companyId);
      return !input.noteOnly && financialViews.has(section);
    } }),
    ...(!input.noteOnly && input.invoiceId ? [
      client.invalidateQueries({ queryKey: queryKeys.invoices.lists() }),
      client.invalidateQueries({ queryKey: queryKeys.invoices.stats("outstanding") }),
      client.invalidateQueries({ queryKey: queryKeys.invoices.stats("outstanding-balance") }),
      client.invalidateQueries({ queryKey: queryKeys.invoices.detail(input.invoiceId) }),
      client.invalidateQueries({ queryKey: ["invoices", "journals", input.invoiceId] }),
      client.invalidateQueries({ predicate: query => query.queryKey[0] === "delivery-balance" && query.queryKey[1] === companyId && query.queryKey[3] === input.invoiceId }),
    ] : []),
  ]);
}
