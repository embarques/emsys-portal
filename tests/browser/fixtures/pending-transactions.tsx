import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { store } from "@/lib/store/store";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  JournalReconciliationBatchWorkspace,
} from "@/components/accounting/journal-batch-confirm-workspace";
import { FinancialActivityWorkspace } from "@/components/accounting/financial-activity-workspace";

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

type BatchParams = {
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
    return (
      <JournalReconciliationBatchWorkspace
        tabId="fixture-confirm"
        mode="stage"
        entityId={batch.entityId ?? batch.journalBatch.requestId}
        journalBatch={batch.journalBatch}
      />
    );
  }

  return <FinancialActivityWorkspace />;
}

createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  </Provider>,
);
