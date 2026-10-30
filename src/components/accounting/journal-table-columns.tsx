import type {DataTableColumn} from "@/lib/table/types";
import type {DailyIncomeJournal} from "@/lib/accounting/daily-income/types";
import type {useTranslation} from "@/lib/i18n";
import {formatDailyIncomeMoney} from "@/lib/accounting/daily-income/display";
import {getTransactionAssigneeDisplayName} from "@/lib/accounting/daily-income/assignee";
import {readApiUserUsername} from "@/lib/table/api-table-fields";
import {transactionTypeLabel} from "@/lib/accounting/daily-income/journal-form";
import {TableTagText} from "@/components/app-shell/table-tag-text";

export function journalTableColumns(t: ReturnType<typeof useTranslation>["t"]): DataTableColumn<DailyIncomeJournal>[] {
 return [
    { id: "date", sortField: "date", label: t("accounting.dailyIncome.columns.date"), renderCell: (row) => row.date || t("common.empty.dash") },
    { id: "invoice", label: t("accounting.dailyIncome.columns.invoice"), renderCell: (row) => row.invoice?.number || t("common.empty.dash") },
    { id: "reference", label: t("accounting.dailyIncome.columns.reference"), renderCell: (row) => row.refNumber || t("common.empty.dash") },
    { id: "createdBy", label: t("accounting.dailyIncome.columns.user"), renderCell: (row) => readApiUserUsername(row.apiTableValues?.createdBy) || t("common.empty.dash") },
    { id: "account", label: t("accounting.dailyIncome.columns.account"), renderCell: (row) => row.account?.displayName || row.account?.name || t("common.empty.dash") },
    { id: "invoiceCost", label: t("accounting.dailyIncome.columns.cost"), cellClassName: "tabular-nums", renderCell: (row) => row.invoice?.cost == null ? t("common.empty.dash") : formatDailyIncomeMoney(row.invoice.cost, row.currency || "USD") },
    { id: "amount", label: t("accounting.dailyIncome.columns.payment"), cellClassName: "font-medium tabular-nums", renderCell: (row) => formatDailyIncomeMoney(row.amount, row.currency || "USD") },
    { id: "invoiceBalance", label: t("accounting.dailyIncome.columns.balance"), cellClassName: "tabular-nums", renderCell: (row) => row.invoice?.balance == null ? t("common.empty.dash") : formatDailyIncomeMoney(row.invoice.balance, row.currency || "USD") },
    { id: "employee", label: t("accounting.dailyIncome.columns.employee"), renderCell: (row) => getTransactionAssigneeDisplayName(row.employee, row.route, row.employeeGroup) || t("common.empty.dash") },
    { id: "type", defaultVisible: false, label: t("accounting.dailyIncome.columns.type"), truncateCell: false, renderCell: (row) => <TableTagText>{transactionTypeLabel(row.transactionType, t)}</TableTagText> },
    { id: "paymentMethod", defaultVisible: false, label: t("accounting.dailyIncome.columns.paymentMethod"), renderCell: (row) => row.paymentMethod?.name ?? t("common.empty.dash") },

 {id: "createdAt", label: t("accounting.journalReconciliation.createdAt"), sortField: "createdAt", renderCell: row => row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"},
 {id: "reconciliationStatus", label: t("accounting.journalReconciliation.status"), renderCell: row => row.reconciliationStatus ? t(`accounting.journalReconciliation.${row.reconciliationStatus}`) : "—"},
 ];
}
