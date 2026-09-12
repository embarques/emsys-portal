import {
  ArrowLeftRight,
  ArrowUpCircle,
  Banknote,
  FileText,
  Landmark,
  Package,
  Percent,
  Tag,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { JournalTransactionType } from "@/lib/accounting/daily-income/types";
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
  {
    value: "INITIAL-PAYMENT",
    icon: FileText,
    iconClassName: "text-blue-600",
    iconBackgroundClassName: "bg-blue-50",
  },
  {
    value: "PAYMENT",
    icon: Banknote,
    iconClassName: "text-emerald-600",
    iconBackgroundClassName: "bg-emerald-50",
  },
  {
    value: "EXPENSE",
    icon: Wallet,
    iconClassName: "text-red-600",
    iconBackgroundClassName: "bg-red-50",
  },
  {
    value: "SALES",
    icon: ArrowUpCircle,
    iconClassName: "text-emerald-600",
    iconBackgroundClassName: "bg-emerald-50",
  },
  {
    value: "INVENTORY",
    icon: Package,
    iconClassName: "text-teal-700",
    iconBackgroundClassName: "bg-teal-50",
  },
  {
    value: "DISCOUNT",
    icon: Tag,
    iconClassName: "text-violet-600",
    iconBackgroundClassName: "bg-violet-50",
  },
  {
    value: "SURCHARGE",
    icon: Percent,
    iconClassName: "text-orange-600",
    iconBackgroundClassName: "bg-orange-50",
  },
  {
    value: "TRANSFER",
    icon: ArrowLeftRight,
    iconClassName: "text-blue-600",
    iconBackgroundClassName: "bg-blue-50",
  },
];

/** Lookup meta for existing journal types that are no longer offered in Add transaction. */
const LEGACY_TRANSACTION_TYPE_META: TransactionTypeMeta[] = [
  {
    value: "LOAN",
    icon: Landmark,
    iconClassName: "text-indigo-700",
    iconBackgroundClassName: "bg-indigo-50",
  },
];

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
      return "journal-employee";
    case "INVENTORY":
      return "journal-inventory-direction";
    case "DISCOUNT":
    case "SURCHARGE":
      return "journal-invoice";
    default:
      return "journal-payment";
  }
}
