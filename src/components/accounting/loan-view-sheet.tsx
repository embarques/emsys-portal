"use client";

import { Banknote, FileSpreadsheet, Info, Printer, ReceiptText, User } from "lucide-react";

import {
  LoanRecordActions,
  type LoanRecordAction,
} from "@/components/accounting/loan-record-actions";
import {
  TableSelectionActionsMenu,
  TableSelectionActionItem
} from "@/components/app-shell/table-selection-actions-menu";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";

import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  formatLoanDate,
  formatLoanMoney,
  getLoanBalanceMoneyClass,
  loanStatusLabel,
} from "@/lib/accounting/loans/display";
import type { Loan, LoanTransaction } from "@/lib/accounting/loans/types";
import { useTranslation } from "@/lib/i18n";
import {
  tableSelectionActionMenuStyles,
  tableSelectionActionStyles,
} from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

function loanStatusClassName(status: Loan["status"]) {
  switch (status) {
    case "ACTIVE":
      return "border-transparent bg-emerald-100 text-emerald-800";
    case "PAID":
      return "border-transparent bg-slate-100 text-slate-700";
    case "VOID":
      return "border-transparent bg-rose-100 text-rose-700";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

type Props = {
  loan: Loan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payments: LoanTransaction[];
  paymentsLoading?: boolean;
  paymentsError?: string | null;
  canPay?: boolean;
  canIncrease?: boolean;
  canDecrease?: boolean;
  /** Show increase in the footer even when the API is not ready yet. */
  showIncreaseTodo?: boolean;
  isPrinting?: boolean;
  onPrint?: (loan: Loan) => void;
  onExportExcel?: (loan: Loan) => void;
  onAction?: (loan: Loan, action: LoanRecordAction) => void;
};

export function LoanViewSheet({
  loan,
  open,
  onOpenChange,
  payments,
  paymentsLoading = false,
  paymentsError = null,
  canPay = false,
  canIncrease = false,
  canDecrease = false,
  showIncreaseTodo = false,
  isPrinting = false,
  onPrint,
  onExportExcel,
  onAction,
}: Props) {
  const { t } = useTranslation();

  if (!loan) return null;

  const dash = t("common.empty.dash");
  const paymentEntries = payments.filter((entry) => entry.type === "PAYMENT");
  const reductions = payments.filter((entry) => entry.type === "DECREASE");
  const isActive = loan.status === "ACTIVE";
  const footerCanPay = Boolean(onAction) && canPay && isActive;
  const footerCanIncrease = Boolean(onAction) && canIncrease && isActive;
  const footerCanDecrease = Boolean(onAction) && canDecrease && isActive && loan.balance > 0;
  const footerShowIncreaseTodo = Boolean(onAction) && showIncreaseTodo && isActive;
  const showFooterActions =
    footerCanPay || footerCanIncrease || footerCanDecrease || footerShowIncreaseTodo;
  const showSecondaryActionsMenu = Boolean(onExportExcel) || showFooterActions;
  const showFooter = Boolean(onPrint) || showSecondaryActionsMenu;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          compact
          icon={Banknote}
          eyebrow={t("accounting.loans.fallbackDescription")}
          title={loan.employee.name.trim() || dash}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection icon={Banknote} title={t("accounting.loans.view.sections.loan")}>
            <RecordViewSheetDetailRow
              label={t("accounting.loans.details.status")}
              value={
                <Badge className={cn("font-medium", loanStatusClassName(loan.status))}>
                  {loanStatusLabel(loan.status, t)}
                </Badge>
              }
            />
            <RecordViewSheetDetailRow
              label={t("accounting.loans.columns.description")}
              value={loan.description || t("accounting.loans.fallbackDescription")}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.loans.details.balance")}
              value={
                <TableTagText className={getLoanBalanceMoneyClass(loan.balance)}>
                  {formatLoanMoney(loan.balance)}
                </TableTagText>
              }
            />
            <RecordViewSheetDetailRow
              label={t("accounting.loans.details.principal")}
              value={formatLoanMoney(loan.principalAmount)}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.loans.details.paid")}
              value={formatLoanMoney(loan.paidAmount)}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.loans.details.loanAccount")}
              value={loan.loanAccount?.displayName ?? loan.loanAccount?.name ?? dash}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.loans.columns.opened")}
              value={formatLoanDate(loan.openedAt) || dash}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.loans.details.lastActivity")}
              value={formatLoanDate(loan.lastActivityAt) || dash}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.loans.view.reference")}
              value={loan.referenceNumber || dash}
            />
            {loan.branch?.name ? (
              <RecordViewSheetDetailRow
                label={t("accounting.loans.view.branch")}
                value={loan.branch.name}
              />
            ) : null}
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={User} title={t("accounting.loans.view.sections.employee")}>
            <RecordViewSheetDetailRow
              label={t("accounting.loans.columns.employee")}
              value={loan.employee.name || dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={ReceiptText} title={t("accounting.loans.view.sections.payments")}>
            {paymentsError ? (
              <p role="alert" className="px-4 py-3 text-sm text-destructive">{paymentsError}</p>
            ) : paymentsLoading ? (
              <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
                {t("accounting.loans.payments.loading")}
              </p>
            ) : paymentEntries.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {t("accounting.loans.payments.noneRecorded")}
              </p>
            ) : (
              paymentEntries.map((payment) => (
                <div
                  key={payment.id}
                  className="border-b border-border/80 px-4 py-2.5 last:border-b-0 even:bg-muted/25"
                >
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {formatLoanDate(payment.transactionDate) || dash}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {payment.assetAccount?.displayName ??
                          payment.assetAccount?.name ??
                          t("accounting.loans.transactionTypes.PAYMENT")}
                      </p>
                      {payment.referenceNumber ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("accounting.loans.payments.refLabel")}: {payment.referenceNumber}
                        </p>
                      ) : null}
                      {payment.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {payment.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 font-semibold">{formatLoanMoney(payment.amount)}</p>
                  </div>
                </div>
              ))
            )}
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={ReceiptText} title={t("accounting.loans.view.sections.reductions")}>
            {paymentsError ? <p role="alert" className="px-4 py-3 text-sm text-destructive">{paymentsError}</p> : paymentsLoading ? <p role="status" className="px-4 py-3 text-sm text-muted-foreground">{t("accounting.loans.payments.loading")}</p> : reductions.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">{t("accounting.loans.reductions.empty")}</p> : reductions.map((entry) => (
              <div key={entry.id} className="border-b border-border/80 px-4 py-2.5 last:border-b-0 even:bg-muted/25">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{formatLoanDate(entry.transactionDate) || dash}</p>
                    <p className="text-muted-foreground">{entry.adjustmentAccount?.displayName ?? entry.adjustmentAccount?.name ?? t("accounting.loans.decreaseForm.lossAccountName")}</p>
                    <p className="text-xs text-muted-foreground">{t("accounting.loans.reductions.noneReceived")}</p>
                    {entry.referenceNumber ? <p className="mt-1 text-xs text-muted-foreground">{t("accounting.loans.payments.refLabel")}: {entry.referenceNumber}</p> : null}
                    {entry.description ? <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{entry.description}</p> : null}
                  </div>
                  <p className="shrink-0 font-semibold">{formatLoanMoney(entry.amount)}</p>
                </div>
              </div>
            ))}
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={Info} title={t("accounting.loans.view.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("common.audit.dateCreated")}
              value={loan.createdAt ? formatAuditDateTime(loan.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.createdBy")}
              value={loan.createdBy || dash}
            />
            {loan.updatedAt ? (
              <RecordViewSheetDetailRow
                label={t("common.audit.dateModified")}
                value={formatAuditDateTime(loan.updatedAt)}
              />
            ) : null}
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        {showFooter ? (
          <RecordViewSheetActions
            leading={
              <>
                <TableSelectionActionsMenu hidden={!showSecondaryActionsMenu}>
                  {onExportExcel ? (
                    <TableSelectionActionItem
                      disabled={isPrinting}
                      onSelect={() => onExportExcel(loan)}
                      className={tableSelectionActionMenuStyles.export}
                    >
                      <FileSpreadsheet className="size-4" />
                      {isPrinting
                        ? t("accounting.loans.payments.excelPreparing")
                        : t("accounting.loans.payments.excel")}
                    </TableSelectionActionItem>
                  ) : null}
                  {showFooterActions ? (
                    <LoanRecordActions
                      variant="menu"
                      canPay={footerCanPay}
                      canIncrease={footerCanIncrease}
                      canDecrease={footerCanDecrease}
                      showIncreaseTodo={footerShowIncreaseTodo}
                      onAction={(action) => onAction?.(loan, action)}
                    />
                  ) : null}
                </TableSelectionActionsMenu>
                {onPrint ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
                    disabled={isPrinting}
                    onClick={() => onPrint(loan)}
                  >
                    <Printer className="size-4" />
                    {isPrinting
                      ? t("accounting.loans.payments.printPreparing")
                      : t("accounting.loans.payments.print")}
                  </Button>
                ) : null}
              </>
            }
          />
        ) : null}
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
