import { getRouteAssignmentLabel } from "@/lib/orders/display";
import { getBranchBadgeClass, getBranchLabel } from "@/lib/trucks/display";
import { getPaymentMethodLabel } from "@/lib/invoices/display";
import type { AccountingBranch, AccountingEntry, AccountingEntryType } from "./types";
import { ACCOUNTING_ENTRY_TYPES } from "./types";

export function getAccountingBranchLabel(branch: AccountingBranch): string {
  return getBranchLabel(branch);
}

export function getAccountingBranchBadgeClass(branch: AccountingBranch): string {
  return getBranchBadgeClass(branch);
}

export function getAccountingEntryTypeLabel(type: AccountingEntryType): string {
  return ACCOUNTING_ENTRY_TYPES.find((entry) => entry.value === type)?.label ?? type;
}

export function getAccountingEntryTypeBadgeClass(type: AccountingEntryType): string {
  switch (type) {
    case "invoice_payment_new":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "invoice_payment_existing":
      return "border-transparent bg-teal-500/15 text-teal-700 dark:text-teal-300";
    case "invoice_discount":
      return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "expense":
      return "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "income":
      return "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

export function formatAccountingMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatAccountingDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date.slice(0, 10)}T12:00:00`));
}

export function truncateAccountingEntryId(entryId: string): string {
  return entryId.length > 12 ? `${entryId.slice(0, 8)}…` : entryId;
}

export function formatAccountingCategory(entry: AccountingEntry): string {
  if (entry.category === "Other" && entry.otherCategory) {
    return `Other — ${entry.otherCategory}`;
  }
  return entry.category ?? "—";
}

export function formatAccountingEntrySummary(entry: AccountingEntry): string {
  if (entry.invoiceNumber) {
    return entry.invoiceNumber;
  }
  return formatAccountingCategory(entry);
}

export function getNewInvoicePaymentBalance(entry: AccountingEntry): number {
  const total = entry.invoiceTotal ?? 0;
  const paid = entry.amountPaid ?? entry.amount;
  return Math.round((total - paid) * 100) / 100;
}

export function accountingEntryMatchesQuery(entry: AccountingEntry, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    entry.entryId,
    getAccountingEntryTypeLabel(entry.type),
    entry.description,
    entry.invoiceNumber,
    entry.senderName,
    entry.receiverName,
    entry.category,
    entry.otherCategory,
    entry.receiptNumber,
    entry.referenceNumber,
    getRouteAssignmentLabel(entry.routeAssignmentId),
    entry.paymentMethod ? getPaymentMethodLabel(entry.paymentMethod) : "",
    getAccountingBranchLabel(entry.branch),
    formatAccountingMoney(entry.amount),
    entry.createdBy,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeAccountingKpis(entries: AccountingEntry[]) {
  const incomeTotal = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const expenseTotal = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const invoicePaymentTotal = entries
    .filter(
      (entry) => entry.type === "invoice_payment_new" || entry.type === "invoice_payment_existing"
    )
    .reduce((sum, entry) => sum + entry.amount, 0);

  const discountTotal = entries
    .filter((entry) => entry.type === "invoice_discount")
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    total: entries.length,
    incomeTotal: Math.round(incomeTotal * 100) / 100,
    expenseTotal: Math.round(expenseTotal * 100) / 100,
    netTotal: Math.round((incomeTotal - expenseTotal) * 100) / 100,
    invoicePaymentTotal: Math.round(invoicePaymentTotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
  };
}

export { getPaymentMethodLabel };
