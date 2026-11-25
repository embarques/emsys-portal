import {
  ArrowLeftRight,
  ArrowUpCircle,
  BadgePlus,
  Banknote,
  CircleMinus,
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
import { isInventoryEnabled } from "@/lib/inventory/feature";

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
  "LOAN-PAYMENT": "loanPayment",
  "LOAN-DECREASE": "loanDecrease",
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

export type TransactionEntryCategory =
  | JournalTransactionType
  | "INVENTORY-PAYMENT"
  | "LOAN-ISSUE"
  | "LOAN-INCREASE"
  | "LOAN-DECREASE"
  | "LOAN-PAYMENT";
export type TransactionEntryOption = Omit<TransactionTypeOption, "value"> & { value: TransactionEntryCategory };

type EntryChooserNode = {
  id: string;
  icon: LucideIcon;
  /** Leaf types shown at this level. Single-category nodes select immediately when opened. */
  categories?: TransactionEntryCategory[];
  /** Nested chooser nodes. Prefer children for multi-step drill-downs. */
  children?: EntryChooserNode[];
};

/**
 * Income → Invoice (Payment new/existing, Surcharge, Discount) | Other;
 * then Expense, Inventory, Loan, Transfer.
 */
const ENTRY_CHOOSER_TREE: EntryChooserNode[] = [
  {
    id: "income",
    icon: ArrowUpCircle,
    children: [
      {
        id: "invoice",
        icon: FileText,
        children: [
          // Payment opens one adaptive form: search an existing invoice or create a new one.
          { id: "invoicePayment", icon: Banknote, categories: ["PAYMENT"] },
          { id: "invoiceSurcharge", icon: Percent, categories: ["SURCHARGE"] },
          { id: "invoiceDiscount", icon: Tag, categories: ["DISCOUNT"] },
        ],
      },
      { id: "otherIncome", icon: ArrowUpCircle, categories: ["SALES"] },
    ],
  },
  { id: "expenses", icon: Wallet, categories: ["EXPENSE"] },
  ...(isInventoryEnabled()
    ? [{ id: "inventory", icon: Package, categories: ["INVENTORY", "INVENTORY-PAYMENT"] } satisfies EntryChooserNode]
    : []),
  {
    id: "loans",
    icon: Landmark,
    categories: [
      "LOAN-ISSUE",
      ...(isLoanIncreaseEnabled() ? (["LOAN-INCREASE"] as const) : []),
      "LOAN-DECREASE",
      "LOAN-PAYMENT",
    ],
  },
  { id: "transfers", icon: ArrowLeftRight, categories: ["TRANSFER"] },
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
    ["LOAN-DECREASE", "loanDecrease", CircleMinus],
    ["LOAN-PAYMENT", "loanPayment", HandCoins],
  ] as const) {
    options.push({ value, label: t(`accounting.dailyIncome.transactionTypes.${key}.label`),
      description: t(`accounting.dailyIncome.transactionTypes.${key}.description`),
      sectionTitle: t(`accounting.dailyIncome.transactionTypes.${key}.label`),
      icon, iconClassName: "text-indigo-700", iconBackgroundClassName: "bg-indigo-50" });
  }
  return options;
}

export type TransactionEntryGroup = {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  options: TransactionEntryOption[];
  children: TransactionEntryGroup[];
};

function buildEntryGroup(node: EntryChooserNode, optionsByValue: Map<TransactionEntryCategory, TransactionEntryOption>, t: TranslateFn): TransactionEntryGroup {
  return {
    id: node.id,
    icon: node.icon,
    label: t(`accounting.dailyIncome.wizard.typeSelector.groups.${node.id}`),
    description: t(`accounting.dailyIncome.wizard.typeSelector.groupHints.${node.id}`),
    options: (node.categories ?? []).flatMap((category) => {
      const option = optionsByValue.get(category);
      return option ? [option] : [];
    }),
    children: (node.children ?? []).map((child) => buildEntryGroup(child, optionsByValue, t)),
  };
}

export function buildTransactionEntryGroups(t: TranslateFn): TransactionEntryGroup[] {
  const optionsByValue = new Map(buildTransactionEntryOptions(t).map((option) => [option.value, option]));
  return ENTRY_CHOOSER_TREE.map((node) => buildEntryGroup(node, optionsByValue, t));
}

/** Resolve a drill-down path from the root groups. */
export function resolveTransactionEntryGroup(
  groups: TransactionEntryGroup[],
  path: string[],
): TransactionEntryGroup | null {
  let nodes = groups;
  let current: TransactionEntryGroup | null = null;
  for (const id of path) {
    current = nodes.find((group) => group.id === id) ?? null;
    if (!current) return null;
    nodes = current.children;
  }
  return current;
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
