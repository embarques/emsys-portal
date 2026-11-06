export type InvoiceAdjustmentKind = "DISCOUNT" | "SURCHARGE";

/** Quick percents, always taken from the invoice total. */
export const INVOICE_ADJUSTMENT_PRESET_PERCENTS: Record<InvoiceAdjustmentKind, readonly number[]> = {
  DISCOUNT: [5, 10, 15, 25, 50, 100],
  SURCHARGE: [3, 5, 10, 15, 20, 25],
};

/** The discount or surcharge being edited; the invoice's current balance already reflects its amount. */
export type OriginalInvoiceAdjustment = { invoiceId: string; amount: number };

function toCents(value: number) {
  return Math.round(value * 100);
}

function restoredCents(invoiceId: string | undefined, original: OriginalInvoiceAdjustment | undefined) {
  return original && invoiceId && original.invoiceId === invoiceId ? toCents(original.amount) : 0;
}

/** The most that can be discounted so the invoice balance never goes below zero. */
export function getDiscountableBalance(
  invoiceBalance: number | undefined,
  invoiceId: string | undefined,
  original?: OriginalInvoiceAdjustment,
): number | undefined {
  if (invoiceBalance == null || !Number.isFinite(invoiceBalance)) return undefined;
  return (toCents(invoiceBalance) + restoredCents(invoiceId, original)) / 100;
}

/** The invoice balance before the surcharge being entered (or edited) is added. */
export function getSurchargeBaseBalance(
  invoiceBalance: number | undefined,
  invoiceId: string | undefined,
  original?: OriginalInvoiceAdjustment,
): number | undefined {
  if (invoiceBalance == null || !Number.isFinite(invoiceBalance)) return undefined;
  return Math.max(0, toCents(invoiceBalance) - restoredCents(invoiceId, original)) / 100;
}

/** Percent of a base amount, rounded to cents. */
export function getPercentAmount(base: number, percent: number): number {
  const baseCents = toCents(base);
  if (baseCents <= 0 || !Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round((baseCents * percent) / 100) / 100;
}

/** A typed custom percent, or undefined when it is empty, invalid, or not positive. */
export function parseAdjustmentPercent(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const percent = Number(value);
  return Number.isFinite(percent) && percent > 0 ? percent : undefined;
}

export function getBalanceAfterDiscount(discountableBalance: number, amount: number | undefined): number {
  return (toCents(discountableBalance) - toCents(amount ?? 0)) / 100;
}

export function getBalanceAfterSurcharge(baseBalance: number, amount: number | undefined): number {
  return (toCents(baseBalance) + toCents(amount ?? 0)) / 100;
}

export function isSameMoneyAmount(left: number | undefined, right: number | undefined) {
  return left != null && right != null && toCents(left) === toCents(right);
}

export function exceedsMoneyAmount(value: number, limit: number | undefined) {
  return limit != null && toCents(value) > toCents(limit);
}
