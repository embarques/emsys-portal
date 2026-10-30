export function getInvoiceBalanceInputClassName(balance: number | null | undefined) {
  if (balance == null || !Number.isFinite(balance)) return "bg-muted/40";
  if (balance < 0) {
    return "border-destructive bg-destructive/5 font-semibold text-destructive";
  }
  if (balance > 0) {
    return "border-amber-300 bg-amber-50 font-semibold text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200";
  }
  return "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200";
}

export function getInvoiceBalanceTextClassName(balance: number | null | undefined) {
  if (balance == null || !Number.isFinite(balance)) return undefined;
  if (balance < 0) return "font-semibold text-destructive";
  if (balance > 0) return "font-semibold text-amber-700 dark:text-amber-300";
  return "font-semibold text-emerald-700 dark:text-emerald-400";
}
