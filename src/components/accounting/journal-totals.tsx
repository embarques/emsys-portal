"use client";

import { useMemo } from "react";

import { formatDailyIncomeMoney } from "@/lib/accounting/daily-income/display";
import {
  hasBreakdownContent,
  summarizeJournalBreakdown,
  type JournalBreakdownEntry,
  type JournalBreakdownNode,
  type JournalCurrencyBreakdown,
} from "@/lib/accounting/daily-income/journal-classification";
import { resolveJournalRowAccount, type ChartAccountsById } from "@/lib/accounting/daily-income/journal-account";
import type { JournalCurrencySummary } from "@/lib/accounting/daily-income/reconciliation";
import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import { formatAuditDate } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";

function BreakdownTransactionTable({
  entries,
  tone,
  format,
}: {
  entries: JournalBreakdownEntry[];
  tone: "income" | "expense" | "neutral";
  format: (value: number) => string;
}) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const amountClass =
    tone === "income"
      ? "font-medium tabular-nums text-emerald-700 dark:text-emerald-400"
      : tone === "expense"
        ? "font-medium tabular-nums text-rose-600 dark:text-rose-400"
        : "font-medium tabular-nums text-foreground";
  const headers = [
    t("accounting.dailyIncome.columns.date"),
    t("accounting.journalReconciliation.confirmList.invoiceOrExternalRef"),
    t("accounting.dailyIncome.columns.paymentMethod"),
    t("accounting.journalReconciliation.confirmList.digitizedBy"),
    t("accounting.journalReconciliation.confirmList.employeeResponsible"),
    t("accounting.dailyIncome.columns.account"),
    t("accounting.dailyIncome.columns.amount"),
  ];

  if (entries.length === 0) return null;

  return (
    <div className="mt-1.5 overflow-x-auto rounded-md border">
      <table className="w-full min-w-[44rem] text-xs">
        <caption className="sr-only">{t("accounting.journalReconciliation.confirmList.caption")}</caption>
        <thead className="bg-muted/60 text-left text-muted-foreground">
          <tr>
            {headers.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={`whitespace-nowrap px-2 py-1.5 font-medium${index === headers.length - 1 ? " text-right" : ""}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t">
              <td className="whitespace-nowrap px-2 py-1.5">
                {entry.date ? formatAuditDate(entry.date) : dash}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5">
                {entry.invoiceOrExternalRef || entry.label || dash}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5">{entry.paymentMethod || dash}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{entry.createdBy || dash}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{entry.employee || dash}</td>
              <td className="px-2 py-1.5">{entry.account || dash}</td>
              <td className={`whitespace-nowrap px-2 py-1.5 text-right ${amountClass}`}>
                {format(entry.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BreakdownRows({
  node,
  depth,
  tone,
  format,
  showTransactions,
}: {
  node: JournalBreakdownNode;
  depth: number;
  tone: "income" | "expense" | "neutral";
  format: (value: number) => string;
  showTransactions: boolean;
}) {
  const amountClass =
    tone === "income"
      ? "font-medium tabular-nums text-emerald-700 dark:text-emerald-400"
      : tone === "expense"
        ? "font-medium tabular-nums text-rose-600 dark:text-rose-400"
        : "font-medium tabular-nums text-foreground";
  const labelClass = depth === 0 ? "font-medium text-foreground" : "text-muted-foreground";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-4" style={{ paddingLeft: depth * 12 }}>
        <dt className={labelClass}>{node.label}</dt>
        <dd className={amountClass}>{format(node.amount)}</dd>
      </div>
      {showTransactions && node.entries.length > 0 ? (
        <div style={{ paddingLeft: (depth + 1) * 12 }}>
          <BreakdownTransactionTable entries={node.entries} tone={tone} format={format} />
        </div>
      ) : null}
      {node.children.map((child) => (
        <BreakdownRows
          key={child.id}
          node={child}
          depth={depth + 1}
          tone={tone}
          format={format}
          showTransactions={showTransactions}
        />
      ))}
    </div>
  );
}

function emptySection(id: string, label: string, amount = 0): JournalBreakdownNode {
  return { id, label, amount, children: [], entries: [] };
}

export function JournalTotals({
  label,
  totals,
  journals,
  chartAccounts,
  loading,
  layout = "stacked",
  showTransactions = false,
}: {
  label: string;
  totals?: JournalCurrencySummary[];
  journals?: DailyIncomeJournal[];
  chartAccounts?: ChartAccount[];
  loading: boolean;
  /** `inline` fits the selection toolbar row; `stacked` is the detailed confirm layout. */
  layout?: "inline" | "stacked";
  /** List individual journals under each category leaf (reconciliation confirm). */
  showTransactions?: boolean;
}) {
  const { t, locale } = useTranslation();
  const number = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const breakdown = useMemo(
    () => (journals?.length ? summarizeJournalBreakdown(journals, t, chartAccounts ?? []) : []),
    [journals, t, chartAccounts],
  );
  const rows: JournalCurrencyBreakdown[] = useMemo(() => {
    if (breakdown.length === 0) {
      return (totals ?? []).map((row) => ({
        currency: row.currency,
        income: emptySection("income", t("accounting.journalReconciliation.income"), row.income),
        expenses: emptySection("expenses", t("accounting.journalReconciliation.expenses"), row.expenses),
        other: emptySection("other", t("accounting.journalReconciliation.otherTransactions")),
        net: row.net,
        count: row.count,
      }));
    }
    const apiByCurrency = new Map(
      (totals ?? []).map((row) => [row.currency?.trim().toUpperCase() ?? "", row]),
    );
    return breakdown.map((row) => {
      const api = apiByCurrency.get(row.currency?.trim().toUpperCase() ?? "");
      if (!api) return row;
      return {
        ...row,
        income: { ...row.income, amount: api.income },
        expenses: { ...row.expenses, amount: api.expenses },
        net: api.net,
        count: api.count,
      };
    });
  }, [breakdown, totals, t]);

  if (layout === "inline") {
    return (
      <div aria-busy={loading} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <p className="font-medium whitespace-nowrap">{label}</p>
        {loading ? (
          <span role="status" className="text-muted-foreground">
            {t("accounting.dailyIncome.transactions.loadingTitle")}
          </span>
        ) : (
          rows.map((row) => (
            <div key={row.currency || "currency"} className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-xs font-semibold text-muted-foreground">{row.currency || "—"}</span>
              <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-1.5">
                  <dt className="text-muted-foreground">{row.income.label}</dt>
                  <dd className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                    {number(row.income.amount)}
                  </dd>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dt className="text-muted-foreground">{row.expenses.label}</dt>
                  <dd className="font-medium tabular-nums text-rose-600 dark:text-rose-400">
                    {number(row.expenses.amount)}
                  </dd>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dt className="text-muted-foreground">{t("accounting.journalReconciliation.net")}</dt>
                  <dd className="font-semibold tabular-nums">{number(row.net)}</dd>
                </div>
              </dl>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div aria-busy={loading} className="space-y-3 text-sm">
      <p className="font-medium">{label}</p>
      {loading ? (
        <span role="status" className="text-muted-foreground">
          {t("accounting.dailyIncome.transactions.loadingTitle")}
        </span>
      ) : (
        rows.map((row) => (
          <div
            key={row.currency || "currency"}
            className={`space-y-3 overscroll-contain ${showTransactions ? "max-h-[36rem]" : "max-h-64"} overflow-y-auto`}
          >
            <p className="text-xs font-semibold text-muted-foreground">{row.currency || "—"}</p>
            <dl className="space-y-3">
              <BreakdownRows
                node={row.income}
                depth={0}
                tone="income"
                format={number}
                showTransactions={showTransactions}
              />
              <BreakdownRows
                node={row.expenses}
                depth={0}
                tone="expense"
                format={number}
                showTransactions={showTransactions}
              />
              {showTransactions && hasBreakdownContent(row.other) ? (
                <BreakdownRows
                  node={row.other}
                  depth={0}
                  tone="neutral"
                  format={number}
                  showTransactions={showTransactions}
                />
              ) : null}
              <div className="flex items-baseline justify-between gap-4 border-t pt-3">
                <dt className="font-semibold">{t("accounting.journalReconciliation.net")}</dt>
                <dd className="font-semibold tabular-nums">{number(row.net)}</dd>
              </div>
            </dl>
          </div>
        ))
      )}
    </div>
  );
}

export function ClearanceConfirmList({
  rows,
  chartAccountsById,
}: {
  rows: DailyIncomeJournal[];
  chartAccountsById: ChartAccountsById;
}) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const headers = [
    t("accounting.dailyIncome.columns.date"),
    t("accounting.dailyIncome.columns.invoice"),
    t("accounting.dailyIncome.columns.reference"),
    t("accounting.journalClearance.confirmList.externalReference"),
    t("accounting.dailyIncome.columns.paymentMethod"),
    t("accounting.dailyIncome.columns.accountName"),
    t("accounting.dailyIncome.columns.payment"),
  ];
  return (
    <div className="max-h-64 overflow-auto rounded-md border">
      <table className="w-full text-xs">
        <caption className="sr-only">{t("accounting.journalClearance.confirmList.caption")}</caption>
        <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
          <tr>
            {headers.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={`whitespace-nowrap px-2 py-1.5 font-medium${index === headers.length - 1 ? " text-right" : ""}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="whitespace-nowrap px-2 py-1.5">{row.date ? formatAuditDate(row.date) : dash}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{row.invoice?.number || dash}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{row.refNumber || dash}</td>
              <td className="whitespace-nowrap px-2 py-1.5">
                {row.checkNumber || row.externalReferenceNumber || dash}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5">{row.paymentMethod?.name || dash}</td>
              <td className="px-2 py-1.5">{resolveJournalRowAccount(row, chartAccountsById)?.name || dash}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium tabular-nums">
                {formatDailyIncomeMoney(row.amount, row.currency || "USD")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
