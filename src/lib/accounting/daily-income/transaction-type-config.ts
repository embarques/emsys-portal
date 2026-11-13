import {
  ArrowLeftRight,
  ArrowUpCircle,
  BadgePlus,
  Banknote,
  FileText,
  Landmark,
  HandCoins,
  Package,
  PackageCheck,
  Percent,
  Tag,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { JournalTransactionType } from "@/lib/accounting/daily-income/types";
import { isLoanIncreaseEnabled } from "@/lib/accounting/loans/loan-increase";
import type { TranslateFn } from "@/lib/feedback/messages";

export type TransactionTypeOption = {
  value: JournalTransactionType;
  label: string;
  description: string;
  sectionTitle: string;
  icon: LucideIcon;
  iconClassName: string;
  iconBackgroundClassName: string;
};

const TRANSACTION_TYPE_I18N_KEYS: Record<JournalTransactionType, string> = {
  "INITIAL-PAYMENT": "initialPayment",
  PAYMENT: "payment",
  EXPENSE: "expense",
  SALES: "sales",
  INVENTORY: "inventory",
  DISCOUNT: "discount",
  SURCHARGE: "surcharge",
  TRANSFER: "transfer",
  LOAN: "loan",
};

type TransactionTypeMeta = Pick<
  TransactionTypeOption,
  "value" | "icon" | "iconClassName" | "iconBackgroundClassName"
>;

/** Types offered when adding a new daily-income transaction. Loans are managed on the Loans page. */
const SELECTABLE_TRANSACTION_TYPE_META: TransactionTypeMeta[] = [
  { value: "INITIAL-PAYMENT", icon: FileText, iconClassName: "text-blue-600", iconBackgroundClassName: "bg-blue-50" },
  { value: "PAYMENT", icon: Banknote, iconClassName: "text-emerald-600", iconBackgroundClassName: "bg-emerald-50" },
  { value: "SALES", icon: ArrowUpCircle, iconClassName: "text-emerald-600", iconBackgroundClassName: "bg-emerald-50" },
  { value: "EXPENSE", icon: Wallet, iconClassName: "text-red-600", iconBackgroundClassName: "bg-red-50" },
  { value: "INVENTORY", icon: Package, iconClassName: "text-teal-700", iconBackgroundClassName: "bg-teal-50" },
  { value: "DISCOUNT", icon: Tag, iconClassName: "text-violet-600", iconBackgroundClassName: "bg-violet-50" },
  { value: "SURCHARGE", icon: Percent, iconClassName: "text-orange-600", iconBackgroundClassName: "bg-orange-50" },
  { value: "TRANSFER", icon: ArrowLeftRight, iconClassName: "text-blue-600", iconBackgroundClassName: "bg-blue-50" },
];

/** Loans remain managed on the Loans page and retain their existing summaries. */
const LEGACY_TRANSACTION_TYPE_META: TransactionTypeMeta[] = [
  { value: "LOAN", icon: Landmark, iconClassName: "text-indigo-700", iconBackgroundClassName: "bg-indigo-50" },
];

export type TransactionEntryCategory = JournalTransactionType | "INVENTORY-PAYMENT" | "LOAN-ISSUE" | "LOAN-INCREASE" | "LOAN-PAYMENT";
export type TransactionEntryOption = Omit<TransactionTypeOption, "value"> & { value: TransactionEntryCategory };

function transactionTypeKey(type: JournalTransactionType) {
  return TRANSACTION_TYPE_I18N_KEYS[type];
}

function toTransactionTypeOption(meta: TransactionTypeMeta, t: TranslateFn): TransactionTypeOption {
  const key = transactionTypeKey(meta.value);
  return {
    ...meta,
    label: t(`accounting.dailyIncome.transactionTypes.${key}.label`),
    description: t(`accounting.dailyIncome.transactionTypes.${key}.description`),
    sectionTitle: t(`accounting.dailyIncome.transactionTypes.${key}.sectionTitle`),
  };
}

export function buildTransactionTypeOptions(t: TranslateFn): TransactionTypeOption[] {
  return SELECTABLE_TRANSACTION_TYPE_META.map((meta) => toTransactionTypeOption(meta, t));
}

/** Inventory payments use their existing dispatch flow, not a fabricated journal type. */
export function buildTransactionEntryOptions(t: TranslateFn): TransactionEntryOption[] {
  const options: TransactionEntryOption[] = buildTransactionTypeOptions(t);
  options.splice(5, 0, {
    value: "INVENTORY-PAYMENT",
    label: t("accounting.dailyIncome.transactionTypes.inventoryPayment.label"),
    description: t("accounting.dailyIncome.transactionTypes.inventoryPayment.description"),
    sectionTitle: t("accounting.dailyIncome.transactionTypes.inventoryPayment.sectionTitle"),
    icon: PackageCheck,
    iconClassName: "text-teal-700",
    iconBackgroundClassName: "bg-teal-50",
  });
  for (const [value, key, icon] of [
    ["LOAN-ISSUE", "loanIssue", Landmark],
    ...(isLoanIncreaseEnabled() ? [["LOAN-INCREASE", "loanIncrease", BadgePlus] as const] : []),
    ["LOAN-PAYMENT", "loanPayment", HandCoins],
  ] as const) {
    options.push({ value, label: t(`accounting.dailyIncome.transactionTypes.${key}.label`),
      description: t(`accounting.dailyIncome.transactionTypes.${key}.description`),
      sectionTitle: t(`accounting.dailyIncome.transactionTypes.${key}.label`),
      icon, iconClassName: "text-indigo-700", iconBackgroundClassName: "bg-indigo-50" });
  }
  return options;
}

/** Discounts and surcharges are chosen inside the existing-invoice (PAYMENT) form, not in the picker. */
const ENTRY_GROUPS: Array<{ id: string; icon: LucideIcon; categories: TransactionEntryCategory[] }> = [
  { id: "invoices", icon: FileText, categories: ["INITIAL-PAYMENT", "PAYMENT"] },
  { id: "income", icon: ArrowUpCircle, categories: ["SALES"] },
  { id: "expenses", icon: Wallet, categories: ["EXPENSE"] },
  { id: "inventory", icon: Package, categories: ["INVENTORY", "INVENTORY-PAYMENT"] },
  { id: "loans", icon: Landmark, categories: ["LOAN-ISSUE", "LOAN-INCREASE", "LOAN-PAYMENT"] },
  { id: "transfers", icon: ArrowLeftRight, categories: ["TRANSFER"] },
];

export function buildTransactionEntryGroups(t: TranslateFn) {
  const options = buildTransactionEntryOptions(t);
  return ENTRY_GROUPS.map((group) => ({
    id: group.id,
    icon: group.icon,
    label: t(`accounting.dailyIncome.wizard.typeSelector.groups.${group.id}`),
    options: group.categories.flatMap((category) => options.filter((option) => option.value === category)),
  }));
}

export const INVOICE_ACTION_TYPES = ["PAYMENT", "DISCOUNT", "SURCHARGE"] as const satisfies readonly JournalTransactionType[];
export type InvoiceActionType = (typeof INVOICE_ACTION_TYPES)[number];

export function isInvoiceActionType(type: string | null | undefined): type is InvoiceActionType {
  return INVOICE_ACTION_TYPES.includes(type as InvoiceActionType);
}

export function getTransactionTypeOption(type: JournalTransactionType, t: TranslateFn): TransactionTypeOption {
  const meta =
    SELECTABLE_TRANSACTION_TYPE_META.find((option) => option.value === type) ??
    LEGACY_TRANSACTION_TYPE_META.find((option) => option.value === type) ??
    SELECTABLE_TRANSACTION_TYPE_META[0];
  return toTransactionTypeOption(meta, t);
}

/** First editable field after shared defaults when continuing entry for the same type. */
export function getTransactionFormSecondFieldId(type: JournalTransactionType): string {
  switch (type) {
    case "INITIAL-PAYMENT":
      return "journal-invoice-number";
    case "PAYMENT":
      return "journal-invoice";
    case "INVENTORY":
      return "journal-inventory-direction";
    case "DISCOUNT":
    case "SURCHARGE":
      return "journal-invoice";
    default:
      return "journal-account";
  }
}
