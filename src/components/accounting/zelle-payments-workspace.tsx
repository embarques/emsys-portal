"use client";

import { ClearablePaymentsWorkspace } from "@/components/accounting/clearable-payments-workspace";
import { ZELLE_PAYMENTS_CONFIG } from "@/lib/accounting/clearable-payments/configs";

export function ZellePaymentsWorkspace() {
  return <ClearablePaymentsWorkspace config={ZELLE_PAYMENTS_CONFIG} />;
}
