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

export type TransactionTypeOption = {
  value: JournalTransactionType;
  label: string;
  description: string;
  sectionTitle: string;
  icon: LucideIcon;
  iconClassName: string;
  iconBackgroundClassName: string;
};

export const TRANSACTION_TYPE_OPTIONS: TransactionTypeOption[] = [
  {
    value: "INITIAL-PAYMENT",
    label: "Register invoice",
    description: "Record a customer",
    sectionTitle: "Invoice information",
    icon: FileText,
    iconClassName: "text-blue-600",
    iconBackgroundClassName: "bg-blue-50",
  },
  {
    value: "PAYMENT",
    label: "Register payment",
    description: "Record a payment received",
    sectionTitle: "Payment information",
    icon: Banknote,
    iconClassName: "text-emerald-600",
    iconBackgroundClassName: "bg-emerald-50",
  },
  {
    value: "EXPENSE",
    label: "Register expense",
    description: "Record an expense",
    sectionTitle: "Expense information",
    icon: Wallet,
    iconClassName: "text-red-600",
    iconBackgroundClassName: "bg-red-50",
  },
  {
    value: "SALES",
    label: "Register income",
    description: "Record income",
    sectionTitle: "Income information",
    icon: ArrowUpCircle,
    iconClassName: "text-emerald-600",
    iconBackgroundClassName: "bg-emerald-50",
  },
  {
    value: "DISCOUNT",
    label: "Apply discount",
    description: "Apply a discount",
    sectionTitle: "Discount information",
    icon: Tag,
    iconClassName: "text-violet-600",
    iconBackgroundClassName: "bg-violet-50",
  },
  {
    value: "SURCHARGE",
    label: "Apply surcharge",
    description: "Apply a surcharge",
    sectionTitle: "Surcharge information",
    icon: Percent,
    iconClassName: "text-orange-600",
    iconBackgroundClassName: "bg-orange-50",
  },
  {
    value: "TRANSFER",
    label: "Transfer account",
    description: "Transfer between accounts",
    sectionTitle: "Transfer information",
    icon: ArrowLeftRight,
    iconClassName: "text-blue-600",
    iconBackgroundClassName: "bg-blue-50",
  },
  {
    value: "LOAN",
    label: "Register loan",
    description: "Record a loan transaction",
    sectionTitle: "Loan information",
    icon: Landmark,
    iconClassName: "text-indigo-700",
    iconBackgroundClassName: "bg-indigo-50",
  },
];

export function getTransactionTypeOption(type: JournalTransactionType): TransactionTypeOption {
  return TRANSACTION_TYPE_OPTIONS.find((option) => option.value === type) ?? TRANSACTION_TYPE_OPTIONS[0];
}
