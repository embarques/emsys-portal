import { CHART_ACCOUNT_TYPES, type ChartAccount, type ChartAccountType } from "@/lib/accounting/chart-accounts/types";
import type { AccountingLookup, DailyIncomeJournal, JournalTransactionType } from "./types";

export type ChartAccountsById = ReadonlyMap<number, Pick<ChartAccount, "name" | "displayName" | "type">>;

export type JournalAccountDisplay = {
  name: string;
  type: string;
};

export type JournalAccountLine = {
  id: number;
  name: string;
  type: string;
  debit: number;
  credit: number;
};

const CHART_ACCOUNT_TYPE_VALUES = new Set<string>(CHART_ACCOUNT_TYPES.map((option) => option.value));

/** Receipt journals that may also post SALES DISCOUNTS on the same entry. */
const RECEIPT_TRANSACTION_TYPES = new Set<JournalTransactionType>(["INITIAL-PAYMENT", "PAYMENT"]);

/** Lines that are never the money-in destination for a receipt. */
const NON_PAYMENT_DESTINATION_NAMES = new Set([
  "ACCOUNTS RECEIVABLE",
  "SALES",
  "SALES DISCOUNTS",
]);

export function isChartAccountType(value: string): value is ChartAccountType {
  return CHART_ACCOUNT_TYPE_VALUES.has(value);
}

export function buildChartAccountsById(accounts: readonly ChartAccount[]): ChartAccountsById {
  return new Map(accounts.map((account) => [account.id, account]));
}

/**
 * Journal rows carry a snapshot of the posted account line; prefer the live
 * chart-of-accounts entry (same display name and type as that screen) and fall
 * back to the snapshot when the account is not in the loaded chart.
 */
export function resolveJournalAccount(
  account: AccountingLookup | undefined,
  chartAccountsById?: ChartAccountsById,
): JournalAccountDisplay | null {
  if (!account) return null;
  const chartAccount = account.id > 0 ? chartAccountsById?.get(account.id) : undefined;
  return {
    name: chartAccount?.displayName || chartAccount?.name || account.displayName || account.name,
    type: (chartAccount?.type || account.type || "").toUpperCase(),
  };
}

/**
 * Pick the account line that should represent the journal in tables/detail.
 *
 * INITIAL-PAYMENT with cash/bank + discount posts both an asset destination and
 * SALES DISCOUNTS on one journal. Prefer the payment destination so the row is
 * not mislabeled as contra-revenue-only.
 */
export function pickJournalPrimaryAccountLine(
  accounts: readonly JournalAccountLine[] | undefined,
  transactionType?: string,
): JournalAccountLine | undefined {
  if (!accounts?.length) return undefined;

  if (transactionType && RECEIPT_TRANSACTION_TYPES.has(transactionType as JournalTransactionType)) {
    const paymentDestination = accounts.find(
      (account) => account.debit > 0 && !NON_PAYMENT_DESTINATION_NAMES.has(account.name),
    );
    if (paymentDestination) return paymentDestination;

    const discountLine = accounts.find(
      (account) => account.name === "SALES DISCOUNTS" && account.debit > 0,
    );
    if (discountLine) return discountLine;
  }

  return (
    accounts.find((account) => !["CASH ON HAND", "ACCOUNTS RECEIVABLE"].includes(account.name)) ??
    accounts[0]
  );
}

/**
 * Payments post cash/bank + AR (and optionally SALES DISCOUNTS). Prefer the
 * payment destination over a misleading primary `account` snapshot.
 */
export function resolveJournalRowAccount(
  row: Pick<DailyIncomeJournal, "account" | "accounts" | "paymentAccount"> & Partial<Pick<DailyIncomeJournal, "transactionType">>,
  chartAccountsById?: ChartAccountsById,
): JournalAccountDisplay | null {
  const primaryFromAccounts = pickJournalPrimaryAccountLine(row.accounts, row.transactionType);
  const isReceipt = Boolean(
    row.transactionType && RECEIPT_TRANSACTION_TYPES.has(row.transactionType),
  );

  if (isReceipt && row.paymentAccount) {
    return resolveJournalAccount(row.paymentAccount, chartAccountsById);
  }

  if (
    isReceipt &&
    primaryFromAccounts &&
    primaryFromAccounts.name !== "SALES DISCOUNTS" &&
    (!row.account || row.account.name === "SALES DISCOUNTS")
  ) {
    return resolveJournalAccount(
      {
        id: primaryFromAccounts.id,
        name: primaryFromAccounts.name,
        type: primaryFromAccounts.type,
      },
      chartAccountsById,
    );
  }

  const line = row.account ?? primaryFromAccounts ?? row.accounts?.[0];
  return resolveJournalAccount(line, chartAccountsById);
}
