"use client";

import { ClearablePaymentsWorkspace } from "@/components/accounting/clearable-payments-workspace";
import { DEPOSITS_CONFIG } from "@/lib/accounting/clearable-payments/configs";

export function DepositsWorkspace() {
  return <ClearablePaymentsWorkspace config={DEPOSITS_CONFIG} />;
}
