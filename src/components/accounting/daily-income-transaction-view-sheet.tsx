"use client";

import { Badge } from "@/components/ui/badge";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAuditDateTime } from "@/lib/audit/display";
import { getTransactionAssigneeDisplayName } from "@/lib/accounting/daily-income/assignee";
import { formatDailyIncomeMoney } from "@/lib/accounting/daily-income/display";
import { transactionTypeLabel } from "@/lib/accounting/daily-income/journal-form";
import { useDailyIncomeJournal } from "@/lib/accounting/daily-income/hooks";
import { getTransactionTypeOption } from "@/lib/accounting/daily-income/transaction-type-config";
import type { DailyIncomeJournal, JournalTransactionType } from "@/lib/accounting/daily-income/types";
import { formatAccountingDate } from "@/lib/accounting/display";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type DailyIncomeTransactionViewSheetProps = {
  journal: DailyIncomeJournal | null;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (journal: DailyIncomeJournal) => void;
  onDelete: (journal: DailyIncomeJournal) => void;
  canEdit?: boolean;
  canDelete?: boolean;
};

function journalTitle(row: DailyIncomeJournal, fallback: string) {
  return (row.invoice?.number ?? row.account?.displayName ?? row.account?.name ?? row.refNumber) || fallback;
}

function transactionTypeBadgeClass(type: JournalTransactionType) {
  switch (type) {
    case "EXPENSE":
      return "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "DISCOUNT":
      return "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "SURCHARGE":
      return "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-300";
    case "PAYMENT":
    case "INITIAL-PAYMENT":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "SALES":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "INVENTORY":
      return "border-transparent bg-teal-500/15 text-teal-700 dark:text-teal-300";
    case "TRANSFER":
      return "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300";
    case "LOAN":
      return "border-transparent bg-indigo-500/15 text-indigo-700 dark:text-indigo-300";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

function transactionAmountClassName(row: DailyIncomeJournal) {
  if (row.amount === 0) return "text-emerald-700";
  if (row.transactionType === "EXPENSE" || row.transactionType === "DISCOUNT") return "text-rose-600";
  return "text-emerald-700";
}

export function DailyIncomeTransactionViewSheet({
  journal,
  currency,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: DailyIncomeTransactionViewSheetProps) {
  const { t } = useTranslation();
  const detailQuery = useDailyIncomeJournal(open && journal ? journal.id : null);
  const resolved = detailQuery.data ?? journal;

  if (!journal || !resolved) return null;

  const typeOption = getTransactionTypeOption(resolved.transactionType, t);
  const typeLabel = transactionTypeLabel(resolved.transactionType, t);
  const title = journalTitle(resolved, typeLabel);
  const displayCurrency = resolved.currency || currency;
  const assignedTo = getTransactionAssigneeDisplayName(
    resolved.employee,
    resolved.route,
    resolved.employeeGroup,
  );
  const invoice = resolved.invoice;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={title}
          description={
            <span className={cn("font-semibold tabular-nums", transactionAmountClassName(resolved))}>
              {formatDailyIncomeMoney(resolved.amount, displayCurrency)}
            </span>
          }
          meta={
            <Badge variant="outline" className={cn("font-medium", transactionTypeBadgeClass(resolved.transactionType))}>
              {typeLabel}
            </Badge>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection icon={typeOption.icon} title={typeOption.sectionTitle}>
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.columns.date")}
              value={resolved.date ? formatAccountingDate(resolved.date) : undefined}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.assignedTo")}
              value={assignedTo}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.invoice")}
              value={invoice?.number}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.senderClient")}
              value={invoice?.sender?.name}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.receiverClient")}
              value={invoice?.receiver?.name}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.cost")}
              value={invoice?.cost != null && invoice.cost !== 0 ? formatDailyIncomeMoney(invoice.cost, displayCurrency) : undefined}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.invoiceSummary.paid")}
              value={invoice?.payment != null && invoice.payment !== 0 ? formatDailyIncomeMoney(invoice.payment, displayCurrency) : undefined}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.balance")}
              value={invoice?.balance != null && invoice.balance !== 0 ? formatDailyIncomeMoney(invoice.balance, displayCurrency) : undefined}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.account")}
              value={resolved.account?.displayName ?? resolved.account?.name}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.sourceAccount")}
              value={resolved.sourceAccount?.displayName ?? resolved.sourceAccount?.name}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.bankAccount")}
              value={resolved.paymentAccount?.displayName ?? resolved.paymentAccount?.name}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.paymentMethod")}
              value={resolved.paymentMethod?.name}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.zelleDate")}
              value={resolved.zelleTransactionDate ? formatAccountingDate(resolved.zelleTransactionDate) : undefined}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.zelleName")}
              value={resolved.zelleTransactionName}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.checkNumber")}
              value={resolved.checkNumber}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.amount")}
              value={
                <span className={cn("tabular-nums", transactionAmountClassName(resolved))}>
                  {formatDailyIncomeMoney(resolved.amount, displayCurrency)}
                </span>
              }
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.externalReferenceNumber")}
              value={resolved.externalReferenceNumber}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.referenceNumber")}
              value={resolved.refNumber}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.dailyIncome.form.fields.description")}
              value={resolved.description}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("accounting.dailyIncome.view.sections.audit")}>
            {resolved.duplicatePaymentOverride ? (
              <RecordViewSheetDetailRow
                label={t("accounting.dailyIncome.duplicatePayment.auditLabel")}
                value={t("accounting.dailyIncome.duplicatePayment.auditConfirmed")}
              />
            ) : null}
            <RecordViewSheetDetailRow
              label={t("common.audit.createdAt")}
              value={resolved.createdAt ? formatAuditDateTime(resolved.createdAt) : undefined}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("accounting.dailyIncome.actions.editTransaction")}
          deleteLabel={t("common.actions.delete")}
          onEdit={canEdit ? () => onEdit(resolved) : undefined}
          onDelete={canDelete ? () => onDelete(resolved) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
