import { CHART_ACCOUNT_TYPES, type ChartAccount, type ChartAccountType } from "@/lib/accounting/chart-accounts/types";
import type { AccountingLookup, DailyIncomeJournal } from "./types";

export type ChartAccountsById = ReadonlyMap<number, Pick<ChartAccount, "name" | "displayName" | "type">>;

export type JournalAccountDisplay = {
  name: string;
  type: string;
};

const CHART_ACCOUNT_TYPE_VALUES = new Set<string>(CHART_ACCOUNT_TYPES.map((option) => option.value));

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
 * Payments only post CASH ON HAND / ACCOUNTS RECEIVABLE lines, so they have no
 * primary `account`; show the debited line (where the money landed) instead.
 */
export function resolveJournalRowAccount(
  row: Pick<DailyIncomeJournal, "account" | "accounts">,
  chartAccountsById?: ChartAccountsById,
): JournalAccountDisplay | null {
  const line = row.account ?? row.accounts?.find((account) => account.debit > 0) ?? row.accounts?.[0];
  return resolveJournalAccount(line, chartAccountsById);
}
