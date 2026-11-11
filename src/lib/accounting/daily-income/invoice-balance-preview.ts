import type { OriginalInvoiceAdjustment } from "./invoice-adjustment-presets";

/** Project the balance after a payment is applied, including clearance when required. */
export function getInvoicePaymentBalancePreview(
  balance: number | null | undefined,
  amount: number | undefined,
  invoiceId?: string,
  originalPayment?: OriginalInvoiceAdjustment,
) {
  if (balance == null || !Number.isFinite(balance)) {
    return { previousBalance: null, newBalance: null };
  }
  const restored = originalPayment && originalPayment.invoiceId === invoiceId ? originalPayment.amount : 0;
  const previousCents = Math.round(balance * 100) + Math.round(restored * 100);
  return {
    previousBalance: previousCents / 100,
    newBalance: amount != null && !Number.isFinite(amount)
      ? null
      : (previousCents - Math.round((amount ?? 0) * 100)) / 100,
  };
}
