"use client";

import { ClearablePaymentsWorkspace } from "@/components/accounting/clearable-payments-workspace";
import { CREDIT_CARD_PAYMENTS_CONFIG } from "@/lib/accounting/clearable-payments/configs";

export function CreditCardPaymentsWorkspace() {
  return <ClearablePaymentsWorkspace config={CREDIT_CARD_PAYMENTS_CONFIG} />;
}
