import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import type { TranslateFn } from "@/lib/feedback/messages";
import { readApiUserUsername } from "@/lib/table/api-table-fields";
import { getTransactionAssigneeDisplayName } from "./assignee";
import { resolveJournalRowAccount } from "./journal-account";
import type { DailyIncomeJournal } from "./types";

type ClassifiableJournal = Pick<
  DailyIncomeJournal,
  | "id"
  | "refNumber"
  | "description"
  | "invoice"
  | "date"
  | "paymentMethod"
  | "checkNumber"
  | "externalReferenceNumber"
  | "employee"
  | "route"
  | "employeeGroup"
  | "account"
  | "sourceAccount"
  | "accounts"
  | "apiTableValues"
  | "transactionType"
  | "amount"
  | "inventoryDirection"
  | "transactionStatus"
  | "voidedAt"
  | "reversedAt"
  | "reversalOf"
>;

type ChartAccountNode = Pick<ChartAccount, "id" | "name" | "displayName" | "type" | "parentAccount">;

/** Contra-revenue that reduces accounts receivable; the API still types it as EXPENSE. */
export const SALES_DISCOUNTS_ACCOUNT = "SALES DISCOUNTS";

/** Daily Income expense for a journal: EXPENSE account lines win over the transaction type. */
export function journalExpenseAmount(item: ClassifiableJournal): number {
  const expenseLines = item.accounts.filter(
    (account) => account.type === "EXPENSE" && account.name !== SALES_DISCOUNTS_ACCOUNT,
  );
  if (expenseLines.length > 0) return expenseLines.reduce((total, account) => total + account.debit, 0);
  if (
    item.transactionType === "EXPENSE" ||
    (item.transactionType === "INVENTORY" && item.inventoryDirection === "received")
  ) {
    return item.amount;
  }
  return 0;
}

export function journalCountsAsIncome(item: ClassifiableJournal): boolean {
  return (
    ["INITIAL-PAYMENT", "PAYMENT", "SALES"].includes(item.transactionType) ||
    (item.transactionType === "INVENTORY" && item.inventoryDirection === "dispatched")
  );
}

export type JournalTotals = {
  currency: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
};

export type JournalBreakdownEntry = {
  id: string;
  label: string;
  amount: number;
  date?: string;
  invoiceOrExternalRef?: string;
  paymentMethod?: string;
  createdBy?: string;
  employee?: string;
  account?: string;
};

export type JournalBreakdownNode = {
  id: string;
  label: string;
  amount: number;
  children: JournalBreakdownNode[];
  /** Journals that land on this leaf category (parents keep only rolled-up totals). */
  entries: JournalBreakdownEntry[];
};

export type JournalCurrencyBreakdown = {
  currency: string;
  income: JournalBreakdownNode;
  expenses: JournalBreakdownNode;
  /** Surcharges, discounts, transfers, loans, and other non-revenue selections. */
  other: JournalBreakdownNode;
  net: number;
  count: number;
};

function cents(value: number) {
  return Math.round(value * 100) / 100;
}

function journalContributesAmounts(item: ClassifiableJournal): boolean {
  if (item.transactionStatus === "VOIDED" || item.transactionStatus === "REVERSED") return false;
  if (item.voidedAt || item.reversedAt || item.reversalOf) return false;
  return true;
}

function journalEntryLabel(item: ClassifiableJournal): string {
  return (
    item.refNumber?.trim() ||
    item.invoice?.number?.trim() ||
    item.description?.trim() ||
    item.id
  );
}

function journalInvoiceOrExternalRef(item: ClassifiableJournal): string {
  return (
    item.invoice?.number?.trim() ||
    item.checkNumber?.trim() ||
    item.externalReferenceNumber?.trim() ||
    item.refNumber?.trim() ||
    ""
  );
}

function loanMoneyAccountName(item: ClassifiableJournal): string | undefined {
  if (item.transactionType !== "LOAN" && item.transactionType !== "LOAN-PAYMENT") return undefined;
  return item.sourceAccount?.displayName?.trim() || item.sourceAccount?.name?.trim() || undefined;
}

function buildJournalBreakdownEntry(
  item: ClassifiableJournal,
  amount: number,
  chartById: ReadonlyMap<number, ChartAccountNode>,
  accountOverride?: { id?: number; name?: string },
): JournalBreakdownEntry {
  const loanMoney = loanMoneyAccountName(item);
  const resolved =
    accountOverride?.name?.trim() ||
    loanMoney ||
    resolveJournalRowAccount(
      {
        account: accountOverride?.id
          ? { id: accountOverride.id, name: accountOverride.name || "" }
          : item.account,
        accounts: item.accounts,
      },
      chartById,
    )?.name ||
    "";
  return {
    id: item.id,
    label: journalEntryLabel(item),
    amount: cents(amount),
    date: item.date || undefined,
    invoiceOrExternalRef: journalInvoiceOrExternalRef(item) || undefined,
    paymentMethod: item.paymentMethod?.name?.trim() || undefined,
    createdBy: readApiUserUsername(item.apiTableValues?.createdBy) || undefined,
    employee: getTransactionAssigneeDisplayName(item.employee, item.route, item.employeeGroup) || undefined,
    account: resolved || undefined,
  };
}

function emptyNode(id: string, label: string): JournalBreakdownNode {
  return { id, label, amount: 0, children: [], entries: [] };
}

function addAlongPath(
  root: JournalBreakdownNode,
  path: Array<{ id: string; label: string }>,
  amount: number,
  entry?: JournalBreakdownEntry,
) {
  // Reconciliation lists every selected journal for approval, including $0 rows.
  if (path.length === 0) return;
  if (amount === 0 && !entry) return;
  root.amount = cents(root.amount + amount);
  let node = root;
  for (const segment of path) {
    let child = node.children.find((existing) => existing.id === segment.id);
    if (!child) {
      child = emptyNode(segment.id, segment.label);
      node.children.push(child);
    }
    child.amount = cents(child.amount + amount);
    node = child;
  }
  if (entry) {
    const existing = node.entries.find((item) => item.id === entry.id);
    if (existing) existing.amount = cents(existing.amount + entry.amount);
    else node.entries.push({ ...entry, amount: cents(entry.amount) });
  }
}

function pruneZeroNodes(node: JournalBreakdownNode): JournalBreakdownNode {
  const children = node.children
    .map(pruneZeroNodes)
    .filter((child) => child.amount !== 0 || child.children.length > 0 || child.entries.length > 0)
    .sort((left, right) => left.label.localeCompare(right.label));
  const entries = [...node.entries].sort((left, right) => left.label.localeCompare(right.label));
  return { ...node, children, entries };
}

function hasBreakdownContent(node: JournalBreakdownNode): boolean {
  return node.amount !== 0 || node.children.length > 0 || node.entries.length > 0;
}

function accountLabel(account: ChartAccountNode | undefined, fallback: string) {
  return account?.displayName?.trim() || account?.name?.trim() || fallback;
}

/** Root-first chart-account path for nested expense categories. */
function expenseAccountPath(
  accountId: number,
  accountName: string,
  chartById: ReadonlyMap<number, ChartAccountNode>,
): Array<{ id: string; label: string }> {
  const chain: Array<{ id: string; label: string }> = [];
  const seen = new Set<number>();
  let current = accountId > 0 ? chartById.get(accountId) : undefined;
  while (current && !seen.has(current.id) && chain.length < 10) {
    seen.add(current.id);
    chain.push({ id: `account:${current.id}`, label: accountLabel(current, accountName) });
    const parentId = current.parentAccount?.id;
    current = parentId ? chartById.get(parentId) : undefined;
  }
  if (chain.length === 0) {
    const key = accountName.trim() || "expense";
    return [{ id: `account-name:${key.toUpperCase()}`, label: key }];
  }
  return chain.reverse();
}

/** Path segments under the Income root (Income itself is the section header). */
function incomePath(
  item: ClassifiableJournal,
  t: TranslateFn,
): Array<{ id: string; label: string }> {
  const group = (id: string) => ({
    id: `group:${id}`,
    label: t(`accounting.dailyIncome.wizard.typeSelector.groups.${id}`),
  });
  const typeLabel = (key: string) => ({
    id: `type:${key}`,
    label: t(`accounting.dailyIncome.transactionTypes.${key}.shortLabel`),
  });

  if (item.transactionType === "INITIAL-PAYMENT" || item.transactionType === "PAYMENT") {
    return [group("invoice"), typeLabel("payment")];
  }
  if (item.transactionType === "SALES") {
    return [group("otherIncome")];
  }
  if (item.transactionType === "INVENTORY" && item.inventoryDirection === "dispatched") {
    return [
      group("inventory"),
      {
        id: "inventory:dispatched",
        label: t("accounting.dailyIncome.form.inventory.dispatched"),
      },
    ];
  }
  return [typeLabel("sales")];
}

function expenseFallbackPath(item: ClassifiableJournal, t: TranslateFn): Array<{ id: string; label: string }> {
  const group = (id: string) => ({
    id: `group:${id}`,
    label: t(`accounting.dailyIncome.wizard.typeSelector.groups.${id}`),
  });
  if (item.transactionType === "INVENTORY" && item.inventoryDirection === "received") {
    return [
      group("inventory"),
      {
        id: "inventory:received",
        label: t("accounting.dailyIncome.form.inventory.received"),
      },
    ];
  }
  return [
    {
      id: "type:expense",
      label: t("accounting.dailyIncome.transactionTypes.expense.shortLabel"),
    },
  ];
}

/** Path for selected journals that do not affect income/expense/net (still need approval). */
function otherPath(
  item: ClassifiableJournal,
  t: TranslateFn,
): Array<{ id: string; label: string }> {
  const group = (id: string) => ({
    id: `group:${id}`,
    label: t(`accounting.dailyIncome.wizard.typeSelector.groups.${id}`),
  });
  const typeLabel = (key: string) => ({
    id: `type:${key}`,
    label: t(`accounting.dailyIncome.transactionTypes.${key}.shortLabel`),
  });

  switch (item.transactionType) {
    case "DISCOUNT":
      return [group("invoice"), typeLabel("discount")];
    case "SURCHARGE":
      return [group("invoice"), typeLabel("surcharge")];
    case "TRANSFER":
      return [group("transfers"), typeLabel("transfer")];
    case "LOAN":
      return [
        group("loans"),
        {
          id: "loan:issued",
          label: t("accounting.journalReconciliation.loanIssued"),
        },
      ];
    case "LOAN-PAYMENT":
      return [
        group("loans"),
        {
          id: "loan:payment",
          label: t("accounting.journalReconciliation.loanPayments"),
        },
      ];
    case "INVENTORY":
      return [
        group("inventory"),
        {
          id: `inventory:${item.inventoryDirection || "change"}`,
          label: item.inventoryDirection
            ? t(`accounting.dailyIncome.inventory.${item.inventoryDirection}`)
            : t("accounting.dailyIncome.transactionTypes.inventory.shortLabel"),
        },
      ];
    case "EXPENSE":
      return [typeLabel("expense")];
    case "SALES":
      return [group("otherIncome"), typeLabel("sales")];
    case "INITIAL-PAYMENT":
    case "PAYMENT":
      return [group("invoice"), typeLabel("payment")];
    default:
      return [{ id: "type:other", label: t("accounting.journalReconciliation.otherTransactions") }];
  }
}

/** Income, expenses and net income per currency, classified exactly like the Daily Income summary. */
export function summarizeJournalTotals(
  items: Array<ClassifiableJournal & Pick<DailyIncomeJournal, "currency">>,
): JournalTotals[] {
  const byCurrency = new Map<string, JournalTotals>();
  for (const item of items) {
    const currency = item.currency?.trim().toUpperCase() ?? "";
    const totals = byCurrency.get(currency) ?? { currency, income: 0, expenses: 0, net: 0, count: 0 };
    if (journalContributesAmounts(item)) {
      if (journalCountsAsIncome(item)) totals.income += item.amount;
      totals.expenses += journalExpenseAmount(item);
    }
    totals.count += 1;
    byCurrency.set(currency, totals);
  }
  return [...byCurrency.values()].map((totals) => ({
    ...totals,
    income: cents(totals.income),
    expenses: cents(totals.expenses),
    net: cents(totals.income - totals.expenses),
  }));
}

/**
 * Nested income / expense trees for revenue impact, plus an "other" tree for
 * surcharges, discounts, transfers, loans, and any selected journal that does
 * not affect income/expense/net but still needs reconciliation approval.
 */
export function summarizeJournalBreakdown(
  items: Array<ClassifiableJournal & Pick<DailyIncomeJournal, "currency">>,
  t: TranslateFn,
  chartAccounts: readonly ChartAccountNode[] = [],
): JournalCurrencyBreakdown[] {
  const chartById = new Map(chartAccounts.map((account) => [account.id, account]));
  const byCurrency = new Map<string, JournalCurrencyBreakdown>();

  for (const item of items) {
    const currency = item.currency?.trim().toUpperCase() ?? "";
    const row =
      byCurrency.get(currency) ??
      ({
        currency,
        income: emptyNode("income", t("accounting.journalReconciliation.income")),
        expenses: emptyNode("expenses", t("accounting.journalReconciliation.expenses")),
        other: emptyNode("other", t("accounting.journalReconciliation.otherTransactions")),
        net: 0,
        count: 0,
      } satisfies JournalCurrencyBreakdown);
    row.count += 1;

    if (!journalContributesAmounts(item)) {
      byCurrency.set(currency, row);
      continue;
    }

    let placedInRevenue = false;

    if (journalCountsAsIncome(item)) {
      addAlongPath(
        row.income,
        incomePath(item, t),
        item.amount,
        buildJournalBreakdownEntry(item, item.amount, chartById),
      );
      placedInRevenue = true;
    }

    const expenseLines = item.accounts.filter(
      (account) => account.type === "EXPENSE" && account.name !== SALES_DISCOUNTS_ACCOUNT && account.debit > 0,
    );
    if (expenseLines.length > 0) {
      for (const line of expenseLines) {
        addAlongPath(
          row.expenses,
          expenseAccountPath(line.id, line.name, chartById),
          line.debit,
          buildJournalBreakdownEntry(item, line.debit, chartById, line),
        );
      }
      placedInRevenue = true;
    } else {
      const amount = journalExpenseAmount(item);
      if (amount > 0) {
        addAlongPath(
          row.expenses,
          expenseFallbackPath(item, t),
          amount,
          buildJournalBreakdownEntry(item, amount, chartById),
        );
        placedInRevenue = true;
      }
    }

    if (!placedInRevenue) {
      addAlongPath(
        row.other,
        otherPath(item, t),
        item.amount,
        buildJournalBreakdownEntry(item, item.amount, chartById),
      );
    }

    byCurrency.set(currency, row);
  }

  return [...byCurrency.values()].map((row) => {
    const income = pruneZeroNodes(row.income);
    const expenses = pruneZeroNodes(row.expenses);
    const other = pruneZeroNodes(row.other);
    return {
      currency: row.currency,
      income,
      expenses,
      other,
      net: cents(income.amount - expenses.amount),
      count: row.count,
    };
  });
}

export { hasBreakdownContent };
