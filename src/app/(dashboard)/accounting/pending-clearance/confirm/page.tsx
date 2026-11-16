import { Suspense } from "react";

import { JournalBatchConfirmPage } from "@/components/accounting/journal-batch-confirm-workspace";

export default function PendingClearanceConfirmPage() {
  return (
    <Suspense fallback={null}>
      <JournalBatchConfirmPage queue="clearance" />
    </Suspense>
  );
}
