import type {DataTableColumn} from "@/lib/table/types";
import type {DailyIncomeJournal} from "@/lib/accounting/daily-income/types";
import type {useTranslation} from "@/lib/i18n";
import {formatDailyIncomeMoney} from "@/lib/accounting/daily-income/display";
import {getTransactionAssigneeDisplayName} from "@/lib/accounting/daily-income/assignee";
import {isChartAccountType, resolveJournalRowAccount, type ChartAccountsById} from "@/lib/accounting/daily-income/journal-account";
import {readApiUserUsername} from "@/lib/table/api-table-fields";
import {transactionTypeLabel} from "@/lib/accounting/daily-income/journal-form";
import {TableTagText} from "@/components/app-shell/table-tag-text";
import {formatAuditDate, formatAuditDateTime} from "@/lib/audit/display";

export type JournalTableVariant = "closeout" | "reconciliation" | "clearance";

/** Most → least important column ids per workspace. */
const JOURNAL_COLUMN_ORDER: Record<JournalTableVariant, readonly string[]> = {
  closeout: [
    "date",
    "invoice",
    "amount",
    "invoiceBalance",
    "accountType",
    "account",
    "invoiceCost",
    "invoiceDiscount",
    "reference",
    "employee",
    "createdBy",
    "type",
    "paymentMethod",
    "createdAt",
    "reconciliationStatus",
    "clearanceStatus",
  ],
  reconciliation: [
    "date",
    "invoice",
    "amount",
    "reconciliationStatus",
    "paymentMethod",
    "invoiceBalance",
    "accountType",
    "account",
    "invoiceCost",
    "invoiceDiscount",
    "reference",
    "employee",
    "createdBy",
    "type",
    "clearanceStatus",
    "createdAt",
  ],
  clearance: [
    "date",
    "invoice",
    "amount",
    "clearanceStatus",
    "paymentMethod",
    "invoiceBalance",
    "accountType",
    "account",
    "invoiceCost",
    "invoiceDiscount",
    "reference",
    "employee",
    "createdBy",
    "type",
    "reconciliationStatus",
    "createdAt",
  ],
};

function orderJournalColumns(
  columns: DataTableColumn<DailyIncomeJournal>[],
  variant: JournalTableVariant,
): DataTableColumn<DailyIncomeJournal>[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const ordered: DataTableColumn<DailyIncomeJournal>[] = [];
  for (const id of JOURNAL_COLUMN_ORDER[variant]) {
    const column = byId.get(id);
    if (!column) continue;
    ordered.push(column);
    byId.delete(id);
  }
  for (const column of byId.values()) ordered.push(column);
  return ordered;
}

/** Columns ordered most → least important for the active journal workspace. */
export function journalTableColumns(
  t: ReturnType<typeof useTranslation>["t"],
  chartAccountsById?: ChartAccountsById,
  variant: JournalTableVariant = "closeout",
): DataTableColumn<DailyIncomeJournal>[] {
  const columns: DataTableColumn<DailyIncomeJournal>[] = [
    { id: "date", sortField: "date", label: t("accounting.dailyIncome.columns.date"), renderCell: (row) => row.date ? formatAuditDate(row.date) : t("common.empty.dash") },
    { id: "invoice", label: t("accounting.dailyIncome.columns.invoice"), renderCell: (row) => row.invoice?.number || t("common.empty.dash") },
    { id: "amount", label: t("accounting.dailyIncome.columns.payment"), cellClassName: "font-medium tabular-nums", renderCell: (row) => formatDailyIncomeMoney(row.amount, row.currency || "USD") },
    { id: "invoiceBalance", label: t("accounting.dailyIncome.columns.balance"), cellClassName: "tabular-nums", renderCell: (row) => row.invoice?.balance == null ? t("common.empty.dash") : formatDailyIncomeMoney(row.invoice.balance, row.currency || "USD") },
    { id: "accountType", label: t("accounting.dailyIncome.columns.accountType"), truncateCell: false, renderCell: (row) => {
      const type = resolveJournalRowAccount(row, chartAccountsById)?.type;
      if (!type) return t("common.empty.dash");
      return <TableTagText>{isChartAccountType(type) ? t(`accounting.chartOfAccounts.types.${type}`) : type}</TableTagText>;
    } },
    { id: "account", label: t("accounting.dailyIncome.columns.accountName"), renderCell: (row) => resolveJournalRowAccount(row, chartAccountsById)?.name || t("common.empty.dash") },
    { id: "invoiceCost", label: t("accounting.dailyIncome.columns.cost"), cellClassName: "tabular-nums", renderCell: (row) => row.invoice?.cost == null ? t("common.empty.dash") : formatDailyIncomeMoney(row.invoice.cost, row.currency || "USD") },
    { id: "invoiceDiscount", label: t("accounting.dailyIncome.form.invoiceSummary.discount"), cellClassName: "tabular-nums", renderCell: (row) => row.invoice?.discount == null ? t("common.empty.dash") : formatDailyIncomeMoney(row.invoice.discount, row.currency || "USD") },
    { id: "reference", label: t("accounting.dailyIncome.columns.reference"), renderCell: (row) => row.refNumber || t("common.empty.dash") },
    { id: "employee", label: t("accounting.dailyIncome.columns.employee"), renderCell: (row) => getTransactionAssigneeDisplayName(row.employee, row.route, row.employeeGroup) || t("common.empty.dash") },
    { id: "createdBy", label: t("accounting.dailyIncome.columns.user"), renderCell: (row) => readApiUserUsername(row.apiTableValues?.createdBy) || t("common.empty.dash") },
    { id: "type", defaultVisible: false, label: t("accounting.dailyIncome.columns.type"), truncateCell: false, renderCell: (row) => <TableTagText>{transactionTypeLabel(row.transactionType, t)}</TableTagText> },
    { id: "paymentMethod", defaultVisible: false, label: t("accounting.dailyIncome.columns.paymentMethod"), renderCell: (row) => row.paymentMethod?.name ?? t("common.empty.dash") },
    { id: "createdAt", label: t("accounting.journalReconciliation.createdAt"), sortField: "createdAt", renderCell: row => row.createdAt ? formatAuditDateTime(row.createdAt) : t("common.empty.dash") },
    { id: "reconciliationStatus", label: t("accounting.journalReconciliation.status"), truncateCell: false, renderCell: row => row.reconciliationStatus ? <TableTagText>{t(`accounting.journalReconciliation.${row.reconciliationStatus}`)}</TableTagText> : t("common.empty.dash") },
    { id: "clearanceStatus", label: t("accounting.journalClearance.status"), truncateCell: false, renderCell: row => row.clearanceStatus ? <TableTagText>{t(`accounting.journalClearance.${row.clearanceStatus}`)}</TableTagText> : t("common.empty.dash") },
  ];

  return orderJournalColumns(columns, variant);
}
