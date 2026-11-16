import { Suspense } from "react";

import { JournalBatchConfirmPage } from "@/components/accounting/journal-batch-confirm-workspace";

export default function PendingReconciliationConfirmPage() {
  return (
    <Suspense fallback={null}>
      <JournalBatchConfirmPage queue="reconciliation" />
    </Suspense>
  );
}
