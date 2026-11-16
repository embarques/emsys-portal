import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  JournalClearanceBatchWorkspace,
  JournalReconciliationBatchWorkspace,
} from "@/components/accounting/journal-batch-confirm-workspace";
import { JournalTransactionsTable } from "@/components/accounting/journal-transactions-table";
import { TooltipProvider } from "@/components/ui/tooltip";

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const dailyIncome = (window as unknown as { dailyIncome?: boolean }).dailyIncome;
const clearance = (window as unknown as { pendingClearance?: boolean }).pendingClearance;

if (clearance) {
  client.setQueryData(["invoices", "detail", "invoice-1"], { balance: 55 });
  client.setQueryData(["invoices", "detail", "unrelated-invoice"], { balance: 15 });
  client.setQueryData(["accounting", "income-statement-summary-total", 32600], {});
  Object.assign(window, {
    clearanceCacheState: () => ({
      affected: client.getQueryState(["invoices", "detail", "invoice-1"])?.isInvalidated,
      unrelated: client.getQueryState(["invoices", "detail", "unrelated-invoice"])?.isInvalidated,
      summary: client.getQueryState(["accounting", "income-statement-summary-total", 32600])?.isInvalidated,
    }),
  });
}

type BatchParams = {
  feature: string;
  entityId?: string;
  journalBatch?: {
    queue: "reconciliation" | "clearance";
    requestId: string;
    ids: string[];
  };
};

function Harness() {
  const [batch, setBatch] = useState<BatchParams | null>(null);

  useEffect(() => {
    window.__openJournalBatchConfirm = (params) => setBatch(params);
    window.__closeJournalBatchConfirm = () => setBatch(null);
    return () => {
      delete window.__openJournalBatchConfirm;
      delete window.__closeJournalBatchConfirm;
    };
  }, []);

  if (batch?.journalBatch) {
    const Confirm =
      batch.journalBatch.queue === "clearance"
        ? JournalClearanceBatchWorkspace
        : JournalReconciliationBatchWorkspace;
    return (
      <Confirm
        tabId="fixture-confirm"
        mode="stage"
        entityId={batch.entityId ?? batch.journalBatch.requestId}
        journalBatch={batch.journalBatch}
      />
    );
  }

  return (
    <JournalTransactionsTable
      pending={!dailyIncome && !clearance}
      clearance={clearance}
      incomeStatementId={dailyIncome ? 32690 : undefined}
      headerActions={dailyIncome ? <button>Add transaction</button> : undefined}
      onView={dailyIncome ? (row) => {
        document.body.dataset.viewedJournal = row.id;
      } : undefined}
      onPrintReceipt={dailyIncome ? (row) => {
        document.body.dataset.receiptJournal = row.id;
      } : undefined}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <TooltipProvider>
      <Harness />
    </TooltipProvider>
  </QueryClientProvider>,
);
