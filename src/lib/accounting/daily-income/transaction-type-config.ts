import {
  ArrowLeftRight,
  ArrowUpCircle,
  Banknote,
  FileText,
  Landmark,
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
  DISCOUNT: "discount",
  SURCHARGE: "surcharge",
  TRANSFER: "transfer",
  LOAN: "loan",
};

const TRANSACTION_TYPE_META: Array<
  Pick<TransactionTypeOption, "value" | "icon" | "iconClassName" | "iconBackgroundClassName">
> = [
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

export function buildTransactionTypeOptions(t: TranslateFn): TransactionTypeOption[] {
  return TRANSACTION_TYPE_META.map((meta) => {
    const key = transactionTypeKey(meta.value);
    return {
      ...meta,
      label: t(`accounting.dailyIncome.transactionTypes.${key}.label`),
      description: t(`accounting.dailyIncome.transactionTypes.${key}.description`),
      sectionTitle: t(`accounting.dailyIncome.transactionTypes.${key}.sectionTitle`),
    };
  });
}

export function getTransactionTypeOption(type: JournalTransactionType, t: TranslateFn): TransactionTypeOption {
  const options = buildTransactionTypeOptions(t);
  return options.find((option) => option.value === type) ?? options[0];
}

/** First editable field after employee when continuing entry for the same transaction type. */
export function getTransactionFormSecondFieldId(_type: JournalTransactionType): string {
  return "journal-payment";
}
